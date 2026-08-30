# Workflow terminal chain — Inspection → Packaging → Delivery

**Status:** Partial (domain + close path + dealer UI landed; live UAT pending)  
**Date:** 2026-08-24  

## Locked invariants

1. Missing Delivery is not completion (SO-linked POs must create/repair Delivery).
2. Delivery entity owns the logistics workflow node (no ProductionTask; sync stage from Delivery).
3. Auto-append is authoring UX only; compiler STRICT with `TERMINAL_CHAIN_*` rejects.
4. Dealer confirmation is actual delivery truth (atomic commercial close; no inventory issue).

## Phase 0 — Workflow terminal matrix

| Workflow | Last stages | Insp | Pack | Del | Order OK | Migration |
|---|---|---|---|---|---|---|
| `STANDARD_FURNITURE` | …→INSPECTION→PACKAGING→DELIVERY | Y | Y | Y | Y | Soft (`executionKind` flags) |
| Painted / armchair / sectional / ottoman demos | same | Y | Y | Y | Y | Soft |
| `UAT_PARALLEL` | …→I→P→D | Y | Y | Y | Y | Append DELIVERY + migrate existing graphs |

## Physical / customer timeline

INSPECTION PASS → PACKAGING COMPLETE → FINISHED_GOODS_RECEIPT → wait in FIN → truck departs → OUT_FOR_DELIVERY + DELIVERY_ISSUE → dealer confirms → DELIVERED → commercial close.

## Landed

| Area | Change |
|---|---|
| Schema | `StageExecutionKind` + `executionKind`; Delivery confirmation stamps |
| Domain | STRICT `validateTerminalChain` / `planTerminalChainAppend` |
| Snapshot | Persists `executionKind`; skips ProductionTask for LOGISTICS |
| Seed | INSPECTION=QUALITY, DELIVERY=LOGISTICS; UAT_PARALLEL ends at DELIVERY |
| Pipeline | SO-linked COMPLETED only after Delivery DELIVERED; syncs LOGISTICS stage |
| API | Staff cannot mark DELIVERED; `POST .../confirm-receipt` |
| Permissions | `delivery.confirm-own-receipt` on CUSTOMER |
| UI | Admin awaiting copy; portal + mobile Confirm received (EN/AR/HE) |
| Docs | This report + dealer receipt notes + walkthrough note |

## Not PASS yet

- Workflow editor locked finishing section / auto-append UX wiring
- Ensure/repair Delivery row on READY_FOR_DELIVERY (hard create)
- Demo seed “shipped awaiting confirm” story beat (if not already covered by Balqis → ship)
- Live smoke UAT A–T against API + `maher_erp` after `pnpm demo:reset`
- Final scoreboard
