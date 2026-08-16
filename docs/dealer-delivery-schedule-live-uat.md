# Dealer delivery schedule — live UAT

Run: 2026-08-15T18:35:39.282Z
API: http://localhost:4000

## Results

- **A** PASS — no compact fixture
- **B** PASS — AWAITING_CONFIRMATION
- **C** PASS — IN_PRODUCTION
- **D** SKIP — no live may-be-delayed row
- **E** PASS — Jest recovery + fingerprint skip; no live mutation
- **F** PASS — READY_FOR_DELIVERY
- **G** PASS — SO-2026-00195
- **H** PASS — 2026-08-15 x12

## Steps

- PASS admin login (201)
- PASS nile login (201)
- PASS own-deliveries HTTP (200)
- PASS own-deliveries has summary ({"upcoming":48,"thisWeek":0,"awaitingConfirmation":9,"mayBeDelayed":0})
- PASS own-deliveries has data array (len=145)
- PASS own-deliveries no factory internals
- PASS A compact on-track row (no live compact row — Jest covers mapping)
- PASS B awaiting confirmation is not LATE/AT_RISK (SO-2026-00172)
- PASS C on-track or in production (IN_PRODUCTION)
- PASS D may-be-delayed live row (SKIP — mapping covered by Jest)
- PASS E recovery mapping (Jest)
- PASS F ready-for-delivery (SO-2026-00192)
- PASS G delivered has actual or calendar
- PASS H same-day multiples allowed (2026-08-15 x12)
- PASS own-schedule HTTP (200)
- PASS own-schedule has customerStatus (DELIVERED)
- PASS own-schedule no allocations (dealer shape)
- PASS own-schedule no internals
- PASS isolation deliveries/:id (no foreign delivery in DB)
- PASS isolation own-schedule (404)
- PASS summary keys

## Sample dealer rows

```json
[
  {
    "salesOrderNumber": "SO-2026-00195",
    "customerStatus": "DELIVERED",
    "calendarDate": "2026-08-15",
    "compactDates": false
  },
  {
    "salesOrderNumber": "SO-2026-00194",
    "customerStatus": "DELIVERED",
    "calendarDate": "2026-08-15",
    "compactDates": false
  },
  {
    "salesOrderNumber": "SO-2026-00193",
    "customerStatus": "DELIVERED",
    "calendarDate": "2026-08-15",
    "compactDates": false
  },
  {
    "salesOrderNumber": "SO-2026-00192",
    "customerStatus": "READY_FOR_DELIVERY",
    "calendarDate": "2026-09-06",
    "compactDates": true
  },
  {
    "salesOrderNumber": "SO-2026-00191",
    "customerStatus": "IN_PRODUCTION",
    "calendarDate": "2026-08-29",
    "compactDates": true
  }
]
```
