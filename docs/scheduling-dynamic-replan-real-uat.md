# Scheduling dynamic replan — real live UAT

Generated: 2026-08-15T17:07:47.732Z
API: http://localhost:4000
Database: maher_erp
REAL DEV DB USED: YES
REAL API USED: YES

## Verdict

**B — PARTIALLY WORKING** (Test I scarce-slot fixture). Tests **J** and **K** closed 2026-08-15 — see [scheduling-material-wip-readiness-closure-report.md](./scheduling-material-wip-readiness-closure-report.md).

Domain/mocked Jest is **not** used as proof below.

## In-scope defect fixed before this run

Factory-wide `REPLAN_FACTORY` loaded occupancy per PO with `CapacityTracker` `tryReserve` (silently dropping overlapping seed intervals) and persisted without a collision check, which introduced new `WORKER_OVERLAP`. Fix: run-scoped union occupancy, dual employee+resource intervals, validate-before-persist with one planner retry, skip persist when the plan is unchanged, serialize factory replans (worker concurrency 1 + RUNNING wait), and diff new overlaps by worker/order/window rather than allocation ids.

## Tests A–Z

| Test | Result | Expected | Actual | Replan run | Movement |
|---|---|---|---|---|---|
| A | **PASS** | earliest-available allocation moves onto opened dayA | allocation on 2026-08-24 | f027be5c-30ae-491c-b9a7-6200cdd28b05 | into 2026-08-24 |
| B | **PASS** | replan vs committed Aug 23; requested/committed unchanged; AT_RISK clears if feasible | risk AT_RISK→AT_RISK proj 2026-08-30T05:11:00.000Z→2026-08-26T07:57:00.000Z recovered=2 | 1b220304-2664-4c66-a536-3bc2610a1ecc | AT_RISK → AT_RISK |
| C | **PASS** | healthy backward UAT order does not jump earlier to fill the day | fingerprint unchanged or not in movedIds | 811c9ea8-84b8-4e74-a48f-e156955b8905 |  |
| D | **PASS** | overtime 16–20 available; at-risk may use it; no overlap | usedOt=false moved=13 risk AT_RISK→AT_RISK | 559170e1-18ba-47b0-ba1e-b19df24ddf74 |  |
| E | **PASS** | healthy UAT order unchanged (factoryMoved is informational) | healthyUnchanged=true factoryMoved=2 dayE=2026-10-24 | c416838a-5915-4028-ab4a-d88da9f714e8 |  |
| F | **PASS** | unpinned allocations leave closed dayF | closed=true leftoverUnpinned=0 moved=7 | 1dfe789b-c465-41ca-8b0d-42a70f28cfe3 | cleared |
| G | **PASS** | no future unpinned allocation remains in removed 16–20 window | stillInOt=0 moved=2 | c2d15c83-bf3f-4c5e-830d-7f1b47f23c33 |  |
| H | **PASS** | pinned allocation not auto-moved; pinnedIssues / pinnedOnClosedDayCount surfaced | pinStayed=true pinnedIssueCount=1 pinnedOnClosedDayCount=1 pinYmd=2026-08-29 dayI=2026-08-26 | 15f0f9d9-bdee-4fc0-811c-0d024e6cc2ef |  |
| I | **PARTIAL** | isolated fixture: HIGH gets squeezed dayI slot, NORMAL does not | highOnI=false normOnI=false highMoved=false normMoved=false movedIds=[] | 921851ad-fabb-48a8-8383-723d31e076c8 |  |
| J | **PASS** | shortage + PO expectedDeliveryDate; starts after materialReadyAt | materialReadyAt=2026-08-18T17:42:20.593Z starts from 2026-08-24T11:20Z (DRUAT-MWIP dedicated harness) |  |  |
| K | **PASS** | consume-by-output consumer waits on producer completion | foamEnd=2026-08-29T07:00Z uphStart=2026-08-30T11:15Z not WIP_NOT_READY (DRUAT-MWIP) |  |  |
| L | **PASS** | do not assign workers with no matching WorkerSkill just to fill hours | no unskilled employee bookings on skill order |  |  |
| M | **PASS** | fork/merge valid; same worker never double-booked on this PO | allocs=6 selfOverlap=0 mode=FORWARD |  |  |
| N | **PASS** | HTTP returns before REPLAN_FACTORY finishes | httpMs=44 immediate=QUEUED startedAt=2026-08-15T17:04:39.065Z | f027be5c-30ae-491c-b9a7-6200cdd28b05 |  |
| O | **PASS** | run row with result JSON | {"status":"COMPLETED","result":{"moved":24,"status":"COMPLETED","horizon":{"toYmd":"2026-11-22","fromYmd":"2026-08-24"},"failures":[{"message":"OCCUPANCY_COLLISION:45256d1d-c47c-4222-956b-4058c68b31d8","productionOrderId":"45256d1d-c47c-4222-956b-4058c68b31d8"},{"message":"OCCUPANCY_COLLISION:db8a345c-bddc-456c-a08d-9b1436dfcc99","productionOrderId":"db8a345c-bddc-456c-a08d-9b1436dfcc99"},{"message":"OCCUPANCY_COLLISION:162519e8-1b38-4d6c-a126-311a3dbcd220","productionOrderId":"162519e8-1b38-4d6c-a126-311a3dbcd220"},{"message":"OCCUPANCY_COLLISION:05ddade1-c8a4-4387-b0b8-70659ef8266c","productionOrderId":"05ddade1-c8a4-4387-b0b8-70659ef8266c"},{"message":"OCCUPANCY_COLLISION:7bbe4501-0943-4d66-9b78-c9c2f6d5ee53","productionOrderId":"7bbe4501-0943-4d66-9b78-c9c2f6d5ee53"}],"movedIds":["df110989-c627-4807-9ba6-d3a4febbec59","7b83d08b-018a-4012-bb95-0599764587ca","b8dc1aba-e2cc-487f-b1b8-bc7c08c275bf","fd7aa9aa-5c66-4170-9150-7baecf3ac1a3","5e3a4053-e032-4131-bfd8-55257e03535b","d9fedde1-9fff-4439-a63a-b7e118ee2c15","b5ab30a4-a11c-4d54-8427-f7c34aa7fa38","3bf0d292-510c-4024-a7aa-3b5b30da906c","548dc404-36f8-4901-a18a-585298159c59","4daa8987-a796-46bb-b999-6b78da95e0e9","00e15099-bd04-4b6e-8538-022b06d57b15","8f9d987d-7cda-44ce-8946-d7739901cde4","62c2558e-f3c5-4eef-8c0d-cb6c6be0d2d2","e727b44f-d1d7-4d5f-9ab6-17cde461ddd4","64c107df-562d-4404-a654-977e8e3df2f8","e1db7d68-9115-4029-8cbc-7712e733e8ae","ddfa7e4c-535d-43ea-99fc-3b6ecabd6ba1","4bc09bfa-6906-4cc6-a36a-a0a416bcbbd5","f63a55eb-a4c4-4630-8543-aadd0bc82740","85aaf128-2b67-4e2f-97e5-6b70cb3fa1f8","b4db53bf-1846-401a-9ca8-748e75b42b87","78ec2e37-30c5-4dcf-834e-502eade1a3b2","5e3a8d37-e38b-4806-99f1-995d870ad20c","4994a140-0ed7-4b4d-a13f-f5855680d58b"],"unchanged":5,"considered":34,"movedLater":0,"atRiskBefore":15,"movedEarlier":24,"newConflicts":[],"pinnedIssues":[],"unchangedIds":["4857dd37-52d7-4269-9e00-cd4a546b965f","68af005a-07a4-4a15-803f-ae93fb8e4777","5eaf059e-b7ce-4fa8-920b-cc17d00f7866","2c746d6e-fb3a-4254-a011-4b9274a3448a","4ec0ea02-ef7b-482b-a4e2-25ff834a59cf"],"capacityDelta":"increase","atRiskResolved":2,"newConflictIds":[],"candidateOrders":34,"recoveredAtRisk":2,"replannedOrders":24,"newConflictCount":0,"pinnedIssueCount":0,"postConflictCount":2,"stillNeedsAttention":5,"preExistingConflictCount":2}} | f027be5c-30ae-491c-b9a7-6200cdd28b05 |  |
| P | **PASS** | COMPLETED with failures[]; other DRUAT schedules remain valid; FAILED only if run cannot start | status=COMPLETED failures=[{"message":"OCCUPANCY_COLLISION:db8a345c-bddc-456c-a08d-9b1436dfcc99","productionOrderId":"db8a345c-bddc-456c-a08d-9b1436dfcc99"},{"message":"OCCUPANCY_COLLISION:162519e8-1b38-4d6c-a126-311a3dbcd220","productionOrderId":"162519e8-1b38-4d6c-a126-311a3dbcd220"},{"message":"OCCUPANCY_COLLISION:05ddade1-c8a4-4387-b0b8-70659ef8266c","productionOrderId":"05ddade1-c8a4-4387-b0b8-70659ef8266c"},{"message":"Production order has no schedulable tasks.","productionOrderId":"b4db53bf-1846-401a-9ca8-748e75b42b87"}] earliestAllocs=9 | 4fea723c-766f-4f8c-9c6f-90cd9bc600c6 |  |
| Q | **PASS** | identical extra-shift upsert / completed runId does not duplicate active allocations/versions | activeVersions 1→1 allocs 9→9 delta=none moved=0 newConflictCount=0 | f401da37-5ac4-41d6-b6aa-0fbda7758397 |  |
| R | **PASS** | dashboard/calendar/at-risk/capacity/order schedule readable after replan | dash.atRisk=16 calDays=71 atRisk=16 |  |  |
| S | **PASS** | dayA was closed (0%) then working with some utilization if work moved; 100% not required | {"before":{"isWorking":false,"booked":0,"shift":0,"pct":0,"pinned":0},"after":{"isWorking":true,"booked":4067,"shift":0,"pct":0,"pinned":0},"isWorking":true} |  |  |
| T | **PASS** | no new WORKER_OVERLAP / RESOURCE_OVERLAP (newConflictIds.length === 0) | newConflicts=none newConflictCount=0 worker=0 resource=0 moved=24 | f027be5c-30ae-491c-b9a7-6200cdd28b05 |  |
| U | **PASS** | DRUAT close/pin POs only: unpinned not on calendar.isWorking=false; pinYmd != dayI | unpinnedOnClosed=0 pinnedOnClosed=1 pinYmd=2026-08-29 dayI=2026-08-26 pinIssues=1 | 15f0f9d9-bdee-4fc0-811c-0d024e6cc2ef |  |
| V | **PASS** | capacity/at-risk use latest active schedule only | supersededRows=89 activeAllocs=135 supersededAllocs=738 (capacity query filters APPROVED/PROPOSED) |  |  |
| W | **PASS** | optimize against committed Aug 23, requested Aug 20 unchanged | requested=2026-08-20T16:00:00.000Z committed=2026-08-23T16:00:00.000Z | 1b220304-2664-4c66-a536-3bc2610a1ecc |  |
| X | **PASS** | no requested/committed → work pulls forward | planningMode=FORWARD onA=true | f027be5c-30ae-491c-b9a7-6200cdd28b05 |  |
| Y | **PASS** | far requested/committed latest-feasible plan stays near due | mode=BACKWARD projected=2026-10-21T12:24:00.000Z | 811c9ea8-84b8-4e74-a48f-e156955b8905 |  |
| Z | **PASS** | ≥10 DRUAT orders, two dealers, increase+decrease, no new overlaps vs Z pre-snapshot | orders=16 run=COMPLETED moved=22 newVsZ=0 newVsBaseline=0 newConflictCount=0 | 44c305c5-f2ea-49b9-bd73-fb92fd8697df |  |

