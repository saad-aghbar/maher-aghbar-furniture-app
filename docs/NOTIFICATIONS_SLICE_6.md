# Notifications Slice 6 — purchasing, inventory, fabric, returns, finance, scheduling

Date: 2026-09-14

Foundation (slices 1–5) is unchanged: topic catalog, device vs user settings, Postgres outbox, account-switch token binding, cold-start pending intent, `linkHref`, preferences, lock-screen privacy, `eventId` idempotency, worker DAG / QC / packaging.

**SLICE 6 COMPLETE** for operational domains:

PURCHASING · INVENTORY · FABRIC · RETURNS · FINANCE · SCHEDULING

all emit through `OpsNotifyService` → `NotificationsService.emit` → inbox + outbox. There is no second notification mechanism.

## Emit sites

| Topic | Canonical transition | Site | Recipients |
|---|---|---|---|
| `pr.created` | PR persist `SUBMITTED` | `PurchasingController.createRequest` after insert | Staff with `purchase-request.read`. Actor excluded. |
| `pr.approved` | PR `SUBMITTED → APPROVED` | `PurchasingController.approveRequest` after update | Same staff + requester extra. **No reject endpoint exists** → `pr.rejected` not emitted. |
| `po.approved` | DRAFT → APPROVED | `approve` + send auto-approve | `purchase-order.read` |
| `po.sent` | First persist `SENT` (not WhatsApp resend) | `markPurchaseOrderSent` / send | Purchasing staff |
| `po.partial` / `po.received` | PO status change after GRN commit | `receivePurchaseOrderGoods` | Purchasing + warehouse (`inventory.receive`) |
| `po.cancelled` | Cancel with no GRNs | purchasing controller | Purchasing |
| `po.late` | SENT / PARTIALLY_RECEIVED and `expectedDeliveryDate` before factory local start-of-today | `OpsJobsWorker.emitLatePurchaseOrders` | Purchasing. Idempotent `LATE:{expectedYmd}` |
| `grn.posted` | Goods receipt rows committed | `receivePurchaseOrderGoods` | Purchasing + warehouse. Tap `/inventory/receive/{id}` (live Expo receive detail — no invented GRN route) |
| `inventory.received` / `issued` / `transferred` / `adjusted` | `InventoryService.applyMovement` after a **committed** public write (`!db`) | inventory service | Matching inventory permission. **Default off** |
| `inventory.counted` | Same path when `referenceType === 'InventoryCount'` | `postCount` → `applyMovement` | `inventory.count`. Default off |
| `inventory.lowStock` | Quantity **crosses** from `> min` to `≤ min` | After GRN commit (pre-tx snapshot) and after public `applyMovement` | `inventory.read` or `purchase-request.read`. EventId `CROSS:{before}→{after}` |
| `inventory.shortageBlockingProduction` | SO actually `WAITING_FOR_MATERIALS` | Confirm leftover path, production-setup release, scheduling material wait | Purchasing + production (`purchase-order.read` / `production-order.read`). **No dealer.** EventId `ENTER:{salesOrder.updatedAt}` |
| `inventory.finishedPosted` | `FINISHED_GOODS_RECEIPT` after QC pass | `TasksService.complete` after tx | Warehouse / delivery (`inventory.read` / `delivery.read`). **Not shipped.** No dealer |
| `fabric.needsOrdering` | New `FabricProcurement` `NEEDS_ORDERING` | `OrderProductionSetupService.notifyNewFabricJobs` | Default **off** |
| `fabric.awaitingSupplier` | WhatsApp/send → `AWAITING_SUPPLIER` | `FabricProcurementService.sendWhatsApp` | Default **off** |
| `fabric.arrived` | Event `RECEIVED` | fabric receiving / GRN fabric lots | Warehouse + purchasing |
| `fabric.readyForPickup` | State `READY_FOR_PICKUP` | receiving + `setSupplierState` | Production + purchasing (actor kept). Assigned open workers on that production order as extras. Copy `{number} · {sku}` (SO + fabric name) |
| `fabric.unavailable` | Supplier `UNAVAILABLE` | `setSupplierState` | Purchasing + production. Actor kept. **Not dealer** |
| `return.*` (case templates that exist) | `ReturnRequest` lifecycle + charge + reship + dealer confirm on RETURN_RESHIP | `ReturnsController` / deliveries confirm-receipt | Dealer: own case, safe journey only. Staff: `return.read`. No `ReturnPiece` spam. `SCRAP_RECOVERY` is not a case topic |
| `invoice.created` / `invoice.voided` | Invoice issued / voided | `InvoicesService` after persist | Dealer (own) + `invoice.read` |
| `invoice.overdue` | Status set `OVERDUE` for unpaid past-due | `OpsJobsWorker.markOverdueInvoices` | Dealer own + finance. One event per `OVERDUE:{dueYmd}`. Paid/void/cancelled/draft excluded |
| `payment.received` | Payment row recorded | `PaymentsService.record` after tx | Dealer own + `payment.read`. Copy uses invoice number, **no amount** |
| `schedule.atRisk` | Persisted `NEEDS_REVIEW` / `promiseState AT_RISK` / `materialRisk` | `markNeedsReview` (only when not already at risk), task blocker crossing, plus job on latest schedule per PO | `schedule.manage` only. Not dealer (`order.mayBeDelayed` is a separate commercial topic, not wired here). EventId `AT_RISK` per production order |
| `schedule.conflict` | `detectConflicts` on live allocations | `OpsJobsWorker.emitOpenConflicts` | Scheduling managers. EventId `OPEN` + conflictId |
| `task.scheduledToday` | Assigned open task whose `plannedStart` is factory-local today | Daily job + schedule approve + manual `PlacementService` when the window is today | **Assigned worker only**. One `task/{id}/{ymd}` |

