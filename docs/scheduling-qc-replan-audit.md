# Scheduling QC → REPLAN audit

Proven against the local worktree **before** the QC scheduling hook.
Jest is not live proof. No behavior change in this document.

Canonical floor path (already live-UAT proven):

```
TasksService.complete
  → StagePipelineService.onTaskComplete
  → ProductionInventoryService.onStageTaskComplete
  → notifyScheduleLifecycle('complete')
  → SchedulingService.onTaskLifecycle
  → queue.enqueue('REPLAN', { productionOrderId, taskId, event })
  → async generateForProductionOrder
```

QC submit does **not** call `TasksService.complete` or `onTaskLifecycle`.

## Call chains

```
POST /quality-inspections/:id/submit PASS
  → productionTask.status = COMPLETED (direct)
  → onInspectionPassed (FG lots)
  → pipeline.onTaskComplete
  → no REPLAN

POST /quality-inspections/:id/submit FAIL|BLOCKED
  → ReworkRequest AWAITING_STAGE
  → productionOrder.status = ON_HOLD
  → reverseFinishedGoods
  → no REPLAN

POST /quality-inspections/rework/:id/start
  → new isRework task READY (or reuse existing)
  → sync generateForProductionOrder on HTTP path
  → not enqueue REPLAN

POST /quality-inspections/rework/:id/complete
  → ReworkRequest COMPLETED (requires all rework tasks done)
  → no REPLAN (tasks already completed via TasksService.complete)

POST /tasks/:id/complete (rework or floor)
  → canonical onTaskLifecycle REPLAN  (SAFE)
```

Inspection stage in seed: `INSPECTION` (`requiresInspection: true`). PACKAGING depends on it. Floor `progress` 100% → `READY_FOR_INSPECTION` (no complete, no REPLAN). QC pass is the completion event for that stage.

Partial QC quantities: `QualityResult` is all-or-nothing. **NOT APPLICABLE**.

## Path table

| ACTION | DB / task / WIP | Scheduling event today | Replan today | At-risk today | Class |
|---|---|---|---|---|---|
| Create inspection | `QualityInspection` row | none | no | no | NOT SCHEDULING-RELEVANT |
| Template CRUD / GET | config / read | none | no | no | NOT SCHEDULING-RELEVANT |
| `progress` → `READY_FOR_INSPECTION` | task status only; no WIP | none | no | no | NOT SCHEDULING-RELEVANT |
| Submit PASS / PASSED_WITH_NOTES | tasks COMPLETED; FG via `onInspectionPassed`; stage rollup | none | **no** | stale | **STALE-SCHEDULE RISK** |
| Submit FAIL / BLOCKED | defect; rework AWAITING_STAGE; PO ON_HOLD; FG reversed | none | **no** | stale | **STALE-SCHEDULE RISK** |
| `startRework` (new task) | rework task READY; stage reset; PO IN_PROGRESS | sync `generateForProductionOrder` | yes, **on HTTP** | maybe | **STALE-SCHEDULE RISK** (non-canonical) |
| `startRework` (task already exists) | request IN_PROGRESS only | none | no | no | NOT SCHEDULING-RELEVANT |
| `completeRework` | request COMPLETED | none | no (already on task complete) | n/a | NOT SCHEDULING-RELEVANT |
| Rework `POST /tasks/:id/complete` | pipeline + inventory + lifecycle | `onTaskLifecycle` complete | enqueue REPLAN | yes | **SAFE** |
| `createForReturn` | ReworkRequest; PO ON_HOLD | none | **no** | stale | **STALE-SCHEDULE RISK** |
| `resolveReturnFate(REWORK)` inventory-only | return fate flag | none | no | no | NOT SCHEDULING-RELEVANT |

## Burst note (current)

BullMQ `jobId` is `REPLAN-{poId}-{taskId}-{event}`. Different events do not collapse. In-process jobs chain on `inProcessTail`. Persist already supersedes prior active versions and skips when `plannedAllocationsMatch`. QC pass still never reaches that path.

## What not to change

Planner placement, factory-replan occupancy, conflict detector, material/WIP readiness, QC disposition (`onInspectionPassed` / `reverseFinishedGoods`), `TasksService.complete` photo/permission rules.
