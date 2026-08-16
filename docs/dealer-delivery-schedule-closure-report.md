# Dealer delivery schedule — closure report

Customer-safe dealer deliveries on top of the existing scheduler. Audit:
[dealer-delivery-schedule-audit.md](./dealer-delivery-schedule-audit.md).
Live proof: [dealer-delivery-schedule-live-uat.md](./dealer-delivery-schedule-live-uat.md).

Live snapshot: **2026-08-15** `http://localhost:4000` + `maher_erp`, factory
timezone `Asia/Amman`, dealer `nile` / `123`. No seed. No live order mutation.
Planner, factory-replan occupancy, conflicts, material/WIP, QC replan, Admin
Scheduling, Worker tasks, and Staff tab composition were not changed.

Nav: still **four dealer tabs**. Orders | Calendar modes live **inside** the
existing Orders tab. Admin Scheduling is not on Dealer.

---

## 1. Current Dealer flow

Dealer is the `customer` surface (`customerId` or `CUSTOMER` role). Tabs remain
Home / Catalog / Orders / Account plus the New Order FAB.

Order creation still uses `DeliveryAvailabilityCard` + `POST /scheduling/availability`.
Requested date is a request, not a guarantee. Helper copy:

> We'll confirm the delivery date after checking production availability.

After a production order exists, detail loads `GET /scheduling/orders/:poId`
(own shape). The Orders tab now also loads `GET /scheduling/own-deliveries`
for list, summary, and calendar. Dealer date CTAs are unchanged:
Change date / Request date change / locked
([`dealer-change-policy.ts`](../apps/api/src/modules/scheduling/domain/dealer-change-policy.ts)).
Admin `POST .../approve` is the only commit. There is no dealer Accept/Reject
of a factory-proposed date.

---

## 2. Dealer-safe data contract

Mapping lives in
[`dealer-delivery.ts`](../apps/api/src/modules/scheduling/domain/dealer-delivery.ts).
`getOwnOrderSchedule` is extended additively. List/calendar is
`GET /api/v1/scheduling/own-deliveries?from=&to=` (`schedule.read.own`).
No `/dealer/*` namespace. Admin `/scheduling/calendar` is not copied.

Returned (customer-facing):

| Field | Meaning |
|---|---|
| `requestedDeliveryDate` | Schedule requested / SO `requiredDeliveryDate` |
| `suggestedDeliveryDate` | Feasible factory suggestion |
| `committedDeliveryDate` | After admin approve |
| `projectedDeliveryDate` | Calendar day of latest active schedule `earliestAvailableDate` — **never named** `earliestAvailableDate` |
| `actualDeliveryDate` | Delivery `updatedAt` date when status is `DELIVERED` (schema has no `deliveredAt`) |
| `calendarDate` | Server precedence (section 6) |
| `customerStatus` | Derived, not persisted |
| `requiresDealerAttention` | Awaiting confirmation **or** may-be-delayed **or** delayed |
| `customerSafeReason` | Default delay string or null |
| `compactDates` | Requested = suggested = committed = projected |

Not returned: allocations, workers, `materialReadyAt`, `productionReadyAt`,
conflicts, `unschedulableReason`, `earliestAvailableDate`, capacity, WIP.

Live `nile` own-deliveries: **145** rows, leak walk found **0** factory keys.
Own-schedule for a Nile PO returned `customerStatus` with no allocations.

---

## 3. Status mapping

Derived in the API (shared by mobile + portal). Never sent as `AT_RISK`,
`LATE`, `NO_ELIGIBLE_WORKER`, or `WIP_NOT_READY`.

| `customerStatus` | When |
|---|---|
| `AWAITING_CONFIRMATION` | No committed date (covers `AWAITING_APPROVAL` / `ESTIMATED`) |
| `CONFIRMED_ON_TRACK` | Committed; projection on/before committed; PO not yet in production |
| `IN_PRODUCTION` | PO in production; projection still on/before committed |
| `READY_FOR_DELIVERY` | SO/PO ready or delivery `READY` |
| `OUT_FOR_DELIVERY` | Delivery `OUT_FOR_DELIVERY` |
| `MAY_BE_DELAYED` | Committed exists; projection after committed; today still on/before committed; not delivered |
| `DELAYED` | Committed calendar day passed; not delivered |
| `DELIVERED` | Delivery completed / SO delivered |
| `CANCELLED` | Cancelled SO/PO |

Jest matrix covers compact match, infeasible uncommitted ≠ Late/At risk,
may-be-delayed calendar pinned to committed, recovery back to on track,
and fingerprint skip when only allocations would move.

