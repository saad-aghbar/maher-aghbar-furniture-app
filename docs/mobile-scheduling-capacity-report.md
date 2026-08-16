# Mobile Admin factory capacity

Exposes the authoritative backend scheduler on Mobile Admin (and custom staff with `schedule.read` or `schedule.capacity.read`). Mobile is presentation only: no workers×shift math, no eligibility engine, no second planner.

Related: [scheduling-closure-report.md](./scheduling-closure-report.md), [scheduling-capacity-audit.md](./scheduling-capacity-audit.md), [scheduling-worker-capacity-uat.md](./scheduling-worker-capacity-uat.md).

## BEFORE

- `GET /scheduling/capacity` hid stages with `capacityMinutes === 0 && bookedMinutes === 0`, so a stage with zero eligible workers never appeared.
- Response was range totals only (`bookedMinutes`, `capacityMinutes`, `eligibleWorkerCount`). No remaining hours, closed-day flag, per-day series, or nested workers.
- Mobile Scheduling (`AdminSchedulingScreen`) never called capacity or conflicts. At-risk list lacked projected / feasibility fields.
- `ProductionScheduleSnapshot` on mobile omitted `requestedDateFeasible`, `planningMode`, `unschedulableReason`. `SchedulePromiseState` omitted `LATE`. `statuses.LATE` was missing.

## AFTER

- Capacity always returns **every active stage-library row**. Zero-skill stages stay visible so Mobile can show **Scheduling blocked**.
- Additive aliases: `stageDefinitionId`, `availableMinutes`, `allocatedMinutes`, `remainingMinutes`. `departmentId` kept for admin-web.
- `granularity=day` adds `days[]` (`date`, `isWorking`, `shiftMinutes`) and `byDay[]`. Closed days are `isWorking: false`, not 0% load.
- `includeWorkers=true` on a **single-day** range nests skilled workers with server minutes. Multi-day ranges ignore the flag.
- `GET /scheduling/at-risk` includes `earliestAvailableDate`, `requestedDateFeasible`, `unschedulableReason`, `committedDeliveryDate`.
- Mobile Admin Scheduling shows Factory capacity (Day|Week), month-tap day detail, backend conflicts, admin requested/suggested/committed copy, and a production-detail schedule strip gated on `schedule.read`.

## Files

API:

- [`apps/api/src/modules/scheduling/scheduling.service.ts`](../apps/api/src/modules/scheduling/scheduling.service.ts) — `listCapacity`, `listAtRisk`
- [`apps/api/src/modules/scheduling/scheduling.controller.ts`](../apps/api/src/modules/scheduling/scheduling.controller.ts)
- [`apps/api/src/modules/scheduling/dto/scheduling.dto.ts`](../apps/api/src/modules/scheduling/dto/scheduling.dto.ts) — `ListCapacityQuery`
- [`apps/api/src/modules/scheduling/__tests__/scheduling-capacity-wiring.test.ts`](../apps/api/src/modules/scheduling/__tests__/scheduling-capacity-wiring.test.ts)

Mobile:

- [`apps/mobile/src/api/modules/scheduling.ts`](../apps/mobile/src/api/modules/scheduling.ts) — `getCapacity`, `getConflicts`, snapshot/`LATE` types
- [`apps/mobile/src/api/queryKeys.ts`](../apps/mobile/src/api/queryKeys.ts)
- [`apps/mobile/src/features/scheduling/query.ts`](../apps/mobile/src/features/scheduling/query.ts)
- [`apps/mobile/src/features/scheduling/selectFactoryCapacity.ts`](../apps/mobile/src/features/scheduling/selectFactoryCapacity.ts)
- [`apps/mobile/src/features/scheduling/selectScheduleDates.ts`](../apps/mobile/src/features/scheduling/selectScheduleDates.ts)
- [`apps/mobile/src/features/scheduling/selectAdminScheduling.ts`](../apps/mobile/src/features/scheduling/selectAdminScheduling.ts)
- [`apps/mobile/src/features/scheduling/AdminSchedulingScreen.tsx`](../apps/mobile/src/features/scheduling/AdminSchedulingScreen.tsx)
- [`apps/mobile/src/features/scheduling/components/FactoryCapacitySection.tsx`](../apps/mobile/src/features/scheduling/components/FactoryCapacitySection.tsx)
- [`apps/mobile/src/features/scheduling/components/FactoryCapacityCard.tsx`](../apps/mobile/src/features/scheduling/components/FactoryCapacityCard.tsx)
- [`apps/mobile/src/features/scheduling/components/FactoryCapacityWeekRow.tsx`](../apps/mobile/src/features/scheduling/components/FactoryCapacityWeekRow.tsx)
- [`apps/mobile/src/features/scheduling/components/FactoryCapacityDetailSheet.tsx`](../apps/mobile/src/features/scheduling/components/FactoryCapacityDetailSheet.tsx)
- [`apps/mobile/src/features/scheduling/components/SchedulingDayDetailSheet.tsx`](../apps/mobile/src/features/scheduling/components/SchedulingDayDetailSheet.tsx)
- [`apps/mobile/src/features/production/components/AdminScheduleStrip.tsx`](../apps/mobile/src/features/production/components/AdminScheduleStrip.tsx)
- [`apps/mobile/src/features/production/ProductionDetailScreen.tsx`](../apps/mobile/src/features/production/ProductionDetailScreen.tsx)
- [`apps/mobile/src/features/users/query.ts`](../apps/mobile/src/features/users/query.ts) — invalidate `scheduling.all` after user mutations
- [`apps/mobile/src/components/badges/badgeStyles.ts`](../apps/mobile/src/components/badges/badgeStyles.ts)

