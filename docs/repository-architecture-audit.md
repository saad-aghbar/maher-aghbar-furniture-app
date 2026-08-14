# Repository architecture audit

**Date:** 2026-08-14  
**Method:** Live worktree inspection (not README-only). No files were moved for this document.

pnpm/turbo monorepo (`apps/*`, `packages/*`). Six runnable apps, 13 packages.

## How the pieces talk

```
packages/types + packages/permissions
        │
        ├──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
   apps/mobile    apps/admin-web  customer-portal  employee-portal
        │              │              │              │
        └──────── HTTP /api/v1 ───────┴──────────────┘
                                   ▼
                              apps/api
                                   │
                     packages/database (Prisma)
                                   │
                              PostgreSQL
                                   │
                              apps/worker  ←  Redis/BullMQ
```

- Frontends never import API or each other’s `src/`.
- Mobile uses Bearer + refresh (`apps/mobile/src/api/`).
- Next apps use cookie `credentials: 'include'` (`src/lib/api-client.ts` in each portal).
- Canonical permissions live in `packages/permissions`. Canonical UI catalogs live in `packages/i18n`.

**One boundary violation:** `packages/database/prisma/seed/dealer-orders-recent.ts` imports `apps/api` workflow compiler + scheduling planner. Leave it; extracting factory domain would risk the 88/88 gate.

---

## Classification legend

| Class | Meaning |
|-------|---------|
| MOBILE | Expo / React Native only |
| ADMIN WEB | Next.js admin site |
| CUSTOMER WEB | Dealer portal |
| EMPLOYEE WEB | Worker portal |
| API | NestJS backend |
| WORKER | BullMQ process |
| SHARED | Used by more than one app, or a repo-wide contract |
| DATABASE | Prisma / seeds |
| TOOLING | CI, scripts, configs, launch |
| TESTING | Tests / smoke / UAT / Playwright |
| DOCUMENTATION | Markdown, guides, screenshots |
| GENERATED | Build/runtime output; do not edit |
| DEAD / LEGACY | Unconsumed or leftover; do not delete yet |
| UNKNOWN | Do not delete |

---

## Root

| Path | Class | PURPOSE | OWNER | RUNTIME | DEPENDENCIES | CONSUMERS |
|------|-------|---------|-------|---------|--------------|-----------|
| `apps/` | — | Runnable applications | — | — | — | Developers, CI, launch scripts |
| `packages/` | SHARED | Libraries and contracts | — | — | — | Apps |
| `scripts/` | TOOLING | Launch, smoke, UAT, asset helpers | Tooling | Node/bash/python | Running API for smokes | `package.json` scripts |
| `docs/` | DOCUMENTATION | Architecture, product, audits, UAT | Docs | None | — | Humans / agents |
| `e2e/` | TESTING | Playwright specs | Tooling | Playwright | Running Admin + API | `pnpm test:e2e:playwright` |
| `infra/` | TOOLING | Docker Compose + Dockerfiles | Tooling | Docker | — | Local/prod deploy |
| `design-references/` | DOCUMENTATION | Brand PNGs / intro QA frames | Design | None | — | Brand scripts, humans |
| `.github/` | TOOLING | CI | Tooling | GitHub Actions | Postgres service | PRs |
| `playwright.config.ts` | TESTING | Playwright config (`testDir: ./e2e`) | Tooling | Playwright | — | e2e |
| `package.json` / `pnpm-workspace.yaml` / `turbo.json` / `pnpm-lock.yaml` | TOOLING | Workspace orchestration | Tooling | pnpm/turbo | — | All packages |
| `.env` / `.env.example` | TOOLING | Secrets / template | Tooling | Loaded by API/launch | — | Local stack |
| `LICENSE` / `README.md` | DOCUMENTATION | Legal + operator guide | Docs | None | — | Humans |
| `dump.rdb` | GENERATED | Redis RDB dump in repo cwd | Accidental | Redis | — | None in source. Tracked + dirty. |
| `logs/` | GENERATED | Launch process logs | gitignored | — | — | Debug |
| `uploads/` | GENERATED | Local disk file storage | gitignored | API | — | Runtime |
| `.run/` | GENERATED | PID files | gitignored | launch scripts | — | `stop:all` |
| `node_modules/` | GENERATED | Dependencies | gitignored | — | — | All |
| `test-results/` | GENERATED | Playwright last run | gitignored | — | — | Playwright |

