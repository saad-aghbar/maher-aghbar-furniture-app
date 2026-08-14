# Factory end-to-end UAT report

Date: 2026-08-13

This phase is **runtime proof**, not a new architecture. Isolated fixtures `UAT-SOFA-A` / `UAT-SOFA-B` / `UAT-SOFA-C` were driven through the live API + database. PASS means the lifecycle ran and assertions on real balances / transactions / snapshots succeeded.

Evidence command: `node scripts/factory-lifecycle-uat.mjs` (`pnpm smoke:factory-lifecycle`)

Final run: **88/88 assertions passed, 0 failed** (sign-off rerun after restoring `STANDARD_FURNITURE` on UAT-SOFA-A).

Product A happy-path IDs (sign-off run): sales order `a37f350a-395c-4e20-aea7-fcf36db08ffe`, production order `50012391-df56-431f-9bdb-3dd209476a75`.

## Verdict

Configured Production Setup **does drive the runtime factory/inventory lifecycle** for A/B/C (orders, frozen snapshots, WIP, QC, FG, delivery, returns, idempotency, roles).

The factory/inventory **engine** remains proven: **88/88**.

Admin Web Production Setup on the normal `next start :3000` instance is **PASS** (Playwright EN/AR/HE, including Hebrew preview names `נגרות` / `שלדת ספת UAT רגילה`).

Mobile Production Setup exists, is typecheck-green, and matches Inventory/Material Floor tokens. Interactive Expo Go device matrix on the booted iPhone 16 simulator is **not complete** (Expo Go is not installed). See FINAL SIGN-OFF.

## Defects found and fixes applied

| Defect | Fix |
| --- | --- |
| Customer return quarantine left FG **free/sellable** | `inventory.service` `quarantineReturn` now applies `reservedDelta: quantity` |
| `RETURN_TO_STOCK` / `SCRAP` left reserved qty wrong | Unreserve on return-to-stock; `reservedDelta: -qty` on scrap/damaged |
| Product B upholstery could consume with only Frame | Isolated `UAT_PARALLEL` workflow; consume-by-output requires Frame **and** Foam Kit |
| Packaging consumed leftover WIP after upholstery | UAT packaging `consumesSemi: false` |
| `completeRemaining` stuck on `STAGE_LOCKED` ASSEMBLY | Harness skips locked stages and continues |
| QC rework start `VALIDATION_ERROR` when carpentry id missing | Resolve re-entry stage id from completed tasks; only POST when UUID present |
| Mobile Production Setup typecheck: missing sheet import, `spacing.xxl`, implicit `any` | Import `./components/ProductionStageSetupSheet`; `spacing['4xl']`; typed `onSave` |
| Production Setup error/loading hid the hub title | Admin card title stays visible while loading or on fetch error |
| Playwright defaulted to `:3010` (not in `CORS_ORIGINS`) | Default admin URL is `:3000` |
| Live Admin Web `:3000` returned HTTP 500 for `/_next/static/*` (HTML instead of JS/CSS) | Stale `next start` after `next dev` overwrote `apps/admin-web/.next` hashed chunks. Cleared `.next`, rebuilt, restarted `:3000`. |
| Config smoke PATCHed UAT-SOFA-A onto the first published workflow (`UAT_PARALLEL`) | Smoke now prefers `STANDARD_FURNITURE` and identity-PUTs existing fixtures. Restored with `seed:factory-uat-only`. |
| HE preview showed English names | Preview only branched AR vs EN; stage/output `nameHe` was empty. API returns `nameHe`; UI uses `formatProductionPreviewStep`; seed fills stage + output Hebrew. PUT now preserves `outputNameHe`. |
| Full API Jest PDF timeouts under parallel workers | PDF tests run serially after the rest (`--runInBand`). Cause: font/PDFKit CPU contention, not inventory/production. |

## Scenario 1 — Standard Sofa complete lifecycle (Product A)

**PASS**

