# Maher ERP — Complete Mobile App Repository Audit

**Audience:** ChatGPT (or any later model) that must understand the **current** mobile app before proposing changes.  
**Nature:** Read-only observation of the **local worktree**. This file is self-contained.  
**Not:** an implementation plan, redesign, or punch-list of work to start.

---

## Source of truth (this audit)

| Field | Value |
|--------|--------|
| Repository root | `/Users/saadaghbar/maher-aghbar-furniture-app` |
| Current branch | `main` (tracks `origin/main`) |
| Audit commit SHA | `e78daa0942cfccdcd3ea7ecae63f81056328c6ac` |
| HEAD subject | `fuckled` |
| HEAD date | `2026-09-12 16:09:50 +0300` |
| Git status at audit | Clean. `git status -sb` → `## main...origin/main`. **0** uncommitted files. |
| Audit date/time | Saturday 12 Sep 2026, ~16:18–17:00 EEST (Asia/Amman) |
| Package manager | **pnpm 9.15.9** (`packageManager: pnpm@9.15.9` in root `package.json`) |
| Node (auditor machine) | `v26.5.0` (repo engines: `node >= 20`; CI uses Node 20) |
| Mobile package | `@maher/mobile` `0.1.0` |
| Expo SDK | `~54.0.37` |
| Expo Router | `~6.0.24` |
| React Native | `0.81.5` |
| React | `19.1.0` |
| TanStack Query | `^5.66.0` |
| New Architecture | `newArchEnabled: true` (`apps/mobile/app.config.ts`) |
| Public GitHub | May be behind; **this worktree** is the source of truth |

**Allowed health commands run during audit (non-mutating):**

| Command | Result |
|---------|--------|
| `git rev-parse HEAD` | `e78daa0942cfccdcd3ea7ecae63f81056328c6ac` |
| `git status -sb` | clean `main...origin/main` |
| `pnpm --filter @maher/mobile typecheck` (`tsc -p tsconfig.json --noEmit`) | **PASS** (exit 0, ~8.5s) |
| Full `pnpm --filter @maher/mobile test` | **Not run** in this audit (336 files; CI runs it). See §31. |
| Maestro / Detox / EAS / physical camera | **Not run** |

**Application source was not modified.** The only file created by this audit is this document.

---

## 33. Executive summary (also required at top)

### Architecture in 16 bullets

1. Expo Router app (`apps/mobile/app`) with three **surfaces**: `admin` (staff/back-office), `customer` (dealer), `employee` (floor worker / delivery / QC-only). Chosen by `resolveAppSurface` in `packages/permissions/src/routing.ts` from **identity + permissions**, not by three separate apps.
2. Thin route files mount fat feature screens under `apps/mobile/src/features/*`.
3. HTTP is `/api/v1` via `getApiBaseUrl()` (`apps/mobile/src/api/config.ts`) — LAN host for physical devices, `localhost` / `10.0.2.2` for simulators, HTTPS required for EAS preview/production.
4. Auth: `POST /auth/mobile/login` → SecureStore access+refresh tokens → `GET /auth/me`. Single-flight refresh. Biometric unlock can store **username+password**. MFA is TOTP-style.
5. Data: TanStack Query, 30s staleTime, persist whitelist, refetch on focus/reconnect. Domain `query.ts` files + `queryKeys.ts`.
6. Permissions: string catalog in `@maher/permissions`. Gates are `PermissionGate` / tab `visible`. **No wildcard admin bypass** in `hasPermission`; SYSTEM_ADMINISTRATOR is a large grant list.
7. Orders journey is **server-classified** (`journeyBucket`) and mirrored in mobile `classifyAdminOrderJourney`. **Preparing → factory boundary = Release to factory**, not merely saving a plan.
8. Canonical Preparing UI is `OrderProductionPlanScreen` → `OrderProductionPlanEditorScreen`. Legacy production-setup routes **redirect**.
9. Canonical factory placement writer is `POST /tasks/:id/assign` (dual-writes `ProductionTask` planned fields + `ScheduleAllocation`). Generate/apply-moves exists on the API client but is **not mounted**.
10. Inventory is a stock desk (RAW / SEMI / FIN) with universal QR resolver. Fabric is a first-class tracker (`FabricProcurement` + holding), not a cosmetic SKU filter.
11. Returns are **ReturnRequest + ReturnPiece** with three factory decisions: `REPAIR | REPLACEMENT | SCRAP_RECOVERY`. RESTOCK as a piece decision is **rejected** by API.
12. Delivery lives in `delivery-load` + `dealer-receipts`, not empty `features/deliveries/`. Dealer close is `confirm-receipt`.
13. Design system: parchment **floor / board** aesthetic (`.cursor/skills/mobile-floor-aesthetic`). Tokens in `src/theme`. `@maher/ui` is **not** used.
14. i18n: `@maher/i18n` with `react-native: src/index.ts`. Locales **ar / en / he**; default **ar**. Native Yoga locked LTR; RTL is JS. Leaf counts match across locales.
15. Dev galleries under `app/dev` are `__DEV__`-gated. Production screens are guarded from importing fixtures (`no-production-fixture-imports.test.ts`).
16. JoFotara e-invoicing is **removed** from live invoice/settings paths.

### Roles (what actually exists)

| Surface | Who | Landing |
|---------|------|---------|
| `customer` | Dealers (`customerId` / CUSTOMER role) | `/(app)/(customer)/(tabs)` |
| `employee` | Floor perms **without** back-office perms | `/(app)/(employee)/(tabs)` |
| `admin` | Everyone else (warehouse, purchasing, production supervisor, accounting, management, SYSTEM_ADMINISTRATOR) | `/(app)/(admin)/(tabs)` |

Warehouse / purchasing / production manager are **personas inside admin** (`resolveHomePersona`, composed home, overflow modules). They are **not** separate Expo groups.

### Main modules (live)

Home, Orders (+ Factory review RFQ), Catalog, Production Plan, Production board, Tasks/WIP/QC, Scheduling, Inventory, Fabric, Purchasing, Returns, Delivery, Invoices/Payments/Statement, Dealers, Users, Reports/Cost, Notifications, AI intake + AI chat, Workflow editor, Settings/More.

### Overall health

**Coherent ERP mobile** with a strong floor aesthetic, permissioned surfaces, and a real factory domain (orders ↔ plan ↔ production ↔ inventory ↔ fabric ↔ delivery ↔ finance). Integration with the Nest `/api/v1` backend is generally aligned. Biggest risks are **god screens**, **orphaned sheets**, **permission/tile mismatches**, **ungated deep-link routes**, **biometric password storage**, and **scheduling APIs that look complete but are unused**.

### Strongest architecture (preserve)

- Surface + permission routing (`resolveAppSurface`, `SurfaceGate`, `PermissionGate`).
- Floor aesthetic + shared `BottomSheet` / `AnimatedPressable` / `orderBoardShadow`.
- Selector + `query.ts` pattern with heavy unit tests.
- Production Plan IA (one Preparing desk + redirects).
- Placement writer `POST /tasks/:id/assign`.
- Universal inventory scan resolver + QR matrix tests.
- Fabric tracker + worker take-in verdicts.
- ReturnPiece three-decision model (no RESTOCK).
- Journey classifier shared conceptually with API `admin-order-journey.ts`.
- Fixture-import guardrail.

### Biggest risks

- God files 1.1k–2.2k LOC (schedule sheets, order/task/production detail, plan editor).
- Dead UI that still looks like product (`OrderProductionSetupLineScreen` ~1192 LOC, unused sheets).
- Scheduling: generate/conflicts-resolve/capacity section **not wired**.
- Reports overflow tile omits `inventory.cost.read` while the reports screen accepts it.
- Ungated order/quotation/request/report-dossier routes (surface-only).
- Biometric unlock persists password; MFA secret shown in UI.
- `TaskStatus` (mobile) vs `ProductionTaskStatus` (`@maher/types`) vocabulary drift.
- `apps/mobile/dump.rdb` accidental Redis dump in the app folder.

### Biggest incomplete areas

- Dedicated Search route is a redirect; search lives on admin Home.
- AI intake has routes but **no More/home tile**.
- Admin quotations: detail route only (no list).
- Stock **reserve** is display-only.
- Returns `outboundEligible*` API fields unused in UI.
- Push notifications: client register exists; Personal Team builds strip APNs; server delivery not proven here.
- Worker isolation is largely **API-shaped**; UI uses `assignedToMe`.

### Coherence checks (this audit)

| Question | Finding |
|---------|---------|
| Mobile/backend integration generally coherent? | **Yes** for core floors. Drift exists (duplicate enums, unused scheduling endpoints, split warehouse URLs). |
| Obvious duplicated systems? | Dual delivery folders; dual production-setup vs plan; duplicate dealer-price APIs; duplicate board wrappers; `returnWork`/`returnedCases` query keys. |
| Mock data leaks to live routes? | **No evidence.** Fixtures gated to `/dev` + tests. Empty API → empty states. |
| Permissions coherent? | **Mostly.** Several hide-vs-route mismatches (notifications, inventory tab, reports tile, dealer catalog tab). |
| EN/AR/HE coherent? | **Package leaf parity yes.** Production leaks: English `label(key, '…')` fallbacks, raw enums, date placeholders. |

---

## 1. Mobile project structure

### High-level tree

```
apps/mobile/
├── app/                    Expo Router (135 .tsx route/layout files)
├── src/                    Application code
│   ├── api/                HTTP client, query client, modules
│   ├── auth/               Session, AuthProvider, biometrics
│   ├── components/         Shared UI (buttons, sheets, feedback, scan, layout)
│   ├── dev/                Component lab / showroom (dev only)
│   ├── features/           Domain screens (canonical product code)
│   ├── hooks/             Tiny shared hooks
│   ├── i18n/               LocaleProvider wrappers + tests
│   ├── lib/                Small helpers
│   ├── motion/             Reanimated / press / reduced motion
│   ├── navigation/        Tabs, SurfaceGate, tab bar, stack motion
│   ├── permissions/        Re-export @maher/permissions
│   ├── providers/          AppProviders, QueryProvider
│   ├── storage/            SecureStore tokens, locale, etc.
│   ├── test/               Screen/sheet test harnesses
│   ├── theme/              Tokens (colors, type, spacing, radius, elevation)
│   ├── types/              empty (.gitkeep)
│   ├── utils/              empty (.gitkeep)
│   └── validation/         Zod / form helpers
├── assets/                 icon, splash, fonts, android adaptive icons
├── ios/                    Native iOS / CocoaPods (dev client)
├── plugins/                withPersonalTeamIosCapabilities.js
├── app.config.ts           Dynamic Expo config
├── eas.json                EAS profiles
├── metro.config.js
├── jest.config.js
└── dump.rdb                Accidental Redis dump (12 258 bytes) — not app logic
```

### `app/`

Expo Router file-based routes. Groups:

- `(auth)` — login, MFA, unlock, disabled, session-expired, offline
- `(app)` — authenticated shell (`TabSwipeNavigator` + `PersistentSurfaceTabBar`)
  - `(admin)` — back-office
  - `(customer)` — dealer
  - `(employee)` — floor
  - shared: `notifications`, `search` (redirect), `_forbidden`
- `dev` — `__DEV__` galleries / component lab

### `src/features/` (live domain folders)

`account`, `admin-home`, `ai-chatbot`, `ai-intake`, `auth`, `catalog`, `dealer-home`, `dealer-receipts`, `dealer-ui`, `dealers`, `delivery-load`, `fabric`, `inventory`, `invoices`, `more`, `notifications`, `pdf`, `production`, `production-flow`, `purchasing`, `quality`, `quotations`, `reports`, `requests`, `returns`, `sales-orders`, `scheduling`, `search`, `tasks`, `users`, `worker-home`, `worker-profile`, `workflow`.

**Empty shells:** `features/deliveries/` (`.gitkeep`), `features/profile/` (`.gitkeep`). Worker profile is `worker-profile/`. Delivery UX is `delivery-load/` + `dealer-receipts/`.

Typical feature internals: `*Screen.tsx`, `components/`, `select*.ts`, `query.ts`, `__tests__/`, optional `fixtures.ts` (dev/UAT only).

### Shared packages mobile **does** depend on

| Package | Role |
|---------|------|
| `@maher/types` | AuthUser, scan helpers, lifecycle helpers, shared unions |
| `@maher/i18n` | Messages + `t` / status labels |
| `@maher/permissions` | Catalog, `can`/`canAny`, `resolveAppSurface` |
| `@maher/workflow-domain` | Workflow DAG (editor / customize) |

**`@maher/ui` is not a mobile dependency** and has zero imports under `apps/mobile/src`. It is admin-web.

