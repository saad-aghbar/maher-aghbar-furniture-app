# PIECE 5 — ACTUAL MANUFACTURING COST + FINAL ORDER COSTING CLOSURE

> Status: **CODE COMPLETE** — Handset **PENDING HANDSET**. **STOP** after Piece 5 — do not start Piece 6.

## 0. Audit

### CURRENT COST SOURCES

| Source | Role |
|---|---|
| `InventoryItem.standardCost` | Catalog unit cost base |
| `InventoryTransaction.unitCost` on `PURCHASE_RECEIPT` | Latest purchase overlays standard via `buildMaterialCostMap` |
| Catalog BOM / SO `manufacturingCost` | Commercial/catalog estimate — **not** usage actual |

**MANUFACTURING INVENTORY COST BASIS:** `standardCost` + latest `PURCHASE_RECEIPT` overlay (`buildMaterialCostMap`). Documented in `apps/api/src/modules/production/manufacturing-cost-basis.ts` and `order-costing.util.ts`.

### CURRENT ESTIMATED COST

Piece 2/4 Production Setup: `SalesOrderLineMaterialRequirement.expectedQty` × line qty × cost map (planned; never overwritten by actual).

### CURRENT ACTUAL USAGE

`ProductionTaskMaterialUsage` stores qty + **frozen** `unitCost` / `extendedCost` / `valuedAt` at `finalizeForTask`. ISSUE/RETURN txs also store `unitCost`.

### CURRENT FINAL COST

`ManufacturingCostService` status `FINAL` when PO ∈ `{COMPLETED, READY_FOR_DELIVERY}` + all RAW usages finalized + no uncosted consumption. Payload field `manufacturingCosting` — separate from commercial SO fields.

### GAPS (closed this piece)

- Frozen valuation at finalize — **done**
- Canonical SO/PO actual API — **done**
- Incomplete ≠ 0 — **done**
- Dealer/worker privacy — **done**

### SOURCE OF TRUTH DECISIONS

| Concept | SoT |
|---|---|
| Estimated | Setup material requirements × map (planned; never overwritten) |
| Actual qty | Finalized usage: `actual + scrap − returned` (RAW only) |
| Actual $ | Stored `extendedCost` / `unitCost` on usage after finalize |
| SEMI/FIN | Physical custody — never add to material $ |
| Final | PO COMPLETED\|READY_FOR_DELIVERY + all valued |
| Invoices | Commercial — never overwritten by manufacturing cost |

### Freeze confirmation

| System | Frozen |
|---|---|
| Piece 1–4 | YES |
| Workflow / scheduling | YES |
| QC / Delivery redesign | YES |
| Invoices / purchasing redesign | YES |

---

## A. Valuation policy

Chain: purchasing receipt / GRN `unitCost` → `InventoryTransaction(PURCHASE_RECEIPT)` → `buildMaterialCostMap` → `finalizeForTask` freezes usage + ISSUE/RETURN. Missing valuation stays null → `INCOMPLETE`. Never invent `0.00`.

**Authorized correction gap:** Post-FINAL cost correction UI is deferred. Correction must write a new audit-backed valuation event and update stored usage `unitCost`/`extendedCost` — not re-read the live map. Stub: expose `manufacturingCosting.finalizedAt` + stored rows as the SoT until that UI exists.

## B. Schema + persist

`ProductionTaskMaterialUsage.unitCost|extendedCost|valuedAt`. `finalizeForTask` writes them with ISSUE/RETURN `unitCost`.

## C. ManufacturingCostService + reporting

- Endpoints: `GET /sales-orders/:id/manufacturing-cost`, `GET /production-orders/:id/manufacturing-cost` (`inventory.cost.read`)
- Embed slim `manufacturingCosting` on admin SO/PO detail
- Statuses: `ESTIMATED_ONLY` | `IN_PROGRESS` | `INCOMPLETE` | `FINAL`
- Netting: scrap charged; returns reduce costedQty; rework included once; RAW only
- Reporting fields: totals, byCategory, bySku (planned/issued/returned/scrap/costed/unit/actual/variance/origin), scrapCost, returnCredit, reworkCost, incompleteSkus, taskTrace, finalization state

## D. UI