Test performed: receive wood 400 + fabric 800 → dealer/sales order qty 2 → confirm → inspect snapshot → assign/start/complete MATERIAL_PREP → CARPENTRY → UPHOLSTERY → remaining stages → QC PASSED → delivery DELIVERED. Retries after WIP receipt, WIP issue, QC submit, delivery.

Expected: BOM reserve 8 wood + 16 fabric; PRODUCTION_ISSUE those qtys; exactly 2 named Frame WIP; SEMI_FINISHED_ISSUE 2; no sellable FG before QC; exactly 2 FG + dealer reservation after QC; DELIVERY_ISSUE 2; retries do not change balances.

Actual: all of the above. Frozen snapshot 9 nodes, `legacy=false`. Tasks TSK-2026-00670 / 00671 / 00674. QC `QC-2026-00055` PASSED. Delivery `DEL-2026-00019` DELIVERED.

Inventory transactions (this order’s **deltas**; DB-wide type totals are larger because the UAT DB already had prior runs):

| Step | Item | Before onHand / reserved / free | Tx qty | After onHand / reserved / free |
| --- | --- | --- | --- | --- |
| PURCHASE_RECEIPT | wood | 2545 / 88 / 2457 | +400 | 2945 / 88 / 2857 |
| PURCHASE_RECEIPT | fabric | 5080 / 176 / 4904 | +800 | 5880 / 176 / 5704 |
| Confirm / BOM reserve | wood | 2945 / 88 / 2857 | reserved +8 | 2945 / 96 / 2849 |
| Confirm / BOM reserve | fabric | 5880 / 176 / 5704 | reserved +16 | 5880 / 192 / 5688 |
| PRODUCTION_ISSUE | wood | 2945 / 96 / 2849 | −8 (unreserve 8) | 2937 / 88 / 2849 |
| PRODUCTION_ISSUE | fabric | 5880 / 192 / 5688 | −16 | 5864 / 176 / 5688 |
| SEMI_FINISHED_RECEIPT | Frame | 46 / 0 / 46 | +2 | 48 / 0 / 48 |
| WIP receipt retry | Frame | 48 / 0 / 48 | 0 | 48 / 0 / 48 |
| SEMI_FINISHED_ISSUE | Frame | 48 / 0 / 48 | −2 | 46 / 0 / 46 |
| WIP issue retry | Frame | 46 / 0 / 46 | 0 | 46 / 0 / 46 |
| Before QC | FG | 24 / 17 / 7 | 0 | 24 / 17 / 7 |
| FINISHED_GOODS_RECEIPT + SO reserve | FG | 24 / 17 / 7 | +2 / reserved +2 | 26 / 19 / 7 |
| DELIVERY_ISSUE | FG | 26 / 19 / 7 | −2 / unreserve 2 | 24 / 17 / 7 |
| Delivery retry | FG | 24 / 17 / 7 | 0 | 24 / 17 / 7 |

Every row satisfies `free = onHand − reserved`.

Production state: PO created from confirmed SO; snapshot frozen; stages completed through QC; SO delivered.

Evidence: `smoke:factory-lifecycle` assertions for scenario 1; snapshots `A-before-order` … `A-delivery-retry`.

Bug discovered: none on this happy path in the final run.

## Scenario 2 — Parallel workflow (Product B)

**PASS**

Test performed: confirm qty-2 order on `UAT-SOFA-B`. Complete MATERIAL_PREP + CARPENTRY only. Attempt UPHOLSTERY start/complete. Then complete FOAM. Then complete UPHOLSTERY.

Expected: downstream blocked with only Frame; no silent Foam under-issue; after Foam Kit +2, upholstery proceeds.

Actual: start and complete returned `400 INSUFFICIENT_SEMI_FINISHED_STOCK`. Foam kit onHand unchanged at 0 while blocked. FOAM completion received Δ 2 kits. Upholstery then `201` (TSK-2026-00682).

Evidence: `B downstream blocked with only Frame`, `no silent foam under-issue`, `B upholstery proceeds after both outputs`. PO `08ae81ba-0950-496e-a7cc-130c294eab4b`.

