# Capacity utilization and pull-forward audit (with materials)

**As of:** T0 `2026-08-16` 14:00 Asia/Amman (`2026-08-16T11:00:00.000Z`) · DEV DB `maher_erp` after one `pnpm demo:reset`. No Sync, generate, GRN, calendar, or seed writes after T0.

Evidence: in-memory domain sim [`apps/api/src/modules/scheduling/domain/pull-forward-sim.ts`](../apps/api/src/modules/scheduling/domain/pull-forward-sim.ts) + read-only [`scripts/scheduling-capacity-pull-forward-audit.mjs`](../scripts/scheduling-capacity-pull-forward-audit.mjs) (`pnpm smoke:scheduling-pull-forward-audit`). JSON: `tmp-scheduling-pull-forward-audit.json`. Jest is not treated as PASS for the live scoreboard.

Horizon: next **30 factory working days** (Sun–Thu + Sat; Friday closed unless overtime). 21 production workers. 45 incomplete production orders simulated.

---

## Capacity scoreboard

| Question | Answer |
|---|---|
| Current objective | **B** — pack as late as safely possible before requested/committed. Mixed **A** only when seed used `forwardSchedule` for in-progress remaining stages. **Not** utilization maximization. |
| Empty / `<25%` days in 30 working-day window | **15 EMPTY**, **30 / 30 `<25%`** occupancy. Mean occupancy util **2.03%**. |
| Front 10 working days | CURRENT **4.98%** occupancy · EARLIEST **16.71%** · N-day-10 **15.68%**. |
| Idle hours that occupancy + skills + materials would allow later unpinned work to occupy | **Yes, on 16–20 Aug.** Tagged `CAPACITY_POLICY` (5 days). Pull-forward raises 16 Aug from **14.8% → 26.7%** occupancy. |
| Remaining idle after earliest legal packing | **Yes.** 21 workers × ~7h ≫ remaining unpinned minutes. After EARLIEST, 25 of 30 days are empty — **NO_ORDERS** (not enough ready work), not a hidden worker lock. |
| 100% a good target? | **No.** Peak simulated occupancy in the window is **67.1%** (17 Aug under EARLIEST). Never hits 80%. |
| Architecture | Keep Sync as **repair**. Capacity smoothing should be a **separate Admin action**. Automatic pull-forward must refuse material-illegal earlier slots. |

### 16 Aug 2026 (Sunday) — factory open, not overtime

| Metric | CURRENT | EARLIEST | N-day 10 |
|---|---|---|---|
| Occupancy available minutes | 8820 (21 × 420) | same | same |
| Occupancy allocated | 1308 (**14.8%**) | 2359 (**26.7%**) | **26.7%** |
| Stage-bucket util (inflated available) | **13.0%** | — | — |
| Distinct POs on this day | 33 | higher concentration | — |
| Inspection stage-bucket | **51%** (tightest stage that day) | — | — |
| Cause of low load | **CAPACITY_POLICY** | — | — |

Stage-bucket `available` counts every skilled head per stage (multi-skill inflation). Occupancy is employee-keyed and is the honest factory-wide load. Inspection at 51% while occupancy is 15% is stage imbalance, not “the factory is half full.”

### Policy comparison (30 working days from T0)

| | CURRENT (A) | EARLIEST (B) | N-day 5 | N-day 10 | N-day 20 |
|---|---|---|---|---|---|
| Mean occupancy util % | 2.03 | 5.57 | 5.57 | 5.57 | 5.57 |
| Front-10 mean occupancy % | 4.98 | 16.71 | — | 15.68 | — |
| Empty days | 15 | 25 | 15 | 20 | 25 |
| Days `<25%` | 30 | 27 | 29 | 27 | 27 |
| Days `>85%` | 0 | 0 | 0 | 0 | 0 |
| Orders finished earlier vs T0 | 0 | **23** | 17 | 23 | 23 |
| Mean / max days early | 0 / 0 | **6.3 / 21** | — | 4.78 / 13 | — |
| Material violations | 0 | **0** | 0 | **0** | 0 |

