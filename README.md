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

## Phase 9 — Integration, auth & Supabase (complete)

- **Auth guard**: the app shell (`AuthGuard`) redirects unauthenticated visitors to
  `/login`; login/register start a session and store the JWT (offline demo fallback still
  works). **Log out** in the sidebar clears the session.
- **Admin → Connections** (`/settings/connections`): a control panel showing live health of
  the database (Supabase), the backend REST API, social-network OAuth connections, and AI
  providers. Reached from Settings or the ⌘K palette.
- **Supabase-ready**: a provisioned Supabase Postgres project (`kvrhkseifkwshnqfvldu`,
  ap-northeast-1) is wired into the Connections panel. Switch the API from SQLite to Supabase
  in one step:

  ```bash
  # apps/api/.env → set DATABASE_URL to your Supabase connection string, then:
  npm run db:generate:supabase --workspace=@hootsuite/api
  npm run db:push:supabase     --workspace=@hootsuite/api
  npm run db:seed              --workspace=@hootsuite/api
  ```

  The Postgres schema lives at `apps/api/prisma/schema.postgres.prisma` (identical models —
  JSON stored as text — so no app-code changes). The web app reads the Supabase URL + anon
  key from `NEXT_PUBLIC_SUPABASE_*` (see `apps/web/.env.example`).

- **Plain-SQL alternative**: `supabase/migrations/0001_init.sql` (schema, indexes, FKs, RLS)
  and `0002_seed.sql` (demo data) are paste-ready for the Supabase SQL Editor — no Prisma or
  Node required. Both were **verified end-to-end against a real Postgres 17 instance**: all
  14 tables/11 indexes/5 FKs created, seed row counts match `prisma/seed.ts` exactly, and
  both files are idempotent (safe to re-run). See `supabase/README.md`.

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
| Posts | `GET /api/posts` · `POST /` · `GET/PUT/DELETE /:id` · `POST /:id/schedule` · `/:id/publish` · `/:id/submit` · `/:id/approve` · `/:id/reject` · `POST /run-scheduler` · `GET /calendar` · `POST /bulk` |
| Inbox | `GET /api/inbox` · `PUT /:id/read` · `POST /:id/reply` · `PUT /:id/assign` · `GET/POST /saved-replies` |
| Listening | `GET/POST /api/listening/streams` · `POST /streams/:id/ingest` · `GET /mentions` · `GET /sentiment` |
| Analytics | `GET /api/analytics/metrics` · `GET/POST /reports` · `GET/PUT/DELETE /reports/:id` · `POST /reports/:id/export?format=csv\|pdf` |
| AI | `POST /api/ai/caption` · `/hashtags` · `/ideas` |
| Teams | `GET /api/teams` · `GET/POST/PUT/DELETE /teams/members[/:id]` (writes require MANAGE_TEAM) |
| Advocacy | `GET/POST /api/advocacy/content` · `POST /content/:id/share` · `GET /analytics` |
| Audit | `GET /api/audit` (requires VIEW_AUDIT) |

All routes except `/api/auth/*` and `/health` require a `Bearer <token>` header.

## Phase 4 — Scheduling engine (complete)

In-process poller (`apps/api/src/scheduler.ts`) scans the DB every 15s and auto-publishes
posts whose `scheduledAt` has passed, with up to 3 delivery attempts + exponential backoff;
failures are marked `failed`. Trigger manually with `POST /api/posts/run-scheduler`. Swap
the publish body into a BullMQ+Redis worker for production (same logic, `REDIS_URL`).
Disable with `SCHEDULER_ENABLED=false`.

## Phase 6 — Listening + Analytics pipeline (complete)

- **Sentiment classifier** (`src/sentiment.ts`): lexicon-based positive/negative/neutral.
- **Ingestion**: `POST /listening/streams/:id/ingest` pulls sample mentions, classifies
  sentiment, stores them, and bumps the stream's mention count.
- **Analytics rollups**: `/analytics/metrics` computes impressions, engagements and the
  network breakdown from real published-post engagement data in the DB.
- **Report export**: `/analytics/reports/:id/export?format=csv|pdf` streams a real CSV or a
  generated PDF (via pdfkit) built from live data.

## Phase 8 — Testing + hardening (complete)

- **Integration tests** (Jest + Supertest, `apps/api/test/`): 22 tests / 4 suites covering
  auth + JWT gating, posts CRUD + schedule/publish + scheduler + approval workflow, inbox,
  listening ingestion + sentiment, analytics + CSV/PDF export, AI provider status +
  generation, advocacy, and RBAC (viewer 403 / owner 200). Run against an isolated SQLite
  test DB.

  ```bash
  npm test --workspace=@hootsuite/api
  ```

- **Hardening**: extracted the Express app into `src/app.ts` (testable, no listener);
  input validation middleware (`src/validate.ts`) on auth register + post create; malformed
  JSON → `400`; unknown routes → `404`; rate limiting disabled under `NODE_ENV=test`.

## Phase 5 — Real AI (multi-provider, complete)

A pluggable LLM layer (`apps/api/src/llm/`) with a common `LLMProvider` interface and
swappable adapters for **Claude, OpenAI, Gemini, DeepSeek**, a **Custom** OpenAI-compatible
endpoint, and a built-in **offline mock**.

- **Keys live in env only** (`apps/api/.env`) — never in the DB or browser. A provider
  becomes selectable the moment its key is present; otherwise the layer **transparently
  falls back to the offline generator**, so everything works today with zero keys.
- **Active provider/model** persist in an `AppSetting` DB row, switchable at runtime.
- Wired: `POST /api/ai/caption`, `/hashtags`, `/ideas`, `/sentiment` all route through the
  active provider. Management: `GET /api/ai/status`, `GET /api/ai/providers`,
  `PUT /api/ai/config` (requires MANAGE_SETTINGS).
- **Frontend**: a "AI & Automation" panel in Settings lists providers with a configured
  badge, and lets you pick the active provider + model (keys stay server-side).

Add a provider later by setting its key in `apps/api/.env` (see `.env.example`):
`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` / `DEEPSEEK_API_KEY`, or
`CUSTOM_LLM_BASE_URL` + `CUSTOM_LLM_API_KEY` + `CUSTOM_LLM_MODEL`. Optionally pin the default
with `LLM_PROVIDER` / `LLM_MODEL`.

## Phase 7 — Collaboration + Employee Advocacy (complete)

- **RBAC** (`src/rbac.ts`): owner/admin/editor/viewer roles → permission sets, enforced by
  `requirePermission` middleware (team management, approvals, advocacy authoring, audit).
- **Approval workflow**: `POST /posts/:id/submit|approve|reject` with `approvalStatus`
  (none→pending→approved/rejected); approve/reject require APPROVE_POST.
- **Audit trail** (`src/audit.ts` + `AuditLog`): key mutations logged; `GET /api/audit`.
- **Employee Advocacy (Amplify)**: content hub, one-click share, and analytics with a
  reach leaderboard.

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
