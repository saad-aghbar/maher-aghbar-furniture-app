# Workflow Runtime Rules

## Compilation

Input: published workflow version + product overrides + order overrides.  
Output: `CompiledProductionWorkflow` — included nodes, excluded nodes, normalized edges, roots, terminals, dependency/downstream maps, topological order.

Excluded optional nodes are removed; edges are rewritten so successors depend on remaining predecessors (e.g. A→B→C with B excluded ⇒ A→C). Re-validate compiled graph.

## Instance / task generation

- Create `ProductionStageInstance` + `ProductionTask` only for **included** nodes.
- Do not create fake work for excluded stages.
- If an included optional node is later skipped: set instance `SKIPPED`; treat as satisfied for deps.

## Readiness (authoritative on server)

A stage becomes READY when:

- included in snapshot  
- not COMPLETED / SKIPPED  
- not BLOCKED  
- all active predecessors are COMPLETED or valid SKIPPED  

Frontend must not invent readiness.

## Task completion

1. Close timer  
2. Mark task COMPLETE  
3. Update stage instance when all tasks done  
4. Read **snapshot** edges  
5. Unlock READY downstream  
6. Notify assigned workers  
7. Roll up progress  
8. Scheduling risk/replan hooks as today  

## Progress algorithm

For active (included, non-excluded) snapshot nodes:

- `nodeWeight = estimatedMinutes` if reliable; else equal weight `1`
- COMPLETED ⇒ full weight  
- IN_PROGRESS ⇒ use `progressPercent` of weight when server-authoritative  
- PENDING/READY/BLOCKED ⇒ 0  
- SKIPPED ⇒ exclude from denominator (or count as complete weight if business prefers — **v1: exclude skipped from denominator like excluded**)  
- `progressPercent = round(100 * completedWeight / totalWeight)`

## Duration resolution

Order override → ProductStageEstimate → node override → stage definition hours → `ESTIMATE_REVIEW_REQUIRED`.

## Scheduling

Planner reads snapshot included nodes + edges. Parallel layers schedule concurrently when capacity allows. Merge waits for all active preds. Excluded = zero capacity.

## Customize lock

Before any task starts: Admin may customize optional include/exclude, estimates, notes.  
After first task starts: topology locked; structural changes require manager permission + audit reason (prefer refuse).
