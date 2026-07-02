# Supabase migrations

Paste-ready SQL for the provisioned Supabase project
(`kvrhkseifkwshnqfvldu`, ap-northeast-1) — an alternative to the Prisma
path (`npm run db:push:supabase`) for people who prefer the SQL editor or
the Supabase CLI.

Both files are **verified**: run end-to-end against a real Postgres 17
instance (all 14 tables, 11 indexes, 5 foreign keys, RLS enabled) and
confirmed **idempotent** — re-running either file is a safe no-op / clean
reseed, with row counts matching `apps/api/prisma/seed.ts` exactly.

## Option A — Supabase Dashboard (fastest)

1. Open your project → **SQL Editor**.
2. Paste and run `migrations/0001_init.sql` (creates all tables, indexes,
   foreign keys, and enables RLS).
3. Paste and run `migrations/0002_seed.sql` (demo data — safe to re-run,
   it truncates the seeded tables first).

## Option B — Supabase CLI

```bash
supabase link --project-ref kvrhkseifkwshnqfvldu
supabase db push
```

## After seeding

Point the API at this database and it's live — no code changes needed,
since `apps/api/prisma/schema.postgres.prisma` describes the same tables:

```bash
# apps/api/.env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.kvrhkseifkwshnqfvldu.supabase.co:5432/postgres"
```

```bash
npm run db:generate:supabase --workspace=@hootsuite/api
npm run dev:api
```

Demo login once seeded: `nomaan.ibrahim0336@gmail.com` / `demo1234`.

## Notes

- Tables use Prisma's default naming (PascalCase, matching
  `schema.postgres.prisma` exactly) so the Prisma Client and this SQL stay
  interchangeable — you can seed via either path.
- JSON-ish fields (`networks`, `keywords`, `engagements`, etc.) are stored
  as `TEXT` containing JSON, mirroring the SQLite dev schema — no native
  Postgres `jsonb` migration needed for the app to work identically.
- RLS is enabled on every table with **no permissive policies**, so
  PostgREST/anon access is blocked by default. The Express API connects
  with the Postgres connection string (a privileged role), which bypasses
  RLS entirely — this is defense-in-depth, not a functional requirement.
  Add policies here if you introduce Supabase Auth end-user access later.