---

## Apps

### `apps/api` — `@maher/api` — API

**PURPOSE:** NestJS REST API (`/api/v1`), Swagger `/api/docs`, port 4000. Sole authority for authz, inventory math, workflow, scheduling, PDFs, money.

**OWNER:** Backend  
**RUNTIME:** Node (`src/main.ts` → `dist/main.js`)  
**DEPENDENCIES:** `@maher/database`, `@maher/permissions`, `@maher/types`, `@maher/integrations`, `@maher/logging`; listed but unused in source: `@maher/config`, `@maher/validation`.  
**CONSUMERS:** All frontends over HTTP; worker via queues/webhooks; seed script (domain imports).

| Path | Class | Notes |
|------|-------|-------|
| `src/main.ts`, `src/app.module.ts` | API | Bootstrap |
| `src/modules/*` | API | 34 Nest modules (see list below) |
| `src/common/` | API | Guards, filters, Prisma service, PDF helpers |
| `src/integrations/storage/` | API | Upload storage |
| `assets/brand`, `assets/fonts` | API | PDF rendering |
| `ara.traineddata`, `eng.traineddata` | API | Tesseract language data (~7.4MB). Runtime assets, not dead. |
| colocated `*.spec.ts` / `__tests__` | TESTING | Jest; 61 files |

Modules: `ai-chat`, `ai-intake`, `audit`, `auth`, `catalog`, `contracts`, `customers`, `deliveries`, `documents`, `geo`, `health`, `inbound-email`, `inbound-whatsapp`, `inventory`, `invoices`, `notifications`, `org`, `payments`, `production` (includes `workflow/`), `purchasing`, `quality`, `quotations`, `reports`, `requests`, `roles`, `sales-orders`, `scheduling`, `search`, `settings`, `supplier-invoices`, `suppliers`, `tasks`, `users`, `warehouses`.

**Do not redesign these modules.** Factory-sensitive: production, workflow snapshots, inventory, scheduling, QC, deliveries, returns.

---

### `apps/admin-web` — `@maher/admin-web` — ADMIN WEB

**PURPOSE:** Next.js 14 App Router admin/staff website, port 3000, locales `ar|en|he`.

**OWNER:** Admin Web  
**RUNTIME:** Next (`next dev` / `next start`)  
**DEPENDENCIES:** `@maher/i18n`, `@maher/permissions`, `@maher/types`, `@maher/ui`  
**CONSUMERS:** Browsers. Talks to API via `src/lib/api-client.ts` (cookies).

| Path | Class | Notes |
|------|-------|-------|
| `src/app/[locale]/` | ADMIN WEB | Routes. Many fat `page.tsx` (inventory-client 1752 lines). Keep in App Router. |
| `src/components/` | ADMIN WEB | Shell (`app-shell`, `sidebar`, `nav-items`) + feature folders `workflow/`, `scheduling/`, `catalog/`, `admin/`, `ai-chat/` |
| `src/lib/api-client.ts` | ADMIN WEB | HTTP client |
| `src/lib/scheduling*.ts`, `workflow-*.ts` | ADMIN WEB | Web-only helpers for those UIs |
| `src/hooks/` | ADMIN WEB | `use-api-mutation`, `use-auth-me` |
| `src/i18n/` | ADMIN WEB | next-intl wiring → `@maher/i18n` (no local JSON catalogs) |
| `src/providers/` | ADMIN WEB | React Query, status i18n |
| `public/` | ADMIN WEB | Brand PNGs |
| `middleware.ts` | ADMIN WEB | Locale routing |
| `src/lib/*.test.ts` | TESTING | 4 Vitest files only |
| `src/app/[locale]/test/` | UNKNOWN | Empty directory |

