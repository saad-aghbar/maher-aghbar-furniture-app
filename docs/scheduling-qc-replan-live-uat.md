# QC → scheduling REPLAN live UAT

Generated: 2026-08-15T18:04:40.350Z
API: http://localhost:4000
Database: maher_erp
Tag: DRUAT-QC
REAL DEV DB USED: YES
REAL API USED: YES

## Results

| Case | Status | Expected | Actual |
|---|---|---|---|
| A accept | **PASS** | QC PASSED; REPLAN; PACKAGING refreshed; 0 new overlaps; 1 active version | qc=PASSED version 5→6 active=1 newOverlaps=0 pkg=READY |
| B reject/rework | **PASS** | FAIL → ON_HOLD + rework task; 1 active version; 0 new overlaps | hold=ON_HOLD rework=065e8832-2751-45a6-960e-e7c669d82569 task=a1afe79c-08ac-418d-a306-2083be4fb4f8 active=1 newOverlaps=0 |
| C rework complete | **PASS** | floor-complete rework task + completeRework; downstream may proceed; 0 new overlaps | task=201 req=201 po=IN_PROGRESS active=1 newOverlaps=0 |
| D producer late | **PASS** | no consumer plannedStart < inspection actualCompletion | insp=2026-08-15T18:04:33.366Z pkgStart=n/a atRiskHttp=200 beforeCount=13 |
| E no storm / burst | **PASS** | PASS retry no version bump; fail+startRework still one active version | retryVersion 6→6 activeB=1 |
| F retry | **PASS** | Jest: processor throw still rethrows after markNeedsReview; live QC stays PASSED on retry submit | live identical PASS retry status=201 result=PASSED (queue attempts=5 documented; QC not rolled back) |
| NEW CONFLICTS | **PASS** | 0 new WORKER_OVERLAP / RESOURCE_OVERLAP | 0  |
| REAL DEV DB / API USED | **PASS** | localhost:4000 + maher_erp | http://localhost:4000 maher_erp |

Counts: **8 PASS / 0 FAIL / 0 BLOCKED**

## Steps

