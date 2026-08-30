# Scheduling capacity optimization — Phase A closure report

Admin **Optimize capacity** is a separate action beside Sync. Sync stays
repair-only. The planner core, occupancy loop, dealer dates, worker
scheduling, WIP, and QC were not rewritten.

Live UAT: **2026-08-22** `maher_erp`, timezone `Asia/Amman`.
`pnpm smoke:scheduling-optimize-uat` → **30/30 PASS**.

## 1. What shipped

- Calendar settings: `maxProductionEarlyWorkingDays` default **10**,
  `targetFactoryUtilizationPercent` default **85**. Utilization is a
  reporting ceiling, not a fake capacity cap. Changing only these two
  fields does not enqueue factory replan.
- `POST /api/v1/scheduling/optimize/preview` (read-only) and
  `POST /api/v1/scheduling/optimize/apply` (persist). Both enqueue
  `REPLAN_FACTORY` with `capacityDelta: 'optimize'`.
- Same-type in-flight run joins `alreadyInProgress`. Any other factory
  run (Sync, calendar) returns **409** `OPTIMIZE_ALREADY_IN_PROGRESS`.
- Preview = `simulatePolicy('N_DAY', maxProductionEarlyWorkingDays)`.
- Apply revalidates each candidate with
  `generateForProductionOrder({ mode: 'forward', earlyWindowWorkingDays,
  validateAgainstOccupancy, abortIfMissesCommitment })`. Default generate
  and Sync stay backward for dated orders.
- Admin mobile + web: second button **Optimize capacity** /
  **تحسين استغلال الطاقة** / **ייעול ניצול הקיבולת**. Preview then Apply.
  Empty-day causes use human copy, not raw engine codes.
- Dealer and worker screens unchanged.

## 2. Live UAT scoreboard

| Check | Result |
|---|---|
| Warehouse / worker cannot optimize | 403 `schedule.manage` |
| Calendar defaults 10 / 85 | Present |
| Preview completed, mode `preview` | PASS |
| Preview new conflicts | **0** |
| Preview did not change dealer dates | PASS |
| Apply completed, mode `apply`, outcome `CHANGED` | PASS |
| Apply new worker / resource / total conflicts | **0 / 0 / 0** |
| Apply moved vs preview | **9 / 9** (not above preview) |
| Dealer requested / committed dates | Unchanged |
| Second apply | `UP_TO_DATE`, moved **0** |
| Cedar (`PO-2026-00056`) order-wide velvet floor | No alloc before `2026-08-18T07:00:00.000Z` |
| Sync after optimize | COMPLETED, **0** new conflicts |
| Walkthrough dealer dates after optimize+sync | Unchanged |
| PAST-SAFE | New incomplete work cannot start before `resolveSchedulingFloor` (N-day clamped to floor) |

Evidence: `tmp-scheduling-optimize-uat.json`.

## 3. What did not move

Healthy backward ON_TRACK work that is already inside the max-early
window stayed put. Remaining idle days in the front of the horizon are
mostly `CAPACITY_POLICY` (N-day floor) or `NO_ORDERS`. That is expected:
Optimize must not finish dated work more than 10 working days early.

Cedar remains packed to 3 Sep under the **order-wide** material floor.
Stage-specific velvet-on-upholstery only is Phase B.

## 4. Gate

Phase A live UAT **passed**. Phase B (stage-specific raw MRP) is
unblocked.
