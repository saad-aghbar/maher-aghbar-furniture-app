# Production Scheduling — Dealer Guide

Dealer-facing behavior in customer portal and mobile. Internals (workers, capacity, departments) are never shown.

## Picking a delivery date (new order / quotation)

1. Choose catalog product + quantity.
2. Optionally enter a preferred delivery date (`YYYY-MM-DD` / date input).
3. UI calls `POST /scheduling/availability` (`schedule.availability.own`).

Response (dealer-safe):

- `earliestAvailableDate`
- `requestedDateFeasible` (when a preferred date was sent)
- `suggestedDeliveryDate`
- `alternativeDates` (quick picks)
- `estimateStatus` / confidence / “preliminary” hints when estimates are incomplete

Surfaces:

- Customer portal: `AvailabilityCard` on new order and quotation request
- Mobile: `DeliveryAvailabilityCard` on the New Order delivery step

Submit sends preferred date as `requiredDeliveryDate` on the request. Feasibility is advisory at order time; the factory schedule is generated when the sales order is confirmed into production.

## Seeing promise state (order detail)

After a production order exists, dealers call `GET /scheduling/orders/:productionOrderId` with `schedule.read.own`. The service returns the **own** schedule shape (no allocations):

| Promise state | Meaning |
|---|---|
| `ESTIMATED` | Draft / provisional / cancelled lens — not a commitment |
| `AWAITING_APPROVAL` | Factory proposed a plan; admin has not approved |
| `CONFIRMED` | Admin approved; committed delivery date is the promise |
| `AT_RISK` | Material risk, needs review, or explicit risk flag |
| `RESCHEDULED` | Previously committed plan was moved |
| `COMPLETED` | Production order completed |

UI cards:

- Portal: `ProductionScheduleCard` on order detail (per production order)
- Mobile: `OrderScheduleCard` + promise badge on dealer order detail / progress map

Dealer home prefers `committedDeliveryDate` over the original requested date when present.

## Change request rules

`POST /scheduling/orders/:id/dealer-date` (`schedule.request-change.own`). Policy from `resolveDealerChangePolicy`:

| Factory state | CTA | Behavior |
|---|---|---|
| Not approved + PO not started (`DRAFT`/`PLANNED`/`WAITING_FOR_MATERIALS`/`READY`) | **Change date** | Direct update of preferred date; schedule regenerated as a new proposal; admins notified |
| Approved promise (`CONFIRMED`/`AT_RISK`/`RESCHEDULED`) + not started | **Request date change** | Creates a change request for admin re-approval — does not silently rewrite the commitment |
| In production / completed / cancelled | Hidden / locked | No dealer date mutation |

UI derives CTA from `canUpdateDirect` / `canChangeRequest` / `locked` on the own-schedule payload (`selectChangeDateCta` on mobile).

## Permissions

`CUSTOMER` role includes:

- `schedule.availability.own`
- `schedule.read.own`
- `schedule.request-change.own`

Workers have no `schedule.*` permissions; they only see planned start/completion on their tasks.