EARLIEST **increases empty days** in the 30-day window because it piles legal work into 16–20 Aug and leaves the rest of the horizon empty. That is not a contradiction: the wasted idle is **at the front**, which EARLIEST partially fills. Trailing empty days are **NO_ORDERS**.

N-day 10 is the only policy that both fills the front **and** keeps some work near due dates (max early 13 days vs 21).

### Per-day CURRENT vs EARLIEST (first 10 working days)

| Day | CURRENT occ % | EARLIEST occ % | N10 occ % | Bucket | Cause |
|---|---|---|---|---|---|
| 2026-08-16 Sun | 14.8 | 26.7 | 26.7 | LT_25 | CAPACITY_POLICY |
| 2026-08-17 Mon | 19.0 | **67.1** | 59.7 | LT_25 | CAPACITY_POLICY |
| 2026-08-18 Tue | 9.5 | 50.6 | 25.2 | LT_25 | CAPACITY_POLICY |
| 2026-08-19 Wed | 3.1 | 19.9 | 8.3 | LT_25 | CAPACITY_POLICY |
| 2026-08-20 Thu | 1.0 | 2.8 | 5.8 | LT_25 | CAPACITY_POLICY |
| 2026-08-22 Sat | 0 | 0 | 0 | EMPTY | NO_ORDERS |
| 2026-08-23 Sun | 1.3 | 0 | 10.7 | LT_25 | NO_ORDERS |
| 2026-08-24 Mon | 0.4 | 0 | 16.0 | LT_25 | NO_ORDERS |
| 2026-08-25 Tue | 0.6 | 0 | — | LT_25 | NO_ORDERS |
| 2026-08-26 Wed | 0 | 0 | — | EMPTY | NO_ORDERS |

Saturday 22 Aug is an **open** factory day (working weekdays include 6). It is empty under every policy — not closed, not a material ETA, **no remaining eligible work** after the small order pool is placed.

---

## Why the plant looks idle (policy, not a bug in occupancy math)

Live generate chooses backward whenever a promise date exists:

```1503:1527:apps/api/src/modules/scheduling/scheduling.service.ts
    const promiseDate = po.committedDeliveryDate ?? po.requiredDeliveryDate;
    const latestCompletionTarget = promiseDate
      ? calendar.latestProductionCompletion(promiseDate, calendarRow.deliveryBufferWorkingDays ?? 1)
      : null;
    const useBackward = opts?.mode ? opts.mode === 'backward' : Boolean(promiseDate);
```

[`placeBackwardStage`](../apps/api/src/modules/scheduling/domain/schedule-planner.ts) packs as late as possible before that ceiling (delivery-day buffer = 1 working day). [`selectIncreaseUrgency`](../apps/api/src/modules/scheduling/domain/factory-replan.ts) **skips healthy backward ON_TRACK**. Sync is repair-only and will not pack those idle days.

Father-demo **seed** uses the same planner ([`chronology.ts`](../packages/database/prisma/demo/chronology.ts)): `at_risk_material` / `not_started` remaining work is `backwardSchedule` toward requested delivery. Seed does **not** persist `planningMode` (column defaults `FORWARD`) and does **not** persist `materialReadyAt`. Stored `planningMode` on T0 is therefore **not** a reliable signal. Cedar’s T0 windows sit on **3 Sep** against requested **4 Sep** — that is backward packing, regardless of the default enum.

Dealer requested/committed dates are commercial deadlines. `deliveryBufferWorkingDays` only reserves the delivery day. Nothing in schema forbids finishing weeks earlier. There is **no** finished-goods warehouse slot, holding cost, or max-early window.

---

## Materials ↔ scheduling (questions 1–9)

