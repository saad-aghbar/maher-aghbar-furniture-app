# Inventory ↔ production gap audit

Local worktree audit of the remaining factory loops. Warehouse types, transfers, reservations, delivery issue/restore, return quarantine, and idempotent movements are already implemented and are **not** rebuilt here.

## What already works

- Warehouse types: `RAW_MATERIALS` | `SEMI_FINISHED` | `FINISHED_GOODS`. Codes stay `RAW` / `SEMI` / `FIN`.
- Raw groups (`FABRIC` / `FOAM` / `WOOD` / `ACCESSORIES`) are independent of warehouse type.
- Cross-lifecycle warehouse transfers are blocked (`WAREHOUSE_TYPE_MISMATCH`).
- Workflow snapshot copies consume/produce flags, output names/qty, and default warehouse onto `ProductionOrderWorkflowSnapshotNode`.
- Stage complete (all tasks done) runs `ProductionInventoryService.onStageTaskComplete`.
- Finished goods are withheld until QC `PASSED` / `PASSED_WITH_NOTES` (`onInspectionPassed`).
- QC fail reverses FG lots (`reverseFinishedGoods`) and creates a `ReworkRequest`.
- Delivery: `DELIVERY_ISSUE` on success; restore once on fail/cancel after delivered.
- Returns: approve → `CUSTOMER_RETURN` into quarantine. `RETURN_TO_STOCK` / `DAMAGED` / `SCRAP` have inventory mutations. `REWORK` only stores the enum.
- Sales-order reservations exist. Scheduling raw readiness uses `availableQty − reservedQty`.
- Inventory transactions use unique `idempotencyKey`. Lots use unique `sourceKey`.

## Runtime recipe model (keep)

Do **not** replace `InventoryTracking` with `CONSUME_RAW` / `CONSUME_SEMI_FINISHED` enum values. The live recipe is already:

| Field | Meaning |
| --- | --- |
| `inventoryTracking = NONE` | No output (default) |
| `inventoryTracking = PRODUCES_SEMI_FINISHED` | Produce WIP |
| `inventoryTracking = PRODUCES_FINISHED` | Produce FG (QC-gated when `requiresInspection`) |
| `consumesRawMaterials` | Consume BOM from `RAW_MATERIALS` |
| `consumesSemiFinished` | Consume this order’s WIP lots |

Combinations are valid (e.g. consume raw + produce WIP). Stage **codes** such as `CARPENTRY` / `UPHOLSTERY` / `PACKAGING` must not decide inventory behavior. `PACKAGING` remains a one-time status-compat fallback only.

## Gaps (poster is not yet true)

### 1. Default tracking is NONE

Unconfigured stages consume/produce nothing. That is correct (no silent invention), but the factory loop is dead until workflow nodes **and** product outputs are configured. There is no product-output resolver at snapshot time.

### 2. `ProductStageInventoryOutput` is unused

The Prisma model exists (`output` item, names, qty/unit, class, warehouse). Nothing in production/inventory services reads it. Output identity currently falls back to “product name + component”, which invents generic WIP.

### 3. Snapshot does not freeze product outputs

Snapshot copies node flags/names only. Later edits to `ProductStageInventoryOutput` would affect in-flight orders if we started reading the live table at task complete. Runtime must read **snapshot only**. Product outputs must be resolved **when the snapshot is created**.

### 4. Raw consume can skip unmapped BOM lines

`consumeRawMaterials` `continue`s when the BOM line cannot resolve an inventory item. Required consume can silently under-issue.

### 5. Semi-finished consume can silently under-issue (critical)

`consumeSemiFinished` FIFO-takes whatever lots exist and returns. If 2 frames are required and 1 exists, it consumes 1 and the stage still completes. No `INSUFFICIENT_SEMI_FINISHED_STOCK`. Balances change.

### 6. Missing warehouse uses the wrong error

No SEMI/FG warehouse throws `WAREHOUSE_TYPE_MISMATCH`. Callers need `WAREHOUSE_CONFIGURATION_REQUIRED` and must not create phantom stock.

