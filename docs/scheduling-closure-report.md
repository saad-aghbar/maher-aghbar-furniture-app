# Scheduling gap closure

Closes the verified gaps from [scheduling-capacity-audit.md](./scheduling-capacity-audit.md) without rewriting the planner.

## BEFORE

- Zero skilled workers still booked unlimited `DEPARTMENT` capacity.
- `RESOURCE_CONSTRAINED` was not a real finite-slot mode.
- `materialReadyAt` / WIP readiness were post-plan risk flags, not planner constraints.
- Task complete enqueued `REPLAN`, but nothing processed the job (and the worker process no-op’d it).
- Worker activate / deactivate / skill edits only affected the next manual generate.
- `requestedDateFeasible` was JSON-only; generate could write a committed date.
- Delivery buffer defaulted to occupying the delivery day (`buffer=0`).
- Admin capacity UI multiplied department headcount × shift hours.

## FIX

- Planner **fails closed**: no eligible worker → throw `NO_ELIGIBLE_WORKER`. Shared resources use finite `resource:{stageId}:{slot}` keys; slots &lt; 1 → `NO_RESOURCE_CAPACITY`.
- Stage library default is **Workers** (`WORKER_CONSTRAINED`). **Shared resource** is explicit, with slot count.
- Generate passes `materialReadyAt` and a delivery-buffer `latestCompletionTarget`. Shortage without a ready date persists `MATERIAL_NOT_READY`. WIP lots missing after producer tasks completed persists `WIP_NOT_READY`.
- API consumes scheduling jobs (BullMQ + in-process retries). Task complete **enqueues only**. Completed tasks stay pinned; replan failure marks `NEEDS_REVIEW` and does not un-complete work.
- User activate / deactivate / skill sync enqueues `REPLAN_EMPLOYEE` for that worker’s future allocations.
- Persist requested vs suggested vs feasible vs planning mode. Suggested = requested if feasible, else earliest. Committed only on approve. Requested date is never overwritten by generate.
- Factory calendar `deliveryBufferWorkingDays` default **1**.
- Capacity strip is skilled workers (or resource slots) × shift minutes.

## AFTER

Finite worker and resource capacity. Requested date is a real backward constraint, finishing the previous working day by default. Material/WIP can block or delay a plan. Late complete and worker-capacity changes replan asynchronously. Admin capacity matches the engine’s skill model.

## TEST

- Domain UAT A–Z plus AA (resource slots) and AB (delivery buffer).
- Wiring: occupancy includes resource slots, listCapacity uses WorkerSkill, lifecycle enqueue-only, employee replan enqueue.
- `pnpm exec jest --testPathPattern='scheduling-capacity-(uat|wiring)'` from `apps/api`.

## RESULT

Fail-closed finite capacity. No silent unlimited department booking. Replan is job-based and retry-safe. Requested / suggested / committed dates are distinct and persisted.
