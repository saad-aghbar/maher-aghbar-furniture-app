# Maher ERP — Universal App / Multi-Platform Platform Audit

**Status:** AUDIT ONLY — no implementation  
**Worktree:** local (do not assume GitHub `main` is newer)  
**Generated from:** current dirty worktree inspection  
**Document purpose:** technical plan for a future universal-app project

---

## 1. Executive summary

Maher’s primary frontend is a single Expo / React Native app (`apps/mobile`) on **Expo SDK 54**, **RN 0.81.5**, **Expo Router 6**, New Architecture enabled. It already serves three permission-driven surfaces (admin, dealer/customer, worker/employee) against one NestJS backend.

**The same JS/TS application can become one adaptive ERP client** across phone, tablet, and Apple Silicon Mac (via the iPad app), with **maximum code reuse** of business logic, queries, selectors, permissions, and i18n. Layout must adapt to **available window width**, not device name.

**Windows via React Native Windows is a later, high-risk host — not v1.** RNW 0.81 aligns with RN 0.81 version-wise, but Expo and Expo Router officially document Android / iOS / tvOS / Web only. This repo’s Expo CNG, Metro, and native modules (SecureStore, camera, maps, push, Reanimated-heavy chrome) are not Windows-ready without a dedicated spike and adapters.

**True React Native macOS is not needed now.** Prefer iPad-on-Mac.

| Platform | Readiness | Verdict |
|----------|-----------|---------|
| iPhone | **READY** | Primary product; intentional phone UX |
| Android phone | **READY** | Same app; Android tree CNG-generated |
| iPad | **~15–25%** | `supportsTablet: true` but portrait-locked, no breakpoints |
| Android tablet | **~15–25%** | Same width-driven gap as iPad |
| Apple Silicon Mac (iPad app) | **~10–20%** | Tablet gaps + no hover/keyboard/focus |
| Windows (RNW) | **Not feasible as v1** | Expo Router + SecureStore + camera/maps/push blockers |
| True macOS | **NO — not now** | No concrete business requirement |

**Estimated reuse (ranges):** API/queries/selectors/permissions/i18n **90–100%**; feature logic **80–90%**; feature UI sections **60–80%**; layout chrome/overlays **20–40%** until adaptive primitives; native capabilities **70–90%** on Apple tablet/Mac path, **10–30%** on Windows without adapters.

**Recommended roadmap:** finish phone → adaptive foundation + shell + 4 benchmarks → iPad/Android tablet → Apple Silicon Mac via iPad app → Windows spike → RN Windows host/Store only if spike passes → true macOS only if required.

**First future implementation phase (after this audit):** `useMaherLayout` + adaptive admin shell + adaptive overlay wrapping `BottomSheet` + benchmarks: Admin Home, Orders list (master/detail host), Inventory hub (persistent scan), Scheduling (month | day).

---

## 2. Current repository / build state

| Field | Value |
|-------|-------|
| Branch | `main` |
| SHA | `76e43ec9688dcdb7cfde808fb8ab1a31fcd15884` |
| Remote | tracks `origin/main` |
| Dirty? | **YES** — left as-is (users-floor + demo-seed + untracked `docs/CLEAN_DEMO_DATA.md`) |
| Node (local) | `v26.5.0` |
| Node (CI) | `20` (`.github/workflows/ci.yml`) |
| pnpm | `9.15.9` |
| App version | `0.1.0` |
| Expo | `~54.0.37` |
| React Native | `0.81.5` |
| React | `19.1.0` |
| Expo Router | `~6.0.24` |
| Bundle / package ID | `jo.maheraghbar.furniture` |
| EAS project | `bd5ccf7c-9b99-4bc5-a0bc-2a52d781c023` |
| New Architecture | `true` (`app.config.ts` + `ios/Podfile.properties.json`) |
| Platforms declared | `['ios', 'android']` only |
| Orientation | **`portrait` hard lock** |
| iOS tablet | `supportsTablet: true` (install only — no layout adapt) |
| iOS deployment | **15.1** (Podfile default) |
| Android tree | **Not checked in** (gitignored CNG); Expo 54 defaults at prebuild (typically minSdk 24 / target ~35) |
| Hermes | Enabled |
| Scheme | `maher` |
| EAS profiles | `development`, `development-device`, `preview`, `production` |
| Website apps | `@maher/admin-web`, `@maher/customer-portal`, `@maher/employee-portal` — **FROZEN** |

**Dirty inventory (do not clean):** modified users-floor components/tests; modified `package.json` / database demo seed files; untracked `docs/CLEAN_DEMO_DATA.md`, `packages/database/prisma/demo/cheat-sheet.ts`, `packages/database/prisma/demo/returns.ts`.

---

## 3. Current mobile architecture

### 3.1 Layout

```
apps/mobile/
  app/                 # Expo Router routes (~144 screens + 11 layouts)
  src/
    api/               # HTTP client, refresh, ~27 modules, queryKeys
    auth/              # AuthProvider, biometrics, session restore
    components/        # Shared UI (sheets, scan, maps, forms, floor…)
    features/          # ~35 domains (sales-orders, inventory, tasks, …)
    i18n/              # LocaleProvider, RTL helpers, lockNativeLayoutLtr
    motion/            # AnimatedPressable, haptics, pill bars, sheets
    navigation/        # SurfaceGate, PermissionGate, tabs, swipe
    permissions/       # Re-exports @maher/permissions
    providers/         # AppProviders, QueryProvider
    storage/           # SecureStore tokens + push device
    theme/             # Colors, spacing, radius, EmployeeThemeOverride
  app.config.ts
  eas.json
  metro.config.js      # pnpm + expo-router canonicalize
  ios/                 # Generated/checked-in native iOS
```

Path alias: `@/*` → `./src/*`.

### 3.2 Surfaces

`AppSurface = 'admin' | 'customer' | 'employee'` from `@maher/permissions` (`packages/permissions/src/routing.ts`).

**`resolveAppSurface(user)`:**

1. Customer identity (`customerId` / `CUSTOMER` role) → `customer`
2. Floor perms without back-office → `employee`
3. Else → `admin`

**Home hrefs:** `resolveMobileHomeHref` → `/(app)/(admin|customer|employee)/(tabs)`.

**Gates:**

- `SurfaceGate` — wrong surface shows `ForbiddenView` cover; keeps Stack mounted
- `PermissionGate` — fine-grained ACL on individual routes

**Shell** (`app/(app)/_layout.tsx`):

- Auth bootstrap → biometric unlock → surface
- `TabSwipeNavigator` + nested Stack + `PersistentSurfaceTabBar`
- Worker gets `EmployeeThemeOverride`

### 3.3 What stays shared across every platform

