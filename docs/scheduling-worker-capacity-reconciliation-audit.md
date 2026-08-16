# Scheduling worker–stage capacity reconciliation audit

Investigation of Mobile Admin Scheduling → Factory Capacity → Delivery detail
showing **Available 28h / Allocated 8.8h / Remaining 19.2h**, while Eligible
Workers showed only **Omar Hijazi 2.6h / 14h** and **Yousef Haddad 0.7h / 14h**.

This document records the audit. **No code, planner, WorkerSkill, allocation,
or seed data was changed.**

Live snapshot: **2026-08-15** local DB `maher_erp`, factory timezone `Asia/Amman`.
Matching screenshot day: **2026-08-27**.

## 1. Executive verdict

**A. CORRECT DATA, MISLEADING UI.**

Stage 8.8h is the correct working-minute total for Delivery on 27 Aug 2026.
Omar 2.6h and Yousef 0.7h are the correct totals for *currently eligible*
Delivery workers.

The unexplained **5.5h** is real work:

| Worker | Working minutes | Hours | Why omitted from Eligible Workers |
|---|---|---|---|
| Basel Smadi | 288 | 4.8h | Delivery `WorkerSkill.isActive = false` since 2026-08-14 22:49:53Z |
| Anas Freijat | 42 | 0.7h | Delivery `WorkerSkill.isActive = false` since 2026-08-14 22:49:45Z |
| **Gap** | **330** | **5.5h** | |

Users are still active. Skills were deactivated after the allocations existed.
Allocations were not cleared. Stage sum includes them; the worker list does not.

Not a period/timezone split. Not wall-clock vs working-minutes drift between
stage and worker. Not duplicate allocation IDs. Not a Mobile formatting bug.

## 2. Screenshot case

| UI label | Display | API minutes | Source |
|---|---|---|---|
| Available | 28h | 1680 | `availableMinutes` |
| Allocated | 8.8h | 529 | `allocatedMinutes` |
| Remaining | 19.2h | 1151 | `remainingMinutes` (`1680 − 529`) |
| Omar | 2.6h / 14h | 157 / 840 | worker row |
| Yousef | 0.7h / 14h | 42 / 840 | worker row |

Mobile [`minutesToHoursLabel`](../apps/mobile/src/features/scheduling/selectFactoryCapacity.ts)
only does `round(minutes / 60, 1)`. It does not re-aggregate.

Stage math: `28 − 8.8 = 19.2`. Worker math: `2.6 + 0.7 = 3.3`. Gap: `8.8 − 3.3 = 5.5`.

## 3. Exact live case

| Field | Value |
|---|---|
| Selected date | **2026-08-27** (Thursday) |
| Mode | **Day** (`from === to`, `includeWorkers: true`) |
| Factory timezone | `Asia/Amman` (UTC+3; no DST) |
| Stage | Delivery `60408ef3-8e67-4d1d-a73d-d881585be298` |
| Resource mode | `WORKER_CONSTRAINED` |
| Calendar | Sun–Thu+Sat, 08:00–16:00, lunch 12:00–13:00 |
| This day | `EXTRA_SHIFT` `e6edd775-aecd-403f-ab4a-64757b946d07` 08:00–23:00, lunch kept |

Today **2026-08-15** is `SHUTDOWN` (0h) and cannot be the screenshot.

Week mode cannot be this case: `includeWorkers` is forced off unless
`from === to` ([`scheduling.service.ts`](../apps/api/src/modules/scheduling/scheduling.service.ts)
~2218). Week totals around 27 Aug are 38h–42h per worker, not 14h.

API consumed by Mobile:

`GET /scheduling/capacity?from=2026-08-27&to=2026-08-27&granularity=day&includeWorkers=true`

Working intervals for that local day:

| Local (Amman) | UTC |
|---|---|
| 08:00–12:00 | 05:00–09:00Z |
| 13:00–23:00 | 10:00–20:00Z |

`shiftMinutes = 840` (14h). Not hardcoded.

## 4. Why Available is 28h and each worker is /14h

```
availableMinutes = round(shiftMinutes × eligibleWorkerCount)
                 = 840 × 2
                 = 1680
                 = 28h
```

`eligibleWorkerCount` is distinct **currently active** Delivery skills
(`WorkerSkill.isActive` and `user.isActive` and `archivedAt is null`):

