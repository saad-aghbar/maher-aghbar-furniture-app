# Demo factory data — closure report

**Checkpoint:** 3 of 3  
**Executed:** 2026-08-16  
**Clock:** `DEMO_AS_OF=2026-08-16` 14:00 Asia/Amman (`2026-08-16T11:00:00.000Z`)  
**Target:** local Docker/dev Postgres `127.0.0.1:5432` / database **`maher_erp`** / `NODE_ENV=development`  
**Company:** Maher Al-Aghbar & Sons Furniture (real name). Dealers, staff, and suppliers are fictional Levantine identities.

This is the father presentation dataset. Do **not** use `pnpm db:seed:demo` or `SEED_FACTORY_UAT` for owner demos.

## Safety (no massacre)

| Check | Result |
|-------|--------|
| Preflight | `demo:reset` printed `NODE_ENV=development host=127.0.0.1 database=maher_erp` and refused any other host/db/`production` |
| Backup | `backups/maher_erp-pre-demo-20260816.dump` (`pg_dump -Fc`, user `maher`). Restore: `pg_restore -h 127.0.0.1 -U maher -d maher_erp --clean --if-exists backups/maher_erp-pre-demo-20260816.dump` |
| Schema / migrations | Untouched. Wipe is `TRUNCATE … CASCADE` of operational tables plus drop of leftover UAT warehouses `RAW-2` / `SEMI-2` / `FIN-2` |
| Auth bootstrap | Recreated in the same reset. Password **`123`**. Logins `admin`, `nile`, `oasis`, `balqis` kept |
| Permissions / org | Recreated: identity + staff presets, AMMAN branch, RAW/SEMI/FIN, departments, stage library, `FINAL_QC`, notification templates, settings (ILS, VAT 16%) |

## What ran

1. `pnpm --filter @maher/permissions build` (seed reads staff presets from `dist/`)
2. `pnpm demo:reset` — foundation → wipe → foundation → calendar → people/skills → 5 workflows → catalog/BOMs → stock/POs → sales/production/schedules → extras → `demo:validate` → walkthrough
3. `pnpm demo:live-uat` against `http://localhost:4000` (`GET /api/v1/health` 200)

## Live counts (after reset)

| Entity | Count |
|--------|-------|
| Users | 42 (11 staff + 21 floor workers + 10 dealer logins) |
| Dealers | 10 |
| Products | 22 |
| Raw inventory SKUs | 42 (`bomDefaults.materials[]` SKUs exist as items) |
| Supplier POs | 22 (received / partial / sent / approved) |
| Sales orders | **65** |
| Production orders | 63 (two SOs are DRAFT, no PO) |
| Workflows | `STANDARD_FURNITURE`, `PAINTED_WOOD`, `ARMCHAIR_PATH`, `CUSTOM_SECTIONAL`, `SIMPLE_OTTOMAN` |
| Returns | 3 (delivered SOs only) |
| Invoices | 19 (one per delivered SO) |
| Rework | 1 `AWAITING_STAGE` (Oasis QC) + 1 `COMPLETED` (Nile recovered) |

### Sales order mix

| Status | Count |
|--------|-------|
| DELIVERED | 19 |
| IN_PRODUCTION | 29 |
| READY_FOR_PRODUCTION | 10 |
| READY_FOR_DELIVERY | 4 |
| DRAFT | 2 |
| WAITING_FOR_MATERIALS | 1 |
| CONFIRMED / WAITING_FOR_PAYMENT / COMPLETED as live SO status | **0** |

### May-be-late (canonical `at-risk.ts`)

Exactly **3** latest active schedules on incomplete POs:

| PO | Classifier | Story |
|----|------------|--------|
| PO-2026-00055 | BLOCKED / MATERIAL_NOT_READY | Cedar Italian velvet recliner (`MAT-ITAL-VEL` opening 0, inbound fabric PO SENT) |
| PO-2026-00050 | BLOCKED / WIP_NOT_READY | Diwan wingback foam gate |
| PO-2026-00022 | LATE | Jabal contract dining (committed 10 Aug 2026, as-of 16 Aug) |

Healthy approved work has **no** past committed date, so the classifier does not mark the rest of the floor LATE.

## Lifecycle honesty

- Confirm path is DRAFT → PO + `compileWorkflow` snapshot + reserve-shaped status `READY_FOR_PRODUCTION` or `WAITING_FOR_MATERIALS`. Vestigial `CONFIRMED` is not used as a live status.
- `WAITING_FOR_MATERIALS` has no started tasks.
- Delivered SOs have a `DELIVERED` delivery, passing QC, completed rework when QC had failed, and no active tasks.
- Worker allocations require `WorkerSkill`. Occupancy is accumulated oldest-first through the real `backwardSchedule` / `forwardSchedule` planner. Overtime is calendar `EXTRA_SHIFT` (22 Jul, 5 Aug, 12 Aug 16:00–20:00). Shutdown 25 Jun.
- Inventory balances equal signed transaction sums. BOM truth is `materials[{sku,qty}]`.
- Demo template nodes set `requiresPhotosOverride: false` (stage library still `requiresPhotos: true`) so historical complete does not invent `TASK_PHOTO` binaries.

Direct-Prisma exceptions vs Nest services are listed in [`demo-screen-data-coverage.md`](demo-screen-data-coverage.md).

## Leftover UAT / fake data

- No `UAT_PARALLEL`, no `UAT-SOFA-*`, no `RAW-2`/`SEMI-2`/`FIN-2`.
- Presentation strings scanned for `\b(UAT\|DRUAT\|TEST\|MOCK\|SAMPLE\|Lorem)\b`.
- Leftover **CNC** stage definition (not in the canonical library) is **inactive** and is not a node on `STANDARD_FURNITURE` (that dangling terminal blocked `compileWorkflow` on the first reset attempt).
- Playwright [`e2e/factory-production-setup.spec.ts`](../e2e/factory-production-setup.spec.ts) targets **`SOF-3S-STD`**, including Hebrew WIP output **שלדת ספה סטנדרטית**.

## Commands

| Command | Role |
|---------|------|
| `pnpm demo:reset` | Father dataset (this closure) |
| `pnpm demo:validate` | Re-check invariants without wiping |
| `pnpm demo:live-uat` | Login + dashboard/products/orders smoke (`client: mobile` for `accessToken`) |
| `pnpm db:seed` | Empty launch accounts only |
| `pnpm db:seed:demo` | Legacy 14-day world — **not** the father dataset |
| `pnpm db:seed:factory-uat` | Isolated UAT SKUs — **not** for presentation |

Walkthrough with real document numbers: [`father-demo-walkthrough.md`](father-demo-walkthrough.md). Screen → API → seed map: [`demo-screen-data-coverage.md`](demo-screen-data-coverage.md).

## Live API UAT

Against the running Nest process on `:4000`:

- `GET /api/v1/health` → 200
- `POST /api/v1/auth/login` as `admin` and `nile` (password `123`, `client: mobile`) → `accessToken`
- `GET /reports/dashboard`, `/reports/admin-home`, `/products?q=SOF-3S-STD`, `/sales-orders` (admin + nile dealer isolation)

## Remaining limitations (honest, not faked)

- Historical floor complete is Prisma status/rollup using planner timestamps, not HTTP `TasksService.complete` (photo gate opted out on templates).
- Live WhatsApp/SMS, JoFotara clearance, device push, MFA, and Redis queue contents are not seeded.
- Mobile empty-state copy such as “Jerash Furnishings” is UI i18n, not DB.
- `pnpm db:seed` remains an empty launch; re-running it would wipe this world. Re-apply with `pnpm demo:reset`.