Prisma is not imported by mobile. Mobile consumes Nest DTOs via `src/api/modules/*`.

### Cursor skills / rules that apply to mobile

| Path | Role |
|------|------|
| `.cursor/skills/mobile-floor-aesthetic/SKILL.md` | Canonical parchment board language |
| `.cursor/rules/mobile-floor-aesthetic.mdc` | Auto-applies to `apps/mobile/src/features/**/*.{ts,tsx}` |
| `.cursor/skills/dev-stack/SKILL.md` | Local API/admin/Metro — not mobile UI |
| `.cursor/rules/dev-stack.mdc` | `/run` `/fix` `/stop` |

---

## 2. Expo Router — complete route map

Expo groups stay in in-app `Href`s. There is **no** `+not-found.tsx`. Unknown paths fall through Expo default handling (not customised in-repo).

### SHARED

| Href | File | Mounted | Roles | Notes |
|------|------|---------|-------|-------|
| `/` | `app/index.tsx` | `SplashGate` | all | Bootstrap; deep link via Linking |
| Root stack | `app/_layout.tsx` | `RootLayout` + `AppProviders` | — | Screens: `index`, `(auth)`, `(app)`, `dev` |
| `/(app)` | `app/(app)/_layout.tsx` | `AppLayout` | authenticated | Redirects unauthenticated → login |
| `/(app)` index | `app/(app)/index.tsx` | `AppIndexRedirect` | auth | Home / search salvage / forbidden |
| `/(app)/_forbidden` | `app/(app)/_forbidden.tsx` | `ForbiddenView` | auth | Wrong surface |
| `/(app)/notifications` | `app/(app)/notifications/index.tsx` | `NotificationsInboxScreen` | **no PermissionGate** | UI often hides without `notification.read` |
| `/(app)/search` | `app/(app)/search/index.tsx` | Redirect | any | **Always** → `/(app)/(admin)/(tabs)` |

### AUTH

| Href | File | Screen | Guard |
|------|------|--------|-------|
| `(auth)` layout | `app/(auth)/_layout.tsx` | Stack | If already authenticated → `resolveMobileHomeHref` |
| `/(auth)/login` | `login.tsx` | `LoginScreen` | — |
| `/(auth)/mfa` | `mfa.tsx` | `MfaScreen` | Needs `pendingMfa` else login |
| `/(auth)/unlock` | `unlock.tsx` | `UnlockScreen` | Biometric; fail → login |
| `/(auth)/disabled` | `disabled.tsx` | `DisabledAccountScreen` | logout → login |
| `/(auth)/session-expired` | `session-expired.tsx` | `SessionExpiredScreen` | → login |
| `/(auth)/offline` | `offline.tsx` | `OfflineScreen` | `bootstrap()` → `/` or login |

### ADMIN — tabs (`SurfaceGate expected="admin"`)

Parent: `app/(app)/(admin)/_layout.tsx`. Tabs: `app/(app)/(admin)/(tabs)/_layout.tsx` + `adminTabs`.

| Href | File | Screen | Gate |
|------|------|--------|------|
| `/(app)/(admin)/(tabs)` | `(tabs)/index.tsx` | `AdminHomeScreen` | none |
| `…/(tabs)/orders` | `orders.tsx` | `OrdersListScreen` | `sales-order.read` |
| `…/(tabs)/inventory` | `inventory.tsx` | `InventoryGroupsScreen` | any inventory.read/count/receive **or** `purchase-order.read` |
| `…/(tabs)/production` | `production.tsx` | `ProductionOverviewScreen` | any `production-order.read` / `production-task.read` |
| `…/(tabs)/more` | `more.tsx` | `MoreHubScreen` | none |

### ADMIN — stack

| Href | File | Screen | Gate | Params / notes |
|------|------|--------|------|----------------|
| `/…/ai-chat` | `ai-chat/index.tsx` | `AiChatbotScreen` | `ai-chat.read` | More only |
| `/…/ai-intake` | `ai-intake/index.tsx` | `AiIntakeListScreen` | `ai-intake.read` | **No overflow tile** |
| `/…/ai-intake/[id]` | `ai-intake/[id].tsx` | `AiReviewScreen` | `ai-intake.read` | `id` |
| `/…/dealers` | `dealers/index.tsx` | `DealersListScreen` | `customer.read` | |
| `/…/dealers/[id]` | `dealers/[id]/index.tsx` | `DealerDetailScreen` | `customer.read` | `id` |
| `/…/deliveries/[id]` | `deliveries/[id].tsx` | `DeliveryLoadSheetScreen` | `delivery.read` | `id` |
| `/…/inventory/[group]` | `inventory/[group].tsx` | `InventoryGroupListScreen` | `inventory.read` | `group` |
| `/…/inventory/low-stock` | `inventory/low-stock.tsx` | `InventoryLowStockScreen` | `inventory.read` | |
| `/…/inventory/warehouses` | `inventory/warehouses.tsx` | `InventoryWarehousesScreen` | warehouse.read/manage or inventory.read | |
| `/…/inventory/warehouses/[id]` | `warehouses/[id].tsx` | `InventoryWarehouseDetailScreen` | warehouse + inventory.read/receive | `id` |
| `/…/inventory/items/[id]` | `items/[id].tsx` | `InventoryItemDetailScreen` | `inventory.read` | `id` |
| `/…/inventory/fabric-bundle/[code]` | `fabric-bundle/[code].tsx` | `FabricDetailScreen` | `inventory.read` | `code` |
| `/…/inventory/finished/[salesOrderId]` | `finished/[salesOrderId].tsx` | `InventoryFinishedOrderScreen` | `inventory.read` | |
| `/…/inventory/semi/[orderId]` | `semi/[orderId].tsx` | `InventorySemiOrderScreen` | `inventory.read` | |
| `/…/inventory/receive` | `receive/index.tsx` | `ReceiveQueueScreen` | `inventory.receive` | PO receive |
| `/…/inventory/receive/[id]` | `receive/[id].tsx` | `ReceiveGoodsScreen` | `inventory.receive` | `id` |
| `/…/invoices` | `invoices/index.tsx` | `InvoicesListScreen` | `invoice.read` | |
| `/…/invoices/[id]` | `invoices/[id].tsx` | `InvoiceDetailScreen` | `invoice.read` | `id` |
| `/…/more/account` | `more/account.tsx` | `MoreAccountScreen` | none | |
| `/…/more/settings` | `more/settings.tsx` | `AdminSettingsScreen` | none on route; screen uses `settings.manage` | |
| `/…/orders/[id]` | `orders/[id]/index.tsx` | `OrderDetailScreen` | **none** | surface-only |
| `/…/orders/[id]/flow` | `orders/[id]/flow.tsx` | `OrderProductionFlowScreen` | **none** | `po?` |
| `/…/orders/[id]/production-plan` | `production-plan.tsx` | `OrderProductionPlanScreen` | `production-order.read` | `lineId?` **canonical plan** |
| `/…/orders/[id]/production-setup` | `production-setup/index.tsx` | Redirect | `production.setup.view` | **legacy → production-plan** |
| `/…/orders/[id]/production-setup/lines/[lineId]` | `lines/[lineId].tsx` | Redirect | `production.setup.view` | **legacy → plan?lineId=** |
| `/…/production/[id]` | `production/[id]/index.tsx` | `ProductionDetailScreen` | `production-order.read` | |
| `/…/production/[id]/flow` | `production/[id]/flow.tsx` | `ProductionFlowScreen` | **none** | |
| `/…/production/[id]/plan` | `production/[id]/plan.tsx` | `OrderProductionPlanEditorScreen` | `production-order.read` | `task?` |
| `/…/production/[id]/setup` | `production/[id]/setup.tsx` | Redirect | soft | **legacy** pre-release → SO plan; post-release → PO detail |
| `/…/production/problems` | `production/problems.tsx` | `ProductionProblemsScreen` | `production-task.update-any` | |
| `/…/production/tasks/[id]` | `production/tasks/[id].tsx` | `TaskDetailScreen` | `production-task.read` | `orderId?` |
| `/…/production/workflow` | `workflow/index.tsx` | `WorkflowListScreen` | workflow.read / production-order.update | |
| `/…/production/workflow/[id]` | `workflow/[id].tsx` | `WorkflowDetailScreen` | same | |
| `/…/production/workflow/stages` | `workflow/stages.tsx` | `ManageStagesScreen` | same | |
| `/…/products` | `products/index.tsx` | `CatalogScreen` admin | `catalog.read` | |
| `/…/products/[id]` | `products/[id]/index.tsx` | `AdminProductDetailScreen` or `ProductDetailScreen` | `catalog.read`; manage UI if `catalog.manage` | |
| `/…/products/[id]/production-setup` | `production-setup.tsx` | `ProductionSetupScreen` | `catalog.manage` | `variantId?` **product** workflow/BOM, not SO plan |
| `/…/products/[id]/variants/[variantId]` | `variants/[variantId].tsx` | `AdminVariantDetailScreen` | `catalog.manage` | |
| `/…/purchasing` | `purchasing/index.tsx` | `PurchasingHubScreen` | PO.read / supplier.read / fabric.procurement.read | |
| `/…/purchasing/new` | `purchasing/new.tsx` | `PurchaseOrderBuilderScreen` | `purchase-order.create` | |
| `/…/purchasing/create` | `purchasing/create.tsx` | Redirect → `new` | `purchase-order.create` | **compat** |
| `/…/purchasing/[id]` | `purchasing/[id].tsx` | `PurchaseDetailScreen` | `purchase-order.read` | |
| `/…/purchasing/low-stock` | `purchasing/low-stock.tsx` | `LowStockReviewScreen` | `purchase-order.create` | |
| `/…/purchasing/fabric/[id]` | `purchasing/fabric/[id].tsx` | `FabricDetailScreen` | `fabric.procurement.read` | procurement id |
| `/…/purchasing/runs/[id]` | `runs/[id].tsx` | `PurchaseRunDetailScreen` | `purchase-order.read` | |
| `/…/purchasing/supplier-invoices/[id]` | `supplier-invoices/[id].tsx` | `SupplierInvoiceDetailScreen` | `supplier-invoice.read` | |
| `/…/purchasing/suppliers` | `suppliers/index.tsx` | `SuppliersListScreen` | `supplier.read` | |
| `/…/purchasing/suppliers/[id]` | `suppliers/[id]/index.tsx` | `SupplierDetailScreen` | `supplier.read` | |
| `/…/purchasing/suppliers/[id]/orders` | `orders.tsx` | `SupplierOrdersScreen` | `purchase-order.read` | |
| `/…/quotations/[id]` | `quotations/[id].tsx` | `AdminQuotationDetailScreen` | **none** | **no admin list route** |
| `/…/reports` | `reports/index.tsx` | `ReportsScreen` | inventory.cost.read **or** report.sales/production/financial.read | |
| `/…/reports/order/[id]` | `reports/order/[id].tsx` | `CostOrderDossierScreen` | **none** | |
| `/…/reports/returns/[id]` | `reports/returns/[id].tsx` | `CostReturnDossierScreen` | **none** | |
| `/…/requests/[id]` | `requests/[id].tsx` | `AdminRequestDetailScreen` | **none** | `stage?`, `quoteId?` |
| `/…/returns` | `returns/index.tsx` | `ReturnsListScreen` | return.read or sales-order.read | |
| `/…/returns/[id]` | `returns/[id].tsx` | `ReturnDetailScreen` | same | |
| `/…/scheduling` | `scheduling/index.tsx` | `AdminSchedulingScreen` | schedule.read or schedule.capacity.read | |
| `/…/users` | `users/index.tsx` | `UsersListScreen` | `user.manage` | |
| `/…/users/staff-types` | `staff-types/index.tsx` | `StaffTypesListScreen` | `role.manage` | |
| `/…/users/staff-types/new` | `staff-types/new.tsx` | `StaffTypeEditorScreen` | `role.manage` | |
| `/…/users/staff-types/[id]` | `staff-types/[id].tsx` | `StaffTypeEditorScreen` | `role.manage` | |

### DEALER (`SurfaceGate expected="customer"`)

Visible tabs: Home, Catalog (if `catalog.read`), Orders (`sales-order.read`), Account.  
Hidden tabs (`href: null` unless visible): `schedule`, `new-order`, `basket`.