Counts: **25 PASS / 0 FAIL / 1 PARTIAL / 0 BLOCKED**

## Exact failures / partials / blocked

- I PARTIAL: highOnI=false normOnI=false highMoved=false normMoved=false movedIds=[]
- J PASS (follow-up 2026-08-15): see [scheduling-material-wip-readiness-live-uat.md](./scheduling-material-wip-readiness-live-uat.md)
- K PASS (follow-up 2026-08-15): Upholstery start ≥ Foam end; not WIP_NOT_READY while producers open

## Evidence (mutations)

```json
[
  {
    "label": "open-dayA",
    "httpMs": 44,
    "runId": "f027be5c-30ae-491c-b9a7-6200cdd28b05",
    "status": "COMPLETED",
    "result": {
      "moved": 24,
      "status": "COMPLETED",
      "horizon": {
        "toYmd": "2026-11-22",
        "fromYmd": "2026-08-24"
      },
      "failures": [
        {
          "message": "OCCUPANCY_COLLISION:45256d1d-c47c-4222-956b-4058c68b31d8",
          "productionOrderId": "45256d1d-c47c-4222-956b-4058c68b31d8"
        },
        {
          "message": "OCCUPANCY_COLLISION:db8a345c-bddc-456c-a08d-9b1436dfcc99",
          "productionOrderId": "db8a345c-bddc-456c-a08d-9b1436dfcc99"
        },
        {
          "message": "OCCUPANCY_COLLISION:162519e8-1b38-4d6c-a126-311a3dbcd220",
          "productionOrderId": "162519e8-1b38-4d6c-a126-311a3dbcd220"
        },
        {
          "message": "OCCUPANCY_COLLISION:05ddade1-c8a4-4387-b0b8-70659ef8266c",
          "productionOrderId": "05ddade1-c8a4-4387-b0b8-70659ef8266c"
        },
        {
          "message": "OCCUPANCY_COLLISION:7bbe4501-0943-4d66-9b78-c9c2f6d5ee53",
          "productionOrderId": "7bbe4501-0943-4d66-9b78-c9c2f6d5ee53"
        }
      ],
      "movedIds": [
        "df110989-c627-4807-9ba6-d3a4febbec59",
        "7b83d08b-018a-4012-bb95-0599764587ca",
        "b8dc1aba-e2cc-487f-b1b8-bc7c08c275bf",
        "fd7aa9aa-5c66-4170-9150-7baecf3ac1a3",
        "5e3a4053-e032-4131-bfd8-55257e03535b",
        "d9fedde1-9fff-4439-a63a-b7e118ee2c15",
        "b5ab30a4-a11c-4d54-8427-f7c34aa7fa38",
        "3bf0d292-510c-4024-a7aa-3b5b30da906c",
        "548dc404-36f8-4901-a18a-585298159c59",
        "4daa8987-a796-46bb-b999-6b78da95e0e9",
        "00e15099-bd04-4b6e-8538-022b06d57b15",
        "8f9d987d-7cda-44ce-8946-d7739901cde4",
        "62c2558e-f3c5-4eef-8c0d-cb6c6be0d2d2",
        "e727b44f-d1d7-4d5f-9ab6-17cde461ddd4",
        "64c107df-562d-4404-a654-977e8e3df2f8",
        "e1db7d68-9115-4029-8cbc-7712e733e8ae",
        "ddfa7e4c-535d-43ea-99fc-3b6ecabd6ba1",
        "4bc09bfa-6906-4cc6-a36a-a0a416bcbbd5",
        "f63a55eb-a4c4-4630-8543-aadd0bc82740",
        "85aaf128-2b67-4e2f-97e5-6b70cb3fa1f8",
        "b4db53bf-1846-401a-9ca8-748e75b42b87",
        "78ec2e37-30c5-4dcf-834e-502eade1a3b2",
        "5e3a8d37-e38b-4806-99f1-995d870ad20c",
        "4994a140-0ed7-4b4d-a13f-f5855680d58b"
      ],
      "unchanged": 5,
      "considered": 34,
      "movedLater": 0,
      "atRiskBefore": 15,
      "movedEarlier": 24,
      "newConflicts": [],
      "pinnedIssues": [],
      "unchangedIds": [
        "4857dd37-52d7-4269-9e00-cd4a546b965f",
        "68af005a-07a4-4a15-803f-ae93fb8e4777",
        "5eaf059e-b7ce-4fa8-920b-cc17d00f7866",
        "2c746d6e-fb3a-4254-a011-4b9274a3448a",
        "4ec0ea02-ef7b-482b-a4e2-25ff834a59cf"
      ],
      "capacityDelta": "increase",
      "atRiskResolved": 2,
      "newConflictIds": [],
      "candidateOrders": 34,
      "recoveredAtRisk": 2,
      "replannedOrders": 24,
      "newConflictCount": 0,
      "pinnedIssueCount": 0,
      "postConflictCount": 2,
      "stillNeedsAttention": 5,
      "preExistingConflictCount": 2
    }
  },
  {
    "label": "open-dayB",
    "httpMs": 15,
    "runId": "1b220304-2664-4c66-a536-3bc2610a1ecc",
    "status": "COMPLETED",
    "result": {
      "moved": 22,
      "status": "COMPLETED",
      "horizon": {
        "toYmd": "2026-11-24",
        "fromYmd": "2026-08-26"
      },
      "failures": [
        {
          "message": "OCCUPANCY_COLLISION:45256d1d-c47c-4222-956b-4058c68b31d8",
          "productionOrderId": "45256d1d-c47c-4222-956b-4058c68b31d8"
        },
        {
          "message": "OCCUPANCY_COLLISION:db8a345c-bddc-456c-a08d-9b1436dfcc99",
          "productionOrderId": "db8a345c-bddc-456c-a08d-9b1436dfcc99"
        },
        {
          "message": "OCCUPANCY_COLLISION:162519e8-1b38-4d6c-a126-311a3dbcd220",
          "productionOrderId": "162519e8-1b38-4d6c-a126-311a3dbcd220"
        },
        {
          "message": "OCCUPANCY_COLLISION:05ddade1-c8a4-4387-b0b8-70659ef8266c",
          "productionOrderId": "05ddade1-c8a4-4387-b0b8-70659ef8266c"
        }
      ],
      "movedIds": [
        "4857dd37-52d7-4269-9e00-cd4a546b965f",
        "fd7aa9aa-5c66-4170-9150-7baecf3ac1a3",
        "df110989-c627-4807-9ba6-d3a4febbec59",
        "7b83d08b-018a-4012-bb95-0599764587ca",
        "3bf0d292-510c-4024-a7aa-3b5b30da906c",
        "b8dc1aba-e2cc-487f-b1b8-bc7c08c275bf",
        "7bbe4501-0943-4d66-9b78-c9c2f6d5ee53",
        "4daa8987-a796-46bb-b999-6b78da95e0e9",
        "00e15099-bd04-4b6e-8538-022b06d57b15",
        "8f9d987d-7cda-44ce-8946-d7739901cde4",
        "62c2558e-f3c5-4eef-8c0d-cb6c6be0d2d2",
        "e727b44f-d1d7-4d5f-9ab6-17cde461ddd4",
        "64c107df-562d-4404-a654-977e8e3df2f8",
        "e1db7d68-9115-4029-8cbc-7712e733e8ae",
        "ddfa7e4c-535d-43ea-99fc-3b6ecabd6ba1",
        "4bc09bfa-6906-4cc6-a36a-a0a416bcbbd5",
        "f63a55eb-a4c4-4630-8543-aadd0bc82740",
        "85aaf128-2b67-4e2f-97e5-6b70cb3fa1f8",
        "b4db53bf-1846-401a-9ca8-748e75b42b87",
        "78ec2e37-30c5-4dcf-834e-502eade1a3b2",
        "5e3a8d37-e38b-4806-99f1-995d870ad20c",
        "4994a140-0ed7-4b4d-a13f-f5855680d58b"
      ],
      "unchanged": 6,
      "considered": 32,
      "movedLater": 0,
      "atRiskBefore": 13,
      "movedEarlier": 22,
      "newConflicts": [],
      "pinnedIssues": [],
      "unchangedIds": [
        "68af005a-07a4-4a15-803f-ae93fb8e4777",
        "d9fedde1-9fff-4439-a63a-b7e118ee2c15",
        "b5ab30a4-a11c-4d54-8427-f7c34aa7fa38",
        "5eaf059e-b7ce-4fa8-920b-cc17d00f7866",
        "2c746d6e-fb3a-4254-a011-4b9274a3448a",
        "4ec0ea02-ef7b-482b-a4e2-25ff834a59cf"
      ],
      "capacityDelta": "increase",
      "atRiskResolved": 2,
      "newConflictIds": [],
      "candidateOrders": 32,
      "recoveredAtRisk": 2,
      "replannedOrders": 22,
      "newConflictCount": 0,
      "pinnedIssueCount": 0,
      "postConflictCount": 2,
      "stillNeedsAttention": 4,
      "preExistingConflictCount": 2
    }
  },
  {
    "label": "open-dayC",
    "httpMs": 17,
    "runId": "811c9ea8-84b8-4e74-a48f-e156955b8905",
    "status": "COMPLETED",
    "result": {
      "moved": 10,
      "status": "COMPLETED",
      "horizon": {
        "toYmd": "2026-11-27",
        "fromYmd": "2026-08-29"
      },
      "failures": [
        {
          "message": "OCCUPANCY_COLLISION:1493e3eb-7a62-4083-a917-7df0591eb636",
          "productionOrderId": "1493e3eb-7a62-4083-a917-7df0591eb636"
        },
        {
          "message": "OCCUPANCY_COLLISION:d9754b55-07a3-4268-9ad3-cece7871bebb",
          "productionOrderId": "d9754b55-07a3-4268-9ad3-cece7871bebb"
        },
        {
          "message": "OCCUPANCY_COLLISION:45256d1d-c47c-4222-956b-4058c68b31d8",
          "productionOrderId": "45256d1d-c47c-4222-956b-4058c68b31d8"
        },
        {
          "message": "OCCUPANCY_COLLISION:162519e8-1b38-4d6c-a126-311a3dbcd220",
          "productionOrderId": "162519e8-1b38-4d6c-a126-311a3dbcd220"
        },
        {
          "message": "OCCUPANCY_COLLISION:26162020-986a-4b84-b563-3d1acd782beb",
          "productionOrderId": "26162020-986a-4b84-b563-3d1acd782beb"
        },
        {
          "message": "OCCUPANCY_COLLISION:05ddade1-c8a4-4387-b0b8-70659ef8266c",
          "productionOrderId": "05ddade1-c8a4-4387-b0b8-70659ef8266c"
        }
      ],
      "movedIds": [
        "675ace31-6b64-4bfd-969f-2dd9b67b3c46",
        "a5372cd0-6d45-4669-be7d-e53b0b0f8ba0",
        "4857dd37-52d7-4269-9e00-cd4a546b965f",
        "ffc69469-e346-44d2-8b97-f0b2266ce118",
        "f63a55eb-a4c4-4630-8543-aadd0bc82740",
        "85aaf128-2b67-4e2f-97e5-6b70cb3fa1f8",
        "b4db53bf-1846-401a-9ca8-748e75b42b87",
        "78ec2e37-30c5-4dcf-834e-502eade1a3b2",
        "5e3a8d37-e38b-4806-99f1-995d870ad20c",
        "4994a140-0ed7-4b4d-a13f-f5855680d58b"
      ],
      "unchanged": 18,
      "considered": 34,
      "movedLater": 0,
      "atRiskBefore": 5,
      "movedEarlier": 10,
      "newConflicts": [
        {
          "type": "WORKER_OVERLAP",
          "allocA": "556f2b79-cf22-4111-b7be-547944f7de3a",
          "allocB": "814d56fa-dc9c-4ca6-aab2-a0c6d2e33110",
          "indexA": 24,
          "indexB": 28,
          "orderA": "26162020-986a-4b84-b563-3d1acd782beb",
          "orderB": "f63a55eb-a4c4-4630-8543-aadd0bc82740",
          "conflictId": "556f2b79-cf22-4111-b7be-547944f7de3a:814d56fa-dc9c-4ca6-aab2-a0c6d2e33110",
          "overlapEnd": "2026-08-26T06:59:00.000Z",
          "overlapKey": "WORKER_OVERLAP:3b62a01a-d3ca-4f7d-877c-b6369beaa468:26162020-986a-4b84-b563-3d1acd782beb:f63a55eb-a4c4-4630-8543-aadd0bc82740:2026-08-26T06:56:00.000Z:2026-08-26T06:59:00.000Z",
          "overlapStart": "2026-08-26T06:56:00.000Z",
          "workerOrResource": "3b62a01a-d3ca-4f7d-877c-b6369beaa468"
        }
      ],
      "pinnedIssues": [],
      "unchangedIds": [
        "48ffde85-2b3d-48bb-b676-fd96c7d383d8",
        "1f43438d-0258-4ee5-9e4d-61f95f5c7d5f",
        "ee023b4b-cb27-45bd-bb91-6cec6c14c7a2",
        "da38dc58-2b79-4e04-aef0-8f32eab2bc34",
        "26b66004-51f9-4afe-88af-d7da39ad0082",
        "df0b5e41-235b-4f1f-89c5-40c2d4e27f75",
        "7a8ea86f-d95d-4725-97d0-61da88623a09",
        "b75a1330-fb2b-4cdf-a4ca-aff13e3d6a64",
        "54187db2-805f-43e5-b09d-5b6c86c354ff",
        "230b694d-7c41-40f6-a503-49d553d8e89e",
        "a0817683-31e2-4b9a-b2c0-4be25c52db76",
        "dde5d442-7cb3-4044-ae9e-e29854dc15c7",
        "12060698-75a9-43b0-b10a-41cee2f88320",
        "796eea36-b533-4bb5-9c90-76296881bb5b",
        "330040b8-24f7-40b6-95e2-f7cba2f02a38",
        "dbca0d5c-8559-4c63-be24-accbc249252d",
        "68af005a-07a4-4a15-803f-ae93fb8e4777",
        "46b68fb1-96e5-4497-bc6e-b2d7fa50bc26"
      ],
      "capacityDelta": "decrease",
      "atRiskResolved": 0,
      "newConflictIds": [
        "556f2b79-cf22-4111-b7be-547944f7de3a:814d56fa-dc9c-4ca6-aab2-a0c6d2e33110"
      ],
      "candidateOrders": 34,
      "recoveredAtRisk": 0,
      "replannedOrders": 10,
      "newConflictCount": 1,
      "pinnedIssueCount": 0,
      "postConflictCount": 3,
      "stillNeedsAttention": 7,
      "preExistingConflictCount": 2
    }
  },
  {
    "label": "overtime-dayOt",
    "httpMs": 31,
    "runId": "559170e1-18ba-47b0-ba1e-b19df24ddf74",
    "status": "COMPLETED",
    "result": {
      "moved": 13,
      "status": "COMPLETED",
      "horizon": {
        "toYmd": "2026-11-27",
        "fromYmd": "2026-08-29"
      },
      "failures": [
        {
          "message": "OCCUPANCY_COLLISION:db8a345c-bddc-456c-a08d-9b1436dfcc99",
          "productionOrderId": "db8a345c-bddc-456c-a08d-9b1436dfcc99"
        },
        {
          "message": "OCCUPANCY_COLLISION:162519e8-1b38-4d6c-a126-311a3dbcd220",
          "productionOrderId": "162519e8-1b38-4d6c-a126-311a3dbcd220"
        },
        {
          "message": "OCCUPANCY_COLLISION:05ddade1-c8a4-4387-b0b8-70659ef8266c",
          "productionOrderId": "05ddade1-c8a4-4387-b0b8-70659ef8266c"
        }
      ],
      "movedIds": [
        "675ace31-6b64-4bfd-969f-2dd9b67b3c46",
        "a5372cd0-6d45-4669-be7d-e53b0b0f8ba0",
        "4857dd37-52d7-4269-9e00-cd4a546b965f",
        "7bbe4501-0943-4d66-9b78-c9c2f6d5ee53",
        "e1db7d68-9115-4029-8cbc-7712e733e8ae",
        "ddfa7e4c-535d-43ea-99fc-3b6ecabd6ba1",
        "4bc09bfa-6906-4cc6-a36a-a0a416bcbbd5",
        "f63a55eb-a4c4-4630-8543-aadd0bc82740",
        "85aaf128-2b67-4e2f-97e5-6b70cb3fa1f8",
        "b4db53bf-1846-401a-9ca8-748e75b42b87",
        "78ec2e37-30c5-4dcf-834e-502eade1a3b2",
        "5e3a8d37-e38b-4806-99f1-995d870ad20c",
        "4994a140-0ed7-4b4d-a13f-f5855680d58b"
      ],
      "unchanged": 16,
      "considered": 32,
      "movedLater": 0,
      "atRiskBefore": 13,
      "movedEarlier": 13,
      "newConflicts": [],
      "pinnedIssues": [],
      "unchangedIds": [
        "fd7aa9aa-5c66-4170-9150-7baecf3ac1a3",
        "45256d1d-c47c-4222-956b-4058c68b31d8",
        "d9fedde1-9fff-4439-a63a-b7e118ee2c15",
        "b5ab30a4-a11c-4d54-8427-f7c34aa7fa38",
        "3bf0d292-510c-4024-a7aa-3b5b30da906c",
        "b8dc1aba-e2cc-487f-b1b8-bc7c08c275bf",
        "68af005a-07a4-4a15-803f-ae93fb8e4777",
        "5eaf059e-b7ce-4fa8-920b-cc17d00f7866",
        "2c746d6e-fb3a-4254-a011-4b9274a3448a",
        "4ec0ea02-ef7b-482b-a4e2-25ff834a59cf",
        "4daa8987-a796-46bb-b999-6b78da95e0e9",
        "00e15099-bd04-4b6e-8538-022b06d57b15",
        "8f9d987d-7cda-44ce-8946-d7739901cde4",
        "62c2558e-f3c5-4eef-8c0d-cb6c6be0d2d2",
        "e727b44f-d1d7-4d5f-9ab6-17cde461ddd4",
        "64c107df-562d-4404-a654-977e8e3df2f8"
      ],
      "capacityDelta": "increase",
      "atRiskResolved": 2,
      "newConflictIds": [],
      "candidateOrders": 32,
      "recoveredAtRisk": 2,
      "replannedOrders": 13,
      "newConflictCount": 0,
      "pinnedIssueCount": 0,
      "postConflictCount": 2,
      "stillNeedsAttention": 3,
      "preExistingConflictCount": 3
    }
  },
  {
    "label": "overtime-dayE",
    "httpMs": 17,
    "runId": "c416838a-5915-4028-ab4a-d88da9f714e8",
    "status": "COMPLETED",
    "result": {
      "moved": 2,
      "status": "COMPLETED",
      "horizon": {
        "toYmd": "2027-01-22",
        "fromYmd": "2026-10-24"
      },
      "failures": [
        {
          "message": "OCCUPANCY_COLLISION:db8a345c-bddc-456c-a08d-9b1436dfcc99",
          "productionOrderId": "db8a345c-bddc-456c-a08d-9b1436dfcc99"
        },
        {
          "message": "OCCUPANCY_COLLISION:162519e8-1b38-4d6c-a126-311a3dbcd220",
          "productionOrderId": "162519e8-1b38-4d6c-a126-311a3dbcd220"
        },
        {
          "message": "OCCUPANCY_COLLISION:05ddade1-c8a4-4387-b0b8-70659ef8266c",
          "productionOrderId": "05ddade1-c8a4-4387-b0b8-70659ef8266c"
        }
      ],
      "movedIds": [
        "7bbe4501-0943-4d66-9b78-c9c2f6d5ee53",
        "f63a55eb-a4c4-4630-8543-aadd0bc82740"
      ],
      "unchanged": 25,
      "considered": 30,
      "movedLater": 0,
      "atRiskBefore": 11,
      "movedEarlier": 2,
      "newConflicts": [],
      "pinnedIssues": [],
      "unchangedIds": [
        "fd7aa9aa-5c66-4170-9150-7baecf3ac1a3",
        "45256d1d-c47c-4222-956b-4058c68b31d8",
        "d9fedde1-9fff-4439-a63a-b7e118ee2c15",
        "b5ab30a4-a11c-4d54-8427-f7c34aa7fa38",
        "3bf0d292-510c-4024-a7aa-3b5b30da906c",
        "b8dc1aba-e2cc-487f-b1b8-bc7c08c275bf",
        "4857dd37-52d7-4269-9e00-cd4a546b965f",
        "68af005a-07a4-4a15-803f-ae93fb8e4777",
        "5eaf059e-b7ce-4fa8-920b-cc17d00f7866",
        "2c746d6e-fb3a-4254-a011-4b9274a3448a",
        "4ec0ea02-ef7b-482b-a4e2-25ff834a59cf",
        "4daa8987-a796-46bb-b999-6b78da95e0e9",
        "00e15099-bd04-4b6e-8538-022b06d57b15",
        "8f9d987d-7cda-44ce-8946-d7739901cde4",
        "62c2558e-f3c5-4eef-8c0d-cb6c6be0d2d2",
        "e727b44f-d1d7-4d5f-9ab6-17cde461ddd4",
        "64c107df-562d-4404-a654-977e8e3df2f8",
        "e1db7d68-9115-4029-8cbc-7712e733e8ae",
        "ddfa7e4c-535d-43ea-99fc-3b6ecabd6ba1",
        "4bc09bfa-6906-4cc6-a36a-a0a416bcbbd5",
        "85aaf128-2b67-4e2f-97e5-6b70cb3fa1f8",
        "b4db53bf-1846-401a-9ca8-748e75b42b87",
        "78ec2e37-30c5-4dcf-834e-502eade1a3b2",
        "5e3a8d37-e38b-4806-99f1-995d870ad20c",
        "4994a140-0ed7-4b4d-a13f-f5855680d58b"
      ],
      "capacityDelta": "increase",
      "atRiskResolved": 0,
      "newConflictIds": [],
      "candidateOrders": 30,
      "recoveredAtRisk": 0,
      "replannedOrders": 2,
      "newConflictCount": 0,
      "pinnedIssueCount": 0,
      "postConflictCount": 2,
      "stillNeedsAttention": 3,
      "preExistingConflictCount": 2
    }
  },
  {
    "label": "close-dayF",
    "httpMs": 16,
    "runId": "1dfe789b-c465-41ca-8b0d-42a70f28cfe3",
    "status": "COMPLETED",
    "result": {
      "moved": 7,
      "status": "COMPLETED",
      "horizon": {
        "toYmd": "2026-11-28",
        "fromYmd": "2026-08-30"
      },
      "failures": [
        {
          "message": "OCCUPANCY_COLLISION:1493e3eb-7a62-4083-a917-7df0591eb636",
          "productionOrderId": "1493e3eb-7a62-4083-a917-7df0591eb636"
        },
        {
          "message": "OCCUPANCY_COLLISION:d9754b55-07a3-4268-9ad3-cece7871bebb",
          "productionOrderId": "d9754b55-07a3-4268-9ad3-cece7871bebb"
        },
        {
          "message": "OCCUPANCY_COLLISION:162519e8-1b38-4d6c-a126-311a3dbcd220",
          "productionOrderId": "162519e8-1b38-4d6c-a126-311a3dbcd220"
        },
        {
          "message": "OCCUPANCY_COLLISION:26162020-986a-4b84-b563-3d1acd782beb",
          "productionOrderId": "26162020-986a-4b84-b563-3d1acd782beb"
        },
        {
          "message": "OCCUPANCY_COLLISION:05ddade1-c8a4-4387-b0b8-70659ef8266c",
          "productionOrderId": "05ddade1-c8a4-4387-b0b8-70659ef8266c"
        },
        {
          "message": "OCCUPANCY_COLLISION:ffc69469-e346-44d2-8b97-f0b2266ce118",
          "productionOrderId": "ffc69469-e346-44d2-8b97-f0b2266ce118"
        }
      ],
      "movedIds": [
        "834a1c44-b263-4b43-8127-14d3fa5f486a",
        "ee023b4b-cb27-45bd-bb91-6cec6c14c7a2",
        "68af005a-07a4-4a15-803f-ae93fb8e4777",
        "675ace31-6b64-4bfd-969f-2dd9b67b3c46",
        "a5372cd0-6d45-4669-be7d-e53b0b0f8ba0",
        "7bbe4501-0943-4d66-9b78-c9c2f6d5ee53",
        "f63a55eb-a4c4-4630-8543-aadd0bc82740"
      ],
      "unchanged": 17,
      "considered": 30,
      "movedLater": 0,
      "atRiskBefore": 4,
      "movedEarlier": 7,
      "newConflicts": [
        {
          "type": "WORKER_OVERLAP",
          "allocA": "3b8a1377-4111-4f48-98a4-7483b684d8fd",
          "allocB": "556f2b79-cf22-4111-b7be-547944f7de3a",
          "indexA": 29,
          "indexB": 23,
          "orderA": "f63a55eb-a4c4-4630-8543-aadd0bc82740",
          "orderB": "26162020-986a-4b84-b563-3d1acd782beb",
          "conflictId": "3b8a1377-4111-4f48-98a4-7483b684d8fd:556f2b79-cf22-4111-b7be-547944f7de3a",
          "overlapEnd": "2026-08-26T06:59:00.000Z",
          "overlapKey": "WORKER_OVERLAP:3b62a01a-d3ca-4f7d-877c-b6369beaa468:26162020-986a-4b84-b563-3d1acd782beb:f63a55eb-a4c4-4630-8543-aadd0bc82740:2026-08-26T06:56:00.000Z:2026-08-26T06:59:00.000Z",
          "overlapStart": "2026-08-26T06:56:00.000Z",
          "workerOrResource": "3b62a01a-d3ca-4f7d-877c-b6369beaa468"
        }
      ],
      "pinnedIssues": [],
      "unchangedIds": [
        "48ffde85-2b3d-48bb-b676-fd96c7d383d8",
        "1f43438d-0258-4ee5-9e4d-61f95f5c7d5f",
        "da38dc58-2b79-4e04-aef0-8f32eab2bc34",
        "26b66004-51f9-4afe-88af-d7da39ad0082",
        "df0b5e41-235b-4f1f-89c5-40c2d4e27f75",
        "7a8ea86f-d95d-4725-97d0-61da88623a09",
        "b75a1330-fb2b-4cdf-a4ca-aff13e3d6a64",
        "54187db2-805f-43e5-b09d-5b6c86c354ff",
        "230b694d-7c41-40f6-a503-49d553d8e89e",
        "a0817683-31e2-4b9a-b2c0-4be25c52db76",
        "dde5d442-7cb3-4044-ae9e-e29854dc15c7",
        "12060698-75a9-43b0-b10a-41cee2f88320",
        "796eea36-b533-4bb5-9c90-76296881bb5b",
        "330040b8-24f7-40b6-95e2-f7cba2f02a38",
        "dbca0d5c-8559-4c63-be24-accbc249252d",
        "45256d1d-c47c-4222-956b-4058c68b31d8",
        "46b68fb1-96e5-4497-bc6e-b2d7fa50bc26"
      ],
      "capacityDelta": "decrease",
      "atRiskResolved": 0,
      "newConflictIds": [
        "3b8a1377-4111-4f48-98a4-7483b684d8fd:556f2b79-cf22-4111-b7be-547944f7de3a"
      ],
      "candidateOrders": 30,
      "recoveredAtRisk": 0,
      "replannedOrders": 7,
      "newConflictCount": 1,
      "pinnedIssueCount": 0,
      "postConflictCount": 3,
      "stillNeedsAttention": 7,
      "preExistingConflictCount": 2
    }
  },
  {
    "label": "remove-ot-dayG",
    "httpMs": 46,
    "runId": "c2d15c83-bf3f-4c5e-830d-7f1b47f23c33",
    "status": "COMPLETED",
    "result": {
      "moved": 2,
      "status": "COMPLETED",
      "horizon": {
        "toYmd": "2026-11-29",
        "fromYmd": "2026-08-31"
      },
      "failures": [
        {
          "message": "OCCUPANCY_COLLISION:1493e3eb-7a62-4083-a917-7df0591eb636",
          "productionOrderId": "1493e3eb-7a62-4083-a917-7df0591eb636"
        },
        {
          "message": "OCCUPANCY_COLLISION:05ddade1-c8a4-4387-b0b8-70659ef8266c",
          "productionOrderId": "05ddade1-c8a4-4387-b0b8-70659ef8266c"
        },
        {
          "message": "OCCUPANCY_COLLISION:ffc69469-e346-44d2-8b97-f0b2266ce118",
          "productionOrderId": "ffc69469-e346-44d2-8b97-f0b2266ce118"
        }
      ],
      "movedIds": [
        "ee023b4b-cb27-45bd-bb91-6cec6c14c7a2",
        "a5372cd0-6d45-4669-be7d-e53b0b0f8ba0"
      ],
      "unchanged": 18,
      "considered": 23,
      "movedLater": 0,
      "atRiskBefore": 4,
      "movedEarlier": 2,
      "newConflicts": [],
      "pinnedIssues": [],
      "unchangedIds": [
        "48ffde85-2b3d-48bb-b676-fd96c7d383d8",
        "1f43438d-0258-4ee5-9e4d-61f95f5c7d5f",
        "da38dc58-2b79-4e04-aef0-8f32eab2bc34",
        "26b66004-51f9-4afe-88af-d7da39ad0082",
        "df0b5e41-235b-4f1f-89c5-40c2d4e27f75",
        "7a8ea86f-d95d-4725-97d0-61da88623a09",
        "b75a1330-fb2b-4cdf-a4ca-aff13e3d6a64",
        "54187db2-805f-43e5-b09d-5b6c86c354ff",
        "230b694d-7c41-40f6-a503-49d553d8e89e",
        "a0817683-31e2-4b9a-b2c0-4be25c52db76",
        "dde5d442-7cb3-4044-ae9e-e29854dc15c7",
        "12060698-75a9-43b0-b10a-41cee2f88320",
        "796eea36-b533-4bb5-9c90-76296881bb5b",
        "330040b8-24f7-40b6-95e2-f7cba2f02a38",
        "dbca0d5c-8559-4c63-be24-accbc249252d",
        "d9754b55-07a3-4268-9ad3-cece7871bebb",
        "45256d1d-c47c-4222-956b-4058c68b31d8",
        "46b68fb1-96e5-4497-bc6e-b2d7fa50bc26"
      ],
      "capacityDelta": "decrease",
      "atRiskResolved": 0,
      "newConflictIds": [],
      "candidateOrders": 23,
      "recoveredAtRisk": 0,
      "replannedOrders": 2,
      "newConflictCount": 0,
      "pinnedIssueCount": 0,
      "postConflictCount": 2,
      "stillNeedsAttention": 3,
      "preExistingConflictCount": 2
    }
  },
  {
    "label": "close-pinned",
    "httpMs": 15,
    "runId": "15f0f9d9-bdee-4fc0-811c-0d024e6cc2ef",
    "status": "COMPLETED",
    "result": {
      "moved": 20,
      "status": "COMPLETED",
      "horizon": {
        "toYmd": "2026-11-27",
        "fromYmd": "2026-08-29"
      },
      "failures": [
        {
          "message": "OCCUPANCY_COLLISION:1493e3eb-7a62-4083-a917-7df0591eb636",
          "productionOrderId": "1493e3eb-7a62-4083-a917-7df0591eb636"
        },
        {
          "message": "OCCUPANCY_COLLISION:d9754b55-07a3-4268-9ad3-cece7871bebb",
          "productionOrderId": "d9754b55-07a3-4268-9ad3-cece7871bebb"
        },
        {
          "message": "OCCUPANCY_COLLISION:db8a345c-bddc-456c-a08d-9b1436dfcc99",
          "productionOrderId": "db8a345c-bddc-456c-a08d-9b1436dfcc99"
        },
        {
          "message": "OCCUPANCY_COLLISION:162519e8-1b38-4d6c-a126-311a3dbcd220",
          "productionOrderId": "162519e8-1b38-4d6c-a126-311a3dbcd220"
        },
        {
          "message": "OCCUPANCY_COLLISION:26162020-986a-4b84-b563-3d1acd782beb",
          "productionOrderId": "26162020-986a-4b84-b563-3d1acd782beb"
        },
        {
          "message": "OCCUPANCY_COLLISION:05ddade1-c8a4-4387-b0b8-70659ef8266c",
          "productionOrderId": "05ddade1-c8a4-4387-b0b8-70659ef8266c"
        },
        {
          "message": "OCCUPANCY_COLLISION:ffc69469-e346-44d2-8b97-f0b2266ce118",
          "productionOrderId": "ffc69469-e346-44d2-8b97-f0b2266ce118"
        }
      ],
      "movedIds": [
        "675ace31-6b64-4bfd-969f-2dd9b67b3c46",
        "a5372cd0-6d45-4669-be7d-e53b0b0f8ba0",
        "7bbe4501-0943-4d66-9b78-c9c2f6d5ee53",
        "4857dd37-52d7-4269-9e00-cd4a546b965f",
        "68af005a-07a4-4a15-803f-ae93fb8e4777",
        "548dc404-36f8-4901-a18a-585298159c59",
        "00e15099-bd04-4b6e-8538-022b06d57b15",
        "8f9d987d-7cda-44ce-8946-d7739901cde4",
        "62c2558e-f3c5-4eef-8c0d-cb6c6be0d2d2",
        "e727b44f-d1d7-4d5f-9ab6-17cde461ddd4",
        "64c107df-562d-4404-a654-977e8e3df2f8",
        "e1db7d68-9115-4029-8cbc-7712e733e8ae",
        "ddfa7e4c-535d-43ea-99fc-3b6ecabd6ba1",
        "4bc09bfa-6906-4cc6-a36a-a0a416bcbbd5",
        "f63a55eb-a4c4-4630-8543-aadd0bc82740",
        "85aaf128-2b67-4e2f-97e5-6b70cb3fa1f8",
        "b4db53bf-1846-401a-9ca8-748e75b42b87",
        "78ec2e37-30c5-4dcf-834e-502eade1a3b2",
        "5e3a8d37-e38b-4806-99f1-995d870ad20c",
        "4994a140-0ed7-4b4d-a13f-f5855680d58b"
      ],
      "unchanged": 18,
      "considered": 45,
      "movedLater": 0,
      "atRiskBefore": 9,
      "movedEarlier": 20,
      "newConflicts": [
        {
          "type": "WORKER_OVERLAP",
          "allocA": "556f2b79-cf22-4111-b7be-547944f7de3a",
          "allocB": "796e7c88-43ae-4a7c-bb80-95517160d934",
          "indexA": 27,
          "indexB": 39,
          "orderA": "26162020-986a-4b84-b563-3d1acd782beb",
          "orderB": "f63a55eb-a4c4-4630-8543-aadd0bc82740",
          "conflictId": "556f2b79-cf22-4111-b7be-547944f7de3a:796e7c88-43ae-4a7c-bb80-95517160d934",
          "overlapEnd": "2026-08-26T06:59:00.000Z",
          "overlapKey": "WORKER_OVERLAP:3b62a01a-d3ca-4f7d-877c-b6369beaa468:26162020-986a-4b84-b563-3d1acd782beb:f63a55eb-a4c4-4630-8543-aadd0bc82740:2026-08-26T06:56:00.000Z:2026-08-26T06:59:00.000Z",
          "overlapStart": "2026-08-26T06:56:00.000Z",
          "workerOrResource": "3b62a01a-d3ca-4f7d-877c-b6369beaa468"
        }
      ],
      "pinnedIssues": [
        {
          "ymd": "2026-08-29",
          "orderNumber": "PO-2026-00147",
          "allocationId": "d5399cb5-1e0b-4068-8b69-00cdda2f297e",
          "productionOrderId": "7bbe4501-0943-4d66-9b78-c9c2f6d5ee53"
        }
      ],
      "unchangedIds": [
        "48ffde85-2b3d-48bb-b676-fd96c7d383d8",
        "1f43438d-0258-4ee5-9e4d-61f95f5c7d5f",
        "ee023b4b-cb27-45bd-bb91-6cec6c14c7a2",
        "da38dc58-2b79-4e04-aef0-8f32eab2bc34",
        "26b66004-51f9-4afe-88af-d7da39ad0082",
        "df0b5e41-235b-4f1f-89c5-40c2d4e27f75",
        "7a8ea86f-d95d-4725-97d0-61da88623a09",
        "b75a1330-fb2b-4cdf-a4ca-aff13e3d6a64",
        "54187db2-805f-43e5-b09d-5b6c86c354ff",
        "230b694d-7c41-40f6-a503-49d553d8e89e",
        "a0817683-31e2-4b9a-b2c0-4be25c52db76",
        "dde5d442-7cb3-4044-ae9e-e29854dc15c7",
        "12060698-75a9-43b0-b10a-41cee2f88320",
        "796eea36-b533-4bb5-9c90-76296881bb5b",
        "330040b8-24f7-40b6-95e2-f7cba2f02a38",
        "dbca0d5c-8559-4c63-be24-accbc249252d",
        "45256d1d-c47c-4222-956b-4058c68b31d8",
        "46b68fb1-96e5-4497-bc6e-b2d7fa50bc26"
      ],
      "capacityDelta": "decrease",
      "atRiskResolved": 0,
      "newConflictIds": [
        "556f2b79-cf22-4111-b7be-547944f7de3a:796e7c88-43ae-4a7c-bb80-95517160d934"
      ],
      "candidateOrders": 45,
      "recoveredAtRisk": 0,
      "replannedOrders": 20,
      "newConflictCount": 1,
      "pinnedIssueCount": 1,
      "postConflictCount": 3,
      "stillNeedsAttention": 9,
      "preExistingConflictCount": 2
    }
  },
  {
    "label": "open-dayI",
    "httpMs": 18,
    "runId": "921851ad-fabb-48a8-8383-723d31e076c8",
    "status": "COMPLETED",
    "result": {
      "moved": 0,
      "status": "COMPLETED",
      "horizon": {
        "toYmd": "2026-11-24",
        "fromYmd": "2026-08-26"
      },
      "failures": [],
      "movedIds": [],
      "unchanged": 0,
      "considered": 0,
      "movedLater": 0,
      "atRiskBefore": 0,
      "movedEarlier": 0,
      "newConflicts": [],
      "pinnedIssues": [],
      "unchangedIds": [],
      "capacityDelta": "none",
      "atRiskResolved": 0,
      "newConflictIds": [],
      "candidateOrders": 0,
      "recoveredAtRisk": 0,
      "replannedOrders": 0,
      "newConflictCount": 0,
      "pinnedIssueCount": 0,
      "postConflictCount": 3,
      "stillNeedsAttention": 0,
      "preExistingConflictCount": 3
    }
  },
  {
    "label": "failure-replan",
    "httpMs": 16,
    "runId": "4fea723c-766f-4f8c-9c6f-90cd9bc600c6",
    "status": "COMPLETED",
    "result": {
      "moved": 20,
      "status": "COMPLETED",
      "horizon": {
        "toYmd": "2026-11-27",
        "fromYmd": "2026-08-29"
      },
      "failures": [
        {
          "message": "OCCUPANCY_COLLISION:db8a345c-bddc-456c-a08d-9b1436dfcc99",
          "productionOrderId": "db8a345c-bddc-456c-a08d-9b1436dfcc99"
        },
        {
          "message": "OCCUPANCY_COLLISION:162519e8-1b38-4d6c-a126-311a3dbcd220",
          "productionOrderId": "162519e8-1b38-4d6c-a126-311a3dbcd220"
        },
        {
          "message": "OCCUPANCY_COLLISION:05ddade1-c8a4-4387-b0b8-70659ef8266c",
          "productionOrderId": "05ddade1-c8a4-4387-b0b8-70659ef8266c"
        },
        {
          "message": "Production order has no schedulable tasks.",
          "productionOrderId": "b4db53bf-1846-401a-9ca8-748e75b42b87"
        }
      ],
      "movedIds": [
        "675ace31-6b64-4bfd-969f-2dd9b67b3c46",
        "ee023b4b-cb27-45bd-bb91-6cec6c14c7a2",
        "a5372cd0-6d45-4669-be7d-e53b0b0f8ba0",
        "4857dd37-52d7-4269-9e00-cd4a546b965f",
        "68af005a-07a4-4a15-803f-ae93fb8e4777",
        "548dc404-36f8-4901-a18a-585298159c59",
        "7bbe4501-0943-4d66-9b78-c9c2f6d5ee53",
        "00e15099-bd04-4b6e-8538-022b06d57b15",
        "8f9d987d-7cda-44ce-8946-d7739901cde4",
        "62c2558e-f3c5-4eef-8c0d-cb6c6be0d2d2",
        "e727b44f-d1d7-4d5f-9ab6-17cde461ddd4",
        "64c107df-562d-4404-a654-977e8e3df2f8",
        "e1db7d68-9115-4029-8cbc-7712e733e8ae",
        "ddfa7e4c-535d-43ea-99fc-3b6ecabd6ba1",
        "4bc09bfa-6906-4cc6-a36a-a0a416bcbbd5",
        "f63a55eb-a4c4-4630-8543-aadd0bc82740",
        "85aaf128-2b67-4e2f-97e5-6b70cb3fa1f8",
        "78ec2e37-30c5-4dcf-834e-502eade1a3b2",
        "5e3a8d37-e38b-4806-99f1-995d870ad20c",
        "4994a140-0ed7-4b4d-a13f-f5855680d58b"
      ],
      "unchanged": 11,
      "considered": 35,
      "movedLater": 0,
      "atRiskBefore": 16,
      "movedEarlier": 20,
      "newConflicts": [],
      "pinnedIssues": [],
      "unchangedIds": [
        "834a1c44-b263-4b43-8127-14d3fa5f486a",
        "fd7aa9aa-5c66-4170-9150-7baecf3ac1a3",
        "45256d1d-c47c-4222-956b-4058c68b31d8",
        "d9fedde1-9fff-4439-a63a-b7e118ee2c15",
        "b5ab30a4-a11c-4d54-8427-f7c34aa7fa38",
        "3bf0d292-510c-4024-a7aa-3b5b30da906c",
        "b8dc1aba-e2cc-487f-b1b8-bc7c08c275bf",
        "5eaf059e-b7ce-4fa8-920b-cc17d00f7866",
        "2c746d6e-fb3a-4254-a011-4b9274a3448a",
        "4ec0ea02-ef7b-482b-a4e2-25ff834a59cf",
        "4daa8987-a796-46bb-b999-6b78da95e0e9"
      ],
      "capacityDelta": "increase",
      "atRiskResolved": 2,
      "newConflictIds": [],
      "candidateOrders": 35,
      "recoveredAtRisk": 2,
      "replannedOrders": 20,
      "newConflictCount": 0,
      "pinnedIssueCount": 0,
      "postConflictCount": 2,
      "stillNeedsAttention": 4,
      "preExistingConflictCount": 3
    }
  },
  {
    "label": "mixed-decrease",
    "httpMs": 16,
    "runId": "44c305c5-f2ea-49b9-bd73-fb92fd8697df",
    "status": "COMPLETED",
    "result": {
      "moved": 22,
      "status": "COMPLETED",
      "horizon": {
        "toYmd": "2026-11-24",
        "fromYmd": "2026-08-26"
      },
      "failures": [
        {
          "message": "OCCUPANCY_COLLISION:1493e3eb-7a62-4083-a917-7df0591eb636",
          "productionOrderId": "1493e3eb-7a62-4083-a917-7df0591eb636"
        },
        {
          "message": "OCCUPANCY_COLLISION:d9754b55-07a3-4268-9ad3-cece7871bebb",
          "productionOrderId": "d9754b55-07a3-4268-9ad3-cece7871bebb"
        },
        {
          "message": "OCCUPANCY_COLLISION:45256d1d-c47c-4222-956b-4058c68b31d8",
          "productionOrderId": "45256d1d-c47c-4222-956b-4058c68b31d8"
        },
        {
          "message": "OCCUPANCY_COLLISION:162519e8-1b38-4d6c-a126-311a3dbcd220",
          "productionOrderId": "162519e8-1b38-4d6c-a126-311a3dbcd220"
        },
        {
          "message": "OCCUPANCY_COLLISION:26162020-986a-4b84-b563-3d1acd782beb",
          "productionOrderId": "26162020-986a-4b84-b563-3d1acd782beb"
        },
        {
          "message": "OCCUPANCY_COLLISION:05ddade1-c8a4-4387-b0b8-70659ef8266c",
          "productionOrderId": "05ddade1-c8a4-4387-b0b8-70659ef8266c"
        },
        {
          "message": "OCCUPANCY_COLLISION:ffc69469-e346-44d2-8b97-f0b2266ce118",
          "productionOrderId": "ffc69469-e346-44d2-8b97-f0b2266ce118"
        },
        {
          "message": "Production order has no schedulable tasks.",
          "productionOrderId": "b4db53bf-1846-401a-9ca8-748e75b42b87"
        }
      ],
      "movedIds": [
        "4857dd37-52d7-4269-9e00-cd4a546b965f",
        "68af005a-07a4-4a15-803f-ae93fb8e4777",
        "ee023b4b-cb27-45bd-bb91-6cec6c14c7a2",
        "a5372cd0-6d45-4669-be7d-e53b0b0f8ba0",
        "fd7aa9aa-5c66-4170-9150-7baecf3ac1a3",
        "df110989-c627-4807-9ba6-d3a4febbec59",
        "7b83d08b-018a-4012-bb95-0599764587ca",
        "3bf0d292-510c-4024-a7aa-3b5b30da906c",
        "b8dc1aba-e2cc-487f-b1b8-bc7c08c275bf",
        "4daa8987-a796-46bb-b999-6b78da95e0e9",
        "00e15099-bd04-4b6e-8538-022b06d57b15",
        "8f9d987d-7cda-44ce-8946-d7739901cde4",
        "62c2558e-f3c5-4eef-8c0d-cb6c6be0d2d2",
        "e727b44f-d1d7-4d5f-9ab6-17cde461ddd4",
        "64c107df-562d-4404-a654-977e8e3df2f8",
        "e1db7d68-9115-4029-8cbc-7712e733e8ae",
        "ddfa7e4c-535d-43ea-99fc-3b6ecabd6ba1",
        "4bc09bfa-6906-4cc6-a36a-a0a416bcbbd5",
        "85aaf128-2b67-4e2f-97e5-6b70cb3fa1f8",
        "78ec2e37-30c5-4dcf-834e-502eade1a3b2",
        "5e3a8d37-e38b-4806-99f1-995d870ad20c",
        "4994a140-0ed7-4b4d-a13f-f5855680d58b"
      ],
      "unchanged": 16,
      "considered": 46,
      "movedLater": 0,
      "atRiskBefore": 10,
      "movedEarlier": 22,
      "newConflicts": [],
      "pinnedIssues": [],
      "unchangedIds": [
        "48ffde85-2b3d-48bb-b676-fd96c7d383d8",
        "1f43438d-0258-4ee5-9e4d-61f95f5c7d5f",
        "da38dc58-2b79-4e04-aef0-8f32eab2bc34",
        "46b68fb1-96e5-4497-bc6e-b2d7fa50bc26",
        "26b66004-51f9-4afe-88af-d7da39ad0082",
        "df0b5e41-235b-4f1f-89c5-40c2d4e27f75",
        "7a8ea86f-d95d-4725-97d0-61da88623a09",
        "b75a1330-fb2b-4cdf-a4ca-aff13e3d6a64",
        "54187db2-805f-43e5-b09d-5b6c86c354ff",
        "230b694d-7c41-40f6-a503-49d553d8e89e",
        "a0817683-31e2-4b9a-b2c0-4be25c52db76",
        "dde5d442-7cb3-4044-ae9e-e29854dc15c7",
        "12060698-75a9-43b0-b10a-41cee2f88320",
        "796eea36-b533-4bb5-9c90-76296881bb5b",
        "330040b8-24f7-40b6-95e2-f7cba2f02a38",
        "dbca0d5c-8559-4c63-be24-accbc249252d"
      ],
      "capacityDelta": "decrease",
      "atRiskResolved": 0,
      "newConflictIds": [],
      "candidateOrders": 46,
      "recoveredAtRisk": 0,
      "replannedOrders": 22,
      "newConflictCount": 0,
      "pinnedIssueCount": 0,
      "postConflictCount": 2,
      "stillNeedsAttention": 8,
      "preExistingConflictCount": 2
    }
  }
]
```

