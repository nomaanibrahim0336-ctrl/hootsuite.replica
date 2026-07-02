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

## Phase 2 — Backend (complete)

Express.js + TypeScript REST API under `apps/api` with JWT auth, Helmet, CORS,
rate limiting (100 req/min) and an in-memory mock data store. All routes return
`{ success, data }` envelopes.

```bash
cp apps/api/.env.example apps/api/.env
npm run db:push --workspace=@hootsuite/api    # create the SQLite schema
npm run db:seed --workspace=@hootsuite/api    # load demo data
npm run dev:api                               # http://localhost:3001 (GET /health)
```

## Phase 3 — Persistence (complete)

The API is backed by a real database via **Prisma**. Dev uses **SQLite** (zero setup,
runnable anywhere); production switches the `provider` in `apps/api/prisma/schema.prisma`
to `postgresql` and points `DATABASE_URL` at the Postgres in `docker-compose.yml` — the
models are provider-agnostic. Models: User, Network, Post, Message, MessageReply,
SavedReply, Stream, Mention, Report, TeamMember. All route handlers read/write through
Prisma; data persists across restarts. Seed with `npm run db:seed --workspace=@hootsuite/api`.

### Endpoints

| Group | Routes |
|-------|--------|
| Auth (public) | `POST /api/auth/register` · `login` · `refresh` · `logout` |
| Networks | `GET /api/networks` · `POST /` · `DELETE /:id` · `GET /:id/status` |
| Posts | `GET /api/posts` · `POST /` · `GET/PUT/DELETE /:id` · `POST /:id/schedule` · `/:id/publish` · `GET /calendar` · `POST /bulk` |
| Inbox | `GET /api/inbox` · `PUT /:id/read` · `POST /:id/reply` · `PUT /:id/assign` · `GET/POST /saved-replies` |
| Listening | `GET/POST /api/listening/streams` · `GET /mentions` · `GET /sentiment` |
| Analytics | `GET /api/analytics/metrics` · `GET/POST /reports` · `GET/PUT/DELETE /reports/:id` · `POST /reports/:id/export` |
| AI | `POST /api/ai/caption` · `/hashtags` · `/ideas` |
| Teams | `GET /api/teams` · `GET/POST/PUT/DELETE /teams/members[/:id]` |

All routes except `/api/auth/*` and `/health` require a `Bearer <token>` header.

### Frontend ↔ backend wiring

`apps/web/src/lib/api.ts` is a fully typed client for every endpoint above, with
token storage. The login/register screens call the live API and store the JWT
(falling back to demo mode if the API is offline). Data pages ship with local
mock data for offline reliability and can be swapped to `api.*` calls directly.
Point the web app at the API via `NEXT_PUBLIC_API_URL` (see `apps/web/.env.example`).

## Infrastructure

`docker-compose.yml` provisions PostgreSQL, Redis and RabbitMQ for local development.

---

_Educational project. All Hootsuite trademarks belong to their respective owners._
