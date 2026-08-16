# Scheduling at-risk / May be late audit

Read-only investigation of Mobile Admin Scheduling → **May be late = 11**.
No code, planner, WorkerSkill, allocation, or seed data was changed in this phase.

Live snapshot: **2026-08-15** local DB `maher_erp`, factory timezone `Asia/Amman`.

## 1. Executive verdict

May be late is **not** “projected completion vs a promised date.”

`GET /scheduling/at-risk` returns distinct production orders whose **any**
`production_schedules` row has:

- `status = NEEDS_REVIEW`, or
- `materialRisk = true`, or
- `requiresAdminEstimateReview = true`

The 11 screenshot orders are UAT Nile Interiors sofas. Every one has
`requiresAdminEstimateReview = true` because the three UAT products have
**0 stage estimates**, **no production profile**, and workflow snapshot
nodes with **null `estimatedMinutes`**.

Four of the 11 are already **COMPLETED**. Six latest rows are
`NEEDS_REVIEW` + `WIP_NOT_READY` (including those completed POs). Five
latest rows are valid `PROPOSED` plans with a suggested date and no
committed date — commercially awaiting approval, not late.

Dashboard `atRisk` is `count(materialRisk = true)` = **0**. Mobile ignores
that field and shows `at-risk` list length = **11**.

Recalculate cannot invent estimates or WIP. It regenerates the same flags
and Mobile toasts success on HTTP 200.

## 2. How the current stack classifies risk

| Layer | Rule |
|---|---|
| `listAtRisk` | Any schedule row: `NEEDS_REVIEW` OR `materialRisk` OR `requiresAdminEstimateReview`. `distinct productionOrderId`, `version desc`. No PO status filter. Limit 200. |
| `dashboardSummary.atRisk` | Count of **all** schedule rows with `materialRisk`. |
| `mapPromiseState` | `NEEDS_REVIEW` → `AT_RISK`. `PROPOSED` → `AWAITING_APPROVAL`. `LATE` only on `APPROVED` via `isScheduleLate(committed ?? requested)`. |
| Mobile chip | `atRiskQuery.data.length` (overrides dashboard). |
| Mobile card | `selectScheduleDates`: unschedulable → blocked copy; else estimate-review → “Duration estimates need review”; else `materialRisk` → materials. |
| Recalculate | `POST /scheduling/orders/:id/recalculate` → `generateForProductionOrder(..., failHard: true)`. |
| Resolve all | Does not exist for at-risk. Conflicts have resolve-all. |
| `RISK_ANALYSIS` | Enqueued on task blocker; **not handled** in `processSchedulingJob`. |

`persistUnschedulable` always sets `requiresAdminEstimateReview: true`
even for `WIP_NOT_READY` / `MATERIAL_NOT_READY`.

Runtime `LATE` is not in `listAtRisk`. `requestedDateFeasible: false`
alone is not in `listAtRisk`.

## 3. The 11 orders (2026-08-15)

Dealer for all: **Nile Interiors**. No `requestedDeliveryDate`, no
`committedDeliveryDate` on PO or schedule. `materialRisk = false` on
every matching row. UAT products have 0 estimates / no profile.

| PO | PO status | Product | Stage | Latest v | Schedule | Promise | Suggested / projected | Unschedulable | Estimate review | Reason | Tasks | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PO-2026-00051 | COMPLETED | UAT Standard Sofa | DELIVERY | 4 | NEEDS_REVIEW | AT_RISK | none | WIP_NOT_READY | true | calendar-exception:SHUTDOWN | 9 COMPLETED | stale-row + completed; exclude |
| PO-2026-00052 | COMPLETED | UAT Parallel Sofa | PACKAGING | 4 | NEEDS_REVIEW | AT_RISK | none | WIP_NOT_READY | true | calendar-exception:SHUTDOWN | 6 COMPLETED | stale-row + completed; exclude |
| PO-2026-00053 | IN_PROGRESS | UAT Optional Paint Sofa | UPHOLSTERY | 4 | PROPOSED | AWAITING_APPROVAL | 2026-08-17 07:00Z | — | true | calendar-exception:SHUTDOWN | 4 done / 1 ready / 4 not started | awaiting-approval (valid plan, no commit) |
| PO-2026-00054 | COMPLETED | UAT Optional Paint Sofa | DELIVERY | 4 | NEEDS_REVIEW | AT_RISK | none | WIP_NOT_READY | true | calendar-exception:SHUTDOWN | 8 COMPLETED / 1 CANCELLED | stale-row + completed; exclude |
| PO-2026-00055 | IN_PROGRESS | UAT Standard Sofa | PAINTING | 7 | PROPOSED | AWAITING_APPROVAL | 2026-08-17 08:00Z | — | true | (empty; later replan) | 2 done / 2 ready / 5 not started | awaiting-approval (valid plan, no commit) |
| PO-2026-00056 | IN_PROGRESS | UAT Standard Sofa | PAINTING | 4 | PROPOSED | AWAITING_APPROVAL | 2026-08-17 11:00Z | — | true | calendar-exception:SHUTDOWN | 2 done / 2 ready / 5 not started | awaiting-approval |
| PO-2026-00057 | IN_PROGRESS | UAT Standard Sofa | CARPENTRY | 4 | PROPOSED | AWAITING_APPROVAL | 2026-08-17 09:00Z | — | true | calendar-exception:SHUTDOWN | 1 done / 2 ready / 6 not started | awaiting-approval |
| PO-2026-00058 | COMPLETED | UAT Standard Sofa | DELIVERY | 5 | PROPOSED | AWAITING_APPROVAL | 2026-08-17 13:00Z | — | true | calendar-exception:SHUTDOWN | 10 COMPLETED | completed; exclude |
| PO-2026-00059 | READY_FOR_DELIVERY | UAT Standard Sofa | DELIVERY | 4 | NEEDS_REVIEW | AT_RISK | none | WIP_NOT_READY | true | calendar-exception:SHUTDOWN | 8 COMPLETED / 1 READY | blocked / possibly stale WIP |
| PO-2026-00060 | READY_FOR_DELIVERY | UAT Standard Sofa | UPHOLSTERY | 5 | NEEDS_REVIEW | AT_RISK | none | WIP_NOT_READY | true | calendar-exception:SHUTDOWN | 8 COMPLETED / 2 READY | blocked / possibly stale WIP |
| PO-2026-00061 | READY_FOR_DELIVERY | UAT Standard Sofa | DELIVERY | 4 | NEEDS_REVIEW | AT_RISK | none | WIP_NOT_READY | true | calendar-exception:SHUTDOWN | 8 COMPLETED / 1 READY | blocked / possibly stale WIP |

