# Phase 1 — Cost & Performance data foundation

**Date:** 2026-09-12

API only. Screens still consume the old shape plus the new fields.

## What changed

- `GET /reports/cost/orders` is the single profit row: `saleValue`, `plannedCost`, `actualCost`, `variance` (actual − planned), `grossMargin`, `coverage`. `labor` is reserved as `null` until Phase 9.
- `GET /reports/order-profit` is marked `legacy: true` with `canonicalPath: /reports/cost/orders`. CSV export stays.
- `productId` and `status` apply to cost orders, products, and returns. Products are paginated (`data` + `meta`; `products` kept for back-compat).
- `lowestActualCost` / `highestActualCost` already computed by `deriveProductStats` are now on the paginated product rows.
- Dashboard returns `revenueInvoiced` and `openPurchases` so those tiles are no longer permanently 0.
- Dealers still receive `404` on every cost route (`assertCostRead`).

## Tests

- `cost-query.spec.ts` / `cost-performance.service.spec.ts` — filter fidelity, pagination, dealer 404, planned/actual/variance on one row, reserved labor is `null`.
- `order-cost-ledger.spec.ts` — `costVariance`.
