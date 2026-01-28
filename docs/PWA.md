# PWA Implementation

## MVP Goals

- Installable app (manifest)
- Cached app shell for faster repeat loads
- Online-first (offline read-only is explicit non-goal for MVP)

---

## Manifest (`app/manifest.ts`)

```typescript
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inspection Tracker",
    short_name: "Inspect",
    description: "Multi-location inspection checklists with signature capture",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
```

---

## Service Worker

See `public/sw.js`. Key features:
- Cache static assets and app shell
- Handle push notification events
- Navigate to app on notification click
- Do NOT cache authenticated pages (prevents stale data after logout)
- Exclude `/api/auth/` from service worker interception
- Network-first for navigation requests

---

## Push Notifications

### Setup

1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Add to `.env.local`:
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNx...
   VAPID_PRIVATE_KEY=your-private-key
   VAPID_SUBJECT=mailto:admin@yourdomain.com
   ```

### Client-side

```typescript
import { usePushNotifications } from "@/hooks/use-push-notifications"

const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications()
```

### Server-side

```typescript
import { sendPushToProfile, sendPushToLocation } from "@/lib/server/services/push-sender"

// Send to specific user
await sendPushToProfile(profileId, {
  title: "Overdue Inspection",
  body: "Weekly check is overdue",
  url: "/inspections/123",
})

// Send to all users in a location
await sendPushToLocation(locationId, { title: "...", body: "..." })
```

### iOS Safari Notes

- Requires iOS 16.4+
- PWA must be installed to home screen
- Permission must be requested after user gesture
- No provisional/silent notifications

---

## Bundle Optimization

```typescript
// next.config.ts
export default {
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
}
```

- Dynamic import `signature_pad` (heavy canvas library).
- Defer analytics and non-critical third-party.
- Preload on user intent (onMouseEnter, onFocus).

---

## Auth in PWA

Better Auth uses HttpOnly cookies -- PWA-friendly. No localStorage tokens to manage.

---

## Testing

- [ ] Install on Android Chrome
- [ ] Install on iOS Safari (16.4+)
- [ ] Auth works after installation
- [ ] Lighthouse PWA audit passes
- [ ] Signature capture works on mobile
- [ ] Push notification subscription works
- [ ] Push notifications received on Android
- [ ] Push notifications received on iOS (home screen installed)
- [ ] Notification click opens correct page
