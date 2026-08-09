# Mobile screen map

**Date:** 2026-08-05  
**Companion:** [mobile-architecture.md](./mobile-architecture.md), [mobile-navigation-map.md](./mobile-navigation-map.md), [mobile-api-inventory.md](./mobile-api-inventory.md)

Screens for the unified Expo app. Admin is a **module hub**, not a full admin-web port. Permission codes from `@maher/permissions`. Endpoints are under `/api/v1`.

---

## Legend

| Column | Meaning |
|--------|---------|
| Route | Expo Router path |
| Gate | Minimum permission(s); surface guards apply first |
| API | Primary endpoints |
| Copy | Keys in `@maher/i18n` `mobile` namespace (when relevant) |

---

## Auth (all personas)

| Screen | Route | Gate | API | Notes |
|--------|-------|------|-----|-------|
| Login | `/(auth)/login` | Public | `POST /auth/login` | Body includes `client: 'mobile'`; username + password |
| MFA | `/(auth)/mfa` | Public (pending login) | `POST /auth/login` + `mfaCode` | Shown when API returns `MFA_REQUIRED` |

Out of v1: forgot-password UI against production (API token store is in-memory).

---

## Shared (authenticated)

| Screen | Route | Gate | API | Notes |
|--------|-------|------|-----|-------|
| Notifications | `/(app)/notifications` | `notification.read` | `GET /notifications`, `POST …/read`, `POST …/read-all` | Poll; cap 50 |
| Document viewer | `/(app)/modals/document-viewer` | `document.read` | `GET /uploads/documents/:id/link` | Short-lived signed URL |
| Language | `/(app)/modals/language` | JWT | — | Persist locale; RTL flip |
| Profile / More | per-surface `more` tab | JWT | `GET /auth/me`, `POST /auth/logout` | Sessions optional later |

---

## Customer surface

Surface: `resolveAppSurface` → `customer` (`user.customerId`). Home: `/(app)/(customer)/(tabs)`.

### Tabs (≤5; placeholders until feature phases)

| Tab | Route | Gate | API | Purpose |
|-----|-------|------|-----|---------|
| Home | `…/(tabs)/index` | JWT + `sales-order.read` + `customerId` | `GET /reports/dealer-home` | Balance + owned orders |
| Catalog | `…/(tabs)/catalog` | `catalog.read` | `GET /catalog/browse/categories` + `GET /catalog/browse/products` | Two-column grid; dealer-scoped `price` only |
| Product detail | `…/catalog/[id]` | `catalog.read` | `GET /catalog/browse/products/:id` | Dealer price; no costs; Add to Order → New Order |

Screenshots: [`docs/mobile-screenshots/catalog/`](./mobile-screenshots/catalog/), [`docs/mobile-screenshots/product-detail/`](./mobile-screenshots/product-detail/).
| New Order | `…/(tabs)/new-order` | `request.create` | `POST /requests?submit=true|false`, `POST /requests/:id/submit`, uploads, AI, addresses, map | Steps 1–6 create flow |
| Edit RFQ | `…/requests/[id]` | `request.update` | `GET/PATCH /requests/:id` + `editPolicy` | 3-day window countdown; fabric lock; 409 handling |


Screenshots / gallery: `/dev/new-order`.
| Orders | `…/(tabs)/orders` | `sales-order.read` | `GET /sales-orders` (own `customerId`) | Coarse progress; no costs |
| Account | `…/(tabs)/account` | JWT | `GET /auth/me`, logout | Profile, language, notifications |

### Home widgets (dealer-owned)

| Widget | Gate | API | Purpose |
|--------|------|-----|---------|
| Greeting + date + notifications | JWT / `notification.read` | dealer-home `unreadNotifications` | Header |
| Outstanding balance hero | `sales-order.read` | `outstandingBalance`, `balanceDueInDays` | AR for this dealer |
| + New Order CTA | `request.create` | — | Starts RFQ tab |
| Metric strip (3) | `sales-order.read` | active / in production / near delivery | Compact pipeline |
| Recent orders + coarse progress | `sales-order.read` | `recentOrders` (`mapProgressForDealer`) | No stage names |
| Recent invoices | `sales-order.read` | `recentInvoices` | Supports balance story |

