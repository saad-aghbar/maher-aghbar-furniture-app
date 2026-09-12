# Phase 10 — Dealer basket with structured per-line spec

**Date:** 2026-09-12

The dealer new-order wizard is a multi-line basket. Local drafts are version 4 (`lines[]`); v3 drafts migrate to a one-line basket. `buildBody()` sends the full `items[]` array, including variant, orientation, wood, foam, finish, accessories, and option codes — those RFQ columns are no longer silently dropped.

## Surfaces

- Basket board on step 1: add, select, edit spec, remove
- Per-line spec sheet reuses variant picker, orientation, and Phase 4 option groups
- Fabric type and colour are catalog pickers (`GET /fabrics`, `GET /colors` now allow `request.create`)
- Catalog / favorites / ordered picks append when a product is already in the basket
- Dealer PDP can choose a variant before Add to Order
- Review lists every line; admin request screens show variant, dims, wood, foam, finish, and fabrics
- Quote accept merges RFQ item spec onto `SalesOrderLine.orderSpec` so wood/foam/options survive even though quotation lines lack those columns

## Tests

- v3 draft becomes a one-line v4 basket
- Catalog pick appends a second line
- `mapRequestItemCreate` writes wood/foam/orientation/options
- Accept snapshots `foamDensity` and `woodType` from the RFQ item
- Basket board add / select / remove
- Sheet geometry for variant picker and line spec
