# Inventory ↔ production gap closure

The warehouse engine was already in place. This slice makes the factory poster true at runtime: configured stages consume and produce, product outputs are authoritative, shortages fail closed, unused raw can return, QC/rework and customer-return fates actually move production and stock.

## What was missing

- Stages defaulted to `NONE` and `ProductStageInventoryOutput` was never read.
- Semi-finished consume could silently under-issue.
- `PRODUCTION_RETURN` was an unused enum.
- QC fail created a `ReworkRequest` but rewrote original completed tasks instead of a new rework execution.
- Return fate `REWORK` only stored the enum.
- DTOs presented physical `availableQty` as if it were free stock.
- Scheduling ignored missing WIP.

## What was implemented

- Snapshot-time `resolveProductStageOutput`: order/node override → `ProductStageInventoryOutput` → workflow node defaults → no output.
- Frozen snapshot fields: tracking flags, names, qty/unit, warehouse, `outputInventoryItemId`, `outputDefinitionId`.
- Runtime produce/consume reads **snapshot only**.
- Raw consume: every BOM line must resolve and fully issue or `INSUFFICIENT_STOCK`. No skipped lines.
- WIP consume: required qty from producing snapshot nodes; shortfall → `INSUFFICIENT_SEMI_FINISHED_STOCK` with no movements.
- Produce WIP/FG with snapshotted item identity; missing warehouse → `WAREHOUSE_CONFIGURATION_REQUIRED`.
- Admin `GET/POST /production-orders/:id/materials` for issued / returned / returnable and `PRODUCTION_RETURN`.
- QC fail: reverse FG, await admin stage. `POST .../rework/:id/start` creates a **new** `isRework` task. Original completed tasks stay completed.
- Latest inspection result is authoritative for the QC gate.
- Return `REWORK` creates a rework request linked to the original PO (stage optional, then start). `RETURN_TO_STOCK` one fate transaction, no extra on-hand. `DAMAGE`/`SCRAP` remain unsellable.
- Cancelled POs: reservations released; leftover WIP lots `REQUIRES_REVIEW`; produced stock is not reversed.
- Balances expose `onHandQty`, `reservedQty`, `freeQty`. `availableQty` remains physical on-hand for compatibility.
- Scheduling treats missing required WIP as not ready.
- Task start validates stock; issue/produce still happen on **stage complete**.

## Runtime rules

| Moment | Inventory |
| --- | --- |
| Sales confirm | Raw reservation (existing) |
| Start task | Validate only |
| Stage complete | Consume raw/WIP if snapshotted; produce WIP/FG if snapshotted |
| QC pass (including delayed) | FG receipt once if snapshot produces FG |
| QC fail | Reverse FG once; wait for admin re-entry stage |
| Admin return unused | `PRODUCTION_RETURN` ≤ remaining issued |
| Delivery / customer return | Unchanged issue / restore / quarantine |

Stage codes are never used to decide consume/produce.

## Output resolution

1. Compiled/order node override (frozen on snapshot)
2. `ProductStageInventoryOutput` at snapshot creation
3. Workflow node default names/qty/warehouse
4. No output — do not invent a generic component

Later master workflow or product-output edits do not change in-flight orders.

## Warehouse resolution

1. Snapshot node warehouse
2. Default warehouse for the lifecycle type
3. `WAREHOUSE_CONFIGURATION_REQUIRED`

## Known limitations

- Issue remains on stage **complete**, not task start (documented; start only validates).
- No partial production. Full configured output qty on complete.
- Cancelled-order WIP is marked `REQUIRES_REVIEW`; reuse/reassign is not a full admin flow yet.
- `RETURN_TO_STOCK` records one audit adjustment without changing on-hand (quantity already arrived via `CUSTOMER_RETURN`).
- `InventoryTracking` stays `NONE | PRODUCES_SEMI_FINISHED | PRODUCES_FINISHED` plus consume flags rather than a new CONSUME_* enum.
- Product stage outputs are configured in data (`ProductStageInventoryOutput`); there is no new catalog designer UI in this slice.
- Worker app is still Start / Finish / Report Problem. Dealers still do not see warehouses, WIP, or internal rework.
