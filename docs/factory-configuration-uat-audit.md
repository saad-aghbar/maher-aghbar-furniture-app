# Factory configuration UAT audit

Audit of the **current local worktree** (not the public repo). The inventory/production engine already runs from workflow snapshots. This document records what an Admin can configure in the UI versus what still requires Prisma, seeds, or code.

## What Admin can configure in UI today

| Area | Web | Mobile | Notes |
| --- | --- | --- | --- |
| Product general / photos / notes | Yes | Yes | Product detail |
| BOM (pick existing inventory SKU + qty) | Yes | Yes | `BomMaterialPicker` / `BomMaterialPickerSheet` |
| Assign published workflow to product | Yes | Yes | `PATCH /products/:id/workflow-configuration`. Existing PO snapshots stay frozen |
| Stage required / optional / excluded | Web only | No | Product workflow overrides |
| Master workflow inventory flags | Partial | No | Drawer: `inventoryTracking` + consume checkboxes. Template-wide, not per product |
| Warehouse create / type | Yes | Yes | `isDefault` exists on API, **not** in UI |
| Production order materials return | Yes | Yes (admin) | Operational, not config |
| QC rework stage picker | Yes | No dedicated mobile setup | Operational |

## What still requires developer / Prisma / seed

- **`ProductStageInventoryOutput`**: snapshot reads it; nothing writes it. No CRUD API or UI.
- Per-product stage outputs (e.g. named Frame vs generic component).
- Output names, qty/unit, destination warehouse in product UI (node API fields exist; UI does not send them).
- Specific WIP inputs (Upholstery requires Frame **and** Foam Kit). Runtime boolean `consumesSemiFinished` consumes **all** PO semi-finished lots.
- Production-ready validator and missing-config list.
- Inventory flow preview generated from config.
- Default warehouse per lifecycle type in UI.
- Mobile workflow screens omit inventory fields.
- Lot traceability is list-only (PO + producing stage); no “what happened afterward”.
- Realistic UAT products: default seed has no Milano, no `inventoryTracking` on workflow nodes, no stage outputs.

## Runtime (already correct — do not rebuild)

- Snapshot freeze of consume/produce flags, names, qty, warehouse, item id.
- Stage complete issues/produces; QC gates FG; WIP shortage fails closed; production return; rework new tasks; return fates; DTO on-hand / reserved / free.

## Implication

A factory administrator cannot configure normal product inventory behavior without a developer. Master workflow flags apply to every product on that workflow. Product-specific outputs and consume links are not Admin-usable.

This phase adds product Production Setup (API + web + mobile), warehouse defaults, consume-by-output, validator/preview, isolated UAT fixtures, and a UAT report.