---

### `apps/mobile` — `@maher/mobile` — MOBILE (feature-complete; freeze internals)

**PURPOSE:** Expo SDK 54 / RN 0.81 app. Surfaces: `(admin)`, `(customer)`, `(employee)`.

**OWNER:** Mobile  
**RUNTIME:** Expo Go / EAS, Metro `:8081`  
**DEPENDENCIES:** `@maher/i18n`, `@maher/permissions`, `@maher/types`. **Not** `@maher/ui`.  
**CONSUMERS:** Phones/simulators. HTTP Bearer to API `:4000`.

| Path | Class | Notes |
|------|-------|-------|
| `app/` | MOBILE | Expo Router file routes |
| `app/dev/` | MOBILE | Dev gallery screens (intentional) |
| `src/features/` | MOBILE | 31 feature folders |
| `src/api/` | MOBILE | Client + domain modules |
| `src/navigation/` | MOBILE | Tabs / Staff adaptive bar — freeze |
| `src/theme/`, `src/motion/`, `src/components/` | MOBILE | RN UI — freeze |
| `src/i18n/` | MOBILE | Wrappers over `@maher/i18n` |
| `src/permissions/` | MOBILE | Re-exports `@maher/permissions` |
| `assets/` | MOBILE | Icons, splash, brand, fonts |
| `app.config.ts`, `eas.json`, Metro/Babel | MOBILE | Expo config |
| `src/**/__tests__` | TESTING | Jest ~120 files |

No Mobile-only files were found outside `apps/mobile/`.

---

### `apps/customer-portal` — `@maher/customer-portal` — CUSTOMER WEB

**PURPOSE:** Dealer Next.js portal, port 3001.  
**OWNER:** Customer Web  
**RUNTIME:** Next  
**DEPENDENCIES:** Same as admin-web (`i18n`, `permissions`, `types`, `ui`)  
**CONSUMERS:** Dealer browsers. `src/lib/api-client.ts` is **byte-identical** to admin-web.

Tests: stub (`echo`). No `*.test.ts`.

---

### `apps/employee-portal` — `@maher/employee-portal` — EMPLOYEE WEB

**PURPOSE:** Worker Next.js portal, port 3002. Smaller surface (dashboard, tasks, profile).  
**OWNER:** Employee Web  
**RUNTIME:** Next  
**DEPENDENCIES:** Same as admin-web  
**CONSUMERS:** Worker browsers. Own `src/lib/api-client.ts` (identical copy). Own `@/lib/scheduling` (not imported from admin-web).

Tests: stub.

---

### `apps/worker` — `@maher/worker` — WORKER

**PURPOSE:** BullMQ consumers (email, SMS, WhatsApp, PDF, AI, OCR, notifications, scheduling, …) plus inbound-email and low-stock pollers.

**OWNER:** Backend  
**RUNTIME:** Node `src/main.ts`  
**DEPENDENCIES:** `@maher/integrations`, `@maher/logging`  
**CONSUMERS:** API enqueues jobs. HTTP webhook in `low-stock-pr.ts`.

Layout: three source files. Tests: stub.

---

## Packages

