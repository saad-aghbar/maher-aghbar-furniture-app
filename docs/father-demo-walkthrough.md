# Father demo walkthrough

**As of:** 2026-08-16 (Asia/Amman) · password `123`

Use these **real seeded numbers** after `pnpm demo:reset`. Logins: `admin` (factory), `nile` / `oasis` / `balqis` (dealers), `carpenter` / `inspector` (floor).

**Physical inventory storyline (factory truth):** Inventory → Semi-finished shows Sweifieh / Noor (4 of 6) frames as lots tied to POs. Finished shows Balqis banquettes waiting for truck (days waiting / RESERVED). Nile delivered has FIN receipt + departure issue (0 left in factory). Oasis QC hold has no deliverable FIN. Diwan has **0** SEMI while WIP_NOT_READY. Worker finish on materials opens Confirm materials (scan is identify-only). Item report PDF includes usage / return / scrap when seeded (Sweifieh carpentry).

## Scenarios

### 1. Abdoun lounge set

**Delivered commercial history.** Admin: sales order → production snapshot → QC pass → delivery → paid invoice. Dealer `nile`: Schedule tab shows Delivered on the actual day. Worker: completed tasks. **Inventory:** historical FIN receipt then `DELIVERY_ISSUE` when the truck left — no finished lot left in factory.

- Dealer: Nile Interiors (`CUS-0101`)
- Sales order: **SO-2026-00001** (DELIVERED)
- Production: **PO-2026-00001** (COMPLETED)
- Delivery: **DLV-2026-00001** (DELIVERED, 2026-07-18)
- Invoice: **INV-2026-00001** (PAID, outstanding 0 ILS)
- Dates: requested 2026-07-18 · suggested 2026-07-18 · committed 2026-07-18 · factory earliest 2026-07-18 · planned — · actual 2026-07-18

### 2. Sweifieh sectional

**Live production + hybrid material usage.** Oasis L-sectional mid-flow (carpentry done → SEMI frames exist). Admin scheduling + worker tasks. Dealer sees committed/suggested dates, not carpentry dates. **Inventory:** SEMI lots for this PO; carpentry task has seeded expected/actual usage (equal + return/scrap on a second line).

- Dealer: Oasis Living (`CUS-0102`)
- Sales order: **SO-2026-00047** (IN_PRODUCTION)
- Production: **PO-2026-00047** (IN_PROGRESS)
- Dates: requested 2026-09-01 · suggested 2026-08-17 · committed — · factory earliest 2026-08-17 · planned — · actual —

### 3. Nile blank production start

**Just entered production — empty floor.** Sales order and PO are in production, but nothing has started: first stage READY, **0%** progress, no material issues, no WIP kits, no usage. Use Admin Orders → In production → this SO, then Production hub Materials / WIP / Tasks to see what is still missing and walk production setup yourself.

- Dealer: Nile Interiors (`CUS-0101`)
- Sales order: **SO-2026-00066** (IN_PRODUCTION)
- Production: **PO-2026-00066** (IN_PROGRESS)
- Dates: requested 2026-09-16 · suggested 2026-08-17 · committed — · factory earliest 2026-08-17 · planned — · actual —

### 4. Abdali hotel banquettes

**Ready for delivery + FIN waiting for truck.** Balqis hospitality qty 6. Admin deliveries planned; dealer Schedule calendar uses the planned logistics day, not production completion. **Inventory:** FIN lots RESERVED in finished warehouse until truck goes OUT_FOR_DELIVERY.

- Dealer: Balqis Hospitality (`CUS-0103`)
- Sales order: **SO-2026-00019** (READY_FOR_DELIVERY)
- Production: **PO-2026-00019** (READY_FOR_DELIVERY)
- Delivery: **DLV-2026-00010** (PLANNED, 2026-08-19)
- Dates: requested 2026-08-19 · suggested 2026-08-16 · committed — · factory earliest 2026-08-16 · planned 2026-08-19 · actual —

### 5. Cedar Italian velvet recliner

