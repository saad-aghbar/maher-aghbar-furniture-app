# Scheduling conflict closure report

Closes the conflict-system brief (sections 1–61) without rewriting the planner. Audit: [scheduling-conflict-audit.md](./scheduling-conflict-audit.md).

Live categorizer snapshot: **2026-08-15** local DB (`maher_erp`). Fixture 55 is the detector test, not this database.

## 1. Why the current conflict count was high

Exact read-only counts on 450 `APPROVED`/`PROPOSED` allocations:

| Category | Count |
| --- | ---: |
| Naive worker pairs (old detector: same `employeeId`, `plannedEnd >= now`, exclusive overlap, not latest-version-only, completed included) | **34** |
| Unique pair ids (`min:max`) | 34 |
| Duplicate A→B / B→A | **0** |
| Completed historical pairs (`COMPLETED` on either side) | **31** |
| Stale dual-version pairs (older `APPROVED`/`PROPOSED` still overlapping) | **0** |
| Manually adjusted pairs | **0** |
| Both-pinned pairs inside the naive set | 32 (almost all are the completed-history set) |
| Inclusive-endpoint / boundary-touching false positives (`08–10` vs `10–12`) | **0** (math was already exclusive) |
| Resource-slot rows treated as workers | **0** |
| Real active worker overlaps (latest schedule, completed excluded) | **3** |
| Real active resource-slot overlaps | **0** |
| Affected production orders (active set) | **6** |
| Old Mobile chip (`pairs + hasConflict orders`) | **54** (34 + 20 naive-affected orders; the “55” chip matches this plus one calendar-only order, or the fixture below) |

High-count **fixture 55** (detector test 55): 10 overlapping live allocations → **45** unique pairs (`C(10,2)`), plus **10** affected orders. Old chip = 45 + 10 = **55**. After the fix the chip is **45** (unique active pairs only).

The operational number was never 55 live overlaps. It was completed history + chip double-count + combinatorial pairs.

## 2. Active conflict definition

A conflict is an **invalid physical overlap** on the same worker or the same finite resource slot.

- Overlap: `A.start < B.end && B.start < A.end`
- Adjacent `08:00–10:00` / `10:00–12:00` is valid
- Several orders on the same day for one worker are valid if windows do not overlap
- Full day (`8/8`) is **capacity**, never a conflict
- Late / at-risk is **delivery risk**, never a conflict
- Same order, two overlapping tasks on one worker: still a conflict
- Different workers or different resource slots: not a conflict

Detector: [`apps/api/src/modules/scheduling/domain/conflict-detector.ts`](../apps/api/src/modules/scheduling/domain/conflict-detector.ts).

## 3. Historical-conflict behavior

`COMPLETED` and `CANCELLED` allocations are excluded from the operational set even when `plannedEnd` is still in the future. They are not on `GET /conflicts`, not in `dashboard.conflicts`, and not in the Mobile chip.

No separate history list was added. The categorizer proved the inflation; a history UI was not required.

## 4. Deduplication behavior

Pair id is `min(allocationId) + ':' + max(allocationId)`. One overlap appears once. Latest `APPROVED`/`PROPOSED` schedule version per production order only. Stale dual versions are ignored.

## 5. Conflict API changes

`GET /scheduling/conflicts` (`schedule.read` or `schedule.capacity.read`) returns:

```
{ data, count, affectedOrderCount }
```

`count === data.length` = unique active operational conflicts. Each item is the **collision** (type, worker/resource, overlap window/minutes, allocation A/B with order number, stage, clocks, priority, pin, task status).

`dashboard.conflicts` and calendar `hasConflict` use this same list.

New write endpoints (`schedule.manage`):

- `POST /scheduling/conflicts/:conflictId/resolve` (`conflictId` is `uuid:uuid`; clients must `encodeURIComponent`)
- `POST /scheduling/conflicts/resolve-all`

## 6. Resolve behavior (A → B → C)

Pair-level. Does **not** loop `recalculate` on both orders. Does **not** edit `schedule-planner.ts` placement.

1. Reload detector. Gone → `ALREADY_RESOLVED` (no second move).
2. `comparePriority` picks the keeper. Completed / in-progress / blocked / pinned are fixed.
3. Both fixed → `MANUAL_LOCKED` (no persist).
4. Placement via existing `CapacityTracker`, `listEligibleWorkers`, `earliestFit`, `WorkingCalendar`:
   - **A** — another eligible worker, **same** window
   - **B** — same worker, next valid working slot
   - **C** — any eligible worker + valid time
5. Persist by calling existing `generateForProductionOrder` on the **movable PO only**, with `pinOverrides` so the chosen window/worker is held for that generate, then `keepPinned` restores the original pin flag (resolve pins are temporary).
6. `abortIfMissesCommitment`: if the proposed plan would finish after `committedDeliveryDate`, throw `WOULD_MISS_COMMITMENT` **before persist**.
7. Re-run the detector. Pair still present → `NO_ALTERNATIVE` (honest failure).
8. Audit `schedule.conflict.resolve` plus `schedule.allocation.reassigned` or `schedule.allocation.rescheduled`.

## 7. Resolve All behavior

Sort with the same `comparePriority` (keeper rank, then `conflictId`). Resolve one → reload occupancy → re-detect → next. Failures are skipped (`skip` set), cap 100, no stale 55-long list. Returns `{ resolvedCount, failedCount, alreadyResolvedCount, remainingConflictCount, results[] }`. Audit `schedule.conflict.resolve_all`.

Mobile no longer loops `POST /scheduling/orders/:id/recalculate` for conflicts.

## 8. Priority behavior

Reuses [`comparePriority`](../apps/api/src/modules/scheduling/domain/priority-fairness.ts): pinned/fixed → URGENT/HIGH/NORMAL/LOW → earlier committed → earlier requested → older `createdAt` → id.

