# Returned-order visibility UAT

API: http://localhost:4000
Mode: **FULL**
Result: **PASS** (55/55)

## Results

- PASS 1. admin login
- PASS probe.sales-orders returned=true responds — status=200 items=13 meta.returned=13
- PASS probe.returned=true lists original sales orders (not RW/RP) — count=13 allSo=true anyHasReturn=true
- PASS probe.orderType STANDARD/MODIFIED/CUSTOM respond — std=200 mod=200 cus=200
- PASS probe.GET /sales-orders/return-work exists — status=200 code= items=15
- PASS probe.finished-lots origin=returned responds — status=200 items=0
- PASS probe.finished-lots returned includes quarantine lots or documents origin-only — items=0 quarantine=false allReturnOrigin=true
- PASS probe.finished-lots history+returned responds — status=200 items=32
- PASS probe.returned history can surface scrapped/damaged/quarantined — items=32 hasScrappedOrDamaged=true
- PASS probe.wip-kits board origin=returned responds — status=200 kits=0
- PASS probe.production-orders origin=returned responds — status=200 items=38
- PASS probe.dashboard pendingReturns present — status=200 pendingReturns=5
- PASS probe.management-summary exceptions present — status=200 open=[object Object]
- PASS probe.returned=true refresh is stable — first=13 second=13
- PASS full.nile login — status=201
- PASS full.dealer nile exists — id=0a42ba40-57aa-47f0-bbb3-db62344f8d9c
- PASS full.catalog product exists — id=c0bf46ae-a438-402e-ba68-f8f413be695e
- PASS full.finished warehouse + item exist — wh=9c0942ec-9acd-4c64-aaa6-4ca03854af10 item=ce303dae-65e8-4119-b7da-331b45ca481f
- PASS full.decide STANDARD REPAIR — status=201 code= po=RW-2026-00024
- PASS full.decide STANDARD REPLACEMENT — status=201 code= po=RC-2026-00038,RP-2026-00017
- PASS full.decide STANDARD SCRAP_RECOVERY — status=201 code= po=RC-2026-00039
- PASS full.decide MODIFIED REPAIR — status=201 code= po=RW-2026-00025
- PASS full.decide MODIFIED REPLACEMENT — status=201 code= po=RC-2026-00040,RP-2026-00018
- PASS full.decide MODIFIED SCRAP_RECOVERY — status=201 code= po=RC-2026-00041
- PASS full.decide CUSTOM REPAIR — status=201 code= po=RW-2026-00026
- PASS full.decide CUSTOM REPLACEMENT — status=201 code= po=RP-2026-00019,RC-2026-00042
- PASS full.decide CUSTOM SCRAP_RECOVERY — status=201 code= po=RC-2026-00043
- PASS full.returned-cases list 200 — status=200
- PASS full.returned-cases lists one row per return case — found=9/9
- PASS full.returned=true still lists original sales orders — found=9/9
- PASS full.returned=true refresh stable — first=22 second=22
- PASS full.returned-cases refresh stable — first=24 second=24
- PASS full.orderType=STANDARD includes each original — found=3/3
- PASS full.orderType=MODIFIED includes each original — found=3/3
- PASS full.orderType=CUSTOM includes each original — found=3/3
- PASS full.fin returned 200 — status=200
- PASS full.fin returned refresh stable — first=0 second=0
- PASS full.fin returned pageSize=1 unions to the same set — totalItems=0 walked=0 status=200
- PASS full.fin history+returned pageSize=1 unions to the same set — totalItems=9 walked=9 status=200
- PASS full.fin returned includes restocked quarantine lots — visible=0 expected=0
- PASS full.returned history includes scrapped lots — visible=0 expected=0
- PASS full.fin search by return number does not 500 — status=200 items=1
- PASS full.return-work search by return number hits — status=200 items=1
- PASS full.return-work search by original SO number hits — status=200 items=1
- PASS full.return-work pageSize=1 unions to the same set — totalItems=9 walked=9 status=200
- PASS full.production origin=returned lists work POs — status=200 found=9/9
- PASS full.production origin=returned refresh stable — first=50 second=50
- PASS full.semi returned refresh stable — status=200/200
- PASS full.returns/:id responds — status=200
- PASS full.empty customer filter returns [] not 500 — status=200 items=0
- PASS full.SALES can read return-work — status=200
- PASS full.SALES cannot list production-orders — status=403 code=FORBIDDEN
- PASS full.dealer sees only own return-work — status=200 rows=10 allOwn=true
- PASS full.dealer forbidden on finished-lots — status=403 code=FORBIDDEN
- PASS full.dashboard pendingReturns is a number — pendingReturns=5

## Manual handset checklist

No Detox/Maestro. After a REWORK or REPLACEMENT decision:

1. **Orders → Returned** — row is the RW/RP production order, not the original SO. Tap opens Production (plan if unreleased).
2. **Orders → Standard / Modified / Custom** — original SO still listed. Card shows kind chip **and** a Returned chip when `hasReturn`.
3. **Inventory FIN → Returned** — restocked quarantine lots appear as available; tap a return-work group opens lots (not an empty screen).
4. **Inventory FIN → History + Returned** — scrapped/damaged lots appear.
5. **Inventory SEMI → Returned** — return-work kits only; filter sheet Origin matches the origin bar and the badge count.
6. **Production origin bar → Returned** — same RW/RP set as Orders Returned.
7. **Admin home returns queue** — opens `/(app)/(admin)/returns`.
8. Pull-to-refresh on each list — same rows, no duplicates.

## Known gaps (not fixed here)

- No mobile UI automation; screen proof is selectors + this API replay + the checklist.
- Admin-web sales-orders page has no type facets.
- `listFinishedLots` counts in memory over a 500-row cap.
- `SalesOrderStatus.COMPLETED` is never set at runtime (only `DELIVERED`).
- `packages/types` order statuses have drifted from the Prisma enum.
