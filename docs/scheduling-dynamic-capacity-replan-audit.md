# Scheduling dynamic capacity replan audit

Read-only audit of whether the scheduler reacts when factory capacity
changes (open/close day, overtime, working hours, worker skills).

**No planner rewrite. No live calendar mutation. No seed.**

Live snapshot: **2026-08-15** local DB `maher_erp`, factory timezone
`Asia/Amman`. Isolated domain evidence:
`apps/api/src/modules/scheduling/domain/__tests__/calendar-open-day-replan.test.ts`.

---

## Verdict

| Question | Answer |
|---|---|
| **OVERALL** | **B — PARTIAL** |
| Open day triggers replan | **YES** (sync `replanActiveSchedules`, not a queue job) |
| Close day triggers replan | **YES** |
| Add overtime triggers replan | **YES** |
| Remove overtime triggers replan | **YES** |
| New capacity can pull work forward | **ONLY SOME MODES** (forward / no requested date / backward infeasible) |
| At-risk orders use new capacity | **NO** in the common committed-too-early case; **sometimes** if the plan was capacity-blocked vs the requested date |
| Earliest-available orders use new capacity | **YES**, if that PO’s generate finishes |
| Requested-date backward orders move earlier | **ONLY IF NEEDED** |
| Factory-wide replan exists | **YES**, sequential per-order generate, not a global packer |

Calendar mutations **do** replan. They do **not** compact the factory into
newly opened hours. A newly opened day or overtime interval can stay empty
while later days stay full. That is mostly **backward latest-feasible
placement**, not a missing trigger.

---

## 1. Current optimization objective

**Hybrid C + B. Not utilization maximization (not D). Not earliest-possible for dated orders (not A).**

| Mode | Objective | When used |
|---|---|---|
| Backward | Latest feasible finish before due minus delivery buffer | `requiredDeliveryDate` is set ([`buildAndPersistSchedule`](../apps/api/src/modules/scheduling/scheduling.service.ts) ~1276) |
| Forward | Earliest working slot (`CapacityTracker.earliestFit`) | No requested date, or backward infeasible |
| Utilization | Local least-loaded worker only | `listEligibleWorkers` tie-break, not a factory objective |

Anchor for backward: `WorkingCalendar.latestProductionCompletion(requiredDeliveryDate, deliveryBufferWorkingDays)` then `subtractWorkingMinutes(..., bufferMinutes)`.

**Committed date is not the backward target.** It is used for risk / `abortIfMissesCommitment` (conflict resolve and at-risk resolve). Calendar replan does **not** pass `abortIfMissesCommitment`.

There is **no production-too-early penalty**. Finishing before due is allowed; backward simply prefers later legal slots.

**Far-future delivery (today Aug 15, due Sep 15, 2 days of work):** keep production near Sep 15 minus buffer. Empty Aug 16 is correct for that order.

**No requested date:** forward should occupy the earliest feasible open capacity, including a newly opened day or overtime, on that PO’s replan.

---

## 2. Calendar mutation call chain

```
Mobile AdminDayExceptionSheet
  → AdminSchedulingScreen.dayExceptionMutation
  → POST /scheduling/calendar-settings/exceptions
     or DELETE /scheduling/calendar-settings/exceptions/:date
  → SchedulingService.addException / deleteException
  → Prisma FactoryCalendarException upsert/delete
  → audit
  → await replanActiveSchedules(userId, reason)
  → for each active PO: generateForProductionOrder (no failHard)
  → SUPERSEDE prior DRAFT|PROPOSED|APPROVED|NEEDS_REVIEW
  → persist new PROPOSED + allocations
  → HTTP 200 { ..., replanned }
```

Working-hour override: `PATCH /scheduling/calendar-settings` → `upsertCalendar` → same loop with reason `calendar-settings-updated`.

| UI action | Exception / write | Job enqueued? | Replan |
|---|---|---|---|
| Open day | `EXTRA_SHIFT` default shift | **NO** | **YES** sync `calendar-exception:EXTRA_SHIFT` |
| Close day | `SHUTDOWN` | **NO** | **YES** sync `calendar-exception:SHUTDOWN` |
| Add overtime | `EXTRA_SHIFT` extended `shiftEnd` | **NO** | **YES** same as open |
| Clear / remove overtime | DELETE exception | **NO** | **YES** sync `calendar-exception:cleared` |
| Working-hour PATCH | `FactoryCalendar` update | **NO** | **YES** sync `calendar-settings-updated` |

