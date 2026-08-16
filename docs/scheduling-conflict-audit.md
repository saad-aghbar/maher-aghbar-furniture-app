# Scheduling conflict audit (current worktree)

Snapshot of the **current local worktree** before the conflict-system fix. This document does not change behavior. Inspected:

- `apps/api/src/modules/scheduling/**`
- `apps/api/src/modules/production/**` (no allocation overlap detector)
- `apps/api/src/modules/tasks/**` (task lifecycle only; “conflict” there is BLOCKED/CANCELLED)
- `apps/mobile/src/features/scheduling/**`
- `apps/mobile/src/api/modules/scheduling.ts`
- `packages/database/prisma/schema.prisma` (`ProductionSchedule`, `ScheduleAllocation`, `ProductionOrder.priority`)

## CURRENT CONFLICT DEFINITION

A scheduling conflict is two `ScheduleAllocation` rows that:

- share the same non-null `employeeId`
- belong to a schedule with status `APPROVED` or `PROPOSED`
- have `plannedEnd >= now`
- overlap in time with **exclusive** endpoints:

`startA < endB AND startB < endA`

Therefore:

- `08:00–10:00` then `10:00–12:00` is **valid** (boundary touch)
- several orders on the same day for one worker are **valid** if windows do not overlap
- a full day (`8/8` hours) is **capacity**, not a conflict

Same-order internal overlap (two tasks, one worker, overlapping windows) **is** a conflict if the times overlap. Different workers never conflict. `resourceSlot`-only rows are **not** in today’s detector.

## CURRENT DETECTOR

`GET /scheduling/conflicts` → `SchedulingController.conflicts()` (`schedule.capacity.read`) → `SchedulingService.listConflicts()` in `scheduling.service.ts` (~2349–2408).

Load:

```
employeeId != null
plannedEnd >= now
schedule.status IN (APPROVED, PROPOSED)
```

Group by `employeeId`. All-pairs with `j = i + 1` (no A→B / B→A duplicate). Push `{ employeeId, employeeName, a, b }` where each side has `allocationId`, `productionOrderId`, `task` (task **name**), `start`, `end`.

Not filtered:

- latest schedule version per production order (calendar `buildOrderCards` **does** keep latest version)
- `COMPLETED` tasks whose `plannedEnd` is still in the future
- `isPinned` / `manuallyAdjusted`
- `resourceSlot` / department-only occupancy
- task status (`IN_PROGRESS` / `COMPLETED`)

Overlap math is the same exclusive formula used in `domain/capacity.ts`, `domain/schedule-validator.ts`, and `patchAllocation`. Inclusive-endpoint false positives are **not** a current bug.

`dashboardSummary()` sets `conflicts: conflicts.data.length` (pair count). Calendar `hasConflict` is true when the order id appears on either side of any pair (global, not day-scoped). `conflictReason` is never populated.

Planner prevention: `loadOccupancy()` + `CapacityTracker` during generate/recalculate. Soft-load occupancy (`tryReserve`) can already contain overlaps; pinned stages `forceReserve` and may persist them.

## CURRENT GROUPING

| Layer | Grouping |
| --- | --- |
| API | Flat pair list, internally grouped by worker |
| Pair identity | Implicit (`j = i + 1` + earlier `plannedStart` as `a`) — no stable `conflictId` |
| Mobile overlap rows | One row per pair; `id = allocationIdA-allocationIdB` |
| Mobile orders board | Unique calendar POs with `hasConflict` |
| Chip | **orders + overlap rows** (`selectConflictBarCount`) |

Primary object today is not “the collision.” Mobile cards hide `a.end` / `b.start` / `b.end` and show one calendar date plus task/PO chips.

## CURRENT RESOLVE LOGIC

There is **no** `POST /scheduling/conflicts/:id/resolve`.

Mobile Resolve calls `POST /scheduling/orders/:productionOrderId/recalculate` with `{ reason: 'resolve-conflict' }`.