Fix applied (fixture, not new engine): `UAT_PARALLEL` graph + consume-by-output Frame+Foam Kit.

## Scenario 3 — Optional stage (Product C)

**PASS**

Test performed: two qty-1 orders on `UAT-SOFA-C`. One completes PAINTING. One skips painting.

Expected: snapshots differ; skipped stage has no active task, no consumption, no output, no inventory tx.

Actual: skip `201`; with-optional painting produced WIP 5→6; skipped tasks `CANCELLED`; skipped painting extra WIP 6 vs 6; paint txs for skipped PO = 0.

Evidence: `snapshots differ on skip`, `skipped stage created no inventory tx`.

## Scenario 4 — Snapshot immutability

**PASS**

Test performed: create Order A on Product A. PUT carpentry `qtyPerUnit` 7. Complete carpentry on Order A. Create Order B. Complete carpentry. Restore original setup.

Expected: Order A still outputs 1 frame/unit; Order B outputs 7.

Actual: Order A Δ frames 1; Order B Δ frames 7; setup restored after the test.

Evidence: `Order A snapshot ignores later qty 7`, `Order B uses new qty-per-unit 7`.

## Scenario 5 — Production return

**PASS**

Test performed: issue raw on a qty-1 order. Return qty 1 with idempotency key. Retry same key. Return qty 999.

Expected: `PRODUCTION_RETURN`; RAW +1; retry no duplicate; cannot return more than issued.

Actual: `INV-2026-00328` PRODUCTION_RETURN qty 1; wood 2909→2910; retry 2910 vs 2910; over-return `400 INSUFFICIENT_STOCK`.

## Scenario 6 — QC failure + rework

**PASS** (final run)

Test performed: complete through inspection, submit `FAILED_REWORK_REQUIRED`, start rework at carpentry, worker starts new task, complete remaining, QC PASS.

Expected: original completed task remains; new rework task; FG unavailable; worker can work; QC PASS creates FG exactly once.

Actual: rework `RW-2026-00014` IN_PROGRESS; original task COMPLETED; tasks=2; worker start `201` TSK-2026-00739 “Carpentry rework”; QC `QC-2026-00058` PASSED; Δ FG 1.

Earlier run failed `rework start` with `VALIDATION_ERROR` when `stageInstanceId` was missing. Harness now resolves a completed-stage UUID before POST. Rerun: PASS.

## Scenario 7 — Customer return

**PASS**

Test performed: deliver, create+approve return, then three fates on separate orders.

| Fate | Expected | Actual |
| --- | --- | --- |
| Quarantine | CUSTOMER_RETURN; not sellable | CUSTOMER_RETURN tx; reserved holds qty |
| RETURN_TO_STOCK | available FG exactly once | onHand 25→26 |
| REWORK | unavailable extra sellable FG; after work+QC FG once | free 8→8; Δ FG 1 after QC |
| SCRAP | never available FG | onHand 28→28 |

Fix applied: quarantine `reservedDelta`; scrap unreserve. An earlier run failed SCRAP because completeRemaining hit `STAGE_LOCKED`; harness skip fixed that, then SCRAP passed.

## Scenario 8 — Idempotency

**PASS**

Retried: stage complete / WIP receipt / WIP issue / QC submit / delivery complete / production return (same idempotency key) / return-to-stock path (quarantine `sourceKey`). No duplicate physical qty.

Evidence: `WIP receipt idempotent`, `WIP issue idempotent`, `FG receipt idempotent after QC retry`, `delivery completion idempotent`, `return retry does not duplicate`.

## Scenario 9 — Ledger reconciliation (Product A)

**PASS**

Reconstructed from live snapshots in the 88/88 run. See the table in scenario 1. Chain:

PURCHASE_RECEIPT → reservation → PRODUCTION_ISSUE → SEMI_FINISHED_RECEIPT → SEMI_FINISHED_ISSUE → FINISHED_GOODS_RECEIPT → DELIVERY_ISSUE

