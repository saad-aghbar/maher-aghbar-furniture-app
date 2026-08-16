# Scheduling bottleneck capacity audit

Investigation of Mobile Admin Scheduling → Factory Capacity → Bottlenecks showing
**Foam preparation 19.1h allocated / 14h available, status Full** on **30 Aug 2026**.

This document records the audit. The working-minute fix is described in
[scheduling-capacity-working-minutes-fix.md](./scheduling-capacity-working-minutes-fix.md)
and is **closed** (Mobile verified, factory lifecycle 88/88).
The approved bottleneck UI was not redesigned.

Live snapshot: **2026-08-15** local DB `maher_erp`, factory timezone `Asia/Amman`.

## 1. Executive verdict

**MIXED — aggregation bug (wall-clock vs working minutes) + misleading Full classification.**

Not a finite-capacity placement defect. Not an intentional UAT over-capacity fixture.
Not double-counted allocation IDs. Not post-scheduling skill/calendar shrink for this day.

The planner stores `plannedStart` / `plannedEnd` as the first and last working instants.
`listCapacity` previously summed raw clock overlap of that interval with the selected day,
so overnight and lunch were counted as allocated hours. Available hours already used
`WorkingCalendar` working intervals (2 × 7h = 14h).

After the working-interval fix, the same Foam day is **4h allocated / 14h available /
10h remaining / Available**.

## 2. Exact meaning of the labels

| Label | Meaning (code) |
|---|---|
| **Available** | `shiftMinutes × heads`. `heads` = distinct active `WorkerSkill` users, or `resourceSlots` when `RESOURCE_CONSTRAINED`. Multi-skilled workers are counted in every stage they can do. |
| **Allocated** | Sum of each `APPROVED`/`PROPOSED` allocation’s intersection with **factory-local working intervals** for the selected YMD (after the fix). Before the fix: raw `[plannedStart, plannedEnd]` clock overlap. Not clamped to available. Task status is not filtered. Unskilled / unassigned rows still count. |
| **Remaining** | `max(0, available − allocated)`. Hides the overage; does not change allocated. |
| **Full** | `remaining <= 0 && available > 0`. 14/14 and 19.1/14 were the same state. No `OVER_CAPACITY` exists. |
| **Near capacity** | `allocated / available >= 0.85` only when remaining > 0. |
| **Moderate** | ratio ≥ 0.50 and < 0.85. |
| **Factory load** | `min(100, round(sum(allocated) / sum(available)))` over cards with eligible workers and available > 0. Same minutes as the stage cards. |
| **Bottleneck** | Stage in `{noEligibleWorkers, unavailable, full, nearCapacity}`. Count = that list’s length. Moderate/available are not bottlenecks. |

## 3. Data flow

```
AdminSchedulingScreen (ymd = selectedDay)
  → FactoryCapacitySection
  → selectCapacityQueryParams (from=to=ymd, granularity=day, includeWorkers)
  → useSchedulingCapacityQuery
  → GET /scheduling/capacity
  → SchedulingController.capacity
  → SchedulingService.listCapacity
  → WorkingCalendar.intervalsForLocalYmd + overlapWorkingMinutes
  → ScheduleAllocation rows (APPROVED / PROPOSED)
  → selectFactoryCapacityCards / selectFactoryLoadPercent / selectBottleneckStages
  → FactoryCapacityCard / FactoryCapacityDetailSheet
```

Mobile is presentation-only. It never multiplies workers × shift.

## 4. Foam example reconciliation (30 Aug 2026)

Factory calendar: `Asia/Amman`, 08:00–16:00, lunch 12:00–13:00, Fri closed.
FOAM is `WORKER_CONSTRAINED`. Active Foam skills: **Rana Khatib**, **Yousef Haddad**.

**Available 14h** = 2 eligible workers × 420 working minutes.

### Before (clock overlap, Amman local midnight — matches the screenshot)

| Worker | Order | Start (Amman) | End (Amman) | Clock min counted | Working min (truth) | Notes |
|---|---|---|---|---|---|---|
| Rana Khatib | PO-2026-00024 | Sat 08:55 | Sun 08:30 | **510** | 30 | `resolve-conflict`, est. 395 working across Sat–Sun |
| Yousef Haddad | PO-2026-00049 | Sat 12:44 | Sun 06:52 | **412** | 0 | ends before Sunday shift |
| Nour Masri | PO-2026-00013 | Sun 05:55 | Sun 06:00 | 5 | 0 | COMPLETED 5-min pin, no Foam skill |
| Rana Khatib | PO-2026-00028 | Sun 08:30 | Sun 12:01 | 211 | 210 | 1 min into lunch dropped |
| Lina Awad | PO-2026-00004 | Sun 12:21 | Sun 12:26 | 5 | 0 | COMPLETED pin during lunch, Inspection-only |

