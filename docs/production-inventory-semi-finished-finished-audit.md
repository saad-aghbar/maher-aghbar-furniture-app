# Production ↔ inventory: RAW → SEMI/WIP → FIN → delivery — full audit

**Date:** 2026-08-24 (Asia/Amman)  
**Scope:** Read-only. No code, DB, demo, inventory, PO, scheduling, WIP, QC, or delivery mutations.  
**DB:** `maher_erp` (live Prisma read)  
**Evidence:** Prisma schema + API/services + Mobile/Admin UI + permissions + father-demo walkthrough + live spot-checks  

**Related (do not treat as current truth alone):**  
[`inventory-production-gap-audit.md`](./inventory-production-gap-audit.md), [`inventory-qr-identity-closure-report.md`](./inventory-qr-identity-closure-report.md), [`father-demo-walkthrough.md`](./father-demo-walkthrough.md)

**Closures after implementation (2026-08-24):**  
[`production-inventory-semi-closure-report.md`](./production-inventory-semi-closure-report.md), [`production-inventory-finished-closure-report.md`](./production-inventory-finished-closure-report.md), [`production-material-usage-closure-report.md`](./production-material-usage-closure-report.md), [`production-inventory-full-lifecycle-uat.md`](./production-inventory-full-lifecycle-uat.md). Historical FAIL rows below are preserved as the audit snapshot; use closures + `pnpm smoke:production-inventory-lifecycle-uat` for current gate status.

---

## Executive verdict

The **code architecture** for order-scoped SEMI lots, QC-gated FIN posting, delivery leave-on-`DELIVERED`, and BOM auto-consume on stage complete is largely **implemented**.

The **live demo database** does **not** honestly exercise that architecture for FIN/SEMI:

| Live fact | Value |
|---|---|
| `InventoryLot` FINISHED_GOOD (any status) | **0** |
| `InventoryLot` SEMI_FINISHED_GOOD (any status) | **0** |
| Tx types `FINISHED_GOODS_RECEIPT` / `DELIVERY_ISSUE` / `SEMI_FINISHED_*` | **0** |
| Balqis `SO-2026-00019` | `READY_FOR_DELIVERY`, QC `PASSED`, delivery `PLANNED` — **no FIN lots** |
| Balqis workflow snapshot | **Every** node `inventoryTracking = NONE` (including PACKAGING) |
| Diwan wingback | Schedule `WIP_NOT_READY` — **no SEMI lots** |
| Cedar velvet | `availableQty=0`, `reservedQty=0`, SO `WAITING_FOR_MATERIALS` |

So: **status/pipeline can say “ready for delivery” without finished-goods inventory existing.** That is the central honesty gap.

---

## 1. Domain architecture (current)

### Canonical models

| Concept | Model / enum | Notes |
|---|---|---|
| SKU master | `InventoryItem` (`itemClass`) | `RAW_MATERIAL` \| `SEMI_FINISHED_GOOD` \| `FINISHED_GOOD` |
| On-hand | `InventoryBalance` | per item × warehouse × location; `availableQty` + `reservedQty` |
| Ledger | `InventoryTransaction` | **Not** named `InventoryMovement` |
| WIP/FG identity | `InventoryLot` | optional `productionOrderId`, `salesOrderId`, `stageInstanceId`, `sourceKey` |
| Warehouses | `WarehouseType` | `RAW_MATERIALS` / `SEMI_FINISHED` / `FINISHED_GOODS` (seed codes `RAW` / `SEMI` / `FIN`) |
| Stage inventory behavior | Snapshot node flags | `inventoryTracking`, `consumesRawMaterials`, `consumesSemiFinished`, `requiresInspection` |
| Catalog recipe | `ProductStageInventoryOutput` / `Input` | produce/consume definitions (e.g. SOF-3S-STD) |

**ACCESSORY** is **not** an `itemClass`. Accessories are `RAW_MATERIAL` + `RawMaterialGroup.ACCESSORIES`.

### Orchestrator

[`ProductionInventoryService`](../apps/api/src/modules/production/production-inventory.service.ts) — consume/produce/return/reverse.  
[`InventoryService.applyMovement`](../apps/api/src/modules/inventory/inventory.service.ts) — single ledger writer.  
[`TasksService.complete`](../apps/api/src/modules/tasks/tasks.service.ts) → pipeline → `onStageTaskComplete`.  
[`QualityController.submit`](../apps/api/src/modules/quality/quality.controller.ts) → pass/fail → FIN catch-up / reverse.  
[`DeliveriesController`](../apps/api/src/modules/deliveries/deliveries.controller.ts) → `DELIVERED` → `issueForDelivery`.