**Material at-risk.** Waiting for inbound Italian velvet PO. Admin may-be-late / materials. Dealer has no committed date yet — Requested / Expected · not confirmed. Factory workers and capacity stay hidden. No started floor tasks. **No FIN** — truthful material wait only.

**Warehouse scan (identify only).** Inventory → Scan → `MAT-ITAL-VEL`. Photo + 0 on hand + inbound fabric purchase PO (24 m, sequential `PORD-…`). Stop before Confirm receive — or `pnpm demo:reset` after a mutation demo.

- Dealer: Cedar House Amman (`CUS-0104`)
- Sales order: **SO-2026-00057** (WAITING_FOR_MATERIALS)
- Production: **PO-2026-00057** (WAITING_FOR_MATERIALS)
- Dates: requested 2026-09-04 · suggested 2026-09-03 · committed — · factory earliest 2026-09-03 · planned — · actual —

### 6. Diwan wingback frame gate

**WIP at-risk.** Materials prepped; carpentry frames (SEMI lots) not produced yet. Scheduling NEEDS_REVIEW with WIP_NOT_READY — matches missing SEMI, not a status-only flag. **Inventory:** 0 SEMI lots for this PO.

- Dealer: Diwan Seating (`CUS-0108`)
- Sales order: **SO-2026-00052** (IN_PRODUCTION)
- Production: **PO-2026-00052** (IN_PROGRESS)
- Dates: requested 2026-08-29 · suggested 2026-08-17 · committed — · factory earliest 2026-08-17 · planned — · actual —

### 7. Noor banquettes 4 of 6 frames

**Partial quantity.** Order qty 6; carpentry completedQty 4; SEMI lot qty 4. Remaining 2 frames still open — status never claims 6 physical frames.

- Dealer: Noor Furnishings (`CUS-0109`)
- Sales order: **SO-2026-00049** (IN_PRODUCTION)
- Production: **PO-2026-00049** (IN_PROGRESS)
- Dates: requested 2026-08-31 · suggested 2026-08-17 · committed — · factory earliest 2026-08-17 · planned — · actual —

### 8. Jabal contract dining

**Committed date vs capacity.** Approved plan cannot meet the committed delivery. Late chip from canonical classifier. Dealer calendar stays on the committed day. A past factory earliest-available date is not shown as current expected — copy is Delayed · Schedule being updated.

- Dealer: Jabal Contract (`CUS-0110`)
- Sales order: **SO-2026-00023** (IN_PRODUCTION)
- Production: **PO-2026-00023** (IN_PROGRESS)
- Dates: requested 2026-07-28 · suggested 2026-07-27 · committed 2026-08-10 · factory earliest 2026-07-27 · planned — · actual —

### 9. Oasis club armchair QC

**Current rework.** Inspection failed; rework awaiting stage; PO on hold. Must not appear delivered. **Inventory:** no deliverable FIN for this PO.

- Dealer: Oasis Living (`CUS-0102`)
- Sales order: **SO-2026-00042** (IN_PRODUCTION)
- Production: **PO-2026-00042** (ON_HOLD)
- Dates: requested 2026-08-17 · suggested 2026-08-17 · committed — · factory earliest 2026-08-17 · planned — · actual —

### 10. Nile loveseat recovered

**Historical rework.** Fail → completed rework → later pass → delivered. Partial payment.

- Dealer: Nile Interiors (`CUS-0101`)
- Sales order: **SO-2026-00006** (DELIVERED)
- Production: **PO-2026-00006** (COMPLETED)
- Delivery: **DLV-2026-00004** (DELIVERED, 2026-07-23)
- Invoice: **INV-2026-00003** (PARTIALLY_PAID, outstanding 471.053 ILS)
- Dates: requested 2026-07-24 · suggested 2026-07-23 · committed 2026-07-23 · factory earliest 2026-07-23 · planned — · actual 2026-07-23

### 11. Zaatar ottoman scuff

**Dealer return.** Delivered ottomans with an approved delivery-damage return.

