# File Structure

## Core Principles

- **Route-first organization**: features live inside owning segments under `app/`.
- **Colocation before promotion**: keep logic in the feature until 2+ routes need it.
- **Predictable naming**: kebab-case filenames, PascalCase exports.
- **Shallow shared surface**: only `components/ui`, `hooks`, `lib`, and `lib/server` host cross-feature code.

---

## Layout

```text
inspection-app/
├── app/                              # Next.js App Router
│   ├── (public)/                     # No auth required
│   │   ├── login/
│   │   │   ├── page.tsx
│   │   │   └── _components/
│   │   └── invite/
│   │       ├── page.tsx              # Invite code entry
│   │       └── _components/
│   ├── (protected)/                  # Auth required
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── _components/
│   │   │   └── _queries/
│   │   ├── locations/
│   │   │   └── [locationId]/
│   │   │       ├── page.tsx          # Location overview
│   │   │       ├── templates/
│   │   │       │   ├── page.tsx
│   │   │       │   └── _components/
│   │   │       ├── inspections/
│   │   │       │   ├── page.tsx      # Instance list
│   │   │       │   └── [instanceId]/
│   │   │       │       ├── page.tsx  # Instance detail + sign
│   │   │       │       └── _components/
│   │   │       └── settings/
│   │   │           └── page.tsx
│   │   └── settings/
│   │       └── page.tsx              # User settings
│   ├── api/
│   │   ├── auth/[...all]/
│   │   │   └── route.ts             # Better Auth handler
│   │   ├── auth/invite/
│   │   │   └── route.ts             # Invite code exchange
│   │   ├── locations/
│   │   │   ├── route.ts             # GET locations
│   │   │   └── [locationId]/
│   │   │       ├── templates/
│   │   │       │   └── route.ts
│   │   │       ├── instances/
│   │   │       │   ├── route.ts
│   │   │       │   └── [instanceId]/
│   │   │       │       ├── route.ts
│   │   │       │       ├── sign/
│   │   │       │       │   └── route.ts
│   │   │       │       └── events/
│   │   │       │           └── route.ts
│   │   │       └── invites/
│   │   │           └── route.ts
│   │   └── cron/
│   │       └── reminders/
│   │           └── route.ts          # Vercel Cron handler
│   ├── globals.css
│   ├── layout.tsx
│   └── manifest.ts                   # PWA manifest
├── components/
│   └── ui/                           # shadcn base-lyra components
│       ├── alert-dialog.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── combobox.tsx
│       ├── dropdown-menu.tsx
│       ├── field.tsx
│       ├── input.tsx
│       ├── input-group.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       └── textarea.tsx
├── hooks/                            # Cross-feature hooks
├── lib/
│   ├── auth.ts                       # Better Auth server config
│   ├── auth-client.ts                # Better Auth client config
│   ├── utils.ts                      # cn() utility
│   ├── validations/                  # Shared Zod schemas
│   │   ├── common.ts
│   │   ├── template.ts
│   │   ├── instance.ts
│   │   └── invite.ts
│   ├── stores/                       # Zustand stores
│   └── server/                       # Server-only modules
│       ├── db.ts                     # Supabase client
│       ├── auth-helpers.ts           # requireLocationAccess()
│       ├── errors.ts                 # ApiError + handleError()
│       └── services/
│           ├── templates.ts
│           ├── instances.ts
│           ├── signatures.ts
│           ├── reminders.ts
│           └── invite-codes.ts
├── public/
│   ├── sw.js                         # Service worker
│   └── icons/                        # PWA icons
├── proxy.ts                          # Auth proxy (Next.js 16)
├── next.config.ts
├── components.json                   # shadcn base-lyra config
├── vercel.json                       # Cron job schedules
├── tsconfig.json
└── package.json
```

---

## Feature Module Anatomy

```text
app/(protected)/locations/[locationId]/inspections/
├── page.tsx              # Server component entry
├── layout.tsx            # Optional
├── _components/          # Client components (forms, lists)
├── _actions/             # Server actions (*.action.ts)
├── _queries/             # Server-only loaders (*.query.ts)
├── _hooks/               # Feature-scoped hooks
└── _schemas/             # Zod schemas + types
```

---

## Shared Directories

| Directory | Purpose |
|-----------|---------|
| `components/ui/` | shadcn base-lyra primitives |
| `hooks/` | Cross-feature hooks (2+ consumers) |
| `lib/` | Client-safe utilities, shared schemas |
| `lib/server/` | Server-only (import "server-only") |
| `lib/validations/` | Shared Zod schemas |

---

## Next.js 16 Notes

- `proxy.ts` replaces `middleware.ts` (full Node.js runtime).
- `params`, `searchParams`, `cookies()`, `headers()` are Promises.
- React 19: `use()` hook, `<Activity>`, React Compiler enabled.
