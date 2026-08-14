# Inventory rearchitecture — what changed

Warehouse type is a real enum (`RAW_MATERIALS` / `SEMI_FINISHED` / `FINISHED_GOODS`), independent of Fabric / Foam / Wood / Accessories.

## Engine

- `applyMovement` validates item class against warehouse type, writes the ledger row first, then updates balances.
- Production stage completion can consume raw/WIP and produce semi-finished or finished lots.
- Finished goods wait for QC `PASSED` / `PASSED_WITH_NOTES`. Fail/rework reverses FG lots without destroying consumed raw.
- Delivery `DELIVERED` issues FG; `FAILED`/`CANCELLED` from delivered restores once.
- Approved returns go to quarantine. Fate: return to stock, rework, damaged, or scrap.
- Sales-order confirm reserves BOM raw or sets `WAITING_FOR_MATERIALS`. Cancel releases reservations. GRN retries waiting orders.

## Clients

- Mobile Material Floor adds a Materials / Semi-finished / Finished selector. Category tiles stay under Materials.
- Transfers can be completed and counts posted from the floor.
- Admin inventory has the same three lifecycle filters, overview cards, dedicated WIP lots, and finished-goods reserved/quarantine badges. Workflow stage drawer can set inventory output and consume flags.
- Approved returns stay in quarantine until Admin applies a fate (return to stock, rework, damaged, or scrap).
- Warehouse create/edit uses the new enum values. Codes `RAW` / `SEMI` / `FIN` are unchanged.
