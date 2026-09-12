# Phase 9 — Labor into actual cost

**Date:** 2026-09-12

Actual labor is now per-user `TaskTimeEntry` minutes × that worker’s resolved hourly rate, not `task.actualMinutes` × a single assignee. Estimated labor is variant-scoped `ProductStageEstimate` minutes × a stage or global rate. When no rate model exists, labor stays `null` — never `0`.

## Payload

- `ManufacturingCostingPayload.labor` is `{ estimated, actual, byStage, byWorker }` or `null`
- Factory release freezes `plannedLaborCost` next to `plannedMaterialCost` and embeds the labor block in `plannedCostBreakdown`
- `GET /reports/cost/orders` fills the reserved `labor` field; gross margin is sale − material − labor when labor is a number
- `GET /reports/cost/labor` returns period actuals by worker and stage (`inventory.cost.read`; dealers 404)

## Surfaces

- Money desk labor tile shows money when rates exist
- Labor-by-worker board (mobile) and table (admin web) sit beside live worker rates
- Order dossier labor slot lists the total and each worker’s minutes and money

## Tests

- Golden margin: sale 200, material 100, 60 min @ 20 + 30 min @ 40 → labor 40, margin 60
- Multi-worker task costs each user at their own rate
- Missing rates keep labor `null`, not `0`
- Freeze snapshot writes `plannedLaborCost` without rewriting an already-frozen order
