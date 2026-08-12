# Mobile scheduling UX (Expo app)

Adds the production-scheduling module's dealer-safe availability checks, admin approvals/at-risk dashboard, and worker "planned" labels to the Expo app (`apps/mobile`), reusing each role's existing visual language (dealer glass/commerce, admin parchment, worker `employeeIndustrial`). No new visual language, no factory-calendar UI, no Gantt chart.

## API client

### Added

- `apps/mobile/src/api/modules/scheduling.ts` — new API module, following the `apiGet`/`apiPost` patterns in `sales-orders.ts`:
  - `postAvailability(body)` → `POST /scheduling/availability` (dealer-safe: earliest date, feasibility, alternatives; never exposes stage/worker internals)
  - `getOrderSchedule(productionOrderId)` → `GET /scheduling/orders/:id`; returns either the admin shape (`ProductionScheduleDetail`, with allocations) or the dealer-safe shape (`OwnOrderSchedule`), disambiguated at runtime by `isOwnOrderSchedule()`
  - `approveSchedule(productionOrderId, { version, idempotencyKey })` → `POST /scheduling/orders/:id/approve`
  - `recalculateSchedule(productionOrderId, { mode?, reason? })` → `POST /scheduling/orders/:id/recalculate`
  - `dealerDateChange(productionOrderId, { requestedDeliveryDate, reason?, idempotencyKey? })` → `POST /scheduling/orders/:id/dealer-date`
  - `getDashboard()` → `GET /scheduling/dashboard`
  - `getAtRisk()` → `GET /scheduling/at-risk`
  - `getCalendar({ from, to, view? })` → `GET /scheduling/calendar`
- `apps/mobile/src/features/scheduling/query.ts` — new React Query hooks wrapping the module above: `useAvailabilityQuery`, `useOrderScheduleQuery`, `useSchedulingDashboardQuery`, `useAtRiskQuery`, `useSchedulingCalendarQuery`, `useDealerDateChangeMutation`, `useApproveScheduleMutation`, `useRecalculateScheduleMutation`. All mutations invalidate via a new `invalidateKeys.afterScheduleMutation(productionOrderId?)` helper (schedule, order lists, production lists, dealer/admin home reports).

### Changed

- `apps/mobile/src/api/index.ts` — re-exports the new module as `schedulingApi`.
- `apps/mobile/src/api/queryKeys.ts` — added `queryKeys.scheduling.{all,availability,orderSchedule,dashboard,atRisk,calendar}` and `invalidateKeys.afterScheduleMutation`.
- `apps/mobile/src/api/modules/requests.ts` — `CreateRequestInput` gained optional `requiredDeliveryDate` (ISO date).
- `apps/mobile/src/api/modules/sales-orders.ts` — `SalesOrderDetail` gained optional `committedDeliveryDate` and `promiseState`.
- `apps/mobile/src/api/modules/production.ts` — `ProductionOrderListItem` gained optional `committedDeliveryDate`/`promiseState`; `ProductionTask` (base of `ProductionDetail`) gained optional `plannedStart`.
- `apps/mobile/src/api/modules/tasks.ts` — `TaskListItem` gained optional `plannedStart`; `TaskTimingSummary` gained optional `plannedStart`.
- `apps/mobile/src/api/modules/reports.ts` — `AdminHomeRecentOrder` and `DealerHomeOrder` gained optional `committedDeliveryDate`; `WorkerHomeTask.timing` gained optional `plannedStart`.
- `apps/mobile/src/components/badges/badgeStyles.ts` — `statusVariantMap` gained entries for schedule promise states and raw schedule statuses (`ESTIMATED`, `AWAITING_APPROVAL`, `AT_RISK`, `RESCHEDULED`, `PROPOSED`, `SUPERSEDED`, `PROVISIONAL`, `NEEDS_REVIEW`) so `StatusBadge` renders them without new badge components.

All new/changed API fields are optional so the app degrades gracefully if the backend hasn't populated them yet.

