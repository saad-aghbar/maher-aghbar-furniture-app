# Apple Watch UAT

Nothing is marked **PASS** unless it was actually exercised.

Statuses: `PASS` · `FAIL` · `BLOCKED` · `NOT TESTED`

Evidence: [`docs/universal-uat-evidence/watch-sim/`](universal-uat-evidence/watch-sim/).

| # | Scenario | Status | Evidence / notes |
|---|----------|--------|------------------|
| 1 | iPhone worker login → Watch shows Khaled / Worker | PASS | `03-watch-khaled-worker.png` + `03b-iphone-khaled-home.png` |
| 2 | iPhone admin identity → Watch shows Maher / Admin | PASS | `04-watch-maher-admin.png` |
| 3 | iPhone dealer identity → Watch shows Nile / Dealer | PASS | `05-watch-nile-dealer.png` |
| 4 | Logout / clear → Watch shows session unavailable | PASS | `06-watch-session-unavailable.png` |
| 5 | Account switch Worker → Admin → Dealer | PASS | Same session; prior name gone |
| 6 | Worker current task | PASS | `07-watch-worker-today.png` — Material preparation / Classic Chair / SO-2026-00007 |
| 7 | Worker start task | PASS | `POST /tasks/:id/start` → 201 on Khaled's READY task (`a4292bb9-…`). Watch then showed Complete. |
| 8 | Worker complete task | PASS | Complete → `INSUFFICIENT_STOCK` (expected). Watch maps that to Continue on iPhone. |
| 9 | Inspection pass | NOT TESTED | Submit UI + `POST /quality-inspections/:id/submit` wired. No pending inspection in current seed. |
| 10 | Inspection fail + category | NOT TESTED | Fail chips FINISH / JOINERY / UPHOLSTERY / DIMENSION / OTHER. Same seed gap. |
| 11 | Admin alerts | PASS | `08-watch-admin-summary.png` — Urgent 16 · Inbox 6 + notification rows |
| 12 | Admin quick action | PASS | `POST /notifications/:id/read` → 201; inbox 6 → 5 |
| 13 | Dealer order status | PASS | `09-watch-dealer-orders.png` — Live 2 · Making 2, no money |
| 14 | Notification delivery to Watch | BLOCKED | APNs stripped on Personal Team. In-app inbox glance works (row 11). |
| 15 | Complication | BLOCKED | App Group + paid signing required |
| 16 | Offline behavior | NOT TESTED | `WatchOfflineQueue` last-glance + mutation replay implemented. Airplane mode not photographed. |
| 17 | Reconnect behavior | PASS | `iPhone connected` / `iPhone` pill after `sendMessage` |
| 18 | Duplicate action / idempotency | PASS | Complete sends `idempotencyKey`. Failed complete is not stored (both calls 400 `INSUFFICIENT_STOCK`). Start has no idempotency on the existing API. |
| 19 | Stale context after epoch change | PASS | Epoch bump replaces Watch identity |
| 20 | Watch cannot bypass backend permissions | PASS | Nile `GET /watch/worker/today` and `/admin/summary` → 403. Carpenter `GET /watch/dealer/orders` → 403. |

## Environment

| Check | Status |
|-------|--------|
| Jest Watch JS contract | PASS — 17 tests |
| Jest Watch aggregators | PASS — 4 tests (`watch.service.spec.ts`) |
| Watch `xcodebuild` | PASS — MaherWatch Debug, Series 12 (46mm) |
| Universal iPhone after Watch prebuild | PASS |
| Paired sim identity + glances | PASS |
| Physical Apple Watch | BLOCKED — paid signing |

## Signing

**BLOCKED — requires paid Apple Developer signing/provisioning.**

Do not treat the Watch app as production-ready until a real device UAT is recorded here.