| # | Question | T0 / code answer |
|---|---|---|
| 1–2 | What / how much | Product `bomDefaults.materials[]` × PO qty via [`bomReservationNeeds`](../apps/api/src/common/helpers/inventory-reservation.util.ts). Cedar `SOF-RECL` needs `MAT-ITAL-VEL` **8 m** plus beech/foam/leatherette/mechanism. |
| 3 | Which stage consumes | **No SKU→stage map.** [`applyMaterialNotBefore`](../apps/api/src/modules/scheduling/domain/material-readiness.ts) stamps one date on every snapshot node with `consumesRawMaterials`. `ProductStageInventoryInput` is WIP consume, not raw SKU. **T0: 0 / 45** open orders have any consuming-raw flag. |
| 4 | When the stage starts | Latest active allocation `plannedStart`. |
| 5–6 | Stock / reserved | `available` in generate is **free** (`onHand − reserved`). **T0 `reservedQty = 0` on every timeline SKU.** No per-order reservation ledger. Own reservation is credited only if SO status ≠ `WAITING_FOR_MATERIALS`. |
| 7–8 | Incoming qty / ETA | Open PO `APPROVED` / `SENT` / `PARTIALLY_RECEIVED`; remaining = ordered − GRN; `readyAt` = **header** `expectedDeliveryDate`. Velvet inbound `PORD-2026-00019` **24 m**, ETA **2026-08-18 10:00** Asia/Amman. |
| 9 | Earliest material-ready | Single order-level `materialReadyAt` = max covering date. Cedar **live** readyAt **2026-08-18**. Stored schedule `materialReadyAt` is **null** (seed never wrote it). Shortage with no dated incoming → `MATERIAL_NOT_READY` + null date. |

**MATERIAL READINESS GRANULARITY: ORDER-WIDE** on this T0 dataset.

Code support is **PARTIAL**: boolean `consumesRawMaterials` can make the floor stage-specific, but demo snapshots do not set it (only `SOF-3S-STD` MATERIAL_PREP is seeded that way, and it is not in the open pool). The sofa example “carpentry 10 Sep / wait for fabric / upholstery 20 Sep” is **not** supported today. Inventing velvet→upholstery would be a new product/BOM feature.

Strongest honest invariant:

- If any `consumesRawMaterials` stages exist: those stages’ start ≥ order `materialReadyAt`; other stages may start earlier only if workflow/WIP allows.
- If none exist (Cedar, and every other T0 open PO): planner `order.materialReadyAt` floors the **entire order**. Carpentry cannot legally start before velvet.

---

## Cedar Italian velvet (`SO-2026-00056` / `PO-2026-00056`)

Do not change this story. Traced read-only.

| Field | T0 value |
|---|---|
| Dealer requested | **2026-09-04** 08:00 Asia/Amman (`2026-09-04T05:00:00.000Z`) |
| Committed | **none** (unconfirmed) |
| SO / PO status | `WAITING_FOR_MATERIALS` |
| Schedule | v1 `NEEDS_REVIEW`, `materialRisk=true`, `unschedulableReason=MATERIAL_NOT_READY`, stored `materialReadyAt=null` |
| May-be-late class | **BLOCKED** (material + NEEDS_REVIEW). Walkthrough: material at-risk. |
| Workflow | STANDARD_FURNITURE: MATERIAL_PREP → CARPENTRY / PAINTING → FOAM → UPHOLSTERY → ASSEMBLY → INSPECTION → PACKAGING → DELIVERY. **`consumesRawMaterials` false on every snapshot node.** |
| Italian velvet | `MAT-ITAL-VEL` on hand **0**, reserved **0**, inbound **24 m** `PORD-2026-00019` ETA **18 Aug 10:00** Amman |
| Live `materialReadyAt` | **2026-08-18T07:00:00.000Z** |
| T0 production windows | All stages packed **3 Sep ~13:06–15:44** Amman (backward against 4 Sep) |

### Could any Cedar stage happen before velvet arrives?

**No.** Order-wide floor. `stagesBeforeVelvet = []`.

### Could upholstery?

**No.** Same floor, and it also depends on carpentry/foam.

### Earliest legal completion (in-memory EARLIEST, materials rechecked)

Starts **18 Aug 10:00** (ETA), finishes **19 Aug 15:30** Amman. Upholstery **18 Aug 15:51 → 19 Aug 10:20**. All stage starts ≥ material ready. Joint sim legal.

### Which idle days can Cedar consume?

