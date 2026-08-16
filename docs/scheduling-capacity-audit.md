# Scheduling capacity audit (code inspection)

Snapshot of the **current local worktree** scheduler. This document does not change the engine. Runtime evidence for Tests A–Z lives in [scheduling-worker-capacity-uat.md](./scheduling-worker-capacity-uat.md).

## Module map

```
apps/api/src/modules/scheduling/
  scheduling.controller.ts      POST /scheduling/*
  scheduling.service.ts         orchestration, persist, occupancy, risk
  scheduling-queue.ts           BullMQ producer (no-op without REDIS_URL)
  dto/scheduling.dto.ts
  domain/
    schedule-planner.ts         forwardSchedule / backwardSchedule
    capacity.ts                 CapacityTracker (per-employee occupancy)
    worker-assignment.ts        WorkerSkill eligibility
    working-calendar.ts         FactoryCalendar math
    duration-calculator.ts      quantity scaling
    dependency-graph.ts         DAG layers, merge wait
    priority-fairness.ts        order sequence
    material-readiness.ts       BOM vs inventory
    schedule-validator.ts       overlap / calendar / pin
    promise-state.ts
    dealer-change-policy.ts
```

Prisma models: `FactoryCalendar`, `FactoryCalendarException`, `ProductionSchedule`, `ScheduleAllocation`, `WorkerSkill` in [`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma) (~2336–2453).

## Current algorithm

Deterministic finite-capacity heuristic. No LLM in the date path.

**Forward** (`forwardSchedule`, [`schedule-planner.ts`](../apps/api/src/modules/scheduling/domain/schedule-planner.ts) ~205): sort orders with fairness; for each order, `baseStart = max(now, materialReadyAt, productionReadyAt)`; walk DAG layers; for each stage pick the eligible worker whose `earliestFit` is soonest; reserve occupancy.

**Backward** (`backwardSchedule`, same file ~440): if `requestedDeliveryDate` is set, target = that instant minus `bufferMinutes`; place reverse-DAG latest-feasible slots that do not overlap and are not before `baseStart`. If placement fails, **fall back to forward** and set `requestedDateFeasible=false`.

**Runtime mode** ([`scheduling.service.ts`](../apps/api/src/modules/scheduling/scheduling.service.ts) ~980–983): generate uses backward when `ProductionOrder.requiredDeliveryDate` is set (unless `opts.mode` overrides). Availability always runs forward for earliest, then backward for feasibility (~603–611).

`generateForProductionOrder` plans **one PO** against `loadOccupancy()` of other `APPROVED`/`PROPOSED` allocations. It does not re-optimize the whole factory in one pass.

## Requested delivery date

| Layer | Field | Location |
|---|---|---|
| API enter | `requiredDeliveryDate` | `POST /requests`, `PATCH /requests/:id` — [`request.dto.ts`](../apps/api/src/modules/requests/dto/request.dto.ts) |
| DB | `RequestForQuotation.requiredDeliveryDate` | schema ~1317 |
| Copy | quotation accept → `SalesOrder.requiredDeliveryDate` | [`quotations.service.ts`](../apps/api/src/modules/quotations/quotations.service.ts) |
| Confirm | `ProductionOrder.requiredDeliveryDate` | [`sales-orders.service.ts`](../apps/api/src/modules/sales-orders/sales-orders.service.ts) ~1066 |
| Pre-check | DTO `requestedDeliveryDate` | `POST /scheduling/availability` |
| Planner | `PlannerOrderInput.requestedDeliveryDate` | mapped from `po.requiredDeliveryDate` (~966) |
| Persist | `ProductionSchedule.requestedDeliveryDate` | schema ~2379 |
| Feasible flag | `requestedDateFeasible` | planner result / availability JSON **only** — no DB column |
| Commit | `committedDeliveryDate` | written on **approve**, not generate |
| Logistics | `Delivery.deliveryDate` | **not** copied from requested/committed dates |

After confirm, `SalesOrdersService.confirm` calls `scheduling.generateForProductionOrder` (~1114–1117). Failure marks `NEEDS_REVIEW` and does not roll back the commercial order.

**Is the requested date a real planning constraint?** Yes, when present on generate: backward from `requestedDeliveryDate − buffer`. Hybrid: infeasible → forward fallback.

Dealer date change: `POST /scheduling/orders/:id/dealer-date`.

## Worker capacity model

`loadWorkers()` (~663–681): `User.isActive`, `archivedAt: null`, role kind `PRODUCTION_WORKER`, active `WorkerSkill`s.

Capacity is **per-employee occupancy**, not headcount and not a global factory-hours number.

- `CapacityTracker` ([`capacity.ts`](../apps/api/src/modules/scheduling/domain/capacity.ts)): `hasOverlap` / `earliestFit` / `reserve`.
- Existing work: `loadOccupancy()` (~684–702) loads other POs’ future `APPROVED`/`PROPOSED` allocations with `employeeId` set.
- Adding a skilled active production worker increases the candidate set on the next generate/recalculate.
- Deactivating a user drops them from `loadWorkers`. Already-written future allocations remain until recalculate.

**Department fallback:** if `listEligibleWorkers` is empty, the planner still places a `DEPARTMENT` allocation with `employeeId: null` and **does not reserve worker capacity** ([`schedule-planner.ts`](../apps/api/src/modules/scheduling/domain/schedule-planner.ts) ~89–107, ~300–314).

**UI `listCapacity`** (~1798–1851): `department._count.users × shift minutes`. Not skill-filtered. Reporting only; not the planner.

**No hardcoded daily factory capacity.** Calendar defaults (08:00–16:00, lunch, Fri closed) define working time, not a capacity cap. Stage fallback duration uses `Math.max(30, estimatedHours*60)`. `ProductStageEstimate.workerCountRequired` is unused by the engine.

Manual `tasks.service` assign checks active employee only — not skill, not overlap.

## Worker skill model

[`worker-assignment.ts`](../apps/api/src/modules/scheduling/domain/worker-assignment.ts): eligible = active AND (`stageDefinitionId` in `skillStageDefinitionIds` when a stage is required). Department code is ignored. Empty skills + required stage → ineligible.

Prisma `WorkerSkill.proficiency` is unused by the planner.

Synced from employee stage-skill UI: [`users.controller.ts`](../apps/api/src/modules/users/users.controller.ts) `syncWorkerSkills`.

## Parallelism

[`dependency-graph.ts`](../apps/api/src/modules/scheduling/domain/dependency-graph.ts): topological layers; siblings share a layer; `mergeWaitInstant` = max(parent ends).

Workflow parallelism ≠ physical parallelism: two stages in one layer still serialize if they compete for the same worker (`CapacityTracker`). Separate eligible workers can overlap in time.

## Material / WIP readiness

Domain `assessMaterialReadiness` ([`material-readiness.ts`](../apps/api/src/modules/scheduling/domain/material-readiness.ts)): fabric/wood/foam BOM vs on-hand; never invents supplier ETAs; shortfall without `readyAt` → `risk: true`.

Planner **can** delay via `order.materialReadyAt` / `order.productionReadyAt` (`schedule-planner.ts` ~167–171, ~369–373).

**Generate wiring gap:** `buildAndPersistSchedule` does **not** set those fields on `PlannerOrderInput` (~961–970). `assessLiveMaterialReadiness` (~707–741) runs **after** placement, stores `materialRisk` / `materialReadyAt` on the schedule, and may set PO `WAITING_FOR_MATERIALS`. Inventory `readyAt` is never passed (on-hand qty only).

WIP: `assessWipReadiness` (~744–776) checks snapshot `consumesSemiFinished` vs `InventoryLot` semi-finished qty. If missing, readiness `ready: false, risk: true` — still **not** passed as `productionReadyAt`. WIP is order-level, not per-downstream-stage in the planner.

## Working calendar

[`working-calendar.ts`](../apps/api/src/modules/scheduling/domain/working-calendar.ts) + `FactoryCalendar` / exceptions.

Defaults ([`scheduling.service.ts`](../apps/api/src/modules/scheduling/scheduling.service.ts) ~84–99, schema ~2336): timezone `Asia/Amman`, weekdays Sun–Thu + Sat (Fri closed), `08:00–16:00`, lunch `12:00–13:00` → **7 working hours/day**, not 8.

`HOLIDAY` / `SHUTDOWN` → empty intervals. `EXTRA_SHIFT` opens or extends a day; lunch is kept. `addWorkingMinutes` / `subtractWorkingMinutes` span across days and skip closed capacity.

Calendar updates call `replanActiveSchedules` (~168–184).

## Quantity scaling

[`duration-calculator.ts`](../apps/api/src/modules/scheduling/domain/duration-calculator.ts):

| Mode | Formula |
|---|---|
| LINEAR | `ceil(minutesPerUnit * qty)` |
| FIXED | `ceil(fixedMinutes)` (qty ignored) |
| SETUP_PLUS_LINEAR | `ceil(setup + minutesPerUnit * qty)` |
| BATCH | `ceil(ceil(qty/batchSize) * batchMinutes)` |
| PARALLEL_CAPACITY | `ceil(setup + ceil(qty/maxParallel) * minutesPerUnit)` |

Generate prefers product `ProductStageEstimate`, else snapshot `estimatedMinutes`, else task, else `max(30, stageDefinition.estimatedHours * 60)` (~905–918).

Buffer: `round((productionProfile.bufferPercent ?? 10) / 100 * totalMinutes)` (~958–969). Used only as backward target offset.

Workflow snapshot: skipped nodes omitted; edges become `dependsOnCodes` (~865–895).

## Conflict handling

`validateSchedule` ([`schedule-validator.ts`](../apps/api/src/modules/scheduling/domain/schedule-validator.ts)): invalid window, non-working start (WARNING), pinned move (CONFLICT), parent-before-child, `WORKER_OVERLAP`.

`patchAllocation` validates **the current order’s allocations only** (~1403–1428). Cross-order occupancy is enforced on the **next** generate via `loadOccupancy`, not at patch time unless those other rows are in the same validation set.

`listConflicts` (~1854) pairwise future employee overlaps on active schedules.

`CapacityTracker` constructor **soft-loads** overlapping seed occupancy (`tryReserve`) so dirty snapshots do not abort recalculate.

## Replanning

| Trigger | Behavior |
|---|---|
| generate / recalculate | New `PROPOSED` version; supersede DRAFT/PROPOSED/APPROVED/NEEDS_REVIEW |
| Calendar change | `replanActiveSchedules` |
| Dealer date (policy allows) | re-generate |
| Admin move-to-day | `shiftScheduleToDate` (delta shift, else forward from that day) |
| Task start/pause/complete | enqueue `REPLAN` — **worker is a no-op**; no Redis → producer no-op ([`scheduling-queue.ts`](../apps/api/src/modules/scheduling/scheduling-queue.ts), [`apps/worker/src/main.ts`](../apps/worker/src/main.ts) ~58–62) |
| Task blocker | set `materialRisk`, notify, enqueue `RISK_ANALYSIS` (also no-op in worker) |
| Planner throw | `markNeedsReview` → empty `NEEDS_REVIEW` / `AT_RISK` unless `failHard` |

Pinned + `IN_PROGRESS` / `COMPLETED` / `BLOCKED` task windows are treated as pinned (~926–932).

No dedicated scanner that compares `plannedEnd` vs `committedDeliveryDate` to mark Late.

Promise mapping: [`promise-state.ts`](../apps/api/src/modules/scheduling/domain/promise-state.ts) — APPROVED+atRisk → `AT_RISK`; NEEDS_REVIEW → `AT_RISK`.

## Priority / sequence

[`priority-fairness.ts`](../apps/api/src/modules/scheduling/domain/priority-fairness.ts): pinned → URGENT/HIGH/NORMAL/LOW → earlier committed → earlier requested → earlier createdAt → id. Same pin+priority tier: round-robin by `customerId`.

This sort runs when **multiple orders are passed to the planner**. Runtime generate passes a **single** order, so factory contention is **first-generated occupancy wins**.

## ProductionTask planned windows

Persist loop (~1025–1051) writes `ScheduleAllocation` and updates `ProductionTask.plannedStart` / `plannedCompletion` / `estimatedMinutes`, and `assignedEmployeeId` when unset.

## Existing tests (pre-UAT)

Domain units under `apps/api/src/modules/scheduling/domain/__tests__/`: planner, calendar, duration, graph, skills, fairness, dealer policy, scenario suite.

Service: [`scheduling-policy.integration.test.ts`](../apps/api/src/modules/scheduling/__tests__/scheduling-policy.integration.test.ts) (mocked Prisma, dealer-date policy).

No prior test asserted 1-worker 8h packing, 50/2 skill isolation, or generate omitting `materialReadyAt`.