| Package | Class | PURPOSE | Consumed by | Notes |
|---------|-------|---------|-------------|-------|
| `@maher/types` | SHARED | Domain/API TS types | 5 apps + permissions, i18n | Status unions drifted vs Prisma |
| `@maher/permissions` | SHARED | `PERMISSIONS`, `can()`, routing/home, staff kinds | 5 apps + database seed | Canonical. Do not fork. |
| `@maher/i18n` | SHARED | `messages/{ar,en,he}/*.json` + helpers | 4 UI apps | Namespaces include `mobile.json`. API has no catalogs. |
| `@maher/ui` | SHARED (Next only) | DOM/Tailwind components | admin, customer, employee | Mobile must not import |
| `@maher/database` | DATABASE | Prisma schema, client re-export, seeds | API | Seed violates package→app rule |
| `@maher/integrations` | SHARED (backend) | Email/SMS/WhatsApp/AI/OCR/JoFotara | API, worker | |
| `@maher/logging` | SHARED (backend) | JSON logger | API, worker | |
| `@maher/tsconfig` | TOOLING | Shared TS configs | Next apps + most packages | API/worker extend by relative path |
| `@maher/config` | DEAD / LEGACY | Zod `getEnv` | Listed on API only | **No source imports** |
| `@maher/validation` | DEAD / LEGACY | Zod schemas | Listed on API only | **No source imports**; API uses class-validator |
| `@maher/workflow-graph` | DEAD / LEGACY | DAG layout | **None** | Duplicate of mobile `stageGraphLayout.ts` |
| `@maher/testing` | DEAD / LEGACY | Stub `createTestId` | **None** | |
| `@maher/eslint-config` | DEAD / LEGACY | Empty ESLint stub | **None** | Apps use next/expo configs |

---

## Database (`packages/database/prisma`)

| Path | Class | Notes |
|------|-------|-------|
| `schema.prisma` | DATABASE | Source of truth for enums/models |
| `migrations/` | DATABASE | `20260811090000_production_scheduling/` exists **empty** (no `migration.sql`). Local/CI uses `prisma db push`. |
| `seed.ts`, `seed/` | DATABASE | Launch + demo seed |
| `seed/dealer-orders-recent.ts` | DATABASE | Imports `apps/api` domain — **violation** |
| `prisma/scripts/` | TOOLING | Backfills, factory-uat-only seed, SQL remaps |
| `seed-orders-volume.ts` | DEAD / LEGACY | Deprecated no-op (moved to `seed/sales-timeline.ts`) |
| `stage-task-instructions.ts` | DATABASE | Mirrored from API helper |

No schema change is required to organize source files.

---

## Scripts (`scripts/`)

Flat (13 files). Do not nest — `package.json` paths would break.

| File | Class |
|------|-------|
| `prepare-launch.sh`, `launch.sh`, `start-all.sh`, `stop-all.sh` | TOOLING |
| `smoke-pdf-lifecycle.mjs`, `smoke-workflow-critical-path.mjs`, `smoke-scope-isolation.mjs`, `smoke-factory-uat.mjs` | TESTING |
| `factory-lifecycle-uat.mjs` | TESTING (88 assertions; factory gate) |
| `encode-brand-logo.mjs`, `generate-watermark-field.py` | TOOLING (brand assets) |
| `apply-arabic-glossary.py`, `patch-arabic-remaining-i18n.py` | TOOLING (one-time i18n) |

---

## Docs / design / e2e / CI

| Path | Class | Notes |
|------|-------|-------|
| `docs/*.md` (~108 at audit; more added by this refactor) | DOCUMENTATION | Flat mix of architecture, feature design, and historical audits |
| `docs/user-guides/` | DOCUMENTATION | Admin/customer/employee guides |
| `docs/database/database-model.md` | DOCUMENTATION | |
| `docs/mobile-screenshots/` | DOCUMENTATION | Tracked PNGs + READMEs |
| `docs/source-proposal.pdf` | DOCUMENTATION | |
| `design-references/branding/` | DOCUMENTATION | Logos, intro-qa frames |
| `e2e/*.spec.ts` | TESTING | 2 Playwright files |
| `.github/workflows/ci.yml` | TOOLING | Postgres, generate, package builds, mobile typecheck/test, `pnpm typecheck`, `pnpm test`, API build. No Playwright/smoke. |
| `infra/docker/` | TOOLING | compose + API/web Dockerfiles |

