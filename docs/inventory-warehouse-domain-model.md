# Inventory warehouse domain model

Two independent dimensions.

## Warehouse type (lifecycle location)

`RAW_MATERIALS` | `SEMI_FINISHED` | `FINISHED_GOODS`

A raw warehouse may contain Fabric, Foam, Wood, and Accessories together. Type is not a material group.

## Item class (what the stock record is)

`RAW_MATERIAL` | `SEMI_FINISHED_GOOD` | `FINISHED_GOOD`

Raw materials also have `RawMaterialGroup`: `WOOD | FABRIC | FOAM | ACCESSORIES`.

Existing `InventoryCategory` remains the subtype (PAINT, ADHESIVE, METAL_ACCESSORY, …).

## Compatibility

- RAW_MATERIAL ↔ RAW_MATERIALS warehouse
- SEMI_FINISHED_GOOD ↔ SEMI_FINISHED warehouse
- FINISHED_GOOD ↔ FINISHED_GOODS warehouse
- Same-type transfers allowed
- Cross-lifecycle movement is production, never a warehouse transfer

## Authoritative quantity

`InventoryBalance` (item + warehouse + optional location) is the only on-hand source.

Free-to-promise = `availableQty - reservedQty`.

Lots (`InventoryLot`) carry origin (production order, stage, sales order) and allocation (`GENERAL_STOCK` | `ORDER_ALLOCATED`) without proliferating InventoryItem rows.

## Quarantine

No fourth warehouse type. Use `WarehouseLocation` code `QUARANTINE` on the default finished-goods warehouse and/or lot status `QUARANTINED`.

## Defaults

At most one `isDefault` warehouse per type, plus `SystemSetting` keys:

- `inventory.defaultWarehouse.RAW_MATERIALS`
- `inventory.defaultWarehouse.SEMI_FINISHED`
- `inventory.defaultWarehouse.FINISHED_GOODS`
