# Notifications Slice 5 — factory floor handoff

Date: 2026-09-14

Foundation (slices 1–4) is unchanged: topic catalog, device vs user settings, Postgres outbox, account-switch token binding, cold-start pending intent, `linkHref`, preferences, lock-screen privacy, `eventId` idempotency.

**SLICE 5 COMPLETE** for factory handoff:

WORK FINISHES → NEXT REAL WORK BECOMES READY → CORRECT PERSON GETS NOTIFIED → TAP OPENS THEIR WORK

## Emit sites

| Topic | Canonical transition | Site | Recipients |
|---|---|---|---|
| `task.ready` | Stage DAG unlock `NOT_STARTED → READY` | `StagePipelineService.unlockReadyStages` → `FloorHandoffService.emitPipeline` **after** the business transaction | Assigned worker only. Unassigned: staff/admin, **no** skill-pool fan-out |
| `quality.queued` | Same unlock when stage is INSPECTION / QUALITY | same | Assigned inspector + eligible QC staff |
| `packaging.ready` | Same unlock when stage is PACKAGING/PACK | same | Assigned packer + eligible packaging/delivery staff |
| `task.completed` | Floor `TasksService.complete` fully done | after `$transaction` | Production staff (`task.completed` is staff-only). Completing worker excluded |
| `stage.completed` | Stage first reaches COMPLETED (not QC/packaging) | pipeline facts | Staff (floor workers are not permission-fan-out) |
| `task.started` / `paused` / `resumed` | Task status transitions | `TasksService` after tx | Catalog defaults are **off** |
| `task.assigned` / `task.urgent` | `TasksService.assign` | after assign | Assigned worker |
| `quality.passed` | Inspection `PASSED` / `PASSED_WITH_NOTES` | `QualityInspectionService.submit` after tx | Staff; packaging worker gets `packaging.ready` from DAG, not a hardcoded pass→pack hop |
| `quality.failed` | QC fail / partial fail | submit after tx | Staff. Inspector (actor) excluded |
| `quality.reworkRequired` | Rework task created `READY` | `ProductionReworkService.startRework` after tx | Prior stage assignee copied onto the rework task |
| `quality.reworkReady` | Rework request COMPLETED, inspection reopened | `completeRework` after tx | Assigned inspectors |
| `packaging.completed` | Packaging stage first COMPLETED | pipeline facts | Staff / delivery-capable roles |
| `order.readyForDelivery` | SO first becomes `READY_FOR_DELIVERY` in `rollupProgress` | same | Dealer (own SO) + staff |
| `delivery.readyToLoad` | Delivery row exists when ready-for-delivery predicates hold | same | Delivery staff/workers |
| `order.onHold` | `SalesOrdersService.hold` | after persist | Dealer + assigned open workers + staff. **No hold reason on lock screen**. Actor excluded |
| `order.resumed` | `POST /sales-orders/:id/resume` | after persist | Same audiences |
| `order.cancelled` | `SalesOrdersService.cancel` after tx | after persist | Dealer + workers who had open assigned work **collected before** cancel mutates tasks |

QC `ORDER_CONFIRMED` placeholders in `quality.controller.ts` are removed. Inbox and push share one `NotificationsService.emit` (one row + outbox).

## DAG rules

`unlockReadyStages` uses snapshot edges / `dependsOnCodes` (merge = all predecessors `COMPLETED` or `SKIPPED`). Collect only `NOT_STARTED → READY`. Already-READY rows are not re-emitted.

Parallel A+B→C: completing A leaves C pending (no notify). Completing B unlocks C once (`eventId` `task.ready:task:{id}:NOT_STARTED→READY`).

Cancelled POs skip unlock. Held SO/PO skip handoff pushes (workers already got `order.onHold`).

Unassigned READY: **no skill-matched worker blast** (no existing factory rule). Staff/admin only.

Assigned next worker still receives `task.ready` even if they completed the prior stage (explicit extras bypass actor exclusion).

## Worker destinations

`linkUrl` is `/tasks/{taskId}` for ready/assigned/QC rework/packaging-ready. Same mapper for inbox, foreground, background, and killed-app pending intent (`mapNotificationLinkToHref(linkUrl, surface, topic)`).

Dealer never receives QC/rework/`stage.completed`. Worker never opens `(admin)`.

## Push-safe wording (EN / AR / HE in catalog)

| Topic | EN title / body (lock screen) |
|---|---|
| `task.ready` | `{taskName} is ready` / `{number} · Your next task is ready to start.` |
| `quality.reworkRequired` | `Rework required` / `{number} needs attention before it can continue.` |
| `order.onHold` | `Order on hold` / `{number} is on hold.` (no reason) |
| `order.resumed` | `Order resumed` / `{number} is moving again.` |