Live: `AWAITING_CONFIRMATION` (SO-2026-00172), `IN_PRODUCTION`,
`READY_FOR_DELIVERY` (SO-2026-00192), `DELIVERED` (SO-2026-00195).
No live `MAY_BE_DELAYED` row (Jest covers D).

---

## 4. Requested / suggested / committed / projected semantics

Dates are **never merged** in the backend.

- Requested = dealer preference.
- Suggested = factory-feasible date while uncommitted.
- Committed = admin approve; calendar stays on this day even if projection slips.
- Projected = latest active schedule `earliestAvailableDate` as a calendar day.
- Frontend may compact when all four match (`compactDates`).

Uncommitted UI: “New date proposed” / “Awaiting confirmation” + Requested +
Earliest available. No fake `[Accept date]`.

---

## 5. Deliveries screen

Not a 5th tab. [`DealerDeliveriesHub`](../apps/mobile/src/features/sales-orders/components/DealerDeliveriesHub.tsx)
replaces the dealer Orders home (`OrdersListScreen variant="dealer"`).

Summary chips from own-deliveries: Upcoming / This week / Awaiting confirmation /
May be delayed. Live `nile`: **upcoming 48**, **thisWeek 0** (same-day rows on
2026-08-15 are `DELIVERED` and excluded), **awaitingConfirmation 9**,
**mayBeDelayed 0**.

Orders mode groups: Needs your attention / Upcoming / Later / Delivered.
Cancelled is out of Upcoming. Filters: All / Upcoming / Needs attention /
Delivered. Cards: product, SO number, compact dates, `customerStatus` chip,
one primary action (View order or existing Change/Request date). Empty:
“No upcoming deliveries” + helper. RFQs still appear in Orders mode.

Portal `/deliveries` uses the same `GET /scheduling/own-deliveries` contract
and is in portal nav.

---

## 6. Calendar

Calendar date precedence (server `calendarDate`):

1. Delivered → actual delivery date
2. Else committed → **committed** (never silently replaced by projection)
3. Else suggested
4. Else requested

If projection slipped past commitment, the row stays on the committed day and
gets `MAY_BE_DELAYED` / `DELAYED` (dot/label, not a moved day).

Mobile Calendar mode reuses `MonthCalendar variant="dealer"`. Day dots for
confirmed / proposed / attention — not color-only (`markers` on `DayMeta`).
Tap day → this dealer’s orders only. Same-day multiples are normal, not
conflicts. Live H: **2026-08-15 × 12**.

---

## 7. Order detail

Compact Delivery section on
[`OrderScheduleCard`](../apps/mobile/src/features/sales-orders/components/OrderScheduleCard.tsx)
against the new DTO: customer-safe timeline from **real** statuses only
(received → date confirmed → in production → ready → out → delivered). No
carpentry/foam/worker. No fabricated date-history trail. Compact when dates
match (“Confirmed 25 Aug · On track”). Portal
[`production-schedule-card.tsx`](../apps/customer-portal/src/components/production-schedule-card.tsx)
uses the same compact semantics and `production.dealerDelivery.*` copy.

---

## 8. Delay behavior

`MAY_BE_DELAYED` while today is still on/before the committed day.
`DELAYED` once that calendar day has passed. Default copy (EN; AR/HE in i18n):

> Production is taking longer than expected.

No internal reason codes (`NO_ELIGIBLE_WORKER`, WIP, conflicts, worker names).
`customerSafeReason` is null unless delayed.

---

## 9. Notification behavior

Fingerprint = `{ committed, suggested, projected calendar day, customerStatus, actual }`.
After generate / approve / delivery status, notify the dealer **only if** that
fingerprint changed. Allocation-only replan → no dealer notification.

| Event | Template |
|---|---|
| Admin approve | `DELIVERY_DATE_CONFIRMED` (then fingerprint notify skips duplicate UPDATED) |
| Material customer-facing date move | `DELIVERY_DATE_UPDATED` |
| May-be-delayed / delayed | `DELIVERY_MAY_BE_DELAYED` (fallback `DELIVERY_DATE_UPDATED`) |
| READY / OUT_FOR_DELIVERY | `DELIVERY_APPROACHING` (unchanged) |
| DELIVERED | `DELIVERY_COMPLETED` (fallback `DELIVERY_DATE_UPDATED`) |

`SCHEDULE_AT_RISK` is not sent to dealers. New templates are in `seed.ts`;
runtime looks up the code and falls back so live DB does not need a reseed.

---

## 10. Dealer isolation