Higher priority **keeps** scarce capacity. It never permits double-booking. Help copy states this. Mobile shows a priority chip only when the two sides differ or one is HIGH/URGENT, using translated `mobile.production.priority.*` labels (never raw enums).

## 9. Locked allocation behavior

`isPinned` / manual lock: do not auto-move. One locked + one movable → the movable moves. Both locked → `MANUAL_LOCKED`. Mobile: “Both tasks are locked.”

## 10. In-progress behavior

`IN_PROGRESS`, `BLOCKED`, and `COMPLETED` are fixed. The other side moves if it can. Completed work is never rewritten.

## 11. Mobile card redesign

Conflicts focus is **one** `ScheduleOrdersBoard` (danger tone). No second equal “orders with conflicts” board.

Each `ConflictFocusRow` reuses the floor card (3px error rail, initials, `MetaChip`, `orderBoardShadow`):

- Translated type chip (Worker overlap / Resource conflict / …)
- Worker name + stage
- Order A number + clock, Order B number + clock (`dir="ltr"`)
- Overlap window + duration
- Priority chip only when useful
- Review (ghost) + Resolve (brand)

Chip count = API `count` only (`selectConflictBarCount` is unique length, never orders + rows).

Caption: `{n} conflicts · affecting {orders} production orders` (Arabic plurals). Short disclosure under the list: same-day sequential work is allowed.

## 12. Conflict detail sheet

`ConflictReviewSheet` uses the existing `BottomSheet` + floor card + `SheetFooter`. Shows type, worker, “two tasks at the same time,” TASK 1 / TASK 2 (product, PO, stage, window, priority, delivery), overlap + duration, suggested resolution (lower-priority task moves), Review schedule, Resolve.

Success toast: moved to `{start}–{end}` or reassigned to `{name}`. Card disappears after refetch. Failure keeps the card and shows a structured reason.

## 13. Help / explanation UX

Info icon on the conflicts board header opens `ConflictHelpSheet` (`ConfirmCopyBoard` + captions):

- Same-day work is allowed
- Overlap = conflict
- Full = capacity
- At risk = late
- Priority does not allow double-booking

Capacity / Conflict / Delivery risk stay three concepts.

## 14. Before conflict count

Local DB, old detector + old chip:

- Naive pairs: **34**
- Naive-affected orders: **20**
- Chip (pairs + orders): **54** (~55)

## 15. After conflict count

Same DB, new detector + new chip:

- Active operational conflicts: **3**
- Affected orders (caption only): **6**
- Chip: **3**

## 16. Tests

API scheduling Jest: **122 passed** (detector 42–46 / 53 / 55, resolve 47–54, capacity UAT, planner, wiring).

Mobile: selector + i18n + catalog-parity **70 passed** in the scheduling/i18n suites.

Typecheck: `@maher/api` and `@maher/mobile` clean.

Expo Doctor: **18/18**.

`@maher/i18n` rebuilt before i18n assertions.

Factory lifecycle 88/88 was **not** re-run (planner untouched; conflict API is additive).

## 17. EN / AR / HE

New and rewritten keys live under `mobile.adminScheduling.conflicts.*` in en/ar/he together. Resolve copy no longer says “Recalculate.” Error codes `MANUAL_LOCKED`, `NO_ALTERNATIVE`, `WOULD_MISS_COMMITMENT` are in `errors.json` for all three locales. Interpolation covered for `{name}`, `{number}`, `{start}`, `{end}`, `{hours}`, `{minutes}`, `{conflicts}`, `{orders}`, `{count}`. Catalog parity holds. No raw enums in UI.

## 18. RTL / theme

`isRTL ? row-reverse : row`, leading rail flips, `textAlign` follows locale, Arabic title weight medium / no uppercase / no letter-spacing on initials. Colors are `useTheme()` tokens only (`error` / `errorSoft` for overlap, existing brand pills). Light and dark inherit the floor tokens.

## 19. Remaining limitations

- Resolve placement is a thin wrapper (A/B/C) then existing generate for the movable order. Downstream stages on that order are replanned; the keeper order is not rewritten.
- `INVALID_SKILL`, `CLOSED_DAY_ALLOCATION`, and `INACTIVE_WORKER_ALLOCATION` are translated in the UI but the detector does **not** emit them (categorizer found no such operational rows). `LOCKED_CONFLICT` is a resolve-failure reason, not a list type.
- Stage/day over-capacity without a worker or finite-slot pair stays on the Capacity UI (`RESOURCE_OVERLAP` only when the same slot actually overlaps).
- Admin-web was not redesigned; it consumes the additive `dashboard.conflicts` / `hasConflict` contract.
- Historical completed overlaps are invisible on the dashboard by design.
- Three live worker overlaps remain until an admin Resolves them (or they finish). Resolve will refuse if both sides are locked or the move would miss a commitment.
- Factory 88/88 smoke was not re-run in this change.

## Definition of Done

An Admin can see, without opening two full orders:

- Multiple orders can run on the same day
- A worker can work on several orders per day
- Full capacity is not a conflict
- A conflict means two tasks physically overlap on the same worker/resource
- Which worker, which two tasks/orders, which stage
- Exactly what time overlaps, and for how long
- Which task should move (priority / locks)
- What Resolve changed, or why it could not

**Conflict ≠ busy ≠ late.** Busy is capacity. Late is risk. Conflict is an invalid physical overlap or invalid allocation.

## PAST-SAFE

Resolve one / resolve-all will not move a side into a slot before
`resolveSchedulingFloor`. IN_PROGRESS may keep its window. Completed history
is not rewritten. See [scheduling-past-floor-closure-report.md](./scheduling-past-floor-closure-report.md).