| Href | File | Screen | Gate | Tab? |
|------|------|--------|------|------|
| `/(app)/(customer)/(tabs)` | `(tabs)/index.tsx` | `DealerHomeScreen` | none | visible |
| `…/catalog` | `catalog.tsx` | `CatalogScreen` dealer | **none on route** | hidden without perm |
| `…/orders` | `orders.tsx` | `OrdersListScreen` | `sales-order.read` | |
| `…/account` | `account.tsx` | `DealerAccountScreen` | none | |
| `…/schedule` | `schedule.tsx` | `DealerDeliveryCalendarScreen` | `schedule.read.own` | hidden |
| `…/new-order` | `new-order.tsx` | `NewOrderScreen` | `request.create` | hidden FAB |
| `…/basket` | `basket.tsx` | `OrderBasketScreen` | `request.create` | hidden |
| `/…/account/calendar` | `account/calendar.tsx` | same calendar | `schedule.read.own` | **dup of schedule** |
| `/…/account/payments` | `account/payments.tsx` | `DealerPaymentsScreen` | `payment.read` | |
| `/…/account/security` | `account/security.tsx` | `MoreAccountScreen` | none | |
| `/…/account/statement` | `account/statement.tsx` | `DealerStatementScreen` | `statement.read` | |
| `/…/ai-chat` | `ai-chat/index.tsx` | `AiChatbotScreen` | `ai-chat.read` | |
| `/…/catalog/[id]` | `catalog/[id].tsx` | `ProductDetailScreen` | **none** | |
| `/…/deliveries` | `deliveries/index.tsx` | `DealerReceiptsListScreen` | `sales-order.read` | |
| `/…/deliveries/[id]` | `deliveries/[id].tsx` | `DealerReceiptDetailScreen` | `sales-order.read` | |
| `/…/invoices` | `invoices/index.tsx` | `InvoicesListScreen` | `invoice.read` | |
| `/…/invoices/[id]` | `invoices/[id].tsx` | `InvoiceDetailScreen` | `invoice.read` | |
| `/…/orders/[id]` | `orders/[id]/index.tsx` | `OrderDetailScreen` | **none** | |
| `/…/orders/[id]/flow` | `orders/[id]/flow.tsx` | `OrderProductionFlowScreen` | **none** | `po?` |
| `/…/quotations` | `quotations/index.tsx` | `DealerQuotationsListScreen` | `quotation.read` | |
| `/…/quotations/[id]` | `quotations/[id].tsx` | `DealerQuotationDetailScreen` | `quotation.read` | |
| `/…/requests/[id]` | `requests/[id].tsx` | `EditRequestScreen` | **none** | |
| `/…/returns` | `returns/index.tsx` | `ReturnsListScreen` | return.read or sales-order.read | |
| `/…/returns/create` | `returns/create.tsx` | `CreateReturnScreen` | return.create/read or sales-order.read | |
| `/…/returns/[id]` | `returns/[id].tsx` | `ReturnDetailScreen` | return.read or sales-order.read | |

### WORKER (`SurfaceGate expected="employee"`)

Tabs: Home, Tasks, Completed, Notifications, Profile (middle three permission-filtered). Delivery workers reuse Tasks/Completed with `DeliveryOrdersListScreen`.

| Href | File | Screen | Gate |
|------|------|--------|------|
| `…/(tabs)` | `index.tsx` | `WorkerHomeScreen` (or delivery home) | none |
| `…/tasks` | `tasks.tsx` | `TasksListScreen` **or** `DeliveryOrdersListScreen` | `isDeliveryFloorWorker` |
| `…/completed` | `completed.tsx` | same pattern | |
| `…/notifications` | `notifications.tsx` | `NotificationsInboxScreen` | `notification.read` |
| `…/profile` | `profile.tsx` | `WorkerProfileScreen` | none |
| `/…/deliveries/[id]` | `deliveries/[id].tsx` | `DeliveryLoadSheetScreen` | `delivery.read` |
| `/…/lane/[id]` | `lane/[id].tsx` | `WorkerOrderWorkflowScreen` | `production-task.read` | PO id |
| `/…/orders/[salesOrderId]` | `orders/[salesOrderId].tsx` | `WorkerSalesOrderItemsScreen` | `production-task.read` | items-first |
| `/…/tasks/[id]` | `tasks/[id]/index.tsx` | `TaskDetailScreen` | `production-task.read` |
| `/…/tasks/[id]/take-in` | `take-in.tsx` | `TaskKitTakeInScreen` | `production-task.read` |

### DEV (`app/dev/_layout.tsx`: `if (!__DEV__) Redirect /`)

| Href | File | Purpose |
|------|------|---------|
| `/dev/admin-home` | `dev/admin-home.tsx` | Fixture `AdminHomeScreen` |
| `/dev/dealer-home` | `dev/dealer-home.tsx` | Fixture dealer home |
| `/dev/worker-home` | `dev/worker-home.tsx` | Fixture worker home |
| `/dev/catalog` | `dev/catalog.tsx` | Fixture catalog |
| `/dev/product-detail` | `dev/product-detail.tsx` | Fixture PDP |
| `/dev/orders` | `dev/orders.tsx` | Fixture orders list |
| `/dev/order-detail` | `dev/order-detail.tsx` | Fixture order detail |
| `/dev/new-order` | `dev/new-order.tsx` | Fixture new order |
| `/dev/tasks` | `dev/tasks.tsx` | Fixture tasks |
| `/dev/task-detail` | `dev/task-detail.tsx` | Fixture task |
| `/dev/tests` | `dev/tests/index.tsx` | Component lab showroom |
| `/dev/tests/coverage` | `coverage.tsx` | Coverage board |
| `/dev/tests/[id]` | `tests/[id].tsx` | Inspector |

Sheets are **not** Expo routes; they are `BottomSheet` components. Modals are the same.

### Unreachable / duplicate / legacy (high confidence)

| Item | Kind |
|------|------|
| `purchasing/create` → `new` | compatibility |
| `orders/…/production-setup` (+ lines) → `production-plan` | legacy |
| `production/[id]/setup` | legacy deep link |
| `/(app)/search` | dead page; always admin tabs |
| Customer `schedule` tab + `account/calendar` | duplicate destination |
| `OrderProductionSetupLineScreen` | **no route import** (dead screen, live file) |
| AI intake | live but low discoverability |
| Admin quotation list | **does not exist** |

---

## 3. Navigation / role experience

### How surface is chosen

`packages/permissions/src/routing.ts` `resolveAppSurface`:

1. Customer identity (`customerId`, role `CUSTOMER`, or `rolesDetailed` kind CUSTOMER) → `customer`.
2. Floor perms (`production-task.update-own|complete`, `delivery.update`, `quality-inspection.perform`) **and not** back-office perms → `employee`.
3. Else `admin`.

`SurfaceGate` overlays `ForbiddenView` on the wrong group; it does **not** bounce to the correct home.

### After login landing

`resolveMobileHomeHref`: customer tabs / employee tabs / admin tabs.

### Admin

- Tabs: Home, Orders, Inventory, Production, More (max 5).
- Overflow (Home + More atlas): Products, Dealers, Purchasing, Invoices, Reports, Scheduling, Workflow, Returns, Users; AI chat on More only. Source: `apps/mobile/src/features/admin-home/adminOverflowModules.ts`.
- Home body composition: `resolveComposedHomeKind` → `sales` | `warehouse` | `backoffice` | `personal`.
- Staff adaptive tab layout exists (`staffAdaptiveTabLayout.ts`) for some staff-kind admin users.

### Dealer

- Tabs: Home, Catalog, Orders, Account.
- FAB / hidden: New order, Basket.
- Places dock: quotations, invoices, statement, deliveries, payments, returns, calendar (`DealerPlacesDock`).

### Worker

- Tabs: Home, My tasks, Completed, Notifications, Profile.
- If `isDeliveryFloorWorker`: tasks/completed become delivery lists; home may be `DeliveryWorkerHomeScreen`.
- Items-first: `/(employee)/orders/[salesOrderId]` groups POs by sales order with variant labels.

### Warehouse / purchasing / production manager

Same **admin** tabs. Difference is **which overflow tiles and home widgets** appear. Warehouse users with only `purchase-order.read` can **see the Inventory tab** then hit Forbidden on nested `inventory.read` routes.

### Permission vs role

- Enforcement is `user.permissions` exact strings (`packages/permissions/src/check.ts`).
- Roles feed identity (CUSTOMER vs staff kinds) and staff-type editors.
- SYSTEM_ADMINISTRATOR ≈ almost all permissions except e.g. `quotation.accept` in ROLE_PERMISSIONS.

### Hide vs route mismatches (evidence)

| Case | What happens |
|------|-------------|
| Notifications | More/dealer dock need `notification.read`; `/(app)/notifications` has no gate |
| Inventory tab | Visible with only `purchase-order.read`; group routes need `inventory.read` |
| Reports tile | Overflow wants `report.inventory.read`; screen gate includes `inventory.cost.read` (cost-only users may lack the tile) |
| Dealer catalog tab | Hidden without `catalog.read`; route file has no `PermissionGate` |
| Order detail / flow / RFQ / quotation / cost dossiers | Surface-only; deep link possible without matching permission |
| AI intake | Gated routes; **not** in `ADMIN_OVERFLOW_MODULES` |

---

## 4. Authentication

| Concern | File / symbol |
|---------|----------------|
| Provider / status | `apps/mobile/src/auth/AuthProvider.tsx` — `bootstrap`, `login`, `logout`, `completeBiometric`, `pendingMfa` |
| Error map | `apps/mobile/src/auth/mapAuthError.ts` — `AuthStatus` |
| Restore | `apps/mobile/src/auth/sessionRestore.ts` — refresh + `getMe` |
| Expiry bus | `apps/mobile/src/auth/session.ts` — `onSessionExpired`, `clearSession` |
| Tokens | `apps/mobile/src/storage/tokens.ts` — `maher.access_token`, `maher.refresh_token` (SecureStore) |
| Refresh | `apps/mobile/src/api/refresh.ts` — `POST /auth/mobile/refresh` single-flight |
| Auth API | `apps/mobile/src/api/modules/auth.ts` |
| Biometrics | `apps/mobile/src/auth/biometrics.ts` |
| Login UI | `apps/mobile/src/features/auth/screens/LoginScreen.tsx` |
| Query wipe | `apps/mobile/src/auth/resetQueryClientOnLogout.ts` |
| Splash | `apps/mobile/app/index.tsx` + `authenticatedLandingHref` |

**Credential flow:** splash `bootstrapping` → restore (needs refresh token) → authenticated or login. Login `POST /auth/mobile/login` `{ username, password }` (+ optional `mfaCode`). Tokens stored. `getMe` loads roles/permissions. MFA_REQUIRED → `/(auth)/mfa`. Biometric pref → `/(auth)/unlock`.

**Runtime 401:** client refreshes once then retries. Refresh fail → `clearSession` → `session_expired`.

**Logout:** best-effort `POST /auth/mobile/logout` → clear tokens + queries → login.

**Offline:** NetInfo; tokens present + offline → `/(auth)/offline`. Client `assertOnline` before requests.

**Deep link:** splash keeps path via `authenticatedLandingHref`. Wrong surface → forbidden overlay. `(app)/_layout` rejects unauthenticated.

---

## 5. API client architecture

**Prefix:** all `apiRequest` traffic is `{origin}/api/v1`.

**Base URL** (`apps/mobile/src/api/config.ts`):

1. `EXPO_PUBLIC_API_BASE_URL` or `expoConfig.extra.apiBaseUrl`.
2. EAS preview/production: must be `https://` or throw.
3. Physical / Expo Go: if Metro host is non-loopback → `http://{lanHost}:4000` (localhost env ignored).
4. Stale private LAN IP ≠ Metro host → rewrite to Metro LAN.
5. Simulator: Android `http://10.0.2.2:4000`, else `http://localhost:4000`.

**Client** (`apps/mobile/src/api/client.ts`): 30s timeout, `Authorization: Bearer`, `Accept-Language`, `x-request-id`, 401 refresh-once, GET transport retries (2, backoff). Mutations not retried.

**Bypass client:** uploads XHR (`uploads.ts`), PDF fetch (`openPdf.ts`) — Bearer only, no request-id/refresh.

**Env names (no secrets in mobile):** `EXPO_PUBLIC_API_BASE_URL`, `EXPO_ASSOCIATED_DOMAIN`, `EAS_PROJECT_ID`, `EAS_BUILD`, `EAS_BUILD_PROFILE`, `APPLE_TEAM_ID`.

**LAN concern:** real. Physical iPhone **must** reach the Mac API on the LAN. Documented in `docs/mobile-iphone-dev-build.md`. EAS `development-device` still sets `EXPO_PUBLIC_API_BASE_URL=http://localhost:4000` which the runtime **rewrites** when a LAN Metro host is detected.

### API modules (`apps/mobile/src/api/modules/`)

