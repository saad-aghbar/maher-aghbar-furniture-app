# Apple Watch architecture audit

**Date:** 2026-09-19  
**Scope:** Phase 0 of the native watchOS companion. No application code was changed for this note.  
**Source of truth:** source code. This document locates the contracts; it does not replace them.

The universal iPhone / iPad / Android app has completed its major interactive UAT. The Watch is a **new product surface**, not a responsive layout of the existing ERP.

---

## Current mobile architecture

| Piece | Path / fact |
|-------|-------------|
| App | Expo SDK 54 / React Native 0.81 / Expo Router 6 — [`apps/mobile`](../apps/mobile) |
| Routes | Thin file tree in [`apps/mobile/app/`](../apps/mobile/app/) — `(auth)`, `(app)/(admin)`, `(app)/(customer)`, `(app)/(employee)` |
| Screens | [`apps/mobile/src/features/`](../apps/mobile/src/features/) |
| Shell | [`apps/mobile/src/navigation/`](../apps/mobile/src/navigation/) — `AdaptiveShell`, `SurfaceGate` |
| HTTP | [`apps/mobile/src/api/client.ts`](../apps/mobile/src/api/client.ts) → `{getApiBaseUrl()}/api/v1` |
| Config | Dynamic [`apps/mobile/app.config.ts`](../apps/mobile/app.config.ts) — bundle `jo.maheraghbar.furniture`, scheme `maher` |
| Surfaces | `resolveAppSurface()` → `'admin' \| 'customer' \| 'employee'` |

No WatchConnectivity, WatchKit, or `@bacons/apple-targets` code exists today.

---

## Current iOS architecture

[`apps/mobile/ios`](../apps/mobile/ios) is **generated and gitignored** (`apps/mobile/.gitignore` line 16). Zero files are tracked. `expo prebuild` / `expo run:ios` regenerate it.

| Fact | Detail |
|------|--------|
| Product | `MaherAlAghbarFurniture` (`.xcodeproj` + `.xcworkspace`) |
| Team | Personal Team `NR2ZFUP7R7` (overridable via `APPLE_TEAM_ID`) |
| Plugins | [`apps/mobile/plugins/withAndroidTabletOrientation.js`](../apps/mobile/plugins/withAndroidTabletOrientation.js), [`withPersonalTeamIosCapabilities.js`](../apps/mobile/plugins/withPersonalTeamIosCapabilities.js) |
| Push | Stripped on local Personal Team builds — `aps-environment` cannot be provisioned |
| Signing | Device / Mac Designed-for-iPad install is already **BLOCKED** on the free team |

A Watch target added only inside `ios/` would be destroyed by the next prebuild and would never be committed. Swift source must live **outside** `ios/`.

---

## Auth flow

Global prefix: `/api/v1` ([`apps/api/src/main.ts`](../apps/api/src/main.ts)).

| Step | Contract |
|------|----------|
| Mobile login | `POST /api/v1/auth/mobile/login` → `{ user, accessToken, refreshToken }` |
| Me | `GET /api/v1/auth/me` — `AuthUser` + MFA flags |
| Refresh | `POST /api/v1/auth/mobile/refresh` — **rotating** opaque refresh; old `Session` row revoked |
| Logout | `POST /api/v1/auth/mobile/logout` |
| Access JWT | `{ sub: userId, typ: 'access' }`, **15 minutes**. Roles/permissions are **not** in the JWT; they are loaded from the DB on every request |
| Refresh | 48-byte hex, SHA-256 in `Session`, **30 days** |
| Guards | Global `JwtAuthGuard` then `PermissionsGuard` |

Mobile storage ([`apps/mobile/src/storage/tokens.ts`](../apps/mobile/src/storage/tokens.ts)):

- `maher.access_token` / `maher.refresh_token` in Expo SecureStore (iOS Keychain)
- Auth orchestration: [`apps/mobile/src/auth/AuthProvider.tsx`](../apps/mobile/src/auth/AuthProvider.tsx)
- `clearSession()` wipes tokens and emits `session_expired`

`AuthUser` (`@maher/types`): `id`, `username`, `name`, `roles`, `permissions`, `stageSkillCodes`, `preferredLanguage`, optional `customerId`. **No `employeeId`** — worker identity is `user.id`.

