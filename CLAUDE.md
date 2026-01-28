# CLAUDE.md

## Project Overview

Inspection PWA -- online-first progressive web app that replaces paper inspection binders with per-location recurring inspection checklists, signature-backed sign-off, and automated email reminders. Multi-location support with location-based access control.

**Main application**: Root directory (`/`)
**Documentation**: `docs/` directory (start with `docs/INDEX.md`)

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19
- **Auth**: Better Auth (username/password for staff + invite-code for inspectors)
- **Database**: Supabase Postgres (server-side only)
- **Storage**: Supabase Storage (signature images)
- **Validation**: Zod (schema validation for API inputs and forms)
- **State**: nuqs (URL state), Zustand (local state)
- **Styling**: Tailwind CSS v4, shadcn/ui (base-lyra style), Phosphor icons, Noto Sans font
- **UI Primitives**: @base-ui/react (headless components)
- **Signature Capture**: signature_pad
- **Email**: Resend (transactional)
- **Push**: Web Push API with VAPID (PWA notifications)
- **Cron**: Vercel Cron Jobs (reminders/escalations)
- **Package Manager**: pnpm

## MCP Servers

**shadcn MCP** is available. Use it to:
- Search for components: `mcp__shadcn__search_items_in_registries`
- View component details: `mcp__shadcn__view_items_in_registries`
- Get usage examples: `mcp__shadcn__get_item_examples_from_registries`
- Get install commands: `mcp__shadcn__get_add_command_for_items`

Registry uses `base-lyra` style in `components.json`.

## Build Commands

```bash
pnpm install        # Install dependencies
pnpm dev            # Development server (localhost:3000)
pnpm build          # Production build
pnpm lint           # ESLint checks
pnpm db:migrate     # Apply Better Auth schema to database
```

## Architecture

### Multi-Location Access Control
- Access boundary = Location
- Users assigned to locations via `profile_locations` join table
- All database queries MUST filter by `location_id`
- Server-side enforcement of auth + location access + role checks
- Roles: `owner`, `admin`, `nurse`, `inspector`

### Two Auth Modes
- **Full login** (email/password): staff, admins, owners
- **Invite code** (no password): inspectors with short-lived access

### Single Deploy (MVP)
- Frontend + API in one Next.js codebase
- Route Handlers for REST endpoints (`app/api/`)
- Server Actions for form submissions
- Vercel Cron Jobs for reminders (`/api/cron/reminders`)

### Database Access
- Supabase service role key is **server-only**
- No anon key exposed to client
- All queries location-scoped
- RLS policies enabled on all tables

### Inspection Model
- **Templates**: define what needs to be inspected (task, frequency, location)
- **Instances**: generated from templates for specific due dates
- **Signatures**: captured via signature_pad, stored in Supabase Storage
- **Events**: immutable audit log of all state changes
- **Frequencies**: weekly, monthly, yearly, every_3_years

## Directory Structure

```
inspection-app/
├── app/                    # App Router: pages, layouts, API routes
│   ├── api/auth/[...all]/  # Better Auth handler
│   ├── api/locations/      # Location-scoped endpoints
│   ├── api/push/           # Push subscription endpoints
│   ├── api/cron/           # Vercel Cron Jobs (reminders + push)
│   └── manifest.ts         # PWA manifest
├── components/             # React components
│   └── ui/                 # shadcn/ui base-lyra components
├── lib/                    # Utilities
│   ├── auth.ts             # Better Auth server config
│   ├── auth-client.ts      # Better Auth client config
│   ├── utils.ts            # cn() helper
│   ├── validations/        # Zod schemas
│   ├── stores/             # Zustand stores
│   └── server/             # Server-only modules
│       ├── db.ts           # Supabase client
│       ├── auth-helpers.ts # Session + location + role enforcement
│       ├── errors.ts       # ApiError class
│       └── services/       # Business logic (incl. push-sender.ts)
├── hooks/                  # Cross-feature hooks (incl. use-push-notifications.ts)
├── public/                 # Static assets (icons, sw.js)
└── docs/                   # Documentation
```