| Layer | Shared? |
|-------|---------|
| `@maher/permissions`, `@maher/types`, `@maher/i18n`, `@maher/notifications` (semantic), `@maher/workflow-domain` | Yes |
| API modules, query keys, selectors (`select*.ts`), feature mutations | Yes |
| Feature business UI sections (boards, identity, rails content) | Yes — compose differently |
| Theme tokens, floor aesthetic language | Yes — density may change |
| Surface/permission gates | Yes — **platform must not change authorization** |
| Notification inbox / topic / preference / `linkUrl` model | Yes — transport may differ |

### 3.4 What is native today (no platform file splits)

Almost all native APIs are imported directly. **No** `*.ios.ts` / `*.android.ts` / `*.windows.ts`. Only `VoiceNoteControls.audio.tsx` is a lazy optional-native helper.

---

## 4. Route inventory

**Method:** inspected mounted route files under `apps/mobile/app/` (not filenames alone). Classifications:

| Class | Meaning |
|-------|---------|
| PHONE-SPECIFIC | Floor/worker/scan flows designed for one-handed phone |
| ADAPTIVE-READY | Works larger without redesign (settings, thin hubs) |
| NEEDS TABLET COMPOSITION | List→detail should become split / denser chrome |
| NEEDS DESKTOP COMPOSITION | Multi-pane / calendar / BOM / cost desks |
| PLATFORM-SPECIFIC CAPABILITY | Camera, biometrics, maps, push |
| LEGACY/REDIRECT | Redirect only; do not treat as live UI |
| DEV ONLY | `app/dev/**` (`__DEV__`) |

### 4.1 Admin (priority)

| Feature | Route(s) | Screen | Class |
|---------|----------|--------|-------|
| Home | `(tabs)/` | `AdminHomeScreen` → signature composition | ADAPTIVE-READY (hub); tablet side rail later |
| Orders | `(tabs)/orders` | `OrdersListScreen` (1125) | NEEDS TABLET COMPOSITION |
| Order detail | `orders/[id]` | `OrderDetailScreen` (2216) | NEEDS TABLET (+ desktop panes) |
| Production Plan | `orders/[id]/production-plan` | Item board / `OrderProductionPlanEditorScreen` (1927) | NEEDS DESKTOP COMPOSITION |
| Production | `(tabs)/production` | `ProductionOverviewScreen` (853) | NEEDS TABLET COMPOSITION |
| Production detail | `production/[id]` | `ProductionDetailScreen` (1945) | NEEDS TABLET COMPOSITION |
| Scheduling | `scheduling/` | `AdminSchedulingScreen` (909) | NEEDS DESKTOP COMPOSITION |
| Inventory | `(tabs)/inventory` | `InventorySignatureHome` (1856) | NEEDS TABLET COMPOSITION |
| Inventory item | `inventory/items/[id]` | `InventoryItemDetailScreen` | NEEDS TABLET + PLATFORM (QR) |
| Purchasing | `purchasing/` | `PurchasingHubScreen` | NEEDS TABLET COMPOSITION |
| Fabric | `purchasing/fabric/[id]`, fabric-bundle | `FabricDetailScreen` (1110) | NEEDS TABLET COMPOSITION |
| Products / variants | `products/**` | Catalog + admin product/variant | TABLET / DESKTOP (BOM) |
| Dealers | `dealers/` → `[id]` | List + `DealerDetailScreen` (1423) | NEEDS TABLET COMPOSITION |
| Invoices | `invoices/` → `[id]` | List + detail | NEEDS TABLET COMPOSITION |
| Payments | *no admin route* | On invoice / dealer boards | With Invoices/Dealers |
| Returns | `returns/` → `[id]` | List + `ReturnDetailScreen` (1318) | NEEDS TABLET COMPOSITION |
| Cost & Performance | `reports/**` | Six desks (Money/Orders/Products/Inventory/Returns/Coverage) | NEEDS DESKTOP COMPOSITION |
| Users | `users/**` | List + sheets / staff-types | NEEDS TABLET COMPOSITION |
| Settings / account | `more/settings`, `more/account` | Form boards | ADAPTIVE-READY |
| AI intake | `ai-intake/**` | **Redirect only** | LEGACY/REDIRECT |
| AI chat | `ai-chat/` | `AiChatbotScreen` | ADAPTIVE-READY |
| Notifications | `/(app)/notifications`, `more/notifications` | Inbox / settings | ADAPTIVE-READY |
| More hub | `(tabs)/more` | `MoreHubScreen` + overflow dock | ADAPTIVE-READY |

**Other live admin:** warehouses, receive (PLATFORM), finished/semi order screens, workflow list/detail/stages (DESKTOP for stages), RFQ/quotation desks (DESKTOP), deliveries load sheet (PHONE + PLATFORM), problems, production flow.

**LEGACY redirects:** `purchasing/create` → `new`; `production/[id]/setup`; `orders/[id]/production-setup/*`; `/(app)/search` → Home.

### 4.2 Dealer (customer)

| Feature | Class |
|---------|-------|
| Home | ADAPTIVE-READY |
| Catalog / PDP | NEEDS TABLET COMPOSITION |
| Basket / customize | ADAPTIVE-READY |
| New order (1800) | NEEDS TABLET; map PLATFORM; desktop checkout desk later |
| Orders / order detail | Shared with admin — NEEDS TABLET |
| Account / statement / payments / security | ADAPTIVE-READY |
| Invoices / returns / deliveries / quotations | NEEDS TABLET |
| Schedule / calendar | NEEDS TABLET COMPOSITION |

**Do not turn Dealer into Admin ERP** merely because screen space exists.

### 4.3 Worker (employee)

| Feature | Class |
|---------|-------|
| Home / tasks / completed / lane / SO items | PHONE-SPECIFIC |
| Task detail / kit take-in / delivery load | PHONE + PLATFORM (scan) |
| Notifications / profile | ADAPTIVE-READY |

**Worker desktop/tablet:** Today, assigned tasks, lane, scan/take-in — **never** admin sidebar modules.

### 4.4 Auth / shell / dev

| Route | Class |
|-------|-------|
| Splash `/`, auth login/mfa/unlock/offline/expired/disabled | PLATFORM (secure store / biometrics) + adaptive forms |
| `app/dev/**` | DEV ONLY |

---

## 5. Current responsive behavior

**Verdict: intentional phone-first, not tablet-ready.**

