# Factory replan occupancy fix

Live proof: `pnpm smoke:dynamic-replan-uat` against `http://localhost:4000` + `maher_erp` on 2026-08-15. Jest is not proof. Planner placement (`forwardSchedule` / `backwardSchedule`) was not changed.

## Test T root cause (before the occupancy loop)

Instrumented factory-wide increase run `e5833eb9-64af-4842-a668-3ff37f458f2f` (open 2026-08-16): `considered=54`, `moved=50`, **1 new** `WORKER_OVERLAP`.

`processFactoryReplan` called `generateForProductionOrder` with **no run-scoped occupancy**. Each generate `loadOccupancy(po.id)`:

1. Reloaded DB (`APPROVED`|`PROPOSED`, `plannedEnd >= now`) and excluded the current PO.
2. Built a throwaway `CapacityTracker` whose constructor **`tryReserve`s seed intervals and silently drops overlaps**. Live snapshots had ~621 intervals with **`seedDropped` ~26–28** every candidate. Pre-existing overlaps punched holes; the planner booked time still occupied in DB.
3. Employee-present rows skipped resource-slot occupancy (`if employeeId else if resourceSlot`).
4. Persist was a later `$transaction` with **no collision check**. End of run never diffs conflict identities.

The new pair was worker `2d6b5be1-…`, overlap `2026-08-27T08:50Z–08:55Z`, order A `ffc69469-…` (not a candidate) vs order B `45256d1d-…` (candidate index 2). Candidate 2 booked into time a `forceReserve` tracker still held.

A second false-fail mode: regenerating a PO that already sat in a baseline overlap **minted new allocation ids**, so `conflictId` (`allocA:allocB`) looked new even when the worker/order/window was unchanged.

## Occupancy before / after

| | Before | After |
|---|---|---|
| Seed | Per-candidate `loadOccupancy` + constructor `tryReserve` (holes) | One `loadOccupancy()` then **union-merge** per worker/resource key |
| Current PO | Excluded in SQL | Strip `productionOrderId` from the shared list |
| Resource slots | Dropped when `employeeId` set | Dual emit: employee **and** `resource:{stageId}:{slot}` |
| Accept | Persist then hope the next DB reload sees it | Validate `hasOverlap` vs shared occupancy **before** `$transaction`; retry planner once; skip persist on remaining collision; on accept, replace that PO’s intervals immediately |
| Unchanged plan | New version + new allocation ids | Skip persist when task/start/end/employee/slot match |
| End of run | No overlap gate | `newConflictCount` / `newConflictIds` using **worker + orders + overlap window**, not allocation ids |
| Concurrency | Overlapping `REPLAN_FACTORY` could pack independently | Worker `concurrency: 1`, in-process job chain, wait for a **fresh** `RUNNING` row (stale `RUNNING` >20 min reaped) |

`pg_advisory_lock` was **not** kept: Prisma pooling can take the lock on one connection and unlock on another, which left factory jobs `QUEUED`. Serialization is the worker + `RUNNING` guard.

## DB vs in-memory sync

Shared occupancy starts as a DB snapshot (`APPROVED`|`PROPOSED`). After a successful generate, intervals come from the returned schedule (`employeeId` or nested `employee.id`, plus resource key). Collision skips leave the prior schedule. Pre-existing overlaps stay blocking because union-merge covers the occupied union instead of dropping the second interval.

## Priority

Candidate order is still `compareFactoryReplanCandidates` / existing urgency. Occupancy does not reorder. Committed dates stay `committedDeliveryDate ?? requiredDeliveryDate`. A physically valid plan that misses commitment is persisted; `classifyProductionOrder` marks AT_RISK/LATE. Overlaps are never kept to “make” a date.

## Validation

`validateAgainstOccupancy` runs after the planner, before persist. One retry uses the same occupancy (no hand-placement). Remaining collisions are recorded in `result.failures` as `OCCUPANCY_COLLISION:…` and increment `stillNeedsAttention`. The run stays `COMPLETED` if it started.

## Concurrency / Test Q

BullMQ scheduling worker `concurrency: 1`; in-process fallback is chained. Reprocessing a `COMPLETED` runId is a no-op (wiring Test Q). Live Q: extra-shift upsert did not duplicate active versions (`1→1` allocs `9→9`, `newConflictCount=0`).

## T before / after (live)

| | Before fix | After fix |
|---|---|---|
| Run | `e5833eb9-64af-4842-a668-3ff37f458f2f` | `f027be5c-30ae-491c-b9a7-6200cdd28b05` |
| TEST T | **FAIL** | **PASS** |
| New overlaps | 1 `WORKER_OVERLAP` | **0** |
| RESOURCE_OVERLAP new | 0 | **0** |
| Orders moved | 50 | **24** (colliding candidates not persisted) |
| `newConflictCount` | 1 (allocation-id diff) | **0** |
| Pre-existing operational conflicts | 2 | 2 (unchanged count) |

## U harness

U runs **immediately after H, before I**. Closed-day check uses `calendar.isWorking === false` and only DRUAT `closeUnpinned` / `pinnedClose` POs. `pinYmd` (2026-08-29) ≠ `dayI` (2026-08-26). **TEST U: PASS** (`unpinnedOnClosed=0`, pinned exception reported).

## I isolation

`dayI` is squeezed in setup and is not the pin day. HIGH vs NORMAL are generated **just before** opening that day. Live result: **PARTIAL** — `highOnI=false normOnI=false movedIds=[]`. After that generate, HIGH was `AWAITING_APPROVAL` / not at-risk, so increase policy skipped it; NORMAL was AT_RISK but the opened 08:00–16:00 day did not take the slot. Not a new-overlap defect; not a planner rewrite.

## Z

Z uses its own pre-snapshot (`newVsZ`). **TEST Z: PASS** (`orders=16`, `moved=22`, `newVsZ=0`, `newConflictCount=0`).

## Remaining J / K (not fixed)

- **J BLOCKED:** live generate has no `materialReadyAt` (inventory map has no `readyAt`; UAT-SOFA stock is sufficient). Follow-up: `loadInventoryAvailability` / `assessLiveMaterialReadiness`.
- **K PARTIAL:** generate scheduled downstream while producers may be incomplete (`assessWipReadiness` only unschedules after producers complete). Follow-up: WIP gating on generate, not calendar occupancy.

## Regression (not live proof)

- API: factory-replan / calendar-open-day / conflict-detector / conflict-resolve / capacity UAT / at-risk / working-calendar Jest; `pnpm --filter @maher/api typecheck`
- Mobile: scheduling + calendar Jest (113); `pnpm --filter @maher/mobile typecheck`
- Factory lifecycle 88/88 not re-run in this occupancy closure