Clock total: **1143 min = 19.1h**. Working total: **240 min = 4.0h**.

Current source used UTC midnight windows (783 clock min = 13.1h). The screenshot
(19.1h + factory load 81% + bottlenecks 5) matches **Asia/Amman local midnight**
clock overlap. Both windows inflated overnight.

### After (working-interval intersection)

| Worker | Order | Sunday working intersection |
|---|---|---|
| Rana Khatib | PO-2026-00024 | 08:00–08:30 = **30m** |
| Rana Khatib | PO-2026-00028 | 08:30–12:00 = **210m** |
| others | — | **0** |

Allocated **240m (4.0h)** / available **840m (14h)** / remaining **600m (10h)** /
utilization **29%** / state **available**.

Five distinct allocation IDs. No PO had both live `APPROVED` and `PROPOSED`.

## 5. Overlaps

Rana’s Sunday Foam tasks meet at 08:30 (exclusive). **0 true worker overlaps**
on Foam that day. Sequential work is valid. The extra 5.1h was overnight clock,
not conflict minutes.

## 6. Can the normal scheduler create >100% working hours?

**NO.** `CapacityTracker.earliestFit` places excess into later working intervals.
UAT A/B and the new 2×7h Foam demand test keep Sunday working minutes ≤ 840.

The old UI could still show >100% because it counted clock gaps the planner left
in `[plannedStart, plannedEnd]`.

## 7. UAT fixture

**NO** intentional over-capacity seed. Live rows come from normal generate /
`resolve-conflict` / `calendar-exception:EXTRA_SHIFT`. Those created ordinary
multi-day working intervals. Do not delete them as a “fix”.

## 8. Capacity / skills after scheduling

**NO** for this example. Foam skills were trimmed to Rana + Yousef at 22:49–22:51
on 14 Aug; these allocations were written later that night. 30 Aug has no calendar
exception (default 7h). Anas / Basel / Issa Foam skills are inactive and do not
affect eligible count.

## 9. Double counting

**NO.** 5 IDs, one live schedule per PO.

## 10. Day / timezone

**YES, there was a period bug.** `${ymd}T00:00:00.000Z` is not factory-local
midnight (`Asia/Amman` = UTC+3). `listCapacity` now uses
`WorkingCalendar.localRangeBounds` / `intervalsForLocalYmd` so the Mobile YMD is
the same factory-local day.

## 11. Factory load

**Before (clock, Amman local):** 6091 / 7560 = 80.57% → **81%**.
Formula is consistent with the (inflated) stage cards. Foam at 136% while factory
is 81% is valid under stage-bucket math; multi-skill workers also inflate the
denominator (Yousef is in Foam + Packaging + Painting + Upholstery + Delivery).

**After (working minutes):** 2203 / 7560 = 29.14% → **29%**.

## 12. Bottleneck count

**Before:** Assembly Full, Foam Full, Inspection Full, Packaging Full, Delivery Near = **5**.
Formula: attention-state count, not stages+orders or stages+conflicts.

**After:** no stage is Full or Near (Assembly / Inspection / Packaging are Moderate).
Bottleneck count = **0**.

Needs Attention and Bottlenecks use the same `ATTENTION_STATES` filter and the
same API rows in day mode.

## 13. Root cause

`listCapacity` measured wall-clock `[plannedStart, plannedEnd]` instead of the
working minutes the planner already uses.

## 14. Recommended fix

Implemented in this pass: intersect allocations with factory-local working
intervals. Do not clamp. Do not add `OVER_CAPACITY` yet.

After correction, live 30 Aug has **no genuine >100%** stage. A dedicated wiring
test still reports 660 allocated / 420 available when overlapping/unskilled
working minutes exist. Add `OVER_CAPACITY` later only if those leftover
conditions show up in the admin UI and need a distinct label.

## 15. Files changed for the fix

- [`apps/api/src/modules/scheduling/domain/working-calendar.ts`](../apps/api/src/modules/scheduling/domain/working-calendar.ts) — `overlapWorkingMinutes`, local YMD helpers
- [`apps/api/src/modules/scheduling/scheduling.service.ts`](../apps/api/src/modules/scheduling/scheduling.service.ts) — `listCapacity`
- Tests: working-calendar, capacity wiring, UAT I, mobile `selectFactoryCapacity`
- This doc + [scheduling-capacity-working-minutes-fix.md](./scheduling-capacity-working-minutes-fix.md)

Planner, conflict detector/resolve, WorkerSkill, production, inventory, and the
Mobile bottleneck layout were not changed.

## 16. Risk of the fix

**Medium for displayed numbers** (multi-day tasks look less loaded). **Low for
scheduling behavior** (planner and conflicts untouched). Admin Web still reads
`bookedMinutes` / `capacityMinutes`, which remain on the payload.
