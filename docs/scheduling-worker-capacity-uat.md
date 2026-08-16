# Scheduling worker-capacity UAT

Evidence from the current worktree engine plus isolated Jest fixtures. Gap closure is documented in [scheduling-closure-report.md](./scheduling-closure-report.md). Original audit snapshot: [scheduling-capacity-audit.md](./scheduling-capacity-audit.md).

Harness:

- Domain: `apps/api/src/modules/scheduling/domain/__tests__/scheduling-capacity-uat.test.ts`
- Fixtures: `scheduling-capacity-uat.fixtures.ts` (in-memory workers/orders; no Prisma seed)
- Wiring: `apps/api/src/modules/scheduling/__tests__/scheduling-capacity-wiring.test.ts`

Command: `pnpm exec jest --testPathPattern='scheduling-capacity-(uat|wiring)'` from `apps/api`.

Calendar used for A–J (unless noted): Asia/Amman, Sun–Thu, **08:00–16:00, no lunch (8h)**. Factory default lunch 12:00–13:00 is **7h/day** and is documented separately.

---

## CODE AUDIT

See [scheduling-capacity-audit.md](./scheduling-capacity-audit.md). Short version: Nest `SchedulingService` orchestrates a pure domain planner (`forwardSchedule` / `backwardSchedule`). Capacity is per-employee occupancy filtered by `WorkerSkill`. Confirm copies `requiredDeliveryDate` onto the PO and calls generate.

## CURRENT ALGORITHM

1. Load active `PRODUCTION_WORKER` users + active skills, other POs’ `APPROVED`/`PROPOSED` occupancy, factory calendar.
2. If `ProductionOrder.requiredDeliveryDate` is set → `backwardSchedule` from that instant minus buffer; else `forwardSchedule` from `now`.
3. Backward failure → forward fallback, `requestedDateFeasible=false`.
4. Persist `ProductionSchedule` `PROPOSED` + `ScheduleAllocation`; sync task planned windows.
5. Then assess materials/WIP for **risk flags**, not as planner `notBefore` (generate does not pass `materialReadyAt` / `productionReadyAt`).

Availability: always forward for earliest, then backward for feasibility.

## REQUESTED DATE BEHAVIOR

Canonical persist field is **`requiredDeliveryDate`** (RFQ → quotation accept → sales order → production order). Schedule row uses `requestedDeliveryDate`. `requestedDateFeasible` is **not stored**.

It **is** a real planning constraint on generate (backward). Hybrid: infeasible → forward. Logistics `Delivery` does not use it.

## WORKER CAPACITY MODEL

Finite **per-worker calendar occupancy**. Not total employee count. Not a global hours number.

Caveats: empty eligible set → `DEPARTMENT` booking with **no occupancy**. UI `listCapacity` = department headcount × shift minutes (not skills).

## WORKER SKILL MODEL

Active + `WorkerSkill.stageDefinitionId` match. Department ignored. Inactive excluded. `proficiency` and `workerCountRequired` unused.

## PARALLELISM

DAG layers allow concurrent stages; `CapacityTracker` serializes the same worker. Merge waits for all parents.

## MATERIAL / WIP READINESS

Domain can delay via `materialReadyAt` / `productionReadyAt`. Generate stores risk after the fact. Inventory `readyAt` never supplied. WIP is order-level lot check, not per-stage.

## WORKING CALENDAR

Working weekdays, shift, breaks, `HOLIDAY`/`SHUTDOWN`/`EXTRA_SHIFT`. `addWorkingMinutes` spans days and skips closed capacity. Default lunch makes a nominal 8h shift 7h.

## QUANTITY SCALING

`LINEAR | FIXED | SETUP_PLUS_LINEAR | BATCH | PARALLEL_CAPACITY` in `duration-calculator.ts`. Planner consumes `estimatedMinutes` already scaled.

## CONFLICT HANDLING

Planner avoids employee overlap via `earliestFit`. Validator `WORKER_OVERLAP`. `patchAllocation` validates **this order only**. Occupancy constructor soft-loads overlaps.

## REPLANNING

Generate/recalculate/calendar-change replan. Task complete enqueues `REPLAN` but the worker **no-ops**. No automatic lateness scanner.

---

## Tests A–Z

