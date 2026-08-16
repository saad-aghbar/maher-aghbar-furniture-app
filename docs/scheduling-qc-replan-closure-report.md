# Scheduling QC → REPLAN — closure report

Closes the QC → scheduling gap without rewriting the planner. Audit:
[scheduling-qc-replan-audit.md](./scheduling-qc-replan-audit.md). Live proof:
[scheduling-qc-replan-live-uat.md](./scheduling-qc-replan-live-uat.md).

Live snapshot: **2026-08-15** `http://localhost:4000` + `maher_erp`, factory
timezone `Asia/Amman`. Isolated `DRUAT-QC` records. No seed. Planner
placement, factory-replan occupancy, conflict detector, material/WIP
readiness, and QC disposition were not changed.

---

## 1. Original gap

Floor `TasksService.complete` already enqueued targeted `REPLAN` via
`onTaskLifecycle`. QC did **not**.

`POST /quality-inspections/:id/submit` PASS wrote `productionTask` COMPLETED
directly, posted FG via `onInspectionPassed`, ran `pipeline.onTaskComplete`,
and never called `onTaskLifecycle`. FAIL created a rework, set the PO
`ON_HOLD`, reversed FG, and never replanned. `startRework` awaited
**sync** `generateForProductionOrder` on the HTTP path.

Inspection in seed is `INSPECTION` (`requiresInspection: true`). Floor
`progress` 100% → `READY_FOR_INSPECTION` (no complete). QC pass is the
completion event for that stage.

## 2. QC paths audited

See the audit path table. Covered:

- create inspection / templates / GET
- submit PASS / PASSED_WITH_NOTES / FAIL / BLOCKED
- `startRework` (new task vs existing)
- `completeRework`
- rework `POST /tasks/:id/complete`
- `createForReturn` / `resolveReturnFate(REWORK)`

## 3. Scheduling-relevant QC transitions

| Transition | Event enqueued |
|---|---|
| Submit PASS / PASSED_WITH_NOTES (result **changed**) | `REPLAN` `{ event: 'qc-pass', taskId? }` |
| Submit FAIL / BLOCKED (result **changed**) | `REPLAN` `{ event: 'qc-fail' }` |
| `startRework` creating a new rework task | `REPLAN` `{ event: 'rework-start', taskId }` |
| `createForReturn` creating a new rework | `REPLAN` `{ event: 'rework-return' }` |
| Rework task `POST /tasks/:id/complete` | existing `onTaskLifecycle` `complete` |

## 4. Non-relevant QC transitions

| Transition | Why no enqueue |
|---|---|
| Create inspection / template CRUD / GET | no completion / WIP |
| Floor `progress` → `READY_FOR_INSPECTION` | no complete yet |
| Identical PASS/FAIL retry | scheduling facts already applied |
| `startRework` when rework task already exists | no new task |
| `completeRework` | request-status only; tasks already REPLANed |
| `resolveReturnFate(REWORK)` inventory-only | not a PO event |

Partial QC qty: `QualityResult` is all-or-nothing. **NOT APPLICABLE**.

## 5. Root cause

QC mutated production/WIP **outside** `TasksService.complete`, so
`notifyScheduleLifecycle` → `onTaskLifecycle` never ran. Fail/hold similarly
left the last active schedule in place. Rework start regenerated
synchronously on the request path instead of the queue.

## 6. Implementation

One public helper on `SchedulingService`:

`enqueueTargetedReplan(productionOrderId, event, taskId?)`

Same active-schedule guard as `onTaskLifecycle`
(`APPROVED | PROPOSED | NEEDS_REVIEW`). Fire-and-forget `queue.enqueue('REPLAN', …)`.
Never `REPLAN_FACTORY`. Never `generateForProductionOrder` on the QC HTTP path.

- QC `submit`: after `$transaction` resolves, enqueue only if pass/fail
  **category** changed. Pass includes the first newly completed task id.
- `startRework`: replace sync generate with `rework-start` after commit.
- `createForReturn`: `rework-return` only when a new rework row is created.
- `onTaskLifecycle` start/pause/complete calls the same helper.
- `QualityModule` imports `forwardRef(() => SchedulingModule)`.

Do **not** call `TasksService.complete` from QC. Do **not** add
`onStageTaskComplete` on QC pass (FG already via `onInspectionPassed`).

## 7. Transaction behavior

Domain writes commit first. Enqueue runs after the transaction. If enqueue
or generate fails, QC/rework rows stay. No QC rollback.

## 8. Queue / retry behavior

Jobs with different `event` / `taskId` still enqueue (BullMQ `jobId` includes
both). Processor concurrency 1 / `inProcessTail`. Persist supersedes prior
active versions; `plannedAllocationsMatch` skips an extra version when the
plan is unchanged.

In-process and BullMQ attempts: **5**. Processor throw calls `markNeedsReview`
then rethrows so the queue retries. Jest covers the rethrow.

## 9. WIP acceptance behavior