If missing `customerId` or `sales-order.read` → `noModules`. All-zero owned data → `dealerHome.empty*`. Never costs, workers, or internal stages.

Screenshots: [`docs/mobile-screenshots/dealer-home/`](./mobile-screenshots/dealer-home/).

### Stack screens (planned)

| Screen | Route | Gate | API | Notes |
|--------|-------|------|-----|-------|
| New RFQ detail flow | from New Order | `request.create` | `POST /requests`, uploads, optional AI | Attachments + AI handwritten |
| Request detail | `…/requests/[id]` | `request.read` | `GET /requests/:id`, submit | Submit confirm |
| Quotation detail | `…/quotations/[id]` | `quotation.read` | accept/reject/revision | Electronically accept |
| Order detail | `…/orders/[id]` | `sales-order.read` | `GET /sales-orders/:id` | Coarse progress; no stages/costs/workers/end-customer PII |

Screenshots: [`docs/mobile-screenshots/order-detail/`](./mobile-screenshots/order-detail/).
| Statement | `…/statements/[customerId]` | `statement.read` | statements + PDF | Own customerId only |

Customer never sees costs, worker names, or supplier data (same rule as customer-portal).

---

## Employee surface

Surface: floor permissions without back-office (`resolveAppSurface` → `employee`). Home: `/(app)/(employee)/(tabs)`.

### Tabs (≤5; placeholders until feature phases)

| Tab | Route | Gate | API | Hide if missing |
|-----|-------|------|-----|-----------------|
| Home | `…/(tabs)/index` | JWT + `production-task.read` | `GET /reports/worker-home` | — |
| My Tasks | `…/(tabs)/tasks` | `production-task.read` | `GET /tasks?scope=open` (forced assignee) | Urgent-first; Today chip; no progress % |
| Completed | `…/(tabs)/completed` | `production-task.read` | `GET /tasks?scope=completed` | Finished filter |
| Notifications | `…/(tabs)/notifications` | `notification.read` | `GET /notifications` | Hide tab |
| Profile | `…/(tabs)/profile` | JWT | logout / prefs | — |

### Home widgets (own tasks only)

| Widget | Gate | API | Purpose |
|--------|------|-----|---------|
| Greeting + date + notifications | JWT / `notification.read` | worker-home `unreadNotifications` | Header |
| Completed today | `production-task.read` | `completedTodayCount` | Single metric |
| Urgent task card | `production-task.read` | `urgentTask` | Highlighted first |
| Today’s tasks | `production-task.read` | `todaysTasks` | Large Open Task cards |
| Notifications preview | `notification.read` | `notifications` (≤3) | See all → Notifications |

Always scoped to `assignedEmployeeId = user.id`. No progress %, finance, or other workers’ tasks.

Screenshots: [`docs/mobile-screenshots/worker-home/`](./mobile-screenshots/worker-home/).

### Stack screens (planned)

| Screen | Route | Gate | API | Notes |
|--------|-------|------|-----|-------|
| Task detail | `…/tasks/[id]` | `production-task.read` | `GET/POST /tasks/:id/*`, uploads `TASK_PHOTO` | Hold-to-finish; start / report problem / upload photo; outbox for photos+notes only (never silent complete); idempotency keys; SuccessBurst → Completed tab |
| Inspection detail | stack (later) | `quality-inspection.read` | submit inspection | Perform requires `quality-inspection.perform` |
| Delivery detail | stack (later) | `delivery.read` | location / POD | Location debounce |

Supervisor extras (`production-order.assign` / `production-task.update-any`): filters on My Tasks — no financial views.

**Not on default worker role:** cycle count (`inventory.count`). Warehouse + back-office flags land on **admin** surface.

---

## Admin surface

Surface: back-office / default non-customer (`resolveAppSurface` → `admin`). Home: `/(app)/(admin)/(tabs)`.

Persona widgets via `resolveHomePersona` + `mobile.json` `persona.*` keys.

