# Piece 9 Quality / Packaging UAT Report

API: http://localhost:4000
Result: **PASS** (20/20)

- PASS 1. admin login
- PASS 2. inspector login — status=201
- PASS 3. demo rows SO/PO-P9 present — missing=none
- PASS 4. floor complete on INSPECTION rejected (USE_QUALITY_SUBMIT) — status=400 code=USE_QUALITY_SUBMIT
- PASS 5. P9-C exists for fail/rework story — 2ec64167-2640-45ff-b257-ac8ad55fdbad
- PASS 6. quality floor context — status=200 policy=PO_LEVEL_ALL_OR_NOTHING
- PASS 7. quality attention cards — status=200 n=5
- PASS 8. create inspection P9-A — status=201 code=
- PASS 9. Inspection PASS P9-A — status=201 result=PASSED
- PASS 10. PASS unlocks Packaging (READY/PENDING→READY) — status=READY
- PASS 11. PASS does not create FIN — fin=0
- PASS 12. rework stage recommendation — recommended=UPHOLSTERY
- PASS 13. completeRework reopens Inspection (seed E) — status=READY insp=PENDING_REINSPECTION
- PASS 14. Packaging stays locked until reinspect PASS — status=PENDING
- PASS 15. packaging incomplete blocked (or already needs labels) — status=400 code=PACKAGES_INCOMPLETE
- PASS 16. P9-K FIN exists exactly once — fin=1
- PASS 17. Packaging complete → FIN — H blocked INSUFFICIENT_SEMI_FINISHED_STOCK; P9-K fin=1
- PASS 18. duplicate Packaging complete → no duplicate FIN — seed P9-K
- PASS 19. Delivery worker tasks = 0 on P9 — n=0
- PASS 20. P9-L rework material usage present — n=1

HANDSET: PENDING
BROWSER: PENDING
Piece 10 was NOT started.
