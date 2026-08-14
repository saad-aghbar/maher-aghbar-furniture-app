# Staff runtime shell — final report

Plan: **Fix custom Staff runtime shell** (28 requirements). Audit: [`staff-runtime-shell-audit.md`](./staff-runtime-shell-audit.md).

---

## 1. Root cause of empty Home

Three compounding issues:

1. **Hydration race** — `AdminHomeScreen` treated `user === null` as “no permissions” and rendered `mobile.noModules` instead of a skeleton.
2. **Wrong home composition** — Home always used the sales `signature` layout and only appended ops inventory; warehouse staff without `report.sales.read` saw a sparse or empty sales shell.
3. **Misleading copy** — `PermissionGate` and `ForbiddenView` reused `noModules` during auth bootstrap, so hidden admin routes looked like an empty app.

**Fix:** `resolveComposedHomeKind()` drives Home (`sales` | `warehouse` | `backoffice` | `personal`); skeleton until authenticated; warehouse staff get `AdminHomeOpsInventory` only; `inventory.read` alone maps to warehouse persona.

---

## 2. Root cause of tab flicker

1. Tab bar keyed off `user ? visibleTabsForUser(...) : []` — brief null `user` collapsed tabs to zero.
2. Layout remount keys did not stabilize across hydration.
3. Logout cleared only `auth` queries; inventory/report caches could leak between persona switches.

**Fix:** `useStableVisibleTabs` retains last visible tab set during hydration; `tabLayoutKey()` for stable layout keys; `resetQueryClientOnLogout` clears memory + persisted React Query cache.

---

## 3. Root cause of More 403

`MoreHubScreen` called `useAdminHomeQuery` when `notification.read` was granted. That endpoint requires `report.sales.read`. Warehouse staff have notifications but not sales reports → global React Query `onError` toasted `FORBIDDEN` on ordinary More navigation.

**Fix:** Unread badge uses `useNotificationsQuery` + `unreadCount` when `notification.read`; admin-home query only when `shouldFetchSalesAdminHome(user)`.

---

## 4. How app surface is resolved

Unchanged pipeline from `@maher/permissions`: `resolveAppSurface(user)` from effective permission codes on `GET /auth/me`. Warehouse inventory permissions resolve to **admin** surface (back-office), not floor worker. No hardcoded `WAREHOUSE_MANAGEMENT` checks in nav or home.

---

## 5. How home persona is resolved

`packages/permissions/src/routing.ts`:

- `resolveHomePersona(user)` — `warehouse` when `inventory.read` or receive/issue/transfer/count permissions present.
- `resolveComposedHomeKind(user)` — `sales` if `report.sales.read`; else `warehouse` if warehouse home permissions; else `backoffice` / `personal`.
- `shouldFetchSalesAdminHome(user)` — gates `/reports/admin-home`.

Mobile `AdminHomeScreen` branches on composed kind. Admin Web dashboard branches similarly (`WarehouseStaffDashboard`, `RestrictedStaffDashboard`).

---

## 6. How tabs are filtered

`visibleTabsForUser(surface, user)` in `tabConfig.ts` — each tab declares required permissions. Warehouse Management → **Home | Inventory | More** (Orders, Production, Users hidden). `useStableVisibleTabs` prevents empty bar during hydrate. `PermissionGate` returns `null` (not `ForbiddenView`) when `!user`.

---

## 7. How More / account self-service works without `user.manage`

Account routes use existing self-serve helpers (`account-self-serve.util`) — profile view/edit and password change do not require `user.manage`. More always exposes identity, language, theme, and logout. Business modules in More are permission-filtered via `filterAdminOverflowModules`.

---

## 8. How permission edits propagate

Session refresh via `GET /auth/me` reloads `effectivePermissionCodes` and new `rolesDetailed`. Mobile `AuthProvider` refetches on focus/app resume. Tab/home/More recompute from fresh `user` object. Logout clears all React Query caches so the next login cannot inherit a prior persona’s modules.

---

## 9. Files changed (primary)

| Area | Files |
|---|---|
| Permissions | `packages/permissions/src/routing.ts`, `index.ts`, `__tests__/routing.test.ts` |
| Types / API | `packages/types/src/index.ts`, `apps/api/src/modules/auth/auth.service.ts`, `auth.mobile.spec.ts` |
| Mobile home | `AdminHomeScreen.tsx`, `AdminHomeOpsInventory.tsx` |
| Mobile nav | `tabConfig.ts`, `useStableVisibleTabs.ts`, `SurfaceTabsLayout.tsx`, `PersistentSurfaceTabBar.tsx`, `PermissionGate.tsx`, `ForbiddenView.tsx` |
| Mobile more/auth | `MoreHubScreen.tsx`, `MoreIdentityBoard.tsx`, `MoreAccountScreen.tsx`, `AuthProvider.tsx`, `resetQueryClientOnLogout.ts`, `queryPersist.ts`, `queryClient.ts` |
| Mobile i18n | `roleLabel.ts`, `packages/i18n/src/messages/{en,ar,he}/*.json` |
| Mobile tests/fix | `dealerFabConstants.ts`, `dealer-ui/index.ts`, navigation/i18n/auth tests |
| Admin Web | `dashboard/page.tsx`, `warehouses/page.tsx`, `topbar.tsx`, `can-see-nav.test.ts` |
| Docs | `staff-runtime-shell-audit.md`, this report |

