# Inventory migration report

Local Postgres `maher_erp` was updated with `prisma db push` after remapping warehouse type strings to `WarehouseType`.

Mapping:

- Warehouse `RAW` → `RAW_MATERIALS`
- Warehouse `SEMI` → `SEMI_FINISHED`
- Warehouse `FINISHED` → `FINISHED_GOODS`
- Warehouse codes `RAW` / `SEMI` / `FIN` kept
- Existing SKUs not rewritten
- Historical completed stages were not backfilled into WIP/FG lots
- Unknown / `OTHER` item categories are marked for classification review

Scripts:

- `packages/database/prisma/scripts/remap-warehouse-types.sql`
- `packages/database/prisma/scripts/backfill-inventory-rearchitecture.ts`

Seeds create the three default warehouses with `isDefault` per type and opening balances as `OPENING_BALANCE`.