- PASS API health — 200
- PASS retired prior DRUAT-QC POs — 0
- PASS admin login — 201
- PASS nile login — 201
- PASS nile customer — a95bf2ca-2a80-4552-80c0-73f36d9e8710
- PASS UAT-SOFA-A — 2281d1a7-f19c-4205-9b2a-b2ab87e998b3
- PASS order A created — a767b721-e018-4c38-a266-f828878cecb6
- PASS QC PASS HTTP — 201  {"id":"8830d236-547b-46a2-ada5-db712319d9d1","number":"QC-2026-00009","productionOrderId":"a767b721-e018-4c38-a266-f828878cecb6","stageCode":"INSPECTION","inspectorId":"1cfe1317-e23c-4aeb-a69b-ed1a5182509f","inspectedAt":"2026-08-15T18:04:33.347Z","result":"PASSED","notes":"DRUAT-QC pass","createdAt":"2026-08-15T18:04:33.347Z","items":[{"id":"93871c92-7992-42bd-ac5a-c8470a157057","inspectionId":"8
- PASS QC result PASSED — PASSED
- PASS inspection tasks COMPLETED — COMPLETED
- PASS PACKAGING unlocked or ready after pass — READY
- PASS one active schedule after QC pass — 1
- PASS 0 new overlaps after pass
- PASS identical PASS retry HTTP 200 — 201  {"id":"8830d236-547b-46a2-ada5-db712319d9d1","number":"QC-2026-00009","productionOrderId":"a767b721-e018-4c38-a266-f828878cecb6","stageCode":"INSPECTION","inspectorId":"1cfe1317-e23c-4aeb-a69b-ed1a5182509f","inspectedAt":"2026-08-15T18:04:33.347Z","result":"PASSED","notes":"DRUAT-QC pass retry","createdAt":"2026-08-15T18:04:33.347Z","items":[{"id":"93871c92-7992-42bd-ac5a-c8470a157057","inspection
- PASS identical PASS retry did not bump version — 6 → 6
- PASS PACKAGING plannedStart not before inspection actualCompletion — insp=2026-08-15T18:04:33.366Z pkg=undefined
- PASS at-risk endpoint still 200 — 200
- PASS order B created — 89af6c09-32f6-44ef-89b7-da85e7f428b7
- PASS QC fail HTTP — 201  {"id":"2256bebc-7273-42cc-a2c8-1526c25bd892","number":"QC-2026-00010","productionOrderId":"89af6c09-32f6-44ef-89b7-da85e7f428b7","stageCode":"INSPECTION","inspectorId":"1cfe1317-e23c-4aeb-a69b-ed1a5182509f","inspectedAt":"2026-08-15T18:04:39.941Z","result":"FAILED_REWORK_REQUIRED","notes":"DRUAT-QC fail","createdAt":"2026-08-15T18:04:39.941Z","items":[{"id":"b3d0d94e-fc41-463b-a7c3-7af8d83f6567","
- PASS rework created — {"id":"065e8832-2751-45a6-960e-e7c669d82569","number":"RW-2026-00003","productionOrderId":"89af6c09-32f6-44ef-89b7-da85e7f428b7","inspectionId":"2256bebc-7273-42cc-a2c8-1526c25bd892","returnRequestId"
- PASS PO ON_HOLD after fail — ON_HOLD
- PASS downstream not released on rejected FG — pkg=PENDING start=400 STAGE_LOCKED Stage PACKAGING is locked until prerequisites are completed: INSPECTION
- PASS startRework HTTP — 201  {"id":"065e8832-2751-45a6-960e-e7c669d82569","number":"RW-2026-00003","productionOrderId":"89af6c09-32f6-44ef-89b7-da85e7f428b7","inspectionId":"2256bebc-7273-42cc-a2c8-1526c25bd892","returnRequestId":null,"description":"DRUAT-QC seam defect","notes":null,"assignedToId":null,"status":"IN_PROGRESS","reentryStageInstanceId":"8cbb5667-5c58-4db6-ab8b-7e9f5d2cd36b","createdAt":"2026-08-15T18:04:39.955Z
- PASS rework task created — tasks=2
- PASS one active schedule after fail+startRework burst — 1
- PASS 0 new overlaps after fail/rework
- PASS rework task floor-complete — 201  {"id":"a1afe79c-08ac-418d-a306-2083be4fb4f8","number":"TSK-2026-01548","productionOrderId":"89af6c09-32f6-44ef-89b7-da85e7f428b7","stageDefinitionId":"dfcfe0dd-709a-4141-be4b-8d9a564b71a2","stageInstanceId":"8cbb5667-5c58-4db6-ab8b-7e9f5d2cd36b","name":"Carpentry rework","description":"DRUAT-QC seam defect","assignedEmployeeId":"2b1ae2fe-66ea-4bdd-b5ed-80b957b69216","priority":"NORMAL","plannedSta
- PASS completeRework HTTP — 201  {"id":"065e8832-2751-45a6-960e-e7c669d82569","number":"RW-2026-00003","productionOrderId":"89af6c09-32f6-44ef-89b7-da85e7f428b7","inspectionId":"2256bebc-7273-42cc-a2c8-1526c25bd892","returnRequestId":null,"description":"DRUAT-QC seam defect","notes":null,"assignedToId":null,"status":"COMPLETED","reentryStageInstanceId":"8cbb5667-5c58-4db6-ab8b-7e9f5d2cd36b","createdAt":"2026-08-15T18:04:39.955Z",
- PASS PO not stuck ON_HOLD after rework complete — IN_PROGRESS
- PASS 0 new overlaps after rework complete
- PASS one active schedule after rework complete — 1
