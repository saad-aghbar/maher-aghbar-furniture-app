# Father demo walkthrough

**As of:** 2026-08-16 (Asia/Amman) · password `123`

Use these **real seeded numbers** after `pnpm demo:reset`. Logins: `admin` (factory), `nile` / `oasis` / `balqis` (dealers), `carpenter` / `inspector` (floor).

## Scenarios

### 1. Abdoun lounge set

**Delivered commercial history.** Admin: sales order → production snapshot → QC pass → delivery → paid invoice. Dealer `nile`: Schedule tab shows Delivered on the actual day. Worker: completed tasks.

- Dealer: Nile Interiors (`CUS-0101`)
- Sales order: **SO-2026-00001** (DELIVERED)
- Production: **PO-2026-00001** (COMPLETED)
- Delivery: **DLV-2026-00001** (DELIVERED, 2026-07-18)
- Invoice: **INV-2026-00001** (PAID, outstanding 0 ILS)
- Dates: requested 2026-07-18 · suggested 2026-07-18 · committed 2026-07-18 · factory earliest 2026-07-18 · planned — · actual 2026-07-18

### 2. Sweifieh sectional

**Live production.** Oasis L-sectional mid-flow (parallel foam template). Admin scheduling + worker tasks. Dealer sees committed/suggested dates, not carpentry dates.

- Dealer: Oasis Living (`CUS-0102`)
- Sales order: **SO-2026-00047** (IN_PRODUCTION)
- Production: **PO-2026-00046** (IN_PROGRESS)
- Dates: requested 2026-09-01 · suggested 2026-08-18 · committed — · factory earliest 2026-08-18 · planned — · actual —

### 3. Abdali hotel banquettes

**Ready for delivery.** Balqis hospitality qty 6. Admin deliveries planned; dealer Schedule calendar uses the planned logistics day, not production completion.

- Dealer: Balqis Hospitality (`CUS-0103`)
- Sales order: **SO-2026-00019** (READY_FOR_DELIVERY)
- Production: **PO-2026-00018** (READY_FOR_DELIVERY)
- Delivery: **DLV-2026-00010** (PLANNED, 2026-08-19)
- Dates: requested 2026-08-19 · suggested 2026-08-17 · committed — · factory earliest 2026-08-17 · planned 2026-08-19 · actual —

### 4. Cedar Italian velvet recliner

**Material at-risk.** Waiting for inbound Italian velvet PO. Admin may-be-late / materials. Dealer has no committed date yet — Requested / Expected · not confirmed. Factory workers and capacity stay hidden. No started floor tasks.

- Dealer: Cedar House Amman (`CUS-0104`)
- Sales order: **SO-2026-00056** (WAITING_FOR_MATERIALS)
- Production: **PO-2026-00055** (WAITING_FOR_MATERIALS)
- Dates: requested 2026-09-04 · suggested 2026-09-03 · committed — · factory earliest 2026-09-03 · planned — · actual —

### 5. Diwan wingback foam gate

**WIP at-risk.** Frame done; foam/upholstery gated. Scheduling NEEDS_REVIEW with WIP_NOT_READY.

- Dealer: Diwan Seating (`CUS-0108`)
- Sales order: **SO-2026-00051** (IN_PRODUCTION)
- Production: **PO-2026-00050** (IN_PROGRESS)
- Dates: requested 2026-08-29 · suggested 2026-08-18 · committed — · factory earliest 2026-08-18 · planned — · actual —

### 6. Jabal contract dining

**Committed date vs capacity.** Approved plan cannot meet the committed delivery. Late chip from canonical classifier. Dealer calendar stays on the committed day. A past factory earliest-available date is not shown as current expected — copy is Delayed · Schedule being updated.

- Dealer: Jabal Contract (`CUS-0110`)
- Sales order: **SO-2026-00023** (IN_PRODUCTION)
- Production: **PO-2026-00022** (IN_PROGRESS)
- Dates: requested 2026-07-28 · suggested 2026-07-27 · committed 2026-08-10 · factory earliest 2026-07-27 · planned — · actual —

### 7. Oasis club armchair QC

**Current rework.** Inspection failed; rework awaiting stage; PO on hold. Must not appear delivered.

