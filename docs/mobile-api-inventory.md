# Mobile API inventory

**Date:** 2026-08-05  
**Source:** NestJS controllers under `apps/api/src/modules/**/*.controller.ts`  
**Global prefix:** `/api/v1`  
**OpenAPI:** `/api/docs` (when API is running)  
**Endpoint count:** 264 handlers across 38 controllers  

Auth legend:

- **Public** — `@Public()`; no JWT required (may still enforce webhook secrets)
- **JWT** — authenticated user; no permission metadata (any valid session)
- **JWT + `perm`** — `@RequirePermissions` (all listed codes required)
- **JWT + any(...)** — `@RequireAnyPermissions` (at least one)

Notes:

- Access JWT accepted via `Authorization: Bearer` **or** cookie `access_token`.
- Permission codes are loaded from the DB on every authenticated request.
- Webhooks under `/webhooks/*` are Public but require shared secrets (`x-inbound-email-secret`, Meta verify, `x-worker-secret`, etc.).
- Auth metadata was extracted from controller decorators; prefer live Swagger for edge cases.

## Mobile-relevant highlights

| Area | Endpoints | Why it matters for Expo |
|------|-----------|-------------------------|
| Auth | `/auth/login`, `/refresh`, `/me`, `/logout*` | `client: 'mobile'` returns tokens in JSON body |
| Health | `GET /health` | Connectivity / LAN smoke check |
| Tasks | `/tasks/*` lifecycle | Employee floor workflows |
| Inventory counts | `/inventory/counts`, `/counts/scan` | Barcode cycle-count |
| Deliveries | `/deliveries/:id/location`, `/status` | Field updates |
| Uploads | `POST /uploads`, `GET /uploads/download` | Photos/docs; signed public download |
| AI intake | `/ai-intake/*` | Camera / handwritten RFQ |
| Notifications | inbox + `POST /notifications/device-token` | Poll inbox; register push token (send not implemented) |

---

## Full inventory by path prefix

### `/ai-intake`

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/ai-intake/extract-preview` | JWT + any(ai-intake.manage|request.create) |
| POST | `/api/v1/ai-intake/from-upload` | JWT + any(ai-intake.manage|request.create) |
| GET | `/api/v1/ai-intake/jobs` | JWT + ai-intake.read |
| POST | `/api/v1/ai-intake/jobs` | JWT + ai-intake.manage |
| GET | `/api/v1/ai-intake/jobs/:id` | JWT + ai-intake.read |
| POST | `/api/v1/ai-intake/jobs/:id/approve` | JWT + ai-intake.manage |
| POST | `/api/v1/ai-intake/jobs/:id/link-request` | JWT + any(ai-intake.manage|request.create) |
| POST | `/api/v1/ai-intake/jobs/:id/reject` | JWT + ai-intake.manage |

### `/audit`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/audit` | JWT + audit.read |

### `/auth`

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/auth/forgot-password` | Public |
| POST | `/api/v1/auth/invite` | JWT + user.manage |
| POST | `/api/v1/auth/login` | Public |
| POST | `/api/v1/auth/logout` | JWT |
| POST | `/api/v1/auth/logout-all` | JWT |
| GET | `/api/v1/auth/me` | JWT |
| POST | `/api/v1/auth/mfa/confirm` | JWT |
| POST | `/api/v1/auth/mfa/disable` | JWT |
| POST | `/api/v1/auth/mfa/enable` | JWT |
| POST | `/api/v1/auth/refresh` | Public |
| POST | `/api/v1/auth/reset-password` | Public |
| GET | `/api/v1/auth/sessions` | JWT |
| DELETE | `/api/v1/auth/sessions/:id` | JWT |

### `/catalog`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/catalog/browse/categories` | JWT + catalog.read |
| GET | `/api/v1/catalog/browse/products` | JWT + catalog.read |

