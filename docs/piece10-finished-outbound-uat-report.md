# Piece 10 Finished Outbound UAT Report

API: http://localhost:4000
Result: **PASS** (14/14)

## Story map

| Story | Numbers | Intent |
|---|---|---|
| A | SO/PO/DLV-P10-A | FIN waiting for truck (READY, no load checks) |
| B | SO/PO/DLV-P10-B | Pickup planned tomorrow |
| C | SO/PO/DLV-P10-C | Leaving today |
| D | SO/PO/DLV-P10-D | Overdue leave date |
| E | SO/PO/DLV-P10-E | Load 3/6; FIN AVAILABLE; depart blocked |
| F | SO/PO/DLV-P10-F | Load 6/6 ready; smoke departs → ISSUE |
| G | SO/PO/DLV-P10-G | OUT_FOR_DELIVERY awaiting balqis confirm |
| H | SO/PO/DLV-P10-H | DELIVERED + customerConfirmedAt/ById |
| I | SO/PO/DLV-P10-I | Two FIN warehouses (FIN + FIN-P10) |
| J | SO/PO/DLV-P10-J | FAILED after ship + DELIVERY_RESTORE |
| K | SO/PO/DLV-P10-K | Distinct searchable package labels |
| L | SO/PO/DLV-P10-L | History presence (left factory) |

## Smoke results

- PASS 1. admin login
- PASS 2. P10 demo rows present (SO/DLV) — missing=none
- PASS 3. P10-E load incomplete (3/6) + FIN AVAILABLE — loaded=3/6 fin=AVAILABLE
- PASS 4. P10-E depart blocked DELIVERY_LOAD_INCOMPLETE — status=400 code=DELIVERY_LOAD_INCOMPLETE
- PASS 5. P10-F depart → OUT_FOR_DELIVERY — status=201 delivery=OUT_FOR_DELIVERY code=
- PASS 6. P10-F DELIVERY_ISSUE count +1 once — before=0 after=1
- PASS 7. P10-F second depart idempotent (no extra ISSUE) — status=201 issues=1
- PASS 8. FIN not in active inWarehouse for departed SO-F — lots=0 boardHits=0 api=200
- PASS 9. nile login — status=201
- PASS 10. nile cannot confirm balqis delivery P10-G — status=404 code=NOT_FOUND
- PASS 11. balqis login — status=201
- PASS 12. balqis confirm P10-G → DELIVERED — status=201 delivery=DELIVERED code=
- PASS 13. confirm-receipt does not change inventory tx count — before=2 after=2
- PASS 14. staff cannot PATCH DELIVERED — status=400 code=DELIVERY_DEALER_CONFIRM_REQUIRED

HANDSET: PENDING
BROWSER: PENDING
Piece 11 was NOT started.