| Pattern | Evidence | Classification |
|---------|----------|----------------|
| Portrait lock | `app.config.ts` `orientation: 'portrait'` | Phone-only |
| `supportsTablet: true` | iOS install allowed | Install only |
| `isPad` / `isTablet` / breakpoints | **Zero** in src | Absent |
| `useWindowDimensions` | ~50+ sheets — **height caps** | Sheet sizing |
| Width layouts | Admin quick-access 2-col; catalog `numColumns={2}`; dealer `CARD_W=200`; RFQ chips 3+2 | Fixed phone grids |
| Carousels | Module-level `Dimensions.get('window')` | Ad hoc / non-reactive |
| Split / master-detail | None | Absent |
| FlashList | None | FlatList only |
| Hover / keyboard shortcuts | None (`onHoverIn` unused) | Phone-only |
| Platform.OS | Push, blur, keyboard, biometrics, PDF share | Capability, not size |
| Camera orientation | `useResponsiveCameraOrientation` | Camera-only under portrait lock |

**Responsiveness today = fit portrait phone + excellent JS RTL**, not adaptive multi-column layouts.

---

## 6. Proposed window classes

Respond to **available window width**, not device marketing name. An iPad in 1/3 split or a narrow Windows window must use COMPACT.

| Class | Width (dp/pt) | Typical devices |
|-------|---------------|-----------------|
| **COMPACT** | `< 600` | Phones; iPad 1/3–1/2 split; narrow desktop |
| **MEDIUM** | `600–899` | iPad portrait; compact tablet windows |
| **EXPANDED** | `900–1199` | iPad landscape; small laptops |
| **WIDE** | `1200+` | Desktop / large monitor |

**Rationale vs blind 600/900/1200:** Aligns with Material window-size classes and common iPad portrait (~768–834) vs landscape (~1024–1194) and 13–14" laptop content widths. Exact tokens should be validated on physical iPad split + Windows resize during Phase 2; do not hard-code device names.

**Orientation:** tablet must support portrait and landscape; desktop has no orientation assumption. Phone may remain portrait-primary until Phase 3 unlocks tablet orientation.

---

## 7. Navigation strategy

### 7.1 Current phone chrome

- Bottom pill: `PersistentSurfaceTabBar` (Expo `Tabs` with `tabBar={() => null}`)
- Config: `tabConfig.ts` — admin Home/Orders/Inventory/Production/More; dealer Home/Catalog/Orders/Account; worker Home/Tasks/Completed/Notifications/Profile
- Overflow modules (`ADMIN_OVERFLOW_MODULES`): products, dealers, purchasing, invoices, reports, scheduling, workflow, problems, returns, users, ai-chat → Home tiles / More dock
- `TabSwipeNavigator` — horizontal swipe between tab roots only

### 7.2 Adaptive chrome (same routes)

| Class | Navigation |
|-------|------------|
| COMPACT | Bottom pill (current) |
| MEDIUM | Compact navigation rail from same `tabConfig` |
| EXPANDED / WIDE (admin) | Persistent sidebar = tabs + overflow modules (retire More as dump) |
| Dealer | Stay simple — widen catalog; no ERP sidebar |
| Worker | Today / tasks / lane / scan — no admin modules |

**Expo Router:** keep one route hierarchy; swap chrome in `(app)/_layout.tsx` / surface layouts. Do not duplicate `OrderScreenPhone` / `OrderScreenWindows`.

**Files that would need change (future):** `app/(app)/_layout.tsx`, `PersistentSurfaceTabBar`, `SurfaceTabsLayout`, `tabConfig`, `TabSwipeNavigator` (disable swipe when rail/sidebar), possibly `adminOverflowModules` as sidebar source of truth.

**Risk:** window-class change must **not** remount forms or reset selected order/filters/query state.

---

## 8. Screen responsive matrix (major screens)

| Feature | Current | Compact | Medium | Expanded | Wide | Main change | Complexity | Risk | Reuse sections? | New primitive? |
|---------|---------|---------|--------|----------|------|-------------|------------|------|-----------------|----------------|
| Admin Home | Signature boards scroll | Same | 2-col boards | Boards + side rail | Dashboard grid | Composition | LOW | LOW | Yes | Layout shell |
| Orders list | Floor cards | Cards | Dense cards | Dense list/table | Master \| detail | Split host | MEDIUM | LOW | Yes | SplitPane |
| Order detail | Stacked boards (2216) | Same | Slightly denser | 2-col boards | Split / panes | Compose | HIGH | MEDIUM | Partial extract | SplitPane |
| Production Plan | Item board → editor | Stack | Stack | Item \| editor | 3-pane concept | Desktop compose | HIGH | HIGH | Item board yes; editor weak | SplitPane |
| Production hub | Cards + day lens | Same | Dense | List \| detail | Same + filters | Split | MEDIUM | LOW | Yes | SplitPane |
| Scheduling | Month + sheets | Same | Month + sheet | Month \| day | Month \| day \| order | Desktop | HIGH | MEDIUM | Yes (14 comps) | SplitPane |
| Inventory hub | Signature home (1856) | Same | Rail denser | Hub \| item | Hub \| item + scan field | Split + scan | HIGH | MEDIUM | Yes | SplitPane + ScanField |
| Purchasing | Hub + sheets | Same | Dense | Hub \| PO | Table + detail | Split | MEDIUM | LOW | Yes | SplitPane |
| Products | 2-col grid | 2-col | 3-col | Grid \| PDP | Grid \| PDP | Columns | MEDIUM | LOW | Yes | useMaherLayout |
| Variants/BOM | Form boards | 1-col | 2-col form | BOM panes | BOM + pricing | Desktop | HIGH | MEDIUM | Floor rows | Form columns |
| Dealers | List + CRM detail | Cards | Dense | List \| dossier | Same | Split | MEDIUM | LOW | Yes | SplitPane |
| Invoices | Cards | Cards | Dense rows | Table \| detail | Same | Table optional | MEDIUM | LOW | Yes | DataRow |
| Returns | Cards | Cards | Dense | List \| detail | Same | Split | MEDIUM | LOW | Yes | SplitPane |
| Users | Cards + sheets | Cards | Dense | List \| editor | Side inspector | Split | MEDIUM | LOW | Yes | SplitPane |
| Cost desks | Tab boards | Same | Dense | Tables + sticky | Comparison grids | Desktop | HIGH | MEDIUM | Yes | DataRow |
| Settings | Forms | 1-col | 1–2 col | Section nav | Same | Mild | LOW | LOW | Yes | Form layout |
| Dealer catalog/PDP | Gallery | Same | 3-col | Grid \| PDP | Same | Columns | MEDIUM | LOW | Yes | — |
| Dealer new order | Wizard (1800) | Same | 2-col steps | Wider form | Desk | Form | HIGH | MEDIUM | Partial | Form layout |
| Worker tasks | Cards | Same | Dense cards | List \| task | Floor terminal | Keep simple | MEDIUM | LOW | Yes | ScanField |
| Delivery load | Scan sheet | Same | Same | Persistent scan | Keyboard wedge | PLATFORM | MEDIUM | MEDIUM | Partial | Scanner adapter |
| Notifications | List | Same | Same | Wider list | Same | Mild | LOW | LOW | Yes | — |
| Login / MFA | Forms | Same | Centered card | Centered | Same | Mild | LOW | LOW | Yes | Overlay |

