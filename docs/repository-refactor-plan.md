# Repository refactor plan

**Date:** 2026-08-14  
**Companion:** [repository-architecture-audit.md](./repository-architecture-audit.md)

This is a **behavior-preserving** navigation refactor. The monorepo already has the right top-level names. We do **not** rename `apps/` or `packages/`. We do **not** extract factory domain or fat Admin Web routes.

## Goal

After this work, a developer (or agent) can see immediately where Mobile, Admin Web, API, shared contracts, permissions, Prisma, tests, scripts, and docs live — and can work in Admin Web without reading Mobile internals.

## Leave in place (explicit)

- All of `apps/mobile/` internals (screens, nav, Staff touch bar, theme, i18n, tests).
- `apps/api/src/modules/` layout and factory modules (production, workflow, inventory, scheduling, QC, deliveries, returns).
- Prisma schema, enums, migrations, seed **behavior**.
- Fat Admin Web `page.tsx` files under `src/app/[locale]/` (thin-route extraction is remaining debt).
- Flat `scripts/` (13 files). Nesting would break root `package.json` paths.
- Historical `docs/*.md` paths (index them; do not git-mv into `historical/` — link rot).
- Unused packages (`workflow-graph`, `testing`, `eslint-config`, unused `config`/`validation` imports). Catalog only.
- `packages/database/prisma/seed/dealer-orders-recent.ts` → `apps/api` domain imports. Allowlist; do not extract.
- Package names `@maher/*`, public exports, `@/*` aliases, API module names.
- i18n keys and catalog files.
- `pnpm-lock.yaml` / dependency versions unless a later batch truly needs a dependency (it will not).

## Seed → API exception

`packages/database/prisma/seed/dealer-orders-recent.ts` imports:

- `apps/api/src/modules/production/workflow/domain/workflow-compiler`
- `apps/api/src/modules/scheduling/domain/schedule-planner`
- `apps/api/src/modules/scheduling/domain/working-calendar`
- `apps/api/src/modules/scheduling/domain/types`

Moving those into a shared package would touch proven factory behavior. The 88/88 lifecycle gate must stay green. Document + allowlist only.

## Batches

After **every** batch: files added / modified / moved / deleted / source files touched; `git diff --stat`. Stop if a small batch unexpectedly touches many source files. No repo-wide Prettier/ESLint `--fix`.

### Batch 1 — Audit only (this file + the audit)

- `docs/repository-architecture-audit.md`
- `docs/repository-refactor-plan.md`

Budget: 2 docs added, 0 source, 0 moves.

### Batch 2 — Baseline

Record `docs/repository-refactor-baseline.md`:

- API / Admin Web / Mobile typecheck
- API / Admin Web / Mobile / permissions tests
- API / Admin Web production build
- Expo Doctor
- `pnpm smoke:factory-lifecycle` (88/88 if API is up)

Pre-existing failures stay attributed to baseline, not later batches.

Budget: 1 doc, 0 source.

### Batch 3 — Maps and READMEs (no app source)

- `docs/architecture/repository-map.md`
- `docs/architecture/where-to-change-things.md` (includes dependency rules)
- `docs/README.md` index of existing docs **in place**
- Short READMEs: `apps/admin-web` (feature table), `apps/api`, `apps/mobile`, `apps/customer-portal`, `apps/employee-portal`, `apps/worker`, `packages/`, `scripts/`
- Pointers from root `README.md` and `docs/architecture.md`

Budget: docs/READMEs only; 0 `apps/**` or `packages/**` source.

### Batch 4 — Root hygiene

- Ignore `dump.rdb` / `*.rdb`
- `git rm --cached dump.rdb`
- Confirm generated dirs already ignored; do not untrack `docs/mobile-screenshots/` or `design-references/`

Budget: `.gitignore` + untrack; 0 source.

### Batch 5 — Boundary check

- `scripts/check-boundaries.mjs` (zero npm deps)
- `pnpm check:boundaries` in root `package.json` (script entry only)
- CI step
- Allowlist the seed file
- Fail on Mobile↔Web, Web→API src, packages→apps (except allowlist), `@maher/ui` from Mobile

Budget: 1 script + `package.json` + CI; 0 app/package source; no lockfile.

### Batch 6 — Dead-code catalog

- `docs/dead-code-candidates.md`
- Delete **no** application code

Budget: 1 doc.

### Batch 7 — Final report + gates

- Re-run full gates including factory 88/88 and `pnpm check:boundaries`
- `docs/repository-refactor-final-report.md` (before/after trees, remaining debt)

Budget: 1 report doc; 0 source.

## Remaining debt (intentionally not this refactor)

1. Fat Admin Web routes (~24k lines in `page.tsx` / colocated clients).
2. Unused packages listed in the audit.
3. Seed → API domain imports.
4. Drifted `packages/types` status unions vs Prisma.
5. Three identical Next `api-client.ts` files.
6. Parallel StaffType/Role DTOs on Mobile vs Admin Web.
7. Empty Prisma migration folder; `db push` instead of migrate.
