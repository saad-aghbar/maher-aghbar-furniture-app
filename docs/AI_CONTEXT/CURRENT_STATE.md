# CURRENT_STATE

As of **2026-09-19**. Re-verify against the newest `docs/*UAT*.md` and `docs/*closure*.md` before treating a row as current.

Primary sources: [UNIVERSAL_APP_COMPLETE_IMPLEMENTATION.md](../UNIVERSAL_APP_COMPLETE_IMPLEMENTATION.md), [UNIVERSAL_APP_FINAL_UAT.md](../UNIVERSAL_APP_FINAL_UAT.md).

## Working

- Adaptive mobile shell: 142 implementation rows, **134 PASS**, 7 not applicable (redirects).
- Mobile tests: **385 suites / 2302 tests** green (Jest + typecheck).
- iOS Simulator UAT: iPhone COMPACT, iPad 11 MEDIUM, iPad 13 EXPANDED+WIDE — **PASS (AR)**.
- Android tablet (`maher_tablet`): Admin / Dealer / Worker logged-in, EN/AR/HE — **PASS** (2026-09-19 closure; ignore stale 2026-09-17 FAIL rows unless re-confirmed).
- iPad dealer (`nile`) and worker (`carpenter`) interactive UAT — **PASS**. Hebrew WIDE admin sidebar RTL / IDs LTR — **PASS**. iOS PDF share sheet — **PASS**.
- Demo factory: `pnpm demo:reset` + `pnpm demo:validate` reproducible. Presentation walkthrough **PASS** ([father-demo-presentation-readiness.md](../father-demo-presentation-readiness.md), Aug 16 — seed truth, not adaptive-shell UAT).
- Domain closures (Sep 19 batch): scheduling, production-inventory, quotations, dealer receipt — see living architecture docs, not this file.

## Partial

- Stage Manager / split widths **600 / 900 / 1200 pt** not proven (rotation only).
- ~100 routes: implementation PASS only; no photographed runtime UAT.
- Inventory QR UX: code present, **FAIL** until a real handset proves scan/match/receive/issue/transfer/count ([inventory-qr-identity-closure-report.md](../inventory-qr-identity-closure-report.md)).
- Keyboard / pointer: no Mac session.
- MFA path not exercised on demo users.

## Blocked

- Mac Designed-for-iPad: CocoaPods fixed; **signing BLOCKED** (Personal Team; Mac UDID not in profile). Runtime not run.
- Physical camera UAT required on dest-client device.
- Production store release: **NO** until Mac signing + camera + Stage Manager widths.
- Apple Watch companion: Phases 0–10 in tree. Simulator identity + worker/admin/dealer glances **PASS**. Inspection seed + airplane photos not taken. Physical Watch / complications / APNs **BLOCKED** (Personal Team). Universal-app UAT is unchanged.
- Windows: spike only ([WINDOWS_SPIKE.md](../WINDOWS_SPIKE.md)). No port.
- Unified web (`apps/web` on :3000): admin / dealer / worker surfaces folded into one app. Auth middleware + SurfaceGate + factory line desks + server basket cookie landed. Floor primitives + parity manifest in tree. Web Push and offline outbox remain deferred.

## Stack convention

Local daily stack is API `:4000` + admin `:3000` + Metro `:8081`. Customer/employee portals and `apps/worker` are not started by `/run`. Do not `demo:reset` unless asked.
