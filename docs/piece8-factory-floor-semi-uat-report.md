# Piece 8 factory floor SEMI UAT

API: http://localhost:4000
When: 2026-08-29T14:46:36.456Z

| # | Check | Result | Detail |
|---|-------|--------|--------|
| 1 | 1. admin login | PASS |  |
| 2 | 2. demo rows SO/PO-P8 present | PASS | missing=none |
| 3 | 3. P8-A first stage incoming required=false | PASS | task=TSK-P8-A-02 required=false |
| 4 | 4. P8-B kit READY | PASS | kit=WIP-P8-B-CARPENTRY |
| 5 | 5. P8-C kit READY | PASS | kit=WIP-P8-C-CARPENTRY |
| 6 | 6. P8-C receive works | PASS | status=201 code= |
| 7 | 7. custody CLAIMED after receive | PASS | status=CLAIMED |
| 8 | 8. SEMI receive does not create material usage cost rows | PASS | before=0 after=0 |
| 9 | 9. manufacturing cost ignores SEMI receive (actual null/0 or RAW-only) | PASS | status=200 actual=null |
| 10 | 10. parallel P8-E lanes (carpentry + foam tasks) | PASS | carp=READY foam=NOT_STARTED |
| 11 | 11. discrepancy endpoint creates blocker without receive | PASS | status=201 blocker=090b1e6f-420f-4979-98ec-d6857be7f3c7 |
| 12 | 12. Packaging FIN / Delivery tasks=0 | PASS | finLot=y deliveryTasks=0 |
| 13 | 13. RAW material usage excludes SEMI (P8-L) | PASS | rows=1 scrap=0.5 returned=0.5 |
| 14 | 14. material-usage API excludes SEMI | PASS | status=200 lines=1 |
| 15 | 15. P8-F partial handoff 4/6 | PASS | recv=4 expected=6 |

**Score:** 15/15
