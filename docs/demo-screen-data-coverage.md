# Demo screen → API → seeded data

**Anchor:** `DEMO_AS_OF=2026-10-08` (14:00 Asia/Amman). Repeating `pnpm demo:reset` with the same value reproduces 57 sales orders.
**Reset:** `pnpm demo:reset` — refuses production, a non-loopback host, or any database other than `maher_erp`.
**Validate:** `pnpm demo:validate`
**Live API:** `pnpm demo:live-uat` (fails if the API is down). `pnpm demo:workflow-walk` moves one new sofa through the live services and must be followed by another reset.

Password for every persona: `123`.

| Username | Role | Start |
|----------|------|--------|
| admin | SYSTEM_ADMINISTRATOR | `/ar/admin/dashboard` |
| production | PRODUCTION_MANAGEMENT | `/ar/admin/production` |
| scheduling | SCHEDULING | `/ar/admin/production/scheduling` |
| sales | SALES | `/ar/admin/sales-orders` |
| purchasing | PURCHASING | `/ar/admin/purchasing` |
| warehouse | WAREHOUSE_MANAGEMENT | `/ar/admin/inventory` |
| qc | QUALITY_CONTROL | `/ar/admin/quality` |
| finance | FINANCE | `/ar/admin/invoices` |
| delivery | DELIVERY_OPERATIONS | `/ar/admin/deliveries` |
| carpenter, foam, upholsterer, inspector, packer, recovery, driver | PRODUCTION_WORKER | `/ar/worker/dashboard` |
| nile, oasis, balqis | CUSTOMER | `/ar/dealer/dashboard` |

Dealers are Nile Interiors (`CUS-0101`), Oasis Living (`CUS-0102`), and Balqis Hospitality (`CUS-0103`). Each has its own contact, address, credit limit, terms, prices, and orders.

## Surfaces

Web admin, dealer, and worker live in `apps/web`. Mobile uses the same API from `apps/mobile` tabs (admin Home/Orders/Inventory/Production, dealer Home/Catalog/Orders, worker Home/Tasks).

| Screen | API | Seeded example |
|--------|-----|----------------|
| Admin dashboard | `GET /reports/dashboard` | Late `SO-2026-00004`, open rework, overdue `INV-2026-00004` |
| Admin orders | `GET /sales-orders` | 57 orders. Search `Abdoun` returns Nile history including `SO-2026-00003` |
| Quotations / RFQs | `GET /quotations`, `GET /requests` | Accepted quotes, `Oasis revision requested`, open Nile enquiry |
| Deliveries | `GET /deliveries` | READY, PLANNED (`DLV-SHELF-PLAN`), OUT_FOR_DELIVERY, DELIVERED, FAILED, RESCHEDULED |
| Products | `GET /products` | `SOF-3S-STD` and the other catalog SKUs, HTTPS photos |
| Materials / fabrics | `GET /inventory/items`, fabrics | Low stock `MAT-BEECH`, `MAT-BRASS` |
| Production / tasks | `GET /production-orders`, `GET /tasks` | `SO-GOLDEN-001` four kinds; empty floor `SO-2026-00036` |
| Scheduling | `GET /scheduling` | Approved, proposed, late, and material-blocked plans |
| Inventory | `GET /inventory` | RAW, SEMI, FIN bins with QR; balances match transactions |
| Purchasing | `GET /purchase-orders`, `GET /fabric-procurements` | Partial and complete receipts; `SO-FB1042` waiting on fabric |
| Quality | `GET /quality-inspections` | Pass, open rework, completed rework |
| Invoices / payments | `GET /invoices`, `GET /payments` | Paid, partial, overdue |
| Returns | `GET /returns` | `RT-DEMO-001` repair, replacement, and scrap recovery |
| Documents | `GET /uploads/documents/:id/link` | `nile-order.pdf`, `shop-drawing.pdf` under `uploads/demo/` |
| AI intake | `GET /ai-intake` | Synthetic job `AI-DEMO-1`, provider `demo`, JPEG on disk |
| Dealer home / orders | `GET /reports/dealer-home` | Nile sees only Nile orders |
| Dealer documents | dealer documents list | `nile-order.pdf` |
| Worker home | `GET /reports/worker-home` | Carpenter tasks; admin dashboard returns 403 |

Empty on purpose: no extra dealers, no push tokens, and task photos are not faked as binaries.

Named steps are in [father-demo-walkthrough.md](father-demo-walkthrough.md).