## Scheduled jobs

`OpsJobsWorker` (15 minutes, factory timezone `Asia/Amman` or default calendar). Disabled when `OPS_NOTIFY_JOBS=0`, `NODE_ENV=test`, or Jest (`JEST_WORKER_ID`). First tick on process start.

| Job | Rule |
|---|---|
| Invoice overdue | `dueDate < startOfLocalDay`, outstanding > 0, not PAID/VOID/CANCELLED/DRAFT → set `OVERDUE` then emit once per due date |
| PO late | SENT / PARTIALLY_RECEIVED, expected date before today |
| Scheduled today | Assigned, not COMPLETED/CANCELLED, plannedStart on today’s factory YMD |
| At-risk | Latest schedule per production order with AT_RISK or materialRisk |
| Conflicts | Evaluated, not a Prisma table. Same `conflictId` does not re-notify |

## Idempotency

All Slice 6 emits use `notificationEventId({ topic, entityType, entityId, transition })`. Inbox unique `(userId, eventId)` + outbox. Retries of the same persist reuse the same id.

Low stock: a second issue **while already below min** is a different `before/after` pair only if quantities change; the **crossing predicate** is false, so no emit. Recover above min then drop again → new numbers → new event.

Schedule at-risk: one event per production order (`AT_RISK`), not per schedule version.

## Privacy (lock screen)

`SAFE_PUSH_VAR_KEYS` only (`number`, `sku`, `invoice`, `taskName`, `date`, …). Templates do not include costs, margins, supplier prices, bank details, recovery internals, employee rates, or scheduling diagnostics.

Examples:

- `Purchase order is late` / `{number} is late.`
- `INV-COST-LOW has a new payment.` (no amount)
- `RET-2026-00004 was approved.`
- Fabric: `SO-1042 · Velvet 302 is ready.`

## Default on / off

**On (actionable):** low stock, shortage blocking production, PO late, GRN posted, PO lifecycle, fabric arrived / ready / unavailable, return case journey, invoice created/overdue/voided, payment received, schedule at-risk / conflict, FIN posted, task scheduled today.

**Off (noise):** routine inventory receive/issue/transfer/adjust/count; fabric needs-ordering and awaiting-supplier; `task.started/paused/resumed`; leftover `schedule.awaitingApproval` and `schedule.replanProposed`.

## Navigation (live Expo only)