Mobile timeout for this POST is **30s** (`DEFAULT_TIMEOUT_MS`). Resolve-all uses 90s. Mobile **does not toast `replanned`**. Admin-web settings does.

`apps/worker` does not consume the `scheduling` queue. Calendar replan never uses BullMQ.

---

## 3. Replan triggers

| Trigger | Mechanism | Scope |
|---|---|---|
| Calendar exception create/update/delete | Sync `replanActiveSchedules` | Every PO with `DRAFT \| PROPOSED \| APPROVED \| NEEDS_REVIEW` |
| Calendar settings PATCH | Same | Same |
| Worker activate / deactivate / skills | Async `REPLAN_EMPLOYEE` | POs with **future** allocations on that employee |
| Task start / pause / complete | Async `REPLAN` | That PO only |
| Task blocker | Async `RISK_ANALYSIS` | That PO, only if `recoverableAutomatically` |
| Manual Recalculate | `POST .../orders/:id/recalculate` | That PO, `failHard: true` |

`SCHEDULE_GENERATE` and `ESTIMATE_STATS` are defined and not produced by calendar mutations.

`replanActiveSchedules` swallows per-PO errors. Generate is **not** `failHard`, so a planner throw becomes `NEEDS_REVIEW` instead of aborting the factory pass.

Loop order is Prisma `distinct productionOrderId` — **not** `comparePriority`.

Each generate loads **other POs as immovable occupancy** (`loadOccupancy(po.id)`). There is no second pass that slides later work into a hole.

---

## 4. Open-day behavior

**Trigger: YES. Pull-forward: only forward / infeasible-backward.**

Isolated fixture (Wed 2026-08-12 closed vs open, Sun–Tue occupancy full, one 4h carpentry task):

| Order | Closed Wednesday | Opened Wednesday |
|---|---|---|
| No requested date (forward) | Starts Thursday 13 | Starts Wednesday 12 |
| Requested due 20 Aug (backward) | Stays 20 Aug | Stays 20 Aug — Wednesday unused |
| Due **is** Wednesday (backward) | Falls forward to Thursday, requested infeasible | Lands Wednesday, requested feasible |

Live UAT (read-only, 2026-08-15): `FactoryCalendarException` has **2026-08-19 `EXTRA_SHIFT` 08:00–16:00**. That Wednesday already has default working hours, so the exception adds no extra minutes. Allocations overlapping 19 Aug: **0**. 20 Aug: **27 allocations / 3 orders / 24 pinned**, modes `BACKWARD` + `BACKWARD_FALLBACK_FORWARD`.

That is the observed “opened day stays empty while later days hold work.”

---

## 5. Close-day behavior

**Trigger: YES.** `WorkingCalendar` skips `SHUTDOWN` / `HOLIDAY`, so a successful generate will not place **new** unpinned work on that day.

Live UAT: **2026-08-30 `SHUTDOWN`** (Sunday, normally open) still has **16 allocations, 16 pinned**, all `BACKWARD_FALLBACK_FORWARD`. Closed-day work remains when generate cannot move it (pins / in-progress / swallowed failure / timeout).

There is no immediate “allocation on a closed day” operational conflict. `validateSchedule` warns `NON_WORKING_START` on manual patch, not on calendar close. Stale windows persist until that PO’s generate succeeds.

Mobile 30s timeout: exception is committed first; if the HTTP call dies mid-loop, the day looks closed in capacity UI while many allocations are untouched. `onError` does not refetch.

---

## 6. Overtime-add behavior

**Trigger: YES. Pull into 16:00–20:00: only if that order’s generate wants that slot.**

Isolated fixture:

- Forward + Thursday 08:00–16:00 full: without OT starts next Sunday; with OT 08:00–20:00 starts Thursday 16:00.
- Backward due 20 Aug: Thursday OT unused; work stays on 20 Aug.

Live UAT: **2026-08-27 `EXTRA_SHIFT` 08:00–23:00** — 88 overlapping allocations, 60 pinned, **9 starts at/after 16:00**. Overtime can hold work, but it is not a vacuum that pulls 28–31 Aug backward plans earlier.

