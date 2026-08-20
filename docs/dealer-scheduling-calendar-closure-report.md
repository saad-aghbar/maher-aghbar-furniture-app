# Dealer scheduling calendar — closure report

**As of:** 2026-08-16 (Asia/Amman) · API `http://localhost:4000` · DB `maher_erp`.

This freeze fixes two dealer-only mapping bugs. Admin Scheduling, the planner, capacity, and factory dates were **not** changed.

Walkthrough talking orders: [father-demo-walkthrough.md](./father-demo-walkthrough.md).

Older snapshot: [dealer-delivery-schedule-closure-report.md](./dealer-delivery-schedule-closure-report.md) — **stale**.

---

## Scorecard

| # | Invariant | Result |
|---|---|---|
| 1 | Committed freeze: calendar stays on committed when projection slips **forward** and no truck is booked | **PASS** |
| 2 | Stale historical `earliestAvailableDate` is not dealer “current expected” | **PASS** (Jabal projected **null**) |
| 3 | Active logistics `deliveryDate` owns the dealer calendar marker | **PASS** (Balqis **19 Aug**, not 17) |
| 4 | DELAYED stays visible; updating copy when there is no trustworthy new date | **PASS** |
| 5 | Requested / expected / planned labels are not “confirmed” | **PASS** |
| 6 | `ACTION_REQUIRED` only for real dealer CTAs; factory delay is not a CTA | **PASS** |
| 7 | Dealer never sees workers, capacity, allocations, `earliestAvailableDate` field name | **PASS** |
| 8 | Isolation: `oasis` does not see Nile SOs; cannot read Balqis PO schedule | **PASS** |
| 9 | Admin Scheduling / worker / capacity / planner unchanged | **PASS** |

**Overall: PASS** · Live HTTP **38/38** (jabal / balqis / oasis / nile).

---

## Jabal date semantics (`SO-2026-00023` / `PO-2026-00022`)

Live dealer DTOs (own-deliveries, own-schedule, dealer-home) agree:

| Field | Dealer value |
|---|---|
| requested | 2026-07-28 |
| suggested (factory plan, DTO only) | 2026-07-27 |
| committed | 2026-08-10 |
| `projectedDeliveryDate` | **null** |
| planned delivery | none |
| actual | none |
| `calendarDate` | **2026-08-10** |
| `customerStatus` | `DELAYED` |
| `scheduleUpdating` | **true** |
| `requiresDealerAttention` | false |

Admin still stores `earliestAvailableDate` **2026-07-27** and `promiseState` `LATE`. That date is the original planner completion of the stored allocation plan, not a live remaining-work ETA. It is already in the past while the order is incomplete, so the dealer layer must not label it “Current expected.”

- Range `from=to=2026-08-10` includes the SO.
- Range `from=to=2026-07-27` does **not** (27 Jul is not the calendar day).
- Visible copy: **Confirmed 10 Aug** · **Delayed** · **Schedule being updated**. No “Current expected 27 Jul.”

---

## Balqis delivery calendar semantics (`SO-2026-00019` / `PO-2026-00018` / `DLV-2026-00010`)

| Field | Dealer value |
|---|---|
| requested | 2026-08-19 |
| suggested (production completion) | 2026-08-17 |
| committed | null |
| `projectedDeliveryDate` | 2026-08-17 (trustworthy, still future) |
| `plannedDeliveryDate` | **2026-08-19** (`PLANNED` logistics) |
| `calendarDate` | **2026-08-19** |
| `customerStatus` | `READY_FOR_DELIVERY` |

Suggested 17 Aug is production plan completion. `DLV-2026-00010.deliveryDate` 19 Aug is the truck appointment. The dealer calendar is a **delivery** calendar, so the marker is 19 Aug.

- Range `from=to=2026-08-19` includes the SO.
- Range `from=to=2026-08-17` does **not**.
- Visible copy: **Planned delivery 19 Aug · Not yet confirmed**. Do not headline 17 Aug as the delivery day. Detail may still show 17 Aug as production expected.