---

## 2. Inventory types

### RAW_MATERIAL

| | |
|---|---|
| **MODEL** | `InventoryItem` + `InventoryBalance` (+ optional txs) |
| **REPRESENTS** | Purchased inputs (wood, fabric, foam, accessories, packaging supplies) |
| **CREATED** | Manual create / sync-from-materials / demo seed; `qrCode` defaults to sku |
| **QTY ↑** | `PURCHASE_RECEIPT` (GRN or manual receive), `PRODUCTION_RETURN`, `OPENING_BALANCE`, transfer-in |
| **QTY ↓** | `PRODUCTION_ISSUE` (BOM consume or manual issue), transfer-out, adjust/count, damage/scrap (rare for raw) |
| **WAREHOUSE** | `RAW_MATERIALS` |
| **SEE** | `inventory.read` |
| **MUTATE** | receive/issue/transfer/count/adjust per permission; production consume is server-side on task complete |

### SEMI_FINISHED_GOOD

| | |
|---|---|
| **MODEL** | `InventoryLot` (truth for WIP) + balance side-effect |
| **REPRESENTS** | Stage output intermediate (e.g. “sofa frame”) for a **production order** |
| **CREATED** | `produceOutput` on stage complete when `PRODUCES_SEMI_FINISHED` |
| **QTY ↑** | `SEMI_FINISHED_RECEIPT` |
| **QTY ↓** | `SEMI_FINISHED_ISSUE` (downstream stage consume, **this PO only**) |
| **WAREHOUSE** | `SEMI_FINISHED` |
| **ORDER-SPECIFIC** | **YES** — consume/gates filter `productionOrderId` |
| **SEE** | `GET /inventory/semi-finished` (lot rows) |
| **MUTATE** | Production produce/consume; generic Receive/Issue on SEMI tab is **misleading** vs lot semantics |

### FINISHED_GOOD

| | |
|---|---|
| **MODEL** | `InventoryLot` + balance; SO-linked → `ORDER_ALLOCATED` / often `RESERVED` |
| **REPRESENTS** | Completed FG units for a PO/SO (when posting path runs) |
| **CREATED** | `FINISHED_GOODS_RECEIPT` via `PRODUCES_FINISHED` stage complete (QC gate) and/or `onInspectionPassed` catch-up |
| **QTY ↑** | FG receipt |
| **QTY ↓** | `DELIVERY_ISSUE` on delivery **DELIVERED**; `PRODUCTION_ISSUE` via `reverseFinishedGoods` on QC fail |
| **WAREHOUSE** | `FINISHED_GOODS` |
| **SEE** | Finished lifecycle (often balance-oriented UI) + lots |
| **MUTATE** | Production/QC/delivery paths; generic Receive on FIN is **misleading** |

---

## 3. RAW material lifecycle (Italian velvet / Cedar)

### Steps that exist

| Step | UI | API | Service | DB | Inventory | Production | Scheduling |
|---|---|---|---|---|---|---|---|
| Purchase order | Admin purchasing | PO APIs | purchasing | `PurchaseOrder` | — | — | — |
| GRN / receive | Inventory Receive (PO-aware) | receipts / receive | inventory + GRN | `GoodsReceipt` + `PURCHASE_RECEIPT` | RAW ↑ | — | material-arrival replan |
| On hand | Inventory RAW | balances | — | `InventoryBalance` | yes | — | readiness reads free stock |
| Reserve | SO confirm | internal | `tryReserveForSalesOrder` | `reservedQty` **pool** | reserved ↑ | waiter → READY | MATERIAL_NOT_READY |
| Requirement | PO materials / BOM | — | `bomReservationNeeds` | product `bomDefaults` | — | snapshot flags | — |
| Issue / consume | **Automatic** on stage complete | task complete | `consumeRawMaterials` | `PRODUCTION_ISSUE` | RAW ↓; reserved credit | stage done | replan |
| Return unused | PO Materials | `POST …/materials/return` | `returnUnusedMaterial` | `PRODUCTION_RETURN` | RAW ↑ free | activity rollup | — |
| Adjust / scrap | Count / return fate | adjust / SCRAP | inventory | ADJUSTMENT / SCRAP | varies | **not** production usage scrap | — |

