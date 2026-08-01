# Admin functionality audit

**Date:** 2026-07-31  
**App:** `apps/admin-web`  
**Goal:** Make every Add / Edit / Delete / Activate / Approve / Save call the Nest API and persist in PostgreSQL.

---

## Root cause (why admin feels view-only)

1. Most pages use `ListPage` — **read-only tables** with no Add / Edit / actions.
2. Detail pages (customers, quotations) show data but **few mutations** (quotation has approve/send/revise only).
3. Settings is **hardcoded** company text — no API.
4. Backend gaps: no product/material/warehouse/department/settings CRUD modules; roles are list-only; user create uses unusable `INVITE_PENDING` password hash.
5. No shared admin form/mutation pattern (Modal exists in `@maher/ui` but unused in admin pages).

---

## Repo search (mock / placeholder signals)

| Signal | Admin-web finding |
|--------|-------------------|
| mock / fake / dummy | Only AI intake label “mock AI” |
| TODO / FIXME | None in admin-web src |
| localStorage / sessionStorage | None |
| Hardcoded dashboard | No — uses `/reports/dashboard` |
| Buttons without mutations | Users / Customers / Inventory / etc. have no Add/Edit buttons at all |
| Settings hardcoded | Yes — company name/VAT static in JSX |

---

## Page-by-page matrix

Legend: Y = yes · N = no · P = partial

| Route | File | Displays | Buttons | API | Prisma | Survives refresh | Create | Edit | Delete/Deact | Filter/Page | Perms | Missing |
|-------|------|----------|---------|-----|--------|------------------|--------|------|--------------|-------------|-------|---------|
| `/login` | `login/page.tsx` + `login-form` | Login | Submit | `POST /auth/login` | User/Session | Y | n/a | n/a | n/a | n/a | Public | — |
| `/dashboard` | `dashboard/page.tsx` | KPI cards | Retry | `GET /reports/dashboard` | aggregates | Y | N | N | N | N | `report.sales.read` | Drill-downs |
| `/customers` | `customers/page.tsx` | Table | Row link only | `GET /customers` | Customer | Y | **N** | N | N | P (API supports, UI no) | `customer.read` | Add/Edit UI |
| `/customers/[id]` | `customers/[id]/page.tsx` | Detail | Back | `GET /customers/:id` | Customer | Y | N | **N** | N | n/a | `customer.read` | Edit, contacts, addresses, deactivate |
| `/quotations` | `quotations/page.tsx` | Table | Links | `GET /quotations` | Quotation | Y | N | N | N | P | `quotation.read` | Create UI |
| `/quotations/[id]` | `quotations/[id]/page.tsx` | Detail + actions | Approve/Send/Revise | workflow POSTs | Quotation | Y | N | P | N | n/a | approve/send/update | Draft line edit |
| `/sales-orders` | `sales-orders/page.tsx` | Table | None | `GET /sales-orders` | SalesOrder | Y | N | N | N | P | `sales-order.read` | Confirm UI |
| `/production` | `production/page.tsx` | Table | None | `GET /production-orders` | ProductionOrder | Y | N | N | N | P | `production-order.read` | Start/assign UI |
| `/inventory` | `inventory/page.tsx` | Items table | None | `GET /inventory/items` | InventoryItem | Y | N | N | N | P | `inventory.read` | Receive/issue/transfer UI |
| `/invoices` | `invoices/page.tsx` | Table | None | `GET /invoices` | Invoice | Y | N | N | N | P | `invoice.read` | Issue/payment UI |
| `/reports` | `reports/page.tsx` | Sales/aging | CSV links | reports APIs | — | Y | n/a | n/a | n/a | n/a | report.* | More modules |
| `/ai-intake` | `ai-intake/page.tsx` | Jobs form | Extract/Approve | ai-intake APIs | AIExtractionJob | Y | P | P | N | N | ai-intake.* | List polish |
| `/users` | `users/page.tsx` | Table | **None** | `GET /users` | User | Y | **N** | **N** | **N** | P | `user.manage` | Full CRUD UI; create hashes broken |
| `/audit` | `audit/page.tsx` | Table | None | `GET /audit` | AuditEvent | Y | n/a | n/a | n/a | P | `audit.read` | Filters UI |
| `/settings` | `settings/page.tsx` | Static company card | None | **None** | SystemSetting unused | N (static) | N | N | N | N | — | Entire settings API + forms |

### Routes that do not exist in admin-web (but required by brief)

Employees, Departments, Products, Categories, Materials, Fabrics, Colors, Units, Suppliers, Warehouses, Purchasing, Quality config, Deliveries, Roles UI — **no pages**. Backend also missing many catalog CRUD APIs.

---

## Backend readiness (summary)

| Area | API readiness |
|------|----------------|
| Users | List/create/patch; create password broken; no get-by-id; roles via PATCH |
| Roles | GET only |
| Customers + contacts/addresses | Strong CRUD APIs |
| Suppliers | Create/list/get only |
| Inventory ops | Receive/issue/transfer/count — no item master CRUD |
| Warehouses | List only |
| Products/materials/fabrics/colors | Schema only — **no controllers** |
| Departments | Schema only — **no controllers** |
| Settings | Schema only — **no controllers** |
| Quotations/SO/production/tasks/invoices | Workflow APIs exist; admin UI thin |

---

## Implementation order (this workstream)

1. **Users** — fix API + full admin UI (Add/Edit/Activate/Roles) ← first
2. **Customers** — Add/Edit/status on existing pages
3. Reusable list + modal mutation helpers
4. Suppliers + inventory receive (existing APIs)
5. New backend modules: products, materials, warehouses, departments, settings
6. Wire remaining workflow action UIs

---

## Implementation progress

| Area | Status |
|------|--------|
| Audit doc | Done |
| Users API + admin UI | Done |
| Customers create/edit/activate + contacts/addresses/notes | Done |
| Shared ConfirmDialog / PageHeader / useApiMutation / MasterCrudPage | Done |
| Roles CRUD API + `/roles` UI | Done |
| Departments API + UI | Done |
| Products / categories / materials / fabrics / colors / units | Done |
| Suppliers create/edit/status + UI | Done |
| Warehouses CRUD + UI | Done |
| Settings company API + UI | Done |
| Production stages CRUD + UI | Done |
| Inventory receive/issue UI | Done |
| Production start action | Done |
| Employees page (maps to Users — no Employee Prisma model) | Done |
| Purchasing / invoices / deliveries / RFQ create UIs | Partial — APIs mostly exist; list pages still thin |
| Quality checklist templates admin | Pending |

---

## Definition of “working” (per feature)

Create → DB row → refresh still shows → second admin sees it → edit persists → deactivate blocked when unsafe → audit event → unauthorized gets 403.