| Employee | ID | Skill active |
|---|---|---|
| Omar Hijazi | `d3e379ff-21ad-4941-b279-b037948d684c` | yes |
| Yousef Haddad | `3b62a01a-d3ca-4f7d-877c-b6369beaa468` | yes |
| Basel Smadi | `bff45706-c927-44da-ba1e-e01f726e470a` | **no** (2026-08-14 22:49:53Z) |
| Anas Freijat | `056ffba1-06c7-4502-aeec-ec0e009d31b8` | **no** (2026-08-14 22:49:45Z) |
| Issa Daoud | `002357c5-33d6-4dff-8fc7-0879380241fb` | **no** (no allocations this day) |

Each worker row’s `availableMinutes` is `round(shiftMinutes)` = **840 = 14h**.
That is the EXTRA_SHIFT window minus lunch (`08:00–12:00` + `13:00–23:00`),
not a default 7h day and not a two-day range.

## 5. Working-minute logic (stage vs worker)

Both totals use the same helper:

`overlapWorkingMinutes(plannedStart, plannedEnd, intervalsForLocalYmd('2026-08-27'))`

in [`working-calendar.ts`](../apps/api/src/modules/scheduling/domain/working-calendar.ts).

There is no separate worker calculator. No `plannedEnd − plannedStart`.
No `${ymd}T00:00:00Z`. Query window is factory-local
`[2026-08-27 00:00, 2026-08-28 00:00)` = `[2026-08-26 21:00Z, 2026-08-27 21:00Z)`.

Lunch, overnight, and closed hours are excluded from **both** the stage sum
and each employee bucket. The mismatch is **who is listed**, not how minutes
are measured.

## 6. Stage allocated = 529m = 8.8h

Nine unique `schedule_allocations` rows. All **PROPOSED**. No second APPROVED
version of the same PO in the window. Task status is not filtered.

| Allocation ID | PO / SO / task | Employee | Schedule | Pinned | Task status | Planned UTC | Local Amman | Working min |
|---|---|---|---|---|---|---|---|---|
| `0256d75b-79ff-4159-9736-48dc357f9361` | PO-2026-00032 / SO-2026-00027 / TSK-2026-00288 | Omar Hijazi | PROPOSED v8 | no | NOT_STARTED | 06:57–08:09 | 09:57–11:09 | 72 |
| `10d8dc7e-3a2d-4c7f-b22b-baadf0ef1074` | PO-2026-00011 / SO-2026-00010 / TSK-2026-00099 | Omar Hijazi | PROPOSED v12 | no | READY | 08:09–10:09 | 11:09–13:09 | 60 |
| `b9cbfb52-7558-4fdd-86e3-50e5b83b86d6` | PO-2026-00048 / SO-2026-00038 / TSK-2026-00432 | Omar Hijazi | PROPOSED v9 | no | NOT_STARTED | 19:35–29 05:56 | 22:35–23:00 tail | 25 |
| `d632e476-82d3-499f-83e6-53e98e39f281` | PO-2026-00036 / SO-2026-00031 / TSK-2026-00324 | Yousef Haddad | PROPOSED v18 | no | NOT_STARTED | 12:21–13:03 | 15:21–16:03 | 42 |
| `3c067b57-68a2-4921-8f7f-637200d1e5a9` | PO-2026-00022 / SO-2026-00020 / TSK-2026-00198 | Basel Smadi | PROPOSED v13 | yes | IN_PROGRESS | 07:38–10:11 | 10:38–13:11 | 93 |
| `fbdd042a-1cf9-4dc6-9ddc-ff2eb0e451d4` | PO-2026-00023 / SO-2026-00020 / TSK-2026-00207 | Basel Smadi | PROPOSED v12 | yes | IN_PROGRESS | 07:38–10:11 | 10:38–13:11 | 93 |
| `ec117351-f7eb-4035-b7aa-7103fb1c135b` | PO-2026-00007 / SO-2026-00006 / TSK-2026-00063 | Basel Smadi | PROPOSED v12 | yes | IN_PROGRESS | 11:47–12:47 | 14:47–15:47 | 60 |
| `0d143825-0552-4142-aaf1-c7f4ee189f68` | PO-2026-00020 / SO-2026-00018 / TSK-2026-00180 | Basel Smadi | PROPOSED v12 | yes | COMPLETED | 12:08–12:50 | 15:08–15:50 | 42 |
| `263b7206-9359-4598-b313-e2a01ca689e6` | PO-2026-00018 / SO-2026-00016 / TSK-2026-00162 | Anas Freijat | PROPOSED v12 | yes | IN_PROGRESS | 12:08–12:50 | 15:08–15:50 | 42 |

