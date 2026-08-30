# Scheduling dynamic capacity replan — closure report

Implements factory replanning after calendar / worker / resource-slot
changes without rewriting the planner. Audit:
[scheduling-dynamic-capacity-replan-audit.md](./scheduling-dynamic-capacity-replan-audit.md).

Live DB `maher_erp` received `scheduling_replan_runs` via `prisma db push`
on **2026-08-15**. No seed. No live factory-day mutation in this pass.

Policy implemented: **use newly available capacity when it helps
commitments and earliest-available work; do not drag healthy latest-feasible
orders earlier.** Not “make every day 100%.”

---

## 1. Previous behavior

Calendar open / close / overtime **did** replan. It awaited
`replanActiveSchedules` on the HTTP request: every active PO, sequential
`generateForProductionOrder`, failures swallowed, ~30s Mobile timeout.

Most incomplete orders have a requested date, so generate used
**backward latest-feasible from requested** (not committed). Healthy dated
work stayed put. At-risk committed work often did not recover into new
hours. Newly opened days could stay empty. Pinned allocations on shutdown
days stayed in the database while Mobile hid all orders behind
`dayClosed`.

There was no `REPLAN_FACTORY` job. Queue `removeOnComplete: true` meant
Bull could not be polled even if a job existed.

## 2. New candidate-selection policy

Domain: `apps/api/src/modules/scheduling/domain/factory-replan.ts`.

Candidates = incomplete POs (`not CANCELLED/COMPLETED`) with the latest
**active** schedule only (`APPROVED | PROPOSED | NEEDS_REVIEW`).

`capacityDelta`:

| Change | Delta |
|---|---|
| SHUTDOWN / HOLIDAY, shorter shift, fewer weekdays, worker deactivate / skill remove, resourceSlots decrease | `decrease` |
| Open a closed day, longer EXTRA_SHIFT, extra weekday, later `shiftEnd`, worker activate / skill add, resourceSlots increase | `increase` |
| EXTRA_SHIFT 08–16 on an already-open 08–16 day | `none` |

Empty candidate set is a **pass** (`moved: 0`).

**Horizon:** changed local date through
`max(changedDate + 90 calendar days, latest future allocation end among
incomplete POs)`. Calendar settings PATCH uses **today → same horizon**.

## 3. Capacity increase behavior

Urgency classes, then existing `comparePriority` inside the class:

1. `LATE`
2. `AT_RISK`
3. `BLOCKED` with `recoverableAutomatically`
4. Forward / no requested and no committed
5. **Skip** healthy backward (`ON_TRACK` / `AWAITING_APPROVAL` with a
   promise date and a feasible plan)

Generate runs **without** `abortIfMissesCommitment` so leftover risk is
persisted honestly. Fingerprints (including allocation windows) decide
moved vs unchanged.

## 4. Capacity decrease behavior

Unpinned future allocations whose wall time sits **outside the day’s
shift envelope** are replanned. Lunch gaps inside the envelope are not
illegal. Pinned / `manuallyAdjusted` overlapping removed hours are
**not** generate-moved; they become `pinnedIssues`. `COMPLETED` /
`IN_PROGRESS` tasks are never candidates.

## 5. Committed-date fix

`buildAndPersistSchedule` backward target is now:

```ts
const promiseDate = po.committedDeliveryDate ?? po.requiredDeliveryDate;
```

Requested and committed columns are not overwritten. Dealer availability
still uses requested. Recalculate / factory replan / RISK_ANALYSIS
optimize against the **active promise**.

## 6. Priority ordering

No second algorithm. Urgency class first, then
`comparePriority` (pinned → URGENT/HIGH/NORMAL/LOW → committed →
requested → createdAt → id). When new capacity fits only one threatened
order, HIGH beats NORMAL.

## 7. Async job architecture

1. Persist calendar / exception / slots (existing audit stays).
2. Insert `SchedulingReplanRun` (`QUEUED`).
3. Enqueue `REPLAN_FACTORY` with Bull `jobId` = `REPLAN_FACTORY:{runId}`
   (unique per mutation; concurrent edits do not collapse).
4. HTTP **200** immediately:
   `{ calendarUpdated, replanQueued, replanJobId }`.

`GET /scheduling/replan-runs/:id` (`schedule.read`) returns status/result
because the queue drops completed jobs.

Partial PO failures → run `COMPLETED` with `failures[]`. `FAILED` only if
the run cannot start. Processing a `COMPLETED`/`FAILED` `runId` is a no-op
(no duplicate active schedules).

`replanActiveSchedules` remains in the service unused on the HTTP path.

## 8. Pinned closed-day behavior

Conflicts stay worker/resource overlap only — no new overlap type.

`listPinnedOnUnavailableCalendar` + calendar/capacity day field
`pinnedOnClosedDayCount`. Classifier reasons
`CLOSED_DAY_CHANGE` / `MANUAL_SCHEDULE_CHANGE` still apply to affected POs.

