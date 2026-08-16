# Scheduling at-risk / May be late — closure report

Canonical classification, counts, Recalculate honesty, and resolve-all
are now driven by the latest active schedule on incomplete production
orders. The planner, conflict detector, bottleneck math, and working-minute
capacity were not changed.

Live snapshot: **2026-08-15** local DB `maher_erp`, factory timezone
`Asia/Amman`. No live orders were mutated.

## 1. Why the original 11 were classified at risk

`GET /scheduling/at-risk` matched **any** schedule row with
`NEEDS_REVIEW`, `materialRisk`, or `requiresAdminEstimateReview`. It did
not filter `CANCELLED` / `COMPLETED`, and Prisma `distinct` could keep a
stale flagged row after a later clean version.

All 11 UAT Nile Interiors sofas had `requiresAdminEstimateReview = true`
because the products have no profile, no stage estimates, and snapshot
minutes are null. Four POs were already `COMPLETED`. Five latest rows
were valid `PROPOSED` plans with a suggested date and no committed date.
Three active POs were `NEEDS_REVIEW` + `WIP_NOT_READY`.

Dashboard `atRisk` counted `materialRisk` rows (0). Mobile used list
length (11).

## 2. Why Recalculate appeared to do nothing

`POST /scheduling/orders/:id/recalculate` always returned HTTP 200.
Generate recomputed the same estimate-review flag and, for WIP-gated
orders, `persistUnschedulable('WIP_NOT_READY')` also forced
`requiresAdminEstimateReview: true`. Mobile toasted success on every 200.

Recalculate cannot invent estimates or WIP. It now reports
`planUnchanged` / `stillAtRisk` so Mobile can toast
“Recalculate did not change the plan” instead of fake success.

## 3. Canonical risk definition

`apps/api/src/modules/scheduling/domain/at-risk.ts` classifies the
**latest active** schedule (`APPROVED | PROPOSED | NEEDS_REVIEW`) on
incomplete POs. Exactly one primary status:

| Status | Rule |
|---|---|
| `LATE` | Committed date exists and that calendar day is already past; work incomplete |
| `AT_RISK` | Committed exists, projected is after committed, committed day not yet past |
| `BLOCKED` | No valid plan (`NEEDS_REVIEW`, unschedulable reason, missing estimates without a plan) |
| `AWAITING_APPROVAL` | Valid `PROPOSED` plan (including requested-infeasible, uncommitted) |
| `ON_TRACK` | Otherwise |

Precedence: `BLOCKED` over `AT_RISK`; `LATE` over `AT_RISK`. Conflict and
bottleneck stay on their own boards.

**May be late** = unique POs whose primary status is `LATE | AT_RISK | BLOCKED`.

## 4. Count semantics

`GET /scheduling/at-risk` and `dashboard.atRisk` use the same helper.
`dashboard.awaitingApproval` uses the classifier’s `AWAITING_APPROVAL`
set. One incomplete PO cannot increment both chips. `CANCELLED` and
`COMPLETED` contribute to neither. Superseded rows are ignored.

Mobile May be late chip = `at-risk` list length. Day-detail at-risk count
uses membership in that list only (no `materialRisk ||` heuristic).
Awaiting-approval cards are `PROPOSED` only.

## 5. Requested / suggested / committed

Requested-infeasible uncommitted plans are **not** May be late. They stay
awaiting approval with “Requested date cannot be met” when shown.
Committed dates are never overwritten by resolve or Recalculate.
`approve` now passes committed (not suggested) into `isScheduleLate`.

## 6. Resolve-one

`POST /scheduling/at-risk/:productionOrderId/resolve`

- Already on track → `ALREADY_ON_TRACK`, no generate
- Not recoverable → 200 + reason + earliest feasible + required action
- Recoverable → existing `generateForProductionOrder` (`failHard`,
  `abortIfMissesCommitment` when committed exists)
- Impossible commitment → `COMMITMENT_INFEASIBLE`, no success claim

## 7. Resolve-all

`POST /scheduling/at-risk/resolve-all` walks the current May be late set
in existing `comparePriority` order. Returns
`{ resolvedAutomatically, stillNeedsAttention, alreadyOnTrack, remaining, results[] }`.
Does not force the count to 0. Mobile makes **one** backend call and
shows a result sheet (same pattern as conflict resolve-all).

## 8. Auto-recoverable vs Admin-action

Recoverable when a replan can change the outcome: stale WIP/material
gates, scarce capacity, projected-after-committed while the committed
day is still ahead.

Not recoverable: missing estimates with no plan, no eligible worker,
committed day already past (`LATE`).

`persistUnschedulable` no longer sets `requiresAdminEstimateReview` for
material/WIP unless estimates are actually missing.

## 9. Mobile UX

- Cards: Late / May be late / Scheduling blocked; promised vs projected;
  days late; i18n reason; one recommended action
