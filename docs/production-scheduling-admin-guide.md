# Production Scheduling — Admin Guide

How admins operate scheduling in the running apps.

## Where to work

| Surface | Path | Permission |
|---|---|---|
| Admin web — Scheduling | `/[locale]/production/scheduling` | `schedule.read` / `schedule.capacity.read` (actions need manage/approve) |
| Admin web — Settings (factory calendar) | `/[locale]/settings` | `schedule.settings.manage` |
| Admin web — Product detail | `/[locale]/products/[id]` production-time section | `catalog.manage` |
| Mobile admin | `(app)/(admin)/scheduling` | `schedule.read` or `schedule.capacity.read` |

Nav key: `scheduling` → `/production/scheduling`.

## Scheduling page (admin web)

Dashboard cards from `GET /scheduling/dashboard`:

- **Today** / **Week** — orders with planned work in range (`GET /scheduling/calendar`)
- **Approvals waiting** — proposed / needs-review schedules
- **Alerts** — at-risk / conflicts (`GET /scheduling/at-risk`, capacity conflicts)

Views: day / week / list. Per order you can:

1. **Approve** — `POST /scheduling/orders/:id/approve` with the schedule `version` shown on the card. Commits delivery/completion dates and notifies the dealer.
2. **Recalculate** — `POST .../recalculate` (optional `mode`: `forward` \| `backward`, `reason`). Creates a new `PROPOSED` version.
3. **Change date** (admin) — recalculate with a new target / reason as implemented on the page sheets.

Capacity strip uses `GET /scheduling/capacity?from&to`.

Mobile admin screen mirrors approvals + at-risk with the same approve / recalculate / change-date sheets (`AdminSchedulingScreen`).

## Approve checklist

1. Product has a production profile + stage estimates (or accept low-confidence / needs-review).
2. Open Scheduling → Approvals (or production order detail).
3. Review suggested vs requested dates and allocations.
4. Approve with the **current version**. If someone else recalculated, you get `SCHEDULE_STALE` — reload and approve again.
5. Promise state becomes `CONFIRMED`; PO `committedDeliveryDate` is mirrored.

Approve is allowed for `PROPOSED` and `NEEDS_REVIEW` only.

## Pin / unpin allocations

Endpoints (admin web production detail / API):

- `POST /scheduling/orders/:id/pin` / `unpin` — body identifies the allocation (`PinDto`).
- `PATCH .../allocations/:allocationId` — move windows; pinned rows are validated so the planner/validator treat moves as conflicts if the pin window changes unexpectedly.

Pinned allocations are carried into the next generate: prior pinned task windows are preferred (`isPinned` / `pinnedStart` / `pinnedEnd` on planner stages). Priority sort also places pinned work first (`sortWithFairness`).

Requires `schedule.manage`.

## Product production time

On **Products → [product]**:

- **Basic**: total/setup minutes, buffer %, scheduling enabled, minimum lead time.
- **Advanced**: per-stage estimates (`setupMinutes`, `minutesPerUnit`, `fixedMinutes`, scaling mode, batch fields, override department).

APIs:

- `GET/PATCH /scheduling/products/:id/production-profile`
- `GET/PATCH /scheduling/products/:id/stage-estimates`

`bufferPercent` (default 10) becomes planner `bufferMinutes` = percent of total stage minutes. Missing profile/estimates → `requiresAdminEstimateReview` on generated schedules and lower `estimateConfidence`.

## Calendar settings

**Settings** page → factory calendar:

- Timezone (default `Asia/Amman`)
- Working weekdays (Sun–Thu default in schema)
- Shift start/end, breaks JSON
- Exceptions: holiday / shutdown / extra shift via `POST /scheduling/calendar-settings/exceptions`

APIs: `GET/PATCH /scheduling/calendar-settings`. Requires `schedule.settings.manage`.

## Estimate learning (ops)

- `POST /scheduling/estimate-stats/recompute` — rebuilds `StageEstimateStat` from completed task actuals.
- `POST /scheduling/estimate-proposals/:id/accept` — applies a pending proposal into product stage estimates (then can regenerate schedules).

## What dealers never see

Admin calendar, capacity, worker names, department load, and allocation internals are never returned on dealer-owned schedule/availability endpoints.