i18n / permissions:

- [`packages/i18n/src/messages/{en,ar,he}/mobile.json`](../packages/i18n/src/messages/en/mobile.json)
- [`packages/i18n/src/messages/{en,ar,he}/statuses.json`](../packages/i18n/src/messages/en/statuses.json)
- [`packages/permissions/src/__tests__/role-permissions.test.ts`](../packages/permissions/src/__tests__/role-permissions.test.ts)

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/scheduling/capacity?from&to` | Unchanged default. All active stages. Additive aliases. |
| GET | `/scheduling/capacity?from&to&granularity=day` | Adds `days`, `byDay`. |
| GET | `/scheduling/capacity?from=D&to=D&includeWorkers=true` | Nested `workers[]` only when `from === to`. |
| GET | `/scheduling/conflicts` | Unchanged; Mobile now consumes it. |
| GET | `/scheduling/at-risk` | Additive projected / feasibility / committed fields. |

Planner, generate, occupancy, and admin-web month capacity URL are unchanged. Extra zero-skill rows may appear on admin-web as 0/0 bars.

## Types (mobile)

- `CapacityRow`, `CapacityWorkerRow`, `CapacityDay`, `CapacityByDay`, `CapacityResponse`, `CapacityQueryParams`
- `ConflictPair`, `ConflictAllocation`
- `SchedulePromiseState` includes `LATE`
- `ProductionScheduleSnapshot` includes `requestedDateFeasible`, `planningMode`, `unschedulableReason`
- `AtRiskOrder` includes `earliestAvailableDate`, `requestedDateFeasible`, `unschedulableReason`, `committedDeliveryDate`

Presentation states (from backend numbers only):

| Condition | State |
|---|---|
| `!isWorking` | Factory closed |
| `eligibleWorkerCount === 0` | Scheduling blocked (never “0h available”) |
| `remainingMinutes <= 0` and workers > 0 | Full |
| `allocated / available >= 0.85` | Near capacity |
| `>= 0.5` | Moderate |
| else | Available |
| Query error | Error card + retry (never fake zeros) |

Day query: `from=D&to=D&granularity=day&includeWorkers=true`.  
Week query: `from=weekStart&to=weekEnd&granularity=day`. Working days come from `days[].isWorking`.

## Permissions

- Route and overflow module unchanged: `schedule.read` **or** `schedule.capacity.read` (`mode=any`).
- Approve / change-date / recalculate hidden without `schedule.approve` / `schedule.manage` (API still enforces).
- Production strip requires `schedule.read`. Dealer `OrderScheduleCard` unchanged. No factory capacity on `schedule.*.own`.
- `CUSTOMER` does not get `schedule.capacity.read` or `schedule.read`. `PRODUCTION_WORKER` has no `schedule.*` codes.

## RTL / theme

- Date chevrons swap icon direction in RTL; metric rows use `row-reverse`.
- Hours and percents use `dir="ltr"`.
- Load bars reuse `calendarLoad*` / `ProgressBar`. State is icon + label, not color alone.
- Cards use `SurfaceCard` + `orderBoardShadow`. No new card system.

## i18n keys added

Under `mobile.adminScheduling` in en/ar/he:

**capacity:** `title`, `subtitle`, `day`, `week`, `today`, `previousDay`, `nextDay`, `pickDate`, `eligibleWorkers`, `eligibleWorkersZero`, `eligibleWorkersOne`, `eligibleWorkersTwo`, `eligibleWorkersFew`, `eligibleWorkersMany`, `available`, `allocated`, `remaining`, `utilization`, `hours`, `hoursOf`, `percent`, `state.available`, `state.moderate`, `state.nearCapacity`, `state.full`, `state.unavailable`, `state.noEligibleWorkers`, `state.schedulingBlocked`, `state.closed`, `emptyScheduled`, `emptyClosed`, `emptyNoWorkers`, `loadErrorTitle`, `loadErrorBody`, `retry`, `updating`, `a11yCard`, `a11yBlocked`, `a11yFull`, `a11yClosed`, `a11yPrevDay`, `a11yNextDay`, `weekClosed`, `weekA11yDay`, `weekA11yClosed`, `detailTitle`, `detailWorkersHeading`, `detailNoWorkers`, `workerHours`, `workerAvailable`, `workerFull`

**dayDetail:** `title`, `factoryLoad`, `ordersScheduled`, `atRisk`, `conflicts`, `capacityByStage`, `noOrders`, `a11yLoad`

**dates:** `requested`, `suggested`, `committed`, `earliestFeasible`, `projectedCompletion`, `notApproved`, `feasible`, `infeasibleTitle`, `dealerRequested`, `reviewSchedule`, `identicalHint`

**blocked:** `title`, `noEligibleWorkers`, `materials`, `wip`, `estimateReview`, `generic`

**reasons:** `noEligibleWorker`, `materialNotReady`, `wipNotReady`, `capacity`, `overlap`, `closedDay`, `skill`, `unknown`

**atRisk:** `due`, `projected`, `noProjected`

**conflicts:** `workerOverlap`, `emptyDetail`

**orderStrip:** `title`, `viewOnBoard`

**statuses:** `LATE` (en Late / ar متأخر / he באיחור)

Enforcement: `scheduling.i18n.test.ts` `SCHEDULING_KEYS` + interpolation tests; `catalog-parity.test.ts` en/ar/he identical leaves.

## Tests

Mobile (fixture, no second engine):

- Extra stage in payload renders.
- Carpentry 4 / 32h / 24h / 8h → 75%, remaining 8h.
- Painting `eligibleWorkerCount: 0` → blocked, not 0h.
- Upholstery remaining 0 → Full.
- `isWorking: false` → Closed, not 0%.
- Missing payload → empty list (error UI is the query `isError` branch).
- Date prev/next changes `from`/`to`; week uses `granularity=day`.
- Requested / suggested / committed / infeasible / unschedulable selectors.
- Conflicts mapped from backend pairs.
- Overflow: `schedule.capacity.read` sees Scheduling; dealer `schedule.*.own` and worker catalogs do not.

API wiring:

- Zero-skill stages included.
- `remainingMinutes` / aliases.
- `byDay` + `isWorking` (Friday 2026-08-14 closed on default Sun–Thu+Sat calendar).
- Nested workers only on single-day `includeWorkers`.

## Live API UAT (localhost:4000, admin/123, after `prisma db push`)

Local `factory_calendars.deliveryBufferWorkingDays` was missing until push (P2022 on `listCapacity`). After sync:

| Check | Result |
|---|---|
| `GET /capacity?from=2026-08-15&to=2026-08-15&includeWorkers=true&granularity=day` | 10 active stages returned, including zero-skill rows (ASSEMBLY…UPHOLSTERY). `days[0].isWorking=false`, `shiftMinutes=0` (that Saturday closed on this calendar). |
| Aliases | `departmentId === stageDefinitionId`; `availableMinutes === capacityMinutes`; `allocatedMinutes === bookedMinutes`. |
| Week `granularity=day` 15–21 Aug | Mix of working/closed days; working shift **420** minutes (7h after lunch). `workers` omitted on the week range. |
| `GET /at-risk` | `{ data: [] }` shape; extra fields present when rows exist. |
| `GET /conflicts` | `{ data: [] }`. |

This database currently has **zero active WorkerSkill rows**, so every stage is `eligibleWorkerCount: 0` (blocked). Competing-PO capacity vs allocations is covered by domain UAT A–Z in [scheduling-worker-capacity-uat.md](./scheduling-worker-capacity-uat.md) and wiring tests (Carpentry 2 skilled heads × shift; Upholstery allocation overlap; Painting empty skills still listed).

Procedure to repeat with skills on a running API (isolated; do not mock the planner):

1. Create active `PRODUCTION_WORKER` users with Carpentry + Upholstery skills; leave Painting with none.
2. Generate competing POs that require those stages.
3. `GET /scheduling/capacity?from=D&to=D&includeWorkers=true` — allocated minutes match clipped allocations; Painting `eligibleWorkerCount=0`.
4. Add a Painting skill; enqueue `REPLAN_EMPLOYEE` (activate/skill sync already does). After replan, Painting is no longer blocked and remaining minutes move.

## Gates

| Gate | Result |
|---|---|
| API typecheck | Pass |
| `jest --testPathPattern=scheduling-capacity-wiring` | 9/9 pass |
| Mobile typecheck | Pass |
| Mobile Jest (full suite) | 123 suites / 622 tests pass |
| Mobile scheduling + i18n + overflow (subset) | Included above |
| `catalog-parity` en/ar/he | Pass |
| Permissions `role-permissions` | Pass (dealer/worker have no factory capacity read) |
| Expo Doctor | 18/18 pass |
| Planner rewrite | Not done (out of scope) |
| Factory lifecycle 88/88 | Not re-run; API contract is additive. Do not weaken. |

## Limitations

- Presentation utilization bands (50% / 85%) are UI-only; the engine does not emit those labels.
- Nested workers require a single-day range. Week view shows per-day % from `byDay`, not per-worker rows.
- This local DB had no skilled workers at UAT time, so live remaining-hours vs competing POs could not be observed here.
- Admin-web may now list previously hidden 0/0 stages.
- No replan-job status endpoint; Mobile invalidates `scheduling.all` after schedule and user mutations.
