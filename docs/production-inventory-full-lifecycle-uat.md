# Production inventory — full lifecycle UAT

**Date:** 2026-08-24 · **Command:** `pnpm smoke:production-inventory-lifecycle-uat`  
**Prerequisite:** API on `:4000` + `pnpm demo:reset` against `maher_erp`  
**Latest run:** **15/15 PASS** (see `tmp/production-inventory-lifecycle-uat.json`)

## Cases A–O

| ID | Prove | How |
|---|---|---|
| A | RAW→SEMI physical | Sweifieh SEMI lots + `SEMI_FINISHED_RECEIPT` |
| B | SEMI consume same-PO | Balqis SEMI CONSUMED / `SEMI_FINISHED_ISSUE` |
| C | Partial 4/6 | Noor banquettes: target 6, completed 4, SEMI qty 4 |
| D | QC/pack → FIN | Global FIN receipts + in-factory lots |
| E | QC fail / reverse | Oasis ON_HOLD, 0 deliverable FIN |
| F | Waiting truck FIN | Balqis FIN + PLANNED/READY delivery |
| G | OUT_FOR_DELIVERY → issue | Nile `DELIVERY_ISSUE` on delivery |
| H | DELIVERED no duplicate | Nile 0 FIN left; single issue |
| I | Actual variance posts | Sweifieh usage rows |
| J | Return + reservation | `PRODUCTION_RETURN` for usage task |
| K | Scrap not restocked | Scrap qty present; no scrap restock return |
| L | Worker 403 issue; usage OK | Carpenter cannot `/inventory/issue` |
| M | Dealer 403 internal | Nile 403 inventory; 200 sales-orders |
| N | Father demo five stories | Abdoun, Sweifieh, Abdali, Cedar, Diwan (0 SEMI) |
| O | Retry idempotent | Unique delivery issue idempotency keys |

## Closures

- [SEMI](./production-inventory-semi-closure-report.md)
- [FINISHED](./production-inventory-finished-closure-report.md)
- [Material usage](./production-material-usage-closure-report.md)

## Scoreboard (master keys)

| Key | Status |
|---|---|
| RAW MATERIAL LIFECYCLE | PASS |
| RAW RESERVATION RECONCILIATION | PASS |
| SEMI LOT CREATION / PO-SCOPED / PRODUCER / CONSUMER / PARTIAL QTY / UI | PASS |
| WIP SCHEDULING CONSISTENCY | PASS |
| FIN RECEIPT | PASS |
| QC GATE | PASS |
| PACKAGING GATE | PASS |
| QC FAIL REVERSAL | PASS |
| FIN ORDER IDENTITY | PASS |
| FIN PARTIAL QTY | CONSTRAINED (QC all-or-nothing) |
| FIN WAITING FOR TRUCK | PASS |
| FIN AGING | PASS |
| DELIVERY ISSUE EVENT = OUT_FOR_DELIVERY | PASS |
| DELIVERY REMOVES FIN | PASS |
| DELIVERY RETRY IDEMPOTENT | PASS |
| BALQIS FIN | PASS |
| NILE HISTORICAL FIN | PASS |
| OASIS QC | PASS |
| DIWAN WIP | PASS |
| CEDAR RAW MATERIAL | PASS |
| WORKER ACTUAL MATERIAL USAGE | PASS |
| TASK-SCOPED SECURITY | PASS |
| EXPECTED VS ACTUAL | PASS |
| RETURN UNUSED | PASS |
| SCRAP | PASS |
| VARIANCE / VARIANCE REASON | PASS |
| RESERVATION RELEASE | PASS |
| QR TASK MATERIAL CONFIRM | PASS |
| WORKER CANNOT ARBITRARY ISSUE | PASS |
| RAW/SEMI/FIN UI (mobile + admin) | PASS |
| REPORTS (item PDF usage) | PASS |
| EN/AR/HE | PASS |
| DEALER PRIVACY | PASS |
| NEW WORKER/RESOURCE CONFLICTS | 0 |
| DEMO RESET REPRODUCIBLE | PASS (required before UAT) |
| REMAINING GAPS | Partial FIN under all-or-nothing QC; optional dedicated SCRAP tx type; variance dashboards minimal |

## Product invariant

**The database matches what is physically inside the factory** for curated demo stories after reset.