## API Pattern

All location-scoped endpoints:
```
/api/locations/:locationId/templates
/api/locations/:locationId/instances
/api/locations/:locationId/instances/:instanceId
/api/locations/:locationId/instances/:instanceId/sign
/api/locations/:locationId/instances/:instanceId/events
```

Push notification endpoints:
```
/api/push/subscribe      # Save push subscription
/api/push/unsubscribe    # Remove push subscription
```

Each endpoint must:
1. Verify authentication (Better Auth session or invite code session)
2. Verify location access
3. Check role permissions
4. Filter all queries by `location_id`

## Environment Variables

Required in `.env.local`:
```
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SIGNATURES_BUCKET=signatures
RESEND_API_KEY=
OWNER_ESCALATION_EMAIL=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Push Notifications (generate with: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

## Better Auth Patterns

**Import paths**:
```typescript
// Server
import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { toNextJsHandler } from "better-auth/next-js"

// Client
import { createAuthClient } from "better-auth/react"
```

**Get session (server)**:
```typescript
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const session = await auth.api.getSession({
  headers: await headers(),
})
```

**Require role in Route Handler**:
```typescript
import { requireLocationAccess } from "@/lib/server/auth-helpers"

const { session, profile } = await requireLocationAccess(locationId, ["admin", "owner"])
```

## Next.js 16 Patterns

**Async params/searchParams** (Promises):
```typescript
export default async function Page({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
}
```

**Auth proxy** (replaces middleware.ts):
```typescript
// proxy.ts
export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.redirect(new URL("/login", request.url))
  return NextResponse.next()
}
```

**Non-blocking operations**:
```typescript
import { after } from "next/server"
after(async () => { await logInspectionEvent(...) })
```

## Key Patterns

**Completing an inspection**: Update instance status + store signature + append event log. Always use immutable event log pattern.

**Failure lifecycle**: `pending -> failed -> passed` (re-inspection on same instance with event trail).

**Signature storage**: Upload PNG to Supabase Storage via signed URL, store path in `inspection_signatures` table.

**Reminder rules**: Weekly = every Monday; Monthly = 1 week before due; Overdue = immediate escalation to inspector + owner.

**Push notifications**: Use `usePushNotifications()` hook for client-side subscription management. Server-side use `sendPushToProfile()`, `sendPushToLocation()`, or `sendPushToRolesInLocation()` from `lib/server/services/push-sender.ts`.

## Design System

See `docs/DESIGN-SYSTEM.md` for full reference. Key points:
- Style: `base-lyra` (shadcn/ui)
- Primitives: `@base-ui/react` (headless)
- Icons: Phosphor (`@phosphor-icons/react`)
- Font: Noto Sans
- Color space: OKLCH
- Corners: `rounded-none` (sharp edges throughout)
- Default text: `text-xs` / `text-xs/relaxed`
- Default height: `h-8` (buttons/inputs)
- Use `cn()` for className merging
- Use `data-slot` attributes on all components
- NEVER use raw color values -- only semantic tokens

## Documentation

- `docs/INDEX.md` -- Navigation
- `docs/ARCHITECTURE.md` -- System design, auth modes, location model
- `docs/AUTH.md` -- Better Auth + invite codes, roles
- `docs/DATABASE.md` -- Schema, tables, RLS policies
- `docs/API.md` -- Endpoint contracts
- `docs/DESIGN-SYSTEM.md` -- UI patterns, tokens, components
- `docs/FILE_STRUCTURE.md` -- Codebase layout
- `docs/BEST_PRACTICES.md` -- Implementation patterns
- `docs/PERFORMANCE.md` -- Optimization patterns
- `docs/PWA.md` -- Manifest, service worker, offline
