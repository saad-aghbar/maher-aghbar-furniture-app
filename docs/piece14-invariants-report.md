# Piece 14 Invariants Report

API: http://localhost:4000
Result: **PASS** (21/21)

## Scope

API-driven smoke covering fixture presence, permission/IDOR, P10 idempotency samples,
delivery/return gates, management-summary COUNT sample, and oasis finance fields.
Full lifecycle (release → floor → QC → pack → FIN → depart → confirm) is **MANUAL** below.

## Fixtures referenced

| Fixture | Role in smoke |
|---|---|
| SO-P14-GOLDEN / SO-P14-MOD | Presence + optional safe release |
| PO-P14-GOLDEN | Prisma spine exists; setup RELEASED; no Delivery yet |
| DLV-P10-F (or OUT_FOR_DELIVERY P10) | Double depart idempotency |
| DLV-P10-H / G | Double confirm-receipt idempotency |
| Any P10/GOLDEN delivery | Staff PATCH DELIVERED gate |
| RET-P11-F | Receive before approve → RETURN_NOT_APPROVED |

## Smoke results

- PASS 1. admin login
- PASS 2. SO-P14-GOLDEN + SO-P14-MOD present — golden=READY_FOR_PRODUCTION setup=RELEASED mod=READY_FOR_PRODUCTION
- PASS 2b. PO-P14-GOLDEN exists via prisma — po=PO-P14-GOLDEN status=READY soMatch=true
- PASS 2c. SO-P14-GOLDEN productionSetup status RELEASED — setup=RELEASED
- PASS 2d. No Delivery for SO-P14-GOLDEN yet (lifecycle not pre-completed) — deliveryCount=0
- PASS 2e. Orphan DeliveryLoadPiece without delivery = 0 (and no P14 load rows) — orphans=0 p14LoadPieces=0
- PASS 3. Admin find SO-P14-GOLDEN (list q= or GET by id) — list=200 hits=1 get=200
- PASS 4. Gate SETUP_INCOMPLETE on confirm (skipped — setup already released) — setup=RELEASED
- PASS 5. oasis login
- PASS 6. Dealer oasis GET management-summary → 403 — status=403 code=FORBIDDEN
- PASS 7. Oasis GET other dealer SO → 403/404 — so=SO-P10-B status=403 code=FORBIDDEN
- PASS 8. carpenter login
- PASS 9. Worker carpenter GET management-summary → 403 — status=403 code=FORBIDDEN
- PASS 10. Double depart idempotent (P10 fixture) — d1=201 d2=201 issues 1→1→1 code1= code2=
- PASS 11. balqis login
- PASS 12. Double confirm-receipt idempotent (P10 G/H) — c1=201 c2=201 code1= code2=
- PASS 13. Staff PATCH DELIVERED blocked (DELIVERY_DEALER_CONFIRM_REQUIRED) — dlv=DLV-P10-A status=400 code=DELIVERY_DEALER_CONFIRM_REQUIRED
- PASS 14. Receive before approve → RETURN_NOT_APPROVED (P11-F) — status=400 code=RETURN_NOT_APPROVED approval=PENDING
- PASS 15. Admin GET management-summary 200 — status=200
- PASS 16. Management-summary sample tile counts are numbers — numericTiles=4 outbound.shippedAwaitingDealer=3 exceptions.waitingReturn=0 finance.openInvoices=24 quality.waitingInspection=11
- PASS 17. Finance oasis summary — receivable/credit separate fields — status=200 amountDue=21458.84 credit=0

## Notes

- SETUP_INCOMPLETE confirm gate skipped: GOLDEN setup already released / POs exist
- IDOR sample: oasis → SO-P10-B (not oasis-owned)
- Depart idempotency fixture: DLV-P10-F (already shipped — double depart idempotent)
- Confirm idempotency fixture: DLV-P10-H (already DELIVERED)
- DELIVERED gate sample delivery: DLV-P10-A
- Returns gate fixture: RET-P11-F (PENDING)
- Double apply-credit / payment idempotency skipped — covered by dealer-finance-advance unit tests + payments.service idempotencyKey path

## MANUAL lifecycle steps (not driven by this smoke)

1. Floor execution on PO-P14-GOLDEN: start tasks, issue materials, SEMI handoffs
2. QC pass + packaging
3. FIN receipt / ready for delivery
4. Create/load delivery → POST `/deliveries/:id/depart`
5. Dealer oasis `confirm-receipt` → invoice path
6. Optional: return report → approve → receive

## Gate codes (documented)

| Code | Meaning |
|---|---|
| `SETUP_INCOMPLETE` | Confirm/release blocked until production setup ready |
| `PRODUCTION_NOT_READY` | Floor / release blocked until readiness gates pass |
| `INSPECTION_PASS_REQUIRED` | FIN receipt blocked until QC pass |
| `DELIVERY_LOAD_INCOMPLETE` | Depart blocked until all packages loaded |
| `DELIVERY_DEALER_CONFIRM_REQUIRED` | Staff cannot set DELIVERED |
| `COMMERCIAL_PRICE_REQUIRED` | Invoice blocked until commercial price confirmed |
| `RETURN_NOT_APPROVED` | Receive blocked until return approved |
| `DELIVERY_NOT_OUT_FOR_DELIVERY` | Confirm-receipt only when shipped |

HANDSET: PENDING
BROWSER: PENDING

If fixtures missing: **run `pnpm demo:reset`**.
