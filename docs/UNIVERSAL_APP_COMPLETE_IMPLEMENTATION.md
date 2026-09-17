# Universal App Complete — Implementation

**Verdict (software):** phone/tablet adaptive implementation is ready for physical-device release UAT. **Mac distribution** remains **BLOCKED — EXTERNAL APPLE SIGNING**. **Physical camera** and **Stage Manager split widths** need hardware. Android tablet dest-client **JS loads** (Metro/`10.0.2.2` proven 2026-09-18); **logged-in Android tablet UAT is not PASS** (DevTools inspector blocked credential entry). iPad dealer/worker tablet logins were not completed in the closure pass (iPhone dealer/worker remain PASS).

This is one product for iPhone, Android phone, iPad, Android tablet, and (when signing allows) Apple Silicon Mac Designed-for-iPad. There are no `ScreenPhone` / `ScreenTablet` forks.

Runtime evidence, device logs, and the implementation-vs-UAT split live in [UNIVERSAL_APP_FINAL_UAT.md](./UNIVERSAL_APP_FINAL_UAT.md). Screenshots: [universal-uat-evidence/](./universal-uat-evidence/).

## Environment (this machine, 2026-09-17)

| Probe | Result |
| --- | --- |
| Git | `main` @ `d107990f5fdfcfd4b8a20552922d0d4129b43cd1` plus local closure commits (see FINAL_UAT 2026-09-18) |
| Demo | `pnpm demo:reset` + `pnpm demo:validate` — 23 SOs. API `http://127.0.0.1:4000/api/v1/health` OK. Metro `:8081` OK. |
| iOS Simulator UAT | **PASS (AR)** — iPhone 17 Pro COMPACT; iPad Pro 11" M5 MEDIUM rail; iPad Pro 13" M5 EXPANDED portrait + WIDE landscape. 2026-09-18: dest-client deep links + permission gates re-proven. Dealer/worker **tablet login** still not run. |
| Android tablet | AVD `maher_tablet` Pixel Tablet API 35. APK builds with portable JDK 17. **Metro/API from emulator PASS** (`10.0.2.2`). JS login **renders**. Logged-in admin/dealer/worker UAT **not PASS** (inspector). EN/HE login **PASS**. |
| Mac Designed-for-iPad | CocoaPods iOS 15.1 **FIXED**. Signing **BLOCKED** — Personal Team profile omits Mac UDID `00006050-001218660131401C`. |
| Team ID used | Personal team `NR2ZFUP7R7`. No invented Team ID. |

## What shipped

### Wave 0 — foundation
- `apps/mobile/src/adaptive/` — window class, density, SplitPane, DataRow, AdaptiveOverlay, desk selection, clearance, keyboard host, camera availability.
- Stable `TabSwipeNavigator` root: `Gesture.Pan().enabled(isCompact && onRoot)`.
- Admin rail/sidebar via `AdaptiveShell` + `AdminSideNav`. Dealer and worker keep the floating pill at every width.
- Proof overlays: ConfirmationSheet, OrdersFilterSheet, WorkerDaySheet, StageDaySheet.
- Benchmarks: Admin Home, Orders desk, Inventory hub + typed dock, Scheduling month|day split.
- EN/AR/HE `mobile.adaptive.*` keys. Dev gallery at `/dev/adaptive`.

### Wave 1 — cross-cutting
- `useSurfaceClearance` / `tabBarReserve(windowClass, surface)` — admin MEDIUM+ drops the 88px pill reserve; dealer/worker keep it.
- Orientation declared: iPhone portrait + iPad four-way in `app.config.ts` `ios.infoPlist`; Android tablet landscape via `plugins/withAndroidTabletOrientation.js` (`sw600dp` bool, no model detection).
- Carousel `CARD_W` → `carouselCardWidth`. Catalog/quick-access grids use `columnCapacity`. Remaining `Dimensions.get('window')` reads are sheet height caps.
- `AnimatedPressable` hover/focus/press wash. `TextField` / `SearchBarShell` brand focus ring.
- Typed scan shares camera resolvers: inventory dock, `CodeField`, label verify, bin scan, delivery load, PO builder, task materials/fabric/take-in.

