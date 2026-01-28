# Best Practices

## Core Principles

- **Server-first mindset**: prefer Server Components, push mutations through server actions.
- **Eliminate waterfalls**: parallelize data fetching, use Suspense boundaries.
- **Validated contracts**: Zod schemas for all inputs, shared types across UI and API.
- **Design system fidelity**: build from shadcn base-lyra primitives, Phosphor icons.
- **Location-scoped everything**: all queries MUST filter by `location_id`.
- **Immutable audit log**: every state change appends to `inspection_events`.
- **Non-blocking operations**: use `after()` for logging and notifications.

---

## Routing & Layouts

- Use `proxy.ts` for auth protection (full Node.js runtime, replaces middleware).
- `params` and `searchParams` are **Promises** in Next.js 16 -- always `await`.
- Use route groups: `(public)` for login/invite, `(protected)` for app.
- Place `loading.tsx` and `error.tsx` next to the owning `page.tsx`.

```tsx
export default async function Page({
  params,
}: {
  params: Promise<{ locationId: string; instanceId: string }>
}) {
  const { locationId, instanceId } = await params
}
```

---

## Component Strategy

- Prefer Server Components; add `"use client"` only for interactivity.
- Use `@/components/ui/*` wrappers -- never import `@base-ui/react` directly in features.
- Use Phosphor icons only (`@phosphor-icons/react`).
- Use `cn()` for className merging.
- Use `rounded-none` everywhere (sharp corners design).

---

## API Route Pattern

```
/api/locations/:locationId/[resource]
```

Keep handlers thin: auth -> validation -> service -> response.

```typescript
export async function POST(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    const { session, profile } = await requireLocationAccess(locationId, ["admin", "owner"])

    const body = await request.json()
    const result = schema.safeParse(body)
    if (!result.success) return validationError(result.error.issues).toResponse()

    const resource = await createResource({
      ...result.data,
      location_id: locationId,
      created_by: session.user.id,
    })

    after(async () => {
      await appendEvent(resource.id, "created", profile.id, result.data)
    })

    return Response.json({ data: resource })
  } catch (error) {
    return handleError(error)
  }
}
```

---

## Error Handling

Use centralized `ApiError` class and `handleError()` on **every** route handler.

```json
{ "error": { "code": "ROLE_REQUIRED", "message": "Role required: admin" } }
```

---

## Inspection Lifecycle

### Normal flow
`pending` -> `in_progress` -> `passed` (with signature)

### Failure flow
`pending` -> `in_progress` -> `failed` -> `passed` (re-inspection on same instance)

### Rules
- Every status change appends to `inspection_events`.
- Signatures are immutable -- once signed, disallow overwriting.
- Use `after()` to log events and send notifications without blocking response.

---

## Signature Capture

```typescript
// Client: capture PNG from signature_pad
const dataUrl = signaturePad.toDataURL()
const points = signaturePad.toData()  // optional raw points

// Validate before submit
if (signaturePad.isEmpty()) {
  toast.error("Signature required")
  return
}

// Upload to Supabase Storage via signed URL
```

---

## Zod Usage

```typescript
import { z } from "zod"

export const createTemplateSchema = z.object({
  task: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  frequency: z.enum(["weekly", "monthly", "yearly", "every_3_years"]),
  default_assignee_profile_id: z.string().uuid().optional(),
  default_due_rule: z.record(z.unknown()).optional(),
})

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
```

---

## Security Checklist

- [ ] All endpoints verify auth + location access + role
- [ ] All queries filter by `location_id`
- [ ] Invite codes hashed (never store plain text)
- [ ] Invite codes have expiry and usage limits
- [ ] Zod validation on every endpoint
- [ ] PostgREST special characters escaped in search (`%`, `_`, `\`)
- [ ] RLS enabled on all tables
- [ ] `SUPABASE_SECRET_KEY` is server-only
- [ ] Cron endpoints verify `CRON_SECRET` header
- [ ] Signatures stored immutably
- [ ] Sensitive logs gated behind `NODE_ENV === "development"`
- [ ] Service worker does NOT cache authenticated pages

---

## Feature Rollout Sequence

1. Choose `(public)` or `(protected)` placement.
2. Start with server `page.tsx`.
3. Define Zod schemas in `_schemas/`.
4. Implement mutations (`_actions/`) and queries (`_queries/`).
5. Compose UI with shadcn base-lyra primitives in `_components/`.
6. Promote to shared only after 2+ routes need it.
