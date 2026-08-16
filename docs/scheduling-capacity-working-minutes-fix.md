# Scheduling capacity working-minutes fix

Closes the bottleneck over-capacity audit:
[scheduling-bottleneck-capacity-audit.md](./scheduling-bottleneck-capacity-audit.md).

**Status: closed** after Mobile manual verification and factory lifecycle **88/88**.

The scheduler already plans in working minutes. `GET /scheduling/capacity` now
measures allocations in those same working minutes.

Planner, conflict resolution, WorkerSkill, production/inventory, and the approved
Mobile Factory Capacity / Bottlenecks UI were not redesigned.

## Helper / timezone / algorithm

| Piece | Where |
|---|---|
| Intersection | `overlapWorkingMinutes(start, end, intervals)` in [`working-calendar.ts`](../apps/api/src/modules/scheduling/domain/working-calendar.ts) |
| Per-day wrapper | `WorkingCalendar.overlapWorkingMinutesOnLocalDay` |
| Local YMD | `parseYmd`, `eachYmdInclusive`, `localInstant`, `intervalsForLocalYmd`, `localRangeBounds` |
| `listCapacity` | [`scheduling.service.ts`](../apps/api/src/modules/scheduling/scheduling.service.ts) |

**Timezone:** factory calendar timezone (`Asia/Amman`). Selected Mobile YMD is
treated as that local civil day, not `${ymd}T00:00:00.000Z`.

**Query window:** `[fromYmd 00:00 local, toYmd+1 00:00 local)`.

**Intersection:** for the selected local day(s), take `intervalsForLocalYmd`
(shift minus breaks, plus `EXTRA_SHIFT`, empty on `HOLIDAY`/`SHUTDOWN`/closed
weekdays). For each allocation, sum
`max(0, min(end, interval.end) − max(start, interval.start))`.

Lunch is a subtracted break, so 11:00–14:00 → 120 working minutes, not 180.
Overnight between `plannedStart` and `plannedEnd` is never an interval, so it
counts 0. Closed days contribute 0 unless an extra-shift interval exists.

Allocated is **not** `Math.min(allocated, available)`.

## Foam 30 Aug 2026

| | Before (clock) | After (working) |
|---|---|---|
| Available | 840m (14h) | 840m (14h) |
| Allocated | 1143m (19.1h) | **240m (4.0h)** |
| Remaining | 0h | **600m (10h)** |
| Utilization | 100% (capped) | **29%** |
| State | Full | **available** |

Sunday working intersections: Rana PO-24 08:00–08:30 = 30m; Rana PO-28
08:30–12:00 = 210m. Yousef’s overnight tail, Nour’s pre-shift pin, and Lina’s
lunch pin are 0.

## Factory load 30 Aug 2026

| | Before | After |
|---|---|---|
| Allocated / available | 6091 / 7560 | 2203 / 7560 |
| Load | **81%** | **29%** |

Stage working minutes after the fix: Assembly 333, Delivery 273, Foam 240,
Inspection 227, Packaging 423, Painting 467, Upholstery 240; Carpentry / CNC /
Material prep 0.

## Bottleneck count 30 Aug 2026

| Before | After |
|---|---|
| **5** (4 Full + Delivery Near) | **0** |

Assembly 79%, Inspection 54%, Packaging 50% are Moderate — not bottleneck
states. Count is derived, not forced.

## Genuine >100% after correction

Live 30 Aug: **none**. Every active stage has remaining > 0.

A wiring test still persists two working allocations (420 + 240) against one
eligible worker (420 available) and expects **allocated 660, remaining 0**.
`OVER_CAPACITY` was **not** added. Recommend it later only if leftover
conditions (skill removal, deactivation, manual overlap, reduced calendar)
need a distinct admin label.

## Tests

| ID | Coverage | Result |
|---|---|---|
| A | 14h available / 10h working → 4h remaining | pass |
| B | 14h / 14h → remaining 0, Full on mobile, not a conflict | pass |
| C | Sat→Sun counts only Sunday 08:00–08:30 | pass |
| D | 11:00–14:00 → 120m (lunch excluded) | pass |
| E | closed Friday → 0 available, 0 allocated | pass |
| F | EXTRA_SHIFT Friday → configured working minutes only | pass |
| G | 01:00 Amman Sunday (22:00 UTC Sat) is Sunday, 0 working | pass |
| H | multi-day 15:00→09:00 = 60+60, no overnight | pass |
| I | 2×7h Foam, 4×6h demand → Sunday ≤ 840, spill to Monday | pass |
| J | conflict-detector / listConflicts unchanged | pass (domain + wiring) |
| K | Mobile selectors still use `allocatedMinutes` / `availableMinutes` / `remainingMinutes` | pass |

## Regression

| Gate | Result |
|---|---|
| API scheduling Jest | **138 passed** |
| API scheduling domain | **113 passed** (included above) |
| API typecheck | pass |
| Mobile scheduling Jest | **57 passed** |
| Mobile typecheck | pass |
| Admin Web typecheck | pass (same `data[]` / `bookedMinutes` / `capacityMinutes` shape) |
| i18n | unchanged |
| Factory lifecycle 88/88 | **88/88 PASS** after `pnpm --filter @maher/database seed:factory-uat-only` (no DB reset) |

**Closed.** Mobile Factory Capacity / Bottlenecks verified. Working-minutes aggregation is the capacity API. No further scheduling, capacity, bottleneck, or UI work in this pass.

Planner and conflict suites were not rewritten to make capacity numbers look
healthy. They stayed green.
