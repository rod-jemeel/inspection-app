# Documentation Index

## Inspection PWA

Multi-location inspection tracking PWA with recurring checklists, signature capture, and automated reminders.

## Documents

| Document | Purpose |
|----------|---------|
| [Technical Plan](Inspection%20PWA%20%E2%80%93%20Technical%20Plan%20(Next.js%2016%20%2B%20Bett.md) | Original product spec and architecture plan |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, auth modes, location-based access |
| [AUTH.md](AUTH.md) | Better Auth setup, invite codes, roles, authorization helpers |
| [DATABASE.md](DATABASE.md) | Schema, tables, RLS policies, audit log |
| [API.md](API.md) | Endpoint contracts for all resources |
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | UI tokens, component patterns, icon usage |
| [FILE_STRUCTURE.md](FILE_STRUCTURE.md) | Codebase layout and feature module anatomy |
| [BEST_PRACTICES.md](BEST_PRACTICES.md) | Day-to-day implementation patterns |
| [PERFORMANCE.md](PERFORMANCE.md) | Optimization patterns for Next.js 16 / React 19 |
| [PWA.md](PWA.md) | Manifest, service worker, offline strategy |

## Quick Start

```bash
pnpm install
pnpm dev          # localhost:3000
pnpm build        # Production build
pnpm db:migrate   # Apply Better Auth schema
```
