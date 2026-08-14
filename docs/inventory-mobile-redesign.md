# Inventory mobile redesign

Visual source of truth: existing signature Inventory home (Material Floor). Extend, do not replace.

## Hierarchy

Inventory → warehouse type (Raw / Semi-Finished / Finished) → category or stock → item.

Fabric / Foam / Wood / Accessories remain material categories under Raw Materials only.

Reuse: `InventorySignatureHome`, `InventoryCategoryRail`, `InventorySectionTabs`, `InventoryLowStockFocus`, `BottomSheet`, theme spacing/radius/elevation, `AnimatedPressable`, `ListItemEnter`, `CountUp`, `haptics`, `useDraggablePillBar`.

## Views

- Raw: keep Material Floor tiles, low-stock attention, add material, search.
- Semi-finished: production cards (product, PO, stage → next, qty). No Add Item.
- Finished: product cards with Available / Reserved / Ready / Quarantined badges. No Add Item.
- Warehouses grouped by type. Add warehouse sheet with visual type picker (no code field).
- Transfers FROM → TO with RTL-safe direction. Counts Expected / Counted / Difference.
- History as business-language activity rows.
- Sheets for lightweight actions. Matching skeletons. Designed empty/error/success.
