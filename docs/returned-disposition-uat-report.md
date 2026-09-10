# Returned disposition UAT

Result: 20/20

- PASS admin login — status=201
- PASS seed received return — RET-UATD-1788685383662-354
- PASS capabilities 200 — status=200
- PASS flag on — dispositionV2=true
- PASS required fields present — ["inspectionResult","disposalMethod","disposalReason"]
- PASS qty overflow rejected — status=400 code=RETURN_QTY_EXCEEDS
- PASS partial split create — status=201 count=2
- PASS inspect repair — status=200 state=APPROVED
- PASS execute repair — status=201 state=IN_PROGRESS po=RW-2026-00022
- PASS rejected inspection missing scrap fields — status=400 code=RETURN_DISPOSITION_FIELDS
- PASS inspect scrap — status=200 state=AWAITING_APPROVAL
- PASS salvage line accepted — status=201 lines=1
- PASS approve scrap — status=201 state=APPROVED
- PASS execute scrap valued write-off — status=201 state=COMPLETED writeOff=0
- PASS seed replacement return — RET-UATD-1788685383872-967
- PASS execute replacement — status=201 po=RP-2026-00019
- PASS legacy sibling kind conflict — status=400 code=RETURN_WORK_KIND_CONFLICT
- PASS seed restock return — RET-UATD-1788685383979-282
- PASS execute restock completes parent — status=201 disp=COMPLETED parent=COMPLETED
- PASS defect restock blocked — status=400 code=RETURN_NOT_STOCKABLE
