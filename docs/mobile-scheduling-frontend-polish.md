# Mobile Admin Scheduling — explain the schedule

Presentation-only polish so a factory owner can see **why** dates and load look the way they do. The planner, dealer `OrderScheduleCard`, worker task UI, and Admin Web scheduling are unchanged.

## What shipped

1. **Calendar cards carry schedule dates.** `GET /scheduling/calendar` order cards now include requested / suggested / committed / earliest, feasibility, planning mode, material ready, production deadline, and delivery-buffer days. Mobile no longer zeros those fields.
2. **Order snapshot + at-risk** pass through `materialReadyAt`, `productionDeadline`, `deliveryBufferWorkingDays`, `planningMode`, and `committedCompletionDate`. Dealer `OwnOrderSchedule` stays customer-facing.
3. **`selectScheduleDates` row plans:** identical, expanded, earliest (never shows `FORWARD`), infeasible, blocked. `NO_SLOT` maps to capacity copy. Estimate-review has its own reason key.
4. **`ScheduleExplanation`** on day/focus order rows (compact) and the production admin strip (detail).
5. **Factory capacity:** bottleneck next to factory load, load-help sheet, attention-first sort, “View all {n} stages”, Today jump when the selected day is not today, Full/Closed labeled in week cells.
6. **Orders board:** compact explanation, infeasible well + Review schedule (`schedule.manage`), “View all {n} orders”.
7. **At-risk vs conflicts stay separate.** Chip counts follow list length. Conflict rows show worker, task names, date, and PO numbers — never allocation IDs.
8. **Approve all** awaiting (`schedule.approve`) runs existing versioned approve sequentially. **Resolve / Resolve all** recalculates unique overlapping POs (`schedule.manage`) without `override: true`.
9. **Adjust working hours** (renamed), gated on `schedule.settings.manage`, shows working yes/no and shift hours. Day-exception success invalidates capacity.
10. **Stage detail** restacks Status / Eligible workers / Available / Allocated / Remaining. **View workers** only if `user.manage`.

## Limitations (honest)

- WIP required-item / produced-by-stage names are **not stored**. Blocked WIP shows the mapped reason only.
- There is no previous-vs-new date history, so there is no “Schedule updated” banner.
- Day detail lives in the factory-capacity board, not a calendar popup.
- Local DBs with zero `WorkerSkill` rows still show Scheduling blocked — fail-closed, not a UI bug.
- Resolve conflict asks the planner to uncross double-booking. If `/conflicts` still returns the pair after refetch, the row stays.

## i18n

New and reused keys live under `mobile.adminScheduling` in en / ar / he. Count copy uses `tPlural` (`Zero|One|Two|Few|Many`). Enforcement: `scheduling.i18n.test.ts` + `catalog-parity.test.ts`.

## Tests

Selectors (no screenshots):

- Bottleneck with overall load 33% + Inspection full
- Attention sort: blocked before available
- Identical compact vs expanded / infeasible dates
- Earliest-available (no requested date)
- Material ready date vs unknown; WIP reason without fake item names
- Conflict labels hide allocation IDs
- Approve-all targets only `PROPOSED` / `NEEDS_REVIEW` with a version
- Resolve-all unique PO ids

API wiring: calendar / snapshot / at-risk pass-through fields; `schedule-planner.ts` not imported from the service file.

## Out of scope

Planner math, dealer/worker UIs, restoring the day-tap popup, sticky Overview/Capacity/Orders segments.