---

## 9. Master / detail opportunities

| Feature | CURRENT PHONE FLOW | POTENTIAL LARGE-SCREEN FLOW |
|---------|--------------------|------------------------------|
| Orders | List → push detail | List \| detail |
| Products | Grid → PDP → variant | Grid \| PDP (variant third pane optional) |
| Inventory | Hub → group → item | Category/hub \| item detail |
| Purchasing | Hub → PO / supplier | Hub list \| PO detail |
| Dealers | List → CRM detail | List \| dossier (rails already exist) |
| Returns | List → detail | List \| detail |
| Users | List → create/edit sheets | List \| side editor |
| Tasks | List → task detail | List \| task (supervisors) |
| Cost | Desk list → dossier | List \| dossier |
| Scheduling | Month → sheets | Month \| day/order dossier |
| Production Plan | Items → `?lineId=` editor | Items \| line setup \| readiness |

**Rule:** wrap existing screens; do not fork per platform.

---

## 10. Desktop tables / forms strategy

### 10.1 Tables (not everything)

| Candidate | Phone | Tablet | Desktop | Shared primitive |
|-----------|-------|--------|---------|------------------|
| Orders | Cards | Dense rows | Table/list | `DataRow` / board row |
| Inventory | Cards | Dense rows | Table | Same |
| Products | Gallery cards | Dense grid | Optional table for admin | Keep gallery for dealer |
| Purchasing | Cards | Dense | Table | Same |
| Invoices | Cards | Dense | Table | Same |
| Payments | Embedded boards | Dense | Table on invoice | Same |
| Users | Cards | Dense | Table | Same |
| Dealers | Cards | Dense | List/table | Same |
| Returns | Cards | Dense | Table | Same |
| Cost reports | Boards | Dense | Tables + comparison | Same |

**Do not** table-ize dealer catalog or worker task cards.

### 10.2 Forms

| Form | Phone | Tablet | Desktop |
|------|-------|--------|---------|
| New Order | 1-col wizard | 2-col steps | Section nav / 2–3 col |
| Product / variant editor | 1-col sheets | 2-col | BOM + pricing panes |
| Production Plan | Stack + sheets | Wider stack | Multi-pane |
| PO builder | 1-col | 2-col | Lines table + header |
| User / staff | Sheets 1-col | 2-col | Side inspector |
| Return / dealer / settings | 1-col | Optional 2-col | Section nav |

**Validation and mutations stay shared** — only layout composition changes.

---

## 11. Overlay strategy

**Current:** shared `BottomSheet` (~70% height cap, expandable, Modal, Reanimated). ~100+ hosts; ConfirmationSheet / ActionSheet wrappers.

| Current use | Compact | Medium | Expanded/Wide |
|-------------|---------|--------|---------------|
| Filters, pickers, short confirms | KEEP AS SHEET | Centered dialog optional | Dialog / popover |
| Create/edit entities | Sheet | Centered sheet/dialog | Dialog or side panel |
| CRM / long forms | Sheet | Dialog | Side panel |
| Camera / scanner | Full screen | Full / large dialog | NEEDS FULL SCREEN ON SMALL; desktop = typed + wedge |
| Nested pickers | Overlay sheet | Dialog stack | Popover where appropriate |

**Proposed shared primitive (future):** `AdaptiveOverlay` wrapping today’s BottomSheet API — sheet | dialog | side panel | popover from `windowClass` + intent. **Do not fork 100 sheets.**

---

## 12. Universal aesthetic strategy

From `.cursor/skills/mobile-floor-aesthetic/SKILL.md`:

**Keep universal:** parchment/linen canvas; oak/bronze brand; board recipe (rail, header band, inset meta, shadow); restrained motion; tactile hierarchy; StatusBadge; RTL rules; Arabic title weight.

**Change on large screens:** denser information; smaller radii (e.g. `lg`/`md` vs `xl`); more dividers; less vertical stacking; tables / split panes; persistent navigation; pointer hover; tighter spacing; do **not** simply enlarge phone cards.

**Skill evolution (do not create yet):** prefer shared base + layout sections, or evolve to `maher-universal-app-aesthetic` with density tokens. Phone skill remains the touch-density source of truth.

---

## 13. Pointer / keyboard / focus

### 13.1 Pointer (current gaps)

`AnimatedPressable` = scale on press only — **no** `onHoverIn`, cursor, or focus ring. Pill-bar `hoverIndex` is drag preview, not mouse hover.

**Needs (future):** hover wash on cards/rows; pointer cursor; optional context menu (dense tables); double-click open detail on WIDE; mouse wheel on calendars/lists; desktop selection for multi-row ops (later).

### 13.2 Keyboard

**Current:** no Tab traversal strategy, no Escape-to-close overlay contract, no Cmd/Ctrl shortcuts.

**High-value future shortcuts (do not implement now):**

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl+K | Global search (already exists as Home search / route) |
| Cmd/Ctrl+N | New order where authorized |
| Escape | Close AdaptiveOverlay |
| Enter / Space | Activate focused control |
| Arrows | Calendar / list navigation |

### 13.3 Focus system

Shared primitives needing: `focus-visible`, keyboard outline, selected, hover, pressed — especially `AnimatedPressable`, buttons, list rows, tab/rail items, sheet actions.

**Platform risk:** Reanimated scale-only press may fight focus styling; Windows keyboard focus models differ from iOS VoiceOver.

---

## 14. iPad readiness

| Concern | Status |
|---------|--------|
| Portrait | Locked globally — tablet cannot landscape |
| Landscape | Blocked by config |
| Split view | Would show COMPACT phone UI stretched — wastes space |
| Stage Manager / resize | No window-class response |
| External keyboard / trackpad | No hover/focus/shortcuts |
| Multi-column | Fixed 2-col / 200px cards |
| Popovers | BottomSheet only |
| Safe area | Phone chrome |
| Screens wasting space | Nearly all admin desks, scheduling month, production plan, cost desks, catalog |

**Main blockers:** orientation lock; no breakpoints; bottom-tab + swipe chrome; sheet-as-only overlay; camera-first scan without always-visible typed field on some flows.

---

## 15. Apple Silicon Mac readiness (iPad app)

Initial Mac strategy: **publish the iOS/iPad app for Apple Silicon Mac** — not RN macOS.

