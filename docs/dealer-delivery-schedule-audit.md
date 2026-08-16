# Dealer delivery schedule — audit

Read-only inspection **before** the customer-safe deliveries experience.
No planner, occupancy, conflict, material/WIP, or QC-replan changes in this
document. Jest is not live proof.

Live surfaces: Mobile dealer (`customer` route group), customer portal,
`GET /api/v1/scheduling/orders/:id` own-schedule, `POST /scheduling/availability`.

---

## 1. Current dealer flow

Dealer is the `customer` surface (`isCustomerIdentity` → `customerId` or
`CUSTOMER` role). Tabs in [`tabConfig.ts`](../apps/mobile/src/navigation/tabConfig.ts):

| Tab | Label | Permission |
|---|---|---|
| `index` | Home | always |
| `catalog` | Catalog | `catalog.read` |
| `orders` | Orders | `sales-order.read` |
| `account` | Account | always |
| FAB `new-order` | New Order | `request.create` (not a chip) |

There is **no** Deliveries tab. Admin Scheduling is not on this bar.
Worker/Staff bars are separate (`employeeTabs` / `adminTabs`).

Order creation: [`DeliveryAvailabilityCard`](../apps/mobile/src/features/requests/components/DeliveryAvailabilityCard.tsx)
picks `requiredDeliveryDate` via dealer `MonthCalendar` + `POST /scheduling/availability`.
Feasibility is advisory; factory schedule is generated after SO confirm.

After production exists: dealer order detail loads
`GET /scheduling/orders/:poId` (own shape) into [`OrderScheduleCard`](../apps/mobile/src/features/sales-orders/components/OrderScheduleCard.tsx).
List cards use SO `requiredDeliveryDate` as “Expected delivery” only.

## 2. Date fields today

| Surface | Requested | Suggested | Committed | Projected | Actual delivered |
|---|---|---|---|---|---|
| Orders list (mobile) | `requiredDeliveryDate` mislabeled expected | no | no | no | no |
| Order detail expected card | same SO field | no | no | no | no |
| `OrderScheduleCard` | yes | as “estimated” if no commit | yes | **no** | no |
| Production flow (dealer) | fallback | estimated label | preferred | no | no |
| New order | yes | availability earliest | no | no | n/a |
| Portal list/dashboard | none / `requiredDeliveryDate` for “nearing” | no | no | no | no |
| Portal `ProductionScheduleCard` | yes | yes (always 3 columns) | yes | **no** | unused on detail |
| Portal `/deliveries` | — | — | — | — | `deliveryDate` (page not in nav) |

`SalesOrder` has `requiredDeliveryDate` only. Committed/suggested live on
`ProductionSchedule` / PO. Schema `Delivery` has `deliveryDate` + `status`;
no `deliveredAt` — actual day is `updatedAt` when `DELIVERED`.

## 3. `getOwnOrderSchedule` today

[`scheduling.service.ts`](../apps/api/src/modules/scheduling/scheduling.service.ts) returns:

- `productionOrderId`, `number`, `promiseState`
- `requestedDeliveryDate`, `suggestedDeliveryDate`, `committedDeliveryDate`
- `canUpdateDeliveryDate`, `canRequestDateChange`, `dateChangeLocked`, `dateChangeReason`

Does **not** return: allocations, workers, capacity, `materialReadyAt`,
conflicts, `earliestAvailableDate` (admin-only), projected, actual delivery,
customer-facing status.

`promiseState` is still commercial-internal: `ESTIMATED`, `AWAITING_APPROVAL`,
`CONFIRMED`, `AT_RISK`, `LATE`, `RESCHEDULED`, `COMPLETED`. Dealers can see
`AT_RISK` as a badge today.

Latest schedule is `orderBy: { version: 'desc' }` (newest version; superseded
rows are older).

## 4. Dealer date actions (no accept/reject of factory proposal)

[`dealer-change-policy.ts`](../apps/api/src/modules/scheduling/domain/dealer-change-policy.ts):

| State | CTA | Behavior |
|---|---|---|
| Not started, not approved | Change date | Direct update of requested date; regenerate; notify **admins** |
| Not started, approved | Request date change | Audit + admin notify; does **not** rewrite commitment |
| In production / done | Locked | no mutation |

Admin `POST .../approve` is the only commit. There is **no** dealer
accept/reject of a factory-suggested date. Do not invent `[Accept date]`.

## 5. Availability preview

Already exists: `POST /scheduling/availability` (`schedule.availability.own`).
Dealer-safe: earliest / suggested / alternatives / feasibility. No workers.
Do **not** build a second scheduler. Helper text on “requested ≠ guarantee”
is missing.

## 6. Isolation gap

- `GET /sales-orders` and `GET /deliveries` lists force `user.customerId`.
- `GET /scheduling/orders/:id` own path scopes PO to customer.
- **`GET /deliveries/:id` has no `assertCustomerOwns`.** Any principal with
  `delivery.read` who knows an id can read another dealer’s delivery (includes
  `driver`). CUSTOMER role has `delivery.read`.

## 7. Portal vs mobile

Same REST APIs. Presentation diverges: portal always shows three date columns
with factory-toned `production.*` copy; mobile collapses committed vs
estimated. Portal list cards show **no** dates. `/deliveries` is built but
not in portal nav.

## 8. Notifications

| Template | Dealer? | Trigger |
|---|---|---|
| `DELIVERY_DATE_CONFIRMED` | yes | Admin approve |
| `DELIVERY_APPROACHING` | yes | Delivery READY / OUT_FOR_DELIVERY |
| `DELIVERY_DATE_UPDATED` | **seeded, never wired** | — |
| `SCHEDULE_AT_RISK` / `SCHEDULE_AWAITING_APPROVAL` | admin only | replan / generate |
| Delivered | **no dealer template on DELIVERED** | SO status update only |

Internal replans do not notify dealers (good for spam). Material customer-facing
date moves also do not notify (gap).

## 9. Cleanest surfaces to extend

- Own-schedule DTO + new `GET /scheduling/own-deliveries` (calendar precedence
  cannot come from SO `requiredDeliveryDate` alone).
- Existing Orders tab: **Orders | Calendar** modes (no 5th tab).
- `MonthCalendar variant="dealer"`, `DealerGlassCard`, `OrderScheduleCard`.
- Portal `ProductionScheduleCard` + list cards — same DTO.

## 10. What not to change

Planner, factory replan occupancy, conflicts, material/WIP, QC replan,
Admin Scheduling, Worker tasks, Staff tab composition.