- Own-deliveries scoped to `user.customerId` (403 without a customer account).
- Own-schedule 404 when the PO is not the caller’s (Dealer A cannot read B).
- `GET /deliveries/:id` now `assertCustomerOwns` (404) and **strips `driver`**
  for customer users.

Jest: Dealer A/B own-schedule, own-deliveries scope, deliveries/:id 404 +
driver strip.

Live: Nile `GET /scheduling/orders/:foreignPoId` → **404**. No foreign
`Delivery` row in this DB to probe `deliveries/:id` (Jest covers that path).

---

## 11. Mobile

Dealer-only. `adminTabs` / `employeeTabs` / Staff adaptive layout untouched.

- Segmented Orders | Calendar, cream/brown `DealerGlassCard`, existing chips.
- Accessibility: cards announce order number, product, confirmed date, status.
- New-order helper on the requested-date field (EN/AR/HE).
- Optional availability-before-submit stays the existing endpoint; no second
  scheduler.

---

## 12. Customer Portal

Same DTO and `customerStatus`. Compact schedule card (no three factory-toned
columns by default). Orders list/dashboard show `calendarDate` + status from
own-deliveries — not a second meaning of `requiredDeliveryDate`. Dashboard
“this week” uses `summary.thisWeek`. `/deliveries` rewired to the same
contract and added to [`portal-shell.tsx`](../apps/customer-portal/src/components/portal-shell.tsx).

---

## 13. EN / AR / HE

New strings in `packages/i18n` for all three locales:

- Statuses: `AWAITING_CONFIRMATION`, `CONFIRMED_ON_TRACK`, `MAY_BE_DELAYED`,
  `DELAYED` (natural copy; no raw enums in UI).
- `mobile.orders.*` hub/calendar/empty/compact.
- `mobile.newOrder.delivery.confirmAfterCheck`.
- `production.dealerDelivery.*` for portal + compact detail.

i18n package rebuilt; `scheduling.i18n.test.ts` key parity **pass**.

---

## 14. RTL

Reuse existing BiDi helpers. SO/PO numbers stay LTR islands. Calendar month
and weekday labels are locale-aware. Light/dark via tokens. No new
slash-bidi date formatting. Device QA of AR layout is still a manual pass
(section 16).

---

## 15. Live UAT

`pnpm smoke:dealer-delivery-uat` as `nile` / `123` against `:4000` + `maher_erp`.
**21/21 checks.** No factory lifecycle reseed.

| ID | Result | Note |
|---|---|---|
| A | PASS | No live compact `CONFIRMED_ON_TRACK`; mapping in Jest. Compact `READY_FOR_DELIVERY` exists (SO-2026-00192) |
| B | PASS | `AWAITING_CONFIRMATION` SO-2026-00172 — not LATE/AT_RISK |
| C | PASS | `IN_PRODUCTION` |
| D | SKIP | No live may-be-delayed; Jest pins calendar to committed |
| E | PASS | Recovery + fingerprint skip in Jest; no live mutation |
| F | PASS | `READY_FOR_DELIVERY` SO-2026-00192 |
| G | PASS | `DELIVERED` SO-2026-00195 with actual/calendar |
| H | PASS | 2026-08-15 × 12 — not treated as conflicts |

Regression this pass: API dealer Jest **22/22**; mobile selector + i18n **10/10**;
permissions **33/33**; API / mobile / portal typecheck; Expo Doctor **18/18**.
Scheduler domain tests were not rewritten except additive DTO helpers.

---

## 16. Remaining limitations

- No dealer Accept/Reject of factory commitment (intentional — admin approve
  is the commit).
- No fabricated date-change history (schedule version rows are not a customer
  trail).
- `DELIVERY_MAY_BE_DELAYED` / `DELIVERY_COMPLETED` exist in seed; live DB uses
  lookup + `DELIVERY_DATE_UPDATED` fallback until those rows exist.
- Live DB had no `MAY_BE_DELAYED` Nile row and no foreign `Delivery` for the
  HTTP `deliveries/:id` probe (both covered by Jest).
- Device QA (EN light + AR light on a phone) was not run in this pass —
  calendar RTL and long product names still need a device look.
- `thisWeek` uses Sunday-start weeks in factory TZ; delivered same-day orders
  do not increment Upcoming or This week.
- Availability preview remains the existing endpoint; no speculative quote
  engine.

Dealer can now answer: what is coming, what was requested, what is confirmed,
what is currently expected, whether it is on track / proposed / may be delayed /
delayed / ready / delivered, and which days have deliveries — without seeing
workers, bottlenecks, hours, WIP, materials, or factory conflicts.