### Live Cedar (`SO-2026-00056` / `PO-2026-00056`)

- SO/PO: `WAITING_FOR_MATERIALS`
- Schedule: `MATERIAL_NOT_READY` (superseded AT_RISK row present)
- `MAT-ITAL-VEL`: `availableQty=0`, `reservedQty=0`, `qrCode=MAT-ITAL-VEL`
- No production issue txs for this PO
- **Story PASS** for “raw waiting / no FIN”

---

## 4–7. SEMI-FINISHED meaning

### SEMI-FINISHED CANONICAL MODEL

`InventoryLot` where `inventoryItem.itemClass = SEMI_FINISHED_GOOD`, produced by a snapshot node with `inventoryTracking = PRODUCES_SEMI_FINISHED`, consumed by nodes with `consumesSemiFinished` against **the same `productionOrderId`**.

| Question | Answer |
|---|---|
| IS IT AN InventoryItem? | **YES** (SKU master for the intermediate) |
| QUANTITY-TRACKED? | **YES** (lot qty + balance) |
| WAREHOUSE-TRACKED? | **YES** (`SEMI_FINISHED`) |
| ORDER-SPECIFIC? | **YES** for produce/consume/gates |
| SKU-SPECIFIC? | **YES** |
| STAGE-SPECIFIC? | **PARTIAL** (`stageInstanceId` / output definition on lot) |

### Producer → consumer WIP

- Scheduling (`wip-readiness.ts`) and floor (`assertStageInventoryReady` / `consumeSemiFinished`) both read **this-PO AVAILABLE lots**.
- Cross-order WIP reuse: **NO** (by design).
- Quantity produced: **full** `outputQtyPerUnit × PO.quantity` on stage complete — **no partial produce**.
- **Live:** **0 SEMI lots** in DB. Diwan has **no** SEMI rows despite carpentry COMPLETED + `WIP_NOT_READY`.

### Physical reality vs system

**Desired:** “6 chair frames for PO-X sit in SEMI staging.”  
**Code can:** create that as a lot when produce flags fire.  
**Live demo:** usually only knows **task COMPLETED** + scheduling reason — **not** physical SEMI qty. Diwan = **FAIL** as inventory story; **PARTIAL** as scheduling story.

### SEMI screen

- Rows: lots from `listSemiFinished` (PO, stage, qty, warehouse, status).
- Generic Receive/Issue/Transfer/Count on the same Inventory chrome as RAW are **misleading** for WIP (order-scoped lot truth ≠ free SKU stock).
- Trustworthiness today: **low on demo** because lot table is empty while WIP narratives exist.

---

## 8–14. FINISHED GOODS, QC, packaging, delivery

### When does something become FINISHED?

**Code paths (either may post):**

1. Last incomplete task on a stage with `PRODUCES_FINISHED` completes → if `requiresInspection`, must already have QC pass → `FINISHED_GOODS_RECEIPT` + lot.  
2. QC submit PASS → `onInspectionPassed` posts FIN for completed FG stages waiting on QC.

**Demo seed convention:** PACKAGING often carries `PRODUCES_FINISHED`.  
**Live Balqis snapshot:** PACKAGING = `inventoryTracking NONE` → **no FG produce path on that PO**.

### Does FIN mean “passed QC/packaging and still inside the factory”?

| Layer | Answer |
|---|---|
| **Intended code semantics** | **PARTIAL YES** — QC gate + FG producer stage; lots stay until `DELIVERY_ISSUE` |
| **Live Balqis** | **NO** — READY_FOR_DELIVERY + QC PASSED + PLANNED truck, **zero FIN lots** |
| **System-wide live** | **NO** — zero FIN lots anywhere |

`READY_FOR_DELIVERY` is a **pipeline/status gate** (`rollupProgress`: FG stages complete + QC, or legacy packaging+inspection). It is **not** an inventory event.

### Packaging

- Normal workflow stage after INSPECTION in seed foundation.
- Inventory-related **only if** snapshot `PRODUCES_FINISHED` (or consume flags).
- Optional/skipped stages: skipped snapshot nodes do not produce.

### Delivery vs FIN leave

