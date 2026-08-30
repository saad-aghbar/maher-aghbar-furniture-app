# Piece 14 — Data Ownership Map

Canonical owners for cross-cutting domains. Frontends (admin-web, mobile, portals) are **consumers** — they must not invent competing business truth.

**Rule:** If two modules can write the same fact, the row below names the **only** writer of record. Readers may enrich presentation; they may not redefine lifecycle, money, stock, or DAG shape.

---

## Ownership table

| Domain | Canonical owner | Key files | Competing risk | Notes |
|--------|-----------------|-----------|----------------|-------|
| Order lifecycle | Sales orders module | `apps/api/src/modules/sales-orders/` (`sales-orders.service.ts`, `sales-order-cancel-phase.ts`) | Production/delivery UIs marking SO commercially closed; RFQ/quotation outliving SO truth | RFQ → quotation → SO status chain. Floor task completion never commercially closes SO. Cancel impact: Piece 11. |
| Commercial price | Quotations + SO commercial fields | `apps/api/src/modules/quotations/quotations.service.ts`; SO line commercial fields in `sales-orders/` | Manufacturing cost / setup estimate bleeding into dealer price; catalog BOM overwriting MOD/CUSTOM line price | Dealer-facing money only. Separate from actual manufacturing cost (Piece 5/7). |
| Production setup | Order production setup | `apps/api/src/modules/production/order-production-setup.service.ts`, `order-production-setup.controller.ts`, `order-production-setup.dto.ts`, `order-production-setup.costing-hook.ts` | Product-catalog setup (`production-setup.service.ts`) treated as live order truth after release | Catalog/product setup is template. Order-line setup is release gate for production. |
| Manufacturing specification | Order production setup (Piece 4) | `apps/api/src/modules/production/order-production-setup.service.ts`, `order-production-setup.dto.ts` | Editing catalog BOM / product measurements instead of order-line spec for MOD/CUSTOM | Order-specific measurements, complexity, fabric labels. Catalog BOM must stay unchanged for MOD proof. |
| Workflow DAG | `@maher/workflow-domain` + workflow API | `packages/workflow-domain/`; `apps/api/src/modules/production/workflow/` (`workflow.controller.ts`, `order-workflow-graph.service.ts`, `workflow-snapshot.service.ts`); admin adapter `apps/admin-web/src/lib/workflow-domain-adapter.ts` | Legacy heal / UI-only graph rewrites; preview ≠ persisted snapshot | Domain package is SSoT for graph math. Snapshots bind a PO to a frozen DAG. |
| Production plan | Scheduling module | `apps/api/src/modules/scheduling/` (`scheduling.controller.ts`, `domain/schedule-planner.ts`, `domain/scheduling-floor.ts`) | Manual task dates in tasks UI that diverge from board without sync | Capacity, conflicts, dealer delivery windows. Manual sync policies live under `scheduling/domain/`. |
| Worker assignment | Tasks + recommend helpers | `apps/api/src/modules/tasks/tasks.service.ts`; `apps/api/src/modules/production/worker-recommend.ts`; `apps/api/src/modules/users/employee-assignment.ts` | Scheduling suggesting assignees without task assign API; setup “planned workers” treated as live assignment | Assignment writes go through tasks. Setup may name intended skill/stage workers; floor claim/assign is task authority. |
| Material requirements | Order setup expected materials + usage | `order-production-setup.*`; `apps/api/src/modules/production/material-usage.service.ts`; demand bridge `apps/api/src/modules/purchasing/material-demand.ts` | Purchasing PRs inventing demand without setup/usage; inventory stockouts as “requirements” | Expected qty from setup; actual from finalized `ProductionTaskMaterialUsage`. |
| RAW inventory | Inventory module | `apps/api/src/modules/inventory/inventory.service.ts`, `inventory.controller.ts` | Production ISSUE/RETURN without inventory txs; SEMI/FIN class confusion | Class RAW. Receive/reserve/consume via inventory txs (+ production material-usage for consume). |
| SEMI custody | Production inventory + WIP kit | `apps/api/src/modules/production/production-inventory.service.ts`, `wip-kit.service.ts`, `floor-execution.ts`, `piece-labels.ts` | Treating SEMI as RAW stock qty or adding mfg $ on handoff | Custody derived from WIP kit/piece/handoff (Piece 8). SEMI handoff adds **0** manufacturing cost. |
| Actual manufacturing cost | Manufacturing cost service | `apps/api/src/modules/production/manufacturing-cost.service.ts`, `manufacturing-cost.controller.ts`, `manufacturing-cost-basis.ts`; shared `apps/api/src/common/helpers/order-costing.util.ts` | Commercial invoice totals; inventing `0` for missing valuation; SEMI/FIN physical events | Estimated ≠ actual. Incomplete ≠ 0. RAW usage valuation only. Dealer must never see mfg cost. |
| QC | Quality module + quality floor gates | `apps/api/src/modules/quality/` (`quality.controller.ts`, `quality-floor.ts`, `quality-floor.service.ts`); rework `apps/api/src/modules/production/production-rework.service.ts` | Floor `complete` bypassing QUALITY stages; packaging completing without PASS | `executionKind=QUALITY`. PASS unlocks packaging; FAIL → rework/reinspection. |
| Packaging | Production floor + piece labels | `apps/api/src/modules/production/piece-labels.ts`, `floor-execution.ts`, `production-inventory.service.ts` (pack → FIN) | Load-sheet “package check” inventing FIN or stock moves | Packaging complete → `FINISHED_GOODS_RECEIPT` once. Load check is delivery prep only (no stock). |
| Finished Goods | Production inventory + inventory FG lots | `production-inventory.service.ts`; `apps/api/src/modules/inventory/` (finished lots / FG board APIs) | Depart/confirm inventing extra FG lots; packaging double-receipt | FIN lots owned with inventory movements. Depart issues once; dealer confirm = **0** inventory. |
| Delivery state | Deliveries + load service | `apps/api/src/modules/deliveries/deliveries.controller.ts`, `delivery-load.service.ts` | Staff PATCH to `DELIVERED`; load check posting `DELIVERY_ISSUE` | PLANNED → READY → OUT_FOR_DELIVERY via depart. Load = `loadedAt` only. |
| Dealer receipt | Deliveries confirm-receipt | `apps/api/src/modules/deliveries/deliveries.controller.ts` (`POST :id/confirm-receipt`) | Staff “Mark delivered”; SO closed from floor | Owning dealer confirms. Sets `customerConfirmedAt` / commercial DELIVERED; no inventory. |
| Invoice | Invoices module | `apps/api/src/modules/invoices/invoices.service.ts`, `invoices.controller.ts` | Manufacturing cost overwriting invoice lines; payment UI inventing invoice status | Commercial documents only. Privacy: dealers never see factory cost fields. |
| Payment | Payments module | `apps/api/src/modules/payments/payments.service.ts`, `payments.controller.ts` | Apply-credit recorded as Payment; statement math in the client | Allocations and idempotency keys live server-side. |
| Dealer credit | Dealer finance helpers | `apps/api/src/modules/payments/dealer-finance.ts`; statements `statements.controller.ts` | Client-recomputed balances; credit ≠ payment confusion | Canonical presentation/balances for dealer finance (Piece 7). Apply-credit must not create a Payment. |
| Returns | Contracts returns | `apps/api/src/modules/contracts/returns.controller.ts` | Approve inventing stock; receive without quarantine; cancel-after-ship skipping Return | Approve ≠ stock. Receive → quarantine once. Finance explicit (Piece 11). |
| Management reporting | Reports management summary | `apps/api/src/modules/reports/management-summary.ts`, `reports.controller.ts` (`GET …/management-summary`); `reports.service.ts` | Tile counts from `findMany().length` / UI caches; duplicate “dashboard” aggregators | COUNT = DATASET from source `count`/aggregate. Tiles must reconcile to owning modules. |

---

## Cross-cutting notes

- **Estimated setup cost** (order setup) is planned only — never overwrite with actual usage; actual lives under manufacturing cost.
- **Catalog / product production setup** (`production-setup.service.ts`) is a template library, not the live order authority after order setup exists.
- **Admin-web mirrors** (e.g. `apps/admin-web/src/lib/management-summary.ts`, `cancel-impact.ts`, `workflow-domain-adapter.ts`) are presentation adapters — they must call or mirror API contracts, not redefine them.
- Conflicts found during Piece 14 audits should be fixed toward this map, not papered over with “known issue” dumps.
