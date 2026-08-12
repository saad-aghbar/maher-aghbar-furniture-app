# Production Scheduling — Overview

How scheduling works **in this codebase today** (not a roadmap). Scheduling is a planning layer on top of existing `ProductionOrder` → `ProductionStageInstance` → `ProductionTask` execution. Dates come from the deterministic planner; AI may only propose effort for human review.

## Module path

```
apps/api/src/modules/scheduling/
  scheduling.module.ts
  scheduling.controller.ts      # /api/v1/scheduling/*
  scheduling.service.ts         # orchestration + persistence
  scheduling-queue.ts           # BullMQ producer (optional Redis)
  dto/scheduling.dto.ts
  domain/                       # pure planner / policy / calendar
    schedule-planner.ts         # forwardSchedule / backwardSchedule
    priority-fairness.ts
    working-calendar.ts
    duration-calculator.ts
    dependency-graph.ts
    worker-assignment.ts
    capacity.ts
    material-readiness.ts
    schedule-validator.ts
    promise-state.ts
    dealer-change-policy.ts
    types.ts
```

Wired into Nest via `SchedulingModule` (`app.module.ts`). Sales-order confirm and task lifecycle call into `SchedulingService`.

## Data models

Prisma section `// ─── Production scheduling` in `packages/database/prisma/schema.prisma`:

| Model | Role |
|---|---|
| `ProductProductionProfile` | Per-product enablement, buffer %, lead time, complexity |
| `ProductStageEstimate` | Per product × stage minutes + scaling mode |
| `FactoryCalendar` / `FactoryCalendarException` | Working week, shift, breaks, holidays |
| `ProductionSchedule` | Versioned plan + promise fields for a PO |
| `ScheduleAllocation` | Planned windows (employee/department), pin flags |
| `WorkerSkill` | User ↔ stage skill for auto-assign eligibility |
| `SchedulingEstimateProposal` | Pending estimate proposals (human approve) |
| `StageEstimateStat` | Learned actual vs estimate stats |

`ProductionOrder.committedDeliveryDate` / `plannedStartDate` mirror approved schedule windows for list filters. Tasks carry `plannedStart` / `plannedCompletion` from allocations.

See [scheduling-database-changes.md](./scheduling-database-changes.md) and [production-scheduling-data-model.md](./production-scheduling-data-model.md).

## Sales-order confirm hook

On SO confirm, after each production order (+ stages/tasks) is created, `SalesOrdersService` calls:

```ts
scheduling.generateForProductionOrder(productionOrder.id, userId)
  .catch((err) => scheduling.markNeedsReview(...))
```

(`apps/api/src/modules/sales-orders/sales-orders.service.ts`). Failure never blocks the commercial order; the schedule is marked `NEEDS_REVIEW`.

## Availability (dealer-safe)

`POST /scheduling/availability` (`schedule.availability.own` or `schedule.manage`):

- Loads product profiles + stage estimates (or stage-definition fallback).
- Runs `forwardSchedule` for earliest completion; if a preferred date is sent, also `backwardSchedule` for `requestedDateFeasible`.
- Returns aggregate dates/feasibility/alternatives only — no workers, departments, or capacity numbers.

Used by customer portal + mobile new-order flows.

## Approve

`POST /scheduling/orders/:productionOrderId/approve` (`schedule.approve`):

- Optimistic concurrency: body `version` must match latest schedule or `409 SCHEDULE_STALE`.
- Allowed from `PROPOSED` or `NEEDS_REVIEW`.
- Sets schedule `APPROVED` / promise `CONFIRMED`, supersedes prior approved rows, mirrors committed dates onto the PO, notifies dealer + workers with tasks starting today.

## Dealer change policy

Domain: `resolveDealerChangePolicy` (`dealer-change-policy.ts`). Service: `dealerDateChange`.

| State | Dealer action |
|---|---|
| Not approved + not started | Direct preferred-date update → replan proposal → notify admin |
| Approved (`CONFIRMED`/`AT_RISK`/`RESCHEDULED`) + not started | Change request only (no direct commit) |
| In production / completed / cancelled | Locked |

Endpoint: `POST /scheduling/orders/:id/dealer-date` (`schedule.request-change.own` or `schedule.manage`).

## AI estimate stub

`SchedulingService.acceptAiEstimateProposal` creates a `SchedulingEstimateProposal` with `status: PENDING`. It is **not** wired from AI intake (extraction has no complexity/effort fields yet). Human acceptance goes through `acceptSuggestedEstimate` / `POST estimate-proposals/:id/accept`. Never auto-approves dates.

## Worker timers → replan

`TasksService` notifies scheduling on lifecycle events via `scheduling.onTaskLifecycle(taskId, event)`:

- **blocker** → sets `materialRisk` on the approved schedule, notifies admins, enqueues `RISK_ANALYSIS`.
- **start / pause / complete** → enqueues `REPLAN` for future (unstarted) work.

Queue producer no-ops without `REDIS_URL`; v1 planning still runs synchronously on generate/approve/recalculate. Worker process (`apps/worker`) acknowledges `scheduling` jobs as no-ops in v1.

## Permissions (dealer vs admin)

Dealer (`CUSTOMER` role): `schedule.availability.own`, `schedule.read.own`, `schedule.request-change.own`.  
Ops: `schedule.read`, `schedule.manage`, `schedule.approve`, `schedule.override`, `schedule.settings.manage`, `schedule.capacity.read`.

Details: [production-scheduling-permissions.md](./production-scheduling-permissions.md).

## Related docs

| Doc | Contents |
|---|---|
| [production-scheduling-admin-guide.md](./production-scheduling-admin-guide.md) | Admin Scheduling page, approve, pin, product times, calendar |
| [production-scheduling-dealer-guide.md](./production-scheduling-dealer-guide.md) | Dealer dates, promise states, change rules |
| [production-scheduling-operations.md](./production-scheduling-operations.md) | Calendar, buffers, auto-assign, replan, BullMQ |
| [production-scheduling-troubleshooting.md](./production-scheduling-troubleshooting.md) | NEEDS_REVIEW, missing profile, stale version, Redis |
| [production-scheduling-architecture.md](./production-scheduling-architecture.md) | Flow diagram / principles |
| [production-scheduling-algorithm.md](./production-scheduling-algorithm.md) | Planner algorithm notes |
| [scheduling-web-changes.md](./scheduling-web-changes.md) | Portal + admin-web surface |
| [scheduling-mobile-changes.md](./scheduling-mobile-changes.md) | Expo app surface |
| [scheduling-database-changes.md](./scheduling-database-changes.md) | Schema / migration summary |
