# Repository refactor final report

**Date:** 2026-08-14  
**Scope:** Behavior-preserving navigation refactor. No Mobile/API/Prisma/business-logic moves.

## 1. Original structural problems

- Six apps and 13 packages already existed, but there was no map, so Mobile and Admin Web felt mixed.
- `docs/` was a flat pile of ~108 living + historical markdown files.
- Admin Web routes are fat `page.tsx` files with almost no tests — hard to navigate, unsafe to relocate.
- One package→app import (Prisma seed → API scheduling/workflow).
- Tracked Redis `dump.rdb` at repo root.
- Unused packages mixed with real shared contracts.

## 2. Final top-level architecture

Unchanged names:

```
apps/api | admin-web | customer-portal | employee-portal | mobile | worker
packages/types | permissions | i18n | ui | database | integrations | logging | tsconfig
scripts/  docs/  e2e/  infra/docker/  design-references/
```

Maps: [architecture/repository-map.md](architecture/repository-map.md), [architecture/where-to-change-things.md](architecture/where-to-change-things.md).

## 3. Files/directories moved

None.

## 4. Files/directories renamed

None. Package names, exports, and `@/*` aliases unchanged.

## 5. Files deleted and evidence they were dead

- **`dump.rdb` removed from git** (`git rm --cached`). No source references. Now gitignored (`*.rdb`). Local file may still exist on disk.
- No application code deleted. See [dead-code-candidates.md](dead-code-candidates.md).

## 6. Shared packages changed

None (no source, no package.json of `@maher/*`).

## 7. Mobile changes

`apps/mobile/README.md` only. No TS/TSX, navigation, theme, or i18n key changes.

## 8. Admin Web changes

`apps/admin-web/README.md` with feature → route table. No route/component moves.

## 9. API changes

`apps/api/README.md` only.

## 10. Scripts/tooling changes

- Added `scripts/check-boundaries.mjs` and `pnpm check:boundaries`.
- CI runs that check after install.
- `scripts/README.md` classifies existing launch/smoke/UAT scripts (left flat).

## 11. Docs organization

Indexed in place via [docs/README.md](README.md). Historical reports were **not** git-moved (link-rot risk). New architecture docs live under `docs/architecture/`.

## 12. Import/alias changes

None. Boundary checker allowlists `packages/database/prisma/seed/dealer-orders-recent.ts`.

## 13. Dependency-boundary rules

Documented in [where-to-change-things.md](architecture/where-to-change-things.md). Enforced by `pnpm check:boundaries`:

- Mobile ↛ Web / API src / `@maher/ui`
- Web ↛ Mobile / API src
- packages ↛ apps (except the seed allowlist)

## 14. Generated-file cleanup

`.gitignore` already covered `.next`, `dist`, `.expo`, `logs`, `uploads`, `.run`, `coverage`, Playwright output. Added Redis dumps. Did not untrack `docs/mobile-screenshots/` or `design-references/`.

## 15. Dead-code candidates NOT removed

Unused packages (`workflow-graph`, `testing`, `eslint-config`, unused `config`/`validation` imports), drifted `packages/types` unions, triplicate Next `api-client.ts`, parallel StaffType DTOs, seed→API import, `app/dev/` gallery, Tesseract traineddata. Full table: [dead-code-candidates.md](dead-code-candidates.md).

## 16. Baseline test results

See [repository-refactor-baseline.md](repository-refactor-baseline.md).

- Typechecks PASS (API, Admin Web, Mobile)
- Permissions 32/32, Admin Web 15/15, Mobile 120/602
- Expo Doctor 18/18
- API tests: first run 1 flake (`portal-password` 5s timeout); retry 324 + pdf 14/14
- Builds PASS
- Factory: **18/25** — local DB missing dealer `nile` (pre-existing data, not this refactor)

## 17. Final test results

| Gate | Result |
|------|--------|
| API / Admin Web / Mobile typecheck | PASS |
| Permissions 7/32 | PASS |
| Admin Web Vitest 4/15 | PASS |
| Mobile Jest 120/602 | PASS |
| API Jest 60/324 + pdf 14/14 | PASS (no flake this run) |
| `pnpm check:boundaries` | PASS |
| Expo Doctor 18/18 | PASS |

## 18. Build results

| Gate | Result |
|------|--------|
| `pnpm --filter @maher/api build` | PASS |
| `pnpm --filter @maher/admin-web build` | PASS |
| Prisma `validate` (with `.env`) | PASS |

Root scripts still resolve (no script path moves except the new `check:boundaries` entry).

## 19. Factory 88/88 result

**Not 88/88 on this local database — same as baseline.** Final `pnpm smoke:factory-lifecycle`: **18/25**, `nile` login 401, then quote `VALIDATION_ERROR` without `customerId`.

This matches [baseline](repository-refactor-baseline.md). No API/Prisma/seed behavior was changed. Restoring 88/88 needs the launch dealer (`pnpm db:seed` would recreate `nile` but was not run — it can wipe local data). Last known green 88/88 in this workspace was earlier the same day when `nile` still existed.

Do not attribute this to the folder/docs work.

## 20. Known remaining architecture debt

1. Fat Admin Web `page.tsx` / colocated clients (~24k lines) — extract to `src/features/` only in a dedicated, tested pass.
2. Unused packages listed above.
3. Seed → API domain imports.
4. Drifted `packages/types` vs Prisma enums.
5. Three identical Next API clients.
6. Empty Prisma `migrations/...` folder; local/CI uses `db push`.
7. Factory UAT depends on launch dealer `nile` existing in the DB.

## BEFORE / AFTER tree

**BEFORE** (important depth only):

```
apps/{api,admin-web,customer-portal,employee-portal,mobile,worker}
packages/{types,permissions,i18n,ui,database,integrations,logging,tsconfig,config,validation,workflow-graph,testing,eslint-config}
scripts/*.sh|*.mjs|*.py
docs/*.md   (flat)
e2e/  infra/  design-references/
dump.rdb   (tracked)
```

**AFTER:**

```
apps/…                    (same trees + README.md in each app)
packages/…                (same + packages/README.md)
scripts/…                 (+ check-boundaries.mjs, README.md)
docs/
  README.md               (index)
  architecture/
    repository-map.md
    where-to-change-things.md
  repository-architecture-audit.md
  repository-refactor-plan.md
  repository-refactor-baseline.md
  repository-refactor-final-report.md
  dead-code-candidates.md
  …existing docs unchanged…
.gitignore                (dump.rdb / *.rdb)
dump.rdb                  (untracked)
```

`apps/` and `packages/` source layout is the same. Navigation is maps + READMEs, not a prettier-but-riskier file shuffle.
