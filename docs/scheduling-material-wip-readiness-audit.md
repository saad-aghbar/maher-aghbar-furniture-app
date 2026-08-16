# Scheduling material + WIP readiness audit

Proven against the local worktree before the readiness wiring change. Jest is not live proof.

## Call chain (generate)

```
generateForProductionOrder
  → buildAndPersistSchedule
    → assessLiveMaterialReadiness
        → loadInventoryAvailability
        → assessMaterialReadiness (domain)
    → if !ready && !materialReadyAt → persistUnschedulable(MATERIAL_NOT_READY)
    → assessWipReadiness + wipProducersCompleted
    → if !wipReady && producersComplete → persistUnschedulable(WIP_NOT_READY)
    → PlannerOrderInput.materialReadyAt (productionReadyAt never set)
    → forwardSchedule / backwardSchedule
        baseStart = max(now, materialReadyAt, productionReadyAt)
        stage earliest = max(baseStart, DAG parent plannedEnd, stage.notBefore)
```

## J — material

**Root cause:** Domain and planner already honor a future `materialReadyAt`. `loadInventoryAvailability` only returns `{ available: free }` for FABRIC/WOOD/FOAM. It never sets `readyAt`. `assessLiveMaterialReadiness` does not scale BOM by order quantity (`bomToReadinessInput` is per-unit). Live Test J was BLOCKED because UAT-SOFA stock was sufficient **and** there is no incoming date even when stock would not be.

| Source | Exists | Wired to scheduling |
|---|---|---|
| `PurchaseOrder.expectedDeliveryDate` | yes | no |
| GRN `receiptDate` | actual receipt only | no |
| Transfer ETA | no field | n/a |
| `Supplier.leadTimeDays` | yes | must not be used |
| `InventoryBalance.onOrderQty` | schema only | unused at runtime |

Reservation formula already matches inventory: `free = availableQty - reservedQty`.

Stage-level raw consume is a **boolean** `consumesRawMaterials` on snapshot nodes. There is no per-SKU stage input map. Scheduling must not invent SKU→stage mapping.

GRN posts stock then `retryWaitingMaterialOrders` (status/reserve). It does **not** enqueue `REPLAN`. Manual `inventory.receive` does not even retry waiting orders. No PO expected-date PATCH exists.

## K — WIP

**Root cause:** `WIP_NOT_READY` only when producers are complete and lots are still short. While producers are open, generate always plans. Planner waits on snapshot **DAG edges only**. Consume-by-output (`consumeInventoryItemIds`) is enforced at task start (`INSUFFICIENT_SEMI_FINISHED_STOCK`) but never as `stage.notBefore`. UAT-SOFA-B: Upholstery DAG-depends on Carpentry only; Foam Kit is inventory-only → full allocations while foam is incomplete.

Same-order producer completion is already encoded in DAG `plannedEnd` for **edge** parents. Missing consume links are the gap.

Semi-finished lots are **this-PO** scoped (`availableSemiFinishedQty`). Do not invent warehouse-wide WIP.

Skipped/optional producers (`isSkipped`) must not be required.

Task complete already enqueues `REPLAN` after production inventory posts lots.

## What not to change

Occupancy / `processFactoryReplan`, conflict detector, bottleneck, worker capacity, calendar, planner placement, priority, committed-date semantics, mobile layout, workflow architecture.
