# Performance Best Practices

**Stack**: Next.js 16, React 19, App Router

## Priority Overview

| Priority | Category | Impact |
|----------|----------|--------|
| 1 | Eliminating waterfalls | CRITICAL |
| 2 | Bundle size optimization | CRITICAL |
| 3 | Server-side performance | HIGH |
| 4 | Client-side data fetching | MEDIUM-HIGH |
| 5 | Re-render optimization | MEDIUM |

---

## 1. Eliminating Waterfalls

```typescript
// Bad: sequential
const profile = await fetchProfile()
const locations = await fetchLocations()
const instances = await fetchInstances()

// Good: parallel
const [profile, locations, instances] = await Promise.all([
  fetchProfile(),
  fetchLocations(),
  fetchInstances(),
])
```

Start promises early in Route Handlers:

```typescript
export async function GET(request: Request) {
  const sessionPromise = auth()
  const configPromise = fetchConfig()

  const session = await sessionPromise
  const [config, data] = await Promise.all([
    configPromise,
    fetchInstances(session.user.id),
  ])
  return Response.json({ data, config })
}
```

---

## 2. Bundle Size

Use `optimizePackageImports` for Phosphor icons:

```typescript
// next.config.ts
export default {
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
}
```

Dynamic imports for heavy components (signature_pad, charts):

```tsx
import dynamic from "next/dynamic"

const SignatureCanvas = dynamic(
  () => import("@/components/signature-canvas"),
  { ssr: false, loading: () => <div className="h-40 border animate-pulse" /> }
)
```

---

## 3. Server-Side Performance

Per-request deduplication:

```typescript
import { cache } from "react"

export const getProfile = cache(async (userId: string) => {
  return await supabase.from("profiles").select("*").eq("user_id", userId).single()
})
```

Non-blocking audit logging:

```typescript
import { after } from "next/server"

export async function PATCH(request: Request) {
  const result = await updateInstance(data)

  after(async () => {
    await appendEvent(result.id, "passed", profile.id)
    await sendNotification(result)
  })

  return Response.json({ data: result })
}
```

---

## 4. Client-Side

SWR for data fetching, `startTransition` for non-urgent updates, passive scroll listeners. See the generic `PERFORMANCE.md` template at `E:\templates\PERFORMANCE.md` for full patterns.

---

## React 19

- `use()` hook for promise unwrapping in client components.
- `<Activity>` for state-preserving visibility.
- React Compiler enabled by default (manual memo/useCallback optional).