### Tabs (≤5; placeholders until feature phases)

| Tab | Route | Gate | API | Purpose |
|-----|-------|------|-----|---------|
| Home | `…/(tabs)/index` | JWT + `report.sales.read` for metrics | `GET /reports/admin-home` | Ops summary (real data) |
| Orders | `…/(tabs)/orders` | `sales-order.read` | `GET /sales-orders` | Role cards + search/filter/sort |
| Inventory | `…/(tabs)/inventory` | any inventory.* / `purchase-order.read` | inventory, POs | Stock & purchasing |
| Production | `…/(tabs)/production` | any `production-order.read` / `production-task.read` | production | WIP & tasks |
| More | `…/(tabs)/more` | JWT | — | Notifications, AI entry, profile, language |

### Home widgets (permission-gated)

| Widget | Gate | API | Purpose |
|--------|------|-----|---------|
| Greeting + date + notifications | JWT / `notification.read` | admin-home `unreadNotifications` | Screen 03 header |
| Primary KPI 2×2 | `report.sales.read` | new / in production / near delivery / late | Screen 03 hero metrics |
| Secondary strip | `report.sales.read` | low stock + outstanding receivables | Compact stock + AR |
| Recent orders | `report.sales.read` | admin-home `recentOrders` | See all → Orders |
| Urgent alert (one, below fold) | `report.sales.read` | delayed / urgent tasks / low stock / returns | Priority signal |
| Urgent tasks list | `production-task.read` | admin-home `urgentTasks` | Top 3 |

If `report.sales.read` missing → `noModules`. All-zero metrics + no orders → `adminHome.empty*`. No fake trend % or charts.

Screenshots: [`docs/mobile-screenshots/admin-home/`](./mobile-screenshots/admin-home/).

### Stack screens (v1)

| Screen | Route | Gate | API |
|--------|-------|------|-----|
| Order detail | `…/orders/[id]` | `sales-order.read` | `GET /sales-orders/:id` — costs, stages, worker when present |
| Quotation detail / approve-send | `…/quotations/[id]` | `quotation.read` + action perms | submit/approve/send/revise |
| Purchase order detail | `…/purchase-orders/[id]` | `purchase-order.read` | approve/send |
| Production order detail | `…/production/[id]` | `production-order.read` | get/patch/start |
| AI intake list | `…/ai-intake` | `ai-intake.read` | `GET /ai-intake/jobs` | Upload → create job (review queue) |
| AI job detail | `…/ai-intake/[id]` | `ai-intake.read` / manage | get + correct/approve/reject/manual | Original upload preserved; draft RFQ only on approve; no invoice/inventory |
| Inventory item / count | `…/inventory/…` | `inventory.read` / `inventory.count` | items, counts, scan |
| Goods receipt | from Inventory | `inventory.receive` | purchasing GR endpoints |
| Request detail | `…/requests/[id]` | `request.read` | review workflow posts |

Screenshots (order detail): [`docs/mobile-screenshots/order-detail/`](./mobile-screenshots/order-detail/).

---

## Out of v1 mobile screens

| Area | Reason |
|------|--------|
| Users / roles CRUD | Dense admin; keep on admin-web |
| Full settings / audit | Desktop |
| Reports + CSV exports | Browser-oriented |
| Supplier master CRUD | Optional later |
| Department management | Desktop |
| Forgot password (prod) | Backend durability gap |
| Push preference center | API missing |

---

## Feature → folder mapping

| Screens | `src/features/` |
|---------|-----------------|
| Login / MFA | `auth` (also `src/auth/`) |
| Tasks / Home | `tasks` |
| Inspections | `quality` |
| Deliveries | `deliveries` |
| Requests / RFQ | `requests` |
| Quotations | `quotations` |
| Orders | `sales-orders` |
| Billing / statements | `invoices` |
| Inventory / counts | `inventory` |
| Purchasing / PO | `purchasing` |
| AI intake | `ai-intake` |
| Notifications | `notifications` |
| Profile / language | `profile` |
| Catalog | `catalog` |