| Delivery status | Inventory effect |
|---|---|
| PLANNED / READY / OUT_FOR_DELIVERY | **None** |
| **DELIVERED** | `issueForDelivery` → `DELIVERY_ISSUE`; lots → `DELIVERED` |
| FAILED/CANCELLED after DELIVERED | `restoreForDelivery` exists but **unreachable** (`DELIVERED` has no outgoing transitions) |

**Recommendation (architecture, not implementing):** Removing stock at **truck departure (`OUT_FOR_DELIVERY`)** better matches “left the factory”; today’s code removes only at **customer DELIVERED**. Factory dwell while OUT_FOR_DELIVERY still counts as FIN on hand.

### FIN order identity

Lots store `productionOrderId` + `salesOrderId` (+ line). Delivery issues by **salesOrderId**. Custom hotel banquettes are **not** meant to become anonymous SKU stock — **when lots exist**.

### Waiting-for-truck query

**PARTIAL in code / FAIL on live demo:** can join READY_FOR_DELIVERY + PLANNED deliveries + FIN lots — but lots are empty, so “what is sitting in FIN?” returns nothing while status says ready.

### QC fail vs FIN

Code: fail → PO `ON_HOLD` + `reverseFinishedGoods` (idempotent `fg-reverse:{po}:{lot}`).  
Live Oasis club armchair: QC `FAILED_REWORK_REQUIRED`, PO `ON_HOLD`, **no FIN lots**, **no reverse txs** (nothing to reverse). Story **PARTIAL** (hold works; FG reversal unexercised).

### Invariant “FIN = approved physical product not yet left factory”

**Does not hold on live demo.** Status/delivery planning can advance without FG ledger.

---

## 15–18. Materials screen & planned vs actual

### Production Order Materials

| | |
|---|---|
| API | `GET /production-orders/:id/materials`, `POST …/materials/return` |
| Service | `listMaterialActivity` / `returnUnusedMaterial` |
| UI | Admin + Mobile materials card — **Return unused** (not “Use material” ledger) |
| Perms | `production-order.update` **or** `inventory.receive` |
| Worker | **Cannot** see/use (no those perms; mobile gates on `production-order.update`) |
| Movement | `PRODUCTION_RETURN` → RAW warehouse; caps at issued − returned |
| Reservation | **Does not** restore `reservedQty` |

“Use material” in scan UX = **SELECT identity**, not consumption.

### Planned vs actual matrix

| Concept | Exists? |
|---|---|
| BOM required | **YES** (`bomDefaults`) |
| Reserved | **YES** (pool `reservedQty`) |
| Issued | **YES** (`PRODUCTION_ISSUE` = BOM qty at stage complete) |
| Actually consumed (worker) | **NO** |
| Returned unused | **YES** (post-hoc) |
| Scrap / waste (production) | **NO** |
| Variance (expected vs actual) | **NO** |
| Cost variance from usage | **NO** (would need actual qty × cost) |

### `consumeRawMaterials`

- Trigger: stage’s **last** non-cancelled task completes; snapshot `consumesRawMaterials`.
- Qty: BOM × PO qty (not stage material inputs table).
- Idempotent: `raw-issue:{po}:{stage}:{itemId}` (+ early-out prefix check).
- No worker variance; under-stock throws.

---

## 19–23. Worker usage models & permissions

### Who records usage today?

| Actor | Role |
|---|---|
| Floor worker completing last stage task | Implicit **BOM issue** (system) |
| Production manager / warehouse receive | Return unused |
| Warehouse `inventory.issue` | Ad-hoc issue — **often no PO ref** → orphans materials UI |
| Nobody | Actual used / scrap / variance reason |

### Models

| Model | Fit |
|---|---|
| A Automatic BOM | **Current** |
| B Worker-only actual | Absent; unsafe with open `inventory.issue` |
| **C Hybrid** | **Recommended** — BOM prefill → confirm/adjust on task; reason over tolerance; production-scoped API |

### Worker permissions today

`PRODUCTION_WORKER`: task complete/update-own — **no** `inventory.read/issue/receive/adjust`.  
Safe future path: **task-scoped** material confirm permission/endpoint, not warehouse admin.

### QR for worker materials

Could reuse `scanCode` + `resolveInventoryScan` + stage snapshot material list to confirm “this SKU belongs on this task” before qty confirm — **not implemented**.

---

## 24–28. Return, unused, scrap, variance

### Return unused reconciles

