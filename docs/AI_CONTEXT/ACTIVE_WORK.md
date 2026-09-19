# ACTIVE_WORK

Branch: `main`. This file is the in-flight pointer, not a changelog.

## Landed (this commit)

- Always-apply Caveman protocol: `.cursor/rules/caveman.mdc`
- Compact agent memory: `docs/AI_CONTEXT/{PROJECT_MAP,ARCHITECTURE_MAP,CURRENT_STATE,ACTIVE_WORK}.md`
- Admin pinned account sheet + `StickyLogoutDock` on dealer / worker / more
- Physical-device install path: `scripts/ios-device.sh` (`pnpm --filter @maher/mobile ios:device`) — Xcode 26 / DeviceHub
- 2026-09-19 iPad 13 UAT evidence under `docs/universal-uat-evidence/`

## In flight

- Apple Watch companion Phases 0–10: simulator identity + worker/admin/dealer glances **PASS**. Inspection live seed and airplane-mode photos pending. Complications / APNs / physical Watch **BLOCKED** (Personal Team). See [APPLE_WATCH_UAT.md](../APPLE_WATCH_UAT.md).

## Open follow-ups

- Reconcile leftover 2026-09-17 Android FAIL rows against the 2026-09-19 PASS section.
- Handset QR UAT (see CURRENT_STATE).
- Paid Apple Developer enrollment for Mac Designed-for-iPad signing.
- Stage Manager width matrix (600 / 900 / 1200 pt).
- Physical iPad install / camera UAT on dest-client (Silent Mary).

## Not this stack

`/run` does not start customer portal, employee portal, or `apps/worker`. Do not treat those as in-flight unless a task names them.