`auth`, `ai-chat`, `ai-intake`, `catalog`, `catalogAdmin`, `customers`, `deliveries`, `inventory`, `invoices`, `notifications`, `payments`, `production`, `purchasing`, `quality`, `quotations`, `reports`, `requests`, `returns`, `sales-orders`, `scheduling`, `search`, `settings`, `tasks`, `uploads`, `users`, `workflow`.

Barrel `src/api/index.ts` does **not** re-export deliveries/quotations/settings/workflow/ai-chat (callers import paths). Extra report endpoints also live in `features/reports/api.ts`.

---

## 6. React Query / data state

| Item | Current |
|-------|---------|
| Provider | `apps/mobile/src/providers/QueryProvider.tsx` — `PersistQueryClientProvider` |
| Defaults | `createQueryClient` — staleTime **30s**, `refetchOnReconnect: true`, mutations retry **false** |
| Focus | `focusManager` ← AppState; `refetchOnWindowFocus` not overridden → default **true** |
| Persist | 24h, list whitelist, no mutation dehydrate (`queryPersist.ts`) |
| Infinite | `src/api/infinite.ts`; used by catalog, tasks, orders, production, purchasing, inventory, invoices, returns, users, ai-intake, search, admin-home |
| Scope guard | `keepPreviousListDataIfSameScope` on sales-order lists |
| Optimistic | Delivery load check/uncheck (`delivery-load/query.ts`). Most domains invalidate. |
| Polling | Notifications 60s; EditRequest 30s; AI intake 2s while processing |
| Keys | `apps/mobile/src/api/queryKeys.ts` — `[domain, 'lists'|'details', …]` |
| Invalidation helpers | `invalidateKeys.afterTaskMutation` / `afterPlacementMutation` / `afterScheduleMutation` |

**Duplicated / drifted keys**

- `salesOrders.returnWork` === `salesOrders.returnedCases`
- `purchasing.supplierDetail(id)` unused; live query uses ad-hoc `[...purchasing.all, 'supplier', id]`
- `inventory.fabricBundle` key with no matching `/inventory/fabric-bundle` module caller (route uses FabricDetail + purchasing/inventory APIs)

**Invalidation gaps (examples)**

- Sales-order confirm/hold/cancel: SO lists/detail — not reports/scheduling/invoices/production
- Create invoice: invoices — not SO/payments/statements
- Create PO: PO lists — not low-stock/inventory
- Create return: returns lists only (other return muts are broader)
- Approve AI job: aiIntake only
- Create variant: variants — not catalog lists / adminDetail

**Client counts:** admin journey **counts come from the API** (`journeyCounts`). Some hubs still reduce client-side (worker home, delivery load, receive progress).

---

## 7. Complete feature inventory

### A. Dashboard / Admin Home

- **Screens:** `AdminHomeScreen`, `WorkerHomeScreen`, `DealerHomeScreen`.
- **Routes:** each surface `(tabs)/index`.
- **API:** `GET /reports/admin-home`, `/reports/management-summary`, `/reports/worker-home`, `/reports/dealer-home`.
- **Keys:** `queryKeys.reports.adminHome|managementSummary|workerHome|dealerHome`.
- **Nav:** tab Home. Admin overflow from home/More.
- **State:** live. Multiple admin compositions (`ADMIN_HOME_COMPOSITION`). Fixtures for `/dev` only.
- **Tests:** admin-home ~5, dealer-home ~3, worker-home ~1.

### B. Orders

- **Screens:** `OrdersListScreen` (admin + dealer), `OrderDetailScreen`, journey chips (`AdminLifecycleChips` / `OrdersStageSpine`), `OrderTypeLensBar` (STANDARD/MODIFIED/CUSTOM), `OrdersFilterSheet`, production-plan CTA.
- **API:** `listSalesOrders` (`page`, `pageSize`, `journeyBucket`, `orderType`, `q`, …), `getSalesOrder`, confirm/hold/cancel, production-setup/release.
- **Journey:** Preparing / Ready to start / In production / Ready to ship / Shipped / Delivered. Classifier: mobile `adminOrderJourney.ts`; API `apps/api/src/modules/sales-orders/admin-order-journey.ts`.
- **Preparing CTA:** `resolveOrderPrimaryCtaHref` → `…/orders/:id/production-plan`.
- **Returned lens:** `/sales-orders/return-work` via `ordersReturnedLens.ts` (not merely `returned=true`).
- **Dealer:** same list/detail with cost stripped in selectors (`selectOrderCard`, `selectOrderDetail`).
- **Permissions:** tab `sales-order.read`; plan `production-order.read`.
- **Models:** `SalesOrder`, `SalesOrderLine`, setups, `ProductionOrder`.
- **Tests:** ~30 under `features/sales-orders/__tests__`.
- **Gaps:** order detail ungated; god-file size.

### C. Customer requests / RFQ

- **Dealer:** `NewOrderScreen`, `OrderBasketScreen`, `EditRequestScreen`, handwritten `ScanReviewScreen`.
- **Admin:** Orders desk mode **Customer requests** + `AdminRequestDetailScreen` (`/(admin)/requests/[id]`).
- **API:** `/requests` create/update/submit/review/needs-info/verify/quotation/close.
- **Perms:** `request.create` to start; admin workspace ungated on route.
- **Models:** `RequestForQuotation`, `RequestItem`.
- **Tests:** ~23.

### D. Production Plan

- **Canonical:** `OrderProductionPlanScreen` always mounts `OrderProductionPlanEditorScreen`. `ensureOrderProductionPlan` → `POST /sales-orders/:id/production-setup/ensure-plan` if POs missing.
- **Also:** `/(admin)/production/[id]/plan` editor by PO id.
- **API:** plan-setup GET/PUT, catalog seed, mark-ready, `releaseOrderProductionSetup`, release-preview, `suggestPlanSchedule`, `assignTask`.
- **Perms:** `production.setup.edit|view|release`; route `production-order.read`.
- **Standard / modified / custom:** `ManufacturingComplexity` on lines; custom/modified unlock materials review + workflow customize.
- **Release:** `POST …/production-setup/release` sets `releasedToFactoryAt`.
- **Legacy:** `OrderProductionSetupHomeScreen` / `OrderProductionSetupLineScreen` still in tree; line screen **unimported**.
- **Tests:** production-setup selectors + plan IA tests.

### E. Production

- **Board:** `ProductionOverviewScreen` — buckets `needs_setup`, `ready_to_start`, `on_floor`, `blocked`, `inspection_packaging`, …; day lens planned vs actual (`ProductionDateMode`).
- **Detail:** `ProductionDetailScreen` — identity, hub jump Overview/Materials/WIP/Tasks, fabric tracker, schedule strip, attention (`productionAttention.ts`).
- **Tasks:** `TaskDetailScreen` (admin + worker), materials, WIP kits, QC, packaging, dismantle/recover.
- **API:** `/production-orders`, `/tasks/:id/*`, `/production/problems`, materials, start, return-to-preparing.
- **Perms:** tab any PO/task read; problems `production-task.update-any`.
- **Models:** `ProductionOrder`, `ProductionTask`, `ProductionStageInstance`, `WipKit`, usage rows.
- **Tests:** production ~14, production-flow ~8, tasks ~24.

### F. Scheduling (canonical today)

**Live UI**

- `AdminSchedulingScreen` — month board (`FactoryMonthBoard`) + selected **day** workspace (`FactoryDayWorkspace`). Week is a **filter range**, not a separate Gantt. Worker week strip inside `WorkerDaySheet`.
- Dealer: `DealerDeliveryCalendarScreen` (`schedule.read.own`).

**Canonical write path**

`POST /tasks/:id/assign` → API `TasksService.assign` → `placement.placeTask` updates **both** `ProductionTask.plannedStart/plannedCompletion` and `ScheduleAllocation`.

Unscheduled “Schedule” UI places by sequential `assignTask`, **not** `generate` + `apply-moves`.

**Promise / delivery commitment:** `ProductionSchedule` approve/unapprove + `dealer-date`. Read via `getOrderSchedule` / `own-deliveries`.

**What the home actually uses**

- `GET /scheduling/summary` (today / week / unscheduled / atRisk / conflicts / overtime)
- `GET /scheduling/calendar?view=month`
- `GET /scheduling/capacity` (month coloring)
- `GET /scheduling/day`
- `GET /scheduling/unscheduled`
- Calendar exceptions (open/close/overtime)

**Live mutations**

1. Approve / unapprove schedule  
2. Dealer date change (admin sheet + order detail)  
3. `assignTask` (unscheduled + plan + production)  
4. Calendar exception add/delete  
5. Pin / unpin allocation (`WorkerDaySheet`)  
6. Availability check (RFQ / change date) — query  
7. `recalculateSchedule` after workflow minute customize  
8. Product stage estimates patches (catalog workflow times)  
9. `suggestPlanSchedule` on plan editor  

**Client exists, screens do not use**

`generateSchedulePreview`, `applyReviewedAllocations`, conflict resolve APIs, at-risk resolve APIs, `useSchedulingConflictsQuery`, `useSchedulingDashboardQuery`, `FactoryCapacitySection`, most of `AdminScheduleSheets.tsx` (2185 LOC monolith; only a few sheets imported).

**Conflicts today:** flags on calendar cards + summary count — **not** dedicated resolve UI.

**Capacity today:** month load coloring + day facts. Dedicated `FactoryCapacitySection` **unmounted**.

**Actual vs planned:** production board `dateMode`; factory day rows carry actual/elapsed/estimated minutes.

### G. Inventory

- **Hub:** `InventoryGroupsScreen` / `InventorySignatureHome` — lifecycle RAW/SEMI/FIN + items/transfers/counts + scan.
- **API:** `/inventory/*` plus split `/warehouses` for some desk writes.
- **Mutations:** receive, issue, adjust, transfer, counts, warehouse CRUD, PO receive.
- **Reserve:** `reservedQty` **display-only**. No mobile reserve mutation.
- **QR:** see §15.
- **Tests:** ~23 including `inventoryQrMatrix.test.ts`.

### H. Fabric (detailed)

**Entities:** `FabricProcurement` (+ events), inventory `FabricHolding`, lots with `scanKind: 'ORDER_FABRIC'` / `FB-` QR.

**Grouping:** `groupFabricRowsBySalesOrder` in `selectFabricTracker.ts` → Purchasing Fabric tab + Inventory `FabricDeskSection`.

**Tracker API:** `GET /fabric-procurements`, `GET /fabric-procurements/orders/:salesOrderId`, wait/redirect/supplier-state/override/receive/allocate-from-stock, WhatsApp draft/send.

**Holding:** `GET /inventory/fabric-holding`; holding location required on receive.

**Worker take-in:** `verdictFabricTakeInScan` (`match | wrong_order | wrong_fabric | not_arrived | unknown`) → `POST …/tasks/:taskId/take-in`.

**Surfaces:** Purchasing Fabric tab; `FabricDetailScreen` (bundle code **or** procurement id); Production detail / Order detail / Plan editor embed `FabricTrackerBoard`; setup line `SetupFabricSection` is catalog fabric, not tracker.

**Readiness:** `FabricReadiness.readyForProduction` / derived status / missing / attentionCode — blocks production start when fabric not ready (server + UI).

**Permissions:** `fabric.procurement.read|manage`, `production.fabric.override`, inventory.receive/read, sales-order.read, purchase-order.read.

### I. Purchasing

- **Hub:** orders / fabric / supplier invoices (`PurchasingHubScreen`).
- **Builder:** full-screen `PurchaseOrderBuilderScreen` (`/purchasing/new`). `CreatePurchaseOrderSheet` is **orphaned**.
- **Receive:** `ReceiveQueueScreen` / `ReceiveGoodsScreen` (also under inventory/receive routes).
- **Low stock:** `LowStockReviewScreen` + drafts.
- **WhatsApp:** `PurchaseWhatsAppPreviewSheet` for PO/run/fabric.
- **Tests:** ~25.

### J. Returns (detailed)

- **Case:** `ReturnRequest` lifecycle + charge + reship.
- **Piece:** `ReturnPiece` decisions **`REPAIR | REPLACEMENT | SCRAP_RECOVERY`**.
- **Workflows:** scrap → `RETURN_RECOVERY`; else repair/replacement production (`returnPiece.ts` `defaultReturnWorkflowId`).
- **Origins on POs:** `RETURN_WORK`, `REPLACEMENT`, `RETURN_RECOVERY` (production selectors + plan editor + inventory cards).
- **Dismantle & Recover:** `DismantleRecoverFloorPanel` on recovery tasks; `recordReturnRecoveryLine` / `postReturnRecoveryLine`.
- **Dealer:** `mapReturnLifecyclePhase` hides scrap internals.
- **Orders Returned:** `ordersReturnedLens.ts` → `/sales-orders/return-work`.
- **RESTOCK:** API rejects as piece decision (`return-decision.spec.ts`). Mobile never offers it. Case-level `inventoryFate` may still show `RETURN_TO_STOCK` as a **label**.
- **Gap:** `outboundEligible` / `outboundReady` typed on API, **unused in UI**.
- **Tests:** returns selectors + i18n + dismantle floor.

