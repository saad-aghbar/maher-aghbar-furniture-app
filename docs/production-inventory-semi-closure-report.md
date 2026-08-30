# Production inventory — SEMI closure report

**Date:** 2026-08-24 · **Scope:** Phase A (SEMI / WIP physical truth)

## Verdict

**PASS** — Semi-finished lots are produced and consumed as PO-scoped physical inventory; scheduling WIP readiness reads the same lots; Diwan is honest (0 SEMI while WIP_NOT_READY).

## What shipped

| Item | Result |
|---|---|
| SEMI = `InventoryLot` `SEMI_FINISHED_GOOD` | PASS |
| Producer stage → `SEMI_FINISHED_RECEIPT` + lot | PASS |
| Consumer (packaging) → same-PO `SEMI_FINISHED_ISSUE` / CONSUMED | PASS |
| Partial qty (`targetQty` / `completedQty`, demo 4/6) | PASS |
| Lot status AVAILABLE / PARTIALLY_CONSUMED / CONSUMED | PASS |
| Admin + mobile SEMI tabs lot-centric | PASS |
| Diwan: MATERIAL_PREP only, 0 SEMI, WIP_NOT_READY honest | PASS |
| No second WIP engine; planner/Sync/Optimize untouched | PASS |

## Evidence anchors

- Demo helper: `packages/database/prisma/demo/inventory-lifecycle.ts` (`postDemoPhysicalOutputs`)
- Live API: `GET /inventory/semi-finished`
- UAT: `pnpm smoke:production-inventory-lifecycle-uat` cases **A, B, C, N**

## Remaining gaps

- None for SEMI gate. Cross-PO interchangeable SEMI remains out of scope (custom WIP stays PO-scoped).