MFA is TOTP on login (`MFA_REQUIRED` / `MFA_INVALID`). Demo users have not exercised it. The Watch must inherit a post-login session from the phone; it must not prompt for credentials or MFA.

**Implication:** two independent refreshers will revoke each other. The iPhone must remain the only refresh owner.

---

## Role flow

Identity roles in [`packages/permissions/src/catalog.ts`](../packages/permissions/src/catalog.ts):

```
CUSTOMER
PRODUCTION_WORKER
SYSTEM_ADMINISTRATOR
```

Staff presets (`WAREHOUSE_MANAGEMENT`, `PRODUCTION_MANAGEMENT`, …) are extra `Role` rows (`kind: 'STAFF'`), not identity roles.

Surface routing ([`packages/permissions/src/routing.ts`](../packages/permissions/src/routing.ts)):

| `resolveAppSurface()` | Watch label |
|-----------------------|-------------|
| `employee` | Worker |
| `admin` | Admin |
| `customer` | Dealer (`customerId` or `CUSTOMER` role) |

Watch must reuse this helper. Do not invent a parallel `WORKER` / `ADMIN` / `DEALER` role enum on the backend.

---

## Worker task flow

Primary controller: [`apps/api/src/modules/tasks/tasks.controller.ts`](../apps/api/src/modules/tasks/tasks.controller.ts).

| Need | Endpoint | Permission |
|------|----------|------------|
| Today's / open work | `GET /api/v1/tasks/my-orders?segment=open\|today\|active` | `production-task.read` |
| Order lane | `GET /api/v1/tasks/my-orders/:productionOrderId/workflow` | `production-task.read` |
| Detail | `GET /api/v1/tasks/:id` | `production-task.read` |
| Start | `POST /api/v1/tasks/:id/start` (no body) | `production-task.update-own` **or** `update-any` |
| Complete | `POST /api/v1/tasks/:id/complete` | `production-task.complete` |
| Pause / resume | `POST /api/v1/tasks/:id/pause` · `/resume` | `update-own` or `update-any` |

There is **no** “current task” endpoint. Infer `IN_PROGRESS` from `segment=active` or the workflow lane.

`TaskStatus`: `NOT_STARTED`, `READY`, `IN_PROGRESS`, `PAUSED`, `BLOCKED`, `READY_FOR_INSPECTION`, `COMPLETED`, `CANCELLED`.

Complete body (`CompleteTaskDto`): optional `notes`, `photoDocumentIds`, `qtyDelta`, **`idempotencyKey`** (8–128 chars), `confirmedPackageLabels`, `packagingProblem`. Omit `qtyDelta` to complete remaining qty.

**QC / INSPECTION stages cannot use `/complete`** — the service throws `USE_QUALITY_SUBMIT`.

Double-complete of an already-`COMPLETED` task returns current detail (no second pipeline run). Same `idempotencyKey` returns the cached `IdempotencyRecord`. No HTTP `Idempotency-Key` header — body field only.

Start/complete emit `FloorHandoffService` topics `task.started` / `task.completed`. They do **not** write `AuditEvent`.

Mobile reuse: [`apps/mobile/src/api/modules/tasks.ts`](../apps/mobile/src/api/modules/tasks.ts) + [`apps/mobile/src/features/tasks/query.ts`](../apps/mobile/src/features/tasks/query.ts).

Some stages require photos, WIP claim/receive, or package labels before complete. Those stay on iPhone (`Continue on iPhone`). Watch v1 should only start/complete stages that do not require extra payload.

---

## Inspection flow

Controller: [`apps/api/src/modules/quality/quality.controller.ts`](../apps/api/src/modules/quality/quality.controller.ts).

| Step | Endpoint | Permission |
|------|----------|------------|
| Floor context | `GET /api/v1/quality-inspections/orders/:productionOrderId/context` | `quality-inspection.read` |
| Create or reopen | `POST /api/v1/quality-inspections` `{ productionOrderId, stageCode?, idempotencyKey? }` | `quality-inspection.perform` |
| Pass / fail | `POST /api/v1/quality-inspections/:id/submit` | `quality-inspection.perform` |
| Start rework | `POST /api/v1/quality-inspections/rework/:reworkId/start` | `quality-inspection.approve` |

