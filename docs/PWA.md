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

See `public/sw.js`. Key rules:
- Cache static assets and app shell.
- Do NOT cache authenticated pages (prevents stale data after logout).
- Exclude `/api/auth/` from service worker interception.
- Network-first for navigation requests.

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
- [ ] Install on iOS Safari
- [ ] Auth works after installation
- [ ] Lighthouse PWA audit passes
- [ ] Signature capture works on mobile
