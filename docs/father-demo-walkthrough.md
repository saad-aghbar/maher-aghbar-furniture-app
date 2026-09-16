# Father demo walkthrough

**As of:** 2026-09-12 (Asia/Amman) · password `123`

Use these **real seeded numbers** after `pnpm demo:reset`. Logins: `admin` (factory), `nile` / `oasis` / `balqis` (dealers), `carpenter` / `inspector` (floor).

**Physical inventory storyline (factory truth):** Inventory → Semi-finished shows Sweifieh / Noor (4 of 6) frames as lots tied to POs. Finished shows Balqis banquettes waiting for truck (days waiting / RESERVED). Nile delivered has FIN receipt + departure issue (0 left in factory). Oasis QC hold has no deliverable FIN. Diwan has **0** SEMI while WIP_NOT_READY. Worker finish on materials opens Confirm materials (scan is identify-only). Item report PDF includes usage / return / scrap when seeded (Sweifieh carpentry).

## Scenarios

### 1. Abdoun lounge set

**Delivered commercial history.** Admin: sales order → production snapshot → QC pass → delivery → paid invoice. Dealer `nile`: Schedule tab shows Delivered on the actual day. Worker: completed tasks. **Inventory:** historical FIN receipt then `DELIVERY_ISSUE` when the truck left — no finished lot left in factory.

- Dealer: Nile Interiors (`CUS-0101`)
- Sales order: **SO-2026-00001** (DELIVERED)
- Production: **SO-2026-00001.B** (COMPLETED)
- Delivery: **DLV-2026-00001** (DELIVERED, 2026-09-06)
- Invoice: **INV-2026-00001** (PAID, outstanding 0 ILS)
- Dates: requested 2026-09-06 · suggested 2026-09-06 · committed 2026-09-06 · factory earliest 2026-09-06 · planned — · actual 2026-09-06

### 2. Sweifieh sectional

**Live production + multi-item basket.** Oasis L-sectional + ottomans + side table mid-flow. Admin scheduling + worker tasks. Dealer sees committed/suggested dates, not carpentry dates.

- Dealer: Oasis Living (`CUS-0102`)
- Sales order: **SO-2026-00008** (IN_PRODUCTION)
- Production: **SO-2026-00008.A** (IN_PROGRESS)
- Dates: requested 2026-09-23 · suggested 2026-09-12 · committed — · factory earliest 2026-09-12 · planned — · actual —

### 3. Nile blank production start

**Just entered production — empty floor.** Two-line basket; first stages READY, **0%** progress. Use Admin Orders → In production → this SO for production setup checks.

- Dealer: Nile Interiors (`CUS-0101`)
- Sales order: **SO-2026-00012** (IN_PRODUCTION)
- Production: **SO-2026-00012.A** (IN_PROGRESS)
- Dates: requested 2026-10-11 · suggested 2026-09-12 · committed — · factory earliest 2026-09-12 · planned — · actual —

### 4. Abdali hotel banquettes

**Ready for delivery + FIN waiting for truck.** Balqis hospitality banquettes + consoles. Admin deliveries planned; dealer Schedule calendar uses the planned logistics day.

- Dealer: Balqis Hospitality (`CUS-0103`)
- Sales order: **SO-2026-00003** (READY_FOR_DELIVERY)
- Production: **SO-2026-00003.A** (READY_FOR_DELIVERY)
- Delivery: **DLV-2026-00003** (PLANNED, 2026-09-13)
- Dates: requested 2026-09-13 · suggested 2026-09-12 · committed — · factory earliest 2026-09-12 · planned 2026-09-13 · actual —

### 5. Cedar Italian velvet recliner

**Material at-risk.** Waiting for inbound Italian velvet PO. Admin may-be-late / materials. Dealer has no committed date yet.

- Dealer: Cedar House Amman (`CUS-0104`)
- Sales order: **SO-2026-00010** (WAITING_FOR_MATERIALS)
- Production: **SO-2026-00010.A** (WAITING_FOR_MATERIALS)
- Dates: requested 2026-10-07 · suggested 2026-10-07 · committed — · factory earliest 2026-10-07 · planned — · actual —

### 6. Diwan wingback frame gate

**WIP at-risk.** Materials prepped; carpentry frames (SEMI lots) not produced yet. Scheduling NEEDS_REVIEW with WIP_NOT_READY.

- Dealer: Diwan Seating (`CUS-0108`)
- Sales order: **SO-2026-00009** (IN_PRODUCTION)
- Production: **SO-2026-00009.A** (IN_PROGRESS)
- Dates: requested 2026-10-04 · suggested 2026-09-12 · committed — · factory earliest 2026-09-12 · planned — · actual —

### 7. Jabal contract dining

**Committed date vs capacity.** Dining table + chairs. Approved plan cannot meet the committed delivery. Late chip from canonical classifier.

- Dealer: Jabal Contract (`CUS-0110`)
- Sales order: **SO-2026-00004** (IN_PRODUCTION)
- Production: **SO-2026-00004.B** (IN_PROGRESS)
- Dates: requested 2026-09-19 · suggested 2026-09-19 · committed 2026-09-05 · factory earliest 2026-09-19 · planned — · actual —