### K. Delivery

- **Worker/admin load:** `DeliveryLoadSheetScreen` — package checklist, FIN lot QR (`nextUnloadPieceForLotQr`), depart when `canDepart`.
- **API:** `GET /deliveries/:id/load-sheet`, check/uncheck, `POST …/depart`, `POST …/confirm-receipt`.
- **Phases:** `deliveryHumanPhase.ts` — planned/ready/shipped/delivered/attention. `OUT_FOR_DELIVERY`/`SHIPPED` → shipped.
- **Dealer:** `DealerReceiptsListScreen` / `DealerReceiptDetailScreen`. Confirm via same confirm-receipt mutation (also on orders desk).
- **Empty:** `features/deliveries/.gitkeep`.
- **Gap:** admin “all deliveries” list is thin; worker uses `mine: true`.

### L. Invoices

- List desk: all | orders | returns | purchasing.
- Create from creatable sources (ORDER / RETURN / PURCHASING).
- PDF, apply credit, record payment, edit.
- **JoFotara: REMOVED.** Evidence: `apps/api/src/modules/invoices/jofotara-removed.spec.ts`; settings `DEAD_INTEGRATION_KEYS` strip `jofotara*`; mobile `selectInvoice.test.ts` asserts no `jofotara` property. **Do not assume e-invoice UI exists.**

### M. Payments

- No `features/payments/` folder.
- Dealer: `DealerPaymentsScreen` (read + PDF) — `payment.read`.
- Admin record: `RecordPaymentSheet` on invoice (`payment.record`).
- Supplier payments on SI detail.
- API: `apps/mobile/src/api/modules/payments.ts`.

### N. Dealer statement

- Dealer: `DealerStatementScreen` — `GET /statements/:customerId` + PDF. Gate `statement.read`.
- Admin CRM: `DealerDetailScreen` SOA tab + `StatementRangeSheet`.

### O. Products / Catalog

- Dealer browse: categories, all/favorites/ordered, PDP, gallery, dealerPrice (not manufacturingCost).
- Admin: catalog manage, variants (`STD` + named), spec options, dealer prices per variant, product production-setup (workflow/BOM/estimates).
- Deep link into new-order: `newOrderDeepLink.ts` (`productId`, `variantSku`, `fromCatalog=1`).
- API: `catalog.ts` browse vs `catalogAdmin.ts` manage.

### P. Dealers / Customers

- `DealersListScreen` / `DealerDetailScreen` (orders, production, completed, SOA, payments, invoices, price list).
- CRM sheets: address/contact/note/price/credit.
- Perms: `customer.read` / `customer.create`.
- **Note:** dealer CRM order cards can show `manufacturingCost` (admin viewing a dealer). Dealer-facing VMs strip it.

### Q. Employees / Workers / Users

- `UsersListScreen` segments: workers | staff | customers | admins | all.
- `StaffTypeEditorScreen` — permission catalog from `@maher/permissions`.
- Hourly rate: `features/users/hourlyRate.ts` + users API (labor costing).
- Gate: `user.manage` / `role.manage`.

### R. Notifications

- Inbox shared + employee tab.
- `mapNotificationLinkToHref` — orders, invoices, returns, statement, quotations, requests, ai-intake (admin), tasks (employee).
- `registerPushDevice` requires `notification.read`; comments say **server delivery not implemented**; Expo Go no-ops.
- List poll 60s.

### S. Settings

- More hub, account (password, MFA, biometrics, locale/theme), `AdminSettingsScreen` (`settings.manage`).
- Integrations UI: email console/smtp, WhatsApp console/twilio/meta, SMS, AI mock/openai, OCR mock/local/tesseract/openai/http, inbound flags.
- Locale: `ExpandableLocaleSwitcher`.

### T. AI / Order intake

- **Intake:** list/review jobs (`AiIntakeListScreen`, `AiReviewScreen`). Approve can create RFQ. Perms `ai-intake.read|manage`. **Not in overflow tiles.**
- **Chat:** `AiChatbotScreen` admin + dealer (`ai-chat.read`).
- **Handwriting:** New Order `useHandwrittenScan` + `extractPreview`.
- OCR jargon hidden from dealer copy (`aiIntakeHumanState.ts`).
- WhatsApp/email as **purchasing/fabric send**, not a general inbox. Provider keys in Admin Settings.

### U. Search

- Dedicated `/(app)/search` **redirects to admin home**.
- Live: `AdminHomeSearchResults` → `GET /search`.
- Deep-link salvage can still present `GlobalSearchScreen`.
- Hits: product, sales_order, invoice, inventory, request, customer→dealers (`searchHits.ts`).

### V. Scanner / Universal QR

See §15.

### W. Photos / attachments / camera / documents

- QR camera: `expo-camera` (`CodeScannerScreen`).
- Photos: `expo-image-picker` (catalog, AI, requests, tasks, returns, accessories).
- Documents: `expo-document-picker` (AI, RFQ uploads).
- Voice: `expo-audio` problem notes; `expo-speech` **lazy-loaded** via `nativeSpeech.ts` (guard test: TaskDetailScreen must not static-import it).
- Maps: `react-native-maps` `LocationMapPicker` for delivery pins (`expo-location`).
- Upload: `POST /uploads` XHR.

### X. Reports / Cost & Performance (current only)

- If `inventory.cost.read`: tabs money | orders | products | returns | coverage. Labor: `/reports/cost/labor-rates`, `/reports/cost/labor`.
- Else fallback dashboard/sales/production/financial.
- Dossiers: `GET /reports/cost/orders/:id`, `/reports/cost/returns/:id`, products, coverage, backfill.
- Periods: today | week | month.
- **Do not assume** planned analytics that are not in `ReportsScreen` / `api/modules/reports.ts`.

### Y. Other live features

- Workflow authoring (`WorkflowListScreen`, `WorkflowDetailScreen`, `ManageStagesScreen`, `ProductionSetupScreen` for **products**).
- Quality on task floor (`InspectionFloorPanel`, `PackagingConfirmPanel`, `QcFailSheet`) — not a tab.
- Component lab (`src/dev/component-lab`).
- PDF helpers (`features/pdf`).
- Dealer glass/UI leftovers (`dealer-ui`) still used in spots (`DealerGlassCard` uses BlurView — not floor recipe).

---

## 8. Order lifecycle — mobile view

Boundary comment in `adminOrderJourney.ts`: **Preparing ↔ Production = Release to factory**.

```mermaid
flowchart LR
  RFQ[Dealer RFQ] --> Quote[Quotation]
  Quote --> SO[SalesOrder]
  SO --> Prep[Preparing / Plan]
  Prep -->|release| RTS[Ready to start]
  RTS -->|first task start| Floor[In production]
  Floor --> Pack[QC / Pack]
  Pack --> RFD[Ready to ship]
  RFD -->|depart| Ship[Shipped]
  Ship -->|confirm-receipt| Del[Delivered]
```

| Transition | Role | Screen | Mutation / API | Resulting state | Next nav |
|-----------|------|--------|----------------|-----------------|----------|
| Create request | Dealer (`request.create`) | `NewOrderScreen` / basket | `POST /requests` | RFQ draft | request detail / submit |
| Submit RFQ | Dealer | `EditRequestScreen` | `POST /requests/:id/submit` (module) | submitted | wait / account |
| Factory review | Admin | `AdminRequestDetailScreen` | review / needs-info / ready-for-quotation | RFQ stages | stay in workspace |
| Create/send quote | Admin | `AdminQuotationDetailScreen` | `/quotations` submit/approve/send | quote sent | dealer quote |
| Accept quote | Dealer | `DealerQuotationDetailScreen` | `acceptQuotation` | SalesOrder | dealer order |
| Confirm commercial | Admin | `OrderDetailScreen` | `confirm` / `confirm-commercial-prices` | SO confirmed / ready | Preparing |
| Open plan | Admin | Orders Preparing CTA | `ensureOrderProductionPlan` | draft POs | `…/production-plan` |
| Edit plan | Admin (`production.setup.edit`) | `OrderProductionPlanEditorScreen` | plan-setup PUT, materials, `assignTask`, `suggestPlanSchedule` | setup READY_FOR_RELEASE | stay |
| **Release to factory** | Admin (`production.setup.release`) | Plan desk / release sheet | `POST /sales-orders/:id/production-setup/release` | `releasedToFactoryAt`; journey **ready_to_start** | order / production |
| Start execution | Admin / worker | Plan start / `startTask` / `startProductionOrder` | `POST /production-orders/:id/start` and/or `POST /tasks/:id/start` | `actualStartDate`; journey **in_production** | production detail / task |
| Return to preparing | Admin | Production | `POST /production-orders/:id/return-to-preparing` | release cleared | plan |
| QC / pack | Worker / QC | `TaskDetailScreen` | quality inspections, `completeTask` (+ packaging labels) | stage complete | next task |
| Ready for delivery | System / pack complete | Production / orders | SO `READY_FOR_DELIVERY` | journey **ready_to_ship** | delivery load |
| Depart | Delivery (`delivery.update`) | `DeliveryLoadSheetScreen` | `POST /deliveries/:id/depart` | `OUT_FOR_DELIVERY` | shipped |
| Dealer confirm | Dealer | receipts / orders | `POST /deliveries/:id/confirm-receipt` | `DELIVERED` | delivered |

Hold/cancel: `useSalesOrderActions` on detail.

### RETURN lifecycle (mobile)

Dealer `CreateReturnScreen` → `POST /returns` → admin receive (`return.receive`) → piece decide (`REPAIR|REPLACEMENT|SCRAP_RECOVERY`) → production origin `RETURN_WORK` / `REPLACEMENT` / `RETURN_RECOVERY` → recovery post / reship / mark ready. Dealer never sees scrap internals.

### FABRIC lifecycle (mobile)

SO/plan fabric requirement → `FabricProcurement` row on Purchasing Fabric tab → wait/redirect/PO/WhatsApp → receive into **holding location** → lot QR `ORDER_FABRIC`/`FB-*` → worker **take-in** on prep task → `FabricReadiness.readyForProduction` → production start unblocked.

---

## 9. Data model / domain map (mobile’s understanding)

Prisma models live in `packages/database/prisma/schema.prisma`. Mobile never imports Prisma; it uses DTO types in `src/api/modules`.

| Entity | Why mobile uses it | Key relations | UI owner |
|--------|--------------------|---------------|----------|
| `SalesOrder` | Commercial order + journey | customer, lines, POs, deliveries, invoices | Orders |
| `SalesOrderLine` | Basket item; `variantId` | product/variant, line setup | Orders / Plan / Catalog |
| `ProductionOrder` | Factory job per line | SO line, tasks, snapshot, instructions | Production / Plan |
| `ProductionTask` | Executable stage work + **planned/actual times** | PO, stage, allocations, usage | Tasks / Scheduling |
| `ScheduleAllocation` | Calendar window; dual-written with task | optional `productionTaskId` | Scheduling |
| `ProductionSchedule` | Order promise / approve | SO | Scheduling / order date |
| Worker / `User` | Assign, rates, skills | laborRate, departments | Users / Plan / Tasks |
| `Product` / `ProductVariant` | Identity vs sellable unit | BOM, notes, workflow, prices | Catalog |
| `InventoryItem` | SKU stock | balances, lots | Inventory / Purchasing |
| `InventoryLot` | SEMI/FIN/fabric lots + QR | order, kit, procurement | Inventory / Fabric / Delivery |
| `InventoryTransaction` | Ledger | item, warehouse | Item detail / cost |
| `Warehouse` / `WarehouseLocation` | RAW/SEMI/FG + bins | BIN QR | Inventory |
| `FabricProcurement` | Order fabric job | SO, PO, lots | Fabric / Purchasing |
| `ReturnRequest` / `ReturnPiece` | Case + piece decisions | SO, recovery POs | Returns |
| `Invoice` / `Payment` | AR | SO/return/purchasing | Invoices / Account |
| `Delivery` / `DeliveryLoadPiece` | Load + depart + confirm | SO, FIN lots | Delivery |
| `WipKit` | Physical handoff | tasks, pieces, QR | Production / Tasks / Inventory |
| `RequestForQuotation` | Intake | items → quote → SO | Requests |