## Dealer

### Added

- `apps/mobile/src/features/requests/selectDeliveryAvailability.ts` — pure selector `selectDeliveryAvailability()` mapping raw `AvailabilityResult` + query state into a dealer-safe `DeliveryAvailabilityDisplay` (`idle | loading | error | unavailable | feasible | infeasible`), plus `selectQuickPickDates()` for chip suggestions (earliest + up to 3 alternatives, de-duplicated, capped at 4).
- `apps/mobile/src/features/requests/components/DeliveryAvailabilityCard.tsx` — new card in the New Order delivery step: shows checking/error/unavailable states, earliest-available date, quick-pick date chips, a free-text `YYYY-MM-DD` field for a preferred date (validated, never lets the dealer "force" an infeasible date — it shows the earliest alternative instead), and a preliminary-estimate disclaimer. Styled with `dealer-ui` glass components (`DealerGlassCard` family) and `dealerTokens`.
- `apps/mobile/src/features/sales-orders/selectSchedulePromise.ts` — pure selectors for order detail:
  - `selectChangeDateCta(schedule)` → `{ mode: 'hidden'|'update'|'request'|'locked', labelKey }`, implementing the `canUpdateDirect` / `canChangeRequest` / `locked` policy from the dealer-safe schedule payload.
  - `selectOrderPromiseSummary(schedule)` → commitment summary (requested/suggested/committed dates, `promiseState`, `showEstimateOnly` flag) for display.
- `apps/mobile/src/features/sales-orders/components/OrderScheduleCard.tsx` — new card on Order Detail (dealer view only) showing the promise-state badge, committed/estimated/requested dates, and the policy-driven "Change date" / "Request date change" CTA (hidden once locked).
- `apps/mobile/src/features/sales-orders/components/ChangeDeliveryDateSheet.tsx` — new bottom sheet (reuses the existing sheet/`TextField`/`PrimaryButton` patterns from `features/production/`) for entering a new date; re-runs client-side date validation before submit and posts via `dealerDateChange`.
- Unit tests: `apps/mobile/src/features/requests/__tests__/selectDeliveryAvailability.test.ts`, `apps/mobile/src/features/sales-orders/__tests__/selectSchedulePromise.test.ts`.

### Changed

- `apps/mobile/src/features/requests/types.ts` — `RequestDetail` gained optional `requiredDeliveryDate`.
- `apps/mobile/src/features/requests/newOrderDraftNormalize.ts` — local draft (`NewOrderLocalDraft`) persists `requiredDeliveryDate` (empty string = no preference).
- `apps/mobile/src/features/requests/newOrderSteps.ts` — `pickPersistedFields` carries `requiredDeliveryDate` across steps/draft saves.
- `apps/mobile/src/features/requests/newOrderValidation.ts` — added `isValidOptionalDate()` (empty allowed; otherwise strict `YYYY-MM-DD` real-calendar-date check).
- `apps/mobile/src/features/requests/NewOrderScreen.tsx` — wires `requiredDeliveryDate` into local state/draft restore/`buildBody`; calls `useAvailabilityQuery` once a product + valid quantity are known (recomputed as the preferred date changes); renders `DeliveryAvailabilityCard` in the delivery step; blocks submit with `mobile.newOrder.errors.dateInvalid` on a malformed date; passes `requestedDeliveryDate`/`estimatedDeliveryDate` into the review summary; resets the date field with the rest of the form after submit.
- `apps/mobile/src/features/requests/components/ReviewStep.tsx` — `ReviewSummary` gained `requestedDeliveryDate`/`estimatedDeliveryDate`; renders both as extra rows (localized via `formatDate`) when present.
- `apps/mobile/src/features/sales-orders/OrderDetailScreen.tsx` — dealer variant fetches the order's schedule (`useOrderScheduleQuery`, gated to `variant === 'dealer'` and a resolved production order), renders `OrderScheduleCard` + `ChangeDeliveryDateSheet`, and shows a success/failure toast keyed on whether the dealer's date was applied directly or sent as a request.
- `apps/mobile/src/features/dealer-home/selectDealerHome.ts` / `apps/mobile/src/features/dealer-home/components/OrderCarousel.tsx` — near-delivery order cards prefer `committedDeliveryDate` over `requiredDeliveryDate` when a schedule commitment exists, and render a distinct "Confirmed {date}" label (`mobile.dealerHome.committedDeliveryLabel`) instead of the plain date.
- `apps/mobile/src/features/production-flow/selectProductionFlow.ts` — `ProductionFlowModel` gained `isCommittedDelivery` and `promiseState`; both sales-order- and production-order-sourced flows now prefer the scheduler-committed date for `estimatedDelivery`.
- `apps/mobile/src/features/production-flow/ProductionFlowScreen.tsx` (`DealerProgressMap` host) — dealer role shows the `promiseState` badge (when present) instead of the raw order status, and labels the delivery date "Confirmed delivery" vs. "Estimated delivery" based on `isCommittedDelivery`.
- `apps/mobile/src/features/dealer-home/__tests__/selectDealerHome.test.ts` — added coverage for the committed-vs-requested date preference.