| Domain | `linkUrl` | Admin href | Dealer / worker |
|---|---|---|---|
| PO | `/purchasing/{id}` | `/(app)/(admin)/purchasing/{id}` | Hub fallback (no dealer PO) |
| GRN | `/inventory/receive/{id}` | `/(app)/(admin)/inventory/receive/{id}` | Not admin for dealer |
| Low stock | `/inventory/low-stock` | `/(app)/(admin)/inventory/low-stock` | Staff |
| Item | `/inventory/items/{id}` | items detail | Staff |
| FIN | `/inventory/finished/{salesOrderId}` | finished board | Not “shipped” |
| Fabric | `/purchasing/fabric/{id}` | fabric detail | Staff |
| Return | `/returns/{id}` | admin return | `/(app)/(customer)/returns/{id}` |
| Invoice / payment | `/invoices/{id}` | admin invoice | `/(app)/(customer)/invoices/{id}` |
| Schedule | `/scheduling` | admin scheduling hub (no invented focused-order query) | Staff |
| Task today | `/tasks/{id}` | — | `/(app)/(employee)/tasks/{id}` |

## Intentionally not emitted

| Topic | Reason |
|---|---|
| `pr.rejected` | Enum exists; **no reject persist API** |
| `payment.failed` | No failed-payment persist |
| `inventory.correctionPending` | No pending-correction persist |
| Statement topics | Opening/generating a statement is not a state change |
| `schedule.awaitingApproval` / `schedule.replanProposed` | Leftover **automatic scheduling**. Catalog kept, `defaultOn: false`. Old `debouncedNotify('SCHEDULE_AWAITING_APPROVAL')` removed, not converted |
| Dealer fabric / shortage / FIN-as-shipped | Internal only |
| Piece-level return spam | Dealer stays case-level |
| Worker blast on global schedule edits | Only the assigned worker on assignee change (`task.assigned`) or today (`task.scheduledToday`); other days wait for the daily job |

## Preferences

Eligible topics from the catalog only. Examples from live `/notifications/topics` (password `123`):

- **Admin:** all Slice 6 codes
- **Warehouse:** PO receive/GRN/inventory/low-stock/FIN/fabric arrived — not PR, not invoices
- **Oasis / Nile (dealer):** returns journey + invoice/payment only. **No** `po.late`, `fabric.*`, `inventory.shortageBlockingProduction`, `inventory.finishedPosted`, `schedule.conflict`
- **Carpenter (worker):** `task.scheduledToday` plus permission-overlapping staff topics in the catalog; floor-operator fan-out still requires an explicit assignee extra at emit time

Oasis `invoice.overdue` preference was set **off** (`PUT /notifications/preferences`) and topics API returned `enabled: false`.

## Tests

- `ops-notify.classify.spec.ts` — low-stock crossing, PO late, invoice overdue exclusions, fabric/return maps, scheduled-today eligibility
- `ops-notify.emit.spec.ts` — stable eventIds (PO late, low-stock retry vs recover, invoice overdue, scheduled today, return case, GRN route, fabric SO+name without price, shortage `updatedAt`)
- `ops-jobs.worker.spec.ts` — overdue marks once / skips paid; PO late filter; scheduled-today skips completed
- `@maher/notifications` foundation — Slice 6 AR/HE copy, live hrefs (PO, receive, low-stock, fabric, returns, invoices, scheduling, FIN), dealer eligibility, default-off inventory receive / fabric needs-ordering / legacy schedule topics
- `device-tokens.account-switch.spec.ts` — token A→B; A undeliverable (finance→dealer same device)
- `notifications.emit.spec.ts` — eventId duplicate
- Regression: purchasing convert/send, fabric procurement/receiving, invoice create/update, payment update, deliveries confirm-receipt, placement, production-inventory, inventory lifecycle, returns piece 11, scheduling at-risk / unapprove / QC replan, pipeline handoff

## Local API UAT (2026-09-14, API :4000)

Demo password `123`. Inbox + canonical persist (same `emit` path as push outbox). iOS Simulator lock-screen banners were not driven (no Expo push token on Simulator). Metro was healthy.

