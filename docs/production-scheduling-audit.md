# Production Scheduling — Local Tree Audit

Source of truth: local worktree (not public GitHub). Audited before implementing finite-capacity scheduling.

## Verdict

The ERP already has a solid **production execution** layer (orders → stages → tasks → timers → blockers). It does **not** have a finite-capacity scheduling engine, factory calendar, product manufacturing time profiles, schedule versioning, or dealer availability promising.

**Do not build a second production system.** Extend the existing pipeline.

---

## What already exists

### Schema (`packages/database/prisma/schema.prisma`)

| Entity | Status |
|---|---|
| `ProductionStageDefinition` | Exists — `dependsOnCodes`, `estimatedHours` (global), `responsibleDepartment` (string code) |
| `ProductionOrder` | Exists — `requiredDeliveryDate`, planned/actual dates, `Priority`, status enum incl. `WAITING_FOR_MATERIALS` |
| `ProductionStageInstance` | Exists — `plannedStart`/`plannedEnd` (unused by scheduler) |
| `ProductionTask` | Exists — assignee, `estimatedMinutes`, planned/actual, status |
| `TaskTimeEntry` | Exists — authoritative timer rows |
| `TaskBlocker` | Exists — categories incl. `MATERIAL_MISSING` |
| `Product` | Exists — `bomDefaults` JSON stub only (no structured BOM) |
| `Department` / `User` | Exists — no skills, shifts, or capacity fields |
| `SystemSetting` | Exists — company timezone `Asia/Amman`; no working calendar |
| `Notification` / templates | Exists — `WORKER_ASSIGNED`, `URGENT_TASK`, etc. |
| `AuditEvent` | Exists |

**Missing:** `ProductProductionProfile`, `ProductStageEstimate`, `FactoryCalendar`, `ProductionSchedule`, `ScheduleAllocation`, `WorkerSkill`, schedule promise enums.

### API

| Module | Behavior |
|---|---|
| `sales-orders` confirm | Creates PO + all stage instances + one task per stage; copies `requiredDeliveryDate` |
| `production` / `stage-pipeline` | Prerequisite unlock DAG; progress rollup |
| `tasks` | Manual assign, start/pause/resume/complete, soft blockers |
| `settings` | Company JSON; no production calendar |
| `ai-intake` | Maps `deliveryDate` into RFQ; no manufacturing effort proposal |
| `apps/worker` | BullMQ stub queues; **no** scheduling jobs |

### Clients

| Surface | Related UX |
|---|---|
| Admin Web | Production board + date inputs + assign; no calendar/Scheduling nav |
| Customer portal | Address on create order; preferred date on quotation request only |
| Employee portal | Own tasks + timer; no calendar |
| Mobile Admin | Date edit sheets, production flow map, assign |
| Mobile Dealer | New Order has address only (no delivery date); progress map |
| Mobile Worker | Timer/blocker industrial UI; planned completion labels only |

### Permissions

`production-order.*`, `production-task.*` exist. **No** `schedule.*` codes.

---

## What can be reused

- Stage DAG + `StagePipelineService` unlock semantics
- SO confirm as the hook to generate a **PROPOSED** schedule (after tasks exist)
- Task timer/blocker events as replan triggers
- `Priority` enum and late-list filters
- Notification templates + `NotificationsService`
- `AuditEvent` for approve/move/override
- Mobile role aesthetics: dealer-ui, parchment admin, employee industrial
- Production flow / `DealerProgressMap` (extend with promise state; do not rebuild)
- Company timezone setting as calendar default

---

## What must be extended

1. Product manufacturing profiles + per-stage estimates (quantity scaling modes)
2. Factory working calendar + exceptions
3. `ProductionSchedule` + `ScheduleAllocation` with versioning and distinct date semantics
4. Deterministic planner (forward/backward), capacity, assignment, validator, replan
5. Dealer availability API + post-submit view/change-request rules
6. Admin approve / pin / drag with conflict validation
7. Permissions, BullMQ scheduling jobs, notification matrix
8. Admin Web Scheduling views; Admin/Dealer/Worker mobile surfaces
9. AI effort as **proposal only**; historical estimate stats with admin accept

---

## What must NOT be duplicated

- Do not create alternate ProductionOrder/Task models
- Do not replace stage dependency unlocking with a parallel workflow engine
- Do not use an LLM as the authoritative date calculator
- Do not invent product standard times or supplier ETAs in migrations
- Do not expose factory capacity/workers to dealers
- Do not give workers a factory schedule calendar
- Do not auto-reschedule existing in-flight POs on migrate
- Do not introduce a visually unrelated FullCalendar default theme
