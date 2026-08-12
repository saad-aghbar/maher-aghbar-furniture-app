# Production Scheduling — Operations

Runtime configuration and background behavior as implemented.

## Factory calendar

Model: `FactoryCalendar` (+ `FactoryCalendarException`).

| Field | Default (schema) | Notes |
|---|---|---|
| `timezone` | `Asia/Amman` | Used by `WorkingCalendar` for working instants |
| `workingWeekdays` | `[0,1,2,3,4,6]` (Fri closed) | 0=Sunday … 6=Saturday; Saturday is a normal working day |
| `shiftStart` / `shiftEnd` | `08:00` / `16:00` | Local wall times in calendar TZ (8 AM–4 PM) |
| `breaks` | JSON | e.g. `[{ "start": "12:00", "end": "13:00" }]` |
| `overtimeConfig` | JSON optional | Stored; planner uses working windows from calendar + day exceptions |
| `isDefault` | `true` | Service loads the default calendar for planning |

Exceptions (any calendar day):

- `HOLIDAY` / `SHUTDOWN` — close a day that would otherwise work
- `EXTRA_SHIFT` — open a closed day (e.g. Friday) or extend hours for **overtime** (`shiftEnd` after 16:00). Lunch breaks still apply.

Admin: Settings → Production calendar (`GET/PATCH /scheduling/calendar-settings`, `POST/DELETE .../exceptions`). Requires `schedule.settings.manage`. Mobile Admin Scheduling → **Edit day capacity** on the month board.

**Replan:** Creating, updating, or clearing an exception (and saving calendar settings) synchronously replans all production orders with an active schedule (`DRAFT` / `PROPOSED` / `APPROVED` / `NEEDS_REVIEW`) so capacity changes reshape planned windows immediately.

## Buffers

- Product profile `bufferPercent` (default **10**).
- On generate: `bufferMinutes = round(bufferPercent/100 * sum(stage estimated minutes))` on the planner order input.
- Backward scheduling uses buffer when checking whether a requested delivery date is feasible.
- Missing profile → service still schedules with default 10% buffer and flags `requiresAdminEstimateReview`.

## Auto-assign workers

Domain: `assignWorker` in `worker-assignment.ts`.

Eligibility:

1. Active worker
2. Matching department code (when stage has one)
3. Optional `WorkerSkill` for the stage definition (if the worker has any skills recorded)

Selection: least-loaded eligible worker; ties break by worker `id` (deterministic). Prefer existing `task.assignedEmployeeId` when still eligible.

On persist, generate writes `assignedEmployeeId` only when the task had none and the planner picked an employee. Occupancy from active allocations is loaded so new plans avoid double-booking.

## Replan

Triggers:

| Trigger | Behavior |
|---|---|
| Admin recalculate / generate | Sync `generateForProductionOrder` → new `PROPOSED` version |
| Dealer direct date update | Sync regenerate after preferred date change |
| SO confirm | Sync generate per new PO; on failure → `markNeedsReview` |
| Task start/pause/complete | Enqueue `REPLAN` (future work only; see queue) |
| Task blocker | Set `materialRisk`, notify, enqueue `RISK_ANALYSIS` |

Pinned allocations from the previous schedule version are preserved as planner constraints. Unstarted work may move; validator flags worker overlaps / dependency order / pinned moves as `CONFLICT`.

## BullMQ queue `scheduling`

Producer: `SchedulingQueueService` (`scheduling-queue.ts`).

| Job name | Intent |
|---|---|
| `SCHEDULE_GENERATE` | Background generate |
| `REPLAN` | Downstream replan after timers |
| `RISK_ANALYSIS` | Material/capacity risk follow-up |
| `ESTIMATE_STATS` | Stats recompute |

- Queue name: **`scheduling`**.
- Without `REDIS_URL`, `enqueue` is a **no-op** (API sync path remains the source of truth in v1).
- `apps/worker` registers the `scheduling` queue and **acknowledges jobs as no-ops** in v1 (`[scheduling:noop]`), because planning already ran in the API request path when Redis was unused / sync generate was used.

## Concurrency: `SCHEDULE_STALE`

`ProductionSchedule.version` increments on each new plan. Approve / some patch paths require the client’s `version` to match the latest row.

Mismatch → HTTP **409** with code **`SCHEDULE_STALE`** and `currentVersion` in the body. Client must reload and retry.

## Related

- [production-scheduling.md](./production-scheduling.md) — end-to-end overview
- [production-scheduling-troubleshooting.md](./production-scheduling-troubleshooting.md) — common failures
