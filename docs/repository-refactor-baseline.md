# Repository refactor baseline

**Date:** 2026-08-14  
**Recorded before structural batches 3–7.** No application source was changed for this document.

Gates below were run on the live worktree with API health `200` at `http://localhost:4000/api/v1/health` (existing `pnpm --filter @maher/api dev`).

## Results

| Gate | Command | Result |
|------|---------|--------|
| API typecheck | `pnpm --filter @maher/api typecheck` | PASS |
| Admin Web typecheck | `pnpm --filter @maher/admin-web typecheck` | PASS |
| Mobile typecheck | `pnpm mobile:typecheck` | PASS |
| Permissions tests | `pnpm --filter @maher/permissions test` | PASS — 7 suites / 32 tests |
| Admin Web tests | `pnpm --filter @maher/admin-web test` | PASS — 4 files / 15 tests |
| Mobile tests | `pnpm mobile:test` | PASS — 120 suites / 602 tests |
| Expo Doctor | `pnpm mobile:doctor` | PASS — 18/18 |
| API production build | `pnpm --filter @maher/api build` | PASS |
| Admin Web production build | `pnpm --filter @maher/admin-web build` | PASS |
| API tests (first full run) | `pnpm --filter @maher/api test` | **1 flake** — `customers.portal-password.spec.ts` exceeded 5s timeout under parallel load. 59 suites / 323 tests passed. PDF suite did not start because the first Jest process failed. |
| API tests (retry, quieter machine) | same suite + `pdf.util.test` | PASS — 60 suites / 324 tests, then pdf.util **14/14**. Treat first timeout as pre-existing flake, not a refactor regression. |
| Factory lifecycle (as found) | `pnpm smoke:factory-lifecycle` | FAIL — fixtures missing (`UAT-SOFA-*`). Local DB lacked factory-uat products. |
| Factory lifecycle (after `seed:factory-uat-only`) | `pnpm --filter @maher/database seed:factory-uat-only` then smoke | **18/25** — `nile` dealer login 401; no Nile customer in this DB. Quote steps then fail `VALIDATION_ERROR` because `customerId` is missing. `set-passwords-123` updated 2 users and did not restore `nile`. |

## Pre-existing (do not blame later batches)

1. **Factory 88/88 not reproducible on this DB right now.** Code and UAT script are unchanged by this refactor. Failure is local data: missing launch dealer `nile` / Nile Interiors customer. Last known green 88/88 in this workspace was earlier the same day after `seed:factory-uat-only` when `nile` still existed. This refactor does **not** run `pnpm db:seed` (would wipe/reset local data). Final report will re-run the same smoke and compare.
2. **API portal-password spec** can timeout at the default 5s when the full suite runs under CPU contention. Retry passed. Do not “fix” the test in this refactor.
3. Unrelated dirty files already in the worktree before Batch 1: `dump.rdb`, `pnpm-lock.yaml`. Batch 4 will untrack `dump.rdb` only. Do not touch the lockfile.

## Attribution rule

If a later batch’s full gate matches this table, it is **not** a regression introduced by maps, gitignore, or the boundary checker.
