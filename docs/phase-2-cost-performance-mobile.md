# Phase 2 — Cost & Performance rebuild (mobile admin)

**Date:** 2026-09-12

Mobile admin `/reports` is now a drillable money desk instead of five vague tabs.

## Sections

- **Money** — period revenue, material cost, labor (not configured), margin. Tiles press into Orders. Sales richness (`topCustomers`, `topProducts`, `bySalesRep`, `recentQuotes`) is rendered and pressable.
- **Orders** — sale / planned / actual / variance per row → order dossier.
- **Order dossier** — lines, materials (to inventory SKU), time by stage, linked returns, transactions, lifetime. Labor remains a named slot.
- **Products** — average / lowest / highest actual cost → filters orders. Variant and group-by-option slots are explicit “not configured yet”.
- **Returns** — list → per-piece return dossier (`GET /reports/cost/returns/:id`).
- **Coverage** — unpriced SKUs + backfill button.

## Filter

One persistent filter (dealer, product, status) plus period chrome. The same filter object is sent to cost orders, products, returns, and sales.

## Tests

- Interaction: `ReportsScreen.test.tsx` (every action wired, order drill, materials drill, return dossier).
- Sheet geometry: `CostFilterSheet.test.tsx` including keyboard-open cap.
- Floor + drillability source scan.
- i18n: `reports.i18n.test.ts` in en / ar / he.
- Maestro: `e2e/mobile/cost-performance.yaml`.
