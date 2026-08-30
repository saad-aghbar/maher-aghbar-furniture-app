# PIECE 2 — PRODUCTION SETUP CLOSURE

## A. Audit table (current → shipped)

| CONCEPT | BEFORE | AFTER | ACTION |
|---|---|---|---|
| Accept → factory | SO DRAFT, productionSetupRequired | Unchanged boundary | KEEP |
| Prepare production | Called `POST /sales-orders/:id/confirm` | Navigates to Production Setup workspace | CHANGE |
| Confirm / release | Unguarded PO create + schedule | `release` after validated setup; `confirm` gated with `SETUP_INCOMPLETE` | SPLIT |
| Catalog BOM | Product template | Never mutated by order setup | KEEP |
| Order material plan | None pre-PO | `SalesOrderLineMaterialRequirement` | ADD |
| Workflow freeze | Snapshot at confirm | Chosen in setup; snapshotted on release (material overrides) | GATE |
| Reservations | Inside confirm | Once on release (setup materials preferred) | KEEP timing |
| Scheduling / workers | Auto after confirm | Skipped on release; Worker assignment required | CHANGE |
| Permissions | sales-order.update | `production.setup.view/edit/release` | ADD |
| auto_confirm_so_on_accept | Called confirm | Only ensures setup workspace; never creates POs | CHANGE |

## B. Frozen systems (untouched)

`@maher/workflow-domain`, SEMI/FIN inventory math, worker actual usage, QC terminal rules, dealer receipt, GRN, purchasing, invoices, costing UI, scheduling algorithms, worker assignment UX.

## C. Schema

- `SalesOrderProductionSetup` (header statuses)
- `SalesOrderLineSetup` (per-line manufacturing snapshot)
- `SalesOrderLineMaterialRequirement` (expected materials)

## D. API

- `GET /sales-orders/:id/production-setup`
- `PATCH .../lines/:lineId`
- `PUT .../lines/:lineId/materials`
- `POST .../lines/:lineId/seed-from-catalog`
- `POST .../mark-ready`
- `GET .../release-preview`
- `POST .../release` — POs + snapshot + tryReserve once; **no** `scheduling.generate`

## E–N. UX / i18n / demo

- Mobile: `/(app)/(admin)/orders/[id]/production-setup` (+ line dossier)
- Admin-web: `/[locale]/sales-orders/[id]/production-setup`
- Prepare CTA navigates to setup (not confirm)
- EN/AR/HE strings for setup/release
- Demo: `SO-P2-A` … `SO-P2-F` via `piece2-production-setup.ts`

## O. Costing hook

Expected materials retain InventoryItem + qty for later costing — no invoice UI (`apps/api/src/modules/production/order-production-setup.costing-hook.ts`).

Policy (later): `expectedQty × standardCost` (or latest purchase unit cost) × SO line quantity. Does not mutate Product BOM. Actual usage remains `ProductionTaskMaterialUsage`.

## P. Manual navigation (P2-A–F)

| ID | ROLE | ACCOUNT | APP | NAVIGATION |
|---|---|---|---|---|
| P2-A | Admin | `admin` / `123` | Mobile or Admin-web | Sales orders → `SO-P2-A` → Prepare production → setup in progress (STANDARD prefilled) |
| P2-B | Admin | `admin` / `123` | Mobile/Web | `SO-P2-B` → line needs review (MODIFIED width+fabric) |
| P2-C | Admin | `admin` / `123` | Mobile/Web | `SO-P2-C` CUSTOM — empty materials, pick workflow |
| P2-D | Admin | `admin` / `123` | Mobile/Web | `SO-P2-D` READY_FOR_RELEASE → Review & release |
| P2-E | Admin | `admin` / `123` | Mobile/Web | `SO-P2-E` READY with shortage — release allowed → WAITING_FOR_MATERIALS |
| P2-F | Admin | `admin` / `123` | Mobile/Web | `SO-P2-F` RELEASED — Worker assignment required; no schedule |
| Dealer | Dealer | `oasis` or `nile` / `123` | Mobile/Portal | Sees Preparing / In production presentation only — no BOM/shortage internals |

## Q. Test evidence

- `order-production-setup.spec.ts` — PASS
- `quotations.commercial-integrity.spec.ts` — PASS (auto_confirm no longer calls confirm)
- Sales-order scope specs updated for new constructor dep — PASS

## R. Runtime status

| Check | Status |
|---|---|
| Prisma schema push | PASS |
| Permissions build | PASS |
| API unit tests (Piece 2 core) | PASS (`order-production-setup.spec.ts`) |
| Piece 1 lifecycle | PASS |
| Types presentation / dealer lifecycle | PASS |
| Material usage identify (mock fix) | PASS |
| Workflow-domain / terminal / WIP / production-inventory | PASS |
| Deliveries receipt / inventory lifecycle / commercial integrity | PASS |
| Scheduling material-wip wiring (`materialReadyAt` persist) | PENDING (pre-existing; Piece 2 skips `scheduling.generate`) |
| Demo seed wired | PASS (run `pnpm demo:reset` / seed to materialize P2 rows) |
| Handset visual acceptance | PENDING HANDSET |
| Browser visual acceptance | PENDING BROWSER |

## S–Y. Notes

- Release skips scheduling by design (Piece 3).
- Confirm after Piece 2 is gated; primary path is setup release.
- Dealer presentation strips internal BOM/notes on SO detail (`productionSetup` limited for customers).

## Z. STOP

Piece 2 complete for implementation scope. **Do not start Piece 3** (worker assignment / scheduling UX) in this workstream.
