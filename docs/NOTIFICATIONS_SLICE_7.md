# Notifications Slice 7 — IAM, permissions, presets, nav/gating, whole-system audit

Date: 2026-09-14

Slices 1–6 are unchanged: topic catalog, inbox, Expo outbox, device-token binding, preferences, privacy, `eventId` idempotency, cold-start routing, `OpsNotifyService`, worker DAG handoff, purchasing/inventory/fabric/returns/finance/scheduling emitters.

**SLICE 7 COMPLETE** for identity + permission convergence.

This is the final notification + permission pass. No second permission system. No wildcard admin bypass: `SYSTEM_ADMINISTRATOR` remains an explicit grant of every catalog code except dealer-only `quotation.accept`.

## IAM events

Canonical persist site: `UsersController` (`POST /users`, `PATCH /users/:id`, activate/deactivate, reset-password, delete). Emit only after the user row is persisted (`IamNotifyService` → `NotificationsService.emit`).

| Topic | Transition | Recipients | `eventId` |
|---|---|---|---|
| `user.invited` | User row created and `isActive` | Staff with `user.manage` + **affected user extra**. Actor excluded. | `CREATED` |
| `user.deactivated` | `isActive` true → false (PATCH / deactivate). Delete emits before archive while still active. | Same + affected extra (extras load **even if inactive**, not if archived). | `DEACTIVATED:{updatedAt}` / `DELETED:{iso}` |
| `user.roleChanged` | `roleIds` actually changed after persist | Same + affected extra | `ROLE:{fromCodes}->{toCodes}` sorted |

HTTP may still return `temporaryPassword` to the inviting admin. **Push/inbox vars are empty** — no password, PIN, reset token, reason, or permission matrix.

Lock-screen copy (EN / AR / HE, not English fallback):

| Topic | Title | Body |
|---|---|---|
| `user.invited` | New staff account | A new staff account was created. |
| `user.deactivated` / `user.roleChanged` | Access changed | Your Maher ERP staff access was updated. |

Tap: `/users/{id}` → live admin users list (`ENTITY_DESTINATIONS.user`). Worker extra opens profile hub.

## Deactivation security (notification is not enforcement)

1. Persist `isActive: false`
2. Emit inbox + outbox (last push is best-effort)
3. Revoke open sessions **and** `devicePushToken.disabledAt`
4. JWT guard + refresh already require `isActive: true` (`JwtAuthGuard`, `AuthService`)

Password reset and archive/delete also call `revokeUserInteractiveAccess`. Account-switch token binding from Slice 4 is unchanged.

## Role change refresh

Backend permissions are loaded from the DB on **every** authenticated request. Mobile `AuthProvider` now refetches `/auth/me` when the app becomes `active`. Admin-web `useAuthMe` uses 15s stale time + window/reconnect refetch. Topic GET `/notifications/topics` uses live eligibility, not stored preference rows.

## Preferences are not authorization

`PUT /notifications/preferences` returns **400 `TOPIC_NOT_ELIGIBLE`** if any posted topic is unknown or ineligible. Stored warehouse rows do not make a Finance user eligible.

## Permission catalog

Audited against live modules. **No new permission codes** — existing catalog already covers cost, problems (`production-task.update-any`), delivery, inventory adjust, quality, AI intake, fabric, returns, scheduling.

Grouping metadata only (`PERMISSION_GROUPS`): job-language sections including **Returns** and **Fabric**. Codes unchanged.

## System preset refresh

Seed upserts **only** `SYSTEM_STAFF_PRESETS` (replaces that role’s `RolePermission` rows). Custom `isSystem: false` staff types are not in that loop and are not silently granted new codes.

| Preset | Added |
|---|---|
| `WAREHOUSE_MANAGEMENT` | `fabric.procurement.read` (physical fabric receive/hold) |
| `PRODUCTION_MANAGEMENT` | `schedule.manage` (at-risk / conflict topics) |
| `SCHEDULING` | `schedule.settings.manage` |

Not broadened: QC still has no finance; Delivery still has no `inventory.cost.read`; Production still has fabric **read** not manage.

## Nav / gates (aligned to the same intent)

Admin-web:

- Products → `catalog.read` (manage stays on category/material nested items)
- Returns → `return.read` (was sales-order/customer)
- Payments nested → `payment.read`
- Fabric jobs nested → `fabric.procurement.read`
- Receive nested → `inventory.receive`

Mobile More/overflow:

- Added live **AI intake** (`ai-intake.read` / `manage`) and **production problems** (`production-task.update-any`)
- Returns tightened to `return.read` (route gate matches)
- **Not added:** admin Quality list or Deliveries list — those Expo routes do not exist (`quality/` is web-only; mobile deliveries are `[id]` only)

## Staff UX