- Dealer: Zaatar Home (`CUS-0105`)
- Sales order: **SO-2026-00013** (DELIVERED)
- Production: **PO-2026-00013** (COMPLETED)
- Delivery: **DLV-2026-00008** (DELIVERED, 2026-07-19)
- Invoice: **INV-2026-00006** (PAID, outstanding 0 ILS)
- Dates: requested 2026-07-19 · suggested 2026-07-19 · committed 2026-07-19 · factory earliest 2026-07-19 · planned — · actual 2026-07-19

### 12. Qasr suite dining

**Schedule awaiting approval.** Proposed plan — dealer Schedule shows Requested / Expected · not confirmed, not a fake confirmed date.

- Dealer: Qasr Suites (`CUS-0106`)
- Sales order: **SO-2026-00065** (READY_FOR_PRODUCTION)
- Production: **PO-2026-00065** (READY)
- Dates: requested 2026-09-10 · suggested 2026-09-10 · committed — · factory earliest 2026-09-10 · planned — · actual —

### 13. Noor club chair hold

**Dealer accept still pending.** Quote is SENT. Noor has not accepted — **اعتماد** (internal Approve) already happened at the factory; **قبول** (dealer Accept) has not. **No sales order** and no production.

- Quotation: **Q-2026-00066** v1 (SENT)
- RFQ: **RFQ-2026-00066**
- Sales order: **none** — dealer has not accepted (قبول) yet.

### 14. Rawnaq dining six

**Confirmed, not started.** READY_FOR_PRODUCTION with no started floor tasks.

- Dealer: Rawnaq Showroom (`CUS-0107`)
- Sales order: **SO-2026-00064** (READY_FOR_PRODUCTION)
- Production: **PO-2026-00064** (READY)
- Dates: requested 2026-09-05 · suggested 2026-09-03 · committed — · factory earliest 2026-09-03 · planned — · actual —

## Commercial quotations (اعتماد vs قبول)

Internal **Approve** (AR **اعتماد**) is a send gate only — it never writes `ACCEPTED`, never creates a sales order, and never starts production. Dealer **Accept** (AR **قبول**) is the only commercial acceptance. Admin/Sales have no Accept button and `quotation.accept` is dealer-only. Quotations live under **Orders** / Account Places / portal `/quotations` — **Schedule / الجدول is unchanged**.

- **Noor** quote **Q-2026-00066** v1 is `SENT` with **no sales order**. Log in as `noor` to Accept.
- **Oasis** revised quote **Q-2026-00074** v2 ACCEPTED by `oasis`; v1 CANCELLED; SO SO-2026-00067 (DRAFT).

## Dealer Schedule

Product: EN **Schedule** / AR **الجدول**. Mobile tab + portal `/deliveries` (Account calendar is an alias). Upcoming | Calendar. Dealers never see workers, capacity, or the factory occupancy calendar.

Same sales order must agree on Requested / Suggested / Committed / Planned delivery / Current expected / Actual and the primary `calendarDate` across Dealer Home, Schedule, order detail, Customer Portal, and Admin customer-facing schedule fields. `calendarDate` is delivered → actual; else active logistics `deliveryDate`; else committed; else a trustworthy expected proxy; else requested. **Never** a stale historical `earliestAvailableDate`, and **never** production completion when a truck is booked.

- **Nile** SO-2026-00001 — delivered chrome on the actual day (2026-07-18).
- **Balqis** SO-2026-00019 / DLV-2026-00010 — ready; planned logistics 2026-08-19. Calendar marker is the truck day, not production suggested.
- **Qasr** SO-2026-00065 — unconfirmed. Copy is Requested / Expected · not confirmed.
- **Cedar** SO-2026-00057 / **Jabal** SO-2026-00023 — Cedar is unconfirmed (no committed date). Jabal is delayed: calendar stays on committed 2026-08-10; no current expected (factory earliest available is stale); copy is Delayed · Schedule being updated.
- Isolation: `oasis` must not see Nile sales orders.
- Arabic pass: nav **الجدول**; requested labels are not **مؤكد**.
- Do not invent extra demo orders for this walkthrough.