### 7. `PRODUCTION_RETURN` is enum/i18n only

Unused fabric cannot be returned to `RAW_MATERIALS`. No issued/used/returnable math, no admin action.

### 8. QC fail does not re-enter workflow

Fail holds the PO, reverses FG, creates `ReworkRequest`. Admin cannot choose a re-entry stage. `completeRework` **rewrites original completed tasks** back to `READY` (destroys history). No new rework execution.

### 9. Delayed QC pass exists; coverage is thin

`onInspectionPassed` can create the skipped FG receipt. Needs tests: no FG while pending → pass once → retry no duplicate.

### 10. QC fail after FG

Reverse exists. `hasPassedInspection` uses **any** historical `PASSED` row, so a later fail plus a leftover pass could still look passed. Must use the latest inspection result.

### 11. Return fate `REWORK` does not start production

`resolveReturnFate('REWORK')` only sets `inventoryFate`. Item stays quarantined (good) but no rework PO/task path, no admin re-entry stage, no later QC→FG.

### 12. `RETURN_TO_STOCK` is two adjustments

Net quantity is zero (retry-safe) but the poster wants one explicit release-from-quarantine action. Must not add a second on-hand quantity.

### 13. Cancellation

Sales-order cancel releases reservations and marks POs `CANCELLED`. It does not reverse WIP/FG (good) but does not mark produced WIP as `REQUIRES_REVIEW` / unallocated.

### 14. Quantity terminology

Stored `availableQty` is physical on-hand. Free qty is `availableQty − reservedQty`. DTOs/UI still present `availableQty` as if it were available-to-use. Need `onHandQty` / `reservedQty` / `freeQty` with `availableQty` kept for compatibility.

### 15. Scheduling ignores WIP

Material readiness only totals raw FABRIC/WOOD/FOAM free qty. A stage with `consumesSemiFinished` can be planned as ready with zero frames.

### 16. Task start has no inventory gate

Workers can start a consume stage with no stock. Issue still happens at **stage complete** (preserve this timing). Start should fail with a localized stock error when required inventory is not ready.

### 17. Issue timing (documented, not changed)

Current architecture issues/consumes and produces on **stage complete** (all stage tasks `COMPLETED`/`CANCELLED`), not on task start. Preferred poster pattern was reserve → issue on start → produce on complete. Changing issue to start would split consume/produce across two moments and break existing completion idempotency. **Keep complete-time mutations.** Add start **validation** only.

### 18. Partial production

Not supported. Full configured output qty on stage complete. Do not invent partial output.

## Issue / produce timing (locked)

| Event | Inventory |
| --- | --- |
| Sales order confirm | Raw reservation (existing) |
| Worker Start Task | Validate required raw/WIP is ready. Do **not** issue. |
| Worker Finish Task / stage complete | Consume raw (`PRODUCTION_ISSUE`) and/or WIP (`SEMI_FINISHED_ISSUE`); produce WIP/FG if configured |
| QC pass (possibly later) | `FINISHED_GOODS_RECEIPT` once if snapshot produces FG |
| QC fail | Reverse FG once; wait for admin rework stage |
| Admin production return | `PRODUCTION_RETURN` of unused issued raw |
| Delivery / return | Unchanged |

## Files that own the gaps

- `apps/api/src/modules/production/production-inventory.service.ts`
- `apps/api/src/modules/production/workflow/workflow-snapshot.service.ts`
- `packages/database/prisma/schema.prisma` (`ProductStageInventoryOutput`, snapshot node, `ReworkRequest`)
- `apps/api/src/modules/quality/quality.controller.ts`
- `apps/api/src/modules/contracts/returns.controller.ts`
- `apps/api/src/modules/inventory/inventory.service.ts`
- `apps/api/src/modules/scheduling/scheduling.service.ts`
- `apps/api/src/modules/tasks/tasks.service.ts`
- `apps/api/src/modules/sales-orders/sales-orders.service.ts`
