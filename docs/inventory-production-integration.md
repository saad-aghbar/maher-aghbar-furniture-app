# Inventory production integration

Stage complete ≠ warehouse receipt. Only snapshotted stage configuration creates stock.

## Stage inventory tracking

`NONE` (default) | `PRODUCES_SEMI_FINISHED` | `PRODUCES_FINISHED`

Plus optional `consumesRawMaterials` / `consumesSemiFinished`.

Never infer from stage codes such as `PACKAGING` except a one-time compatibility fallback for snapshots that predate these fields.

## Snapshot

Workflow node fields compile onto `ProductionOrderWorkflowSnapshotNode`. Open orders do not pick up later master-workflow edits.

Product-specific output names live on `ProductStageInventoryOutput` (e.g. Milano Sofa Frame). Reuse one InventoryItem definition per component; lots/transactions carry the production order.

## Worker path

Worker taps Finish Task only. Inside the same DB transaction:

1. Complete task
2. Complete stage instance
3. Verify workflow
4. Resolve output definition, qty (`outputQtyPerUnit`, default 1), warehouse
5. Idempotency key `{productionOrderId}:{stageInstanceId}:{outputDefinitionId}:{txType}`
6. Inventory transaction + atomic balance
7. Continue workflow / scheduling

QC: if snapshot `requiresInspection`, no `FINISHED_GOODS_RECEIPT` until PASS. FAIL/rework prevents or reverses FG.

If the snapshot produces finished goods, `READY_FOR_DELIVERY` / `COMPLETED` requires the receipt.

## Delivery and returns

- `DELIVERED` → idempotent `DELIVERY_ISSUE`
- `FAILED` / `CANCELLED` after issue → restore once (`DELIVERY_RESTORE`)
- Return approve → `CUSTOMER_RETURN` into quarantine (not sellable)
- Fate: `RETURN_TO_STOCK` (inspection), `REWORK`, `DAMAGED` / `SCRAP`