### Waves 2–5 — route composition
Desk hosts (`?selected=` / `selectOrPush`, no remount of the list): Orders, Inventory, Production, Dealers, Invoices, Products, Returns, Purchasing, Dealer catalog, Worker tasks. Production Plan is items|editor|FactoryReadinessSummary on WIDE. Remaining live screens inherit AdaptiveShell, AppScreen `contentMaxWidth`, and AdaptiveOverlay sheets (wrap-before-rewrite). Costing, permissions, STD/variant/MODIFIED/CUSTOM, `CUSTOM_NO_TEMPLATE`, and return dispositions (REPAIR / REPLACEMENT / SCRAP_RECOVERY, no RESTOCK) are unchanged.

### Wave 6 — overlays
`BottomSheet` is an `AdaptiveOverlay` wrapper (`intent` default `editor`). Implementation lives in `BottomSheetPanel` (`SheetPanel`) so AdaptiveOverlay sheet mode does not recurse. `ActionSheet` is `intent="action"`. Camera, accessory photo, and the map picker stay full-screen Modals.

### Wave 7 — keyboard
Tab / Shift+Tab / Enter / Space use native focus. Escape closes overlays via `emitEscape`. `KeyboardShortcutsHost`: Cmd/Ctrl+K → admin home or dealer catalog; Cmd/Ctrl+N → new order when `sales-order.create` / `request.create`. Native iOS/Android have no DOM `keydown`; Designed-for-iPad Mac would use `document`/`globalThis` if the runtime exposes it. **PARTIAL** on hardware iPad/Mac until the Mac build signs.

### Wave 8 — Mac readiness
- PDF: `openAuthedPdf` still uses `Share.share({ url })` on iOS — that is the Preview/print path on Designed-for-iPad Mac. Linking is the fallback.
- Camera missing: `isCaptureCameraAvailable` → `ImagePicker` library in `AccessoryCameraProvider`.
- Maps: address geocode field is always in the picker chrome; map-unavailable pane keeps the hint.
- Auth: SecureStore / MFA / biometric unchanged.

### Wave 9 — verification
| Suite | Result |
| --- | --- |
| `pnpm --filter @maher/mobile typecheck` | **PASS** |
| `pnpm --filter @maher/mobile test -- --ci --watchAll=false --forceExit` | **PASS** 385 suites / 2302 tests |
| `@maher/permissions` Jest | **PASS** 8 suites / 50 tests |
| `@maher/notifications` Jest | **PASS** 3 suites / 36 tests |
| `@maher/workflow-domain` Jest | **PASS** 4 suites / 56 tests (1 skipped) |
| iOS Simulator logged-in UAT | **PASS (AR)** iPhone 17 Pro, iPad 11, iPad 13 portrait+landscape — see FINAL_UAT |
| EN / HE rendered switch | **PASS (2026-09-18 login)** — previous Maestro FAIL was hit-testing; see FINAL_UAT |
| Android `maher_tablet` logged-in UAT | **FAIL logged-in workflows** — Metro timeout **fixed**; inspector blocked login submit |
| Mac Designed-for-iPad UAT | **BLOCKED** — signing, not CocoaPods |

### Mac blockers (separated)

CocoaPods / Xcode 16+ deployment target (**FIXED**): `Podfile.properties.json` `ios.deploymentTarget=15.1` plus `post_install` raises Pod `IPHONEOS_DEPLOYMENT_TARGET` below 15.1. After `pod install`, 250 Pod targets are 15.1 and **zero** remain on 11–13.4. iOS Simulator `xcodebuild` **BUILD SUCCEEDED**.

Signing (**BLOCKED — EXTERNAL**, not an app FAIL):

```
xcodebuild -workspace apps/mobile/ios/MaherAlAghbarFurniture.xcworkspace \
  -scheme MaherAlAghbarFurniture \
  -destination 'platform=macOS,variant=Designed for iPad,arch=arm64' \
  -configuration Debug DEVELOPMENT_TEAM=NR2ZFUP7R7 build
```

Exact remaining error:

`Provisioning profile "iOS Team Provisioning Profile: jo.maheraghbar.furniture" doesn't include the currently selected device "MacBook Pro" (identifier 00006050-001218660131401C)`

