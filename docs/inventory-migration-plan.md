# Inventory migration plan

No database reset. No recreation of inventory items.

## Warehouse type

`RAW` / `RAW_MATERIALS` → `RAW_MATERIALS`  
`SEMI` / `SEMI_FINISHED` → `SEMI_FINISHED`  
`FINISHED` / `FINISHED_GOODS` / code `FIN` → `FINISHED_GOODS`  
Unknown → `RAW_MATERIALS` + `classificationReviewRequired`

Keep warehouse codes `RAW`, `SEMI`, `FIN`. Human names stay friendly.

## Item class

| Old category | itemClass | materialGroup |
| --- | --- | --- |
| WOOD | RAW_MATERIAL | WOOD |
| FABRIC | RAW_MATERIAL | FABRIC |
| FOAM | RAW_MATERIAL | FOAM |
| METAL_ACCESSORY, DECORATIVE_ACCESSORY, PACKAGING, PAINT, ADHESIVE | RAW_MATERIAL | ACCESSORIES |
| SEMI_FINISHED | SEMI_FINISHED_GOOD | null |
| FINISHED | FINISHED_GOOD | null |
| OTHER | RAW_MATERIAL | null, review-required |

`isPurchasable` = true only for `RAW_MATERIAL`. Existing SKUs are never rewritten.

## Historical production

Do not create WIP/FG receipts for already-completed stages. Cutover = when this schema is applied. Opening physical stock uses `OPENING_BALANCE` / reconciliation UI.

Existing workflows: inventory tracking `NONE`. Existing open POs keep current state.

## Rollback

Keep `category`. New columns are additive. Enum rewrite can be reversed by mapping back to strings if needed.
