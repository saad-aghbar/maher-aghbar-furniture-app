# Global scheduling floor — closure report

**As of:** 2026-08-22 (Asia/Amman) · API `http://localhost:4000` · DEV DB `maher_erp`.

**Final rule:** any scheduling action may repair the future. No scheduling action may rewrite the past.

Canonical helper: `resolveSchedulingFloor(calendar, now)` → `WorkingCalendar.nextWorkingInstant(now)`.
All generate paths use `ctx.now = later(floor, fromDate)`. Persist is rejected if a new movable incomplete allocation starts before the floor.

Live script: `pnpm smoke:scheduling-past-floor-uat` (`scripts/scheduling-past-floor-live-uat.mjs`).

Live UAT **2026-08-22** `maher_erp`: **19/19 PASS**. Throwaway `PO-2026-00066` (`82f93f09-…`). Planted stale start `2026-08-21T05:00:00.000Z`. Sync `eb30325f-…` `CHANGED` `pastDueRescheduled: 1`. Recalculate stayed LATE with committed `2026-08-20` unchanged. Optimize preview `b07b66df-…` no proposed completion before today. Historical EXTRA_SHIFT on `2026-08-18` run `22e51ae7-…` `candidates: 0` `moved: 0`. Evidence: `tmp-scheduling-past-floor-uat.json`.

---

## Scoreboard

| Check | Result |
|---|---|
| CANONICAL SCHEDULING FLOOR | **PASS** (domain tests: working / lunch / closed / Friday) |
| AT-RISK RESOLVE PAST-SAFE | **PASS** (generate inherits floor; no past `fromDate`) |
| RESOLVE-ALL AT-RISK PAST-SAFE | **PASS** (same `resolveAtRisk` path) |
| CONFLICT RESOLVE PAST-SAFE | **PASS** (candidate `start >= floor`; no past same-window reassign) |
| RESOLVE-ALL CONFLICTS PAST-SAFE | **PASS** (loops `resolveConflict`) |
| RECALCULATE PAST-SAFE | **PASS** (planner `ctx.now` is floor; backward falls forward) |
| CALENDAR REPLAN PAST-SAFE | **PASS** (historical increase ymd skipped; generate cannot place before floor) |
| WORKER/SKILL REPLAN PAST-SAFE | **PASS** (`REPLAN_EMPLOYEE` → generate choke) |
| MATERIAL REPLAN PAST-SAFE | **PASS** (`max(ctx.now, readyAt)` once `ctx.now` is the floor) |
| WIP REPLAN PAST-SAFE | **PASS** (same) |
| QC REPLAN PAST-SAFE | **PASS** (targeted `REPLAN` → generate choke) |
| SYNC PAST-SAFE | **PASS** (STALE → `NEEDS_REPLAN`; past incomplete pins → `MANUAL_ATTENTION`) |
| OPTIMIZE PAST-SAFE | **PASS** (world `now` = floor; N-day clamped; preview drops `proposedStart < floor`) |
| NEW INCOMPLETE PAST ALLOCATIONS | **0** expected (hard validator) |
| COMPLETED HISTORY MUTATED | **0** expected (COMPLETED stays pinned in place) |
| IN_PROGRESS WORK MOVED | **0** expected (`lockInPlace`) |
| REQUESTED/COMMITTED DATES CHANGED | **0** expected |
| NEW WORKER/RESOURCE CONFLICTS | **0** expected (existing occupancy loop) |

---

## What shipped

- [`apps/api/src/modules/scheduling/domain/scheduling-floor.ts`](../apps/api/src/modules/scheduling/domain/scheduling-floor.ts) — floor helper, classifiers, persist validator, historical calendar-increase guard.
- [`buildAndPersistSchedule`](../apps/api/src/modules/scheduling/scheduling.service.ts) always sets planner `now` to the floor (or a later admin `fromDate`) and asserts no STALE rows before persist.
- Sync classifies mixed stale+future as `NEEDS_REPLAN`; incomplete past pins as `MANUAL_ATTENTION`. Result JSON includes `pastDueRescheduled`.
- Conflict resolve: replacement slots `>= floor` unless preserving IN_PROGRESS.
- `shiftScheduleToDate` to a past YMD replans from the floor instead of sliding unfinished work yesterday.
- Factory increase on a historical opened day does not pull current incomplete work into that capacity.
- Optimize preview/apply use the same floor; N-day `notBefore` is `max(nDay, floor)`.
- Admin Sync/Optimize sheets can show “Past-due work rescheduled” (EN/AR/HE).

Planner core, Sync repair-only policy, Optimize N-day policy, dealer dates, and WIP/QC semantics were not rewritten. `DEMO_AS_OF` stays seed/presentation only.

---

## Tests

- Domain: `scheduling-floor.test.ts`, Sync STALE/pin, conflict past-window, N-day clamp, factory historical increase skip, at-risk generate not past-anchored.
- Live: `pnpm smoke:scheduling-past-floor-uat` plants a stale yesterday allocation on a throwaway, Syncs, Recalculates, previews Optimize, and opens a historical calendar day.

Evidence: `tmp-scheduling-past-floor-uat.json`.