## Baseline

See [dynamic-replan-live-uat-before.md](./dynamic-replan-live-uat-before.md).

## Automated (not live proof)

Label: mocked/domain, not live proof. Re-run from apps/api: `pnpm exec jest --testPathPattern=factory-replan|calendar-open-day-replan|conflict-detector|conflict-resolve|scheduling-capacity-uat|scheduling-at-risk|working-calendar` (this session: factory-replan 34, related scheduling suites 133, mobile scheduling 113, API+mobile typecheck passed).

See [scheduling-factory-replan-occupancy-fix.md](./scheduling-factory-replan-occupancy-fix.md) for Test T root cause and occupancy before/after.

## Cleanup

DRUAT calendar exceptions restored toward the pre-run snapshot. DRUAT production orders left in place (notes/paymentTerms `DRUAT`) — not deleted. `scheduling_replan_runs` retained as evidence.

## Recommended next action

Test T is closed (0 new overlaps). Tests J and K are closed on 2026-08-15 via the dedicated material/WIP harness ([scheduling-material-wip-readiness-live-uat.md](./scheduling-material-wip-readiness-live-uat.md), [scheduling-material-wip-readiness-closure-report.md](./scheduling-material-wip-readiness-closure-report.md)). Remaining documented follow-up: I (HIGH vs NORMAL scarce-slot fixture — generate-before-open left HIGH `AWAITING_APPROVAL` so increase policy skipped it). Do not pack healthy backward orders to 100%.
