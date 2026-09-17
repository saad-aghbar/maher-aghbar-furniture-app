# Father demo walkthrough

**As of:** 2026-09-17 (Asia/Amman) · password `123`

Use these **real seeded numbers** after `pnpm demo:reset`. Logins: `admin` (factory), `nile` / `oasis` (dealers), `carpenter` / `inspector` (floor).

**Compact demo world:** nile + oasis only · Model 204 / Luna / Classic Chair / Queen bed · `SO-GOLDEN-001` · `SO-FB1042` · `RT-DEMO-001` · `PORD-DEMO-LATE` · low-stock `MAT-BEECH`.

## Scenarios

### 1. Abdoun lounge set

**Delivered commercial history.** Admin: sales order → production snapshot → QC pass → delivery → paid invoice. Dealer `nile`: Schedule tab shows Delivered on the actual day.

- Dealer: Nile Interiors (`CUS-0101`)
- Sales order: **SO-2026-00001** (DELIVERED)
- Production: **SO-2026-00001.B** (COMPLETED)
- Delivery: **DLV-2026-00001** (DELIVERED, 2026-09-10)
- Invoice: **INV-2026-00001** (PAID, outstanding 0 ILS)
- Dates: requested 2026-09-11 · suggested 2026-09-10 · committed 2026-09-10 · factory earliest 2026-09-10 · planned — · actual 2026-09-10

### 2. Sweifieh sectional

**Live production + multi-item basket.** Oasis Luna corner + chairs + bed mid-flow. Admin scheduling + worker tasks. Dealer sees committed/suggested dates, not carpentry dates.

- Dealer: Oasis Living (`CUS-0102`)
- Sales order: **SO-2026-00006** (IN_PRODUCTION)
- Production: **SO-2026-00006.A** (IN_PROGRESS)
- Dates: requested 2026-09-28 · suggested 2026-09-19 · committed — · factory earliest 2026-09-19 · planned — · actual —

### 3. Nile blank production start

**Just entered production — empty floor.** Two-line basket; first stages READY, **0%** progress. Use Admin Orders → In production → this SO for production setup checks.

- Dealer: Nile Interiors (`CUS-0101`)
- Sales order: **SO-2026-00008** (IN_PRODUCTION)
- Production: **SO-2026-00008.A** (IN_PROGRESS)
- Dates: requested 2026-10-16 · suggested 2026-09-19 · committed — · factory earliest 2026-09-19 · planned — · actual —

### 4. Golden factory path

**Released multi-kind basket (`SO-GOLDEN-001`).** Four manufacturing kinds on one sales order (STD qty2, KARINA STANDARD, MODIFIED width 280, CUSTOM photo). Staggered sub-order progress for My Tasks.

- Dealer: Nile Interiors (`CUS-0101`)
- Sales order: **SO-GOLDEN-001** (IN_PRODUCTION)
- Production: **SO-GOLDEN-001.A** (IN_PROGRESS)
- Dates: requested 2026-09-23 · suggested 2026-09-17 · committed — · factory earliest 2026-09-17 · planned — · actual —

### 5. Oasis Italian velvet sofa

**Material at-risk / may-be-late.** Waiting for inbound Italian velvet. Admin may-be-late / materials. Dealer has no committed date yet.

- Dealer: Oasis Living (`CUS-0102`)
- Sales order: **SO-2026-00007** (WAITING_FOR_MATERIALS)
- Production: **SO-2026-00007.A** (WAITING_FOR_MATERIALS)
- Dates: requested 2026-10-12 · suggested 2026-10-12 · committed — · factory earliest 2026-10-12 · planned — · actual —

### 6. Oasis club armchair QC

**Current rework.** Inspection failed; rework awaiting stage; PO on hold. Must not appear delivered.

- Dealer: Oasis Living (`CUS-0102`)
- Sales order: **SO-2026-00005** (IN_PRODUCTION)
- Production: **SO-2026-00005.A** (ON_HOLD)
- Dates: requested 2026-10-02 · suggested 2026-09-17 · committed — · factory earliest 2026-09-17 · planned — · actual —

### 7. Oasis armchair scuff

**Dealer return.** Delivered armchairs with an approved delivery-damage return.

- Dealer: Oasis Living (`CUS-0102`)
- Sales order: **SO-2026-00004** (DELIVERED)
- Production: **SO-2026-00004.A** (COMPLETED)
- Delivery: **DLV-2026-00004** (DELIVERED, 2026-09-17)
- Invoice: **INV-2026-00004** (PAID, outstanding 0 ILS)
- Dates: requested 2026-09-17 · suggested 2026-09-17 · committed 2026-09-17 · factory earliest 2026-09-17 · planned — · actual 2026-09-17

## Commercial quotations (اعتماد vs قبول)

Internal **Approve** (AR **اعتماد**) is a send gate only — it never writes `ACCEPTED`, never creates a sales order, and never starts production. Dealer **Accept** (AR **قبول**) is the only commercial acceptance. Admin/Sales have no Accept button and `quotation.accept` is dealer-only. Quotations live under **Orders** / Account Places / portal `/quotations` — **Schedule / الجدول is unchanged**.

- **Abdoun lounge set** quote **Q-2026-00001** v1 ACCEPTED by `nile`; SO SO-2026-00001 (DELIVERED).

## Dealer Schedule

Product: EN **Schedule** / AR **الجدول**. Mobile tab + portal `/deliveries` (Account calendar is an alias). Upcoming | Calendar. Dealers never see workers, capacity, or the factory occupancy calendar.

Same sales order must agree on Requested / Suggested / Committed / Planned delivery / Current expected / Actual and the primary `calendarDate` across Dealer Home, Schedule, order detail, Customer Portal, and Admin customer-facing schedule fields. `calendarDate` is delivered → actual; else active logistics `deliveryDate`; else committed; else a trustworthy expected proxy; else requested. **Never** a stale historical `earliestAvailableDate`, and **never** production completion when a truck is booked.

- **Nile** SO-2026-00001 — delivered chrome on the actual day (2026-09-10).
- **Golden** SO-GOLDEN-001 — in production with four-line STD / KARINA / MODIFIED / CUSTOM mix.
- **Oasis Italian velvet** SO-2026-00007 — material at-risk / may-be-late; requested 2026-10-12; committed —.
- Isolation: `oasis` must not see Nile sales orders.
- Arabic pass: nav **الجدول**; requested labels are not **مؤكد**.
- Do not invent extra demo orders for this walkthrough.