- **Does:** increase RAW free stock; reduce “returnable” (issued − returned) for that PO+item.
- **Does not:** set “actual used”; restore reservation pool; record scrap; attach stage/task; support SEMI/FIN return.

So: Issued 10, return 1.5 ⇒ system still only knows issued 10 and returned 1.5 — **actual used is inferred as 8.5**, not an independent fact.

### Scrap / waste

`InventoryTxType.SCRAP` / `DAMAGE` exist for customer-return fate / FG — **not** production cutting waste with reason/stage/worker.

### Variance

No first-class expected vs actual consumption fields. Scheduling “variance” is time, not material.

---

## 29–36. Task completion, partials, rework, parallel, optional, QC

### Exact ordering on task complete (same DB transaction)

1. Close open time entries  
2. Photo docs if required  
3. Task → `COMPLETED` (100%)  
4. `StagePipelineService.onTaskComplete` (unlock stages, rollup %, maybe READY_FOR_DELIVERY)  
5. `ProductionInventoryService.onStageTaskComplete`:  
   - if remaining tasks on stage → **return**  
   - else: consume raw → consume SEMI → produce SEMI → produce FIN (QC gate)  
6. After tx: invoice ensure if PO COMPLETED; schedule notify/replan  

### Partial completion

- Tasks: progress exists, but stage inventory fires only when **all** stage tasks complete.  
- Produce qty: **full order qty** — no `producedQty` partial frames.  
- Consume SEMI: can take partial **lot** qty, but required total must be met for readiness.

### Rework materials

ReworkRequest exists; **no** automatic extra fabric/foam usage ledger for rework.

### Parallel workflows

Multiple consume needs / produce outputs can exist on different stages (catalog recipe). Distinct intermediate SKUs if configured.

### Optional/skipped

`isSkipped` snapshot nodes skip inventory actions.

### QC FAIL after FIN

Reverses AVAILABLE/RESERVED FIN lots for that PO. Live Oasis: held without prior FIN.

---

## 37–41. QC pass posting, FIN identity, screens, tabs

### QC PASS posting

Posts via `produceOutput` → FIN warehouse → reference `ProductionOrder` → lot with SO allocation when linked.

### Finished product QR

Raw SKU QR exists (`scanCode`). **No** separate PO/unit FIN QR identity today.

### FIN / SEMI screens

- SEMI: lot-centric (correct direction) but empty live + generic stock actions.  
- FIN: balance-oriented chrome + generic Receive — **misleading** if FIN is order lots awaiting truck.  
- Tabs Raw / Semi / Finished are conceptually right; **actions must diverge** by class.

---

## 42–45. Reporting, aging, scheduling, dealer

| Need | Today |
|---|---|
| Raw consumption | Tx history / item report — **PARTIAL** |
| WIP / FIN aging | **MISSING** |
| Material variance / scrap | **MISSING** |
| Scheduling hooks | Task complete, QC pass/fail, material arrival → replan — **IMPLEMENTED** |
| Dealer | Sees READY_FOR_DELIVERY / delivery dates — **not** RAW/SEMI/FIN warehouses — **PASS** dealer-safe |

---

## 46. Father-demo live spot-checks (read-only)

| Story | Live result | Score |
|---|---|---|
| **A Nile** `SO-2026-00001` DELIVERED | QC PASSED; raw `PRODUCTION_ISSUE`s; delivery DELIVERED; **no FIN lots, no DELIVERY_ISSUE txs** | **FAIL** as FIN→delivery inventory story; status path exists |
| **B Balqis** `SO-2026-00019` | READY_FOR_DELIVERY; QC PASSED; DLV PLANNED 2026-08-19; raw issues; **0 FIN lots**; snapshot all `NONE` | **FAIL** “finished sitting in factory” |
| **C Oasis** QC | PO ON_HOLD; FAILED_REWORK; **0 FIN / 0 reverse** | **PARTIAL** |
| **D Cedar** | WAITING_FOR_MATERIALS; velvet 0/0; MATERIAL_NOT_READY | **PASS** |
| **E Diwan** wingback | Carpentry COMPLETED; Foam READY; schedule WIP_NOT_READY; **0 SEMI lots** | **FAIL** as SEMI inventory; **PARTIAL** scheduling |