| Day | Factory idle cause | Cedar |
|---|---|---|
| 16 Aug | CAPACITY_POLICY (other work could move here) | **Cannot.** Velvet not ready. |
| 17 Aug | CAPACITY_POLICY | **Cannot.** |
| 18 Aug | CAPACITY_POLICY | **Yes, from 10:00 Amman** (all stages, order-wide). Morning before ETA is still blocked. |
| 19 Aug | CAPACITY_POLICY | **Yes** (tail: upholstery → delivery). |

Idle capacity on 16–17 Aug is genuinely unusable **for Cedar**. Other unpinned dated orders *can* use those days (11 POs are `MOVABLE_EARLIER`, e.g. `PO-2026-00003` 23 Aug → 16 Aug). That is why 16 Aug is `CAPACITY_POLICY` even though Cedar cannot take it.

---

## Reservations, scarce fabric, purchasing

**Reservations:** generate subtracts `reservedQty` and credits this SO when it is not `WAITING_FOR_MATERIALS`. Domain test: 70 m need vs 30 free + 70 reserved → ready. Live T0: **every tracked SKU has reservedQty 0**. Waiting Cedar was never reserved. Confirmed/in-progress work has already been issued or was never reserved. Two generates against the same free pool **can both look ready** until someone reserves. Score: **PARTIAL**.

**Scarce priority:** [`retryWaitingMaterialOrders`](../apps/api/src/modules/inventory/inventory.service.ts) iterates `WAITING_FOR_MATERIALS` with **no** late-committed sort. First row in query order wins fabric on GRN. Pull-forward sim reuses factory urgency (late committed → at-risk committed → other committed → HIGH → requested → ready) and consumes unreserved demand so 70 m + 60 m vs 100 m free cannot both place (domain test). There is **no second allocator**. Score: **PARTIAL** — sim is safe; live GRN retry is not urgency-ordered; T0 has no reserved contention.

**Purchasing ↔ schedule demand:** Purchasing has no MRP, no shortage board, no affected-PO/stage/commitment view. [`PurchaseRequest.requiredDate`](../packages/database/prisma/schema.prisma) on T0 **equals PO `expectedDeliveryDate`** (23/23), i.e. supplier ETA copied at seed, **not** consuming-stage start. Auto-reorder is stock-level.

**MATERIAL REQUIRED-BY DATE EXISTS: NO**

SOURCE: none canonical. Closest dates: `materialReadyAt` (when supply covers, not when the stage needs it); dealer requested/committed; `PurchaseRequest.requiredDate` (= PO ETA); audit-derived min(`plannedStart`) of consuming orders (velvet’s derived required-by is T0 carpentry on **3 Sep**, which is the backward pack, **not** a purchasing contract).

**PO ETA change:** `expectedDeliveryDate` is set on **create** only. Mobile purchase detail is display-only. No PATCH, no targeted REPLAN, no automatic May-be-late refresh. Delay 15 Sep → 22 Sep would **not** propagate until someone regenerates. Improvement 22 Sep → 12 Sep would **not** pull work into idle days automatically; even a live generate of a dated order is **backward** toward the dealer date.

**Material arrival path (code, not executed):** GRN / `inventory.receive` → `retryWaitingMaterialOrders` → targeted `REPLAN` `{ event: 'material-arrival' }`. That **does** exist. For a dated order it still calls generate with backward packing, so newly ready Cedar would land near **3 Sep**, not consume **16–17 Aug** idle. Arrival unlocks *schedulability*, not *early idle fill*.

**Pull-forward vs Purchasing (user preference):** refuse the earlier slot if materials are not ready. Do not create an impossible plan. The simulator does this. Live Sync/generate do not pull healthy ON_TRACK work at all.

---

## 30-day material demand (scarce / inbound)

