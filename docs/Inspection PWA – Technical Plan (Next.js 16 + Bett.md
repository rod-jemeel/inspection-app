# Inspection PWA – Technical Plan (Next.js 16 + Better Auth + Supabase + Vercel)

Build an online-first PWA that replaces paper inspection binders with per-location recurring inspection checklists, strong auditability, and signature-backed sign-off, plus automated email reminders based on frequency (weekly/monthly/yearly/every-3-years). The Excel task list you shared already maps cleanly into these frequencies and can be used as seed “templates” for generating recurring inspections.[^1]

## 1) Scope and requirements

### In-scope (MVP)

- Multi-location CRUD for inspection **templates** and generated **inspection instances** (weekly/monthly/yearly/every-3-years).[^1]
- Two auth modes: full login for staff/admins, and invite-code access for inspectors (no password required).
- Completing an inspection requires: status, remarks, inspection date/time, and captured signature image (signature_pad).
- Failure lifecycle: allow “failed”, record fail details/date, then allow re-inspection and record “passed on” date.
- Email alerts: weekly emails every Monday; monthly reminders 1 week before due; overdue escalates to inspector + owner immediately.

### Explicit non-goals (for now)

- Offline-first / background sync.
- Replacing any clinical EHR workflows (this is operational/compliance tracking only).
- Complex inventory module (only digitize existing binder-style forms initially).

## 2) Architecture (Next 16 + Vercel + Supabase)

### High-level components

- **Next.js 16 PWA**: App Router UI + API routes.
- **Better Auth** mounted in a Next.js API route (recommended `/api/auth/[...all]`) to provide session handling and auth endpoints.[^2]
- **Supabase Postgres** as the system of record (inspection templates, instances, signatures, logs, invites, notifications).
- **Vercel** deployment: web app + API routes; scheduled jobs for reminders via Vercel Cron Jobs.

### Runtime boundaries

- Client (browser/PWA): list screens, forms, signature capture, minimal local state.
- Server (Next API routes / server actions): permission checks, invite-code exchange, creating recurring instances, generating signed URLs, triggering emails.
- DB (Supabase): RLS-enforced access; immutable audit logs.

## 3) Data model + RLS (Supabase)

### Core tables (recommended)

Use templates for “what needs to be done”, and instances for “a specific due occurrence”.

1. `locations`

- `id` (uuid), `name`, `timezone`, `active`

2. `profiles`

- `id` (uuid, FK to auth user id from Better Auth DB), `full_name`, `email`, `phone`
- `role` enum: `owner | admin | nurse | inspector`
- `location_ids` (uuid[] or join table `profile_locations`)

3. `inspection_templates`

- `id` uuid
- `task` (string), `description` (text)
- `frequency` enum: `weekly | monthly | yearly | every_3_years`
- `location_id`
- `default_assignee_profile_id` (nullable)
- `default_due_rule` (jsonb, optional; lets you encode “every Monday”, “day 1 of month”, etc.)
- `active` boolean
- `created_by`, `created_at`, `updated_at`

4. `inspection_instances`

- `id` uuid
- `template_id`, `location_id`
- `due_at` timestamp (this replaces a plain `to_be_done_before_date` and supports time zones)
- `assigned_to_profile_id`, `assigned_to_email` (denormalized for emailing)
- `status` enum: `pending | in_progress | failed | passed | void`
- `remarks` text
- `inspected_at` timestamp (nullable)
- `failed_at` timestamp (nullable)
- `passed_at` timestamp (nullable; for re-inspection success)
- `created_by`, `created_at`

5. `inspection_signatures`

- `id` uuid
- `inspection_instance_id`
- `signed_by_profile_id`
- `signed_at` timestamp
- `signature_image_path` (Supabase Storage path) OR `signature_image_bytes` (bytea; storage is usually better)
- `signature_points` jsonb (optional: store raw points in addition to image)
- `device_meta` jsonb (optional: user agent, screen size)

6. `inspection_events` (immutable audit log)

- `id` uuid
- `inspection_instance_id`
- `event_type` enum: `created | assigned | started | failed | passed | signed | comment | reminder_sent | escalated`
- `event_at` timestamp
- `actor_profile_id` (nullable for cron/system)
- `payload` jsonb

7. `invite_codes`

- `id` uuid
- `code_hash` text (never store plain code)
- `expires_at` timestamp
- `max_uses` int default 1, `uses` int default 0
- `role_grant` enum (usually `inspector`)
- `location_id`
- `assigned_email` (optional)
- `created_by`, `created_at`
- `consumed_at` (nullable)

8. `notification_outbox` (optional but recommended)

- `id` uuid
- `type` enum: `reminder | overdue | escalation`
- `to_email`, `subject`, `payload` jsonb
- `status` enum: `queued | sent | failed`
- `created_at`, `sent_at`, `error`

### Supabase RLS policy approach

- Enable RLS on all tables you expose to the client; Supabase explicitly recommends RLS for browser-accessible schemas, and notes it “must always be enabled” for exposed schemas (e.g., `public`).[^3]
- Use “location-based access” policies: user can read/write only rows where `location_id` is in their allowed locations.
- Use “role-based permissions”: inspectors can update only their assigned `inspection_instances`, while admins can CRUD templates/instances.

### Storage (signatures)

- Store signature PNG as a file in Supabase Storage; keep the DB row with path + metadata.
- Keep an immutable record: once signed, disallow overwriting signature; allow “void and re-issue” if needed.

## 4) Authentication \& authorization (Better Auth)

### Better Auth integration (Next.js 16)

- Mount Better Auth handler in a Next API route (docs recommend `/api/auth/[...all]`).[^2]
- Create a Better Auth client in `lib/auth-client.ts` (per docs) for sign-in/sign-out and session state in UI.[^2]
- If you use Next.js 16 “proxy.ts” for route protection, Better Auth docs note Next.js 16+ replaces middleware with proxy and Better Auth methods work similarly for session validation.[^2]

### Email/password (full login)

- Use Better Auth email/password provider for staff/admins; Better Auth stores password credentials in an account table and hashes using **scrypt**.[^4]
- Required screens:
  - `/login` (email + password)
  - Optional: forgot-password + reset-password (strongly recommended for staff)

### Invite code (inspector quick access)

Goal: inspectors can access only what they need (their assigned inspections, for allowed location), with short-lived access and full auditability.

**Flow**

1. Admin creates invite:
   - UI: “Create invite for inspector”
   - Server: generate random code (e.g., 8 chars), store hash in `invite_codes`, set expiry.
2. Inspector enters code on `/invite`:
   - Server validates hash + expiry + uses.
   - Server either:
     - Creates a Better Auth user (if you want persisted identities), or
     - Creates an ephemeral session mapped to a lightweight “inspector profile”.
3. Inspector gets session cookie/JWT and can proceed to assigned inspection list.

**Important design choice**

- Stronger audit trail: create real inspector users (even if they only ever use invite code), so signatures always map to a persistent identity.

### Authorization checks

- Enforce at 3 layers:
  - UI route guards (basic UX)
  - API route validation (must)
  - DB RLS policies (critical “last line of defense”).[^3]

## 5) Product flows, reminders, signatures, deployment

### CRUD flows

**Templates (admin)**

- Create/edit: task, description, frequency, location, default due rule, default assignee.
- Bulk import: paste from Excel into a “staging grid” → validate → create templates.[^1]

**Instances (system + admin)**

- Instances are generated automatically from templates (e.g., weekly creates the next due date per rule).
- Admin can also create one-off instances (special inspections).

**Complete inspection (inspector)**

- Inspector opens instance → fills remarks → sets status (passed/failed) → signs → submits.
- On submit:
  - Update instance status fields (`inspected_at`, `failed_at` / `passed_at`)
  - Store signature
  - Append `inspection_events` rows

### Failure → re-inspection lifecycle

- If failed:
  - Mark `status=failed`, set `failed_at`, store remarks.
  - Notify owner/admin immediately.
- Re-inspection:
  - Either reuse same instance with status transitions, or create a “follow-up instance” linked to original.
  - Record `passed_at` when corrected and re-inspected.

Recommended: reuse same instance with an event log trail to keep history clean (fail → fix → pass).

### Signature capture (signature_pad)

- Use `signature_pad` on a `<canvas>`; save as a PNG data URL via `signaturePad.toDataURL()` and upload to storage.[^5]
- Validate before submit: `signaturePad.isEmpty()` must be false.[^6]
- Store both:
  - PNG image (for human viewing during audits)
  - Optional raw points via `signaturePad.toData()` (for later re-rendering or verification workflows)

### Reminder and escalation engine (Vercel Cron)

Implement reminders as a scheduled API route that runs on Vercel Cron Jobs.

**Vercel config**

- Define cron schedules in `vercel.json` with a `path` and `schedule`.[^7][^8]

Example `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 14 * * 1" },
    { "path": "/api/cron/reminders", "schedule": "0 14 * * *" }
  ]
}
```

(You can run daily + also Monday-specific logic inside the handler, depending on how you prefer to implement routing.)[^8][^7]

**Reminder rules (from your spec)**

- Weekly: send every Monday morning to assigned inspector(s).
- Monthly: send 1 week before due date.
- Overdue: if `now > due_at` and not signed/completed, email inspector again and escalate to owner immediately.

**Handler responsibilities (`/api/cron/reminders`)**

- Query `inspection_instances` where:
  - `status in (pending, in_progress, failed-but-needs-reinspect)` depending on your business rules
  - `due_at` within reminder windows OR overdue
- Create `inspection_events` records for every reminder/escalation sent (auditable trail).
- Write to `notification_outbox` then send email (or send immediately and log result).

### Email delivery

- Use a transactional email provider (Resend/SendGrid/etc.) from server-side only.
- Email templates should include: location, task, due date, link to open the exact inspection instance.

### Deployment checklist (Vercel + Supabase)

- Vercel env vars:
  - `BETTER_AUTH_URL` (public base URL) as required by Better Auth setups.[^9]
  - DB connection string to Supabase Postgres (server-side only)
  - Email provider API keys
  - Owner escalation email(s)
- Supabase:
  - Create tables + indexes (especially on `due_at`, `location_id`, `assigned_to_profile_id`, `status`)
  - Enable RLS + policies (required for exposed schemas).[^3]
  - Storage bucket for signatures with restricted read access (signed URLs or admin-only access)

---

If you want, I can turn this into a concrete “v1 schema.sql” (tables + indexes + RLS policies) and a “routes spec” (request/response DTOs for each API route) tailored to your exact location list and roles.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31]</span>