If a stage already fits 08:00–16:00, backward will not occupy 16:00–20:00 just because the hours exist.

---

## 7. Overtime-remove behavior

**Trigger: YES** (`deleteException` → `calendar-exception:cleared`).

Unpinned future work that no longer fits the shortened day should move on generate. Pinned / in-progress / completed stay. Same timeout and swallowed-error gaps as close-day.

---

## 8. Earliest-available behavior

No `requiredDeliveryDate` → `forwardSchedule` → `earliestFit`.

Isolated: opening Wednesday moved the no-date order from Thursday to Wednesday.

Live: 7 incomplete POs have no requested date; 43 of 50 have one. Active schedules: **11 FORWARD** (6 `NEEDS_REVIEW` + 5 `PROPOSED`) vs **50** backward or backward-fallback. Most of the board will not rush into new capacity.

---

## 9. Requested-date backward behavior

Dealer requests Sep 1, current plan Aug 29–31, admin opens Aug 28: **should not move earlier** if Aug 29–31 is still feasible.

Isolated: due 20 Aug stayed on 20 Aug after Wednesday opened.

Live mix of `BACKWARD` (15 PROPOSED) and `BACKWARD_FALLBACK_FORWARD` (35 PROPOSED) means many dated orders already could not land on the requested date and used forward fallback — those **can** occupy new earlier capacity on the next generate. Pure `BACKWARD` plans will not.

---

## 10. At-risk recovery behavior

Calendar change does **not** enqueue `RISK_ANALYSIS`. It replans every active PO, then classification runs on the next `GET /scheduling/at-risk` / dashboard read.

`COMMITTED_DATE_TOO_EARLY` is marked `recoverableAutomatically` with action `RECALCULATE`, but calendar generate still anchors backward on **requested** date, not committed, and does not set `abortIfMissesCommitment`. Opening a day before committed often **does not** clear May be late.

Recovery happens when:

- the order is forward (no requested date), or
- backward vs requested was capacity-infeasible and extra minutes make the requested window legal, or
- a later manual Recalculate / resolve-at-risk path uses commitment abort.

WIP / materials / estimates still block independently.

---

## 11. Priority

`comparePriority` (pinned → rank → committed → requested → createdAt → id) sorts **multi-order** `forwardSchedule` / `backwardSchedule` arrays and conflict resolve-all.

`replanActiveSchedules` and `generateForProductionOrder` pass **one order**. Slot competition is occupancy first-wins, not priority. Isolated sequential forward: `po-a` takes the new Wednesday; `po-b` / `po-c` shift one day later. A HIGH order later in the DB loop loses to a NORMAL order already persisted.

Worker pick inside a stage is least-loaded, not order priority.

---

## 12. Locks / in-progress / completed

During generate ([`buildAndPersistSchedule`](../apps/api/src/modules/scheduling/scheduling.service.ts) ~1167):

| State | Effect |
|---|---|
| Task `COMPLETED` / `IN_PROGRESS` / `BLOCKED` | `lockInPlace` — pin to planned start/end |
| Prior allocation `isPinned` | Window reused |
| `pinOverrides` | Conflict-resolve / admin force |

Conflict-resolve hard lock: `COMPLETED`, or `manuallyAdjusted && isPinned`. Planner `isPinned` alone is **not** a conflict hard lock.

Live future allocations (from 16 Aug): **257 pinned / 238 unpinned**. Pins are a first-class reason work does not slide into new capacity.

---

## 13. Global replan capability

**Exists as `replanActiveSchedules`. Not a joint optimizer. Not a queue job.**

- Sequential `generateForProductionOrder` per active PO.
- Admin-web “Recalculate visible” is a client loop of per-order recalculate.
- No compaction / pull-forward / pack / `REPLAN_FACTORY` symbol in the engine.
- Domain UAT already documents one-order-at-a-time occupancy (`sequentialPlan` in capacity fixtures).

---

## 14. UAT before/after (read-only)

Live calendar was **not** opened or closed for this audit. Existing exceptions are the after-state of prior admin actions.

**Factory settings:** `Asia/Amman`, weekdays Sun–Thu + Sat (Friday closed), 08:00–16:00, lunch in domain tests, buffer **1** working day.

