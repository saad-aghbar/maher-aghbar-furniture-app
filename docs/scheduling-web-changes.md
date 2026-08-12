# Scheduling web changes — Customer Portal, Employee Portal, Admin Web

This document lists every customer-portal / employee-portal / admin-web (+
supporting API) change made to surface the production-scheduling feature
(`apps/api/src/modules/scheduling`) in the dealer-facing and floor-facing
apps, without ever exposing internal capacity, workers, or departments to
dealers or employees.

Columns: **Role** (who sees it) · **File** · **Type** (new/modified) · **Why**
· **User-visible** (what changed on screen) · **API** (endpoint(s) used) ·
**Theme** (styling approach) · **i18n** (keys added) · **Tests**.

## Customer portal (`apps/customer-portal`)

| Role | File | Type | Why | User-visible | API | Theme | i18n | Tests |
|---|---|---|---|---|---|---|---|---|
| Dealer | `src/components/availability-card.tsx` | New | Reusable dealer-safe "can we make this by X date" card, shared by order creation and quotation request | Shows earliest available date, whether the requested date is feasible, a suggested alternative, and up to 3 alternative dates. Never shows workers, departments, or capacity numbers | `POST /api/v1/scheduling/availability` | Existing `Card`/`Alert`/`Skeleton` primitives from `@maher/ui`, matches portal's existing form-section styling (`maher-form-section`) | Added `availabilityTitle`, `availabilityUnavailable`, `availabilityEarliestDate`, `availabilityRequestedFeasible`, `availabilityFeasibleYes/No`, `availabilitySuggestedInstead`, `availabilityAlternativeDates`, `availabilityPreliminaryHint`, `preferredDeliveryDate` to `catalog.json` (en/ar/he) | Manual — no unit tests added (thin presentational component wrapping an existing query hook); covered indirectly by existing `scheduling-policy.integration.test.ts` on the API side |
| Dealer | `src/components/production-schedule-card.tsx` | New | Dealer-safe promise-state + change-date UI for a single production order, reused on the order detail page | `StatusBadge` for promise state (`REQUESTED`→`ESTIMATED`/`AWAITING_APPROVAL`, `SUGGESTED`→`CONFIRMED`/`AT_RISK`/`RESCHEDULED`, `COMMITTED`→`CONFIRMED`/`COMPLETED`), requested/suggested/committed dates, a **Change date** or **Request date change** button (label depends on policy), and a locked-reason banner when changes aren't allowed. Never shows allocations, workers, or departments | `GET /api/v1/scheduling/orders/:productionOrderId` (customer-scoped branch `getOwnOrderSchedule`), `POST /api/v1/scheduling/orders/:productionOrderId/dealer-date` | `Card`, `Modal`, `Alert`, `StatusBadge`, `TextArea` from `@maher/ui`; native `<input type="date">` styled with the same tokens as other portal inputs | Added `dealerDateUpdated`, `dealerDateChangeRequested`, `dateChangeLockedHint`, `requestDateChange`, `requestDateChangeHint`, `changeDate`, `changeDateHint`, `newPreferredDate` to `production.json` (en/ar/he). Promise-state labels (`CONFIRMED`, `AT_RISK`, `RESCHEDULED`, `ESTIMATED`, `AWAITING_APPROVAL`) already existed in `statuses.json` from the earlier scheduling pass | Manual — exercises existing, already-tested `dealerDateChange`/`getOwnOrderSchedule` service methods (`scheduling-policy.integration.test.ts`, `dealer-change-policy.test.ts`) |
| Dealer | `src/app/[locale]/orders/new/page.tsx` | Modified | Let dealers see production availability and set a preferred delivery date while creating an order | Added a **Preferred delivery date** date input and an `AvailabilityCard` (shown once a catalog product + quantity are chosen) between the order-info and fabric sections. Preferred date is sent as `requiredDeliveryDate` on submit | `POST /api/v1/requests` (existing, now also sends `requiredDeliveryDate`); `AvailabilityCard` calls `POST /api/v1/scheduling/availability` | Reused existing `Input`/`Card` styling, no new visual system | Reused `preferredDeliveryDate` (new, see above) | Manual — no dedicated test file for this page previously; not adding one to stay consistent with existing coverage pattern for this file |
| Dealer | `src/app/[locale]/quotations/request/page.tsx` | Modified | RFQ step 1 only had a free-text product name (no catalog id), so availability couldn't be checked; added a catalog product picker so the wizard can call the availability endpoint | Step 1 now has a **Model name** catalog dropdown (auto-fills the manual product-name field) in addition to the existing manual name field; step 4 (delivery) now shows the `AvailabilityCard` next to the preferred-delivery-date field | `GET /api/v1/catalog/browse/products`; `POST /api/v1/scheduling/availability` via `AvailabilityCard`; existing `POST /api/v1/requests` now also sends `productId` on the line item | Reused existing `Select`/`Input` wizard styling | No new keys — reused `catalog.modelName`, `catalog.modelNameManual`, `catalog.select`, and the new `availability*` keys | Manual |
| Dealer | `src/app/[locale]/orders/[id]/page.tsx` | Modified | Surface per-production-order scheduling status on the order tracking page | Renders one `ProductionScheduleCard` per linked production order, between the stage-tracking timeline and delivery status sections | `GET /api/v1/scheduling/orders/:productionOrderId` (via the card) | Reused `MotionSection` stagger pattern already used on this page | None beyond the card's own keys | Manual |