---

## What `projectedDeliveryDate` really means

On dealer DTOs it is **current expected delivery only if trustworthy**.

Source is still stored `ProductionSchedule.earliestAvailableDate` (else `suggestedDeliveryDate`). That is the planner’s original earliest completion of the **stored allocation plan**, written at generate time. It is **not** “current expected given remaining work as of today.”

Sanitization (dealer domain only):

- Incomplete order **and** projected YMD **before today** → dealer `projectedDeliveryDate` = `null`.
- Do not invent a fake date such as “today.”
- Do not replan on dealer read.
- Admin `earliestAvailableDate` and `classifyScheduleRisk` stay raw.

Forward slip (committed 19 Aug, projected 21 Aug, no logistics) stays trustworthy: projected remains 21 Aug, calendar stays 19 Aug.

---

## What `plannedDeliveryDate` really means

**New additive field.** Logistics appointment `Delivery.deliveryDate` when status is `PLANNED` | `READY` | `OUT_FOR_DELIVERY`.

It is the truck day, not production completion. `DELIVERED` uses `actualDeliveryDate` instead. A `PLANNED` row with a **null** `deliveryDate` (Admin create path) falls through — out of scope for this freeze; demo Balqis already has 19 Aug.

---

## Final dealer calendar precedence

`calendarDateForDealer`:

1. **Delivered** → actual `Delivery.deliveryDate`
2. **Active logistics** with a date → that `deliveryDate`
3. **Committed promise** (no truck booked yet) → `committedDeliveryDate`
4. **Trustworthy expected proxy** → suggested/projected only if not a past date on an incomplete order
5. **Request only** → requested, unconfirmed

Never use raw historical `earliestAvailableDate` as the calendar day. Physical delivery outranks committed for the **marker** when a planned logistics date exists. Committed remains the promise **field**.

---

## Copy samples (16 Aug)

**Jabal** — Confirmed 10 Aug · Delayed · Schedule being updated.

**Balqis** — Planned delivery 19 Aug · Not yet confirmed.

**Forward slip, no truck** (committed 19 / projected 21) — Confirmed 19 Aug · Current expected 21 Aug · May be delayed. Calendar stays on 19.

---

## Admin ↔ dealer

| | Admin | Dealer |
|---|---|---|
| Jabal earliest / projected | `earliestAvailableDate` 2026-07-27 | `projectedDeliveryDate` **null** |
| Jabal promise | `LATE` | `DELAYED` (never leaked as `LATE`) |
| Jabal calendar | factory plan history 27 Jul is visible in Admin Scheduling | **10 Aug** committed |
| Balqis earliest | 2026-08-17 | projected 17 Aug (detail); calendar **19 Aug** |
| Balqis logistics | `DLV-2026-00010` PLANNED 19 Aug | `plannedDeliveryDate` + calendar 19 Aug |

Admin Scheduling screens were not edited.

---

## Mobile ↔ portal

Same DTO fields on own-deliveries / own-schedule / dealer-home. Compact cards prefer planned date when present. Stale projected is omitted, so neither surface can print “Current expected 27 Jul.” Planned uses EN **Planned delivery** / AR **التسليم المخطط**.

---

## Remaining contradictions

None on the dealer projection layer for these two stories.

Out of scope (intentionally unchanged):

- Live remaining-work recompute (factory `forwardSchedule` / replan).
- Admin `POST /deliveries` creating `PLANNED` rows with a null `deliveryDate`.
- Seed rewrite of Jabal factory dates (the LATE story needs the stale stored plan).

---

## Tests

API (41): `dealer-delivery.test.ts`, `scheduling-dealer-delivery.test.ts`, `reports.dealer-home.spec.ts`.

Mobile (27): `selectDealerDeliveries`, `selectDealerHome`, `scheduling.i18n.test.ts`.

Live HTTP: 38/38 (Jabal + Balqis list/schedule/home + ranges + oasis isolation + leak scan).