| Material | On hand | Reserved | Incoming | ETA | Next required-by (derived) | Demand | Shortage | Risk |
|---|---|---|---|---|---|---|---|---|
| MAT-ITAL-VEL | 0 | 0 | 24 | 18 Aug | 3 Sep (T0 pack) / 18 Aug (earliest legal) | 8 (Cedar) | 0 | SAFE vs 18 Aug ETA |
| MAT-VEL-NAVY | 122 | 0 | 0 | — | 15 Aug (historical overlap) | 136 across 7 POs | 14 | SHORTAGE vs aggregate BOM; each order assessed independently at generate |
| MAT-DACRON | 250 | 0 | 40 | 25 Aug | none | 0 | 0 | SAFE |
| MAT-TEAK | 80 | 0 | 12 | 25 Aug | none | 0 | 0 | SAFE |

Navy aggregate 136 > 122 is **not** modeled as a factory-wide allocator. Generate looks at **this order’s** need vs current free. That is why EARLIEST still placed 45/45 orders. Honest gap: no multi-order scarce-SKU plan besides sequential consume in this audit sim.

---

## Material scoreboard (§40)

MATERIAL READINESS CONNECTED TO SCHEDULING: **PARTIAL**

READINESS IS STAGE-SPECIFIC: **NO** (T0) / mechanism **PARTIAL** in code

RESERVATIONS PREVENT DOUBLE-CONSUMPTION: **PARTIAL**

INCOMING PO ETA AFFECTS SCHEDULING: **PARTIAL**

MATERIAL ARRIVAL TRIGGERS REPLAN: **YES**

SCHEDULE PULL-FORWARD RECHECKS MATERIALS: **YES** (simulator) / **NO** (live Sync does not pull healthy ON_TRACK; live generate rechecks if invoked)

MATERIAL REQUIRED-BY DATE EXISTS: **NO**

SOURCE: none canonical

PURCHASING KNOWS SCHEDULE REQUIRED-BY: **NO**

PO ETA DELAY PROPAGATES TO SCHEDULING: **NO**

PO ETA IMPROVEMENT CAN PULL WORK FORWARD: **PARTIAL** (incoming `readyAt` would change on generate; dated orders still pack late; no ETA event)

SCARCE MATERIAL PRIORITY IS SAFE: **PARTIAL**

CEDAR STORY RECONCILES: **YES**

CAPACITY + MATERIAL JOINT SIMULATION: **PASS** (0 material violations under EARLIEST and N-day 10)

---

## Exact remaining gaps

1. **Backward objective vs idle plant.** Dated work is packed near requested/committed. Front-10 occupancy is 5%. Filling idle days is a new product decision, not a Sync bug.
2. **No SKU→stage BOM.** T0 snapshots have zero `consumesRawMaterials`. Cedar carpentry cannot legally precede velvet. Stage-specific sofa flow would need new product data.
3. **No canonical material required-by** and **Purchasing does not see schedule demand.**
4. **No PO ETA PATCH / event.** Delay or improvement does not mark schedules stale or replan.
5. **Material-arrival REPLAN exists but still backward-packs** dated orders, so arrival does not consume early idle capacity.
6. **No per-order reservation ledger.** T0 reservedQty is 0. GRN retry is not urgency-sorted. Aggregate navy demand can exceed stock while each PO still looks ready.
7. **Stored `planningMode` / `materialReadyAt` on demo schedules are incomplete** (defaults / unset). Do not trust those columns without live generate.
8. **Finished-goods storage / max-early window do not exist.** If the business does not want 21-day-early completion, that constraint is not in the repo.
9. **Sync must stay repair-only.** Stuffing smoothing into Sync would replan healthy backward ON_TRACK orders.

Architecture recommendation (not implemented): a **separate Admin capacity-smoothing action** that reuses occupancy + `applyMaterialNotBefore` + WIP, refuses material-illegal earlier slots, and optionally applies an N-day max-early window (10 working days is the least-aggressive fill that still moves the front of the calendar). Purchasing risk/opportunity views are a separate follow-up.

---

## How to reproduce

```bash
pnpm demo:reset
pnpm smoke:scheduling-pull-forward-audit
pnpm --filter @maher/api exec jest -- src/modules/scheduling/domain/__tests__/pull-forward-sim.test.ts
```

Do not press Sync, receive inventory, or change the Cedar row. The audit is a T0 snapshot plus in-memory counterfactuals.
