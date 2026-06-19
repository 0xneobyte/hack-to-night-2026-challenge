# Contributing to Nova Bank

## Branch naming

All work happens on feature branches off `main`. Use one of these prefixes:

| Prefix      | When to use                                                      | Example                              |
|-------------|------------------------------------------------------------------|--------------------------------------|
| `feat/`     | New feature or significant enhancement                           | `feat/supabase-foundation`           |
| `fix/`      | Bug fix                                                          | `fix/transfer-overdraft-check`       |
| `chore/`    | Tooling, deps, refactors, docs — no user-visible behavior change | `chore/dev-experience-and-migrations` |
| `docs/`     | Documentation only                                               | `docs/setup-guide`                   |
| `refactor/` | Code restructuring with no behavior change                       | `refactor/api-error-helpers`         |

Phase branches should include the phase number:

- `feat/phase-1-supabase-foundation`
- `feat/phase-2-dashboard-wiring`
- `feat/phase-3-smart-spend`

## Commit format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body — wrap at 72 chars>

<footer — closes #issue>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`

**Examples:**

```
feat(api): add /api/profile endpoint

Reads the authenticated user's profile row from Supabase and joins it
with the email from auth.users. Returns a typed ProfileWithEmail
payload via the standard ApiSuccess<T> envelope.

Closes #24.
```

```
fix(transfer): reject same-account transfers

The perform_transfer RPC would happily move money from an account to
itself, producing a zero-effect transaction row. Add a server-side
check in /api/transfer that returns 400 if fromAccount === toAccount.
```

## Pre-commit hook

[Lefthook](https://lefthook.dev/) runs `biome format --write` on staged
files before each commit. The hook is configured in `.lefthook.yml`.

If formatting fails, fix the issues and re-stage — do not bypass the
hook with `--no-verify` without a very good reason.

## Pull request workflow

1. Branch off `main` (see naming above).
2. Make focused commits — one logical change per commit.
3. Push and open a PR against `main`.
4. Use the PR template (`.github/pull_request_template.md`).
5. Link the issue(s) you're closing in the PR body with `Closes #NN`.
6. Request review from at least one teammate.
7. Once approved, squash-merge into `main`.
8. Delete the feature branch after merge.

## Code style

- **TypeScript:** strict mode is on. No `any` without a justification
  comment.
- **Biome:** formatter is enabled for JS/TS. Linter rules are the
  recommended set — do not disable them without discussion.
- **Imports:** use the `@/` alias for project-internal imports.
  Biome organizes imports alphabetically.
- **Single quotes**, no semicolons, 2-space indent (enforced by Biome).
- **CSS:** the codebase mixes Tailwind and CSS modules. New UI should
  prefer Tailwind utility classes; existing CSS modules are fine to
  keep until a refactor.

## API route conventions

Every API route MUST:

1. Live under `app/api/<name>/route.ts`.
2. Use `createClient()` from `@/lib/supabase/server` to get the
   Supabase client (with the user's session cookie).
3. Call `supabase.auth.getUser()` first; return `apiError('Unauthorized', 401)`
   if there is no user.
4. Return the standard envelope via `apiSuccess(data)` or
   `apiError(message, status)` from `@/lib/api-error`.
5. Wrap the whole handler in `try/catch` and pass unexpected errors to
   `serverError(reason)` — never let raw error details reach the client.
6. Have typed request and response interfaces. Share types via
   `@/lib/types`.

See [`docs/api-contracts.md`](./api-contracts.md) for the contract
every route implements.

## Database changes

- All schema changes go in numbered files under `supabase/migrations/`.
- Never edit an existing migration after it has been applied to shared
  environments — create a new migration instead.
- RLS policies go in `0002_rls_policies.sql` (or a new numbered file
  if you're adding a new table).
- Test your migrations by running them against a fresh Supabase project
  before opening a PR.