---

## i18n ownership

| Catalog / wiring | Location |
|------------------|----------|
| Message JSON (ar/en/he) | `packages/i18n/src/messages/{ar,en,he}/` |
| Mobile-specific strings | `mobile.json` in that package |
| Admin/customer/employee next-intl | `apps/<portal>/src/i18n/{request,routing,navigation}.ts` |
| Mobile runtime wrappers | `apps/mobile/src/i18n/` |
| API errors | Mostly codes + `packages/i18n` `errors.json` on clients; API has no message catalogs |

Do not merge catalogs or rename keys.

---

## Assets

| Location | Class | Owner |
|----------|-------|-------|
| `apps/mobile/assets/` | MOBILE | App icons, splash, brand, fonts |
| `apps/admin-web/public/` + `src/assets/` | ADMIN WEB | Brand |
| `apps/customer-portal/public/` | CUSTOMER WEB | Brand |
| `apps/employee-portal/public/` | EMPLOYEE WEB | Brand |
| `apps/api/assets/` | API | PDF brand + fonts |
| `packages/ui/assets/` + `fonts/` | SHARED (Next) | UI brand; some `_extracted-from-pdf` reference fonts |
| `docs/mobile-screenshots/` | DOCUMENTATION | QA captures (tracked on purpose) |
| `design-references/` | DOCUMENTATION | Design source |

Do not delete assets by filename alone.

---

## Tests

Tests stay with the code they verify (existing convention).

| Location | Runner | Count (approx) |
|----------|--------|----------------|
| `apps/mobile/**/__tests__` | Jest | 120 |
| `apps/api/src` | Jest | 61 |
| `packages/permissions/src/__tests__` | Jest | 7 |
| `packages/workflow-graph` | Jest | 1 (package unused) |
| `apps/admin-web/src/lib/*.test.ts` | Vitest | 4 |
| `e2e/` | Playwright | 2 |
| `scripts/*smoke*`, `factory-lifecycle-uat.mjs` | Node | repo-level |
| customer/employee/worker | stub | 0 files |

`packages/testing` is not a test runner.

---

## Generated / gitignore

Already ignored: `node_modules`, `dist`, `.next`, `.turbo`, `coverage`, `*.tsbuildinfo`, `.expo`, `.env`, `.run`, `logs`, `uploads`, `.minio-data`, Prisma `*.db`, `test-results`, `playwright-report`.

**Gap:** `dump.rdb` is tracked and not ignored.

Prisma client generates into `node_modules/@prisma/client` (no custom `output`).

---

## Cross-app imports

| Check | Result |
|-------|--------|
| Mobile → Web / API `src` | None |
| Admin Web → Mobile / API `src` | None |
| Any app → another app `src` | None |
| packages → apps | **One:** database seed `dealer-orders-recent.ts` |
| Duplicate permission catalog | None (single `packages/permissions/src/catalog.ts`) |
| Boundary lint | None today |

Duplicate **contracts** (not catalogs): drifted `ProductionOrderStatus` / `SalesOrderStatus` / `QuotationStatus` in `packages/types` vs Prisma; parallel `StaffTypeRow` in mobile and admin-web; three identical Next `api-client.ts` files.

---

## Dependency direction (actual, keep)

Allowed:

- Mobile / Admin Web / portals → `@maher/types`, `@maher/permissions`, `@maher/i18n` (+ `@maher/ui` for Next only)
- Frontends → API over HTTP only
- API → `@maher/database`, `@maher/permissions`, `@maher/types`, `@maher/integrations`, `@maher/logging`
- Worker → `@maher/integrations`, `@maher/logging`
- Shared packages → must not depend on `apps/` (seed is the exception)

Forbidden (already holds except seed):

- Mobile ↔ Admin Web internals
- Frontend → API service implementation
- API → UI packages (`@maher/ui` not used by API)
- `@maher/ui` → Mobile