- `StaffTypeEditorScreen` uses a parchment `PermissionBoard`: grouped sections, search, select-all / clear group, labels + descriptions, EN/AR/HE, RTL. System presets stay read-only. Dependency expansion unchanged.
- Create/edit staff: **read-only** grouped preview of the selected Staff Type. No second personal permission matrix. Identity remains User → Staff Type → Permissions.

## Persona matrix (proof)

| Persona | Visible / allowed | Forbidden |
|---|---|---|
| SYSTEM ADMIN | All admin modules and catalog topics except dealer `quotation.accept` | Dealer-only accept |
| PRODUCTION MANAGER | Production, problems, workflow, schedule manage, fabric read | PO create, invoices, user.manage, fabric.manage |
| SCHEDULER | Schedule read/manage/settings | Receive, invoices, user.manage |
| WAREHOUSE | Inventory ops, receive, fabric read, PO read | Cost, invoices, user.manage, schedule.manage |
| PURCHASING | PO, supplier, fabric manage, receive | Invoice create, user.manage |
| QC | Quality inspect/perform, production/task read | Finance, purchasing, cost |
| DELIVERY | Delivery read/update | Cost, workflow manage, user.manage |
| FINANCE | Invoice, payment, statement | Warehouse receive, user.manage |
| SALES | Dealers, orders, returns, catalog.read | Purchasing, cost |
| PRODUCTION WORKER | Own tasks / allowed floor QC / own notifications | Purchasing, cost, invoices, users, catalog.manage, schedule admin |
| DEALER | Own orders, invoices, returns, dealer schedule `*.own` | Cost, supplier, internal inventory, staff, QC internals, fabric procurement, factory schedule admin |

## Dead / legacy topics (not revived)

| Topic | Why |
|---|---|
| `schedule.awaitingApproval` / `schedule.replanProposed` | Leftover automatic scheduling. Catalog kept, `defaultOn: false`. No emitter. |
| `pr.rejected` | No reject persist API |
| `payment.failed` | No failed-payment persist |
| `inventory.correctionPending` | No pending-correction persist |

No live emitter uses a random `NotificationTemplate` outside the catalog.

## Tests

- `iam-notify.emit.spec.ts` — invited/deactivated/roleChanged eventIds, empty vars, no secrets
- `user-access.spec.ts` — session + token revoke, role fingerprint
- `notifications.preferences.spec.ts` — ineligible PUT 400
- `recipient-resolver.floor.spec.ts` — extra ids not wrapped in `isActive: true`
- `device-tokens.account-switch.spec.ts` — existing A→B plus `disableAllForUser`
- `@maher/permissions` persona-matrix + preset packs + grouping / select-all
- `@maher/notifications` topic/permission parity + Warehouse→Finance eligibility + IAM AR/HE copy
- Admin-web `canSeeNav` + mobile overflow gates
- Existing slices 1–6 suites kept

## Local API UAT (2026-09-15, API :4000)

Demo password `123`. Inbox + topics + `/auth/me` share the same `NotificationsService.emit` path as Expo outbox. **APNs lock-screen banners were not claimed** (Simulator / Personal Team has no push token).

| Check | Result |
|---|---|
| Admin topics | 107 codes including IAM + every live ops group |
| Warehouse topics | 36. `inventory.lowStock` / `grn.posted` / `po.late` / `fabric.arrived` **on**. `invoice.overdue` / `user.invited` / `schedule.conflict` **off**. Live perms include `fabric.procurement.read`. |
| Oasis (dealer) | 36 commercial topics. `invoice.overdue` on. **No** `po.late`, fabric, QC, IAM, schedule conflict |
| Carpenter (worker) | `task.ready` / `quality.queued` on. **No** `po.late` / invoices / IAM. Floor emit is still extras-only |
| Warehouse `PUT invoice.overdue: true` | **400 `TOPIC_NOT_ELIGIBLE`** |
| Create `slice7uat` as Warehouse | Inbox: `user.invited` / `New staff account` / `A new staff account was created.` No password |
| Patch `slice7uat` → Finance | Inbox: `user.roleChanged` / `Access changed`. Login `/me`: `invoice.read` yes, `inventory.read` no. Topics: overdue **on**, low-stock/GRN **off** |
| Deactivate `slice7uat` | Login **401 `ACCOUNT_SUSPENDED`**. Previous access token `/auth/me` **401** |

Throwaway user `slice7uat` was left **inactive** in the demo DB.

## Simulator

Metro was already running. Inbox, routing, prefs, role change, and deactivation were proven on the live API (same emit path as push). Simulator lock-screen banners were **not** exercised.

## Intentionally deferred

- Physical device Expo push / APNs lock-screen UAT
- Admin Quality / Deliveries **list** screens on mobile (routes do not exist)
- Silently granting new permissions to custom staff types