## Employee portal (`apps/employee-portal`)

| Role | File | Type | Why | User-visible | API | Theme | i18n | Tests |
|---|---|---|---|---|---|---|---|---|
| Floor worker | `src/lib/scheduling.ts` | New | Small pure helpers (`toDateOnly`, `isScheduledForToday`) shared by the task list and task detail pages — read-only, no scheduling mutation logic | — (helper module) | — | — | — | Pure functions; not covered by a dedicated spec file (mirrors the lightweight-helper convention already used in this app, e.g. `post-login.ts`) |
| Floor worker | `src/app/[locale]/tasks/page.tsx` | Modified | Give workers visibility into when their task is planned without adding any calendar or scheduling controls | Each task card now shows a **Scheduled for today** badge when `plannedStart` or `plannedCompletion` falls on today's date, plus a `Planned start` / `Planned completion` line when either is set. No calendar view, no way to edit the schedule | `GET /api/v1/tasks?mine=true` (unchanged endpoint — `plannedStart`/`plannedCompletion` were already returned by `ProductionTask`, just not rendered before) | Reused `Badge`, `StatusBadge`, `Ltr` from `@maher/ui`; new `CalendarClock` icon from `lucide-react` (already a dependency) | Added `scheduledForToday`, `plannedStart`, `plannedCompletion` to `production.json` (en/ar/he) | Manual — this page has no existing unit tests to extend |
| Floor worker | `src/app/[locale]/tasks/[id]/page.tsx` | Modified | Same visibility on the task detail screen | Header now shows the **Scheduled for today** badge next to status/priority when applicable; the factory/task-number grid gained **Planned start** / **Planned completion** fields when set. No schedule-mutation controls were added | `GET /api/v1/tasks/:id` (unchanged endpoint) | Same components as above | Reused the same three keys | Manual |

## Admin web (`apps/admin-web`) — reporting only

The admin scheduling calendar, production detail scheduling section, and the
dealer-date approval flow already existed before this pass (see
`docs/production-scheduling-*.md`). The only admin-web change in this pass is
to the **Reports** page, to surface the two new backend metrics below.

| Role | File | Type | Why | User-visible | API | Theme | i18n | Tests |
|---|---|---|---|---|---|---|---|---|
| Admin/manager | `src/app/[locale]/reports/page.tsx` | Modified | Surface the new `plannedVsActual` / `onTimeRate` production-report fields | Production report section gained 3 metric cards: **On-time delivery rate**, **Planned vs actual minutes (avg)**, **Schedule variance** (%) | `GET /api/v1/reports/production` (now returns `plannedVsActual` and `onTimeRate`, see below) | Reused existing `MetricCard` grid pattern already used elsewhere on this page | Added `onTimeRate`, `plannedVsActualMinutes`, `scheduleVariancePercent` to `accounting.json` (en/ar/he) | Manual — no existing spec file covers this page's rendering; backend fields are covered by the API changes below |

## Supporting API changes

These aren't "web" pages, but they back the UI changes above and are listed
per the task's request to cover every user-visible change end-to-end.