### `/colors`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/colors` | JWT + catalog.manage |
| POST | `/api/v1/colors` | JWT + catalog.manage |
| DELETE | `/api/v1/colors/:id` | JWT + catalog.manage |
| PATCH | `/api/v1/colors/:id` | JWT + catalog.manage |

### `/contracts`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/contracts` | JWT + contract.read |
| POST | `/api/v1/contracts` | JWT + contract.manage |
| GET | `/api/v1/contracts/:id` | JWT + contract.read |
| POST | `/api/v1/contracts/:id/activate` | JWT + contract.manage |
| GET | `/api/v1/contracts/:id/pdf` | JWT + contract.read |

### `/customers`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/customers` | JWT + customer.read |
| POST | `/api/v1/customers` | JWT + customer.create |
| GET | `/api/v1/customers/:customerId/activity` | JWT + customer.read |
| GET | `/api/v1/customers/:customerId/addresses` | JWT + customer.read |
| POST | `/api/v1/customers/:customerId/addresses` | JWT + address.manage |
| DELETE | `/api/v1/customers/:customerId/addresses/:id` | JWT + address.manage |
| PATCH | `/api/v1/customers/:customerId/addresses/:id` | JWT + address.manage |
| GET | `/api/v1/customers/:customerId/communications` | JWT + customer.read |
| POST | `/api/v1/customers/:customerId/communications` | JWT + customer.update |
| GET | `/api/v1/customers/:customerId/contacts` | JWT + customer.read |
| POST | `/api/v1/customers/:customerId/contacts` | JWT + contact.manage |
| DELETE | `/api/v1/customers/:customerId/contacts/:id` | JWT + contact.manage |
| PATCH | `/api/v1/customers/:customerId/contacts/:id` | JWT + contact.manage |
| GET | `/api/v1/customers/:customerId/dealer-prices` | JWT + customer.read |
| POST | `/api/v1/customers/:customerId/dealer-prices` | JWT + customer.update |
| DELETE | `/api/v1/customers/:customerId/dealer-prices/:id` | JWT + customer.update |
| PATCH | `/api/v1/customers/:customerId/dealer-prices/:id` | JWT + customer.update |
| GET | `/api/v1/customers/:id` | JWT + customer.read |
| PATCH | `/api/v1/customers/:id` | JWT + customer.update |
| POST | `/api/v1/customers/suggest-translations` | JWT + any(customer.create|customer.update) |

### `/deliveries`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/deliveries` | JWT + delivery.read |
| POST | `/api/v1/deliveries` | JWT + delivery.update |
| GET | `/api/v1/deliveries/:id` | JWT + delivery.read |
| PATCH | `/api/v1/deliveries/:id/location` | JWT + delivery.update |
| PATCH | `/api/v1/deliveries/:id/status` | JWT + delivery.update |

### `/departments`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/departments` | JWT + department.manage |
| POST | `/api/v1/departments` | JWT + department.manage |
| DELETE | `/api/v1/departments/:id` | JWT + department.manage |
| PATCH | `/api/v1/departments/:id` | JWT + department.manage |

### `/fabrics`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/fabrics` | JWT + catalog.manage |
| POST | `/api/v1/fabrics` | JWT + catalog.manage |
| PATCH | `/api/v1/fabrics/:id` | JWT + catalog.manage |
| POST | `/api/v1/fabrics/:id/activate` | JWT + catalog.manage |
| POST | `/api/v1/fabrics/:id/deactivate` | JWT + catalog.manage |

### `/geo`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/geo/reverse` | JWT + delivery.read |
| GET | `/api/v1/geo/search` | JWT + delivery.read |

### `/health`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/health` | Public |

