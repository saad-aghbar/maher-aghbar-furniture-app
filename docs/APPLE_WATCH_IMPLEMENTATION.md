# Apple Watch implementation

Status of Phases 0–10. Do not mark device/signing items complete without a real Watch.

## Phase 0 — Audit

Delivered: [APPLE_WATCH_ARCHITECTURE_AUDIT.md](APPLE_WATCH_ARCHITECTURE_AUDIT.md).

## Phase 1 — Native target + session foundation

| Item | Status |
|------|--------|
| `@bacons/apple-targets@5.0.0` plugin | Done — [`apps/mobile/app.config.ts`](../apps/mobile/app.config.ts) |
| Git-tracked Watch app | Done — [`apps/mobile/targets/watch/`](../apps/mobile/targets/watch/) |
| iPhone Expo module | Done — [`apps/mobile/modules/maher-watch-bridge/`](../apps/mobile/modules/maher-watch-bridge/) |
| WCSession on both sides | Done |
| Expo AppDelegate subscriber | Done — activates session before JS |
| Native Keychain vault | Done — `MaherWatchVault` |
| JS no-op off iOS | Done — [`apps/mobile/src/watch/bridge.ts`](../apps/mobile/src/watch/bridge.ts) |
| Simulator runtime | Done — watchOS 27.0 (24R362) installed |
| Prebuild + Watch `xcodebuild` | Done — `MaherWatch` scheme **BUILD SUCCEEDED** on Apple Watch Series 12 (46mm) simulator |
| Pair Watch + iPhone sims | Done — Series 12 (46mm) paired with iPhone 17 Pro (iOS 26.5 + watchOS 27.0) |
| Universal iPhone smoke after prebuild | Done — Debug **BUILD SUCCEEDED** and interactive launch on iPhone 17 Pro (login + Khaled worker home after session restore). Evidence: `docs/universal-uat-evidence/watch-sim/`. |

## Phase 2 — Identity / logout / account switch

| Item | Status |
|------|--------|
| `WatchUserContext` + `resolveAppSurface()` | Done — [`apps/mobile/src/watch/context.ts`](../apps/mobile/src/watch/context.ts) |
| Capability allowlist (no new permission codes) | Done |
| Publish on login / bootstrap / `refreshUser` / Face ID unlock | Done — `AuthProvider` effect |
| Clear on logout / session expiry / disabled | Done |
| Access-token mirror from `setTokens` | Done — [`apps/mobile/src/storage/tokens.ts`](../apps/mobile/src/storage/tokens.ts) |
| On-demand token via `sendMessage` | Done — Watch `requestAccessToken` / `requestUserContext`; iPhone vault replies with context + token |
| `sessionEpoch` bump on account switch + logout | Done — [`apps/mobile/src/watch/sessionSync.ts`](../apps/mobile/src/watch/sessionSync.ts) |
| Identity + gate screens | Done — `IdentityHomeView`, `SessionUnavailableView` |
| No login form | Done |
| Jest: worker / admin / dealer / none / allowlist / epoch / logout / Android no-op | Done — 17 tests |

Phone wiring does **not** change universal-app UI. Three concerns only: publish context, clear context, mirror access token.

## Tests run (this pass)

```
pnpm --filter @maher/mobile exec jest src/watch
  3 suites / 17 tests PASS

pnpm --filter @maher/mobile exec jest src/auth/__tests__/logout.test.ts src/api/__tests__/refresh.test.ts
  PASS

pnpm --filter @maher/mobile typecheck
  PASS
```

## Blocked (do not retry as if they were code bugs)

| Item | Why |
|------|-----|
| Physical Watch / iPhone install | Free Personal Team `NR2ZFUP7R7` — same signing blocker as Mac Designed-for-iPad |
| Complications | WidgetKit + App Group; Personal Team cannot create an App Group |
| Watch notification forwarding | Local builds strip APNs (`withPersonalTeamIosCapabilities`); `DevicePushToken` empty |
| `source: WATCH` on audit rows | `AuditEvent` has no `source`; task complete emits `task.completed` only |

## How to build (after watchOS runtime is installed)

```bash
cd apps/mobile
pnpm exec expo prebuild -p ios
xcodebuild -workspace ios/MaherAlAghbarFurniture.xcworkspace \
  -scheme MaherWatch \
  -destination 'platform=watchOS Simulator,name=Apple Watch Series 11 (46mm)' \
  -configuration Debug build
```

Pair a Watch sim with an iPhone sim (`xcrun simctl pair`) before exercising WatchConnectivity.

## Phase 3 — Worker today / start / complete

| Item | Status |
|------|--------|
| `GET /api/v1/watch/worker/today` | Done — wraps `reports.workerHome` |
| Watch Worker home | Done — current task, Start / Complete |
| Start | Done — `POST /tasks/:id/start` (existing API has no idempotency body) |
| Complete | Done — `POST /tasks/:id/complete` with `idempotencyKey` |
| Continue on iPhone | Done — photos / WIP / packs / stock / locked stage |

## Phase 4 — Inspection

| Item | Status |
|------|--------|
| Pass / Fail + category chips | Done — `POST /quality-inspections/:id/submit` |
| Live seed inspection | No pending `result: null` row in current demo — UI wired, not photographed |

## Phase 5 — Admin

| Item | Status |
|------|--------|
| `GET /api/v1/watch/admin/summary` | Done |
| Alerts + Mark read | Done — `POST /notifications/:id/read` |

## Phase 6 — Dealer

| Item | Status |
|------|--------|
| `GET /api/v1/watch/dealer/orders` | Done — no money fields |
| Order status list | Done |

## Phase 7 — Notifications

In-app inbox glance is on the admin (and worker unread count) surfaces. **APNs forwarding to Watch remains BLOCKED** on the Personal Team.

## Phase 8 — Complications

**BLOCKED** — WidgetKit + App Group; Personal Team cannot create an App Group.

## Phase 9 — Offline

Last-glance cache + mutation queue in `WatchOfflineQueue` (no tokens). Replay on next successful client. Airplane mode not photographed.

## Phase 10 — Physical Watch UAT

**BLOCKED** — paid Apple Developer signing.
