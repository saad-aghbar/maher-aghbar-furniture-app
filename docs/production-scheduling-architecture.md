# Production Scheduling — Architecture

## Principle

One production engine. Scheduling is a planning layer on top of existing `ProductionOrder` → `ProductionStageInstance` → `ProductionTask` execution.

AI may propose effort. The deterministic scheduler alone calculates dates.

```
Dealer New Order / AI Intake
        │
        ▼
POST /scheduling/availability  (dealer-safe aggregate)
        │
        ▼
RFQ → Quotation → SalesOrder.confirm
        │
        ▼
Existing: create PO + stages + tasks
        │
        ▼
Apply ProductStageEstimate → estimatedMinutes
        │
        ▼
SchedulePlanner → ProductionSchedule PROPOSED + ScheduleAllocation[]
        │
        ▼
Admin approve / edit / pin / recalculate
        │
        ▼
APPROVED → committed dates mirrored on PO → notify dealer/workers
        │
        ▼
Worker timers / blockers → risk analysis → incremental replan (future only)
```

## Module layout

```
apps/api/src/modules/scheduling/
  scheduling.module.ts
  scheduling.controller.ts
  scheduling.service.ts          # orchestration
  dto/
  domain/
    working-calendar.ts
    duration-calculator.ts
    dependency-graph.ts
    capacity.ts
    worker-assignment.ts
    material-readiness.ts
    priority-fairness.ts
    schedule-planner.ts          # forward + backward
    schedule-validator.ts
    replanning.ts
    availability.ts
    promise-state.ts
```

Controllers stay thin. Domain functions are pure/testable where practical.

## Date semantics (never overwrite interchangeably)

| Field | Meaning |
|---|---|
| `requestedDeliveryDate` | What dealer asked for |
| `earliestAvailableDate` | Scheduler earliest feasible |
| `suggestedDeliveryDate` | Proposal shown pre-approval |
| `committedDeliveryDate` / `committedCompletionDate` | Admin-approved promise |
| `actualCompletionDate` | Factory finished |
| `actualDeliveryDate` | Physical delivery (Delivery entity) |

Schedule is source of truth for promise; `ProductionOrder.committedDeliveryDate` is a mirror for list filters.

## Dealer post-submit change policy

| Condition | Action |
|---|---|
| Not approved + not started | Direct preferred-date update → replan proposal → notify admin |
| Approved + not started | Change request only → admin re-approval → notify both |
| In production | Locked for dealer |

## Concurrency

Optimistic `version` on `ProductionSchedule`. Approve with stale version → `409 SCHEDULE_STALE`. Slot reservation inside Postgres transactions with row locks on active allocations.

## Background jobs

BullMQ queue `scheduling`: `SCHEDULE_GENERATE`, `SCHEDULE_REPLAN`, `SCHEDULE_RISK_ANALYSIS`, `SCHEDULE_ESTIMATE_STATS`. Failure → `NEEDS_REVIEW`; never drop the commercial order.
