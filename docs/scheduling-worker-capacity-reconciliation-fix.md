# Scheduling worker–capacity reconciliation fix

Presentation-only follow-up to
[scheduling-worker-capacity-reconciliation-audit.md](./scheduling-worker-capacity-reconciliation-audit.md).

**Status:** API + Mobile breakdown shipped. Planner, conflicts, bottlenecks,
WorkerSkill writes, and stage totals are unchanged.

The audit verdict stays: stage allocated minutes were already correct. Eligible
Workers omitted former-skilled people who still had allocations. This change
exposes those already-counted minutes so the detail sheet reconciles.

## Contract

`GET /scheduling/capacity` with `includeWorkers` (single-day `from === to`) now
returns:

| Field | Meaning |
|---|---|
| `workers[]` | Currently eligible only (`WorkerSkill.isActive` + active user). Additive `eligible: true`. |
| `ineligibleWorkers[]` | Allocated `employeeId`s not in the current skilled map. `eligible: false`, `availableMinutes: 0`, `remainingMinutes: 0`. |
| `unassignedAllocatedMinutes` | Sum of working minutes with `employeeId` null. `0` when none. No fake worker row. |

Week / multi-day responses still omit worker arrays (same `includeWorkers`
gate as before).

Exact minute invariant when workers are included:

```
sum(workers.allocatedMinutes)
  + sum(ineligibleWorkers.allocatedMinutes)
  + unassignedAllocatedMinutes
  === allocatedMinutes
```

Available stays `shiftMinutes × current eligible heads`. Former-skilled
workers do **not** add capacity.

Unchanged: `availableMinutes`, `allocatedMinutes`, `remainingMinutes`,
`eligibleWorkerCount`, planner math, conflict detection, bottleneck selection.

## 27 Aug 2026 Delivery (fixture + live case)

Factory TZ `Asia/Amman`. Day is `EXTRA_SHIFT` 08:00–23:00 with lunch kept
→ 840 working minutes. Two currently eligible Delivery workers → **1680**
available (28h).

| Bucket | Minutes | Hours | Capacity |
|---|---|---|---|
| Stage allocated | 529 | 8.8h | — |
| Stage remaining | 1151 | 19.2h | — |
| Omar Hijazi (eligible) | 157 | 2.6h | 840 (14h) |
| Yousef Haddad (eligible) | 42 | 0.7h | 840 (14h) |
| Basel Smadi (ineligible) | 288 | 4.8h | 0 |
| Anas Freijat (ineligible) | 42 | 0.7h | 0 |
| Unassigned | 0 | — | — |

```
199 + 330 + 0 = 529
840 × 2 = 1680
```

Basel and Anas remain omitted from `workers` and from available hours. Their
skill rows stay inactive. Allocations are not deleted or reassigned.

## API

[`scheduling.service.ts`](../apps/api/src/modules/scheduling/scheduling.service.ts)
`listCapacity` `buildRows`:

- Same `overlapWorkingMinutes` / day intervals as stage totals. No second clock path.
- Allocation `select` includes `employee.firstName` / `lastName`. Missing join
  falls back to `employeeId`.
- Eligible rows: current `skilled` map + `eligible: true`.
- Ineligible rows: every allocated `employeeId` not in `skilled`.
- Unassigned: minutes when `!employeeId`.

## Mobile

Types in [`scheduling.ts`](../apps/mobile/src/api/modules/scheduling.ts) and
views in [`selectFactoryCapacity.ts`](../apps/mobile/src/features/scheduling/selectFactoryCapacity.ts)
pass `ineligibleWorkers` and `unassignedAllocatedMinutes` through. Eligibility
is not recomputed on device.

[`FactoryCapacityDetailSheet.tsx`](../apps/mobile/src/features/scheduling/components/FactoryCapacityDetailSheet.tsx):

- Eligible section unchanged: `HoursOfText` pairs (`2.6h / 14h`).
- If `ineligibleWorkers.length`: second block, same card chrome, heading +
  caption. Hours via `formatCompactHours` + `workerAllocatedOnly`
  (`4.8h allocated`). Never `4.8h / 14h`.
- If `unassignedAllocatedMinutes > 0`: compact unassigned row.
- Both sections hide when empty.
- No View-worker / skills actions beyond the existing Users shortcut.
- Compact stage cards stay stage-totals only.

## i18n

New keys under `mobile.adminScheduling.capacity` (en / ar / he):

| Key | EN | AR | HE |
|---|---|---|---|
| `detailIneligibleHeading` | No longer eligible | غير مؤهلين حالياً | אינם כשירים כעת |
| `detailIneligibleCaption` | Hours already booked on this day. They do not add available capacity. | ساعات محجوزة لهذا اليوم. لا تضيف طاقة متاحة. | שעות שכבר הוקצו ליום זה. הן אינן מוסיפות קיבולת זמינה. |
| `detailUnassignedHeading` | Unassigned | غير معيّن | לא משויך |
| `detailUnassignedCaption` | Booked hours with no worker assigned. | ساعات محجوزة دون عامل معيّن. | שעות שהוקצו ללא עובד. |
| `workerAllocatedOnly` | `{hours} allocated` | `{hours} محجوزة` | `{hours} הוקצו` |

RTL uses existing `isRTL` layout. Ineligible hours are not mixed slash strings.

## Tests

API [`scheduling-capacity-wiring.test.ts`](../apps/api/src/modules/scheduling/__tests__/scheduling-capacity-wiring.test.ts):

- Delivery 27 Aug: 1680 / 529 / 1151; Omar 157/840; Yousef 42/840; Basel 288;
  Anas 42; `199+330=529`; available still 1680.
- Unassigned: 400 + 100 + 100 = 600.
- No ineligible/unassigned → empty array / `0`.
- Skill off → worker leaves `workers`, appears in `ineligibleWorkers`,
  allocation unchanged.
- Skill on → back on `workers` only, no duplicate.
- Inactive user → same as ineligible.
- Existing Foam totals and “skilled workers only on `workers`” stay green.

Mobile: selector maps the new fields; detail sheet places Omar/Yousef on
eligible pairs and Basel/Anas on allocated-only rows (no `/`).

## Limitations

- Historical allocations for deactivated skills remain until a replan or
  manual edit. This UI does not clear them.
- Available hours still ignore ineligible heads by design.
- Week mode does not nest worker breakdowns (`includeWorkers` is off unless
  `from === to`).
- Admin Web does not consume `workers` / `ineligibleWorkers`.
- No `db:seed`. No planner, conflict, or bottleneck test changes.
