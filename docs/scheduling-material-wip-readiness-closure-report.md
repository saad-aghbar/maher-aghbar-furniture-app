# Scheduling material + WIP readiness — closure report

Closes live-UAT Tests **J** (material `readyAt`) and **K** (WIP consume gating)
without rewriting the planner. Audit:
[scheduling-material-wip-readiness-audit.md](./scheduling-material-wip-readiness-audit.md).
Live proof: [scheduling-material-wip-readiness-live-uat.md](./scheduling-material-wip-readiness-live-uat.md).

Live snapshot: **2026-08-15** `http://localhost:4000` + `maher_erp`, factory
timezone `Asia/Amman`. Isolated `DRUAT-MWIP` records. No seed. Planner
placement, factory-replan occupancy, conflict detector, and calendar were
not changed.

---

## 1. J root cause

Domain `assessMaterialReadiness` and planner `baseStart = max(now,
materialReadyAt, productionReadyAt)` already honored a future ready date.
`loadInventoryAvailability` only returned `{ available: free }` for
FABRIC/WOOD/FOAM and never attached incoming dates. BOM was not scaled by
order qty (`bomToReadinessInput` is per-unit). Live Test J was BLOCKED
because UAT-SOFA stock was sufficient **and** there was no incoming date
even when stock would not be.

## 2. K root cause

`WIP_NOT_READY` fired only when producers were complete and lots were
still short. While producers were open, generate always planned. The
planner waited on snapshot **DAG edges only**. Consume-by-output
(`consumeInventoryItemIds`) was enforced at task start
(`INSUFFICIENT_SEMI_FINISHED_STOCK`) but never as a scheduling
`dependsOnCodes` / `notBefore`. UAT-SOFA-B: Upholstery DAG-depends on
Carpentry only; Foam Kit is inventory-only → consumer allocations while
foam was incomplete.

## 3. Material readiness source model

Legitimate future date: `PurchaseOrder.expectedDeliveryDate` on open POs
in `APPROVED | SENT | PARTIALLY_RECEIVED`. Remaining line qty = ordered −
GRN received. Incoming with **no** date does not cover.

Not used: `Supplier.leadTimeDays`, GRN `receiptDate` (actual only),
transfer ETA (no field), `onOrderQty` (schema only). Incoming POs are a
**factory pool**, not reserved to a production order.

## 4. materialReadyAt calculation

`coverDeficit(required, available, incoming)` sorts dated incoming and
accumulates until the deficit is met. Result is the last date used, or
`unknown` if remainder has no date.

`assessMaterialReadiness`: per required key, skip if `available >= need`;
else cover the deficit. Any unknown → `{ ready: false, materialReadyAt:
null, risk: true }`. Else `materialReadyAt = max(cover dates)`.

Service scales with `bomReservationNeeds(bom, qty)` then
`requirementFromNeeds` (SKU keys `sku:…` and FABRIC/WOOD/FOAM groups).
No second BOM engine.

## 5. Reservation handling

Loader `free = availableQty - reservedQty`. Generate credits this sales
order’s BOM qty back onto `available` only when:

- `salesOrder.status !== WAITING_FOR_MATERIALS` (confirm reserved only
  when ready), **and**
- pool `reservedQty` covers this need (no per-order reservation ledger).

`production.start` / stage unlock no longer overwrite
`WAITING_FOR_MATERIALS` with `IN_PRODUCTION`, so a started-but-unreserved
order cannot steal another order’s reservation in the credit heuristic.

Dealer `availability()` does **not** credit (no SO yet; factory-pool free
is correct).

## 6. Unknown-date behavior

Shortage with no dated incoming → `persistUnschedulable('MATERIAL_NOT_READY')`
and PO `WAITING_FOR_MATERIALS` when still PLANNED/READY. `materialReadyAt`
stays null. No invented date.

## 7. Stage-level material behavior

Snapshot has boolean `consumesRawMaterials`, not per-SKU stage inputs.
`applyMaterialNotBefore` sets `stage.notBefore` on consuming nodes; if
none are flagged, the order-level `materialReadyAt` floor is kept. No
SKU→stage map was invented.

When allocations are unchanged after stock covers, generate still clears
stale `materialReadyAt` / `materialRisk` on the existing row.

## 8. WIP readiness model

Scheduling-only extra `dependsOnCodes` via `applyConsumeWipDependencies`.
Does not write the workflow snapshot. `WIP_NOT_READY` remains only when
producers are complete and lots are still short, or when a required input
has **no** same-order producer (unknown WIP). Consume+DAG cycles skip the
extra dep and persist `WIP_DEPENDENCY_CYCLE`. Order-level
`productionReadyAt` is **not** set (that would delay producers).

## 9. Same-order producer behavior

If lots are short, union producer stage codes into the consumer’s
`dependsOnCodes`. Planner `mergeWaitInstant` already waits on parent
`plannedEnd`. Live UAT-SOFA-B: Upholstery start `2026-08-30T11:15Z` ≥
Foam end `2026-08-29T07:00Z`, not `WIP_NOT_READY` while producers were
open.

## 10. Existing WIP stock behavior

This-PO `AVAILABLE` SEMI_FINISHED lots only (`loadWipLots`). If
`available >= need`, no extra consume wait for that input. After a real
foam task complete, extra foam wait drops; Upholstery still waits on the
Carpentry DAG edge. Warehouse-wide WIP is not invented.