### Removed

- Nothing removed. All changes are additive/optional so existing dealer flows (no schedule yet, no committed date) render exactly as before.

## Admin mobile

### Added

- `apps/mobile/src/features/scheduling/selectAdminScheduling.ts` — pure selectors:
  - `selectDashboardStats(dashboard)` → 5 stat chips (today/week/awaiting-approval/at-risk/conflicts) with neutral/warning/danger tone.
  - `selectWeekStrip(days, orders, todayIso)` → 7-day order-count strip (deliberately **not** a Gantt — just per-day load + working/non-working flag).
  - `selectApprovalsWaiting(orders, locale)` → orders whose latest schedule is `PROPOSED`/`NEEDS_REVIEW`, de-duplicated by production order, localized product/dealer names, sorted by planned start.
  - `selectAtRiskCards(atRisk)` → maps the dedicated at-risk endpoint's orders.
  - `selectAvailableActions(card)` → which of `approve | changeDate | recalculate` apply to a card (approve only once a schedule version + approval-pending status exist).
- `apps/mobile/src/features/scheduling/components/AdminScheduleSheets.tsx` — `ApproveScheduleSheet`, `AdminChangeScheduleDateSheet`, `RecalculateScheduleSheet` (+ shared `SheetFooter`), all built from the same bottom-sheet/`TextField`/button patterns as `DeliveryDateSheet` / `AssignWorkerSheet` in `features/production/`, parchment-themed.
- `apps/mobile/src/features/scheduling/AdminSchedulingScreen.tsx` — new dashboard screen: stat chips, a 7-day strip, "Approvals waiting" and "At risk" lists (each row opens an `ActionSheet` with the actions from `selectAvailableActions`, which open the sheets above), skeleton/empty/error states, pull-to-refresh. Mutations use `idempotencyKey` where applicable and invalidate scheduling + order/report caches on success.
- `apps/mobile/app/(app)/(admin)/scheduling/index.tsx` — new Expo Router route, gated by `PermissionGate` requiring `schedule.read` **or** `schedule.capacity.read`.
- `apps/mobile/src/features/scheduling/__tests__/selectAdminScheduling.test.ts` — unit tests for all five selectors above.

### Changed

- `apps/mobile/src/features/admin-home/adminOverflowModules.ts` — added a "Scheduling" entry (`mobile.adminHome.navScheduling` / `navSchedulingHint`) linking to the new route, gated by the same permissions as the route.

### Removed

- Nothing removed. No Gantt/calendar-grid UI was built, per the brief.

## Worker

### Added

- `apps/mobile/src/features/tasks/isScheduledToday.ts` — `isScheduledToday(iso, now?)` utility: true when an ISO timestamp falls on the same **local** calendar day as `now`.
- `apps/mobile/src/features/tasks/__tests__/isScheduledToday.test.ts` — unit tests (null/invalid input, same-day boundaries, prev/next day), built from local `Date` components so they're timezone-independent.