There is **no** separate Prisma model named `FabricRequirement` in the grep of schema; mobile talks about fabric **readiness / tracker rows / holding**. Requirements are expressed as procurement + line materials.

---

## 10. Design system

**Skill:** `.cursor/skills/mobile-floor-aesthetic/SKILL.md`  
**Rule:** `.cursor/rules/mobile-floor-aesthetic.mdc` on `apps/mobile/src/features/**/*.{ts,tsx}`

**Feel:** boards on linen parchment (`#E1DFD3`), Army Camo brand `#776245`, olive/amber/sienna semantics. **No UI blue / traffic red / Material FABs** on canonical floors.

### Tokens (`apps/mobile/src/theme/`)

| Token | File | Notes |
|-------|------|-------|
| Colors | `colors.ts` | light + dark parchment |
| Spacing | `spacing.ts` | 4pt scale |
| Radii | `radius.ts` | `xl` = 20 (boards) |
| Shadows | `elevation.ts` | boards use `orderBoardShadow` |
| Type | `typography.ts` | max 3 weights; Arabic titles `medium` |
| Motion | `theme/motion.ts` + `src/motion` | press 0.985 card / 0.97 button |
| Touch | `sizes.ts` | min 44 |

### How the skill is used

Canonical wrappers: `DealerBoard`, `InvoiceFloorBoard`, `PurchasingFloorBoard`, `ProductionIdentityBoard`, `InventoryBoardCard`, `InventoryIdentityBoard`, `UserFormSection`, `OrdersRfqInboxChips`, `RequestIdentityBoard`, `BottomSheet`.

Rails: `PurchasingTabBar`, `ReportsTabBar`, `ProductionHubJump`, `UsersSegmentRail`, `DealerSummaryRail`, `OrdersRfqInboxChips` (3+2, never horizontal ScrollView).

**Strong floors:** dealers, invoices, purchasing, users, reports, production, inventory, orders (+ returns/fabric mostly).

**Still SaaS / `SurfaceCard`:** admin-home metric/activity lists, `GlobalSearchScreen`, AI intake/review, workflow editor sections, `PendingOutboxBanner`. `dealer-ui/DealerGlassCard` blur glass.

**Duplication:** many board shells copy the same recipe instead of one `FloorBoard`.

**Nesting / docks:** skill wants usage rows as **siblings** of materials header, not nested. `FloatingActionDock` + tab clearance; overflow hidden on boards can clip if dock is nested incorrectly.

**RTL:** `flexDirection` reverse, rail/chevrons flip, no uppercase/letter-spacing for `ar`. Native layout locked LTR (`lockNativeLayoutLtr.ts`) so Yoga does not double-flip.

---

## 11. Mobile component inventory

| Kind | Examples | Reuse |
|------|----------|-------|
| Buttons | `PrimaryButton`, `SecondaryButton`, `TertiaryButton`, `DestructiveButton`, `IconButton` | floors + sheets |
| Press | `AnimatedPressable` | required by skill |
| Boards | `DealerBoard` and ~90 `*Board*.tsx` | duplicated shells |
| Sheets | `BottomSheet`, `ConfirmationSheet`, `ActionSheet` + ~125 feature sheets | several **orphans** (§23) |
| Status | `StatusBadge`, `FloorStatus` | |
| Order cards | `laneOrderCard.ts`, production `ProductionOrderCard` | |
| Product | `ProductThumb`, catalog cards | |
| Worker/task | `WorkerTaskCard`, `ProductionTaskCard` | |
| Timeline | `WorkerTimelineBoard`, `FactoryMonthBoard` | scheduling |
| Inventory | `InventoryBoardCard`, material/WIP/FG cards | |
| Scan | `CodeScannerProvider`, `CodeScannerScreen`, `CodeField` | |
| QR display | `react-native-qrcode-svg`, `InventoryQrSheet` | |
| Search/filter | `OrdersFilterSheet`, purchasing/users/invoice triggers | |
| Empty/error | `EmptyState`, `ErrorState`, skeletons | |
| Feedback | toast queue, `OfflineBanner` | |

Likely duplicates: invoice dealer vs party sheets; purchase create sheet vs builder; QC fail sheets; board wrappers.

---

## 12. i18n / RTL

**Package:** `packages/i18n` — `main: dist/`, **`react-native: src/index.ts`** (Metro uses src). Namespaces include `mobile`, `errors`, `lifecycle`, `statuses`, domain JSON for ar/en/he.

**Switching:** `LocaleProvider` stores locale in SecureStore `maher.locale`. Default locale **ar**.

**Numbers/dates:** `format.ts` forces Latin digits (`en-JO-u-nu-latn`). Money/codes `dir="ltr"`.

**Missing key behavior:** English → defaultLocale → **returns the key** (`translate.ts`).

**Parity:** en/ar/he leaf counts match for `mobile` (~6070 leaves reported by audit exploration).

**Leaks (examples)**

| Issue | Path |
|-------|------|
| English fallbacks for missing keys | `DealerCrmSheets.tsx` (address hint keys absent from messages) |
| `label(key, 'English…')` | `AdminProductDetailScreen.tsx`, `ReturnDetailScreen.tsx`, `CreateWarehouseSheet.tsx`, `MeasurementValueSheet.tsx` |
| Date placeholders | `FabricDetailScreen.tsx`, `EditInvoiceSheet.tsx`, `AdminQuotationDetailScreen.tsx` |
| Raw API status | `InventoryScanResultSheet.tsx` `{demand.status}`; `CostOrderDossierScreen.tsx` `{tx.type}`; `ProductionMaterialsCard.tsx` `type.replace(/_/g, ' ')` |
| Setup status key leak | `OrderProductionSetupHomeScreen.tsx` raw `setup.status` |
| Skeleton a11y English | `SkeletonLoader.tsx` `"Loading"` |
| Biometric English | `biometrics.ts` `'Face ID'` / `'Touch ID'` |

---

## 13. Loading / error / empty / offline

Pattern on most lists: skeleton → `ErrorState` + `onRetry` → `EmptyState`. Query **load** errors are **not** globally toasted (`queryClient.ts` comment); mutation errors toast.

**`return null` blanks:** `DealerAccountScreen` / `MoreHubScreen` / `MoreAccountScreen` / `WorkerProfileScreen` if `!user`; workflow list/manage if `!allowed`; setup home/line if `!setup`/`!line`; `AiReviewScreen` if `!path`.

**Empty vs failed:** generally distinguished. Permission denial sometimes `EmptyState`, sometimes `ForbiddenView`, sometimes `null`.

**Offline:** `OfflineBanner`, auth offline screen, client `assertOnline`.

**Fake data:** not on live empty API (see §14).

---

## 14. Mock / dev / fixture audit

| Occurrence | Class |
|------------|--------|
| `features/*/fixtures.ts`, `detailFixtures.ts`, `journeyLaneFixtures.ts` | UAT / `/dev` |
| `app/dev/**` `__DEV__` redirect | safe-dev |
| `src/dev/component-lab/**` | safe-dev |
| `CodeScannerScreen` `DEV_SIMULATE` | safe-dev manual entry |
| `no-production-fixture-imports.test.ts` | production guard |
| jest mocks | test-only |
| `tasks/fixtures.ts` `token=demo` | UAT only |
| `NewOrderScreen` comment `db:seed:demo` | comment |

**Production screens do NOT import fixtures** (enforced). Empty API → empty boards, not bundled demo orders.

Admin settings **AI/OCR `mock` providers** are real integration modes for the **backend**, not fake rows painted when queries fail.

---

## 15. Scanner / QR architecture

**Camera types** (`CodeScannerScreen`): qr, ean13, ean8, upc_a, upc_e, code128, code39, code93, itf14, codabar.

**Shared parsers** (`packages/types/src/scan-code.ts`): inventory item (`qrCode` or SKU); `WIPKIT:` / `WIPPIECE:`; `BIN:` id / `BIN-{WH}-{LOC}` printed.

**Universal resolver** `resolveInventoryScan` statuses: `FOUND`, `FOUND_KIT`, `FOUND_LOT`, `FOUND_BIN`, `ORDER_FABRIC`, `NOT_FOUND`, `ERROR`. Order: bin → kit → lot (fabric if `scanKind==='ORDER_FABRIC'` or procurement or `FB-`) → item.

**IDENTIFY destinations** (`InventorySignatureHome.runIdentifyScan`): bin sheet, kit sheet, navigate fabric-bundle, FG/semi lot sheets, item result sheet (receive/issue/transfer/count/details/QR/purchasing).

**VERIFY** (`useLabelVerifyScan`): `MATCH | MISMATCH | UNKNOWN | ARCHIVED | DISALLOWED | ORDER_FABRIC | ERROR`.

**Other scanners (not always universal):** warehouse bin pick, PO builder (FOUND item), task materials `identifyTaskMaterial`, fabric take-in verdicts, delivery FIN lot QR, returns receive **bin only**, `CodeField` passthrough.

**Ambiguity:** same camera, no per-kind barcode filter; lot vs fabric vs kit distinguished after API lookup. Printed SKU vs QR code both valid for items.

---

## 16. Native / Expo configuration

| Item | Current |
|-------|---------|
| Name | Maher Al-Aghbar Furniture |
| Slug | `maher-aghbar-furniture` |
| Version | `0.1.0` |
| Bundle / package | `jo.maheraghbar.furniture` |
| Scheme | `maher` |
| Orientation | portrait |
| Splash | parchment `#E1DFD3` |
| Icon | `./assets/icon.png` |
| `expo-dev-client` | `~6.0.21` |
| Plugins | router, secure-store, localization (`supportsRTL: false`), local-auth, location, image-picker, audio, camera, document-picker, notifications **or** personal-team plugin |
| iOS team | `APPLE_TEAM_ID` or personal `NR2ZFUP7R7` |
| Push | stripped on local Personal Team (`stripIosPush`) — inbox still API |
| Associated domains | `EXPO_ASSOCIATED_DOMAIN` |
| EAS project | `bd5ccf7c-9b99-4bc5-a0bc-2a52d781c023` default |
| Profiles | `eas.json`: development (sim, `10.0.2.2`), development-device (`localhost` — rewritten), preview `https://api.staging.maheraghbar.jo`, production `https://api.maheraghbar.jo` |
| Physical iPhone | `docs/mobile-iphone-dev-build.md` — **dev client, not Expo Go 57** |

---

## 17. Dependencies (`apps/mobile/package.json`)

| Concern | Packages |
|---------|----------|
| Navigation | `expo-router`, `@react-navigation/native`, `@react-navigation/bottom-tabs` (install exclude) |
| Networking | fetch via `api/client` (no axios) |
| Query | `@tanstack/react-query` + persist + async-storage persister |
| Forms | `react-hook-form`, `@hookform/resolvers`, `zod` |
| Camera/scan | `expo-camera`, `react-native-qrcode-svg` |
| Images | `expo-image-picker` |
| Files/PDF | `expo-document-picker`, `expo-file-system`, feature PDF openers |
| Motion | `react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets` |
| Storage | `expo-secure-store`, `@react-native-async-storage/async-storage` |
| Charts | **none** (reports are boards/tiles, not chart lib) |
| Date/time | platform / locale formatters (no moment/dayjs dep) |
| Localization | `expo-localization`, `@maher/i18n` |
| Notifications | `expo-notifications` |
| Maps | `react-native-maps`, `expo-location` |
| Blur | `expo-blur` (login, tab bar, chat, glass card) |
| Audio/speech | `expo-audio` (used); `expo-speech` lazy |
| Clipboard | `expo-clipboard` |
| Haptics | `expo-haptics` |

**Unused/risky:** `expo-speech` not static-imported (intentional). `react-dom` present for RN web interop, not a second UI. No FlashList. No Detox package.

Workspace versions: Expo 54 / RN 0.81.5 / React 19.1.0 pinned together.

---

## 18. Types / contract drift

| Drift | Evidence |
|-------|----------|
| `TaskStatus` vs `ProductionTaskStatus` | `api/modules/tasks.ts` `NOT_STARTED|READY|PAUSED|READY_FOR_INSPECTION…` vs `@maher/types` PENDING/ON_HOLD vocabulary |
| `PaymentMethod` + `'OTHER'` | `payments.ts` vs types CASH/BANK_TRANSFER/CHEQUE/CARD |
| `ManufacturingComplexity` local alias | `sales-orders.ts` vs `ManufacturingComplexityCode` |
| `CustomerType` copy | `customers.ts` |
| Warehouse URLs | list `GET /inventory/warehouses` vs `POST /warehouses` |
| Production summary | `GET /reports/production-summary` not under production-orders |
| Sales-order `loadStatus` | comments mark `partial`/`complete` legacy aliases |
| Reports split | extra paths in `features/reports/api.ts` |
| Dealer prices | both `catalogAdmin` and `customers` |
| Upload URLs | resolved against origin, not always `/api/v1` |
| `as any` | exists in fat screens (not exhaustively listed; treat as hotspot risk) |