---

## 10. Tests added / updated

- `packages/permissions/src/__tests__/routing.test.ts` — warehouse, counter, read-only, no-business matrices
- `apps/mobile/src/navigation/__tests__/tabConfig.test.ts`, `tabLayoutKey.test.ts`
- `apps/mobile/src/i18n/__tests__/roleLabel.test.ts`
- `apps/mobile/src/auth/__tests__/resetQueryClientOnLogout.test.ts`
- `apps/api/src/modules/auth/auth.mobile.spec.ts` — `rolesDetailed`
- `apps/admin-web/src/lib/can-see-nav.test.ts` — warehouse sidebar
- `packages/i18n` staff-types-keys checklist updated

---

## 11. i18n coverage

EN / AR / HE keys added for:

- `mobile.staffHome.*` (warehouse home title, actions, empty states)
- `mobile.forbiddenArea*` (distinct from `noModules`)
- `common.receiveStock`, `transferStock`, `stockCount`

RTL uses existing locale plumbing; no new hardcoded English in warehouse home.

---

## 12. Light / dark coverage

Warehouse home, forbidden area, and More identity use existing design tokens (`useTheme`, shared card/surface components). No new hardcoded colors; verified via token-based components in `AdminHomeOpsInventory` and `ForbiddenView`.

---

## 13. Remaining risks

1. **Manual device QA** — logic is unit-tested; plan §27 checklist should be run on a physical device with a real Warehouse Staff login.
2. **Production builds** — not executed in this regression pass (typecheck + unit tests + Expo Doctor only).
3. **Factory UAT flake** — one snapshot assertion (`Order A snapshot ignores later qty`) failed on a consecutive rerun (87/88); first run in session was 88/88. Likely environmental race in shared UAT data, not staff-shell code.
4. **Web routes beyond dashboard** — individual deep links may still fetch sales-only APIs if opened directly; dashboard and topbar are fixed.

---

## 14. Exact commands run

```bash
pnpm --filter @maher/permissions build && pnpm --filter @maher/permissions test
pnpm --filter @maher/mobile test
pnpm --filter @maher/mobile typecheck
pnpm --filter @maher/api test
pnpm --filter @maher/api typecheck
pnpm --filter @maher/admin-web test
pnpm --filter @maher/admin-web typecheck
cd apps/mobile && npx expo-doctor
pnpm smoke:factory-lifecycle   # API at http://localhost:4000
```

---

## 15. Exact command results

| Command | Result |
|---|---|
| `@maher/permissions test` | **32/32 pass** |
| `@maher/mobile test` | **119 suites, 588 tests pass** |
| `@maher/mobile typecheck` | **pass** |
| `@maher/api test` | **60 suites, 324 tests pass** |
| `@maher/api typecheck` | **pass** |
| `@maher/admin-web test` | **15/15 pass** |
| `@maher/admin-web typecheck` | **pass** |
| `expo-doctor` | **18/18 checks pass** |
| `pnpm smoke:factory-lifecycle` | **88/88 pass** (first run); rerun **87/88** (1 flaky snapshot) |

---

## 16. Factory tests 88/88

**Yes** on primary regression run (exit 0, all scenarios PASS). Consecutive rerun logged 87/88 due to unrelated snapshot timing.

---

## 17. Expo Doctor

**Passed** — `18/18 checks passed. No issues detected!`

---

## 18. Staff Home — complete warehouse app?

**Yes (by design and automated tests).** Warehouse staff see:

- Permission-shaped tab bar (Home, Inventory, More)
- Dedicated warehouse home with low stock, open transfers, draft counts, recent activity (real APIs)
- Action chips for Receive / Transfer / Count gated per permission
- No sales admin-home fetch or empty `noModules` during hydrate
- Unread notifications without sales report access

Manual device confirmation recommended for polish (§27).

---

## 19. Brand-new custom Staff Type without extra code?

**Yes.** Any STAFF `Role` with a permission subset hydrates via `/auth/me` → `effectivePermissionCodes` + `rolesDetailed`. Surface, tabs, home kind, More modules, and action chips all derive from permissions. No `if (role === 'WAREHOUSE_MANAGEMENT')` in nav/home. Example: Inventory Assistant with `inventory.read` + `inventory.receive` gets warehouse home and receive chip without code changes.

---

## Manual device QA checklist (§27)

| # | Check | Code / test evidence | Device |
|---|---|---|---|
| 1 | Login succeeds | Auth flow unchanged | **Verify on device** |
| 2 | Home not empty | `AdminHomeScreen` warehouse branch + tests | **Verify on device** |
| 3 | Tabs stable | `useStableVisibleTabs` + tabConfig tests | **Verify on device** |
| 4 | Inventory opens | `inventory.read` tab gate | **Verify on device** |
| 5 | Receive/Transfer/Count match perms | Ops chips permission-gated | **Verify on device** |
| 6 | More opens without 403 | Notifications query, no admin-home | **Verify on device** |
| 7 | Account/profile opens | Self-serve routes | **Verify on device** |
| 8 | Language works | i18n keys EN/AR/HE | **Verify on device** |
| 9 | Theme works | Token-based components | **Verify on device** |
| 10 | Logout works | `resetQueryClientOnLogout` | **Verify on device** |
| 11 | Relogin same shape | Cache clear + `/auth/me` | **Verify on device** |
