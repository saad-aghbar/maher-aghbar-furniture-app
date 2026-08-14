# Inventory rearchitecture audit

Written before schema or Inventory UI changes. Local worktree is the source of truth.

## Current schema

- `Warehouse.type` is a free `String`. API validates `RAW | SEMI | FINISHED`. Seeded codes `RAW`, `SEMI`, `FIN`.
- `InventoryItem.category` is `InventoryCategory` mixing material kind (`FABRIC`) with lifecycle (`SEMI_FINISHED`, `FINISHED`).
- No `InventoryItemClass`, `RawMaterialGroup`, or `WarehouseType` enum.
- `InventoryBalance` has `availableQty`, `reservedQty`, `damagedQty`, `onOrderQty`. Runtime only updates `availableQty`.
- `InventoryTxType` includes unused `FINISHED_GOODS_RECEIPT`, `DELIVERY_ISSUE`, `CUSTOMER_RETURN`, `DAMAGE`, `SCRAP`. Missing `SEMI_FINISHED_RECEIPT`, `SEMI_FINISHED_ISSUE`, `OPENING_BALANCE`.
- No `productId` on inventory. Transactions use polymorphic `referenceType` / `referenceId`.
- BOM is `Product.bomDefaults` JSON, not a relational table.
- Workflow nodes have `metadata Json?` only. No inventory tracking fields. Snapshots copy `metadata`.
- `Delivery` / `ReturnRequest` have no inventory FKs.
- `SystemSetting` has no default-warehouse keys.

## Current API

- Inventory is a manual ledger: receive / issue / transfer / count (`apps/api/src/modules/inventory`).
- Purchasing GRN bypasses `applyMovement` (no idempotency, no warehouse-type check).
- Transfers do not enforce lifecycle compatibility.
- Production, tasks, QC, delivery, returns never call `InventoryService`.
- `assessMaterialReadiness()` exists and is unwired. `WAITING_FOR_MATERIALS` is never assigned by API.
- Two warehouse lists: `GET /inventory/warehouses` (`inventory.read`) vs `GET /warehouses` (`warehouse.manage`).

## Current UI

- Mobile signature home is Fabric / Foam / Wood / Accessories (Material Floor). Warehouse type exists only on create.
- Admin web inventory is the same four tiles. Warehouses CRUD is separate.
- Dealer and employee portals correctly expose no warehouse stock.
- Workflow stage drawer has no inventory section.

## Gaps vs target

Lifecycle (Raw / Semi-Finished / Finished) is confused with material groups. Production does not transform stock. `reservedQty` is unused. Finished goods and delivery do not close the loop.

## Duplicate concepts

- `InventoryCategory.SEMI_FINISHED` vs warehouse type `SEMI`.
- Catalog `Material` vs `InventoryItem`.
- Client `preferWarehouseForReceive` vs no server enforcement.
- `@maher/types` `InventoryTransactionType` does not match Prisma `InventoryTxType`.

## Migration risks

- Existing rows must be backfilled, never wiped.
- `OTHER` categories must be review-required, not guessed.
- Historical production must not get fake WIP/FG receipts.
- Open production orders must keep current state until snapshotted inventory behavior exists (default NONE).
