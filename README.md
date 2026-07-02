# SocialHub — Hootsuite Replica

A social media management platform inspired by Hootsuite: publishing, unified inbox,
social listening, analytics and team collaboration in a single dashboard.

Built as a monorepo with npm workspaces.

```
.
├── apps/
│   ├── web/          # Next.js 14 frontend (App Router + Tailwind CSS)   ← Phase 1 ✅
│   └── api/          # Express.js REST API (TypeScript)                   ← Phase 2 (in progress)
├── packages/
│   └── shared/       # Shared TypeScript types
└── docker-compose.yml
```

## Phase 1 — Frontend (complete)

A fully navigable dashboard driven by realistic mock data. No backend required to explore it.

**Pages**
- `/login`, `/register` — authentication screens
- `/dashboard` — KPI overview, engagement chart, upcoming & top posts, connected accounts
- `/publisher` — post composer (multi-network, character limits, AI caption, live preview) + posts list
- `/calendar` — monthly content calendar
- `/inbox` — unified inbox with filters, threaded replies, saved replies, assign/resolve
- `/listening` — search streams, sentiment chart, mentions feed with sentiment tagging
- `/analytics` — metric cards, trend lines, network breakdown pie, saved reports & templates
- `/settings` — profile, connect/disconnect networks, team members

**Stack:** Next.js 14, React 18, Tailwind CSS, Recharts, lucide-react, date-fns, zustand.

### Run the frontend

```bash
npm install
npm run dev          # http://localhost:3000
```

## Phase 2 — Backend (next)

Express.js REST API under `apps/api` with JWT auth, rate limiting and mock data endpoints
mirroring the frontend. See `apps/api/.env.example`.

```bash
npm run dev:api      # http://localhost:3001
```

## Infrastructure

`docker-compose.yml` provisions PostgreSQL, Redis and RabbitMQ for local development.

---

_Educational project. All Hootsuite trademarks belong to their respective owners._