None are actually LATE (no committed date; today is 2026-08-15; projected
windows if present are 17–18 Aug).

### Reusable dump (same ids for post-fix reconciliation)

```
PO-2026-00051 COMPLETED  v4 NEEDS_REVIEW WIP_NOT_READY estimateReview
PO-2026-00052 COMPLETED  v4 NEEDS_REVIEW WIP_NOT_READY estimateReview
PO-2026-00053 IN_PROGRESS v4 PROPOSED suggested=2026-08-17T07:00Z estimateReview
PO-2026-00054 COMPLETED  v4 NEEDS_REVIEW WIP_NOT_READY estimateReview
PO-2026-00055 IN_PROGRESS v7 PROPOSED suggested=2026-08-17T08:00Z estimateReview
PO-2026-00056 IN_PROGRESS v4 PROPOSED suggested=2026-08-17T11:00Z estimateReview
PO-2026-00057 IN_PROGRESS v4 PROPOSED suggested=2026-08-17T09:00Z estimateReview
PO-2026-00058 COMPLETED  v5 PROPOSED suggested=2026-08-17T13:00Z estimateReview
PO-2026-00059 READY_FOR_DELIVERY v4 NEEDS_REVIEW WIP_NOT_READY estimateReview
PO-2026-00060 READY_FOR_DELIVERY v5 NEEDS_REVIEW WIP_NOT_READY estimateReview
PO-2026-00061 READY_FOR_DELIVERY v4 NEEDS_REVIEW WIP_NOT_READY estimateReview
```

## 4. Why Recalculate appears to do nothing

Trace (estimate-review, e.g. PO-2026-00055):

1. Mobile “Review schedule” → ActionSheet → Recalculate sheet.
2. `POST /scheduling/orders/:id/recalculate` `{ reason }`.
3. `recalculate` → `generateForProductionOrder(..., failHard: true)`.
4. `requiresAdminEstimateReview` is recomputed true (`!hasProfile || !hasEstimates` and snapshot minutes still null).
5. Planner still builds a `PROPOSED` plan using fallback minutes.
6. New version is persisted with the same estimate-review flag.
7. `listAtRisk` still matches. Count stays 11.
8. Mobile `onSuccess` toasts “Schedule recalculated.”

Trace (WIP, e.g. PO-2026-00059):

1. Same endpoint.
2. `assessWipReadiness` / `persistUnschedulable('WIP_NOT_READY')` if still gated.
3. New `NEEDS_REVIEW` row with `requiresAdminEstimateReview: true` again.
4. HTTP 200. Card still “Scheduling blocked” / “Waiting for work-in-progress” / “Duration estimates need review.”

Pinned / IN_PROGRESS / COMPLETED tasks also lock windows, so a successful
replan can look identical.

`failHard` throws only on unexpected planner errors — not on these
expected blockers.

## 5. Count mismatch

| Metric | Value 2026-08-15 |
|---|---|
| Mobile May be late (list length) | 11 |
| `dashboard.atRisk` (`materialRisk` rows) | 0 |
| `NEEDS_REVIEW` schedule rows | 6 |
| `PROPOSED` schedule rows (dashboard awaitingApproval) | 55 |
| Unique POs in the 11 that are COMPLETED | 4 |

## 6. Recalculate is not a resolution

Missing product estimates cannot be invented. WIP/material gates cannot
be invented. Recalculate should only clear risk when the underlying
condition is now resolvable.

## 7. What a truthful classifier should do with this set

- Drop COMPLETED / CANCELLED (51, 52, 54, 58).
- PROPOSED + suggested date + no committed (53, 55, 56, 57) →
  **AWAITING_APPROVAL**, not May be late. Surface estimate-review as a
  reason/action, not as lateness.
- NEEDS_REVIEW + `WIP_NOT_READY` on active POs (59, 60, 61) → **BLOCKED**,
  stay in May be late until WIP is actually ready or a replan succeeds.

Expected canonical May be late count from this dump, before any resolve:
**3** (59, 60, 61), all BLOCKED / WIP.

## 8. Limitations of this audit

- Did not call Recalculate against live orders (would mutate versions).
- Did not re-run factory lifecycle 88/88.
- Worker/capacity for these UAT orders was not the inclusion reason.

Closed by: `docs/scheduling-at-risk-closure-report.md`.
