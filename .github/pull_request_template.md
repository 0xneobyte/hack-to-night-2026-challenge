## Summary

<!-- 1-3 sentences describing what this PR changes and why. -->

## Related issues

<!-- Use "Closes #NN" to auto-close on merge. Use "Refs #NN" to link without closing. -->

- Closes #
- Refs #

## Phase

<!-- Check the phase this work belongs to. -->

- [ ] Phase 0 — Quick wins
- [ ] Phase 1 — Supabase foundation
- [ ] Phase 2 — Frontend wiring
- [ ] Phase 3 — New features
- [ ] Chore / docs / tooling (no user-visible change)

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Refactor (no behavior change)
- [ ] Documentation
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Security fix

## Checklist

- [ ] Branch name follows `feat/` / `fix/` / `chore/` / `docs/` convention (see `docs/contributing.md`)
- [ ] Commit messages follow Conventional Commits
- [ ] `npx tsc --noEmit` passes locally
- [ ] `npx biome check` passes locally
- [ ] No `console.log` left in production code (use `lib/logger.ts` instead)
- [ ] No secrets, API keys, or `.env.local` content in the diff
- [ ] API routes return the standard `{ ok, data }` / `{ ok, message }` envelope
- [ ] New API routes are documented in `docs/api-contracts.md`
- [ ] Database changes are in a new `supabase/migrations/NNNN_*.sql` file
- [ ] I have tested the change locally with `npm run dev`

## Notes for reviewer

<!-- Anything the reviewer should pay extra attention to, tricky edge cases,
     decisions you're unsure about, or things you intentionally did NOT do. -->

## Screenshots / recordings

<!-- For UI changes only. Before/after if applicable. -->