### 8. Oasis club armchair QC

**Current rework.** Inspection failed; rework awaiting stage; PO on hold. Must not appear delivered.

- Dealer: Oasis Living (`CUS-0102`)
- Sales order: **SO-2026-00006** (IN_PRODUCTION)
- Production: **SO-2026-00006.A** (ON_HOLD)
- Dates: requested 2026-09-27 · suggested 2026-09-12 · committed — · factory earliest 2026-09-12 · planned — · actual —

### 9. Zaatar ottoman scuff

**Dealer return.** Delivered ottomans with an approved delivery-damage return.

- Dealer: Zaatar Home (`CUS-0105`)
- Sales order: **SO-2026-00002** (DELIVERED)
- Production: **SO-2026-00002.A** (COMPLETED)
- Delivery: **DLV-2026-00002** (DELIVERED, 2026-09-12)
- Invoice: **INV-2026-00002** (PAID, outstanding 0 ILS)
- Dates: requested 2026-09-12 · suggested 2026-09-12 · committed 2026-09-12 · factory earliest 2026-09-12 · planned — · actual 2026-09-12

### 10. Qasr suite dining

**Schedule awaiting approval.** Multi-line proposed plan — dealer Schedule shows Requested / Expected · not confirmed.

- Dealer: Qasr Suites (`CUS-0106`)
- Sales order: **SO-2026-00011** (READY_FOR_PRODUCTION)
- Production: **SO-2026-00011.A** (READY)
- Dates: requested 2026-10-08 · suggested 2026-10-08 · committed — · factory earliest 2026-10-08 · planned — · actual —

### 11. Noor club chair hold

**Dealer accept still pending.** Quote is SENT (chairs + coffee table). **No sales order** and no production yet.

- Quotation: **Q-2026-00011** v1 (SENT)
- RFQ: **RFQ-2026-00011**
- Sales order: **none** — dealer has not accepted (قبول) yet.

### 12. Golden factory path

**Preparing / Production Plan.** Four manufacturing kinds on one sales order (STD, KARINA, MODIFIED width 280, CUSTOM photo). Not released — use for admin Production Plan item boards.

- Dealer: Nile Interiors (`CUS-0101`)
- Sales order: **SO-2026-00005** (READY_FOR_PRODUCTION)
- Production: **SO-2026-00005.A** (READY)
- Dates: requested 2026-09-18 · suggested 2026-09-17 · committed — · factory earliest 2026-09-17 · planned — · actual —

### 13. Golden floor lounge

**Worker My Tasks multi-item board.** Same four-line mix as Golden path, **released** with staggered sub-order progress (done / locked / open) so nested item badges and sibling view-only rows work.

- Dealer: Nile Interiors (`CUS-0101`)
- Sales order: **SO-2026-00007** (IN_PRODUCTION)
- Production: **SO-2026-00007.C** (IN_PROGRESS)
- Dates: requested 2026-09-25 · suggested 2026-09-12 · committed — · factory earliest 2026-09-12 · planned — · actual —

## Commercial quotations (اعتماد vs قبول)

Internal **Approve** (AR **اعتماد**) is a send gate only — it never writes `ACCEPTED`, never creates a sales order, and never starts production. Dealer **Accept** (AR **قبول**) is the only commercial acceptance. Admin/Sales have no Accept button and `quotation.accept` is dealer-only. Quotations live under **Orders** / Account Places / portal `/quotations` — **Schedule / الجدول is unchanged**.

- **Noor** quote **Q-2026-00011** v1 is `SENT` with **no sales order**. Log in as `noor` to Accept.
- **Oasis** revised quote **Q-2026-00020** v2 ACCEPTED by `oasis`; v1 CANCELLED; SO SO-2026-00013 (DRAFT).

## Dealer Schedule

Product: EN **Schedule** / AR **الجدول**. Mobile tab + portal `/deliveries` (Account calendar is an alias). Upcoming | Calendar. Dealers never see workers, capacity, or the factory occupancy calendar.

Same sales order must agree on Requested / Suggested / Committed / Planned delivery / Current expected / Actual and the primary `calendarDate` across Dealer Home, Schedule, order detail, Customer Portal, and Admin customer-facing schedule fields. `calendarDate` is delivered → actual; else active logistics `deliveryDate`; else committed; else a trustworthy expected proxy; else requested. **Never** a stale historical `earliestAvailableDate`, and **never** production completion when a truck is booked.

- **Nile** SO-2026-00001 — delivered chrome on the actual day (2026-09-06).
- **Balqis** SO-2026-00003 / DLV-2026-00003 — ready; planned logistics 2026-09-13. Calendar marker is the truck day, not production suggested.
- **Qasr** SO-2026-00011 — unconfirmed. Copy is Requested / Expected · not confirmed.
- **Cedar** SO-2026-00010 / **Jabal** SO-2026-00004 — Cedar is unconfirmed (no committed date). Jabal is delayed: calendar stays on committed 2026-09-05; no current expected (factory earliest available is stale); copy is Delayed · Schedule being updated.
- Isolation: `oasis` must not see Nile sales orders.
- Arabic pass: nav **الجدول**; requested labels are not **مؤكد**.
- Do not invent extra demo orders for this walkthrough.
