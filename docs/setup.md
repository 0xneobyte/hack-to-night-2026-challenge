# Nova Bank — Setup Guide

> Step-by-step setup for local development with Supabase.
> Replaces the old Docker-compose-with-local-Postgres flow.

## Prerequisites

- Node.js 24+ (matches the Dockerfile)
- npm (or `bun` — but the Dockerfile uses `npm ci`)
- A Supabase account (free tier is fine)
- Git

## 1. Clone & install

```bash
git clone https://github.com/0xneobyte/hack-to-night-2026-challenge.git
cd hack-to-night-2026-challenge
npm ci
```

## 2. Create a Supabase project

1. Go to <https://supabase.com> and sign in.
2. Click **New project**. Pick any name (e.g. `nova-bank-dev`).
3. Set a strong database password — save it somewhere safe.
4. Choose a region close to you.
5. Wait for the project to provision (~2 minutes).

## 3. Apply the schema & policies

Open the Supabase dashboard → **SQL Editor** → **New query**.

Paste and run, one at a time, in this order:

1. `supabase/migrations/0001_init_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_perform_transfer_rpc.sql`

Each file is idempotent (`CREATE TABLE IF NOT EXISTS`,
`CREATE OR REPLACE FUNCTION`). You can re-run them safely.

For local seed data (optional), run `supabase/seed.sql` after creating
test users via Supabase Auth — see the comments in that file.

## 4. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in the values from
**Project Settings → API** in the Supabase dashboard:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> Do NOT commit `.env.local`. It is gitignored.
> The anon key is safe to expose in the browser — RLS protects the data.
> The service role key is NEVER used in the browser.

## 5. Create a test user

In Supabase dashboard → **Authentication → Users → Add user**:

- Email: `dilara@example.com`
- Password: anything (auto-confirm is fine for dev)
- After creating, copy the user's UUID

Open SQL Editor and insert a profile row:

```sql
INSERT INTO public.profiles (id, full_name, nic, role)
VALUES ('<paste-uuid-here>', 'Dilara Perera', '200112345678', 'customer');
```

Optionally create an account:

```sql
INSERT INTO public.accounts (user_id, account_number, account_name, balance, pin_hash)
VALUES (
  '<paste-uuid-here>',
  '1000003423',
  'Dilara Savings',
  100000.00,
  crypt('1234', gen_salt('bf'))   -- requires pgcrypto extension (enabled by default in Supabase)
);
```

## 6. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. The middleware will redirect you to
`/login`. Sign in with the test user you created. You should land on
`/dashboard`.

## 7. (Optional) Run via Docker

The Dockerfile is configured for production-style builds:

```bash
docker compose up --build
```

The `compose.yml` no longer starts a local Postgres — it expects
Supabase env vars in `.env.local`. The dev server runs inside the
container on port 3000.

## Troubleshooting

| Symptom                                                   | Fix                                                                 |
|----------------------------------------------------------|---------------------------------------------------------------------|
| `supabase.auth.getUser()` returns null on every route    | Check that the Supabase URL + anon key in `.env.local` are correct |
| `/api/transfer` returns 500                              | Make sure the `perform_transfer` RPC has been applied (step 3)      |
| `/api/accounts` returns empty array after creating user  | You created the auth user but not the `profiles` row (step 5)       |
| Login works but dashboard shows "Unauthorized"           | Session cookie not being set — check `lib/supabase/middleware.ts`   |
| `relation "public.profiles" does not exist`              | You skipped step 3 — apply the schema migrations                    |

## Next steps

- Read [`docs/api-contracts.md`](./api-contracts.md) for the REST
  contract every endpoint implements.
- Read [`docs/contributing.md`](./contributing.md) for branch naming
  and commit conventions.
- Read [`bug-report.md`](../bug-report.md) for the full bug list and
  implementation plan.