- Dealer: Oasis Living (`CUS-0102`)
- Sales order: **SO-2026-00042** (IN_PRODUCTION)
- Production: **PO-2026-00041** (ON_HOLD)
- Dates: requested 2026-08-17 · suggested 2026-08-18 · committed — · factory earliest 2026-08-18 · planned — · actual —

### 8. Nile loveseat recovered

**Historical rework.** Fail → completed rework → later pass → delivered. Partial payment.

- Dealer: Nile Interiors (`CUS-0101`)
- Sales order: **SO-2026-00006** (DELIVERED)
- Production: **PO-2026-00006** (COMPLETED)
- Delivery: **DLV-2026-00004** (DELIVERED, 2026-07-23)
- Invoice: **INV-2026-00003** (PARTIALLY_PAID, outstanding 471.053 ILS)
- Dates: requested 2026-07-24 · suggested 2026-07-23 · committed 2026-07-23 · factory earliest 2026-07-23 · planned — · actual 2026-07-23

### 9. Zaatar ottoman scuff

**Dealer return.** Delivered ottomans with an approved delivery-damage return.

- Dealer: Zaatar Home (`CUS-0105`)
- Sales order: **SO-2026-00013** (DELIVERED)
- Production: **PO-2026-00012** (COMPLETED)
- Delivery: **DLV-2026-00008** (DELIVERED, 2026-07-19)
- Invoice: **INV-2026-00006** (PAID, outstanding 0 ILS)
- Dates: requested 2026-07-19 · suggested 2026-07-19 · committed 2026-07-19 · factory earliest 2026-07-19 · planned — · actual 2026-07-19

### 10. Qasr suite dining

**Schedule awaiting approval.** Proposed plan — dealer Schedule shows Requested / Expected · not confirmed, not a fake confirmed date.

- Dealer: Qasr Suites (`CUS-0106`)
- Sales order: **SO-2026-00064** (READY_FOR_PRODUCTION)
- Production: **PO-2026-00063** (READY)
- Dates: requested 2026-09-10 · suggested 2026-09-10 · committed — · factory earliest 2026-09-10 · planned — · actual —

### 11. Noor club chair hold

**Draft sales order.** Quote sent; SO still DRAFT — no production yet.

- Dealer: Noor Furnishings (`CUS-0109`)
- Sales order: **SO-2026-00065** (DRAFT)

### 12. Rawnaq dining six

**Confirmed, not started.** READY_FOR_PRODUCTION with no started floor tasks.

- Dealer: Rawnaq Showroom (`CUS-0107`)
- Sales order: **SO-2026-00063** (READY_FOR_PRODUCTION)
- Production: **PO-2026-00062** (READY)
- Dates: requested 2026-09-05 · suggested 2026-09-03 · committed — · factory earliest 2026-09-03 · planned — · actual —

## Dealer Schedule

Product: EN **Schedule** / AR **الجدول**. Mobile tab + portal `/deliveries` (Account calendar is an alias). Upcoming | Calendar. Dealers never see workers, capacity, or the factory occupancy calendar.

Same sales order must agree on Requested / Suggested / Committed / Planned delivery / Current expected / Actual and the primary `calendarDate` across Dealer Home, Schedule, order detail, Customer Portal, and Admin customer-facing schedule fields. `calendarDate` is delivered → actual; else active logistics `deliveryDate`; else committed; else a trustworthy expected proxy; else requested. **Never** a stale historical `earliestAvailableDate`, and **never** production completion when a truck is booked.

- **Nile** SO-2026-00001 — delivered chrome on the actual day (2026-07-18).
- **Balqis** SO-2026-00019 / DLV-2026-00010 — ready; planned logistics 2026-08-19. Calendar marker is the truck day, not production suggested.
- **Qasr** SO-2026-00064 — unconfirmed. Copy is Requested / Expected · not confirmed.
- **Cedar** SO-2026-00056 / **Jabal** SO-2026-00023 — Cedar is unconfirmed (no committed date). Jabal is delayed: calendar stays on committed 2026-08-10; no current expected (factory earliest available is stale); copy is Delayed · Schedule being updated.
- Isolation: `oasis` must not see Nile sales orders.
- Arabic pass: nav **الجدول**; requested labels are not **مؤكد**.
- Do not invent extra demo orders for this walkthrough.
