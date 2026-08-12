# Workflow Builder Architecture

## Goal

Make production topology **configurable, versioned, and frozen per order** without replacing the existing production engine (instances, tasks, timers, blockers, schedule allocations).

## Principles

1. One production engine — extend, do not fork.
2. Master edits affect **future** orders only.
3. Runtime authority = **order workflow snapshot**.
4. Stage definitions are a **reusable library**; workflows compose them as nodes.
5. Graph is a **DAG**; optional/excluded nodes are compiled out of runtime edges.
6. Admin builder is factory-owner UX; canvas is not a developer node editor.

## Layers

```
Master templates          Product config           Compile                Runtime (existing)
─────────────────         ──────────────           ───────                ──────────────────
ProductionWorkflow        ProductWorkflowConfig    WorkflowCompiler       ProductionStageInstance
ProductionWorkflowVersion ProductWorkflowStageOv.  → Snapshot             ProductionTask
ProductionWorkflowNode    ProductStageEstimate     → Instances/Tasks      StagePipelineService
ProductionWorkflowEdge                             OrderWorkflowGraphSvc  SchedulingService
ProductionStageDefinition                                                 WorkerSkill / timers
```

## Key services

| Service | Responsibility |
|---------|----------------|
| `WorkflowGraphValidator` | Cycles, self-links, dupes, roots/terminals, nodeKeys |
| `WorkflowCompiler` | Version + product + order overrides → compiled DAG |
| `WorkflowVersionService` | Draft CRUD, clone, publish transaction, stale guards |
| `WorkflowSnapshotService` | Persist snapshot; materialize instances/tasks; idempotent |
| `OrderWorkflowGraphService` | Audience DTOs (dealer-safe vs admin-rich); progress |
| `LegacyWorkflowBackfillService` | Idempotent snapshot from existing instances |

## Applicability precedence

Workflow node default → Product override → Order override → Snapshot (immutable after create; topology lock after first task start).

## Duration precedence

1. Order-specific override  
2. `ProductStageEstimate`  
3. Workflow node duration override  
4. `ProductionStageDefinition.estimatedHours`  
5. `ESTIMATE_REVIEW_REQUIRED` (never silent 0)

## What we do not rebuild

- Scheduling planner core / calendar / allocations persistence  
- Task timer / blocker entities  
- Worker task list UX  
- Global stage library table (extend as Stage Library UI)