- Tap opens an at-risk detail sheet (not only the generic action sheet)
- Recalculate only when `recommendedAction === RECALCULATE`
- Other actions route to workflow estimates, production flow, users,
  inventory (if `inventory.read`), or the existing change-date sheet
- Honest Recalculate toast; resolve-all result sheet; help caption; a11y
  sentence; RTL via existing BiDi helpers
- Conflict resolve now also invalidates `scheduling.atRisk`

## 10. EN / AR / HE keys

**Reused:** `stats.atRisk`, `blocked.*`, `dates.*`, `atRisk.due` /
`projected` / `noProjected` / `caption`, `reasons.*`, `statuses.LATE`.

**Added** under `mobile.adminScheduling.atRisk` in en / ar / he:
`statusLate`, `statusMayBeLate`, `promised`, `reason`,
`recommendedAction`, `daysLate` (+ plurals), `helpTitle` / `helpBody`,
`a11yCard`, resolve-all copy, action labels, `committedCannotBeMet`,
`requestedCannotBeMet`, WIP/material/capacity extras,
`recalculateUnchanged`. Catalog parity via the three locale files +
`SCHEDULING_KEYS`.

## 11. Tests

- Domain invariant: one primary status; completed/cancelled excluded;
  requested-infeasible not in May be late; committed-yesterday → `LATE`
- Service (mocked Prisma): count consistency; superseded ignored;
  resolve-one / resolve-all mixed set; impossible commitment
- Automatic refresh: `onTaskLifecycle` enqueues `REPLAN` for latest
  **active** schedule (not only `APPROVED`); `RISK_ANALYSIS` replans only
  when recoverable; after `REPLAN` the list and dashboard reclassify
- Mobile selectors, i18n interpolations, cache keys after schedule
  mutation

**Intentional exceptions (no new event bus):**

- Missing product estimates still require an Admin save, then replan
- `LATE` (committed day already past) is not auto-cleared by replan
- Zero eligible workers stay `NO_ELIGIBLE_WORKER` until staff/skills change
- Resolve-all does not run against live UAT data in this report

## 12. Remaining limitations

- UAT products still have no estimates; successful WIP replan becomes
  awaiting approval with `REVIEW_ESTIMATES`, not a confirmed promise
- Admin-web dashboard page was out of scope (it now receives the same
  `dashboard.atRisk` field)
- Factory lifecycle 88/88 was not re-run
- No live resolve-all was executed (would mutate versions)

## 13. Live post-fix reconciliation (read-only)

Same Phase 1 PO set. Latest **active** schedule only. Classifier applied
in this report from the dump; live rows were not updated.

| PO | BEFORE (listAtRisk flags) | AFTER (canonical) | Still May be late? | Why / action | Auto-resolve attempted |
|---|---|---|---|---|---|
| 51 | NEEDS_REVIEW WIP + estimateReview | excluded (`COMPLETED`) | no | terminal | no |
| 52 | NEEDS_REVIEW WIP + estimateReview | excluded (`COMPLETED`) | no | terminal | no |
| 53 | estimateReview + PROPOSED 17 Aug | `AWAITING_APPROVAL` | no | valid plan, no commit; `REVIEW_ESTIMATES` | no |
| 54 | NEEDS_REVIEW WIP + estimateReview | excluded (`COMPLETED`) | no | terminal | no |
| 55 | estimateReview + PROPOSED 17 Aug | `AWAITING_APPROVAL` | no | valid plan, no commit; `REVIEW_ESTIMATES` | no |
| 56 | estimateReview + PROPOSED 17 Aug | `AWAITING_APPROVAL` | no | valid plan, no commit; `REVIEW_ESTIMATES` | no |
| 57 | estimateReview + PROPOSED 17 Aug | `AWAITING_APPROVAL` | no | valid plan, no commit; `REVIEW_ESTIMATES` | no |
| 58 | estimateReview + PROPOSED 17 Aug | excluded (`COMPLETED`) | no | terminal | no |
| 59 | NEEDS_REVIEW WIP + estimateReview | `BLOCKED` / `WIP_NOT_READY` | yes | View production; recoverable if WIP is ready | no (live) |
| 60 | NEEDS_REVIEW WIP + estimateReview | `BLOCKED` / `WIP_NOT_READY` | yes | View production; recoverable if WIP is ready | no (live) |
| 61 | NEEDS_REVIEW WIP + estimateReview | `BLOCKED` / `WIP_NOT_READY` | yes | View production; recoverable if WIP is ready | no (live) |

- Original May be late count: **X = 11**
- Correct canonical count after classification fix: **Y = 3**
- Automatically resolved during controlled resolution test: **Z = 1**
  (mocked WIP replan in `scheduling-at-risk.test.ts`; not run on live data)
- Still requiring Admin action: **N = 3** live (59–61 WIP, plus estimate
  review on the four awaiting-approval sofas which are **not** in May be late)

Y and N are greater than zero. Remaining May be late orders are unique,
current, incomplete, and actionable.