Live A: QC `PASSED`; inspection tasks `COMPLETED`; PACKAGING `READY`; schedule
version **5 → 6**; one active version. FG via existing `onInspectionPassed`
(unchanged).

## 10. Rejection behavior

Live B: `FAILED_REWORK_REQUIRED` → PO `ON_HOLD`, rework `RW-2026-00003`.
PACKAGING start `400 STAGE_LOCKED` (prereq INSPECTION). FG reversed by
existing `reverseFinishedGoods`.

## 11. Rework behavior

`startRework` created a new Carpentry rework task (`TSK-2026-01548`) and
enqueued `rework-start` (not sync generate). After fail + startRework:
**one** active schedule. Floor-complete of the rework task used canonical
`TasksService.complete` (existing REPLAN). `completeRework` closed the
request only. PO returned to `IN_PROGRESS`.

## 12. Producer-late behavior

Live D: inspection `actualCompletion` 2026-08-15T18:04:33.366Z. No consumer
allocation had `plannedStart` before that instant (PACKAGING had no
serialized allocation row on this UAT-SOFA-A schedule — stage was `READY`
via pipeline unlock). At-risk HTTP 200. Replan did run (version bump on
accept). Constructed 12:00-vs-late window was not required to prove no
illegal consumer start.

## 13. At-risk behavior

`GET /scheduling/at-risk` stayed 200. Classifier / `RISK_ANALYSIS` path
unchanged. QC does not invent a new risk engine.

## 14. Idempotency

Identical PASS retry: HTTP 201, QC stayed `PASSED`, schedule version **6 → 6**.
Burst fail + startRework: both may enqueue; after poll, exactly one active
`APPROVED|PROPOSED|NEEDS_REVIEW`. Jest: three distinct events all enqueue;
unchanged generate persists at most once; changed generate still one active.

## 15. Live UAT evidence

`pnpm smoke:qc-replan-uat` → [scheduling-qc-replan-live-uat.md](./scheduling-qc-replan-live-uat.md)

**8 PASS / 0 FAIL / 0 BLOCKED** (A–F, NEW CONFLICTS, REAL DEV DB/API).

Jest (not live proof): `scheduling-qc-replan-wiring.test.ts` + rework spec;
material-wip / factory-replan / conflict / capacity / at-risk suites still
green.

## 16. Conflict regression

Live QC UAT: **0** new `WORKER_OVERLAP` / `RESOURCE_OVERLAP` vs the
pre-run conflict snapshot.

## 17. Remaining limitations

- Partial accept/reject quantities: not in current QC domain.
- QC pass still does not call `TasksService.complete` (photos / time entries);
  only the scheduling hook is unified.
- `completeRework` remains a request-status close; scheduling already ran on
  rework task complete.
- Returns inventory-fate `REWORK` without `createForReturn` is still not a
  PO event.
- Live D did not assert a PACKAGING allocation move (no packing alloc on
  that schedule); it asserted no illegal consumer start.

---

## Factory lifecycle

First run: **87/88** — flaky harness assertion `original completed task
remains historical` (carpentry `tasks[0]` was already `READY` before fail;
scenario 6 still PASS). Immediate retry, no reseed: **88/88**.

---

## Final verdict

OVERALL:
PASS

ROOT CAUSE:
QC submit and rework start mutated production/WIP without the floor
`onTaskLifecycle` REPLAN path; fail left a stale active schedule; startRework
generated synchronously on HTTP.

QC ACCEPT → REPLAN:
PASS

QC REJECT → READINESS INVALIDATED:
PASS

REWORK → REPLAN:
PASS

REWORK COMPLETE → DOWNSTREAM RECOVERY:
PASS

PRODUCER LATE THROUGH QC:
PASS

AT-RISK REFRESH:
PASS

NO REPLAN STORM:
PASS

RETRY / IDEMPOTENCY:
PASS

NEW WORKER CONFLICTS:
0 expected

NEW RESOURCE CONFLICTS:
0 expected

REAL DEV DB USED:
YES

REAL API USED:
YES

FACTORY LIFECYCLE:
88/88

EXACT REMAINING QC-SCHEDULING GAPS:
Partial QC qty not in domain; QC still skips `TasksService.complete`
photo/time-entry rules; `completeRework` is request-status only; inventory
return fate without `createForReturn` is not a PO scheduling event.

FILES CHANGED:
- apps/api/src/modules/scheduling/scheduling.service.ts
- apps/api/src/modules/quality/quality.controller.ts
- apps/api/src/modules/quality/quality.module.ts
- apps/api/src/modules/production/production-rework.service.ts
- apps/api/src/modules/scheduling/__tests__/scheduling-qc-replan-wiring.test.ts
- apps/api/src/modules/production/production-rework.service.spec.ts
- scripts/qc-scheduling-replan-live-uat.mjs
- package.json (`smoke:qc-replan-uat`)
- docs/scheduling-qc-replan-audit.md
- docs/scheduling-qc-replan-live-uat.md
- docs/scheduling-qc-replan-closure-report.md
