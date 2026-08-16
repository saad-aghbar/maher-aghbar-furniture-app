# Material + WIP readiness live UAT

Generated: 2026-08-15T17:42:28.535Z
API: http://localhost:4000
Database: maher_erp
REAL DEV DB USED: YES
REAL API USED: YES

## Results

| MATERIAL READINESS | **PASS** | scheduler uses real incoming expectedDeliveryDate | materialReadyAt=2026-08-18T17:42:20.593Z starts=2026-08-24T11:20:00.000Z,2026-08-24T12:20:00.000Z,2026-08-24T12:47:00.000Z,2026-08-26T13:37:00.000Z,2026-08-26T14:37:00.000Z,2026-08-26T15:41:00.000Z,2026-08-29T08:08:00.000Z,2026-08-29T10:36:00.000Z,2026-08-29T11:55:00.000Z reason= |
| FUTURE READY DATE | **PASS** | allocations after PurchaseOrder.expectedDeliveryDate | materialReadyAt=2026-08-18T17:42:20.593Z starts=2026-08-24T11:20:00.000Z,2026-08-24T12:20:00.000Z,2026-08-24T12:47:00.000Z,2026-08-26T13:37:00.000Z,2026-08-26T14:37:00.000Z,2026-08-26T15:41:00.000Z,2026-08-29T08:08:00.000Z,2026-08-29T10:36:00.000Z,2026-08-29T11:55:00.000Z reason= |
| UNKNOWN DATE | **PASS** | MATERIAL_NOT_READY and no invented materialReadyAt | reason=MATERIAL_NOT_READY materialReadyAt=null |
| RESERVATIONS | **PASS** | on-hand 6, first order reserves 4, second sees free 2 < need 4 | firstReason=none secondReason=MATERIAL_NOT_READY |
| ARRIVAL AUTO-REPLAN | **PASS** | GRN enqueues REPLAN; stock now covers so materialReadyAt clears | reason=none materialReadyAt=null allocs=9 |
| WIP SAME-ORDER PRODUCER | **PASS** | Upholstery start >= Foam end; not WIP_NOT_READY while producers open | reason=none foamEnd=2026-08-29T07:00:00.000Z uphStart=2026-08-30T11:15:00.000Z |
| WIP QUANTITY | **PASS** | qty 2 still waits on same-order foam producer (lots this-PO scoped) | reason=none uph=2026-08-30T11:35:00.000Z foam=2026-08-29T08:00:00.000Z |
| WIP PARALLEL INPUTS | **PASS** | consumer waits on max(carpentry, foam) ends | uphStart=2026-08-30T11:15:00.000Z carpEnd=2026-08-26T11:01:00.000Z foamEnd=2026-08-29T07:00:00.000Z |
| WIP PRODUCER LATE REPLAN | **PASS** | task-complete REPLAN keeps consumer after remaining producers | reason=none uph=2026-08-30T11:15:00.000Z carp=2026-08-26T11:01:00.000Z |
| WIP EXISTING STOCK | **PASS** | foam lots exist so extra foam wait drops; still waits on carpentry DAG | uph=2026-08-30T11:15:00.000Z carpEnd=2026-08-26T11:01:00.000Z |
| OPTIONAL STAGE | **PASS** | skipped optional painting is not required | reason=none paintAlloc=false |
| TEST J | **PASS** | shortage + PO expectedDeliveryDate; starts after materialReadyAt | materialReadyAt=2026-08-18T17:42:20.593Z starts=2026-08-24T11:20:00.000Z,2026-08-24T12:20:00.000Z,2026-08-24T12:47:00.000Z,2026-08-26T13:37:00.000Z,2026-08-26T14:37:00.000Z,2026-08-26T15:41:00.000Z,2026-08-29T08:08:00.000Z,2026-08-29T10:36:00.000Z,2026-08-29T11:55:00.000Z reason= |
| TEST K | **PASS** | consume-by-output consumer waits on producer completion | reason=none foamEnd=2026-08-29T07:00:00.000Z uphStart=2026-08-30T11:15:00.000Z |
| NEW CONFLICTS | **PASS** | 0 new WORKER_OVERLAP / RESOURCE_OVERLAP | datedNew=0 allNew=0  |
| REAL DEV DB / API USED | **PASS** | localhost:4000 + maher_erp | http://localhost:4000 maher_erp |

Counts: **15 PASS / 0 FAIL / 0 PARTIAL**

## Steps