Mobile **does** import shared helpers: `classifyDealerLifecycle`, `parseBinScanCode`, `rollupOrderType`, `isReturnWorkflowScope`, `isDeliveredSalesOrderStatus`.

API fields mobile ignores: many (e.g. returns `outboundEligible*`, unused scheduling generate payload). Fields mobile assumes: journey flags `releasedToFactory`, `executionStarted`, `journeyBucket` on list — if API omitted them, desk would mis-bucket.

---

## 19. Security / privacy (mobile-specific)

| Sev | Finding | Evidence |
|-----|---------|----------|
| HIGH | Biometric unlock stores username+**password** JSON in SecureStore | `biometrics.ts`; saved from `AuthProvider` login |
| HIGH | MFA secret rendered in clear in account UI | `MoreAccountScreen` `{mfaSecret}` |
| MEDIUM | Pending MFA keeps password in React state | `AuthProvider` `pendingMfa` |
| MEDIUM | Upload download URLs may include tokens; client concatenates origin | `uploads.ts` |
| MEDIUM | Ungated deep links to order/quote/request/cost dossiers | route files with no `PermissionGate` |
| MEDIUM | Inventory tab with only PO.read | tabConfig vs nested gates |
| LOW | Tokens in SecureStore (correct) | `tokens.ts` |
| LOW | `EXPO_PUBLIC_*` comment forbids secrets | `config.ts` |
| LOW | QR session loggers no-op | `qrSessionLog.ts` |
| LOW | Dealer cost: selectors strip manufacturingCost; **admin dealer CRM cards can show it** | `DealerOrderCard` vs `selectOrderCard` |
| LOW | Worker isolation depends on API payloads; UI `assignedToMe` | `selectWorkerLane.ts` |
| — | JoFotara secrets | **removed** from live settings responses |

No CRITICAL hardcoded API keys found in mobile env. This is **not** a pentest.

---

## 20. Performance

| Risk | Evidence |
|-------|----------|
| Mega-screens | AdminScheduleSheets 2185; OrderDetail 2131; TaskDetail 1989; ProductionDetail 1945; Plan editor 1900; InventorySignatureHome 1781; NewOrder 1779 |
| Unvirtualized lists | `SuppliersListScreen` maps rows in ScrollView; many hubs map inside ScrollView |
| Nested scroll | widespread `nestedScrollEnabled` in sheets |
| Client reduce | worker-home, delivery-load, receive progress |
| Images | carousels + Unsplash catalog URLs (network size depends on API) |
| No FlashList | FlatList used on some floors |

---

## 21. Accessibility / phone UX

- Touch min 44 on buttons/leads; reduced-motion respected in press.
- Many `accessibilityRole`/`Label` on rails.
- Gaps: English `"Loading"` labels; MFA secret as text; huge screens = long first JS; nested sheets vs keyboard; portrait-only config.
- Sticky docks + tab bar clearance implemented; clipping risk if dock inside `overflow: hidden` board.
- RTL is JS-only; absolute `left`/`right` without `pinStart` is a known class of bugs (not exhaustively scanned).

---

## 22. Tests

| Layer | Current |
|-------|---------|
| Jest | `apps/mobile/jest.config.js` — jest-expo, `@/` mapper, `jest.setup.js` mocks SecureStore/AsyncStorage/NetInfo |
| Count | **336** `*.test.ts(x)` |
| Placement | almost always `src/features/<domain>/__tests__/` |
| Harness | `src/test/sheetContract.ts`, `sheetHarness.tsx`, `screenHarness.tsx` |
| CI | `.github/workflows/ci.yml` runs `pnpm --filter @maher/mobile typecheck` then `test` (Node 20) |
| Maestro | `.maestro/config.yaml` + `e2e/mobile/*.yaml` (13 flows) via `pnpm mobile:e2e`. **Not in blocking CI** |
| Detox | **absent** |
| Playwright | admin-web/API; not mobile UI |

**Important test groups:** sales-orders, i18n, purchasing, tasks, requests, inventory (QR matrix), catalog, production, scheduling, navigation, api client.

**Thin/zero:** `more/__tests__` empty, `ai-chatbot` 0, `dealer-ui` 0.

**This audit did not run Jest.** Typecheck passed. Unknown currently-failing tests on this machine.

---

## 23. Dead / legacy / duplicated code

| Path | Symbol | Why | Confidence | References |
|------|--------|-------|------------|------------|
| `src/features/sales-orders/production-setup/OrderProductionSetupLineScreen.tsx` | screen | No imports; plan editor is canonical | High | self |
| `src/features/quality/components/InspectionPieceFailSheet.tsx` | sheet | Live uses `QcFailSheet` | High | self |
| `src/features/purchasing/components/CreatePurchaseOrderSheet.tsx` | sheet | Live uses `/purchasing/new` | High | tests strings |
| `src/features/invoices/components/InvoiceDealerSheet.tsx` | sheet | Live uses `InvoicePartySheet` | High | self |
| `src/features/tasks/components/TaskMaterialUsageSheet.tsx` | sheet | No importers | High | self |
| `src/features/requests/components/ProductQuickPickSheet.tsx` | sheet | No importers | High | self |
| `src/features/inventory/components/InventorySemiStagePickerSheet.tsx` | sheet | No importers | High | self |
| `src/features/requests/components/StepIndicator.tsx` | `@deprecated` | `NewOrderStageRail` | High | self |
| `src/features/requests/components/AttachmentRow.tsx` | `@deprecated` | UploadsStep | High | lab registry |
| `src/features/workflow/normalizeWorkflowGraph.ts` | heal helpers | tests only | High | tests |
| `src/features/workflow/rewireWorkflowEdges.ts` `ensureInspectionFeedPatches` | no-op deprecated | High | tests |
| `app/(app)/search/index.tsx` | SearchRoute | redirect stub | High | deep link |
| production-setup + purchasing/create redirects | Redirect | compat | High | old URLs |
| `src/features/deliveries/` | empty | UX in delivery-load | High | gitkeep |
| `src/features/profile/` | empty | worker-profile | High | gitkeep |
| `FactoryCapacitySection` | component | unmounted | High | own file |
| Most `AdminScheduleSheets` | sheets | not imported by home | High | 4 imported only |
| `src/types`, `src/utils` | empty | placeholders | High | gitkeep |

---

## 24. Known technical debt (evidence-backed)

### P0 — correctness / security / data-loss

- Biometric password persistence + on-screen MFA secret (§19).
- God screens as single-regression blast radius (not automatically a data-loss bug, but P0 operational risk for factory flows).
- `TaskStatus` vocabulary drift vs shared types (wrong status mapping could hide work).

### P1 — major broken or misleading workflow

- Dead 1k+ LOC setup line screen still in tree (looks like product).
- Scheduling generate/conflict-resolve **looks** like product in API module but is unused — ChatGPT must not assume it is live.
- Reports tile vs cost permission mismatch.
- Ungated commercial/cost deep links.

### P2 — UX / integration

- Search route stub; AI intake undiscoverable.
- Empty feature folders; 125 sheets with orphans.
- Maestro not in CI.
- `dump.rdb` in `apps/mobile/`.
- Upload/PDF skip shared client (refresh/timeout).

### P3 — cleanup / polish

- Compat redirects, `@deprecated` exports, English fallbacks, SurfaceCard pockets, unused query key factories.

**Not every TODO is P0.** Comments like `db:seed:demo` are not defects.

---

## 25. Features that look complete but are not

| Appearance | Evidence |
|------------|----------|
| Line production-setup editor | `OrderProductionSetupLineScreen` unimported |
| QC piece-fail sheet | unused; `QcFailSheet` is live |
| Create PO sheet | unused; builder route is live |
| Invoice dealer sheet | unused |
| Task material usage sheet / product quick pick / semi stage picker | unimported |
| `/search` | redirect only |
| `features/deliveries` | empty |
| Scheduling generate / resolve-all / capacity section / dashboard query | client+UI remnants, not wired |
| Returns outbound eligibility | API fields unused |
| Inventory reserve action | qty displayed, no mutation |
| AI intake | no nav tile |
| Admin quotation list | no route |
| Push notifications | register + Personal Team strip; delivery unproven |
| JoFotara | historical docs only; **removed** |

---

## 26. Features that are actually well done (preserve)

| Area | Why |
|------|-----|
| Surface + permission routing | Prevents mixing dealer/worker/admin chrome; 11 navigation tests |
| Floor aesthetic | Consistent factory-desk language; skill + rule |
| Selectors + feature `query.ts` | Testable mapping; ~46 `select*.ts`, 20 `query.ts` |
| Production Plan IA | One Preparing workspace; old URLs redirect |
| Placement writer | Dual-write task + allocation; invalidation helpers |
| Scan resolver + QR matrix | Ordered kinds; tests |
| Fabric tracker + take-in verdicts | Cross-floor, not a SKU filter |
| ReturnPiece 3-decision model | RESTOCK rejected; recovery panel wired |
| Journey classifier | Matches API buckets; counts from server |
| Delivery depart + dealer confirm | Load sheet + `canDepart` + confirm-receipt |
| Fixture import guard | Empty API ≠ fake business data |
| Workflow-domain DAG | Heal helpers explicitly dead at runtime |
| i18n leaf parity + RTL lock | Metro uses i18n **src** |

---

## 27. Cross-feature connection map

```
Order ─ensure-plan→ Production Plan ─assignTask→ Scheduling
                 └─release→ Production (POs/tasks)
                              ├─materials issue→ Inventory
                              ├─fabric take-in→ Fabric Holding
                              ├─WIP kits→ Inventory SEMI
                              └─pack FIN lots→ Delivery ─depart→ Invoice/Payment
```

| Connection | Where implemented |
|-----------|------------------|
| Order → Plan | `OrderProductionPlanScreen` + `ensureOrderProductionPlan` |
| Plan → Scheduling | `assignTask`, `suggestPlanSchedule`, `AdminScheduleStrip` |
| Plan → Production | `releaseOrderProductionSetup` / start APIs |
| Production → Inventory | task materials, WIP claim/output, issues/returns |
| Production → Delivery | FIN lots + load sheet |
| Order → Fabric → Purchasing | `FabricTrackerBoard`, purchasing fabric tab, receive holding |
| Fabric → Worker | `TaskFabricTakeInBoard` / take-in API |
| Return → ReturnPiece → Production | decide piece → origin types → dismantle panel |
| Return → Inventory | recovery post lines |
| Scheduling ↔ Plan ↔ overtime | assign + calendar EXTRA_SHIFT + day worker overtime |
| Invoice ↔ Payment ↔ Statement | invoice sheets + `GET /statements/:id` |
| Catalog variant → Order | basket/new-order `variantSku`; dealer prices per variant |

---

## 28. Current mobile information architecture

```
ADMIN
├── Home (composed: sales | warehouse | backoffice | personal)
│   └── Search results (inline)
├── Orders
│   ├── All orders (journey chips)
│   ├── Customer requests / Factory review
│   ├── Order detail
│   ├── Production plan (Preparing)
│   ├── Production flow
│   └── Returned / return-work lens
├── Production (tab)
│   ├── Board (day lens)
│   ├── Production detail (materials / WIP / tasks)
│   ├── Task detail / problems
│   └── Workflow (More/overflow)
├── Inventory (tab)
│   ├── RAW / SEMI / FIN
│   ├── Item / warehouse / bins
│   ├── Transfers / counts / receive
│   └── Fabric bundle
├── More
│   ├── Products / variants
│   ├── Dealers
│   ├── Purchasing (PO / fabric / SI)
│   ├── Invoices
│   ├── Reports / cost dossiers
│   ├── Scheduling
│   ├── Returns
│   ├── Users / staff types
│   ├── AI chat
│   ├── Account / settings
│   └── Notifications (shared)
└── (ungrouped deep links) AI intake, deliveries load sheet

DEALER
├── Home
├── Catalog → PDP → basket
├── Orders (+ flow)
├── Account
│   ├── Quotations
│   ├── Invoices
│   ├── Payments
│   ├── Statement
│   ├── Deliveries / receipts
│   ├── Returns (+ create)
│   ├── Calendar (hidden tab)
│   ├── Security
│   └── AI chat
├── New order (hidden)
└── Basket (hidden)

WORKER
├── Home (or delivery home)
├── Tasks | Delivery orders
├── Completed
├── Notifications
├── Profile
├── Task detail / take-in
├── Sales-order items (grouped POs)
├── Lane / workflow
└── Delivery load sheet
```

