# Architecture (MVP)

**Stack**: Next.js 16, React 19, App Router, Better Auth, Supabase, Vercel

## Summary

Single Next.js application serving:
1. **PWA frontend** (React 19 + App Router)
2. **Backend API** via Route Handlers / Server Actions
3. **Auth** via Better Auth (email/password + invite codes)
4. **Scheduled jobs** via Vercel Cron (reminders/escalations)

Supabase provides **Postgres** (app data + RLS) and **Storage** (signature images).

### Why single-deploy for MVP

- Next.js App Router handles REST endpoints + Server Actions.
- `proxy.ts` replaces middleware with full Node.js runtime for auth validation.
- Vercel Cron Jobs handle scheduled reminders without a separate worker.

---

## Request Flow

```text
[Client: Next.js PWA]
   |  HTTPS (HttpOnly cookies)
   v
[proxy.ts] -- session validation (full Node.js runtime)
   |
   v
[Next.js Server]
   |  (auth + location access + role checks)
   v
[Supabase Postgres + RLS]  +  [Supabase Storage (signatures)]

[Vercel Cron] --> [/api/cron/reminders] --> [Email provider (Resend/SendGrid)]
```

### Authenticated request lifecycle

1. User navigates to a protected route.
2. `proxy.ts` validates Better Auth session (or invite-code session).
3. If authenticated, request proceeds; otherwise redirects to `/login` or `/invite`.
4. Page component fetches data (`params` and `searchParams` are Promises -- always `await`).
5. Route Handlers verify location access and role, then query Supabase scoped to `location_id`.

### Invite code flow

1. Admin creates invite code (hashed, with expiry).
2. Inspector enters code on `/invite`.
3. Server validates hash + expiry + usage count.
4. Server creates a Better Auth user (for persistent identity / audit trail).
5. Inspector gets session cookie and sees assigned inspections.

---

## Location-Based Access Model

Access boundary = **Location** (not Organization).

### Rules

- All database reads/writes include `location_id` filters.
- Auth + location access verified on every API endpoint.
- Role-based permissions enforced server-side.
- RLS policies on all tables as last line of defense.

### Roles

| Role | Permissions |
|------|-------------|
| `owner` | Full access, manage locations/users, receive escalations |
| `admin` | Manage templates, instances, users for assigned locations |
| `nurse` | View and complete inspections for assigned locations |
| `inspector` | Complete assigned inspections only (invite-code access) |

### Access pattern

1. User authenticates (email/password or invite code).
2. System resolves user's allowed locations via `profile_locations` join.
3. All API calls include `location_id` in URL (`/api/locations/:locationId/...`).
4. Server verifies location membership + role.
5. All DB queries filtered by `location_id`.
6. Supabase RLS enforces at database layer.

---

## Inspection Model

```text
[Templates] --> (generate) --> [Instances] --> (complete) --> [Signatures]
                                    |
                                    v
                              [Events (audit log)]
```

### Templates

Define what needs to be inspected: task, description, frequency, location, default assignee.

### Instances

Generated from templates for specific due dates. Lifecycle:
- `pending` -> `in_progress` -> `passed` (normal flow)
- `pending` -> `in_progress` -> `failed` -> `passed` (failure + re-inspection)

### Signatures

Captured via `signature_pad` canvas, stored as PNG in Supabase Storage. Immutable once signed.

### Events (audit log)

Append-only log: `created | assigned | started | failed | passed | signed | comment | reminder_sent | escalated`.

---

## Reminder Engine (Vercel Cron)

Scheduled routes in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 14 * * 1" },
    { "path": "/api/cron/reminders", "schedule": "0 14 * * *" }
  ]
}
```

### Reminder rules

- **Weekly inspections**: email every Monday morning.
- **Monthly inspections**: email 1 week before due date.
- **Overdue**: email inspector again + escalate to owner immediately.

### Handler responsibilities

1. Query instances where status is pending/in_progress and due within reminder windows.
2. Create `inspection_events` rows for audit trail.
3. Send email via Resend/SendGrid.
4. Log result in `notification_outbox`.

---

## Service Layer

```text
lib/
  server/
    db.ts                  # Supabase client (server-only)
    auth-helpers.ts        # Session + location + role enforcement
    errors.ts              # ApiError class + handleError()
    services/
      templates.ts         # Template CRUD
      instances.ts         # Instance lifecycle
      signatures.ts        # Signature storage
      reminders.ts         # Reminder logic
      invite-codes.ts      # Invite code management
```

Route handlers stay thin: auth check -> Zod validation -> call service -> return response.

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Better Auth
BETTER_AUTH_SECRET=your-secret-min-32-chars
BETTER_AUTH_URL=http://localhost:3000

# Supabase
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# Storage
SIGNATURES_BUCKET=signatures

# Email
RESEND_API_KEY=re_...
OWNER_ESCALATION_EMAIL=owner@example.com

# Public
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron (Vercel sets CRON_SECRET automatically)
CRON_SECRET=...
```