| Concern | Classification |
|---------|----------------|
| Shared API / permissions / most boards | WORKS AS-IS (logic) |
| Layout density / cards / sheets | NEEDS ADAPTIVE LAYOUT |
| Hover / keyboard / focus | NEEDS DESKTOP INPUT SUPPORT |
| Camera-only delivery scan | NEEDS PLATFORM FALLBACK (typed/wedge) |
| PDF via Share sheet | NEEDS PLATFORM FALLBACK (save/open) |
| SecureStore / biometrics on Mac | Touch ID where available / session fallback |
| Swipe-only tab switch | NEEDS DESKTOP INPUT (click rail) |
| Portrait / full-screen sheets | NEEDS ADAPTIVE LAYOUT |
| True Expo module gaps | Unlikely BLOCKER for iPad-on-Mac vs Windows |

---

## 16. Windows feasibility

### 16.1 Version alignment

- RNW **0.81** targets RN **0.81** — version match exists.
- Expo SDK 54 / Expo Router: documented platforms **Android, iOS, tvOS, Web** — **not Windows**.
- Expo CLI: no built-in out-of-tree Windows/macOS support; community workarounds only.
- This repo: `platforms: ['ios','android']`, Expo plugins, custom Metro for pnpm/`expo-router`, New Arch + Reanimated 4 everywhere.

### 16.2 Concrete blockers in this repo

1. **Expo Router not a documented Windows platform** — spike required before committing.
2. **`expo-secure-store`** — Android/iOS/tvOS docs only; tokens must not fall back to AsyncStorage.
3. **`expo-camera`** — no Windows; scanner adapter required.
4. **`react-native-maps` / `expo-location`** — mobile maps only.
5. **`expo-notifications`** — APNs/FCM; API platform union is `ios|android|web` only.
6. **Reanimated 4** — New Arch required; Windows historically JS/web fallback, not native UI-thread; Maher chrome is Reanimated-heavy.
7. **Expo CNG / autolinking** — no Windows project path in-repo.
8. **Delivery load** — camera scan without CodeField.

**Do not hand-wave “mostly compatible.”**

---

## 17. Native dependency compatibility matrix

| Package | Feature using it | iOS | Android | iPad | iPad-on-Mac | Windows | Potential fallback | Severity | Notes |
|---------|------------------|-----|---------|------|-------------|---------|--------------------|----------|-------|
| expo-camera | QR/barcode, accessory stills | Y | Y | Y | Limited | N | Typed + USB wedge; file upload | HIGH | DEV simulate only in overlay |
| expo-image-picker | Photos/gallery | Y | Y | Y | Y* | N | Document/file picker | MEDIUM | |
| expo-document-picker | PDF/attachments | Y | Y | Y | Y* | Partial | OS file dialog | MEDIUM | |
| expo-notifications | Push | Y | Y | Y | Limited | N | Inbox-only; Windows toast adapter | HIGH | Skip Expo Go |
| expo-secure-store | Tokens, prefs, push token | Y | Y | Y | Y | N | Windows Credential Locker adapter | **BLOCKER** | Never AsyncStorage |
| expo-local-authentication | Biometrics | Y | Y | Y | Touch ID* | Hello? | Password + MFA | MEDIUM | |
| expo-location | Delivery pins | Y | Y | Y | Y* | N | Address/coords | MEDIUM | |
| react-native-maps | Map picker | Y | Y | Y | Y* | N | Address UI / web map | MEDIUM | |
| expo-file-system | PDF cache, voice | Y | Y | Y | Y | ? | OS paths | MEDIUM | |
| RN Share | PDF share | Y | Y | Y | Share | Save-as | Desktop save/open/print | MEDIUM | No expo-sharing |
| expo-audio | Voice notes | Y | Y | Y | ? | N | Omit / upload file | LOW | Guarded |
| expo-speech | Task TTS | Y | Y | Y | ? | N | Omit | LOW | Guarded |
| expo-haptics | Press feedback | Y | Y | Y | Weak | N | No-op | LOW | |
| expo-blur | Tab bar | Y | Y | Y | Y | N | Solid fill | LOW | |
| expo-clipboard | MFA, passwords | Y | Y | Y | Y | Likely | OS clipboard | LOW | |
| expo-linking | Deep links, PDF open | Y | Y | Y | Y | Protocol | Platform registration | MEDIUM | |
| NetInfo | Offline | Y | Y | Y | Y | Likely | Same | LOW | |
| AsyncStorage | RQ persist, drafts | Y | Y | Y | Y | Y | Same (non-secrets) | LOW | |
| gesture-handler | Rails, sheets | Y | Y | Y | Y | Partial | Risk with Reanimated | HIGH | |
| reanimated + worklets | Chrome everywhere | Y | Y | Y | Y | Fallback | Degrade motion | HIGH | |
| safe-area-context | Insets | Y | Y | Y | Y | Different | Desktop insets | LOW | |
| react-native-screens | Stacks | Y | Y | Y | Y | Partial | Spike | HIGH | |
| react-native-svg | Chrome, QR render | Y | Y | Y | Y | Likely | — | LOW | |
| react-native-qrcode-svg | On-device QR | Y | Y | Y | Y | Likely | — | LOW | |
| expo-router | All navigation | Y | Y | Y | Y | **Undocumented** | Host adapter spike | **BLOCKER** | |
| Custom calendar | Scheduling | Y | Y | Y | Y | Y (JS) | — | LOW | No 3p calendar native |

\* Mac Catalyst / iPad-on-Mac behavior needs UAT.

**Absent packages:** `expo-print`, `expo-sharing`, `expo-device`, `expo-application`, WebView.

---

## 18. Platform adapters required

Concept (do not implement yet):

```
apps/mobile/src/platform/
  scanner.ts              # public API
  scanner.native.ts       # camera + CodeField
  scanner.windows.ts      # keyboard wedge + typed
  secureStorage.*
  biometrics.*
  pushTransport.*
  maps.*
  mediaPicker.*
  fileExport.*            # share vs save-as/print
  audio.* / speech.*
```

**Only capability adapters diverge.** Screens stay shared. Prefer Metro platform extensions over `#ifdef` in feature code.

---

## 19. Scanner / camera / files / maps

### 19.1 QR / barcode

| Flow | Phone | Desktop v1 |
|------|-------|------------|
| Bins, inventory items, fabric, WIP, FIN | Camera (+ CodeField where present) | USB wedge as keyboard + typed CodeField |
| Tasks take-in / materials | Camera + CodeField | Same |
| Delivery load | **Camera only today** | **Must add typed/wedge** |
| Label verify | Camera match | Wedge + typed |

**Abstraction:** `openScan({ title })` → camera UI **or** focus persistent scan field / accept wedge input. Physical scanner is enough for factory desks without webcam for v1.

