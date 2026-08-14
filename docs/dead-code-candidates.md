# Dead-code candidates

**Date:** 2026-08-14  
**Rule:** Nothing in this list was deleted. Recommendation only.

Search was `rg` over `*.ts`, `*.tsx`, `*.js`, `*.json` unless noted.

| File / package | Why it appears unused | Search | Risk | Recommendation |
|----------------|----------------------|--------|------|----------------|
| `packages/workflow-graph` | No app `package.json` depends on it. Comment says it was adapted from mobile layout. | `@maher/workflow-graph` only hits its own `package.json`. Live layout: `apps/mobile/src/features/sales-orders/stageGraphLayout.ts`. | Low runtime; package has a test. | Keep. Do not delete until a future shared-layout effort. |
| `packages/testing` | Stub (`createTestId`). No consumer. | `@maher/testing` only in its package. | Low. | Keep. Docs/testing.md mentions it aspirationally. |
| `packages/eslint-config` | Empty `rules: {}`. Apps use `eslint-config-next` / `eslint-config-expo`. | `@maher/eslint-config` only in its package. | Low. | Keep. Do not migrate apps onto it without a dedicated lint task. |
| `packages/config` | Zod `getEnv`. API lists it in `package.json` but source never imports it. | `from '@maher/config'` — **0** hits. | Medium if someone assumes env is validated here. | Keep listing; document that API uses `dotenv` + Nest Config instead. |
| `packages/validation` | Zod schemas. API lists it; DTOs use `class-validator`. | `from '@maher/validation'` — **0** hits. | Medium (duplicate validation story). | Keep. Do not wire it in during this refactor. |
| `packages/types` status unions (`ProductionOrderStatus`, `SalesOrderStatus`, `QuotationStatus`, …) | Shared types drifted vs Prisma enums. | Compare `packages/types/src/index.ts` vs `packages/database/prisma/schema.prisma`. | High if “fixed” without generating from Prisma. | Keep; align in a dedicated types task. |
| `apps/admin-web/src/lib/api-client.ts` and copies on customer/employee portals | Three byte-identical Next fetch clients. | Same `apiFetch` / cookie pattern in each app. | Medium (Next bundling / CORS). | Keep copies. Do not extract `@maher/api-client` here. |
| `StaffTypeRow` / `RoleRow` | Parallel DTOs in Mobile `src/api/modules/users.ts` and Admin Web employee pages. | Local `export type` in each app; not in `packages/types`. | Medium. | Keep. Consolidate only with an API contract pass. |
| `packages/database/prisma/seed/dealer-orders-recent.ts` → `apps/api` | Package imports API workflow compiler + scheduling planner. | Explicit relative `apps/api/src/modules/...` imports. | **High** (factory 88/88). | Keep + allowlist in `pnpm check:boundaries`. Do not extract domain. |
| `packages/database/prisma/seed-orders-volume.ts` | File comment: deprecated no-op; moved to `seed/sales-timeline.ts`. | Package still has the file. | Low. | Keep until a seed-cleanup task. |
| `apps/mobile/app/dev/` | Dev gallery routes. | Expo Router `app/dev/`. | Low; could ship if not gated. | Keep. Intentional. |
| `apps/api/ara.traineddata`, `eng.traineddata` | Large binaries at API root. | Used by tesseract / `@maher/integrations` OCR (`eng+ara`). | High if deleted (OCR). | **Not dead.** Runtime assets. |
| `apps/admin-web/src/app/[locale]/test/` | Empty folder. | No files. Git does not track empty dirs. | None. | Ignore. |
| `packages/ui/fonts/_extracted-from-pdf/` | Reference font subsets. | UI README (if present) / fonts folder. | Low. | Keep as design reference. |
| `dump.rdb` | Redis dump in repo cwd. | No source references. | None. | Untracked + gitignored in Batch 4. Local file may still exist. |

## Do not treat as dead

- Fat Admin Web `page.tsx` files — they **are** the product UI.
- `apps/mobile/**` — feature-complete, freeze.
- Factory modules under `apps/api/src/modules/production|scheduling|inventory`.
- Tracked screenshots under `docs/mobile-screenshots/` and `design-references/`.
