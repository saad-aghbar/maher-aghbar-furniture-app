# Admin Sync Schedule — closure report

**As of:** 2026-08-22 (Asia/Amman) · API `http://localhost:4000` · DEV DB `maher_erp` · `DEMO_AS_OF=2026-08-16`.

One Admin action on Scheduling: **Sync schedule** / AR **مزامنة الجدول**. It reconciles the active factory and repairs only stale, invalid, unscheduled, or at-risk work. It is not a global regenerate. Dealer Schedule and worker task screens were not changed.

Live script: `pnpm smoke:scheduling-sync-uat` (`scripts/scheduling-manual-sync-live-uat.mjs`). Jest is not treated as PASS by itself.

---

## Scorecard

| # | Invariant | Result |
|---|---|---|
| 1 | Still-blocked material/WIP/worker/estimate orders are never packed | **PASS** in domain tests; live Diwan `PO-2026-00051` stayed v2. Cedar has inbound `materialReadyAt` so a repair is allowed |
| 2 | Unscheduled ready work can receive a schedule | **PASS** (throwaway `684a8c94-…`, generated `PROPOSED` v2) |
| 3 | Healthy factory copy is “already up to date”, not a generic complete | **PASS** in UI/domain (`outcome: UP_TO_DATE`). Live demo returns `CHANGED` because work was repaired — not a false `UP_TO_DATE` |
| 4 | Remaining known blockers with no repairs → `PARTIAL`, not `UP_TO_DATE` | **PASS** in domain `deriveManualSyncOutcome`. This live demo had repairs (`CHANGED`) |
| 5 | `newConflictsIntroduced = 0` | **PASS** (first run `3ad0bfa8-…` and second `aa6e93fa-…`) |
| 6 | Do not unpin, rewrite committed/requested dates, or move COMPLETED | **PASS** (Jabal committed stayed `2026-08-10`; `PO-2026-00001` not generated) |
| 7 | `schedule.manage` only | **PASS** (warehouse + carpenter HTTP 403) |
| 8 | Father-demo gate: not a mass rewrite of curated orders | **PASS** (1 walkthrough PO moved: Jabal `PO-2026-00023` at-risk recovery) |
| 9 | Dealer/worker screens unchanged | **PASS** (no edits to dealer calendar or worker task UI) |
| 10 | PAST-SAFE: no new incomplete allocations before the factory scheduling floor | **PASS** (canonical `resolveSchedulingFloor`; STALE → replan from floor) |

**Overall: PASS** on the implemented Admin Sync path. Live HTTP **24/24**.

Jest (not used as PASS by itself): domain `manual-sync` + factory-replan wiring previously **48/48**; mobile sync UI / i18n / error `runId` **27/27**.

---

## Live IDs (`maher_erp`)

| What | ID / number |
|---|---|
| First sync run | `3ad0bfa8-a351-4e1e-9e43-0d9eb398cb22` · `COMPLETED` · `outcome: CHANGED` |
| Second sync run | `aa6e93fa-40d7-4493-81c5-e312c326fed0` · `CHANGED` · generated 0 |
| Scanned / already valid / replanned (first) | 67 / 38 / 7 |
| New conflicts | 0 |
| Cedar velvet (`PO-2026-00056`) | `ba93ebb4-a6f6-46db-97e5-8012e79ed1b2` · `WAITING_FOR_MATERIALS` · v6 stayed · `materialReadyAt=2026-08-18` |
| Diwan foam gate (`PO-2026-00051`) | `fb326330-3c13-4f8b-81f7-9a61a2eaffff` · v2 unchanged |
| Jabal committed (`PO-2026-00023`) | committed `2026-08-10T13:00:00.000Z` unchanged; allocations may move for at-risk recovery |
| Unscheduled-ready throwaway | `684a8c94-13e8-48ac-bada-625e292ed518` (cancelled after UAT) |
| Terminal ignore | `PO-2026-00001` COMPLETED |

Walkthrough talking orders: [father-demo-walkthrough.md](./father-demo-walkthrough.md).

---

## What shipped

### Backend

- `POST /api/v1/scheduling/sync` (`schedule.manage`) enqueues existing `REPLAN_FACTORY` with `changeType: 'manual-sync'` and `capacityDelta: 'sync'`.
- In-flight manual-sync is returned (`alreadyInProgress`); any other live factory run is **409** `SYNC_ALREADY_IN_PROGRESS` with `runId` (exception filter now forwards `runId`).
- `GET /api/v1/scheduling/replan-runs/latest` is the latest `manual-sync` run (for remount / in-flight UI).
- Candidate policy in `manual-sync.ts`: still-blocked orders are reported and never passed to `generateForProductionOrder`. Live material/WIP is re-checked for unscheduled POs, `WAITING_FOR_MATERIALS`, `materialRisk`, `BLOCKED`, and MATERIAL/WIP unschedulable reasons.
- Result JSON includes `outcome`, `scannedOrders`, `alreadyValid`, `generated`, `replanned`, `blocked` / `manualAttention`, `newConflictsIntroduced`.

### Admin UI

- Mobile Scheduling header: compact **Sync** / **مزامنة**, gated on `schedule.manage`. Confirm → poll (5 min) → result sheet. `UP_TO_DATE` copy is **Schedule already up to date**, not a generic complete toast.
- Admin web `PageHero` Sync uses the same API, confirm/result dialog, and board invalidation. **Recalculate visible** is unchanged.

---

## Remaining gaps

1. **`AT_RISK_RECOVERY` can still re-pack** a late/at-risk order on a later Sync (Jabal `PO-2026-00023`; some throwaways). Fingerprint-equal generates do not bump version; occupancy changes can. This is allowed by the plan for at-risk recovery, not a healthy-backward rewrite.
2. **Cedar with inbound `readyAt`** is not treated as a still-true material blocker. A PO with shortage **and no** `readyAt` is blocked in domain tests; this demo seed has a dated inbound velvet PO.
3. **Nest watch `EADDRINUSE`**: if `:4000` is held by an old child, save-reload may not bind. Restart `pnpm --filter @maher/api dev` if Sync 404s after a pull.
4. Closed-day / inactive-skill / pinned-conflict lettered UAT cases were covered in domain tests, not as extra live throwaways in this run.
5. A fully healthy plant (`outcome: UP_TO_DATE`) was not this demo’s first scan (`CHANGED`, 38 already valid). UI copy for `UP_TO_DATE` is implemented and unit-tested.

---

## Out of scope (unchanged)

Dealer Schedule, worker tasks, planner rewrite, auto-changing committed/requested dates, unpinning, forcing 100% utilization, calendar/settings product changes.