- Mobile SO: Manufacturing Cost card + breakdown sheet (hero → summary → incomplete → by category → by line → materials → task trace)
- Mobile PO: cost-to-date / final card (admin with `inventory.cost.read`; workers see no money)
- Admin-web SO + PO: estimated / actual / variance from API only (localized status; no raw enums)
- Catalog BOM `ManufacturingCostEditor` left separate (commercial)

## E. Privacy

- Gate: `inventory.cost.read` on Production Management + Finance packs
- Dealers: strip `manufacturingCosting`; 403 on cost APIs
- Workers: 403 on cost APIs; qty-only floor UI

## F. PDF

**N/A** — no internal manufacturing-cost PDF report hook existed; dealer/customer PDFs unchanged and must never include usage actual. Future finance PDF may consume `ManufacturingCostService` without mutating invoices.

## G. Invoice foundation

Commercial invoice totals ≠ manufacturing cost. Piece 5 only exposes internal `manufacturingCosting` for future finance / account statements. **Do not overwrite invoices.** Invoice PDFs and dealer-facing totals remain commercial seller pricing.

## H. Demo + smoke

- Seed: `packages/database/prisma/demo/piece5-manufacturing-cost.ts` (SO-P5-A…I) wired in `factory-world.ts` after Piece 4; preserves P1–P4
- Smoke: `pnpm smoke:piece5-manufacturing-cost-uat` (16 live asserts)

| ID | Story |
|---|---|
| P5-A | On budget — est ≈ actual, FINAL |
| P5-B | Fabric overrun |
| P5-C | Return nets |
| P5-D | Scrap charged |
| P5-E | Rework extra |
| P5-F | Uncosted → INCOMPLETE |
| P5-G | Multi-line aggregate |
| P5-H | FINAL stable after map change |
| P5-I | IN_PROGRESS to-date |

## I. Tests

`apps/api/src/modules/production/manufacturing-cost.spec.ts` — estimate preserve, return/scrap netting, incomplete + incompleteSkus, FINAL, historical stability, rework, RAW filter, privacy. Dealer/list scope strips `manufacturingCosting`.

## J–Y. Route proof (manual handset)

```
LOGIN: admin / 123

TEST P5-A: Orders → SO-P5-A → Manufacturing Cost
ROUTE → OrderDetailScreen → ManufacturingCostCard
      → GET /api/v1/sales-orders/:id (+ manufacturingCosting embed)
CHECK: Final · Estimated ≈ Actual · variance ~0

TEST P5-B: Orders → SO-P5-B → View breakdown
ROUTE → ManufacturingCostBreakdownSheet
      → GET /api/v1/sales-orders/:id/manufacturing-cost
CHECK: Fabric overrun · unit valuation · variance > 0 · bySku/byCategory

TEST P5-C: SO-P5-C breakdown — returnedQty nets costedQty; returnCredit > 0
TEST P5-D: SO-P5-D — scrapCost charged
TEST P5-E: SO-P5-E — reworkCost > 0; origin MIXED/REWORK
TEST P5-F: SO-P5-F — Incomplete · incompleteSkus listed · actual null for uncosted
TEST P5-G: SO-P5-G — by-line section ≥ 2 lines
TEST P5-H: SO-P5-H — Final; after bumping standardCost, Actual unchanged
TEST P5-I: SO-P5-I / linked PO — Cost to date (IN_PROGRESS)

PO: Production → PO-P5-I → cost card (admin only)

DENY: oasis (dealer) — no manufacturingCosting on detail; 403 on cost API
DENY: carpenter (worker) — 403 on cost API; no money on PO screen

Admin-web: /sales-orders/:id and /production/:id show estimated/actual/variance from API
```

HANDSET: **PENDING HANDSET**

## Z. Scoreboard (§40) + backlog (§41)

| Item | Status |
|---|---|
| Estimated ≠ actual ≠ final fields | YES |
| Frozen valuation at finalize | YES |
| FINAL trigger (PO complete/RFD + valued) | YES |
| Scrap charged / returns net | YES |
| SEMI/FIN no double-count | YES |
| Admin SO/PO cost UI | YES |
| Worker/dealer privacy | YES |
| Demo P5-A–I + smoke | YES |
| Internal PDF | N/A (documented) |
| Invoice overwrite | NO (correct) |
| FINAL ACTUAL COST | COMPLETE |
| Invoices / purchasing redesign / dealer balance | NOT in Piece 5 |

## STOP

**Do not start Piece 6.**