### `/inventory`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/inventory/counts` | JWT + inventory.read |
| POST | `/api/v1/inventory/counts` | JWT + inventory.count |
| POST | `/api/v1/inventory/counts/:id/post` | JWT + inventory.count |
| POST | `/api/v1/inventory/counts/scan` | JWT + inventory.count |
| POST | `/api/v1/inventory/issues` | JWT + inventory.issue |
| GET | `/api/v1/inventory/items` | JWT + inventory.read |
| POST | `/api/v1/inventory/items` | JWT + inventory.adjust |
| GET | `/api/v1/inventory/items/:id` | JWT + inventory.read |
| PATCH | `/api/v1/inventory/items/:id` | JWT + inventory.adjust |
| GET | `/api/v1/inventory/items/:id/label` | JWT + inventory.read |
| GET | `/api/v1/inventory/items/by-code/:code` | JWT + inventory.read |
| POST | `/api/v1/inventory/items/sync-from-materials` | JWT + inventory.adjust |
| GET | `/api/v1/inventory/low-stock` | JWT + inventory.read |
| POST | `/api/v1/inventory/receipts` | JWT + inventory.receive |
| GET | `/api/v1/inventory/transfers` | JWT + inventory.read |
| POST | `/api/v1/inventory/transfers` | JWT + inventory.transfer |
| POST | `/api/v1/inventory/transfers/:id/complete` | JWT + inventory.transfer |
| GET | `/api/v1/inventory/warehouses` | JWT + inventory.read |

### `/invoices`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/invoices` | JWT + invoice.read |
| POST | `/api/v1/invoices` | JWT + invoice.create |
| GET | `/api/v1/invoices/:id` | JWT + invoice.read |
| GET | `/api/v1/invoices/:id/pdf` | JWT + invoice.read |

### `/materials`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/materials` | JWT + any(catalog.manage|catalog.read|inventory.read) |
| POST | `/api/v1/materials` | JWT + catalog.manage |
| PATCH | `/api/v1/materials/:id` | JWT + catalog.manage |
| POST | `/api/v1/materials/:id/activate` | JWT + catalog.manage |
| POST | `/api/v1/materials/:id/deactivate` | JWT + catalog.manage |

### `/notifications`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/notifications` | JWT + notification.read |
| POST | `/api/v1/notifications/:id/read` | JWT + notification.read |
| POST | `/api/v1/notifications/device-token` | JWT + notification.read |
| POST | `/api/v1/notifications/read-all` | JWT + notification.read |
| GET | `/api/v1/notifications/templates` | JWT + notification.read |

### `/payments`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/payments` | JWT + payment.read |
| POST | `/api/v1/payments` | JWT + payment.record |

### `/product-categories`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/product-categories` | JWT + catalog.manage |
| POST | `/api/v1/product-categories` | JWT + catalog.manage |
| DELETE | `/api/v1/product-categories/:id` | JWT + catalog.manage |
| PATCH | `/api/v1/product-categories/:id` | JWT + catalog.manage |

### `/production-orders`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/production-orders` | JWT + production-order.read |
| GET | `/api/v1/production-orders/:id` | JWT + production-order.read |
| PATCH | `/api/v1/production-orders/:id` | JWT + production-order.update |
| POST | `/api/v1/production-orders/:id/start` | JWT + production-order.update |

### `/production-stages`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/production-stages` | JWT + production-order.update |
| POST | `/api/v1/production-stages` | JWT + production-order.update |
| DELETE | `/api/v1/production-stages/:id` | JWT + production-order.update |
| PATCH | `/api/v1/production-stages/:id` | JWT + production-order.update |
| POST | `/api/v1/production-stages/:id/activate` | JWT + production-order.update |
| POST | `/api/v1/production-stages/:id/deactivate` | JWT + production-order.update |

### `/products`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/products` | JWT + catalog.manage |
| POST | `/api/v1/products` | JWT + catalog.manage |
| DELETE | `/api/v1/products/:id` | JWT + catalog.manage |
| GET | `/api/v1/products/:id` | JWT + catalog.manage |
| PATCH | `/api/v1/products/:id` | JWT + catalog.manage |
| POST | `/api/v1/products/:id/activate` | JWT + catalog.manage |
| POST | `/api/v1/products/:id/deactivate` | JWT + catalog.manage |
| GET | `/api/v1/products/:id/dealer-prices` | JWT + catalog.manage |
| POST | `/api/v1/products/:id/duplicate` | JWT + catalog.manage |

