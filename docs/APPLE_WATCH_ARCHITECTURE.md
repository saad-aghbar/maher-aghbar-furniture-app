# Apple Watch architecture

Native watchOS companion for Maher ERP. The iPhone remains the full ERP client. The Watch is the immediate-action client.

Product audit: [APPLE_WATCH_ARCHITECTURE_AUDIT.md](APPLE_WATCH_ARCHITECTURE_AUDIT.md).  
Implementation status: [APPLE_WATCH_IMPLEMENTATION.md](APPLE_WATCH_IMPLEMENTATION.md).  
UAT: [APPLE_WATCH_UAT.md](APPLE_WATCH_UAT.md).

## Surfaces

```
MAHER ERP
├── Web
├── iPhone / iPad / Android   (universal Expo app — do not restyle for Watch)
└── Apple Watch               (native SwiftUI)
       ├── Worker
       ├── Admin
       └── Dealer
```

Surface is derived on the iPhone with `resolveAppSurface()` (`employee` → worker, `admin` → admin, `customer` → dealer). The Watch never invents roles.

## Connectivity

```
MAHER BACKEND
     │
iPhone (Expo + maher-watch-bridge)  ←→  Watch (SwiftUI)
              WatchConnectivity
```

| Channel | Payload | Persistence |
|---------|---------|-------------|
| `updateApplicationContext` | Identity only: `sessionEpoch`, `userId`, `displayName`, `surface`, `roles`, filtered `capabilities`, `locale`, `apiBaseUrl`, `state` | OS-persisted latest blob. No secrets. |
| `sendMessage` `op=accessToken` or `op=userContext` | Identity blob from the iPhone vault, plus short-lived access JWT when `state=active` | Ephemeral reply. Watch holds the token **in memory only**. Used because `updateApplicationContext` can miss on simulator / first activation. |
| Refresh token | Never sent to Watch | iPhone SecureStore only |

The iPhone `WCSession` is activated from `MaherWatchAppDelegateSubscriber` so iOS can answer the Watch when the OS background-launches the app without the JS bridge. The access token is mirrored into a native Keychain vault (`MaherWatchVault`) so the delegate does not depend on React Native.

## Auth and invalidation

- No Watch login form, PIN, or MFA.
- `sessionEpoch` increments on logout and when the iPhone account changes.
- A mismatched epoch purges Watch protected state immediately.
- Logged-out / unprovisioned UI: *Open the Maher app on your iPhone* or *Session unavailable*.
- Authorization stays on the server. Watch `surface` / `capabilities` are convenience only.

## Permissions

No new catalog codes. Watch affordances = `user.permissions ∩` allowlist in [`apps/mobile/src/watch/context.ts`](../apps/mobile/src/watch/context.ts):

`production-task.read`, `production-task.update-own`, `production-task.complete`, `quality-inspection.perform`, `report.sales.read`, `notification.read`, `sales-order.read`, `delivery.confirm-own-receipt`.

## Source layout

| Path | Role |
|------|------|
| [`apps/mobile/targets/watch/`](../apps/mobile/targets/watch/) | Git-tracked SwiftUI Watch app (injected by `@bacons/apple-targets` at prebuild) |
| [`apps/mobile/modules/maher-watch-bridge/`](../apps/mobile/modules/maher-watch-bridge/) | iPhone Expo module: WCSession, vault, JS surface |
| [`apps/mobile/src/watch/`](../apps/mobile/src/watch/) | JS contract, session sync, tests |
| [`apps/mobile/ios/`](../apps/mobile/ios/) | Generated / gitignored. Do not hand-edit. |

## Security

Do not persist on Watch: passwords, PINs, refresh tokens, supplier pricing, raw cost, full customer/inventory dumps.

Treat the Watch as a lost-device risk. Clear protected state when the iPhone session dies.

## Wrist aggregators

Implemented in [`apps/api/src/modules/watch/`](../apps/api/src/modules/watch/):

- `GET /api/v1/watch/worker/today`
- `GET /api/v1/watch/admin/summary`
- `GET /api/v1/watch/dealer/orders`

They wrap `reports.workerHome` / `adminHome` / `dealerHome` plus a pending-inspection glance. Mutations stay on existing routes: `POST /tasks/:id/start|complete`, `POST /quality-inspections/:id/submit`, `POST /notifications/:id/read`. Watch holds the access token in memory and calls the API directly.

Start/complete/inspect errors that need a form or stock (`PHOTOS_REQUIRED`, `WIP_*`, `PACKAGES_INCOMPLETE`, `INSUFFICIENT_STOCK`, …) render **Continue on iPhone**.

`source: WATCH` audit metadata is **not possible today** — `AuditEvent` has no `source` field and task completion does not write `AuditEvent`. That is a later schema decision.