**Incomplete POs:** 50 (43 with requested date, 7 without).

**Active schedules:** 6 `NEEDS_REVIEW` FORWARD, 5 `PROPOSED` FORWARD, 15 `PROPOSED` BACKWARD, 35 `PROPOSED` BACKWARD_FALLBACK_FORWARD. No `APPROVED` in this snapshot (calendar replans persist `PROPOSED` and supersede `APPROVED`).

| Day | Exception | Allocations | Orders | Pinned | Notes |
|---|---|---|---|---|---|
| 19 Aug | EXTRA_SHIFT 08–16 | **0** | 0 | 0 | Opened/overridden day unused |
| 20 Aug | none | 27 | 3 | 24 | Next day full, backward |
| 22 Aug | EXTRA_SHIFT 08–19 | 9 | 1 | 5 | 0 starts after 16:00 |
| 25 Aug | EXTRA_SHIFT 08–16 | 8 | 4 | 1 | Already a working Tuesday |
| 27 Aug | EXTRA_SHIFT 08–23 | 88 | 14 | 60 | 9 starts after 16:00 |
| 30 Aug | **SHUTDOWN** | 16 | 4 | **16** | Closed day still holding pinned work |

Isolated tests (no DB) are the controlled before/after for open-day and overtime. All 6 cases in `calendar-open-day-replan.test.ts` passed.

---

## 15. Exact gaps

1. **No compaction / pull-forward policy** for newly opened days or overtime when backward plans are already feasible later.
2. **Calendar replan is sync HTTP**, not `REPLAN_FACTORY`. Mobile **30s** timeout vs a full-factory generate loop.
3. **Per-PO failures swallowed**; generate not `failHard`.
4. **Mobile ignores `replanned`** and does not refetch on timeout after the exception is already committed.
5. **Capacity UI** (working intervals) updates from the exception even when allocations do not move.
6. **At-risk / committed** not used as the calendar generate target; `abortIfMissesCommitment` omitted.
7. **Priority unused** in the factory loop order.
8. **No targeted invalidation** of allocations on a closed or shortened day; pins can leave illegal windows (live 30 Aug).
9. **New plans are always `PROPOSED`**, so awaiting-approval can jump while dates barely change — looks like “nothing moved.”
10. Worker changes are async and scoped; calendar changes are sync and global. Same product, two architectures.

These are **not** “the trigger is missing.” The trigger runs. The placement policy and operational wrapping make the factory look static.

---

## 16. Recommended implementation (do not do in this pass)

Do **not** pack every day to 100%. A 20% day is correct when ready work is backward-anchored later, locked, not ready, or skill/WIP blocked.

Suggested next fix, in order:

1. **Async factory replan** after calendar writes (`REPLAN_FACTORY` or enqueue the existing loop) so HTTP is not 30s-bound. Persist the exception, return quickly, report job progress.
2. **Mobile:** 90s or fire-and-forget; toast `replanned`; refetch even if the request times out after a confirmed write.
3. **Capacity increase** (open day / overtime / longer shift):
   - Replan **no-requested-date** orders in forward mode (they should occupy new capacity).
   - Replan **at-risk / LATE vs committed** with commitment-aware generate (`abortIfMissesCommitment` or forward-from-now until committed is feasible).
   - Leave **on-track requested-date backward** plans in place unless their current window is now illegal.
4. **Capacity decrease** (close / remove OT / shorter hours): keep full regenerate; **fail-hard or report per-PO**; priority-sort the loop; explicitly move unpinned allocations that intersect the removed interval.
5. **Do not** add a utilization maximizer. Optional later: a single compaction pass only for forward + at-risk queues, never for feasible backward orders.

---

## Why a 20% day can remain 20%

Ready work may be:

- backward-scheduled to a later due date (live 19 Aug empty, 20 Aug loaded);
- pinned / in-progress / completed (257 of 495 future allocations pinned);
- blocked on materials, WIP, or estimates;
- waiting behind occupancy of other POs in a sequential generate;
- ineligible for that day’s skills / stage.

Empty new capacity is a **success** for latest-feasible dated work. It is a **gap** only when earliest-available or at-risk-vs-committed work is waiting and generate never placed it there.