### 19.2 Camera / photo

Custom orders, returns, AI handwriting, product images, problem reports → adaptive media: camera | library | file upload | drag-drop (desktop).

### 19.3 Documents

`expo-document-picker` + image picker. Desktop: OS file dialog + drag-drop for AI intake / attachments.

### 19.4 Drag and drop (selective)

Genuine wins: product images, custom-order images, documents, AI intake, attachments. **Not** everywhere.

### 19.5 Maps

`LocationMapPicker` (`react-native-maps` + `expo-location`) for new-order / edit-request / dealer address. Windows: address + coordinates (+ optional web map later). Same API shape.

---

## 20. Auth / secure storage / biometrics

| Concern | iOS/iPad | Mac (iPad app) | Windows |
|---------|----------|----------------|---------|
| Tokens | SecureStore | SecureStore | **Credential Locker / native adapter — never AsyncStorage** |
| Biometrics | Face ID / Touch ID | Touch ID where available | Windows Hello **or** password+MFA only |
| MFA | Existing login MFA | Same | Same |
| Session restore | Refresh + `/me` | Same | Same |
| Device registration | Push token row | Same / limited | Different transport or omit push |

**Never weaken security for Windows.**

---

## 21. Notifications

**Shared semantic model (keep):** topic, recipient, preference, inbox, entity, `linkUrl` → `mapNotificationLinkToHref` / `@maher/notifications` resolver — **platform-neutral**.

**Transport:**

| Platform | Transport |
|----------|-----------|
| iPhone / iPad / Android | Expo Push → APNs/FCM |
| Mac via iPad | Limited / UAT |
| Windows | **Do not force Expo mobile push** — platform adapter (Windows toast / none); inbox remains |

API today: `platform: 'ios' | 'android' | 'web'`. Future may add `windows` — additive only.

---

## 22. Downloads / PDF / printing

**Current:** server PDF → authed fetch → `expo-file-system` cache → `Share.share` (`openPdf.ts`). No `expo-print`.

| Use case | Phone | Desktop |
|----------|-------|---------|
| Invoice, PO, statement, QR labels, bin labels, A4 QR sheets, reports | Share / Files | Save-as, download folder, open, print |

**PDF-first is sufficient for v1 desktop** (OS print dialog from PDF). Native print API optional later.

**Factory peripherals v1:** USB barcode (keyboard), label/normal printer via PDF print — **no custom drivers**.

---

## 23. Offline / cache

| Piece | Behavior |
|-------|----------|
| NetInfo | Online manager + OfflineBanner |
| Persist | AsyncStorage whitelist: `catalog/list`, `tasks/list`, `sales-orders/list`, `statements/detail` only |
| Logout | Clears persist key + tokens + push |
| Task outbox | AsyncStorage |

**Share** persistence/retry across phone/tablet/desktop. **Do not** create a desktop-specific offline DB. Multi-window risk: shared cache/auth — v1 single window recommended.

---

## 24. Deep links

| Platform | Registration |
|----------|--------------|
| iOS | Scheme `maher`; optional `applinks:` via `EXPO_ASSOCIATED_DOMAIN` |
| Android | Same scheme; optional https intentFilters |
| Mac | Same iOS listing / universal links UAT |
| Windows | Protocol activation / app links — separate registration |

**Semantic routes stay shared** (Expo paths / notification hrefs).

---

## 25. Backend implications

Same NestJS API for all clients. **No** Windows API / Mac API / Tablet API.

**May eventually need (additive):**

- Device platform enum including `windows`
- Print/export preferences
- Optional push transport metadata

**Must not assume:** phone-only UI, camera required for scan codes (already accept `scanCode` strings), mobile-only identifiers.

Authorization remains server-authoritative and surface-agnostic.

---

## 26. Permissions

`can` / `canAny` / `SurfaceGate` / `PermissionGate` / topic eligibility **remain completely shared**. Platform must not change Finance-on-Windows vs Finance-on-iPad scopes.

---

## 27. Admin responsive audit

| Screen | Classification |
|--------|----------------|
| Home | MINOR RESPONSIVE / shell rail |
| Orders list / detail | NEEDS MASTER/DETAIL |
| Production hub / detail | NEEDS MASTER/DETAIL |
| Production Plan | NEEDS NEW LARGE-SCREEN COMPOSITION |
| Scheduling | NEEDS COMPOSITION + DESKTOP |
| Inventory hub / item | NEEDS MASTER/DETAIL + DATA TABLE optional |
| Purchasing / PO | NEEDS MASTER/DETAIL + TABLE |
| Products / variants | NEEDS MASTER/DETAIL; BOM DESKTOP |
| Dealers | NEEDS MASTER/DETAIL |
| Invoices / returns / users | NEEDS MASTER/DETAIL; TABLE optional |
| Cost & Performance | NEEDS DATA TABLE + COMPOSITION |
| Settings / notifications / AI chat | ALREADY GOOD / MINOR |
| More hub | Replaced by sidebar on WIDE |

---

## 28. Dealer responsive audit

Keep simpler on desktop. Widen catalog/PDP; denser orders/invoices; do not add admin modules. New order benefits from 2-col form, not a factory sidebar.

---

## 29. Worker responsive audit

Phone / tablet / Windows floor terminal: prioritize Today, tasks, lane, scan/take-in, task execution. Persistent scan field on large screens. **No admin-style sidebar.**

---

## 30. Cost & Performance

Six desks (Money, Orders, Products, Inventory, Returns, Coverage) already use floor boards + tab bar. Desktop opportunities: tables, comparison grids, split panes (list \| dossier), sticky period controls, wider charts — **without rewriting costing logic**.

---

## 31. Production Plan

**Current:** SO item board; `?lineId=` opens `OrderProductionPlanEditorScreen` (~1927 lines, weak extraction). Materials, fabric, workflow, workers, release via boards/sheets.

**Proposed large-screen composition (concept from current structure):**

| Region | Content |
|--------|---------|
| LEFT | SO items board (existing) |
| CENTER | Selected item setup / workflow / materials |
| RIGHT | Readiness / actions / release |

Extract stable sections **before** deep responsive work inside the editor; wrap first.

---

## 32. Scheduling

**Current:** month board, day workspace, workers, unscheduled, capacity, assign, overtime, exceptions — **manual assignment only** (preserve).

| Form factor | Ideal |
|-------------|-------|
| Tablet | Month + side day/order sheet → split pane |
| Desktop | Month \| day/worker \| selected work detail |

Do not reintroduce automatic scheduling.

---

## 33. Inventory

Hub (signature), RAW/SEMI/FIN, item detail, warehouse/bin, ledger, transfer, count, receive, fabric.