### `/purchase-orders`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/purchase-orders` | JWT + purchase-order.read |
| POST | `/api/v1/purchase-orders` | JWT + purchase-order.create |
| GET | `/api/v1/purchase-orders/:id` | JWT + purchase-order.read |
| POST | `/api/v1/purchase-orders/:id/approve` | JWT + purchase-order.approve |
| POST | `/api/v1/purchase-orders/:id/goods-receipts` | JWT + inventory.receive |
| POST | `/api/v1/purchase-orders/:id/send` | JWT + purchase-order.approve |

### `/purchase-requests`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/purchase-requests` | JWT + purchase-request.read |
| POST | `/api/v1/purchase-requests` | JWT + purchase-request.create |
| GET | `/api/v1/purchase-requests/:id` | JWT + purchase-request.read |
| POST | `/api/v1/purchase-requests/:id/approve` | JWT + purchase-order.approve |
| POST | `/api/v1/purchase-requests/:id/convert` | JWT + purchase-order.create |
| POST | `/api/v1/purchase-requests/:id/offers` | JWT + purchase-request.create |
| POST | `/api/v1/purchase-requests/:id/offers/:offerId/select` | JWT + purchase-request.create |
| POST | `/api/v1/purchase-requests/from-low-stock` | JWT + purchase-request.create |

### `/purchasing`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/purchasing/orders/:id/pdf` | JWT + purchase-order.read |

### `/quality-checklist-templates`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/quality-checklist-templates` | JWT + quality-inspection.read |
| POST | `/api/v1/quality-checklist-templates` | JWT + quality-inspection.approve |
| GET | `/api/v1/quality-checklist-templates/:id` | JWT + quality-inspection.read |
| PATCH | `/api/v1/quality-checklist-templates/:id` | JWT + quality-inspection.approve |

### `/quality-inspections`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/quality-inspections` | JWT + quality-inspection.read |
| POST | `/api/v1/quality-inspections` | JWT + quality-inspection.perform |
| GET | `/api/v1/quality-inspections/:id` | JWT + quality-inspection.read |
| POST | `/api/v1/quality-inspections/:id/submit` | JWT + quality-inspection.perform |
| POST | `/api/v1/quality-inspections/rework/:reworkId/complete` | JWT + quality-inspection.perform |

### `/quotations`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/quotations` | JWT + quotation.read |
| POST | `/api/v1/quotations` | JWT + quotation.create |
| GET | `/api/v1/quotations/:id` | JWT + quotation.read |
| POST | `/api/v1/quotations/:id/accept` | JWT + quotation.accept |
| POST | `/api/v1/quotations/:id/approve` | JWT + quotation.approve |
| GET | `/api/v1/quotations/:id/pdf` | JWT + quotation.read |
| POST | `/api/v1/quotations/:id/reject` | JWT + quotation.reject |
| POST | `/api/v1/quotations/:id/request-revision` | JWT + quotation.accept |
| POST | `/api/v1/quotations/:id/revise` | JWT + quotation.update |
| POST | `/api/v1/quotations/:id/send` | JWT + quotation.send |
| POST | `/api/v1/quotations/:id/submit-for-approval` | JWT + quotation.update |
| GET | `/api/v1/quotations/:id/versions` | JWT + quotation.read |