---

## 29. Biggest screens / hotspots

| # | File | ~LOC | Responsibility | Justified? |
|---|------|------|----------------|------------|
| 1 | `src/features/scheduling/components/AdminScheduleSheets.tsx` | 2185 | Many schedule sheets | Suspicious monolith; mostly unused |
| 2 | `src/features/sales-orders/OrderDetailScreen.tsx` | 2131 | Order detail all roles | Borderline |
| 3 | `src/features/tasks/TaskDetailScreen.tsx` | 1989 | Entire worker floor | Borderline |
| 4 | `src/features/production/ProductionDetailScreen.tsx` | 1945 | Factory hub | Borderline |
| 5 | `src/features/sales-orders/OrderProductionPlanEditorScreen.tsx` | 1900 | Preparing desk | Justified hub, still huge |
| 6 | `src/features/inventory/components/InventorySignatureHome.tsx` | 1781 | Inventory home + scan | Suspicious for a home |
| 7 | `src/features/requests/NewOrderScreen.tsx` | 1779 | New-order wizard | Borderline |
| 8 | `src/features/workflow/components/ProductionStageSetupSheet.tsx` | 1735 | Stage setup sheet | Suspicious |
| 9 | `src/features/requests/AdminRequestDetailScreen.tsx` | 1672 | RFQ workspace | Borderline |
| 10 | `src/features/tasks/components/TaskMaterialsFloorSection.tsx` | 1509 | Materials section | Suspicious |
| 11 | `src/features/dealers/DealerDetailScreen.tsx` | 1429 | CRM | Borderline |
| 12 | `src/features/returns/ReturnDetailScreen.tsx` | 1332 | Return case | Borderline |
| 13 | `src/features/requests/EditRequestScreen.tsx` | 1264 | Edit RFQ | Borderline |
| 14 | `src/features/quotations/AdminQuotationDetailScreen.tsx` | 1208 | Quote | Borderline |
| 15 | `src/features/production/components/ProductionTaskSheet.tsx` | 1197 | Task sheet | Suspicious |
| 16 | `…/OrderProductionSetupLineScreen.tsx` | 1192 | Legacy line editor | **Dead** |
| 17 | `src/features/dealers/components/DealerCrmSheets.tsx` | 1191 | CRM sheets bag | Suspicious |
| 18 | `src/features/workflow/ProductionSetupScreen.tsx` | 1183 | Product workflow setup | Borderline |
| 19 | `src/api/modules/sales-orders.ts` | 1137 | SO API + DTOs | Justified fat module |
| 20 | `src/features/sales-orders/OrdersListScreen.tsx` | 1119 | Orders desk | Borderline |

Also large: `FabricDetailScreen` ~1110, `scheduling.ts` API ~1068, variant/PDP ~1030, `TaskIncomingWorkFloorSection` ~1005, inventory/purchasing API modules ~1000.

---

## 30. Code quality patterns

**Conventions that exist**

- Feature folders with screens / components / selectors / query / tests
- Thin Expo routes + gates
- Floor primitives + haptics
- Permissions via `@maher/permissions`
- i18n keys under `mobile.*`

**Inconsistencies**

- Selector-heavy domains vs fat screens (dealers CRM, schedule sheets)
- Hooks mostly inside features; `src/hooks` tiny
- API DTOs often redeclare unions instead of importing `@maher/types`
- Test coverage uneven (`more`, AI chat)
- Dual homes for delivery (empty folder vs `delivery-load`)
- Sheets: shared + feature-local + orphans

---

## 31. Current build / typecheck health

| Command | Result |
|---------|--------|
| `pnpm --filter @maher/mobile typecheck` | **PASS** (2026-09-12 audit) |
| `pnpm --filter @maher/mobile test` | **Not executed here.** CI job `build` runs it on Node 20 after `prisma db push` + package builds. |
| `expo lint` | Not run (would not auto-fix). |
| Maestro | Not run (needs simulator). |
| Root `pnpm typecheck` / `pnpm test` | Not run (workspace-wide). |

CI also runs `pnpm dev:component-lab:audit` and Playwright (admin-web).

---

## 32. Exact file references (index of critical symbols)

Use these as anchors (do not invent extra line numbers):

- Surface: `packages/permissions/src/routing.ts` — `resolveAppSurface`, `resolveMobileHomeHref`, `resolveHomePersona`
- Journey: `apps/mobile/src/features/sales-orders/adminOrderJourney.ts` — `classifyAdminOrderJourney`
- Journey API twin: `apps/api/src/modules/sales-orders/admin-order-journey.ts`
- CTA href: `apps/mobile/src/features/sales-orders/resolveOrderPrimaryCtaHref.ts`
- Plan host: `apps/mobile/src/features/sales-orders/OrderProductionPlanScreen.tsx`
- Release: `ensureOrderProductionPlan`, `releaseOrderProductionSetup` in `apps/mobile/src/api/modules/sales-orders.ts`
- Start / return: `startProductionOrder`, `returnProductionOrderToPreparing` in `apps/mobile/src/api/modules/production.ts`
- Tasks: `startTask`, `completeTask`, `assign` via production/tasks modules
- Scan: `apps/mobile/src/features/inventory/resolveInventoryScan.ts`
- Fabric select: `apps/mobile/src/features/fabric/selectFabricTracker.ts`
- Tokens: `apps/mobile/src/storage/tokens.ts`
- API origin: `apps/mobile/src/api/config.ts` — `getApiBaseUrl`, `getApiV1Url`
- Query defaults: `apps/mobile/src/api/queryClient.ts` — `createQueryClient`
- Overflow: `apps/mobile/src/features/admin-home/adminOverflowModules.ts`
- Tabs: `apps/mobile/src/navigation/tabConfig.ts`
- Floor skill: `.cursor/skills/mobile-floor-aesthetic/SKILL.md`

---

## 34. Final feature status matrix

| Feature | Status | Mobile UI | API connected | Mutations | Permissions | i18n | Tests | Main gaps |
|---------|--------|-----------|---------------|-----------|-------------|------|-------|-----------|
| Auth / session | MOSTLY COMPLETE | Yes | Yes | login/logout/MFA | n/a | Strong | auth tests | Biometric stores password |
| Admin home | MOSTLY COMPLETE | Yes | Yes | few | composed | Strong | some | SurfaceCard pockets |
| Dealer home | MOSTLY COMPLETE | Yes | Yes | no | identity | Strong | some | |
| Worker home | MOSTLY COMPLETE | Yes | Yes | no | task.read | Strong | thin | |
| Orders journey | MOSTLY COMPLETE | Yes | Yes | confirm/hold/cancel | mostly | Strong | many | Ungated detail |
| RFQ / requests | MOSTLY COMPLETE | Yes | Yes | Yes | create vs ungated admin | Strong | many | |
| Quotations | MOSTLY COMPLETE | Dealer list+detail; admin detail only | Yes | Yes | mixed | Strong | some | No admin list |
| Production plan | MOSTLY COMPLETE | Canonical desk | Yes | Yes | setup.* | Strong | some | Dead line screen leftover |
| Production board/detail | MOSTLY COMPLETE | Yes | Yes | Yes | read/update | Strong | many | God files |
| Tasks / QC / pack | MOSTLY COMPLETE | Yes | Yes | Yes | task.* | Strong | many | Orphan QC sheet |
| Scheduling | PARTIAL | Month/day yes | Reads yes | assign/approve/exceptions yes | read/manage | Strong | 12 | Generate/conflicts UI unused |
| Inventory | MOSTLY COMPLETE | Yes | Yes | receive/issue/transfer/count | mixed tab | Strong | many | No reserve mutation |
| Fabric | MOSTLY COMPLETE | Yes | Yes | Yes | fabric.* | Strong | some | Dual entry routes |
| Purchasing | MOSTLY COMPLETE | Yes | Yes | Yes | PO.* | Strong | many | Orphan create sheet |
| Returns | MOSTLY COMPLETE | Yes | Yes | Yes | return.* | Strong | some | outboundEligible unused |
| Delivery | MOSTLY COMPLETE | Load + dealer receipts | Yes | check/depart/confirm | delivery.* | Strong | some | Empty deliveries folder |
| Invoices | MOSTLY COMPLETE | Yes | Yes | create/pay/credit | invoice.* | Strong | some | JoFotara gone (intentional) |
| Payments | PARTIAL | Dealer list; admin on invoice | Yes | record on invoice | payment.* | Strong | thin | No payments feature folder |
| Statement | MOSTLY COMPLETE | Yes | Yes | PDF | statement.read | Strong | some | |
| Catalog / variants | MOSTLY COMPLETE | Yes | Yes | admin CRUD | catalog.* | Strong | many | Dealer PDP ungated |
| Dealers CRM | MOSTLY COMPLETE | Yes | Yes | Yes | customer.* | Gaps (EN fallbacks) | thin | |
| Users / staff types | MOSTLY COMPLETE | Yes | Yes | Yes | user/role.manage | Strong | some | |
| Notifications | PARTIAL | Inbox | list/read | mark read | mismatch vs shared route | Strong | some | Push unproven |
| Settings | MOSTLY COMPLETE | Yes | Yes | patch | settings.manage | Strong | thin | |
| AI intake | PARTIAL | Yes | Yes | approve/reject | ai-intake.* | Strong | some | No nav tile |
| AI chat | PARTIAL | Yes | Yes | send | ai-chat.read | some | **0** | |
| Search | LEGACY | Home inline | Yes | n/a | | some | | `/search` dead |
| Reports / cost | MOSTLY COMPLETE | Yes | Yes | backfill | tile vs gate mismatch | Strong | some | |
| Workflow editor | MOSTLY COMPLETE | Yes | Yes | publish | workflow.* | mixed | 7 | SurfaceCard; huge sheets |
| Scanner | MOSTLY COMPLETE | Yes | Yes | identify/verify | | Strong | QR matrix | Kind overlap after lookup |
| Component lab | DEV ONLY | `/dev` | fixtures | n/a | `__DEV__` | n/a | lab | |
| JoFotara | LEGACY | **None** | stripped | n/a | n/a | n/a | API removed spec | Do not revive from old docs |

---

## 35. Do not assume

This audit could **not** prove:

- Physical camera / QR print quality on a real iPhone
- App Store / TestFlight signing, push certificates on paid teams, associated-domain DNS
- Production/staging server configuration beyond `eas.json` URL strings
- Whether `https://api.maheraghbar.jo` / staging currently serve the same schema as local
- Live JWT contents, token TTL, or refresh rotation policy beyond client code
- Whether notification **delivery** works server-side (client comments say it may not)
- OpenAI / Twilio / SMTP / OCR HTTP providers against real credentials (settings UI exists; backends not exercised)
- Local `maher_erp` demo dataset contents at audit time (DB was not queried; `demo:reset` was not run)
- Full Jest / Maestro / Playwright results on this machine
- Landscape UX (orientation locked portrait)
- Whether every `as any` is stale
- Admin-web / mobile pixel parity
- That GitHub remote matches this SHA for all historical docs under `docs/` (many closure reports predate this SHA)

**Do not assume from older `docs/PIECE*` / JoFotara / RESTOCK / generate-schedule docs that those UIs are live on mobile today.** This file describes **current code**.

---

## Appendix A — Shared packages mobile depends on (backend “what mobile needs”)

Mobile calls Nest controllers that wrap Prisma. Relevant backend modules (not a full API audit):

- `auth` (mobile login/refresh/me)
- `sales-orders` (+ production-setup sub-routes)
- `production` + `tasks` + `workflow`
- `scheduling` (subset actually called)
- `inventory` + warehouses
- `purchasing` + `fabric-procurements`
- `returns` / contracts
- `deliveries`
- `invoices` / `payments` / `statements`
- `catalog` browse + admin products/variants
- `requests` / `quotations`
- `reports` (homes + cost)
- `users` / `notifications` / `settings` / `uploads` / `ai-intake` / `ai-chat` / `search` / `quality`

Prisma models listed in §9 are the ones those DTOs serialize.

---

## Appendix B — Query key domains (`apps/mobile/src/api/queryKeys.ts`)

Factories exist for: auth, reports, salesOrders (incl. productionSetup), requests, quotations, tasks, production, inventory, purchasing (incl. fabric), scheduling, catalog/variants, customers/dealers, invoices, payments, returns, users, notifications, aiIntake, search, quality, workflow.

Treat `invalidateKeys.afterPlacementMutation` as the **canonical** invalidation after assign/pin.

---

*End of audit. Source: local worktree at `e78daa0942cfccdcd3ea7ecae63f81056328c6ac`. Application source unchanged.*
