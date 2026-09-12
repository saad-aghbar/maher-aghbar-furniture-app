# Phase 7 — Variant through the order pipeline

**Date:** 2026-09-12

A catalog variant now survives RFQ → quotation → sales order → production order. Classification compares the ordered spec to the **effective variant**, so a 250cm left-facing Karina with its own foam, paint, piping and cushions stays `STANDARD`. Presence of those details is no longer treated as a modification.

## Pipeline

- Nullable `variantId` + `variantSku` / `variantLabel` on `RequestItem`, `QuotationLine`, `SalesOrderLine`, `ProductionOrder`
- `SalesOrderLineOption` join for reportability; `orderSpec` still holds the immutable snapshot (composition, orientation, options, included items)
- Selling price: variant dealer price → variant `basePrice` → product `basePrice`
- `seedFromCatalog` uses variant-scoped stage materials plus option/included-item SKUs
- Workflow snapshot compile applies variant stage overrides and a variant-owned `workflowId` when set

## Cost & Performance

- `variantId` and `optionValueId` filters on cost orders / products / returns
- `GET /reports/cost/products` now returns `variants[]` and `byOption[]`
- Mobile and admin-web Products sections render those groups instead of the “not configured” slots

## Tests

- Complexity matrix: variant carrying foam/paint/piping/cushions classifies `STANDARD`
- Option-to-SKU seed: foam choice becomes a catalog material requirement
- Quotation accept copies variant identity and line options onto the sales order