Mobile: if a closed day has pinned-invalid count &gt; 0, show
“Manual schedule requires attention” + Review (existing order/conflict
sheet). Silent `dayClosed` empty state only when count is 0.

## 9. Open-day test

Isolated: `calendar-open-day-replan.test.ts` — forward earliest-available
occupies a newly opened Wednesday. Domain `factory-replan.test.ts` —
increase selects LATE/AT_RISK/forward and skips healthy backward.
Wiring: `addException` enqueues `REPLAN_FACTORY` and does **not** call
`generateForProductionOrder` on the request path.

## 10. Close-day test

Decrease selects unpinned illegal windows and collects pinned issues.
IN_PROGRESS on a shutdown day is skipped. Wiring: `deleteException`
enqueues without generating.

## 11. Overtime add/remove tests

Minutes delta: longer EXTRA_SHIFT = increase; same 08–16 EXTRA_SHIFT on
an open day = none. Unpinned 16:00–20:00 occupancy after hours shrink
is a decrease candidate. Existing open-day overtime planner tests still
show forward work using 16:00–20:00 and healthy backward staying put.

## 12. At-risk recovery

Increase pass generates LATE/AT_RISK first, without aborting on leftover
commitment miss. Run result records `recoveredAtRisk` when primary status
leaves LATE/AT_RISK/BLOCKED. Mobile toasts recovered count when that
happens.

## 13. Earliest-available behavior

Forward / no-promise orders remain increase candidates. Planner
`forwardSchedule` is unchanged: new legal hours can pull ready work
earlier when occupancy and skills allow.

## 14. Healthy backward-order behavior

`selectIncreaseUrgency` returns `skip` for ON_TRACK / AWAITING_APPROVAL
with a promise date. Opening a day with only healthy backward work is
`moved: 0` — a pass, not a failure. Planner still places dated work
latest-feasible when generate *is* invoked.

## 15. Mobile feedback

Calendar POST/DELETE timeout 90s (write is fast; poll is separate).

After `replanQueued`:

1. Toast: calendar updated + schedule is being recalculated
2. Poll `GET /scheduling/replan-runs/:id` until COMPLETED/FAILED or ~90s
3. Invalidate `queryKeys.scheduling.all` and refetch calendar, dashboard,
   at-risk, capacity, conflicts
4. Result toast from run counts — never “Schedule updated” before the job
   finishes

Admin-web settings banner shows “recalculating” when `replanQueued` is
true. No Admin Scheduling redesign. Dealer and worker UIs unchanged.

## 16. EN / AR / HE

New Mobile keys under `mobile.adminScheduling.replan.*` and catalog
`calendar.recalculating` / exception recalculating strings. Arabic uses
existing plural Zero/One/Two/Few/Many. Counts go through `tPlural`.
No dealer/worker strings. No raw job enums.

## 17. Tests

| Suite | Result |
|---|---|
| API `jest --testPathPattern='scheduling'` | **18 suites / 188 tests pass** |
| Domain factory-replan + open-day replan | Included above |
| Factory replan wiring (enqueue, one-PO failure, idempotency) | Included above |
| Capacity / at-risk / conflict / working-minute tests | Unchanged and green |
| API typecheck | Pass |
| Mobile scheduling + i18n + poll helper | **6 suites / 83 tests pass** (subset); related sheets also green in the broader run |
| Mobile typecheck | Pass |
| Expo Doctor | **18/18** |
| Factory lifecycle 88/88 | Not re-run (env not requested this pass) |

Working-minute and overlap tests were not weakened.

## 18. Remaining limitations

- Sequential per-order generate is **not** a global packer. One PO’s new
  placement becomes occupancy for the next. Priority order helps, but a
  later HIGH order cannot steal a slot already taken by an earlier
  candidate in the same run.
- `capacityDelta: none` still records a completed run with `moved: 0`.
- Material / WIP / predecessor constraints stay inside generate. An
  at-risk PO can be a candidate and still not move earlier if
  `materialReadyAt` or WIP is not ready.
- Pinned work is never auto-moved. Attention is explicit; an admin must
  unpin or edit.
- Calendar `days[].date` is still UTC `toISOString().slice(0,10)` (legacy).
  Pinned counts key off that same `date` field.
- Future **Optimize factory schedule** (intentionally compact healthy
  backward work) is **out of scope**. Automatic calendar-change behavior
  must not become a 100% utilization optimizer.

## PAST-SAFE

Opening a historical day does not pull current unfinished work into that
capacity. `REPLAN_EMPLOYEE` generate is floored at `resolveSchedulingFloor`.
See [scheduling-past-floor-closure-report.md](./scheduling-past-floor-closure-report.md).


---

## Worker / resource hooks

`REPLAN_EMPLOYEE` keeps its job name. Deactivate / skill-remove = decrease
for that employee’s future unpinned work. Activate / skill-add = increase
(factory-wide at-risk + forward). `PATCH` production stage `resourceSlots`
enqueues `REPLAN_FACTORY` with increase/decrease. No workflow-editor
redesign.