Next account action (no password in this repo): enroll/link a paid Apple Developer team that can register this Mac UDID, regenerate the development profile for `jo.maheraghbar.furniture`, select that team in Xcode/EAS. Personal Team `NR2ZFUP7R7` could not include the Mac.

### Wave 10 — cleanup
Temporary module-level `CARD_W` / `Dimensions` layout math replaced where it was layout. Duplicate `useSurfaceClearance` import on scheduling removed. Broken bulk-clearance import splices repaired. `BottomSheet` yield contract test now asserts `BottomSheetPanel` (the host that still yields the Modal for the camera).

### Wave 11
See [WINDOWS_SPIKE.md](./WINDOWS_SPIKE.md). Spike only; no port started.

## Acceptance matrix

This table is **IMPLEMENTATION STATUS** (route is on the adaptive path). It is **not** a claim that all 142 rows were manually operated on every device.

Runtime evidence is a smaller high-traffic set — see [UNIVERSAL_APP_FINAL_UAT.md](./UNIVERSAL_APP_FINAL_UAT.md).

Columns are window classes (not devices). **PASS** means the route is on the adaptive path (shell, density, overlays, and desk split where a host exists). **NOT APPLICABLE** is a cited redirect.

| Route | COMPACT 390 | MEDIUM 600/820 | EXPANDED 1024 | WIDE 1440 | Notes |
| --- | --- | --- | --- | --- | --- |
| `(app)/(admin)/(tabs)/_layout.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/(tabs)/index.tsx` | PASS | PASS | PASS | PASS | Admin Home AdaptiveContainer benchmark |
| `(app)/(admin)/(tabs)/inventory.tsx` | PASS | PASS | PASS | PASS | InventoryHubHost + typed scan dock |
| `(app)/(admin)/(tabs)/more.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/(tabs)/orders.tsx` | PASS | PASS | PASS | PASS | OrdersDeskHost list|detail |
| `(app)/(admin)/(tabs)/production.tsx` | PASS | PASS | PASS | PASS | ProductionDeskHost list|detail |
| `(app)/(admin)/_layout.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/ai-chat/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/ai-intake/[id].tsx` | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | Redirect to admin orders |
| `(app)/(admin)/ai-intake/index.tsx` | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | Redirect to admin orders |
| `(app)/(admin)/dealers/[id]/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/dealers/index.tsx` | PASS | PASS | PASS | PASS | DealersDeskHost list|detail |
| `(app)/(admin)/deliveries/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/inventory/[group].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/inventory/fabric-bundle/[code].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/inventory/finished/[salesOrderId].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/inventory/items/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/inventory/low-stock.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/inventory/receive/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/inventory/receive/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/inventory/semi/[orderId].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/inventory/warehouses.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/inventory/warehouses/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/invoices/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/invoices/index.tsx` | PASS | PASS | PASS | PASS | InvoicesDeskHost list|detail |
| `(app)/(admin)/more/account.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/more/notifications.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/more/settings.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/orders/[id]/flow.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/orders/[id]/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/orders/[id]/production-plan.tsx` | PASS | PASS | PASS | PASS | Items|editor|readiness three-pane on WIDE |
| `(app)/(admin)/orders/[id]/production-setup/index.tsx` | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | Redirect to `production-plan` |
| `(app)/(admin)/orders/[id]/production-setup/lines/[lineId].tsx` | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | Redirect to `production-plan` |
| `(app)/(admin)/production/[id]/flow.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/production/[id]/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/production/[id]/plan.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/production/[id]/setup.tsx` | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | Redirect to SO production-plan or production detail |
| `(app)/(admin)/production/problems.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/production/tasks/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/production/workflow/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/production/workflow/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/production/workflow/stages.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/products/[id]/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/products/[id]/production-setup.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/products/[id]/variants/[variantId].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/products/index.tsx` | PASS | PASS | PASS | PASS | ProductsDeskHost list|detail |
| `(app)/(admin)/purchasing/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/purchasing/create.tsx` | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | Redirect to `purchasing/new` |
| `(app)/(admin)/purchasing/fabric/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/purchasing/index.tsx` | PASS | PASS | PASS | PASS | PurchasingDeskHost list|detail |
| `(app)/(admin)/purchasing/low-stock.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/purchasing/new.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/purchasing/runs/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/purchasing/supplier-invoices/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/purchasing/suppliers/[id]/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/purchasing/suppliers/[id]/orders.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/purchasing/suppliers/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/quotations/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/quotations/[id]/lines/[lineId].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/_layout.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/coverage/[issueType].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/coverage/[type].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/coverage/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/inventory/[itemId].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/inventory/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/order/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/orders.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/products/[productId].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/products/[productId]/variants/[variantId].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/products/custom.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/products/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/returns/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/reports/returns/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/requests/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/requests/[id]/lines/[itemId].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/returns/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/returns/index.tsx` | PASS | PASS | PASS | PASS | ReturnsDeskHost list|detail |
| `(app)/(admin)/scheduling/index.tsx` | PASS | PASS | PASS | PASS | Month|day SplitPane; list-only focus modes stay list-only |
| `(app)/(admin)/users/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/users/staff-types/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/users/staff-types/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(admin)/users/staff-types/new.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/(tabs)/_layout.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/(tabs)/account.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/(tabs)/basket.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/(tabs)/catalog.tsx` | PASS | PASS | PASS | PASS | DealerCatalogDeskHost (always mounted) |
| `(app)/(customer)/(tabs)/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/(tabs)/new-order.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/(tabs)/orders.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/(tabs)/schedule.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/_layout.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/account/calendar.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/account/notifications.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/account/payments.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/account/security.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/account/statement.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/ai-chat/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/catalog/[id]/customize.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/catalog/[id]/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/deliveries/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/deliveries/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/invoices/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/invoices/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/order/custom.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/orders/[id]/flow.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/orders/[id]/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/quotations/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/quotations/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/requests/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/returns/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/returns/create.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(customer)/returns/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/(tabs)/_layout.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/(tabs)/completed.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/(tabs)/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/(tabs)/notifications.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/(tabs)/profile.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/(tabs)/tasks.tsx` | PASS | PASS | PASS | PASS | WorkerTasksDeskHost floor terminal |
| `(app)/(employee)/_layout.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/completed-orders/[salesOrderId].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/deliveries/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/lane/[id].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/orders/[salesOrderId].tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/profile/notifications.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/tasks/[id]/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/(employee)/tasks/[id]/take-in.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/_forbidden.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/_layout.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/notifications/index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(app)/search/index.tsx` | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | Redirect to admin tabs (search lives on Home) |
| `(auth)/_layout.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(auth)/disabled.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(auth)/login.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(auth)/mfa.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(auth)/offline.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(auth)/session-expired.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `(auth)/unlock.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `_layout.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |
| `index.tsx` | PASS | PASS | PASS | PASS | AdaptiveShell + AppScreen width cap + AdaptiveOverlay sheets |


## Honest gaps

- Android tablet **JS session loads** (2026-09-18, `10.0.2.2`). Logged-in admin/dealer/worker UAT still did not complete (`__DEV__` inspector). Orientation plugin unlock is only proven on the login form (landscape + portrait).
- EN/HE **do switch** at runtime (login photographed). 2026-09-17 Maestro FAIL was hit-testing. HE RTL proven on login; large-screen Hebrew chrome (sidebar/split) not photographed.
- iPad dealer/worker tablet chrome was not logged in. iPhone dealer + worker **did**. Admin permission gates on dealer catalog and worker tasks **did** on iPad 13 dest client.
- Resize evidence is iPad 13 rotation EXPANDED↔WIDE, not Stage Manager split widths.
- Invoice PDF **bytes** authenticated 200; in-app share sheet not operated.
- Cmd/Ctrl shortcuts are DOM `keydown` only until Designed-for-iPad actually launches.
- Pre-existing i18n leftovers (e.g. `workers still need assignment 8`, notification bodies `Painting` / `Assembly`).
- Purchasing fabric/supplier-invoice tabs still `router.push` on compact and on desk (PO tab is the split).
- Users hub stays card + sheet (no staff dossier split) — AdaptiveOverlay covers the editors.
- Some admin detail routes still push a stack page on compact; desk hosts cover the high-traffic lists.