### Changed

- `apps/mobile/src/features/tasks/selectTask.ts` — `TaskCardModel`/`TaskDetailViewModel` gained `plannedStart` and `isScheduledToday` (derived from `plannedStart` falling back to `plannedCompletion`); `TaskDetailViewModel.timing.plannedStart` now populated. No factory-calendar data (allocations, other workers, department load) is exposed — only the flat start/today fields.
- `apps/mobile/src/features/tasks/components/IndustrialFloorTaskCard.tsx` — shows a "Scheduled for today" meta row when `isScheduledToday` and the task isn't completed.
- `apps/mobile/src/features/tasks/components/TaskCard.tsx` — passes `isScheduledToday` through to `IndustrialFloorTaskCard`.
- `apps/mobile/src/features/tasks/components/TaskTimerBoard.tsx` — shows a "Scheduled today" badge in the header and a planned-start line at the bottom of `TaskDetailScreen`'s timer board.
- `apps/mobile/src/features/tasks/TaskDetailScreen.tsx` — passes `isScheduledToday` to `TaskTimerBoard`.
- `apps/mobile/src/features/worker-home/components/WorkerCurrentTaskHero.tsx` — shows a "Scheduled today" badge alongside the high-priority badge on the hero task card.
- `apps/mobile/src/features/worker-home/components/UpcomingTasksList.tsx` — small "Scheduled today" badge on upcoming task tickets.
- `apps/mobile/src/features/worker-home/components/WorkerTaskCard.tsx` — computes `isScheduledToday` from `timing.plannedStart`/`deadline` for the worker-home task list.
- `apps/mobile/src/features/tasks/__tests__/selectTask.test.ts` — added coverage for `plannedStart`/`isScheduledToday` on cards and detail view models (flat field, `timing.plannedStart` fallback, past-date negative case).

### Removed

- Nothing removed. `TaskDetailScreen` was not redesigned — only new, optional labels/badges were layered onto the existing `employeeIndustrial` components. No calendar/allocation UI was added for workers.

## i18n

Added keys to `packages/i18n/src/messages/{en,ar,he}/mobile.json` (all three locales kept in sync; verified via a script that all `mobile.*` keys referenced anywhere in the touched files resolve in every locale):

- `adminHome.navScheduling`, `adminHome.navSchedulingHint`
- `adminScheduling.*` (eyebrow, title, subtitle, weekStripTitle, approvalsTitle/Empty, atRiskTitle/Empty, errorTitle/Body, retry, plannedFor, materialRisk, conflict, `stats.{today,week,awaitingApproval,atRisk,conflicts}`, `sheets.{approveTitle,approveBody,approveConfirm,changeDateTitle,reasonLabel,reasonPlaceholder,saveDate,recalculateTitle,recalculateBody,recalculateConfirm,genericError}`)
- `dealerHome.committedDeliveryLabel`
- `newOrder.delivery.*` (title, checking, checkFailed, unavailable, earliest, earliestChip, infeasible, infeasibleWithSuggestion, customDateLabel, customDateHint, preliminaryNote)
- `newOrder.review.requestedDelivery`, `newOrder.review.estimatedDelivery`
- `newOrder.errors.dateInvalid`
- `orderDetail.schedule.*` (title, committedDate, estimatedDate, requestedDate, noDateYet, changeDate, requestDateChange, dateLocked, changeDateTitle, changeDateBody, requestDateChangeTitle, requestDateChangeBody, newDateLabel, saveDate, sendRequest, dateChangeFailed, dateUpdated, dateRequestSent)
- `productionFlow.committedDelivery`
- `tasks.cardScheduled`, `tasks.scheduledToday`, `tasks.timerScheduledStart`

## Tests

Unit tests added/extended (all pass — `apps/mobile`: 94 suites / 405 tests):