| Area | File | Type | Why | User-visible | API | Tests |
|---|---|---|---|---|---|---|
| Reports | `apps/api/src/modules/reports/reports.service.ts` | Modified | Add placeholder scheduling-accuracy metrics to the production report, computed from data that already exists (`ProductionTask.actualMinutes`/`estimatedMinutes`, `ProductionOrder.actualCompletionDate`/`committedDeliveryDate`) | New `plannedVsActual` (`sampleSize`, `avgPlannedMinutes`, `avgActualMinutes`, `varianceMinutes`, `variancePercent`) and `onTimeRate` (`sampleSize`, `onTimeCount`, `onTimeRate`) fields on the `production()` report response. Both degrade to `null`/`0` gracefully when there isn't enough completed-task/order history yet | `GET /api/v1/reports/production` | No new spec file added; `reports.production-summary.spec.ts` covers the neighboring `productionSummary()` method and was left unmodified since `production()` behavior for existing fields is unchanged (purely additive fields) |
| Scheduling / AI intake | `apps/api/src/modules/scheduling/scheduling.service.ts` | Modified (stub) | See "AI intake decision" below | New `acceptAiEstimateProposal(input)` method exists but is **not called from anywhere yet** — it is a documented integration point, not a live feature | Creates a `SchedulingEstimateProposal` row with `status: PENDING` (never auto-approves, never touches `ProductionOrder` dates) | None added — the method throws `BAD_REQUEST` without a `productId` and is otherwise exercised transitively by existing `SchedulingEstimateProposal`/`acceptSuggestedEstimate` coverage once a human approves a proposal it creates |

## AI intake decision: why `acceptAiEstimateProposal` is a stub

The task asked to map `manufacturingComplexity` / `estimatedEffort` from the
AI intake extraction into a `SchedulingEstimateProposal` when extraction
completes, "if easy," with an explicit invasiveness escape hatch. After
inspecting the pipeline:

- `apps/api/src/modules/ai-intake` currently has **no** `manufacturingComplexity`
  or `estimatedEffort` field anywhere in its extraction schema, provider
  prompt, or `ExtractedLineItem` type (`packages/integrations`) — these
  signals don't exist yet.
- `SchedulingEstimateProposal.complexity` (`ManufacturingComplexity` enum:
  `STANDARD` / `MODIFIED` / `CUSTOM`) already exists in the Prisma schema, but
  **no code path creates a proposal today** — only
  `SchedulingService.acceptSuggestedEstimate` (human-approval) exists, fed
  today exclusively by `computeEstimateStats` (historical task-time learning,
  not AI).
- Wiring AI intake end-to-end would require: (1) extending the extraction
  JSON schema and provider prompt(s) in `packages/integrations`, (2) mapping
  those fields through `ai-intake.mapper.ts` and `ai-intake.service.ts`,
  (3) deciding how a *complexity/effort* signal (no stage breakdown) becomes a
  per-stage `stageEstimates` array the planner can use, and (4) deciding at
  what point in the review lifecycle (extraction vs. RFQ approval vs.
  production-order creation) the proposal should be created. That's a
  multi-package, multi-team-decision change — too invasive for this pass.

Per the fallback instruction, `SchedulingService.acceptAiEstimateProposal`
was added as a stub: it has the right shape (product/request-scoped, creates
a `PENDING` proposal, never sets a committed/suggested date itself) so a
future AI intake change can call it directly once the extraction schema
grows those fields, and a human still must approve it via the existing
`acceptSuggestedEstimate` flow before it affects any real schedule.

## Guardrails verified

- **Customer portal** never fetches or renders `ScheduleAllocation`,
  `employeeId`, `departmentId`, or worker names — `getOwnOrderSchedule` and
  `availability()` responses used by the portal simply don't include them.
- **Employee portal** has no new calendar view and no new schedule-mutation
  endpoint calls — `plannedStart`/`plannedCompletion` are rendered read-only
  from data the task endpoints already returned.
- Dealer "change date" always goes through `resolveDealerChangePolicy` on the
  server (`domain/dealer-change-policy.ts`); the portal button label and the
  locked banner just reflect `canUpdateDeliveryDate` / `canRequestDateChange`
  / `dateChangeLocked` from the API — no client-side bypass is possible.