**Global:** SOF-3S-STD catalog **has** `PRODUCES_SEMI_FINISHED` + `PRODUCES_FINISHED` recipes, but demo POs like Balqis did not freeze those flags into snapshots — and **no lots were ever written**.

---

## 47. Domain state diagram (actual)

```text
RAW purchase/GRN ──IMPLEMENTED──► RAW balance
RAW balance ──IMPLEMENTED──► reservedQty pool (SO confirm)
Stage complete + consumesRawMaterials ──IMPLEMENTED──► PRODUCTION_ISSUE (BOM)
Stage complete + PRODUCES_SEMI ──IMPLEMENTED (code) / MISSING (live demo)──► SEMI lot
Downstream consumesSemiFinished ──IMPLEMENTED (code) / MISSING (live)──► SEMI_FINISHED_ISSUE
QC PASS + PRODUCES_FINISHED ──IMPLEMENTED (code) / MISSING (live)──► FIN lot
READY_FOR_DELIVERY status ──IMPLEMENTED──► (often WITHOUT FIN lot) ──MISLEADING
Delivery OUT_FOR_DELIVERY ──NO inventory──► still FIN on hand (if any)
Delivery DELIVERED ──IMPLEMENTED (code) / MISSING (live)──► DELIVERY_ISSUE
QC FAIL ──IMPLEMENTED reverse FIN──► (noop if no lots) + ON_HOLD
Worker actual / scrap / variance ──MISSING
Partial SEMI produce ──MISSING
Return unused ──IMPLEMENTED──► free RAW (not actual-used ledger)
```

---

## 48–52. Target architecture (recommend only)

### SEMI

Keep **PO-scoped lots** as truth. Align demo/snapshots so produce flags fire. Add partial produce only with explicit `producedQty`. UI: production WIP board, not generic RAW-like Receive.

### FIN

FIN lots = post-QC (and packaging when configured) physical units awaiting leave.  
Decide leave event: prefer **OUT_FOR_DELIVERY** for factory exit; keep DELIVERED for customer proof — **product decision**.  
Waiting-for-truck view: lots + SO + dealer + QC + planned truck + dwell.

### Material usage — HYBRID (C)

Required data model (not built):

- `ProductionMaterialUsage` (or tx metadata) per PO + stage + item:  
  `plannedQty`, `issuedQty`, `actualUsedQty`, `returnedQty`, `scrapQty`, `varianceReason`, `taskId`, `recordedById`, `recordedAt`
- Idempotent confirm on stage complete (or gate complete until confirmed)
- Scrap as signed movement or usage line + optional SCRAP tx
- Variance = actualUsed − planned (and/or issued − returned − scrap)
- Permission: e.g. `production-material.record` scoped to assigned task — **not** `inventory.issue`

### Security principle

Worker records consumption **for their task only**. Warehouse retains unrestricted receive/issue/transfer/count.

---

## 53. Implementation phases (do not execute)

| Phase | Focus |
|---|---|
| **A** | SEMI honesty: snapshot flags on curated POs; lot UI; Diwan recipe or stop claiming SEMI stock |
| **B** | FIN lifecycle: post FIN for READY_FOR_DELIVERY stories; waiting-for-truck view; curb misleading FIN Receive; decide OUT_FOR_DELIVERY vs DELIVERED leave |
| **C** | Hybrid material confirm on stage complete |
| **D** | Return/scrap/variance reconciliation fields |
| **E** | QR-assisted task material confirm |
| **F** | Aging / variance / WIP reports |

**Risk:** **HIGH** if phases mutate demo quantities without a deliberate seed redesign; **MEDIUM** for additive usage model.

---

## 54. Mutations this audit

**DATA MUTATED: NO**

---

## 55–56. Final scoreboard

