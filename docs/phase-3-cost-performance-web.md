# Phase 3 — Cost & Performance rebuild (admin web)

**Date:** 2026-09-12

The ~1600-line reports scroll is now routed sections that match the mobile IA.

## Routes

- `/reports` — Money desk (dashboard, sales richness, cash flow, AP, inventory, labor slot, CSV)
- `/reports/orders` — sortable / paginated order cost table; order number is the identity link
- `/reports/orders/[id]` — dossier including lines, materials, time by stage, transactions, linked returns
- `/reports/products` — product analytics + variant / option slots
- `/reports/returns` and `/reports/returns/[id]` — return list and per-piece dossier
- `/reports/coverage` — unpriced SKUs + backfill

## Filters

`ReportsChrome` writes `from`, `to`, `customerId`, `productId`, `status`, `salesRepId` as URL params. The same query string is passed to every cost/sales panel on the page.

## Tests

- Playwright `e2e/cost-performance.spec.ts` — per-locale full-page screenshots (RTL for ar/he), row-link check on orders, CSV control presence (skips when login/API is down).
