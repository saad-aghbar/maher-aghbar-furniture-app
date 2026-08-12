# Production Scheduling — Data Model

## New enums

- `QuantityScalingMode`: LINEAR | FIXED | SETUP_PLUS_LINEAR | BATCH | PARALLEL_CAPACITY
- `ScheduleStatus`: DRAFT | PROPOSED | APPROVED | SUPERSEDED | CANCELLED | NEEDS_REVIEW | PROVISIONAL
- `SchedulePromiseState`: ESTIMATED | AWAITING_APPROVAL | CONFIRMED | AT_RISK | RESCHEDULED | COMPLETED
- `ManufacturingComplexity`: STANDARD | MODIFIED | CUSTOM
- `ScheduleResourceType`: EMPLOYEE | DEPARTMENT
- `EstimateReviewStatus`: NOT_REQUIRED | PENDING | APPROVED | REJECTED

## New models

### ProductProductionProfile
Per-product scheduling enablement and defaults: `totalStandardMinutes`, `setupMinutes`, `complexityFactor`, `defaultBatchSize`, `minimumLeadTimeDays?`, `bufferPercent`, `isSchedulingEnabled`.

### ProductStageEstimate
Per product × stage: setup/unit/fixed minutes, `quantityScalingMode`, batch fields, `maxParallelUnits?`, `workerCountRequired`, `overrideDepartmentId?`, `isRequired`.

### FactoryCalendar + FactoryCalendarException
Timezone (default company), working weekdays, shift start/end, breaks JSON, overtime JSON; exceptions for holiday/shutdown/extra-shift.

### ProductionSchedule
Versioned plan for a PO: status, requested/earliest/suggested/committed dates, `calculationVersion`, reason, generated/approved actors, material flags, `estimateReviewStatus`, `promiseState`.

### ScheduleAllocation
Task/stage booking: resource type, employee/department, plannedStart/End, estimatedMinutes, `isPinned`, `manuallyAdjusted`.

### WorkerSkill
Light capability: userId + stageDefinitionId, isActive.

### SchedulingEstimateProposal
AI-proposed stage minutes + confidence + reasons; never auto-commit.

### StageEstimateStat
Rolling avg/median/sample/variance for product×stage actuals.

## Extensions to existing

- `ProductionOrder.committedDeliveryDate` optional mirror
- Indexes on planned windows, `(assignedEmployeeId, plannedStart)`, schedule status, committed dates
- Profiles nullable — products without profiles remain valid

## Migration rules

- No invented product times
- No auto-reschedule of existing POs
- Rollback: drop new tables/enums; existing execution data untouched