Returns/rework are separate orders (scenarios 5–7), not mixed into this sofa’s chain.

Note: `qtyOfType` over item transaction history is **cumulative for the SKU in this database** (e.g. wood PRODUCTION_ISSUE total 268). Order-level proof is the **before/after deltas** above, which reconcile.

## Scenario 10 — Role verification

**PASS**

| Role | Expected | Actual |
| --- | --- | --- |
| ADMIN | GET/PUT production setup | GET READY; PUT used in snapshot test |
| WORKER | no setup / warehouse config | production-setup `403`; warehouses `403`; can start assigned rework task |
| DEALER | own order progress; no raw/WIP/BOM/worker internals | setup `403`; raw inventory `403`; PO `200`; graph omits `UAT-WOOD` and `assignedEmployee`; materials `[]` |

Mobile Production Setup route is wrapped in `PermissionGate` `catalog.manage`.

## Scenario 11 — UI verification

**PASS** (Admin Web on live `:3000`) / **PARTIAL** (Mobile device matrix)

Test performed:

- Playwright `e2e/factory-production-setup.spec.ts` against the rebuilt `next start :3000` instance (3/3)
- Source + token check of Mobile `ProductionSetupScreen` / `ProductionStageSetupSheet` against Inventory/Material Floor
- i18n catalog-parity (EN/AR/HE), RTL helpers, `formatProductionPreviewStep` unit tests

| Check | Result |
| --- | --- |
| Admin Web hub on running `:3000` | **PASS** — product detail opens; Production Setup hub visible |
| EN hub, Ready, Edit materials, no raw enums/keys | **PASS** |
| AR `html[dir=rtl]` + `إعداد الإنتاج` | **PASS** |
| HE `html[dir=rtl]` + `הגדרת ייצור` + Hebrew preview `נגרות` / `שלדת ספת UAT רגילה` | **PASS** |
| BOM access | **PASS** — Admin same-page `#product-bom` editor; Mobile “Edit materials” opens existing product BOM editor. No second BOM model. |
| Hebrew preview names | **PASS** — locale HE uses DB `nameHe` (stage + output), fallback HE → EN → AR |
| Mobile EN/AR/HE × light/dark on device | **PARTIAL / BLOCKED** — iPhone 16 simulator is booted; Expo Go (`host.exp.Exponent`) is not installed, so the six-way interactive matrix was not executed. Screen uses theme tokens (`radius.xl`, `colors.border`, `minHeight: 44`) matching Material Floor. |
| RTL helpers | **PASS** `apps/mobile/src/i18n/__tests__/rtl.test.ts` |
| Catalog parity EN/AR/HE | **PASS** |
| Raw enums / i18n keys / backend codes | **PASS** on Admin Playwright body; Mobile maps behavior via `production.setup.*` and issues via `errors.*` |

## Scenario 12 — Test gate

Do not hide failures.

| Gate | Result |
| --- | --- |
| API typecheck | **PASS** |
| Admin Web typecheck | **PASS** |
| Mobile typecheck | **PASS** (28 pre-existing errors fixed in this sign-off; no `any` / `@ts-ignore` / tsconfig weaken) |
| API lint | **PASS** (`--max-warnings=0`) |
| Admin Web lint | **PASS** with existing warnings (hooks, `no-img-element`, aria) |
| API unit+integration | **294 passed, 0 failed** — 280 unit/integration then 14 PDF tests `--runInBand` |
| Targeted production/inventory specs | **PASS** |
| Admin Web unit tests | **12/12 PASS** (includes Hebrew preview formatter) |
| Prisma validate | **PASS** with `dotenv -e ../../.env` |
| `pnpm smoke:factory-uat` | **8/8 PASS** |
| `pnpm smoke:factory-lifecycle` | **88/88 PASS** |
| API build | **PASS** (`nest build`) |
| Admin Web build | **PASS** (`next build`); serving `next start :3000` |
| Expo Doctor | **18/18 PASS** |

