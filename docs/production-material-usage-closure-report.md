# Production material usage closure report

**Date:** 2026-08-24 · **Scope:** Phases D–F (hybrid usage, return/scrap/variance, QR identify)

## Verdict

**PASS** — Workers confirm hybrid expected→actual usage under `production.material-usage.record`; finalize posts issue/return atomically with task complete; scan identifies MATCH/WRONG/EXTRA without mutating stock.

## What shipped

| Item | Result |
|---|---|
| `ProductionTaskMaterialUsage` + scrap reasons | PASS |
| Expected from frozen PO snapshot | PASS |
| Permission task-scoped (not `inventory.issue`) | PASS |
| Finalize: issue = actual+returned+scrap; return restocks; scrap not restocked | PASS |
| Variance >5% requires reason | PASS |
| `POST /tasks/:id/material-usage/identify` non-mutating | PASS |
| Mobile `TaskMaterialUsageSheet` + skip finishes with prefilled expected | PASS |
| Item report PDF includes production usage section | PASS |
| Demo Sweifieh usage equal + return/scrap seed | PASS |

## Evidence anchors

- `MaterialUsageService` + `material-usage.identify.spec.ts`
- Mobile: `TaskMaterialUsageSheet.tsx`
- UAT cases **I, J, K, L**

## Remaining gaps

- Dedicated scrap `InventoryTxType.SCRAP` row is optional; scrap qty is included in `PRODUCTION_ISSUE` notes today (not restocked).
- Full dashboards for high-variance scrap by stage are minimal (data is queryable via usage + transactions).
