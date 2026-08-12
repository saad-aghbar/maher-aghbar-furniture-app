# Production Scheduling — Algorithm

Deterministic finite-capacity heuristic. No LLM in the date path.

## Inputs

- Product stage estimates (or approved AI proposal / admin defaults)
- Quantity + scaling mode
- Stage DAG (`dependsOnCodes`)
- Factory calendar + exceptions
- Active workers (dept, skills, availability, existing allocations)
- Material readiness (known inventory only)
- Priority, pins, requested delivery date
- Existing APPROVED/PROPOSED allocations (except when superseded)

## Duration

| Mode | Formula |
|---|---|
| LINEAR | `minutesPerUnit * qty` |
| FIXED | `fixedMinutes` |
| SETUP_PLUS_LINEAR | `setup + minutesPerUnit * qty` |
| BATCH | `ceil(qty/batchSize) * batchMinutes` |
| PARALLEL_CAPACITY | `ceil(qty/maxParallel) * minutesPerUnit` (+ setup if set) |

## Priority / fairness

1. Pinned / hard committed
2. URGENT → HIGH → NORMAL → LOW
3. Committed delivery date
4. Requested delivery date
5. Created at
6. Stable id

Equal priority: interleave across dealers (stable sort), do not finish all of Dealer A before any of Dealer B solely by submission burst.

## Forward scheduling

`start = max(now, materialReadyAt, productionReadiness)`  
Place each ready task into earliest feasible working slot for an eligible worker/dept without overlap. Parallel branches schedule independently; merge waits for all parents.

## Backward scheduling

From `requestedDeliveryDate - buffer`, walk DAG reverse, place latest feasible slots. If infeasible → fall back to forward; set `requestedDateFeasible=false`.

## Validation outcomes

- VALID — save
- WARNING — confirm required
- CONFLICT — reject unless `schedule.override` + reason audited

## Replanning

Never move: COMPLETED, actual past, currently running (unless explicitly allowed), pinned.  
Replan eligible future work only; bump schedule version; supersede prior PROPOSED/APPROVED as needed.

## Availability (dealer-safe)

Return earliest, alternatives, feasibility, confidence, `requiresAdminEstimateReview`. Strip workers, capacity internals, other dealers.