| Test | Result | Expected | Actual | Evidence | Code path |
|---|---|---|---|---|---|
| A | **PASS** | 1 worker, 4h tasks, 8h day → 2/day, no triple overlap | 6 tasks: 2 on Sun, 2 Mon, last Tue; only `w-carp-1`; no overlap | `scheduling-capacity-uat.test.ts` A | `forwardSchedule` + `CapacityTracker.earliestFit` |
| B | **PASS** | 2 workers → ~4 tasks/day, faster than A | Sun: 2 vs 4 starts; two-worker maxEnd earlier | Test B | same, more eligible workers |
| C | **PARTIAL** | Carpentry = 2 skilled, not 50 | **Skilled path:** 8 tasks only on `carp-a/b`, 4/day. **Zero-skill path:** 50 unskilled → all `DEPARTMENT`, 3 tasks same morning (unlimited) | Test C two cases | `listEligibleWorkers`; fallback `schedule-planner.ts` ~89–107 |
| D | **PASS** | Add 2 carpentry workers → more feasible / earlier | 20×4h, requested Wed: 2 workers `requestedDateFeasible=false` for the batch; 4 workers all true; 4-worker completion earlier | Test D sequentialPlan | `backwardSchedule` + occupancy clone |
| E | **PASS** | 3 of 4 workers booked Sunday → only remaining worker | Both new Sunday tasks on `w4` | Test E | `existingOccupancy` |
| F | **PASS** | Upholstery (2) is bottleneck, not 14 headcount | Upholstery IDs only `u*`; mixed factory finishes later than all-skilled 14 | Test F | skill filter + durations 4h/6h/2h |
| G | **PASS** | Foam∥Painting overlap; Upholstery after both | Time ranges overlap; upholstery start ≥ both ends | Test G | `topologicalLayers` + merge wait |
| H | **PASS** | Same worker cannot do Foam and Painting at once | Both assigned `shared`; no time overlap | Test H | `CapacityTracker.hasOverlap` |
| I | **PASS** | Split workers finish earlier than H | `maxEnd(split) < maxEnd(shared)` | Test I | two eligible earliest-fit |
| J | **PASS** | ~2 working days, request ~20 working days out → start near request, not tomorrow | Backward `usedBackward=true`, start after 2026-08-20; forward starts before 2026-08-12 | Test J | `backwardSchedule` target = requested − buffer |
| K | **PARTIAL** | Friday delivery, Wed/Thu full → walk earlier, not use Friday as production if that is the delivery day | Buffer 0 **places ON Friday** if Friday is empty. When Friday is also full, walks to **Tuesday** with no double-book | Test K two cases | `placeBackwardStage` latest-fit |
| L | **PASS** | Impossible date → not silently valid; suggest earliest | `requestedDateFeasible=false`, `usedBackward=false`, `earliestCompletion` after request | Test L | fallback to `scheduleOrderForward` |
| M | **PARTIAL** | No date → true forward, distinct from backward | `forwardSchedule.usedBackward=false`, starts Sunday. Calling `backwardSchedule` with no date **still reports `usedBackward=true`** (flag = `allFeasible`) while placing from Sunday | Test M | `backwardSchedule` ~456–458, ~500–501 |
| N | **PASS** | Qty 10 ≠ qty 1 unless FIXED | LINEAR 60 vs 600; FIXED 45 ignores qty; planner windows scale | Test N | `calculateDurationMinutes` |
| O | **PASS** | 10h task, close 16:00 → not 08:00–18:00 | Sun 08:00 → Mon 10:00 | Test O | `WorkingCalendar.addWorkingMinutes` |
| P | **PASS** | Closed day unused; backward skips it | Holiday Sun → start Mon; shutdown Tue unused in backward window | Test P | `intervalsForLocalDay` empty for HOLIDAY/SHUTDOWN |
| Q | **PARTIAL** | Materials unavailable until Wed → no Monday start | **Domain:** `materialReadyAt=Wed` delays start; insufficient stock without `readyAt` → risk. **Service:** generate/availability `orderInput` omits `materialReadyAt` | Domain Q + wiring source check | planner ~167–171 vs `scheduling.service.ts` ~589–596, ~961–970 |
| R | **PARTIAL** | Missing WIP → downstream not ready; replan after WIP | **Domain:** order-level `productionReadyAt` delays all stages. **No per-stage WIP input.** **Service:** `assessWipReadiness` sets risk after plan, does not pass `productionReadyAt` | Test R + wiring | `assessWipReadiness` ~744–776 |
| S | **PARTIAL** | Deactivate → capacity down; no new alloc to inactive | Next plan uses only active. Deactivate **does not** itself replan. Existing future allocations stay until generate | Test S + `loadWorkers` `isActive: true` | `isEligible`; `loadWorkers` |
| T | **PARTIAL** | New skilled worker increases capacity with no capacity number | Next plan: 2 vs 4 Sunday tasks. Add-user does not auto-replan (calendar edits do via `replanActiveSchedules`) | Test T | `loadWorkers` on next generate |
| U | **PASS** | 50-mix: skill distribution, no overlap, deps, bottleneck ≠ headcount | 10/8/6/12/8/6 mix; `oth-*` unused; C→U→A order; no overlap | Test U | full planner |
| V | **PASS** | Shared Sep-style date cannot be given to everyone | Sequential 5+8+3 on 2 workers, same window: mix of feasible and infeasible | Test V | sequential occupancy = runtime generate |
| W | **PARTIAL** | Document real tie-break | Batch: pinned → URGENT → dealer interleave. **Runtime generate is one PO**, so first-generated occupancy wins; fairness unused | Test W | `sortWithFairness`; `generateForProductionOrder` passes `[orderInput]` |
| X | **PARTIAL** | Manual slot occupied for next order | Next forward starts after reserved 08–12. `patchAllocation` does not validate other orders | Test X | `loadOccupancy` vs `patchAllocation` ~1403 |
| Y | **FAIL** | Late stage → detect risk, replan downstream, At Risk, new date | **If re-invoked** with pinned late end, assembly moves. **Automatic:** `onTaskLifecycle('complete')` only `queue.enqueue('REPLAN')`; worker no-ops; no schedule create | Test Y + wiring | `scheduling-queue.ts`; `apps/worker/src/main.ts` ~58–62 |
| Z | **PASS** | Combined: future date, fork/merge, partial occupancy, materials “available” | Backward places fork-merge; upholstery after both; no overlap; feasibility boolean returned | Test Z | `backwardSchedule` + occupancy |