Backend `recalculate()` → `generateForProductionOrder(..., { failHard: true })`. That replans **one entire order** against other orders’ occupancy. It does not:

- identify which allocation in the pair may move
- try another worker in the same window first
- refuse to persist a missed commitment
- re-detect that pair before returning success

`failHard: true` throws `SCHEDULE_REPLAN_FAILED` instead of writing `NEEDS_REVIEW`. Mobile catches the error and increments a fail counter with no structured reason.

Pinned / in-progress / completed stages are locked **inside generate** (`isPinned` or task status). Generate can still persist a plan that `forceReserve`s overlapping pins. Recalculate then “succeeds” while the overlap remains.

Manual `patchAllocation` can create overlaps when `override` + `schedule.override` is set. That path is not used by Resolve.

## CURRENT RESOLVE ALL LOGIC

There is **no** `POST /scheduling/conflicts/resolve-all`.

Mobile Resolve All collects unique production-order ids from either:

- calendar cards with `hasConflict`, or
- all overlap-row `productionOrderIds`

Then it loops `recalculateSchedule` sequentially. It does **not** re-detect after each move. Occupancy changes after the first replan, so later iterations apply a stale target list. Scroll is frozen via `bulkSnapshot` until the loop finishes; then one invalidate.

Success toast: “Overlapping work recalculated.” It does not report whether any pair disappeared.

## CURRENT PRIORITY BEHAVIOR

`ProductionOrder.priority` (`LOW` | `NORMAL` | `HIGH` | `URGENT`).

`comparePriority` / `sortWithFairness` in `domain/priority-fairness.ts`:

1. pinned
2. explicit priority
3. earlier committed delivery
4. earlier requested delivery
5. older `createdAt`
6. `id`

Used when the planner ranks **orders**. Not used by `listConflicts`. Not used by mobile Resolve order (array iteration / pair `a` then `b`). Recalculating the higher-priority order first can **move the keeper**, because occupancy still holds the lower-priority slot.

Priority does not permit double-booking in the planner’s placement loop. It also does not choose a winner when Resolve blindly replans both sides.

## CURRENT MOBILE PRESENTATION

Conflicts focus (`AdminSchedulingScreen.tsx`) is two boards:

1. **Orders with conflicts** — full `ScheduleOrderRow` (product, dealer, dates) + Conflict badge + Resolve (one PO).
2. **Worker overlap** — `ConflictFocusRow`: worker initials, name, **one** date (`a.start` ymd), task chips, PO chips, Resolve (both POs).

Missing on the overlap card: allocation A/B clocks, overlap window, overlap duration, stage-per-order, which task belongs to which PO, priority, suggested move.

Help captions say overlapping work is not a late date. They do **not** say same-day sequential work is allowed, or that full capacity is not a conflict.

Chip: `selectConflictBarCount(conflictOrderCards, conflictRows)` = orders + pairs. That can read as “55” when the API pair count is ~28.

`GET /conflicts` requires `schedule.capacity.read`. The screen opens with `schedule.read` **or** `schedule.capacity.read`, so the overlap board can be empty while `hasConflict` cards still show.

## Related surfaces (not conflict detectors)

- `schedule-validator.ts` `WORKER_OVERLAP` — intra-payload validation (used by patch).
- `CapacityTracker.hasOverlap` — planner occupancy, exclusive endpoints.
- Factory Capacity UI — hours remaining; must stay separate from conflicts.
- At-risk list — `NEEDS_REVIEW` / `materialRisk` / estimate review; delivery risk, not overlap.

## Implications for the fix

1. Overlap math is already correct; do not “fix” inclusive endpoints.
2. Count inflation is mostly presentation (orders + pairs), latest-version gaps, completed-but-future rows, and combinatorial pairs — measure with a categorizer, do not guess.
3. Resolve must become pair-level and must actually move one allocation, then re-detect.
4. Mobile must show the two windows and the overlap, using the existing floor aesthetic.