Reasons on these schedules are `calendar-exception:SHUTDOWN` (planner reason
string; not a capacity filter).

```
72 + 60 + 25 + 42 + 93 + 93 + 60 + 42 + 42 = 529m
529 / 60 = 8.816… → display 8.8h
```

Omar’s overnight row only contributes the **25m** that intersect 13:00–23:00
on 27 Aug. The 28–29 Aug tail is outside this day’s intervals.

Basel’s two 07:38–10:11 rows are **different allocation IDs and different POs**
(PO-22 and PO-23), not one row counted twice.

## 7. Worker decomposition

```
Omar   72 + 60 + 25 = 157m → 2.6h
Yousef                42m → 0.7h
Visible               199m → 3.3h
```

```
Basel  93 + 93 + 60 + 42 = 288m → 4.8h
Anas                   42m → 0.7h
Omitted                330m → 5.5h
```

```
529 − 199 = 330
8.8h − 3.3h = 5.5h
```

Unassigned (`employeeId` null): **0**. Issa: **0**.

## 8. Reconciliation table

| Worker / category | Allocated | Included in stage? | Visible in worker list? |
|---|---|---|---|
| Omar Hijazi | 2.6h (157m) | YES | YES |
| Yousef Haddad | 0.7h (42m) | YES | YES |
| Basel Smadi (skill off) | 4.8h (288m) | YES | NO |
| Anas Freijat (skill off) | 0.7h (42m) | YES | NO |
| Unassigned | 0 | — | — |
| Issa Daoud (skill off, no rows) | 0 | — | NO |
| **TOTAL** | **8.8h (529m)** | | |

## 9. Duplicates, completed work, period

- Nine distinct allocation IDs. Each PO has one PROPOSED version in the window.
  No APPROVED+PROPOSED pair.
- Completed task TSK-2026-00180 (Basel / PO-20) **is** in the stage total (42m).
  It would also be in a worker row if Basel were still listed. Same rule.
- Stage and worker minutes use the **same** day intervals. Not week-vs-day.

## 10. Data flow

```
FactoryCapacityDetailSheet
  → selectFactoryCapacityCards / minutesToHoursLabel
  → GET /scheduling/capacity?from=2026-08-27&to=2026-08-27&includeWorkers=true
  → SchedulingController.capacity
  → SchedulingService.listCapacity
       allocations: APPROVED|PROPOSED overlapping local day
       stage allocatedMinutes += overlapWorkingMinutes (all employees)
       workers[] = current skilled map only
```

Code that creates the gap
([`scheduling.service.ts`](../apps/api/src/modules/scheduling/scheduling.service.ts) ~2278–2325):

```
allocatedMinutes += minutes;          // every Delivery allocation
if (employeeId) allocatedByEmployee += minutes;
workers = [...skilled.entries()]      // current active skills only
```

## 11. Intended invariant

For `WORKER_CONSTRAINED`, **stage allocated is not defined as
sum(currently eligible workers)**.

Existing architecture (same as
[scheduling-bottleneck-capacity-audit.md](./scheduling-bottleneck-capacity-audit.md)):
unskilled / unassigned rows still count toward the stage.
`includeWorkers` nests **skilled workers only**
([`scheduling-capacity-wiring.test.ts`](../apps/api/src/modules/scheduling/__tests__/scheduling-capacity-wiring.test.ts)).

The detail sheet therefore cannot imply that Omar + Yousef explain 8.8h.

## 12. Recommended fix (not applied)

Prefer `listCapacity` presentation, not the planner.

- API: add omitted-worker rows with `eligible: false`, or
  `ineligibleAllocatedMinutes`, so listed minutes plus remainder = stage total.
- Mobile: render those rows or one “no longer eligible” remainder.
- Files if later approved: `scheduling.service.ts`, capacity DTO,
  `selectFactoryCapacity.ts`, `FactoryCapacityDetailSheet.tsx`, i18n.
- No allocation deletes, no reseed, no planner change, no migration.

Scheduling-engine risk if that presentation change is done later: **none**.
)
