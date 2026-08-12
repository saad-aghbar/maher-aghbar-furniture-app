# Workflow Builder Audit (Local Tree)

**Source of truth:** local worktree (public repo may lag mobile/UI work).  
**Date:** 2026-08-12

## Verdict

Production is **live global-definition-driven**. There is no versioned workflow template, no order snapshot of topology, and no product-specific stage graph at materialization time. Changing `ProductionStageDefinition.dependsOnCodes` affects in-flight readiness.

## Existing models (reused)

| Model | Role today | Gap for workflows |
|-------|------------|-------------------|
| `ProductionStageDefinition` | Global stage catalog + `dependsOnCodes[]` | Mutable; not versioned; soft deps by code string |
| `ProductionStageInstance` | Per-order runtime stage | No frozen names/deps/estimates |
| `ProductionOrder` | Order header + equal-weight progress | No workflow/version FK |
| `ProductionTask` | One task per stage instance | Created for every active global stage |
| `TaskTimeEntry` / `TaskBlocker` | Timers / soft+hard blockers | OK to keep |
| `ProductProductionProfile` | Scheduling knobs | No workflow link |
| `ProductStageEstimate` | Duration/capacity; `isRequired` | Skips planner only — not PO materialization |
| `WorkerSkill` | Stage capability | Keep |
| `ProductionSchedule` / `ScheduleAllocation` | Versioned schedules | Version ≠ workflow version |
| `FactoryCalendar` | Working time | Keep |

## Runtime paths (must change)

1. **Confirm** — `SalesOrdersService.confirm` clones all `isActive` stage defs → instances + tasks.
2. **Readiness** — `StagePipelineService.arePrereqsMet` reads live `dependsOnCodes`.
3. **Task gate** — `TasksService.assertPrereqsMet` same live source; photos from live def.
4. **Scheduling** — planner uses order tasks but live deps; `isRequired: false` skips capacity only.
5. **Progress** — `completedStages / totalStages` (equal weight).

## UI today

- **Mobile:** dynamic DAG via `stageGraphLayout` + `ProductionFlowMap` (API stages + `dependsOnCodes`).
- **Admin web:** stage table + `/production-stages` CRUD; no canvas builder.
- **Customer portal:** linear stage list.
- **Worker:** tasks only (correct — keep).

## Permissions today

`production-order.*`, `production-task.*`, `schedule.*`. No `production.workflow.*`.

## Missing for this feature

- Workflow / version / node / edge tables  
- Product workflow configuration + overrides  
- Order workflow snapshot  
- Compiler (optional/excluded edge rewrite)  
- Snapshot-driven pipeline + scheduler input  
- Admin Workflow section (web + mobile)  
- Dealer-safe dedicated workflow endpoint  
- Weighted progress  

## Compatibility constraint

Do **not** remove `dependsOnCodes` in this change. Deprecate after snapshot path is authoritative for new + backfilled orders.