## Scenario 13 — This report

Updated from the **88/88 sign-off rerun** plus Admin Web `:3000` Playwright and typecheck/build gates. Not from “GET production-setup exists”.

## Remaining limitations

1. Mobile six-way EN/AR/HE × light/dark was **not** executed on Expo Go — the simulator is booted but Expo Go is not installed (`simctl listapps` has no `host.exp.Exponent`). Metro was not required for Admin sign-off.
2. Warehouse `nameHe` on RAW/SEMI/FIN seed rows is still empty; HE warehouse labels fall back to English per `localizedName`. Stage and output preview names are Hebrew.
3. `CORS_ORIGINS` does not include a second admin-web port; do not run `next dev` against the same `apps/admin-web/.next` while `:3000` is in production mode.
4. Lifecycle numbers are deltas on a shared UAT database that already contains prior runs.
5. PDF generation tests are expensive (fontkit/PDFKit). They pass in isolation and when run serially after the rest of the API suite; they can still starve under a fully parallel Jest run if that split is removed.

## FINAL SIGN-OFF

Date: 2026-08-13. Stabilization only. Proven warehouse / WIP / QC / return / snapshot / idempotency / isolation rules were not rewritten.

### Admin Web `:3000` root cause

HTTP 500s on product detail were **not** a product API or Production Setup bug. Playwright fetched `/_next/static/css/*.css` and `/_next/static/chunks/*.js` and received `content-type: text/html`. A `next dev` process had overwritten `apps/admin-web/.next` while `next start :3000` still referenced old hashed filenames.

### Admin Web fix

Stopped the stale `:3000` server, deleted `apps/admin-web/.next`, rebuilt `@maher/i18n` + `@maher/admin-web`, restarted `next start -p 3000`. Hashed webpack chunks return `200 application/javascript`. Do not start `next dev` on another port against the same `.next` directory.

### Sign-off matrix

| Item | Result |
| --- | --- |
| Admin Web Production Setup | **PASS** |
| Mobile Production Setup (interactive device) | **PARTIAL** — implementation + typecheck + i18n tests PASS; Expo Go device matrix not run |
| EN light / EN dark / AR light / AR dark / HE light / HE dark | Admin Playwright covers EN/AR/HE (browser light). Mobile theme tokens used; device dark/light not executed |
| RTL | **PASS** (Admin AR/HE `dir=rtl`; mobile rtl unit tests) |
| Hebrew preview localization | **PASS** |
| BOM editing/access | **PASS** (existing product BOM editor, linked from setup; no second model) |
| Mobile typecheck | **PASS** |
| Admin Web typecheck | **PASS** |
| API typecheck | **PASS** |
| Full API Jest | **PASS** 294/294 (PDF serial) |
| Factory config smoke | **PASS** 8/8 |
| Factory lifecycle | **PASS** 88/88 |
| Admin Web build | **PASS** |
| API build | **PASS** |
| Expo Doctor | **PASS** 18/18 |

### Definition of done

- Factory engine **88/88** — met
- Normal Admin Web Production Setup opens on `:3000` — met
- `:3000` HTTP 500 resolved — met
- Admin Web Production Setup browser-tested EN/AR/HE — met
- Mobile Production Setup device-tested 6-way matrix — **not met** (Expo Go missing)
- EN/AR/HE rendered (Admin Playwright + catalogs) — met for Admin; Mobile catalogs/RTL tests met
- RTL verified — met (Admin)
- Light/dark verified — Admin browser default; Mobile device dark **not** executed
- Hebrew preview fixed — met
- Admin can manage BOM without developer intervention — met
- Mobile TypeScript green — met
- No raw enums/i18n keys on Admin hub — met
- No production mock data — met
- Builds pass — met
- This report updated — met

**Stop.** Engine semantics unchanged. Remaining gap is Expo Go on the simulator for the mobile visual matrix, not the factory inventory/production engine.
