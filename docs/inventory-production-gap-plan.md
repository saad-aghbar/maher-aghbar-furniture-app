# Inventory ↔ production gap plan

Close the remaining factory loops so the architecture poster is runtime behavior. Do not rebuild warehouse types, transfers, reservations, delivery, or quarantine.

## Locked rules

1. Inventory behavior comes from the **ProductionOrder workflow snapshot**, never the mutable master workflow or live product outputs at task complete.
2. No hardcoded stage names (`CARPENTRY`, `UPHOLSTERY`, `PACKAGING`) for consume/produce.
3. Keep `InventoryTracking` + consume flags as the recipe. Combinations stay valid.
4. Consume and produce stay on **stage complete**. Task start only validates readiness.
5. Do not invent output when tracking is `NONE` and no product/node output was snapshotted.
6. Do not silently under-issue. Insufficient stock rolls back the transaction.
7. Worker UX stays Start / Finish / Report Problem. Admin owns return unused, rework stage, return fate.
8. Dealers never see warehouses, WIP, raw stock, or internal rework details.

## Output resolution (snapshot time)

When the snapshot is persisted:

1. Order-specific snapshot/node override (already on compiled node)
2. `ProductStageInventoryOutput` for this product + workflow node / stage definition
3. Workflow node default names/qty/warehouse
4. No output

Freeze onto `ProductionOrderWorkflowSnapshotNode`: tracking flags, names, qty/unit, warehouse id, `outputInventoryItemId`, `outputDefinitionId`.

Runtime `produceOutput` reads snapshot only.

## Warehouse resolution (runtime)

1. Snapshot node `defaultWarehouseId` (stage/order explicit)
2. Snapshotted product-output warehouse (same field after freeze)
3. Configured default warehouse for the lifecycle type
4. `WAREHOUSE_CONFIGURATION_REQUIRED` — no phantom stock

## Consume

- Raw: resolve every BOM line; `RAW_MATERIALS` only; `PRODUCTION_ISSUE`; respect reservations; refuse if any line cannot be fully issued (`INSUFFICIENT_STOCK`).
- WIP: compute required qty from snapshotted producing nodes (`outputQtyPerUnit × order qty`). If available lots for this PO are short, `INSUFFICIENT_SEMI_FINISHED_STOCK` and **no** movements. Else `SEMI_FINISHED_ISSUE` until required qty is gone.
- Both mutations are idempotent per `productionOrderId + stageInstanceId + item/lot`. Rework of a stage that already issued skips a second consume.

## Produce

- One `SEMI_FINISHED_RECEIPT` / `FINISHED_GOODS_RECEIPT` per stage output key.
- Reuse the snapshotted inventory item; do not create a new item definition per order.
- Lot `sourceKey` unique; retry is a no-op; reverse + later re-receipt uses a revision suffix.

## Production return

Admin-only: `GET/POST /production-orders/:id/materials`.

Returnable = issued (`PRODUCTION_ISSUE`) − already returned (`PRODUCTION_RETURN`) for that PO + item. Cannot exceed remaining. Target compatible raw warehouse. Idempotency key from client or `prod-return:{poId}:{itemId}:{qty}:{requestNonce}`.

## QC / rework

- Latest inspection result is authoritative.
- Fail: reverse FG once; PO on hold; `ReworkRequest` awaits admin stage (do not guess).
- Admin start rework: create **new** `ProductionTask` (`isRework=true`); leave original completed tasks untouched; reopen stage instance current status; scheduler replans.
- Pass after withheld FG: `onInspectionPassed` creates FG once.

## Returns

- Approve → quarantine (unchanged).
- `RETURN_TO_STOCK`: inspection + admin permission; leave quarantine; sellable FG; **one** fate transaction; no extra on-hand qty; retry no duplicate.
- `REWORK`: stay quarantined; admin picks re-entry stage; create rework path linked to original order; FG only after production + QC pass.
- `DAMAGED` / `SCRAP`: outbound `DAMAGE`/`SCRAP`; lot not free stock; history kept.

## Cancellation

Release raw reservations. Do not reverse existing WIP/FG receipts. Mark leftover WIP lots `REQUIRES_REVIEW`. Admin disposition later (reuse only if a safe flow already exists — not in this slice).

## DTO / scheduling / start

- Balances expose `onHandQty`, `reservedQty`, `freeQty`. Keep `availableQty` as physical on-hand (deprecated as “free”).
- UI labels: On hand / Reserved / Available (= free).
- Scheduler treats missing required WIP as not ready.
- Task start rejects with `INSUFFICIENT_STOCK` or `INSUFFICIENT_SEMI_FINISHED_STOCK`.

## Tests (must be green before UI polish)

Milano Frame qty 2; WIP shortage no partial; production return + retry; delayed QC pass; QC rework preserves history; return rework; return-to-stock once; scrap unavailable; snapshot ignores later master/product edits; missing warehouse.

## UI (after backend green)

- Admin web + mobile: PO materials + return unused; QC rework stage picker; return disposition.
- WIP row already shows source PO/stage; add next stage if cheap.
- No inventory redesign. EN/AR/HE + RTL.