- PASS API health — 200
- PASS retired prior DRUAT-MWIP POs — 7
- PASS admin login — 201
- PASS nile login — 201
- PASS nile customer — a95bf2ca-2a80-4552-80c0-73f36d9e8710
- PASS UAT-SOFA-B — a648f93c-59b4-451d-98e8-4b73f0cbe42a
- PASS UAT-SOFA-C — 5e39ebb8-e063-4404-a4f3-1d11fc4430d6
- PASS RAW warehouse — 9e568a47-fb86-46b4-9881-313ae5af122b
- PASS certified supplier — 0785eb15-5db7-4bc0-91e3-b77b3075b636
- PASS unique RAW item 0 stock — 5abdb331-fbdf-471b-8abb-d00a06059540
- PASS cloned material product — 765bc460-8645-450d-9a12-8fce251fc428
- PASS create unknown-date order — 04efbb21-338b-490a-aea8-fdb026ccb86a
- PASS generate unknown-date — 201  {"productionOrder":{"id":"04efbb21-338b-490a-aea8-fdb026ccb86a","number":"PO-2026-00172","status":"IN_PROGRESS","requiredDeliveryDate":null,"committedDeliveryDate":null,"priority":"NORMAL","customerId":"a95bf2ca-2a80-4552-80c0-73f36d9e8710"},"promiseState":"AT_RISK","riskStatus":"BLOCKED","stillAtRisk":true,"schedule":{"id":"0076c90b-22a6-4c90-9504-c2ca441e9ffd","version":2,"status":"NEEDS_REVIEW"
- PASS create incoming PO — da5bf86e-7992-4dda-8491-eedbefdb8351
- PASS approve incoming PO — 201  {"id":"da5bf86e-7992-4dda-8491-eedbefdb8351","number":"PORD-2026-00003","supplierId":"0785eb15-5db7-4bc0-91e3-b77b3075b636","warehouseId":"9e568a47-fb86-46b4-9881-313ae5af122b","orderDate":"2026-08-15T17:42:20.604Z","expectedDeliveryDate":"2026-08-18T17:42:20.593Z","currency":"ILS","paymentTermsDays":30,"status":"APPROVED","subtotal":"10","taxAmount":"1.6","shippingAmount":"0","total":"11.6","note
- PASS send incoming PO — 201  {"id":"da5bf86e-7992-4dda-8491-eedbefdb8351","number":"PORD-2026-00003","supplierId":"0785eb15-5db7-4bc0-91e3-b77b3075b636","warehouseId":"9e568a47-fb86-46b4-9881-313ae5af122b","orderDate":"2026-08-15T17:42:20.604Z","expectedDeliveryDate":"2026-08-18T17:42:20.593Z","currency":"ILS","paymentTermsDays":30,"status":"SENT","subtotal":"10","taxAmount":"1.6","shippingAmount":"0","total":"11.6","notes":"
- PASS create future-ready order — e24f3cef-3233-4404-a8c6-aa1e138fd061
- PASS generate future-ready — 201  {"productionOrder":{"id":"e24f3cef-3233-4404-a8c6-aa1e138fd061","number":"PO-2026-00173","status":"IN_PROGRESS","requiredDeliveryDate":null,"committedDeliveryDate":null,"priority":"NORMAL","customerId":"a95bf2ca-2a80-4552-80c0-73f36d9e8710"},"promiseState":"AWAITING_APPROVAL","riskStatus":"AWAITING_APPROVAL","stillAtRisk":false,"schedule":{"id":"0206c614-7ace-41e4-a34a-87802cdcca4e","version":1,"s
- PASS GRN arrival — 191cad79-c8f6-4cdf-841a-32f31281b0c6
- PASS seed 6 on-hand for reservation test — 201  {"id":"682ad920-2ae4-469c-8362-90b58cfb2b3c","number":"INV-2026-00092","type":"PURCHASE_RECEIPT","inventoryItemId":"1eab030a-80ff-47a3-9ab3-21ec1208ca32","warehouseId":"9e568a47-fb86-46b4-9881-313ae5af122b","locationId":null,"quantity":"6","unitCost":null,"referenceType":null,"referenceId":null,"notes":null,"idempotencyKey":"mwip-seed-1786815743010","createdAt":"2026-08-15T17:42:23.021Z","createdB
- PASS manual inventory.receive — 201  {"id":"bd8b2269-cba6-4f6d-a322-6df83ec21d09","number":"INV-2026-00093","type":"PURCHASE_RECEIPT","inventoryItemId":"1eab030a-80ff-47a3-9ab3-21ec1208ca32","warehouseId":"9e568a47-fb86-46b4-9881-313ae5af122b","locationId":null,"quantity":"4","unitCost":null,"referenceType":null,"referenceId":null,"notes":null,"idempotencyKey":"mwip-recv-1786815744129","createdAt":"2026-08-15T17:42:24.139Z","createdB
- PASS create WIP order — 9a1ceb58-5b94-4c27-bcfa-5a52c24ef0eb
- PASS generate WIP — 201  {"productionOrder":{"id":"9a1ceb58-5b94-4c27-bcfa-5a52c24ef0eb","number":"PO-2026-00176","status":"IN_PROGRESS","requiredDeliveryDate":null,"committedDeliveryDate":null,"priority":"NORMAL","customerId":"a95bf2ca-2a80-4552-80c0-73f36d9e8710"},"promiseState":"AWAITING_APPROVAL","riskStatus":"AWAITING_APPROVAL","stillAtRisk":false,"schedule":{"id":"44b71a39-5981-4d0f-b0ba-74dd13945a3e","version":1,"s
- PASS complete foam — 201  {"id":"f094d371-7ac6-48af-b7a3-765d0e1258af","number":"TSK-2026-01511","productionOrderId":"9a1ceb58-5b94-4c27-bcfa-5a52c24ef0eb","stageDefinitionId":"63e15730-b9a0-46c3-822a-d572e3a82a25","stageInstanceId":"96f294c6-2d3c-4d06-ab72-045bfd7760c0","name":"Foam preparation","description":"Foam preparation for: DRUAT-MWIP wip-parallel UAT-SOFA-B × 1.\nFollow the shop drawing and order specifications.\
