# Golden order-to-factory report

Date: 2026-09-12

One commercial → factory journey: **catalog → variant → basket → RFQ → quote → sales order → production plan → PO/tasks → worker → fabric/time → cost**. Existing entities only. Schema is additive (nullable columns / JSON). `ProductionOrder.salesOrderLineId` is **not** unique — return/replacement POs may share a line.

## Delivery (18 points)

1. **Hop tests** — Named variant stays STANDARD; custom never invents a Product; `orderSpec` freeze; visual identity; workflow lock after `releasedToFactoryAt`; line→PO `salesOrderLineId`; planned-cost ID is the sales-order line, never the PO id.
2. **Snapshots** — `RequestItem` / `QuotationLine` carry `photoDocumentIds`, `primaryImageDocumentId`, and quote `lineSpec`. Accept copies wood/options/notes/photos from the quote line. Production setup prefers `orderSpec` over live catalog after the SO exists.
3. **Dealer basket / PDP** — One existing line for a product **updates** (STD → named variant, dims reseed unless manufacturing diffs). Several lines of that product **append**. Basket cards show image, name, variant, qty, dealer price, fabric. Custom photos upload before RFQ create.
4. **Production Plan host** — No `lineId` shows the SO item board; `lineId` opens the existing per-line editor. CUSTOM does not silent-guess a catalog workflow (`CUSTOM_NO_TEMPLATE`).
5. **Worker items-first** — Sibling SALES_ORDER POs on the same SO appear `assignedToMe: false` (view-only). Actions stay on assigned `ProductionTask` only. Workflow is that PO’s snapshot.
6. **Fabric isolation** — `assessForProductionOrder` filters by the PO’s `salesOrderLineId` (fallback PO id). Release stamps `FabricProcurement.productionOrderId`.
7. **Cost dossier** — Per-line actual material / fabric / labor from that line’s SALES_ORDER POs. Planned freeze prefers that line’s variant/setup, not header qty-share. `salesOrderLineId: productionOrderId` bug fixed.
8. **Order detail ITEMS** — Image, title, variant, qty, complexity (staff), production status. Dealer stays cost-safe.
9. **Dossier boards** — SO summary → per-item boards → order total. `tx.type` uses `mobile.inventory.txType.*`.
10. **Biometrics** — SecureStore stores **username only**. Unlock remains refresh-token + biometric. Login Face ID prefills username; it does not replay a password.
11. **MFA** — Setup key is copy/authenticator during enrollment only. Confirm clears the secret from the screen.
12. **Permission gates** — Admin order / flow / RFQ / quote / cost dossiers; dealer catalog tab + PDP (`catalog.read`). Backend remains authoritative.
13. **Inventory tab** — No longer visible from `purchase-order.read` alone.
14. **Reports tile** — Overflow + route accept `inventory.cost.read` **or** `report.inventory.read` (plus existing sales/production/financial).
15. **Invalidation** — Quote accept, order/setup mutations, fabric allocate, variant create refresh sales-orders / production / scheduling / reports / tasks keys — not the whole QueryClient.
16. **TaskStatus** — `ProductionTaskStatus` is the Prisma set (`NOT_STARTED` … `CANCELLED`). `PENDING` / `ON_HOLD` are not task statuses (they remain SO/PO/stage/QC vocabulary).
17. **Golden fixture** — `demo:reset` story `Golden factory path` (Nile, preparing / `READY_FOR_PRODUCTION`): STD qty 2, KARINA STANDARD, MODIFIED width 280, CUSTOM `productId` null + photo snapshot. One SALES_ORDER PO per production-required line. `demo:validate` asserts those invariants.
18. **UAT** — Human walkthrough after `pnpm demo:reset`: dealer Nile / `123` → basket → RFQ → quote accept → Production Plan item board → worker lane → fabric take-in → cost dossier. Custom identity is the uploaded/snapshot photo everywhere.

## Remaining debt (not in this change)

Left listed from the factory audit; not refactored here:

- God-file splits (`OrderDetailScreen`, production-setup, quotations.service)
- Empty folders / orphan sheets
- Dedicated `/(app)/search` (still a redirect)
- AI intake tiles, push notifications
- P3 cosmetics
- Per-piece manufacturing (qty>1 stays collective)
- “Save custom as catalog product”

## Commands

Focused suites only — `pnpm --filter @maher/api test -- pattern` runs the **full** API suite first, then a second Jest. Use Jest directly in `apps/api`.

```bash
pnpm --filter @maher/types test -- golden-path-hops
cd apps/api && pnpm exec jest --testPathPattern='golden-path-hops|fabric-assess-line|list-my-orders|planned-cost-snapshot|manufacturing-cost.spec|order-production-setup.spec|workflow-scope' --testPathIgnorePatterns=pdf.util.test
pnpm --filter @maher/mobile test -- --testPathPattern='newOrderBasket|newOrderLine|biometrics.creds|selectWorkerOrder.test|selectOrderDetail.test|tabConfig.test|adminOverflowModules|ReportsScreen|PermissionGate.test'
pnpm --filter @maher/mobile typecheck
pnpm demo:reset
```

`pnpm demo:reset` on 2026-09-12 passed `demo:validate` (183 sales orders). **Golden factory path** is Nile `SO-2026-00026`, `READY_FOR_PRODUCTION`, four lines (STD qty 2, KARINA STANDARD, MODIFIED width 280, CUSTOM null product + photo), one SALES_ORDER PO per production-required line. Logins: `admin` / `nile` / workers, password `123`.