**Totals: 16 PASS · 9 PARTIAL · 1 FAIL · 0 BLOCKED**

PASS: A B D E F G H I J L N O P U V Z  
PARTIAL: C K M Q R S T W X  
FAIL: Y

---

## Failures / partials (no engine fix in this phase)

### C — department fallback (severity: high)

- **EXPECTED:** Zero Carpentry skills → cannot invent Carpentry capacity from 50 other people.
- **ACTUAL:** `resourceType: DEPARTMENT`, all three 4h jobs on Sunday morning.
- **ROOT CAUSE:** Empty `listEligibleWorkers` still places calendar time without occupancy.
- **FILES:** `domain/schedule-planner.ts` ~89–107, ~300–314
- **FIX (later):** Refuse / NEEDS_REVIEW when a required stage has no eligible active worker.

### K — delivery day is a production day at buffer 0 (severity: medium)

- **EXPECTED:** Complete safely **before** Friday delivery; Wed/Thu full → earlier.
- **ACTUAL:** Friday 08:00–16:00 is used if free. Walking-earlier works only once Friday is also full. Generate buffer is 10% of total minutes, not a calendar-day shipping buffer.
- **FILES:** `schedule-planner.ts` `placeBackwardStage`; `scheduling.service.ts` `bufferMinutes`
- **FIX (later):** Target previous working day (or explicit ship-buffer), not requested clock time.

### M — `usedBackward` flag (severity: low)

- **EXPECTED:** No date → `usedBackward=false`.
- **ACTUAL:** Placement is forward; flag is true because it tracks `allFeasible`.
- **FILES:** `schedule-planner.ts` ~453, ~500–501
- **FIX (later):** Set `usedBackward` only when `scheduleOrderBackward` succeeded.

### Q / R — readiness not a planning constraint at generate (severity: high)

- **EXPECTED:** Material/WIP dates move `notBefore`.
- **ACTUAL:** Planner supports it; service assesses after persist (status/risk only). No inventory `readyAt`. WIP not per stage.
- **FILES:** `scheduling.service.ts` ~707–776, ~961–984
- **FIX (later):** Pass `materialReadyAt` / `productionReadyAt` into `PlannerOrderInput`; thread known replenishment dates.

### S / T — capacity changes need an explicit generate (severity: medium)

- **EXPECTED:** Add/deactivate skilled worker changes factory capacity without a manual capacity number (true) **and** the live board updates (only if something replans).
- **ACTUAL:** Next `generate`/`recalculate` is correct. User activate/deactivate does not call `replanActiveSchedules` (calendar save does).
- **FILES:** `loadWorkers`; `users.controller.ts` activate; `replanActiveSchedules`
- **FIX (later):** Replan active schedules on worker skill/active changes.

