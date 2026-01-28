# Authentication & Authorization

## Overview

Two auth modes:
1. **Email/password** -- staff, admins, owners (full login via Better Auth)
2. **Invite code** -- inspectors (short-lived access, no password required)

Both produce a Better Auth session with HttpOnly cookies.

---

## Server Configuration

### Auth Instance (`lib/auth.ts`)

```typescript
import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { Pool } from "pg"

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  plugins: [
    nextCookies(),
  ],
})

export type Auth = typeof auth
```

### Route Handler (`app/api/auth/[...all]/route.ts`)

```typescript
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { GET, POST } = toNextJsHandler(auth)
```

### Client (`lib/auth-client.ts`)

```typescript
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
})

export const { signIn, signUp, signOut, useSession } = authClient
```

---

## Email/Password Flow (Staff)

### Sign In

```tsx
await signIn.email({
  email, password,
  callbackURL: "/dashboard",
  fetchOptions: {
    onRequest: () => setLoading(true),
    onResponse: () => setLoading(false),
    onError: (ctx) => toast.error(ctx.error.message),
    onSuccess: () => router.push("/dashboard"),
  },
})
```

### Sign Out

```typescript
await signOut({
  fetchOptions: {
    onSuccess: () => router.push("/login"),
  },
})
```

### Password Reset

Implement via Better Auth's `sendResetPassword` hook. Gate console.log behind development:

```typescript
emailAndPassword: {
  enabled: true,
  sendResetPassword: async (data) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`Reset: ${data.url}`)
    }
    // Production: send via Resend/SendGrid
    await sendEmail({ to: data.user.email, url: data.url })
  },
},
```

---

## Invite Code Flow (Inspectors)

### Design

Inspectors get access via short-lived invite codes instead of passwords. This provides:
- Low-friction access for field inspectors
- Full audit trail (each inspector is a persistent user)
- Location-scoped access
- Expiring credentials

### Database Table

```sql
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL,           -- bcrypt/scrypt hash, NEVER plain text
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INT DEFAULT 1,
  uses INT DEFAULT 0,
  role_grant TEXT NOT NULL DEFAULT 'inspector',
  location_id UUID NOT NULL REFERENCES locations(id),
  assigned_email TEXT,               -- optional: restrict to specific email
  created_by TEXT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);
```

### Flow

1. **Admin creates invite**: UI generates random code (8+ chars), server stores bcrypt hash + expiry.

2. **Inspector enters code** on `/invite`:
   ```typescript
   // POST /api/auth/invite
   export async function POST(request: Request) {
     const { code, name, email } = await request.json()

     // 1. Find matching invite (check all non-expired, non-exhausted)
     // 2. Verify hash
     // 3. Check expiry and usage count
     // 4. Create Better Auth user (for persistent identity)
     // 5. Create profile with inspector role + location access
     // 6. Create session
     // 7. Increment invite usage count

     return Response.json({ success: true })
   }
   ```

3. **Inspector gets session cookie** and can access assigned inspections.

### Important

- Always create real Better Auth users for inspectors (not ephemeral sessions) so signatures map to persistent identities.
- Hash invite codes -- never store plain text.
- Set reasonable expiry (e.g., 7 days).

---

## Roles

| Role | Can do |
|------|--------|
| `owner` | Everything + manage locations + receive escalations |
| `admin` | CRUD templates, manage instances, invite users (for assigned locations) |
| `nurse` | View and complete inspections (for assigned locations) |
| `inspector` | Complete assigned inspections only |

Roles are stored in the `profiles` table, not in Better Auth's organization plugin (this app uses location-based access, not org-based).

---

## Authorization Helpers (`lib/server/auth-helpers.ts`)

```typescript
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

// For Server Components -- redirects on failure
export async function getSessionOrThrow() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session) redirect("/login")
  return session
}

// For Route Handlers -- returns API error on failure
export async function getSessionOrApiError() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session) {
    throw new ApiError("UNAUTHORIZED", "Authentication required", 401)
  }
  return session
}

// Verify location access + role
export async function requireLocationAccess(
  locationId: string,
  requiredRoles: string[]
) {
  const session = await getSessionOrApiError()

  // Get profile with location access
  const profile = await getProfileWithLocations(session.user.id)
  if (!profile) throw new ApiError("NOT_FOUND", "Profile not found", 404)

  // Check location access
  const hasLocation = profile.locations.some(l => l.id === locationId)
  if (!hasLocation) throw new ApiError("FORBIDDEN", "No access to this location", 403)

  // Check role
  if (!requiredRoles.includes(profile.role)) {
    throw new ApiError("ROLE_REQUIRED", `Role required: ${requiredRoles.join(" or ")}`, 403)
  }

  return { session, profile }
}
```

### Usage in Route Handlers

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

    const template = await createTemplate({
      ...result.data,
      location_id: locationId,
      created_by: session.user.id,
    })

    return Response.json({ data: template })
  } catch (error) {
    return handleError(error)
  }
}
```

---

## Auth Protection (proxy.ts)

```typescript
// proxy.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/locations/:path*",
    "/templates/:path*",
    "/inspections/:path*",
    "/settings/:path*",
    "/api/locations/:path*",
  ],
}
```

---

## Cookie Security

- **HttpOnly**: prevents JavaScript access
- **Secure**: HTTPS only in production
- **SameSite=Lax**: CSRF protection
- `BETTER_AUTH_URL` must use HTTPS in production

---

## Quick Reference

| Action | Client | Server |
|--------|--------|--------|
| Sign in | `authClient.signIn.email()` | `auth.api.signInEmail()` |
| Sign out | `authClient.signOut()` | `auth.api.signOut()` |
| Get session | `authClient.useSession()` | `auth.api.getSession()` |
| Invite code | POST `/api/auth/invite` | Custom handler |