| Check | Result |
|---|---|
| RAW MATERIAL FLOW | **PARTIAL** |
| RAW RESERVATIONS | **PARTIAL** (pool, not per-order ledger) |
| ACTUAL MATERIAL USAGE | **NO** |
| WORKER RECORDS USAGE | **NO** |
| AUTOMATIC BOM CONSUMPTION | **YES** |
| RETURN UNUSED MATERIAL | **PARTIAL** |
| SCRAP/WASTE | **NO** (production) |
| MATERIAL VARIANCE | **NO** |
| TASK-LINKED CONSUMPTION | **PARTIAL** (stage complete, not task qty) |
| STAGE-LINKED CONSUMPTION | **YES** |
| SEMI-FINISHED MODEL | **PO-scoped InventoryLot + snapshot produce/consume** |
| SEMI IS REAL INVENTORY | **YES (code) / NO (live demo empty)** |
| SEMI IS ORDER-SPECIFIC | **YES** |
| SEMI QUANTITY | **MISSING** live; full-order only in code |
| SEMI PRODUCER/CONSUMER | **PARTIAL** (code PASS, live FAIL) |
| FINISHED MODEL | **PO/SO InventoryLot + FG receipt** |
| FIN CREATED AFTER QC | **PARTIAL** (code gate; live often never created) |
| PACKAGING BEFORE FIN | **PARTIAL** (config); Balqis packaging not FG producer |
| FIN ORDER IDENTITY | **YES** (when lots exist) |
| FIN QUANTITY | **MISSING** live |
| FIN WAITING FOR DELIVERY | **NO** live; **PARTIAL** code |
| DELIVERY REMOVES FIN | **YES** at DELIVERED (code); **NO** at truck out |
| QC FAIL REVERSES FIN | **YES** (code); **PARTIAL** live |
| FINISHED GOODS AGING | **NO** |
| DEALER SAFE | **YES** |
| WORKER PERMISSIONS SAFE | **YES** (today); design carefully for hybrid |
| DIWAN WIP STORY | **FAIL** (inventory) / **PARTIAL** (schedule) |
| BALQIS READY-FOR-DELIVERY STORY | **FAIL** (FIN honesty) |
| OASIS QC STORY | **PARTIAL** |
| CEDAR MATERIAL STORY | **PASS** |
| NILE DELIVERED STORY | **FAIL** (FIN→DELIVERY_ISSUE ledger) |
| RECOMMENDED MATERIAL-USAGE MODEL | **HYBRID** |
| RECOMMENDED SEMI ARCHITECTURE | PO-scoped lots; align seed/snapshots; optional partial produce later |
| RECOMMENDED FIN ARCHITECTURE | Lots = post-QC/pack physical stock; leave on chosen delivery event; waiting-truck UX |
| IMPLEMENTATION RISK | **HIGH** (demo honesty) / **MEDIUM** (additive usage) |
| DATA MUTATED | **NO** |

---

## 57. Close

### WHAT EXISTS TODAY

- Three item classes, typed warehouses, transaction ledger, reservation pool  
- BOM auto-issue on stage complete; return unused; SEMI/FIN lot machine in production-inventory  
- QC pass/fail hooks; delivery leave on DELIVERED; scheduling material/WIP readiness  
- Inventory tabs Raw/Semi/Finished; PO materials return UI  

### WHAT IS CORRECT

- SEMI consume scoped to production order (when lots exist)  
- Workers not warehouse admins  
- Dealer insulated from warehouse internals  
- Cedar raw-waiting story matches balances  
- Idempotent keys on consume/produce/reverse paths  

### WHAT IS MISLEADING

- READY_FOR_DELIVERY / planned truck **without** FIN lots  
- Diwan “WIP gate” **without** SEMI lots  
- Nile “delivered” **without** DELIVERY_ISSUE / FIN history  
- Generic Receive/Issue on SEMI/FIN chrome  
- “Use material” language implying ledger usage  
- Return unused implying full actual-usage accounting  

### WHAT IS MISSING

- Live FIN/SEMI lot population for curated demos  
- Worker-confirmed actual / scrap / variance model  
- Partial stage produce  
- FIN aging / waiting-truck management view  
- Production-scoped material permission  
- Unit/PO QR for finished goods  

### WHAT SHOULD CHANGE (later, after approval)

- Seed/snapshot honesty for Balqis/Nile/Diwan vs lot ledger  
- FIN leave policy decision (OUT_FOR_DELIVERY vs DELIVERED)  
- Hybrid usage + scrap/variance  
- Class-specific inventory UX  

### WHAT SHOULD NOT CHANGE

- Core `applyMovement` ledger  
- Order-scoped SEMI consume rule  
- Automatic path as default baseline until hybrid ships  
- Dealer-safe surfaces  
- Scheduling domain math without an explicit scheduling project  
- Frozen business engines called out in prior freezes (MRP formulas, permissions catalog casually, etc.) unless a phase explicitly owns them  

### Detailed implementation plan

See §53 phases A–F. **STOP. Do not implement until explicitly approved.**
