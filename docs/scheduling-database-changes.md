# Scheduling Database Changes

Matches `packages/database/prisma/schema.prisma` (Production scheduling section + related enums / PO fields).

## Enums

| Enum | Values |
|---|---|
| `QuantityScalingMode` | `LINEAR`, `FIXED`, `SETUP_PLUS_LINEAR`, `BATCH`, `PARALLEL_CAPACITY` |
| `ScheduleStatus` | `DRAFT`, `PROPOSED`, `APPROVED`, `SUPERSEDED`, `CANCELLED`, `NEEDS_REVIEW`, `PROVISIONAL` |
| `SchedulePromiseState` | `ESTIMATED`, `AWAITING_APPROVAL`, `CONFIRMED`, `AT_RISK`, `RESCHEDULED`, `COMPLETED` |
| `ManufacturingComplexity` | `STANDARD`, `MODIFIED`, `CUSTOM` |
| `ScheduleResourceType` | `EMPLOYEE`, `DEPARTMENT` |
| `EstimateReviewStatus` | `NOT_REQUIRED`, `PENDING`, `APPROVED`, `REJECTED` |
| `FactoryCalendarExceptionType` | `HOLIDAY`, `SHUTDOWN`, `EXTRA_SHIFT` |

## Models added

### `ProductProductionProfile` → `product_production_profiles`

- `productId` **unique** → `Product`
- `totalStandardMinutes?`, `setupMinutes` (default 0), `complexityFactor` (Decimal 8,3 default 1)
- `defaultBatchSize` (default 1), `minimumLeadTimeDays?`, `bufferPercent` (default 10)
- `isSchedulingEnabled` (default true)

### `ProductStageEstimate` → `product_stage_estimates`

- Unique `(productId, stageDefinitionId)`
- `setupMinutes`, `minutesPerUnit`, `fixedMinutes`
- `quantityScalingMode` (default `SETUP_PLUS_LINEAR`)
- `batchSize?`, `batchMinutes?`, `maxParallelUnits?`
- `workerCountRequired` (default 1), `overrideDepartmentId?`, `isRequired` (default true)

### `FactoryCalendar` → `factory_calendars`

- `name` (default `"Default"`), `timezone` (default `"Asia/Amman"`)
- `workingWeekdays` `Int[]` (default `[0,1,2,3,4]`)
- `shiftStart` / `shiftEnd`, `breaks` Json?, `overtimeConfig` Json?, `isDefault`

### `FactoryCalendarException` → `factory_calendar_exceptions`

- Unique `(calendarId, date)`; `type` exception enum; optional shift override + `note`

### `ProductionSchedule` → `production_schedules`

- Unique `(productionOrderId, version)`
- `status` (`ScheduleStatus`), `promiseState` (`SchedulePromiseState`)
- Dates: `requestedDeliveryDate`, `earliestAvailableDate`, `suggestedDeliveryDate`, `committedCompletionDate`, `committedDeliveryDate`
- `calculationVersion` (default `"v1"`), `reason`, `generatedAt` / `generatedBy`
- `approvedAt` / `approvedById`
- `materialReadyAt`, `materialRisk` (default false)
- `estimateReviewStatus`, `estimateConfidence`, `requiresAdminEstimateReview`
- Indexes: `productionOrderId`, `status`, `promiseState`, `committedDeliveryDate`, `suggestedDeliveryDate`

### `ScheduleAllocation` → `schedule_allocations`

- Optional `productionTaskId`, `stageInstanceId`
- `resourceType` (default `EMPLOYEE`), `employeeId?`, `departmentId?`
- `plannedStart`, `plannedEnd`, `estimatedMinutes`
- `isPinned`, `manuallyAdjusted`
- Indexes: schedule, task, `(employeeId, plannedStart)`, `(plannedStart, plannedEnd)`, `(departmentId, plannedStart)`

### `WorkerSkill` → `worker_skills`

- Unique `(userId, stageDefinitionId)`, `proficiency?`, `isActive`

### `SchedulingEstimateProposal` → `scheduling_estimate_proposals`

- Optional `productionOrderId`, `productId`, `requestId`
- `complexity` (`ManufacturingComplexity`), `stageEstimates` Json, `confidence?`, `reasons[]`
- `status` (`EstimateReviewStatus`, default `PENDING`), review fields

### `StageEstimateStat` → `stage_estimate_stats`

- Unique `(productId, stageDefinitionId)`
- `sampleSize`, avg/median actual & estimated minutes, `varianceMinutes`, `suggestedMinutes`, `lastComputedAt`

## Fields added on existing models

| Model | Fields / indexes |
|---|---|
| `ProductionOrder` | `committedDeliveryDate?` (mirror of approved schedule), `plannedStartDate?`; indexes on both |
| `ProductionStageInstance` | `plannedStart?` (+ index) |
| `ProductionTask` | `plannedStart?` (+ indexes including `(assignedEmployeeId, plannedStart)`) |
| `Product` | relation `productionProfile`, `stageEstimates`, `stageEstimateStats` |
| `User` | relations: schedule approver, allocation employee, worker skills |

## Migration / deploy notes

- Schema lives in Prisma; apply with the repo’s normal `prisma migrate` / deploy flow for the environment.
- Profiles and stage estimates are **nullable / optional** — products without them remain valid; scheduling falls back and may flag admin estimate review.
- Existing production orders are **not** auto-rescheduled by schema apply alone; schedules appear when SO confirm / generate runs.
- Rollback: drop the new tables/enums and PO/task planned mirror columns; execution history (tasks, timers) remains.

## Related

- [production-scheduling-data-model.md](./production-scheduling-data-model.md)
- [production-scheduling.md](./production-scheduling.md)