**Desktop wins:** split hub \| item; table for materials; **persistent scan field**; receive queue denser. QR label PDF stays PDF-first.

---

## 34. RTL / accessibility

**RTL architecture (keep):** Yoga forced LTR (`lockNativeLayoutLtr`); JS `row-reverse` / `textAlign` / start-edge rails; Expo `supportsRTL: false`. Sidebars, split panes, tables, master/detail, dialogs must use the same JS RTL rules — **do not enable native forceRTL** on Windows/mac.

**A11y:** many `accessibilityLabel`/`Role` on controls; weak keyboard focus. Universal needs stronger focus, contrast (high-contrast theme exists), labels, touch **and** pointer targets.

---

## 35. Performance

FlatList + infinite query on major hubs; no FlashList. Desktop shows more rows → watch Orders, Products, Inventory, Tasks, Returns, Purchasing, Users, Cost lists. God screens are render hotspots. Virtualization/pagination review later — not now.

---

## 36. God-file / adaptive-composition risks

| File | Lines | Shared sections exist? | Extract before responsive? | Leave untouched if wrapping works |
|------|------:|------------------------|----------------------------|-----------------------------------|
| OrderDetailScreen | 2216 | Many comps | Only if split cannot host | Prefer wrap |
| TaskDetailScreen | 2001 | Floor sections | Scan/action dock maybe | Prefer wrap |
| ProductionDetailScreen | 1945 | Yes | Mild | Prefer wrap |
| OrderProductionPlanEditorScreen | 1927 | Weak | **Yes — before 3-pane** | — |
| InventorySignatureHome | 1856 | Many comps | Hub chrome vs list | Prefer wrap |
| NewOrderScreen | 1800 | Steps/blocks | For 2-col | Mild |
| AdminRequestDetailScreen | 1570 | Boards | For desktop desk | Mild |
| DealerDetailScreen | 1423 | Rails | Ideal for split | Wrap |
| ReturnDetailScreen | 1318 | Boards | Mild | Wrap |
| AdminScheduleSheets | 2185 | Many sheets | Overlay adapt first | — |

**Goal:** safe adaptive composition, not refactoring for sport.

---

## 37. Proposed code organization

```
apps/mobile/src/
  features/          # shared (unchanged ownership)
  adaptive/          # useMaherLayout, SplitPane, AdaptiveOverlay, DataRow (future)
  platform/          # capability adapters only
  navigation/        # chrome variants
  components/        # shared primitives
```

**Do not** platform-suffix components that do not need it.

---

## 38. Windows project recommendation

**Choose Option B:** `apps/windows` host importing shared mobile features + `packages/*`, own RNW native project + Metro.

| Option | Verdict |
|--------|---------|
| A — Windows inside `apps/mobile` Expo CNG | Reject first — fights Expo platforms/plugins |
| **B — `apps/windows` host** | **Recommended** — isolation, Store packaging, Metro control |
| C — extract all features to packages first | Premature; reuse via path/workspace imports |

Spike must prove Expo Router (or adapter) + SecureStore equivalent + Reanimated before productizing.

---

## 39. Apple distribution recommendation

- **One iOS app** for iPhone + iPad (same listing where appropriate).
- **Apple Silicon Mac:** enable “iPhone & iPad Apps on Mac” / compatible distribution **after UAT**.
- UAT before Mac enablement: window classes, keyboard, trackpad hover, PDF save, typed scan, orientation/split, EN/AR/HE, biometrics fallback, notifications.

---

## 40. Test matrix (future)

| Device | EN | AR | HE |
|--------|----|----|----|
| iPhone small / large | ✓ | ✓ | ✓ |
| iPad portrait / landscape / split | ✓ | ✓ | ✓ |
| Android phone / tablet | ✓ | ✓ | ✓ |
| Apple Silicon Mac | ✓ | ✓ | ✓ |
| Windows small / medium / wide (+ touch if available) | ✓ | ✓ | ✓ |

Do not run unavailable Windows tests yet.

---

## 41. CI / build impact

**Current:** mobile typecheck + Jest; monorepo typecheck/test; Playwright (web); no Windows lane.

**Future complexity:** shared RN tests; iOS/Android EAS; optional Windows CI (windows-latest, longer); keep admin-web Playwright. Estimate: **significant** CI cost when Windows is added — not before spike.

---

## 42. Version / update strategy

| Concern | Recommendation |
|---------|----------------|
| App version | Shared `Maher App x.y.z` where practical |
| Build numbers | Per store (iOS buildNumber, Android versionCode, Windows package) |
| Backend | Compatible with prior mobile/desktop during rollout |
| iOS/iPad/Mac | App Store / TestFlight; EAS Update where appropriate |
| Windows | Microsoft Store / MSIX — **do not assume EAS Update updates native Windows** |

---

## 43. Security implications

Desktop must not weaken: token storage, biometrics, device identity, session revocation, MFA, notifications, deep links, downloads, caches. **No unencrypted dumps of factory data to generic files.** Query persist stays non-secret whitelist.

---

## 44. Code reuse estimate

| Layer | Reuse range | Evidence |
|-------|-------------|----------|
| API client / modules | **95–100%** | Pure HTTP |
| Queries / selectors | **90–100%** | Pure TS |
| Permissions / i18n / notification semantics | **95–100%** | Packages |
| Feature business logic | **80–90%** | Screens orchestrate shared selects |
| Feature UI sections | **60–80%** | Boards reusable if composed |
| UI primitives (pressable/sheet) | **40–70%** | Need hover/focus/overlay modes |
| Navigation chrome | **20–40%** | New rail/sidebar |
| Native capabilities | **70–90%** Apple path; **10–30%** Windows without adapters | Matrix above |

---

## 45. Windows go / no-go analysis

**Would factory benefit?** Yes — finance, purchasing, planning, warehouse terminals, scheduling desks on Windows PCs are real personas.

**Is responsive web simpler?** Admin-web already exists but is **frozen** and not the primary product. Universal RN reuses the mobile investment the factory already uses.

**Decision:** **Conditional later-go, not v1.** Reject Windows for phases 1–4 because Expo Router + SecureStore + camera/maps/push/Reanimated are not compatible without a spike. Prefer iPad / iPad-on-Mac for large-screen ERP first. Proceed to Windows only if spike proves host + secure storage + scanner-as-keyboard + PDF print.

---

## 46. Mac strategy

| Question | Answer |
|----------|--------|
| Is iPad-on-Mac sufficient initially? | **Yes** |
| What breaks? | Density, sheets, hover/keyboard, camera-only flows, Share PDF, swipe tabs |
| What justifies true macOS later? | Intel Mac requirement; native menu bar / file / window APIs; proven iPad-on-Mac inadequacy |

