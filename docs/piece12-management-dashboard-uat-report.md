# Piece 12 Management Dashboard UAT Report

API: http://localhost:4000
Result: **PASS** (10/10)

## API path

`GET /api/v1/reports/management-summary`

## Smoke results

- PASS 1. admin login
- PASS 2. GET management-summary 200 — status=200
- PASS 3a. COUNT=DATASET exceptions.waitingReturn — tile=0 prisma=0
- PASS 3b. COUNT=DATASET outbound.shippedAwaitingDealer — tile=3 prisma=3
- PASS 3c. COUNT=DATASET quality.waitingInspection — tile=11 expected=11 (qiNull=1 tasksReady=11)
- PASS 3d. COUNT=DATASET finishedWaiting — tile=15 prisma=15
- PASS 3e. COUNT=DATASET finance.openInvoices — tile=24 prisma=24
- PASS 4. finance.overdue and finance.accountCredit present and independent — overdue=36806.149 credit=11745.096 receivable=43577.832
- PASS 5. worker or dealer cannot GET management-summary (403) — worker status=403
- PASS 6. GET reports/sales with from/to 200 — status=200

## Notes

- Tile map: `docs/piece12-management-tile-map.md`
- Demo: no new rows; uses P7–P11 factory-world data
- Admin-web hierarchy: Attention → Today → Factory Flow → Production → Outbound → Materials → Money → Activity

BROWSER: PENDING
HANDSET: N/A (admin-web Piece 12)