### W — fairness vs first-come (severity: medium)

- **EXPECTED:** Priority/date order across the factory.
- **ACTUAL:** Sort exists but generate plans one PO against leftover occupancy.
- **FILES:** `priority-fairness.ts`; `generateForProductionOrder`
- **FIX (later):** Optional factory-wide replan batch using `sortWithFairness`.

### X — manual patch vs other orders (severity: medium)

- **EXPECTED:** Manual reserve blocks everyone immediately.
- **ACTUAL:** Next generate respects occupancy if the schedule is APPROVED/PROPOSED. Patch validator is intra-order.
- **FILES:** `patchAllocation`; `loadOccupancy`
- **FIX (later):** Validate patch against factory occupancy.

### Y — late complete does not replan (severity: high)

- **EXPECTED:** Downstream shift, At Risk, new suggested date.
- **ACTUAL:** Queue job logged only. Pinned in-progress windows are preserved **when** generate runs.
- **FILES:** `onTaskLifecycle`; `scheduling-queue.ts`; `apps/worker/src/main.ts`
- **FIX (later):** Run `generateForProductionOrder` (future work only) on complete/late, map promise `AT_RISK` if past committed date.

---

## Audit questions

1. Finite-capacity? **PARTIAL** — yes per employee; no for DEPARTMENT fallback.
2. Capacity worker-based? **PARTIAL** — planner yes; `listCapacity` UI no.
3. WorkerSkill affect scheduling? **YES**
4. Total active count? **No, correctly not** for the planner. UI bars **do** use department headcount. Zero skilled workers incorrectly still schedule.
5. Add skilled worker increases capacity automatically? **PARTIAL** — on next generate, no capacity number; no auto-replan on hire.
6. Deactivate reduces capacity? **PARTIAL** — on next generate; leftover allocations until then.
7. Double-booking prevented? **YES** for named employees in the planner. **NO** for department-only rows / manual task assign.
8. Parallel branches concurrent when resources allow? **YES**
9. Same worker serializes parallel branches? **YES**
10. Requested delivery truly BACKWARD? **PARTIAL** — yes, from requested instant − buffer, with forward fallback; may occupy the delivery day.
11. Earliest-available truly FORWARD? **PARTIAL** — `forwardSchedule` yes; `backwardSchedule` without a date still places forward but flags `usedBackward=true`.
12. Existing orders considered? **YES** (`loadOccupancy` APPROVED/PROPOSED)
13. Working hours? **YES**
14. Closed days? **YES**
15. Quantity scales capacity? **YES** (and FIXED can opt out)
16. Material readiness affects start? **PARTIAL** (domain yes, generate no)
17. WIP affects downstream? **PARTIAL** (order-level domain only; generate no)
18. Delayed production triggers risk/replan? **FAIL** auto-replan; risk mostly material/blocker
19. Bottleneck model? **Worker-skill occupancy, hybrid with department fallback and department-headcount UI**
20. Major differences vs intended factory? Department unlimited fallback; generate ignores material/WIP dates; one-order generate; late replan no-op; capacity dashboard ≠ skills; `requestedDateFeasible` not persisted; deliveries module disconnected.

---

## FINAL VERDICT

**B — PARTIALLY MATCHES**

The domain engine **is** worker-skill finite-capacity, dependency-aware, parallel-aware, and has real backward and forward modes. It is **not** a global headcount scheduler.

It does **not** fully match the intended factory because:

1. No eligible worker still books unlimited DEPARTMENT time
2. Material/WIP readiness is not a generate `notBefore`
3. Late/complete does not replan
4. Runtime plans one order at a time (fairness unused)
5. UI capacity is department headcount
6. Delivery-day occupancy / misleading `usedBackward` / non-persisted feasibility

### Recommended next implementation phase (do not implement here)

1. Fail closed when a required stage has zero eligible active workers (remove silent DEPARTMENT infinite capacity).
2. Pass `materialReadyAt` / WIP `productionReadyAt` into `PlannerOrderInput` on generate and availability.
3. Execute replan on task complete/late (sync if no Redis) and set promise At Risk when past committed date.
4. Replan active schedules when a production worker is activated, deactivated, or skills change.
5. Optionally: factory-wide batch replan with fairness; persist `requestedDateFeasible`; validate patches against all occupancy; stop using headcount in `listCapacity` (skill-eligible hours instead).