### `/reports`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/reports/ap-ledger` | JWT + report.financial.read |
| GET | `/api/v1/reports/cash-flow` | JWT + report.financial.read |
| GET | `/api/v1/reports/dashboard` | JWT + report.sales.read |
| GET | `/api/v1/reports/export/ap-ledger.csv` | JWT + report.financial.read |
| GET | `/api/v1/reports/export/cash-flow.csv` | JWT + report.financial.read |
| GET | `/api/v1/reports/export/financial.csv` | JWT + report.financial.read |
| GET | `/api/v1/reports/export/order-profit.csv` | JWT + report.financial.read |
| GET | `/api/v1/reports/export/period-pl.csv` | JWT + report.financial.read |
| GET | `/api/v1/reports/export/sales.csv` | JWT + report.sales.read |
| GET | `/api/v1/reports/financial` | JWT + report.financial.read |
| GET | `/api/v1/reports/inventory` | JWT + report.inventory.read |
| GET | `/api/v1/reports/order-profit` | JWT + report.financial.read |
| GET | `/api/v1/reports/period-pl` | JWT + report.financial.read |
| GET | `/api/v1/reports/production` | JWT + report.production.read |
| GET | `/api/v1/reports/production-summary` | JWT + production-order.read |
| GET | `/api/v1/reports/productivity` | JWT + report.production.read |
| GET | `/api/v1/reports/purchasing` | JWT + report.inventory.read |
| GET | `/api/v1/reports/sales` | JWT + report.sales.read |

### `/requests`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/requests` | JWT + request.read |
| POST | `/api/v1/requests` | JWT + request.create |
| GET | `/api/v1/requests/:id` | JWT + request.read |
| PATCH | `/api/v1/requests/:id` | JWT + request.update |
| POST | `/api/v1/requests/:id/close` | JWT + request.update |
| POST | `/api/v1/requests/:id/needs-information` | JWT + request.update |
| POST | `/api/v1/requests/:id/ready-for-quotation` | JWT + request.update |
| POST | `/api/v1/requests/:id/submit` | JWT + request.update |
| POST | `/api/v1/requests/:id/under-review` | JWT + request.update |

### `/returns`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/returns` | JWT + sales-order.read |
| POST | `/api/v1/returns` | JWT + sales-order.read |
| PATCH | `/api/v1/returns/:id/resolve` | JWT + sales-order.update |

### `/roles`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/roles` | JWT + any(role.manage|user.manage) |
| POST | `/api/v1/roles` | JWT + role.manage |
| DELETE | `/api/v1/roles/:id` | JWT + role.manage |
| GET | `/api/v1/roles/:id` | JWT + role.manage |
| PATCH | `/api/v1/roles/:id` | JWT + role.manage |
| POST | `/api/v1/roles/:id/duplicate` | JWT + role.manage |
| GET | `/api/v1/roles/permissions` | JWT + role.manage |

### `/sales-orders`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/sales-orders` | JWT + sales-order.read |
| GET | `/api/v1/sales-orders/:id` | JWT + sales-order.read |
| PATCH | `/api/v1/sales-orders/:id` | JWT + sales-order.update |
| POST | `/api/v1/sales-orders/:id/cancel` | JWT + sales-order.update |
| POST | `/api/v1/sales-orders/:id/confirm` | JWT + sales-order.update |
| POST | `/api/v1/sales-orders/:id/hold` | JWT + sales-order.update |

### `/settings`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/settings` | JWT + settings.manage |
| PATCH | `/api/v1/settings` | JWT + settings.manage |
| GET | `/api/v1/settings/:key` | JWT + settings.manage |
| PUT | `/api/v1/settings/:key` | JWT + settings.manage |

### `/statements`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/statements/:customerId` | JWT + statement.read |
| GET | `/api/v1/statements/:customerId/pdf` | JWT + statement.read |

### `/supplier-invoices`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/supplier-invoices` | JWT + supplier-invoice.read |
| POST | `/api/v1/supplier-invoices` | JWT + supplier-invoice.create |
| GET | `/api/v1/supplier-invoices/:id` | JWT + supplier-invoice.read |