**True macOS now? NO.**

---

## 47. Final recommended platform roadmap

```text
PHASE 1  Finish / release current phone app
PHASE 2  Universal adaptive layout foundation + shell + overlay + 4 benchmarks
PHASE 3  iPad + Android tablet (orientation, split, EN/AR/HE)
PHASE 4  Apple Silicon Mac via iPad app (after UAT)
PHASE 5  Windows spike (Router + SecureStore + Reanimated + scanner)
PHASE 6  React Native Windows host + Microsoft Store (if spike passes)
PHASE 7  Evaluate true macOS only if needed
```

Website remains **FROZEN / FUTURE OPTIONAL WEB CLIENT** — same backend conceptually; do not migrate features into this roadmap.

```text
              SHARED MAHER BACKEND
                      │
        ┌─────────────┼──────────────┐
        │             │              │
     iPhone         iPad          Android
        │             │              │
        └────── Apple Silicon Mac    │
                      │              │
                      └──── Windows (later)
```

---

## 48. Implementation phases

### Phase 1 — Phone release stability
- **Scope:** ship current phone app; do not mix universal work into dirty demo/users diffs
- **Risk:** low
- **Tests:** existing mobile Jest + UAT
- **Accept:** phone production-ready on iOS/Android
- **Depends:** none

### Phase 2 — Adaptive foundation
- **Scope:** `useMaherLayout`, density tokens, AdaptiveOverlay (BottomSheet-compatible), admin chrome (tabs→rail→sidebar), SplitPane host; benchmarks: Admin Home, Orders list|detail, Inventory hub+scan field, Scheduling month|day
- **Files:** `src/adaptive/*`, `navigation/*`, benchmark feature hosts only
- **Risk:** medium (chrome remount)
- **Tests:** layout unit tests; EN/AR/HE smoke; resize persistence
- **Accept:** window class changes without losing form/selection; four benchmarks pass UAT on resized iPad sim
- **Depends:** Phase 1

### Phase 3 — Tablet
- **Scope:** unlock orientation for tablet; fix fixed grids; sheet→dialog on MEDIUM+; catalog columns; dealer/worker tablet passes
- **Risk:** medium
- **Tests:** iPad portrait/landscape/split; Android tablet
- **Accept:** no wasted full-bleed phone cards on iPad landscape for benchmarks + top admin desks
- **Depends:** Phase 2

### Phase 4 — iPad-on-Mac
- **Scope:** hover/focus on primitives; Escape closes overlay; PDF save/open; scanner typed everywhere (esp. delivery); keyboard shortcuts optional
- **Risk:** medium
- **Tests:** Apple Silicon Mac UAT EN/AR/HE
- **Accept:** Mac App availability checklist green
- **Depends:** Phase 3

### Phase 5 — Windows spike (research only productization gate)
- **Scope:** RNW 0.81 host skeleton; Expo Router or adapter proof; SecureStore equivalent; Reanimated behavior; Metro monorepo
- **Risk:** high / blocker possible
- **Tests:** spike checklist doc
- **Accept:** go/no-go written with evidence
- **Depends:** Phase 2+ (can parallel after 2)

### Phase 6 — Windows product (if go)
- **Scope:** `apps/windows`; adapters (scanner, maps, push, files); Store packaging
- **Risk:** high
- **Tests:** Windows size matrix + factory UAT
- **Accept:** Admin finance/purchasing/scheduling + worker scan desk viable
- **Depends:** Phase 5 go

### Phase 7 — True macOS (optional)
- **Scope:** only if Phase 4 fails business needs or Intel required
- **Depends:** explicit business decision

---

## 49. First implementation phase

**After this audit, give Cursor:**

1. Adaptive layout API (`useMaherLayout`) + tests  
2. Shared navigation shell (admin tabs → rail → sidebar from `tabConfig` + `ADMIN_OVERFLOW_MODULES`)  
3. Adaptive overlay primitive wrapping `BottomSheet`  
4. **Four benchmark screens:**
   - Admin Home  
   - Orders list (master/detail host of existing list + detail)  
   - Inventory hub (persistent scan + `CodeField`)  
   - Scheduling (month | day workspace)  

**Deferred to phase 2 benchmarks:** Production Plan editor, Order Detail internals (wrap only if needed).

**Explicit non-goals for first phase:** install RN Windows; unlock orientation globally before shell exists; rewrite website; change backend behavior; god-file cleanups for sport.

---

## 50. Open decisions / blockers

| ID | Item | Status |
|----|------|--------|
| O1 | Exact breakpoint pixels after physical iPad split UAT | Open |
| O2 | Expo Router on RNW — prove or replace with adapter | **BLOCKER for Windows** |
| O3 | Windows secure credential store choice | **BLOCKER for Windows** |
| O4 | Push on Windows: none vs toast vs third party | Open |
| O5 | When to enable Mac App Store “iPad app on Mac” | After Phase 4 UAT |
| O6 | Whether factory mandates Windows terminals in year 1 | Business |
| O7 | FlashList adoption for desktop-dense lists | Open |
| O8 | Evolve floor skill vs new universal aesthetic skill | Prefer after Phase 2 |
| O9 | Delivery load typed-scan before desktop factory UAT | Required |
| O10 | Dirty worktree — keep universal work off demo/users branch noise | Process |

---

## Appendix A — Top 10 blockers (summary)

1. Phone-only layout (portrait lock, no window classes)  
2. Bottom-tab + swipe chrome vs needed sidebar/rail  
3. BottomSheet-only overlays (~100 hosts)  
4. No pointer hover / keyboard focus / shortcuts  
5. Camera-first scan; delivery load lacks typed path  
6. Expo Router undocumented on Windows  
7. `expo-secure-store` has no Windows story  
8. `expo-notifications` / maps / camera Expo modules not for RNW  
9. Reanimated 4–heavy chrome on Windows fallback risk  
10. God files (plan editor especially) make naive splits dangerous  

---

## Appendix B — Current readiness snapshot

| Platform | Status |
|----------|--------|
| **IPHONE** | **READY** |
| **ANDROID PHONE** | **READY** (CNG Android on EAS/prebuild) |
| **IPAD** | **~15–25%** — main blockers: orientation, breakpoints, chrome, sheets |
| **ANDROID TABLET** | **~15–25%** — same width-driven blockers |
| **APPLE SILICON MAC** | **~10–20%** — tablet + input/PDF/scan gaps |
| **WINDOWS** | Later / spike-gated — biggest blockers: Expo Router, SecureStore, camera/maps/push, Reanimated |
| **TRUE MACOS** | **NO** — not needed now |

---

*End of audit. No application source was changed to produce this document.*