## 11. Quantity handling

Needs use `semiFinishedNeeds` / `outputQtyPerUnit × order qty`. Qty 2
still waits on the same-order foam producer. Aligns with runtime
`INSUFFICIENT_SEMI_FINISHED_STOCK`.

## 12. Parallel WIP inputs

Consumer waits on `max(producer plannedEnd)` across required consume
inputs. Live: Upholstery ≥ max(Carpentry `2026-08-26T11:01Z`, Foam
`2026-08-29T07:00Z`).

## 13. Optional-stage behavior

Skipped producers (`isSkipped`) are not required. Live: skip painting →
no paint allocation, not `WIP_NOT_READY`.

Rework: no redesign. Stage completion already waits on rework tasks
before posting lots; task-complete already enqueues `REPLAN`.

## 14. Replan triggers

| Event | Action |
|---|---|
| GRN commit | `retryWaitingMaterialOrders` + targeted `REPLAN` (`event: material-arrival`) |
| `inventory.receive` | same |
| Task complete | existing `REPLAN` (unchanged) |
| PO `expectedDeliveryDate` PATCH | **none** (no mutation API) |

`REPLAN` is occupancy-safe generate (same path as task-complete). Not
`REPLAN_FACTORY`. If the plan fingerprint is unchanged, material fields
are still synced so a cleared ready date is truthful.

## 15. Live material UAT

`pnpm smoke:material-wip-uat` on **2026-08-15T17:42:28Z**. Real GRN
`191cad79-…` and real `inventory.receive` `INV-2026-00093`. Unique 0-stock
SKU + dated PO `PORD-2026-00003` `expectedDeliveryDate=2026-08-18T17:42:20.593Z`.

| Check | Result |
|---|---|
| MATERIAL READINESS / FUTURE READY DATE / TEST J | **PASS** — starts after `materialReadyAt` |
| UNKNOWN DATE | **PASS** — `MATERIAL_NOT_READY`, `materialReadyAt=null` |
| RESERVATIONS | **PASS** — on-hand 6, first schedules, second `MATERIAL_NOT_READY` |
| ARRIVAL AUTO-REPLAN | **PASS** — after GRN, `materialReadyAt=null`, 9 allocs |

## 16. Live WIP UAT

Real foam complete `TSK-2026-01511` on PO-2026-00176 (UAT-SOFA-B clone).
No fake lot inserts.

| Check | Result |
|---|---|
| SAME-ORDER PRODUCER / TEST K | **PASS** — Upholstery ≥ Foam end |
| PARALLEL INPUTS | **PASS** — max(carpentry, foam) |
| QUANTITY | **PASS** — qty 2 still waits |
| PRODUCER LATE REPLAN | **PASS** — task-complete REPLAN |
| EXISTING STOCK | **PASS** — foam lots drop extra foam wait; carpentry DAG remains |
| OPTIONAL STAGE | **PASS** — skipped painting |

## 17. Conflict regression

After material and WIP replans: **0** new `WORKER_OVERLAP` /
`RESOURCE_OVERLAP` (`datedNew=0 allNew=0`). Detector unchanged.

## 18. At-risk regression

Unknown-date generate: `riskStatus=BLOCKED`, `promiseState=AT_RISK`.
Dated incoming generate: `AWAITING_APPROVAL` (valid plan, no commit).
Canonical classifier unchanged; `MATERIAL_NOT_READY` remains BLOCKED.
When GRN cleared `materialReadyAt`, the order stayed a valid proposed
plan (occupancy kept the same windows).

## 19. Remaining limitations

- No transfer ETA; `onOrderQty` unused at runtime.
- Incoming POs are factory-pool (not reserved to a production order).
- No purchase-order expected-date PATCH → no date-change replan event.
- Semi-finished lots are this-PO scoped (current inventory semantics).
- Raw consume is boolean `consumesRawMaterials`, not per-SKU per stage.
- No per-order reservation ledger; own-reservation credit is
  status + pool reserved cover.
- QC pass that bypasses `TasksService.complete` still does not enqueue
  `REPLAN` (pre-existing).

---

## Final verdict

```
MATERIAL READINESS:                 PASS
MATERIAL FUTURE READY DATE:         PASS
MATERIAL UNKNOWN DATE:              PASS
RESERVATIONS:                       PASS
MATERIAL ARRIVAL AUTO-REPLAN:       PASS
WIP SAME-ORDER PRODUCER:            PASS
WIP QUANTITY:                       PASS
WIP PARALLEL INPUTS:                PASS
WIP PRODUCER LATE REPLAN:           PASS
WIP EXISTING STOCK:                 PASS
OPTIONAL STAGE:                     PASS
PAST-SAFE:                          PASS (replan from scheduling floor, not historical readyAt)
TEST J:                             PASS
TEST K:                             PASS
NEW CONFLICTS:                      0
REAL DEV DB USED:                   YES
REAL API USED:                      YES

EXACT REMAINING GAPS:
- No transfer ETA / onOrderQty runtime
- Incoming POs not reserved to a specific production order
- No PO expected-date update API (no date-change replan)
- Semi-finished lots this-PO only
- Raw materials: boolean consumesRawMaterials, not per-SKU per stage
- QC-pass that bypasses TasksService.complete still does not REPLAN
```