### `/supplier-payments`

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/supplier-payments` | JWT + supplier-payment.record |

### `/suppliers`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/suppliers` | JWT + supplier.read |
| POST | `/api/v1/suppliers` | JWT + supplier.manage |
| GET | `/api/v1/suppliers/:id` | JWT + supplier.read |
| PATCH | `/api/v1/suppliers/:id` | JWT + supplier.manage |
| POST | `/api/v1/suppliers/:id/activate` | JWT + supplier.manage |
| POST | `/api/v1/suppliers/:id/contacts` | JWT + supplier.manage |
| POST | `/api/v1/suppliers/:id/deactivate` | JWT + supplier.manage |
| GET | `/api/v1/suppliers/:id/statement/pdf` | JWT + supplier.read |

### `/tasks`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/tasks` | JWT + production-task.read |
| GET | `/api/v1/tasks/:id` | JWT + production-task.read |
| POST | `/api/v1/tasks/:id/assign` | JWT + production-order.assign |
| POST | `/api/v1/tasks/:id/block` | JWT + any(production-task.update-own|production-task.update-any) |
| POST | `/api/v1/tasks/:id/complete` | JWT + production-task.complete |
| PATCH | `/api/v1/tasks/:id/notes` | JWT + any(production-task.update-own|production-task.update-any) |
| POST | `/api/v1/tasks/:id/pause` | JWT + any(production-task.update-own|production-task.update-any) |
| POST | `/api/v1/tasks/:id/progress` | JWT + any(production-task.update-own|production-task.update-any) |
| POST | `/api/v1/tasks/:id/resume` | JWT + any(production-task.update-own|production-task.update-any) |
| POST | `/api/v1/tasks/:id/start` | JWT + any(production-task.update-own|production-task.update-any) |
| POST | `/api/v1/tasks/:id/unblock` | JWT + any(production-task.update-own|production-task.update-any) |

### `/units`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/units` | JWT + catalog.manage |
| POST | `/api/v1/units` | JWT + catalog.manage |
| DELETE | `/api/v1/units/:code` | JWT + catalog.manage |
| PATCH | `/api/v1/units/:code` | JWT + catalog.manage |

### `/uploads`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/uploads` | JWT + document.read |
| POST | `/api/v1/uploads` | JWT + document.manage |
| GET | `/api/v1/uploads/documents/:id/link` | JWT + document.read |
| GET | `/api/v1/uploads/download` | Public |
| POST | `/api/v1/uploads/from-url` | JWT + document.manage |

### `/users`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/users` | JWT + user.manage |
| POST | `/api/v1/users` | JWT + user.manage |
| GET | `/api/v1/users/:id` | JWT + user.manage |
| PATCH | `/api/v1/users/:id` | JWT + user.manage |
| POST | `/api/v1/users/:id/activate` | JWT + user.manage |
| POST | `/api/v1/users/:id/deactivate` | JWT + user.manage |
| POST | `/api/v1/users/:id/reset-password` | JWT + user.manage |

### `/warehouses`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/warehouses` | JWT + warehouse.manage |
| POST | `/api/v1/warehouses` | JWT + warehouse.manage |
| DELETE | `/api/v1/warehouses/:id` | JWT + warehouse.manage |
| GET | `/api/v1/warehouses/:id` | JWT + warehouse.manage |
| PATCH | `/api/v1/warehouses/:id` | JWT + warehouse.manage |
| POST | `/api/v1/warehouses/:id/activate` | JWT + warehouse.manage |
| POST | `/api/v1/warehouses/:id/deactivate` | JWT + warehouse.manage |
| POST | `/api/v1/warehouses/:id/locations` | JWT + warehouse.manage |
| DELETE | `/api/v1/warehouses/:id/locations/:locationId` | JWT + warehouse.manage |

### `/webhooks`

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/webhooks/inbound-email` | Public |
| GET | `/api/v1/webhooks/inbound-whatsapp` | Public |
| POST | `/api/v1/webhooks/inbound-whatsapp` | Public |
| POST | `/api/v1/webhooks/low-stock-pr` | Public |

