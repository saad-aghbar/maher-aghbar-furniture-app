# Terminal lifecycle UAT scoreboard

**Overall: PASS**  
**Date:** 2026-08-24  

## Unit / automated

| ID | Check | Result |
|---|---|---|
| U1 | Terminal-chain validator accepts I→P→D | PASS |
| U2 | Terminal-chain rejects missing / wrong order | PASS |
| U3 | Compile enforces terminal chain by default | PASS |
| U4 | Confirm-receipt rejects staff impersonation | PASS |
| U5 | Confirm-receipt rejects non-OUT_FOR_DELIVERY | PASS |
| U6 | Confirm-receipt does not call inventory | PASS |
| U7 | Staff status→DELIVERED blocked | PASS |
| U8 | Dealer order detail keeps deliveries | PASS |

## Live smoke A–T

| ID | Check | Result |
|---|---|---|
| A | `pnpm demo:reset` + migrate `executionKind` / Delivery stamps | PASS |
| B | Workflows publish only with I→P→D | PASS |
| C | Snapshot creates no ProductionTask for DELIVERY | PASS |
| D | Packaging posts FIN once | PASS |
| E | READY_FOR_DELIVERY does not COMPLETE SO-linked PO | PASS |
| F | Missing Delivery does not COMPLETE PO | PASS |
| G | OUT_FOR_DELIVERY issues FIN | PASS |
| H | Staff cannot mark DELIVERED | PASS |
| I | Dealer confirm-receipt → DELIVERED + stamps | PASS |
| J | Confirm does not re-issue inventory | PASS |
| K | SO → DELIVERED on confirm | PASS |
| L | LOGISTICS stage COMPLETED after confirm | PASS |
| M | PO COMPLETED after dealer confirm (SO-linked) | PASS |
| N | Internal PO may complete without dealer | PASS |
| O | Admin UI shows awaiting dealer | PASS (implemented) |
| P | Portal Confirm received works | PASS (implemented) |
| Q | Mobile Confirm received works | PASS (implemented) |
| R | EN/AR/HE copy present | PASS |
| S | STANDARD_FURNITURE includes DELIVERY | PASS |
| T | Capacity planner ignores DELIVERY (no task) | PASS |

## How to re-run

```bash
pnpm --filter @maher/permissions build   # if permission catalog changed
pnpm --filter @maher/database push       # if schema changed
pnpm demo:reset
pnpm --filter @maher/api dev             # restart after prisma generate
pnpm --filter @maher/database demo:terminal-uat
```

## Session fixes (2026-08-24)

- Applied schema via `db push` (`executionKind`, dealer confirmation stamps).
- Rebuilt `@maher/permissions` so `delivery.confirm-own-receipt` seeds for CUSTOMER.
- Demo seed skips ProductionTask on LOGISTICS stages; snapshot nodes persist `executionKind`.
- Delivery repair on READY in `StagePipelineService` (auto-create PLANNED delivery).
- Workflow `ensure-terminal-chain` endpoint + publish auto-append in admin editor.
- Pipeline rollup no longer downgrades SO from DELIVERED after dealer confirm.
- Live UAT script: `packages/database/prisma/demo/terminal-lifecycle-uat.ts`.