1. **Invoice overdue job** — worker tick set OVERDUE and notified. Admin: INV-P7-D/E/I2/H. **Oasis:** only D and E. **Nile:** only I2 and H. Copy: `{number} is overdue.` Link `/invoices/{id}`. No amounts. Warehouse: none. Restart ticks did **not** duplicate the same `OVERDUE:{dueYmd}`.
2. **Payment received** — `POST /payments` 1 ILS on oasis `INV-COST-LOW`. Oasis inbox: `Payment received` / `INV-COST-LOW has a new payment.` / `/invoices/{id}`. No bank or amount. Admin (actor) excluded.
3. **Return approved** — `PATCH /returns/{id}/resolve` APPROVED/REPAIR on `RET-2026-00004`. Admin + oasis + warehouse: `Return approved` / `RET-2026-00004 was approved.` / `/returns/{id}`. No recovery internals.
4. **PO late job** — patched `PORD-2026-00019` expected date to 2026-09-12, then a new API process ticked. Admin + warehouse: `PO late` / `PORD-2026-00019 is late.` / `/purchasing/{id}`. Other already-late POs did not re-fire. Oasis: none.
5. **GRN posted** — warehouse posting excludes the actor (only warehouse user in seed). Admin posting `GRN-2026-00020` on `PO-P6-J` notified warehouse: `Goods received` / `Receipt GRN-2026-00020 was posted.` / `/inventory/receive/{id}` (live Expo receive detail).
6. **Low stock crossing** — warehouse issued `MAT-BEECH` from 514.05 → below min 40. Admin: `Low stock` / `MAT-BEECH is at or below minimum.` / `/inventory/low-stock`. A second issue while still low produced **no** extra row. Stock was restored with a receipt (routine `inventory.received` stays default off).
7. **Fabric** — `POST /fabric-procurements/{id}/supplier-state` UNAVAILABLE then READY_FOR_PICKUP on SO-FB1042. Admin (purchasing): `Fabric unavailable` / `SO-FB1042 is waiting on fabric.` then `Fabric ready` / `SO-FB1042 · Velvet 302 · Sand is ready.` / `/purchasing/fabric/{id}`. **Oasis: none.** Assigned-worker extras were empty on this job; floor workers are not permission-fan-out.
8. **Schedule at risk** — `GET /scheduling/at-risk` returned 5 live rows. Admin inbox: `Schedule at risk` / `{number} is at risk.` / `/scheduling`. Conflicts API returned 0 open pairs (no `schedule.conflict` to send). Dealer does not receive at-risk.
9. **Dealer prefs** — oasis eligible set is commercial only; `invoice.overdue` toggled **off** (`enabled: false`). Oasis never received `po.late`, fabric, shortage, FIN, or schedule conflict.
10. **Warehouse prefs** — PO/GRN/inventory/low-stock/FIN on; invoices/payments/schedule/fabric.unavailable off.
11. **Account switch** — unit suite re-run (shared device token reassigned; previous user undeliverable).
12. **Routes** — mapper tests against the live Expo tree (no invented GRN/quality detail).

## Defects found in UAT and fixed

- Fabric persist succeeded with **zero recipients** when admin was the actor and the only non-floor purchasing user. `fabric.unavailable` / `fabric.readyForPickup` now keep the recording purchaser in the inbox; ready also extras assigned workers on the production order.
- `schedule.atRisk` used `AT_RISK:{scheduleId}`, so each `markNeedsReview` version (and a later blocker) duplicated the same order. EventId is now `AT_RISK` per production order; emit is skipped while already at risk.
- Receivable/fabric list APIs return **raw arrays**, not `{ data }`.

## Simulator

API + Metro were up. Inbox + `linkUrl` are the same `NotificationsService.emit` path as Expo push outbox. Simulator has no push token, so lock-screen banners were not exercised (same constraint as Slice 5).

## Defects fixed in this slice

- Low-stock / PO-late / invoice-overdue / scheduled-today were screen-derived or missing; they are now persist + jobs
- `notifyLowStock` / sysadmin-only `LOW_STOCK` template path removed (second mechanism)
- Auto-schedule `SCHEDULE_AWAITING_APPROVAL` notify removed, not revived
- Shortage eventId uses the sales-order `updatedAt` so retries are stable and a later re-enter can fire
- Manual placement notifies the assigned worker (`task.assigned` / `task.scheduledToday`) instead of a global blast
- Return reship delivered uses `OpsNotifyService` instead of a parallel `notifyCustomerUsers` template when ops notify is wired
- Lock-screen payment copy no longer includes amount
- Fabric unavailable/ready kept the recording purchaser in the inbox (demo has no second buyer); ready extras assigned workers
- Schedule at-risk is one event per production order, not per schedule version
