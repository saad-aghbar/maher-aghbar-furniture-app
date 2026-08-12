# Production Scheduling — Troubleshooting

Common issues and what the code actually does.

## Schedule stuck in `NEEDS_REVIEW`

**Cause:** `generateForProductionOrder` threw after SO confirm or an explicit generate; `markNeedsReview` created/updated a schedule with `status: NEEDS_REVIEW`, `promiseState` mapped to risk for dealers, and notified admins (`SCHEDULE_AT_RISK`).

**Also appears when:** planner/persistence fails mid-flight; SO confirm `.catch` path calls `markNeedsReview` so the commercial order still succeeds.

**Fix:**

1. Check product has `ProductProductionProfile` + `ProductStageEstimate` rows (or accept fallback minutes).
2. Ensure factory calendar + eligible workers exist for stage departments/skills.
3. Open Scheduling → Approvals / Alerts, fix data, **Recalculate**, then **Approve** (approve allows `NEEDS_REVIEW`).

## No production profile / stage estimates

**Symptoms:**

- Availability returns `estimateStatus: UNAVAILABLE` or low confidence / `requiresAdminEstimateReview`.
- Generated schedule has `requiresAdminEstimateReview: true`, `estimateConfidence: 'LOW'`, `estimateReviewStatus: 'PENDING'`.
- Duration falls back to task `estimatedMinutes` or stage-definition hours × 60 (minimum 30).

**Fix:** Products → production time (basic + advanced stage estimates). Recompute stats optional via `POST /scheduling/estimate-stats/recompute`.

## Material risk / at-risk orders

**Flags:**

- `ProductionSchedule.materialRisk = true` (task **blocker** lifecycle, or validation residual).
- Dashboard / `GET /scheduling/at-risk` includes `NEEDS_REVIEW`, `materialRisk`, or `requiresAdminEstimateReview`.

Dealer promise state becomes `AT_RISK` when approved+atRisk or when schedule status is `NEEDS_REVIEW`.

**Fix:** Clear blockers, ensure materials, recalculate, re-approve if the commitment moved.

## `SCHEDULE_STALE` (409) on approve

**Cause:** Client sent an older `version` than the latest `ProductionSchedule` for that PO (someone recalculated or regenerated).

**Fix:** Reload schedule/calendar card; approve with the new `version`. Idempotent if already `APPROVED` with matching version.

## Planner says requested date not feasible

Backward schedule fails the deadline → `requestedDateFeasible: false`; availability/UI suggest `earliestAvailableDate` instead. Not an error — dealer can pick an alternative or admin can override after review.

## Auto-assign left tasks unassigned

`assignWorker` returned `null` (no active worker in department / with skill). Allocations may still exist with department resource type or null employee. Add workers, skills (`WorkerSkill`), or assign manually then pin.

## Redis / queue jobs not running

`REDIS_URL` is **optional**.

- Unset → `SchedulingQueueService.enqueue` no-ops; generate/approve/recalculate still run **synchronously** in the API.
- Set → jobs land on BullMQ queue `scheduling`; worker currently **acks as noop** in v1 for `REPLAN` / `RISK_ANALYSIS` / etc.

If you expected timer-driven replans to mutate the plan asynchronously, confirm Redis **and** that worker handlers are implemented beyond the current noop acknowledge.

## Dealer cannot change date

Policy locked: order in production, completed, or cancelled. Or dealer lacks `schedule.request-change.own`. Approved+not-started only allows a **change request**, not a silent commitment rewrite.

## Permissions denied

| Action | Permission |
|---|---|
| Availability | `schedule.availability.own` or `schedule.manage` |
| Own schedule | `schedule.read.own` or `schedule.read` |
| Dealer date | `schedule.request-change.own` or `schedule.manage` |
| Approve | `schedule.approve` |
| Generate / pin / recalculate | `schedule.manage` |
| Calendar settings | `schedule.settings.manage` |

`CUSTOMER` seed role includes the three `*.own` codes via `ROLE_PERMISSIONS` in `@maher/permissions`.