`QualityResult`: `PASSED`, `PASSED_WITH_NOTES`, `FAILED_REWORK_REQUIRED`, `BLOCKED`.

Inspection is a **separate** `QualityInspection` row linked to the production order. The worker's INSPECTION `ProductionTask` has `executionKind = QUALITY`. No FK from task → inspection.

Defect categories (string convention, not a Prisma enum) in [`apps/api/src/modules/quality/quality-floor.ts`](../apps/api/src/modules/quality/quality-floor.ts):

`CARPENTRY`, `ASSEMBLY`, `UPHOLSTERY`, `PAINT_FINISH`, `DIMENSIONS`, `FABRIC`, `HARDWARE`, `DAMAGE`, `WRONG_SPEC`, `MISSING_COMPONENT`, `OTHER`.

API does **not** require text or photos on fail. Mobile `QcFailSheet` requires a description in UI only. Watch can submit `{ result, defectCategory, severity }` and offer `Continue on iPhone` for a long note.

No dedicated “pending inspections for me” list — workers find INSPECTION tasks via `GET /tasks` / `my-orders`.

---

## Notification flow

Canonical topics: [`packages/notifications/src/topics.ts`](../packages/notifications/src/topics.ts).

Inbox + device tokens: [`apps/api/src/modules/notifications/notifications.controller.ts`](../apps/api/src/modules/notifications/notifications.controller.ts) — all require `notification.read`.

Watch-relevant topics (already emitted): `task.assigned`, `task.ready`, `task.started`, `task.completed`, `quality.queued`, `quality.failed`, `quality.passed`, `delivery.readyToLoad`, `delivery.completed`, `order.confirmed`, `order.readyForDelivery`.

Push path: `NotificationsService.emit` → `Notification` + `NotificationOutbox` → `PushDispatchWorker` → **Expo Push API** (not direct APNs). Payload `data.linkUrl` is an API path (`/tasks/:id`), not `maher://`.

Local Personal Team builds strip APNs. In-app inbox still works. Watch notification *forwarding* therefore depends on a paid-team iPhone build (already documented in [`NOTIFICATIONS_PHYSICAL_PUSH_UAT.md`](NOTIFICATIONS_PHYSICAL_PUSH_UAT.md)). Do not create a second notification backend.

---

## Backend endpoints relevant to Watch

### Reuse as-is (Phases 3–6 mutations)

| Role | Action | Endpoint |
|------|--------|----------|
| Worker | Start / complete | `POST /tasks/:id/start` · `/complete` |
| Worker | Inspection | `POST /quality-inspections` · `/:id/submit` |
| Any | Inbox | `GET /notifications` · `POST /notifications/:id/read` |
| Dealer | Orders | `GET /sales-orders` (scoped by `user.customerId`) · `GET /sales-orders/:id` |
| Dealer | Promise | `GET /scheduling/orders/:productionOrderId` |
| Dealer | Home glance | `GET /reports/dealer-home` |
| Dealer | Confirm receipt | `POST /deliveries/:id/confirm-receipt` (`delivery.confirm-own-receipt`) |
| Admin | Glance | `GET /reports/management-summary` · `GET /reports/admin-home` |
| Admin | Rework start | `POST /quality-inspections/rework/:reworkId/start` |

### Do not invent

- Admin “mark delivered” — staff `PATCH` to `DELIVERED` is rejected (`DELIVERY_DEALER_CONFIRM_REQUIRED`).
- Generic “dismiss operational alert” — `management-summary.attention[]` is read-only; only notifications have mark-read.
- Goods receipt — exists (`POST /purchase-orders/:id/goods-receipts`) but the body is a line-level receive form. Not a Watch one-tap.

### Later aggregation (not Phase 0–2)

`GET /tasks/my-orders` is order-grouped (2–3 round trips to the current task). `GET /reports/management-summary` returns ~17 top-level sections. Wrist-sized later endpoints, wrapping existing services and guards:

- `GET /api/v1/watch/worker/today`
- `GET /api/v1/watch/admin/summary`
- `GET /api/v1/watch/dealer/orders`

No new permission codes required for Phase 0–2. Watch affordances = intersection of server `user.permissions` with a fixed allowlist. API guards stay authoritative.

---

## Existing iOS native integration

