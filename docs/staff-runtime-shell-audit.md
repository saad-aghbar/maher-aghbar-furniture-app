# Staff runtime shell audit

Reproduce-from-code of a custom Staff login (preset Warehouse Management and any custom STAFF Role). No style changes in this document.

Source of truth for session data is `GET /auth/me` via `AuthService.loadAuthUser` → `effectivePermissionCodes`. JWT is `{ sub, typ }` only — permissions are not in the token.

## Warehouse Management preset (system)

From `SYSTEM_STAFF_PRESETS.WAREHOUSE_MANAGEMENT`:

| Field | Value |
|---|---|
| roles | `['WAREHOUSE_MANAGEMENT']` |
| staff type code | `WAREHOUSE_MANAGEMENT` |
| employee type | **not on AuthUser** (`User` has no `employeeType` column; kind lives on `Role.kind = STAFF`) |
| permissions | `inventory.read`, `warehouse.read`, `inventory.receive`, `inventory.issue`, `inventory.transfer`, `inventory.count`, `notification.read`, `document.read` |

A custom Staff Type with a different code (e.g. Inventory Assistant) hydrates the same way: `roles: ['INVENTORY_ASSISTANT']` plus that Role’s permission codes. There is no `staffType` string on the session.

## Resolved shell (before this fix)

| Layer | Function / screen | Warehouse Management result |
|---|---|---|
| App surface | `resolveAppSurface` | **admin** (inventory transfer is treated as back-office; not floor-only) |
| Home persona | `resolveHomePersona` | **warehouse** if receive/issue/transfer/count is granted; **generic** if only `inventory.read` |
| Mobile home href | `resolveMobileHomeHref` | `/(app)/(admin)/(tabs)` |
| Web home path | `resolveWebHomePath` | `/dashboard` (always) |
| Tabs | `visibleTabsForUser('admin', user)` | **Home \| Inventory \| More** (`inventory.read` opens Inventory; Orders/Production hidden) |
| More modules | `filterAdminOverflowModules(..., 'more')` | empty places dock (no catalog/users/purchasing); identity + prefs + logout remain |
| Home `allowedOps` | `AdminHomeScreen` | **true** after `/auth/me` (inventory.read/receive/transfer/count) |
| Home `allowedSales` | `can(user, 'report.sales.read')` | **false** |

## Route authorization vs API authorization

| UI | Route / query | API guard | Match? |
|---|---|---|---|
| Admin Home sales body | `GET /reports/admin-home` | `report.sales.read` | Home already skips this query without sales read. **More does not.** |
| More unread badge | `useAdminHomeQuery` when `notification.read` | same admin-home endpoint needs `report.sales.read` | **Mismatch → 403** |
| Web Dashboard | always fetched | `GET /reports/dashboard` needs `report.sales.read` | **Mismatch → 403** |
| Inventory tab | `inventory.read\|count\|receive\|purchase-order.read` | inventory APIs use matching inventory perms | Match |
| Manage Account | `/(app)/(admin)/more/account` | profile/password gated by self-serve helpers, **not** `user.manage` | Match |
| Warehouses Create | Master CRUD always shows Add | `warehouse.manage` | **Mismatch → 403** |
| Topbar bell | always fetched | `notification.read` | **Mismatch** if a user lacks the perm |

## Confirmed runtime bugs

### 1. More 403 toast

`MoreHubScreen` enables `useAdminHomeQuery` whenever `notification.read` is granted. Warehouse staff have that permission. `GET /reports/admin-home` requires `report.sales.read`. React Query’s global `onError` toasts `FORBIDDEN` (“You do not have permission for this action”) on ordinary More navigation.

### 2. Empty / broken Home

- While `user` is null (`bootstrapping` / first paint), `can()` is false → `allowed` is false → **EmptyState `mobile.noModules`** (“No modules available”) instead of `AdminHomeSkeleton`.
- After `/auth/me`, warehouse staff have `allowedOps` and do get `AdminHomeOpsInventory`, but Home still uses sales `ADMIN_HOME_COMPOSITION = 'signature'` and never calls `resolveHomePersona()`. Without `report.sales.read` there is no sales payload, so the body is a sparse sales hero plus ops appended — not a warehouse home.
- `ForbiddenView` and `PermissionGate` (`!user`) reuse the same “No modules available” copy, so a hidden Orders/Production tab during hydrate looks like an empty Home.

### 3. Tab flicker

- `PersistentSurfaceTabBar` / `SurfaceTabsLayout` use `user ? visibleTabsForUser(...) : []`. A brief null `user` drops the bar to **no tabs**.
- Layout reset is keyed on tab **names**, not a sorted permission snapshot, so AuthUser identity churn can still remeasure.
- Logout only `removeQueries(auth.all)` — inventory / reports caches can leak Admin → Staff → Worker → Dealer.

### 4. Identity label

`/auth/me` returns `roles` as codes only. `roleLabel.ts` maps `WAREHOUSE` but not `WAREHOUSE_MANAGEMENT`. Custom types show a raw code or `mobile.more.roleFallback`.

### 5. Persona gap

Warehouse persona requires receive/issue/transfer/count, **not** `inventory.read`. Read-only inventory staff become `generic` and miss warehouse Home composition.

### 6. Admin Web

Dashboard nav item has **no permission gate**. Warehouse staff land on `/dashboard`, which always fetches `/reports/dashboard` (`report.sales.read`) → 403 ErrorState. Sidebar Inventory is correctly gated on `inventory.read`. Users/Settings stay hidden without `user.manage` / `settings.manage`.

## Custom Staff Type (no code change expected after fix)

Example: Inventory Assistant with `inventory.read` + `inventory.receive` + `warehouse.read`.

| Expected | After hydration |
|---|---|
| Surface | admin |
| Persona | warehouse (once `inventory.read` counts) |
| Tabs | Home \| Inventory \| More |
| Home actions | Receive only |
| More | personal modules; no FORBIDDEN from admin-home |

## Out of scope (confirmed)

Do not rebuild Staff Types / RBAC, do not add `if (staffType === 'WAREHOUSE_MANAGEMENT')`, do not grant `user.manage` or `report.sales.read` to make sales Home work.
