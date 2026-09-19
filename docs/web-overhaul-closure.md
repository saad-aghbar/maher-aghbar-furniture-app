# Unified web overhaul — closure

Date: 2026-09-19. App: `apps/web` (`@maher/web`) on `:3000`.

## What shipped

- One Next.js app with explicit surfaces: `/[locale]/admin`, `/[locale]/dealer`, `/[locale]/worker`.
- Cookie auth in `middleware.ts`, server `GET /auth/me` session, `SurfaceGate`, `PermissionGate`, single-flight 401 refresh.
- Auth pages: login, MFA, forgot/reset password, session-expired, disabled.
- Floor tokens codegen (`pnpm --filter @maher/ui codegen:tokens`) + drift test against mobile `colors.ts`.
- Floor primitives in `@maher/ui`: `FloorBoard`, `FloorSheet`, `FloorFilterTrigger`, `StageSpine`, `SummaryRail`, `InboxCells`, `ListItemEnter`, `PressableCard`.
- `WebAdaptiveShell` / `AppShell` follows 600 / 900 / 1200 breakpoints.
- Feature gaps closed: returns detail, task detail, account + notifications, search, order flow, purchase-run detail, receive POST, factory line desks, server cookie basket, dealer requests in nav, worker completed-orders + notification prefs + lane actions.
- Native mapping: `CodeScanner` / `CameraCapture`, `VoiceNote` (MediaRecorder + SpeechSynthesis), polling inbox, honest online-required banner. Web Push, offline outbox, and biometrics stay native-only.

## Proof

- Parity manifest: `apps/web/src/parity/manifest.ts` → `docs/web-parity-matrix.md`.
- Unit tests: `pnpm --filter @maher/web test`.
- Playwright: `e2e/web-parity-walk.spec.ts`, `e2e/web-auth-matrix.spec.ts`.
- Evidence: `docs/web-overhaul-evidence/` (`admin-ar-dashboard.png`, `dealer-ar-dashboard.png`, `worker-ar-dashboard.png`, `warehouse-he-dashboard.png`).
- Auth Playwright: `e2e/web-auth-matrix.spec.ts` — 3/3 passed after same-origin `/api/v1` rewrite.

## Demo logins (password `123`)

| User | Surface |
|------|---------|
| `admin` | `/ar/admin/dashboard` |
| `nile` | `/ar/dealer/dashboard` |
| `carpenter` / `driver` | `/ar/worker/dashboard` |
| `warehouse` | `/ar/admin/dashboard` (warehouse home) |

## Honest deferrals

- Web Push
- Offline outbox / biometrics
- Full split of remaining inventory UI chrome (warehouse helpers extracted)