- `apps/mobile/src/features/requests/__tests__/selectDeliveryAvailability.test.ts` (new)
- `apps/mobile/src/features/sales-orders/__tests__/selectSchedulePromise.test.ts` (new)
- `apps/mobile/src/features/scheduling/__tests__/selectAdminScheduling.test.ts` (new)
- `apps/mobile/src/features/tasks/__tests__/isScheduledToday.test.ts` (new)
- `apps/mobile/src/features/tasks/__tests__/selectTask.test.ts` (extended: `plannedStart`/`isScheduledToday`)
- `apps/mobile/src/features/dealer-home/__tests__/selectDealerHome.test.ts` (extended: committed vs. requested delivery date)

TypeScript (`tsc --noEmit`) shows no new errors from any touched file (a handful of pre-existing errors remain in unrelated files: `CatalogScreen.tsx`, `DealerHero.tsx`, `DeleteDealerSheet.tsx`, `LocaleProvider.tsx`, `useDraggablePillBar.ts` — untouched by this change).

## Hand-test checklist

For each row: verify in **light and dark** mode, and in **en / ar (RTL) / he (RTL)** locales, on a device with safe-area insets and the bottom tab bar visible.

### Dealer

1. **New Order → delivery step** (`/(app)/(dealer)/requests/new` or catalog deep link → New Order wizard, step "Delivery"):
   - Pick a catalog product + quantity → `DeliveryAvailabilityCard` shows a loading state, then either an earliest date + quick-pick chips, an "unavailable" message, or an error state (turn off network to check).
   - Type a preferred date far in the past/invalid format → inline validation error; leave blank → no error, treated as "no preference".
   - Type a date the planner can't meet → card flips to "infeasible" and still surfaces the earliest alternative (never lets you force the bad date through).
2. **Review step**: with a preferred date set, confirm both "Requested delivery" and "Estimated delivery" rows appear, formatted per locale.
3. **Submit the order**, then open it from Orders → confirm the promise/schedule card appears on Order Detail once assigned (may require an admin to run scheduling on the backend first) with a "Change date" or "Request date change" CTA depending on approval state; tap it, submit a new date, confirm the success toast and that the CTA disappears once locked (post-production).
4. **Home tab**: an order with a scheduler-committed date shows "Confirmed {date}" instead of the plain date in the near-delivery carousel.
5. **Order production flow / progress map**: dealer role shows a promise-state badge (e.g. "Confirmed", "At risk") instead of the raw production status when a schedule exists.

### Admin

1. Open **Admin Home → More/quick-access → Scheduling** (or navigate to `/(app)/(admin)/scheduling` directly) — requires `schedule.read` or `schedule.capacity.read`; confirm a non-permissioned user doesn't see the tile.
2. Confirm stat chips, the 7-day strip (today highlighted), "Approvals waiting", and "At risk" sections render with skeletons while loading, an empty state with no data, and an error state with retry when the network is off.
3. Tap an approvals-waiting row → action sheet → **Approve** → confirm sheet → success toast, row disappears/list refreshes.
4. Tap a row → **Change date** → enter a new date + optional reason → save → list refreshes.
5. Tap a row → **Recalculate** → optional reason → confirm → list refreshes.
6. Pull to refresh the dashboard.

### Worker

1. Open a task with a scheduler-assigned `plannedStart` for today (`TaskDetailScreen`): confirm the "Scheduled today" badge + planned-start line appear near the timer board, with no calendar/allocation/other-worker data shown.
2. **Worker Home**: current-task hero shows the "Scheduled today" badge (next to the priority badge, not overlapping in RTL); upcoming-tasks list shows the small badge on today's tickets; a task list card (`IndustrialFloorTaskCard`) shows the "Scheduled for today" meta row when applicable and not completed.
3. Confirm a task with **no** `plannedStart`/not scheduled for today renders exactly as before (no badges), and that completed tasks never show the "scheduled today" badge.