Identifiers like `SO-1042` are allowed. Costs, margins, hold reasons, QC defect notes, and worker blame are stripped (`SAFE_PUSH_VAR_KEYS`).

## Intentionally not emitted

- Skill-matched blast for unassigned READY (audited: no factory rule)
- Next-stage `task.ready` while SO/PO is `ON_HOLD` or `CANCELLED`
- `order.setupReleased` / remaining `ORDER_CONFIRMED` on commercial confirm / setup release (not Slice 5)
- PO / PR / GRN / fabric / invoice overdue / IAM / schedule refresh (Slice 6–7)
- Lock-screen QC defect notes, hold reasons, costs, margins
- Duplicate `quality.reworkRequired` from fail submit when `startRework` already runs (`skipReworkRequired`)

## Tests

- `pipeline-handoff.spec.ts` — linear + **parallel A+B→C** + no duplicate
- `floor-handoff.emit.spec.ts` — assigned, unassigned, QC/packaging topics, delivery-ready predicate, cancel suppression, hold privacy, eventId, rework
- `recipient-resolver.floor.spec.ts` — no worker spam, assigned delivery, preference off, completing actor who is the next assignee
- `sales-order-resume.spec.ts` — resume status inference
- `@maher/notifications` foundation: dealer QC hidden from prefs, AR/HE catalog parity, cold-start `task.ready`, account-switch
- Existing slices 1–4: account-switch, emit idempotency, privacy, live Expo hrefs
- QC replan wiring still asserts pass/fail replan; `ORDER_CONFIRMED` notify removed

## Local API UAT (2026-09-14, API :4000)

Demo logins password `123`. Inbox + canonical complete (not a RN button emit).

1. **Linear / DAG unlock** — carpenter completed `SO-P8-A` carpentry. Next executable was **Foam** (not painting, not upholstery). Admin received one `task.ready` (“Foam preparation is ready”, `/tasks/{foamId}`). Painter, upholsterer, carpenter, and dealer oasis received **no** factory ready row.
2. **No premature join** — carpenter completed `SO-P8-L` carpentry. Painting + Foam became READY in parallel. Upholstery stayed `NOT_STARTED`. Upholsterer inbox stayed empty.
3. **Duplicate suppression** — completing an already-READY stage is not re-collected (`NOT_STARTED` only). Stable `eventId` `NOT_STARTED→READY`.
4. **QC fail + rework** — inspector submitted `FAILED_REWORK_REQUIRED` on `SO-P9-A` with upholstery reentry. Inspector (actor) got no fail push. Upholsterer received **one** `quality.reworkRequired` (“Rework required” / `SO-P9-A needs attention…` / `/tasks/{reworkTaskId}`). Body contained **no** defect notes. Dealer oasis had no QC row. Admin received `quality.failed` + staff `quality.reworkRequired`.
5. **Hold + preference** — oasis `order.onHold` explicit off. Admin held `SO-P8-A` with internal reason `internal margin review — do not leak`. Oasis inbox did **not** get `order.onHold`. Admin (actor) did not get hold. Resume: oasis received `order.resumed` (“SO-P8-A is moving again.”). Lock-screen copy had no reason.
6. **Rework complete → inspector** — live rework start on P9-A blocked on `INSUFFICIENT_SEMI_FINISHED_STOCK` (fixture inventory). Covered by unit tests (`onReworkReadyToInspect` + `completeRework` wiring). Demo piece 9 still has inspector READY / packer READY scenarios for a later floor walk.
7. **Account switch** — slice 4 device-token specs re-run (token reassigned A→B; A undeliverable).
8. **Routes** — worker `task.ready` / `quality.reworkRequired` `linkUrl` `/tasks/{id}` → `/(app)/(employee)/tasks/{id}` in mapper tests (inbox, push, cold-start).

iOS Simulator lock-screen banners were not driven in this session (Metro up; no Expo push token on Simulator). Inbox + API complete is the same `emit` path as push outbox.

## Defects fixed in this slice

- QC lock-screen used `ORDER_CONFIRMED` and the QC document number
- Next-stage notify did not exist (workers learned READY only by opening the app)
- Sales-order resume had no canonical API (now `POST /sales-orders/:id/resume` + admin Resume on `ON_HOLD`)
- Floor workers with `production-task.read` would have been treated as staff fan-out for `task.ready`
- Cancel collected assigned workers **after** tasks were cancelled (would have notified nobody)
- Assigned next worker who also completed the prior stage was dropped by `excludeActor`
