# Dealer receipt confirmation — closure notes

**Status:** Implemented (pending live UAT)  
**Date:** 2026-08-24  

## Behavior

| Step | Owner | Effect |
|---|---|---|
| Packaging complete + FIN posted | Factory | PO → `READY_FOR_DELIVERY` (not COMPLETED for SO-linked) |
| Admin ships | Staff (`delivery.update`) | Delivery → `OUT_FOR_DELIVERY` + FIN `DELIVERY_ISSUE` |
| Dealer confirms | Owning dealer (`delivery.confirm-own-receipt`) | Delivery/SO → `DELIVERED`; stamps `customerConfirmedAt/By` + `actualDeliveredAt`; LOGISTICS stage COMPLETED; PO rollup may COMPLETE |
| Staff “Mark delivered” | — | **Blocked** (`DELIVERY_DEALER_CONFIRM_REQUIRED`) |

## API

`POST /api/v1/deliveries/:id/confirm-receipt`

- Requires dealer `customerId` match (staff cannot impersonate)
- Eligible only from `OUT_FOR_DELIVERY`
- Idempotent if already confirmed by same owner
- **No inventory call**

## Surfaces

- Admin: after ship, shows awaiting-dealer copy (EN/AR/HE)
- Customer portal order detail: Confirm received when `OUT_FOR_DELIVERY`
- Mobile dealer order detail: Confirm received for out-for-delivery rows

## Tests

- `deliveries-confirm-receipt.spec.ts`
- Workflow terminal-chain unit tests