| Item | Status |
|------|--------|
| Config plugins | Two JS plugins under [`apps/mobile/plugins/`](../apps/mobile/plugins/) |
| Local Expo modules | **None** (`apps/mobile/modules/` does not exist) |
| Autolinking | `expo-modules-core` is present via Expo; RN new architecture is on |
| Deep link | Scheme `maher`. No custom linking object. Notification taps use `@maher/notifications` href mapping |
| Watch / App Groups | None. A free Personal Team cannot create an App Group |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `ios/` is prebuild-generated | High | Swift lives in `apps/mobile/targets/watch/`; inject via `@bacons/apple-targets` |
| Refresh-token rotation | High | iPhone is the only refresher; Watch holds an access token in memory only |
| Lost Watch | High | No passwords, PINs, or refresh tokens on Watch; clear on logout / epoch mismatch |
| Personal Team signing | High | Device install **BLOCKED**. Simulator is the Phase 0–2 proving ground |
| No App Group | Medium | Complications (Phase 8) blocked; use WatchConnectivity, not shared defaults |
| APNs stripped locally | Medium | Phase 7 notification forwarding blocked until paid team / EAS |
| No `AuditEvent.source` | Medium | Task complete does not write `AuditEvent`. `source: WATCH` needs a later schema decision — do not silently pretend it exists |
| Start/complete preconditions | Medium | WIP / photos / pack labels → `Continue on iPhone`, never false success |
| Prebuild churn | Medium | Adding a Watch target re-runs CocoaPods; must smoke-test the existing iPhone app |
| watchOS runtime missing | Medium | Only iOS 26.5 runtime is installed today; watchOS 27 SDK is present without a simulator runtime |
| `@bacons/apple-targets` watch embed | Medium | Pin **5.0.0+** (watch `Watch/` embed + modern `SDKROOT=watchos` detection) |
| Universal-app UAT | High | Do not restyle or refactor existing RN screens |

---

## Recommended Watch integration architecture

```
                    MAHER BACKEND
                         │
                 ┌───────┴───────┐
                 │               │
              iPhone          Watch
           (Expo RN +      (native SwiftUI
        Expo module)        watchOS app)
                 │               │
                 └── WatchConnectivity ──┘
```

1. **Native Watch app**, not React Native screens. Git-tracked at `apps/mobile/targets/watch/`.
2. **iPhone Expo module** `apps/mobile/modules/maher-watch-bridge/` — `WCSession` activated from an `ExpoAppDelegateSubscriber` so iOS can answer the Watch when the OS background-launches the app without the JS bridge.
3. **Hybrid networking:**
   - `updateApplicationContext` carries **identity only** (`sessionEpoch`, `userId`, `displayName`, `surface`, `roles`, filtered `capabilities`, `locale`, `apiBaseUrl`).
   - Watch requests the access token via `sendMessage` (ephemeral reply). Held **in memory only**.
   - Refresh token never leaves the iPhone.
   - Native Keychain vault mirrors the access token so the delegate can reply without JS.
4. **Surface** from `resolveAppSurface()` — `employee` → worker, `admin` → admin, `customer` → dealer.
5. **Capabilities** = `user.permissions ∩` Watch allowlist. No new catalog codes in Phase 0–2.
6. **`sessionEpoch`** increments on login-as-different-user and on logout. Mismatched epoch purges Watch state immediately.
7. **No Watch login form.** Unprovisioned: *Open the Maher app on your iPhone.* After logout: *Session unavailable.*
8. **Authorization stays on the server.** Watch `surface` / `capabilities` are convenience. A Watch claiming `admin` cannot bypass `PermissionsGuard`.
9. **Mutations (later phases)** reuse existing endpoints with `idempotencyKey`. Never display success until the server confirms.
10. **Do not rewrite the universal app UI.** Phone wiring is three call sites: publish on login / `refreshUser` / `applyUser`; clear on logout and session expiry; mirror the access token into the native vault from token persistence.

### Phase boundaries

| Phase | Deliverable |
|-------|-------------|
| 0 | This audit |
| 1 | Buildable Watch target + WCSession foundation |
| 2 | Identity, role entry, logout, account switch |
| 3–6 | Worker / inspection / admin / dealer product (later) |
| 7–8 | Notifications + complications — locally blocked as above |
| 9–10 | Offline hardening + real-device UAT (paid signing) |
