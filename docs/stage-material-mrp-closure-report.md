# Stage-specific material MRP — Phase B closure report

Stage-specific raw SKU mapping sits **on top of** the proven scheduler. The planner
core, occupancy loop, Sync, dealer dates, worker scheduling, WIP consume-by-output,
and QC were not rewritten. Sync stays repair-only. Optimize stays a separate Admin
action.

Live UAT: **2026-08-22** `maher_erp`, timezone `Asia/Amman`.
`pnpm smoke:stage-material-mrp-uat` → **26/26 PASS**.

Evidence: `tmp-stage-material-mrp-uat.json`.

## 1. What shipped

- New `ProductStageMaterialInput` (product × stage × SKU). Not overloaded onto
  `ProductStageInventoryInput` (WIP consume-by-output).
- Snapshot freeze: `ProductionOrderWorkflowSnapshotMaterialInput` copied at
  workflow snapshot create. Historical POs stay stable if the product map later
  changes.
- Products **without** maps keep today's order-wide `assessMaterialReadiness` +
  `applyMaterialNotBefore`.
- Products **with** frozen maps: per-stage `notBefore` from that stage's SKUs
  only (`applyStageOrOrderMaterialFloors`). Parallel carpentry/foam are
  independent. Velvet on upholstery does not floor carpentry.
- Production Setup (admin web + mobile) maps BOM SKUs to stages. Validation:
  real stage, real SKU, qty > 0, no duplicate SKU on the same stage.
- Purchasing demand `GET /api/v1/material-demand` (`purchase-order.read`):
  on hand / reserved / free / incoming / ETA / required qty / next required-by
  (consuming stage planned start, not dealer delivery) / COVERED · AT_RISK ·
  SHORTAGE · NO_ETA. Dealer is 403.
- `PATCH /api/v1/purchase-orders/:id` for `expectedDeliveryDate`. Targeted
  `REPLAN` for affected production orders only — not factory-replan-all, not
  auto-optimize. GRN → retry → material-arrival REPLAN unchanged.
- Scarce retry (`retryWaitingMaterialOrders`) sorts waiting sales orders with
  `comparePriority` before reserve.
- Father-demo seed maps wood→carpentry, foam→foam, fabric/velvet→upholstery,
  hardware→assembly, paint→painting. **Cedar (`SOF-RECL`):** Italian velvet on
  **upholstery only**. Walkthrough IDs `SO-2026-00056` / `PO-2026-00056`
  preserved.

## 2. Live UAT scoreboard

| Check | Result |
|---|---|
| Cedar SO / PO IDs preserved | **SO-2026-00056** / **PO-2026-00056** |
| Freeze velvet→upholstery (5 SKU rows) | PASS |
| Unmapped `SOF-3S-STD` still 0 maps (order-wide) | PASS |
| Generate after freeze | 201, carpentry + upholstery placed |
| Upholstery not before velvet ETA 18 Aug | PASS (`2026-09-02T12:02Z`) |
| Carpentry not blocked by velvet | PASS (scheduled) |
| Snapshot stays UPHOLSTERY after product map edit | PASS |
| Admin demand includes `MAT-ITAL-VEL` | PASS (`COVERED` — inbound 18 Aug before required-by 2 Sep) |
| Required-by ≠ dealer requested 4 Sep | PASS (`2026-09-02T12:02Z`) |
| Dealer demand | **403** `purchase-order.read` |
| Bogus SKU/stage | **400** `SETUP_MATERIAL_SKU_UNKNOWN` |
| PATCH velvet PO ETA | targeted **1** production order; factory run count unchanged |
| Optimize preview | COMPLETED, **0** new conflicts |
| Upholstery still waits for velvet after preview | PASS |
| Dealer requested / committed | Unchanged (`2026-09-04` / null) |

## 3. Cedar idle (16 Aug) vs backward pack

Default generate and Sync stay **backward**. After freeze, Cedar carpentry and
upholstery still pack to **2 Sep** (ahead of requested 4 Sep). That is expected:
stage maps remove the **order-wide** velvet floor; they do not by themselves
pull carpentry into 16 Aug idle.

Domain proof that carpentry **may** start before velvet: unit test
`applyStageOrOrderMaterialFloors` Cedar case — wood/foam in stock ⇒ carpentry
and foam have no `notBefore`; upholstery `notBefore` = 18 Aug. Optimize
**apply** (forward, N-day window) is the action that would use 16 Aug idle.
Preview is read-only, so live allocations did not move in this UAT.

## 4. Out of scope (still)

Sync behavior; dealer/worker scheduling UI; requested/suggested/committed
semantics; planner core rewrite; auto-optimize; FG warehouse capacity; a second
priority/allocator. Unknown cover on a required mapped SKU still marks the
order `MATERIAL_NOT_READY` (dates are not invented).