<div align="center">⁂</div>

[^1]: task-list-and-useful-info.xlsx

[^2]: https://www.better-auth.com/docs/integrations/next

[^3]: https://supabase.com/docs/guides/database/postgres/row-level-security

[^4]: https://www.better-auth.com/docs/authentication/email-password

[^5]: https://npm.io/package/signature_pad

[^6]: https://www.npmjs.com/package/signature_pad

[^7]: https://vercel.com/docs/cron-jobs

[^8]: https://vercel.com/guides/how-to-setup-cron-jobs-on-vercel

[^9]: https://www.youtube.com/watch?v=x4hQ2Hmuy3k

[^10]: https://www.better-auth.com/docs/examples/next-js

[^11]: https://www.youtube.com/watch?v=n6rP9d3RWo8

[^12]: https://www.youtube.com/watch?v=gzYTDGToYcw

[^13]: https://stackoverflow.com/questions/79220373/how-to-configure-better-auths-drizzleadapter-to-generate-supabase-compatible-uu

[^14]: https://dev.to/onurhandtr/automate-the-tasks-using-vercel-cron-jobs-ieh

[^15]: https://www.youtube.com/watch?v=HOVuVSmkloc

[^16]: https://www.answeroverflow.com/m/1388546160532263063

[^17]: https://www.youtube.com/watch?v=D2f_gN1uZbc

[^18]: https://www.better-auth.com/docs/guides/supabase-migration-guide

[^19]: https://www.youtube.com/watch?v=w5Emwt3nuV0

[^20]: https://www.better-auth.com/docs/guides/create-a-db-adapter

[^21]: https://github.com/szimek/signature_pad

[^22]: https://www.npmjs.com/package/signature_pad/v/4.0.4

[^23]: https://www.presidio.com/technical-blog/building-a-signature-pad-in-angular-a-step-by-step-guide/

[^24]: https://www.jsdelivr.com/package/npm/signature_pad

[^25]: https://docs-hzf0f3xij-supabase.vercel.app/docs/guides/auth/row-level-security

[^26]: https://dev.to/devrayat000/email-verification-with-better-auth-basics-tutorial-ep-2-3mm3

[^27]: https://community.weweb.io/t/add-a-signature-pad-using-npm/5055

[^28]: https://supabase.com/features/row-level-security

[^29]: https://better-auth.vercel.app/docs/authentication/email-password

[^30]: https://github.com/szimek/signature_pad/blob/master/README.md

[^31]: https://dev.to/thebenforce/lock-down-your-data-implement-row-level-security-policies-in-supabase-sql-4p82
