# Universal App — Final UAT (2026-09-17)

This is the runtime evidence record. Implementation status for all ~142 routes remains in [UNIVERSAL_APP_COMPLETE_IMPLEMENTATION.md](./UNIVERSAL_APP_COMPLETE_IMPLEMENTATION.md). Those PASS cells mean the route is on the adaptive path. They are **not** equivalent to “every screen was tapped on every device.”

**Start SHA (2026-09-17 pass):** `d107990f5fdfcfd4b8a20552922d0d4129b43cd1`  
**Branch:** `main`

## Blocker closure — 2026-09-18

Previous pass is unchanged below. This section is the follow-up: Android Metro root cause, language switch, deep links, PDF bytes, permission smoke. It does **not** rewrite the 2026-09-17 FAIL rows; it records what was re-run.

### Android Metro timeout — root cause

Not an adaptive-layout bug.

1. Dest launcher is the first screen of `jo.maheraghbar.furniture` after force-stop. It lists `http://10.0.2.2:8081` and recently-opened `http://192.168.1.15:8081`.
2. The 2026-09-17 ANR (`anr_2026-09-17-17-54-13-406`) matches dest-client waiting on Metro while the bundler was down or the LAN URL was used against a dead session.
3. **Proven from the emulator (2026-09-18):**
   - `adb reverse tcp:8081 tcp:8081` and `tcp:4000 tcp:4000` present
   - `10.0.2.2:4000/api/v1/health` → 200 `{"status":"ok"}`
   - `10.0.2.2:8081/status` → `packager-status:running`
   - `192.168.1.15:8081/status` → 200 (LAN also works when Metro `--host lan` is up)
   - Guest `127.0.0.1:8081` via `toybox nc` did **not** answer — do not rely on emulator loopback without reverse actually forwarding
4. Opening `exp+maher-aghbar-furniture://expo-development-client/?url=http://10.0.2.2:8081` loaded JS (`جار استعادة الجلسة…` then login). Metro logged `Android Bundled`.
5. `getApiBaseUrl()` already rewrites loopback → `http://10.0.2.2:4000` on Android when Metro host is loopback. With dest-client `hostUri` `10.0.2.2:8081`, API follows that host (`http://10.0.2.2:4000`). No production config change.

**Fix for operators:** keep Metro up (`expo start --host lan`), connect dest client to **`http://10.0.2.2:8081`**, keep `adb reverse` as belt-and-suspenders. Do not leave dest client on a stale LAN IP after Metro died.

**Logged-in Android UAT:** still **not PASS**. After JS login rendered, `__DEV__` element inspector (`Inspect` / `Touchables`) intercepted taps. `adb shell input text admin` is consistent with RN DevTools treating **`i`** as inspect. Portrait rotation of the login screen succeeded (form still capped, not stretched). Admin/Dealer/Worker Android tablet flows were not completed.

Evidence: [universal-uat-evidence/android-closure/](./universal-uat-evidence/android-closure/).

### Languages (re-run)

Previous Maestro result (EN/HE stayed AR) was **UAT hit-testing**, not missing catalogs.

| Locale | 2026-09-17 | 2026-09-18 |
| --- | --- | --- |
| AR | PASS | PASS — default + restore after HE |
| EN | FAIL | **PASS** — Android tablet login: Username / Password / Sign in; pill `EN` |
| HE | FAIL | **PASS** — Android tablet login: שם משתמש / סיסמה / התחברות; pill `HE`; labels on start-edge (RTL JS) |
| HE RTL chrome | not run | **PASS (login)** — Hebrew login RTL. Native `I18nManager.allowRTL=false` (lockNativeLayoutLtr). IDs not on login. iPad dest-client account still showed AR after earlier EN session (SecureStore). |
| Persistence | not proven | Locale is SecureStore `maher.locale`. Restart not required for switch. |

Switcher: catcher already behind the pill; **hitSlop** added on `locale-option-*` so HE (edge chip) is harder to miss.

### iPad dest-client (re-run, Admin)

iPad Pro 13" M5 dest client (not Expo Go): Admin Home AR RTL sidebar on the end edge. Deep link `maher:///(app)/(admin)/orders/14beff64-8476-40ca-a08b-dd977c3a48ab` → **SO-GOLDEN-001** detail, IDs LTR. Invoice `INV-COST-VAR-XL-1` detail with PDF CTA. Admin → dealer catalog and Admin → worker tasks → permission gate (sidebar stays admin-only).

**iPad Dealer login (`nile`) / Worker login (`carpenter`):** still **not completed** this pass (account logout is below the fold; no reliable Simulator tap). iPhone dealer/worker from 2026-09-17 remains the logged-in evidence.

### PDF / files

`GET /api/v1/invoices/b9dd1f0c-fa1d-4cb1-900d-9a27289d069c/pdf?lang=en&theme=brown` with admin Bearer → **200** `application/pdf` 169 201 bytes, magic `%PDF-`. Saved [universal-uat-evidence/pdf/INV-COST-VAR-XL-1.pdf](./universal-uat-evidence/pdf/INV-COST-VAR-XL-1.pdf). In-app share sheet on iPad was **not** tapped (PDF CTA visible on invoice detail). Architecture unchanged.

### Camera

Unchanged: **PHYSICAL DEVICE UAT REQUIRED**. Typed scan still the Simulator path.

### Resize / Stage Manager

Unchanged: rotation EXPANDED↔WIDE from 2026-09-17. Device Hub **Enter Resize Mode** / independent 600/900/1200 pt **not proven**. Status: **PARTIAL — physical Stage Manager / windowed iPad required**.

### Deep links / permissions

**PASS** on iPad dest client for order detail, invoice detail, dealer-catalog gate, worker-tasks gate. `maher://` while Expo Go is also installed can open Expo Go instead of dest client — launch `jo.maheraghbar.furniture` first.

### Mac / Windows

Unchanged. Signing still **BLOCKED — EXTERNAL**. Windows spike only.

## Environment

| Item | Value |
| --- | --- |
| Demo | `pnpm demo:reset` + `pnpm demo:validate` (canonical fixture, 23 SOs) |
| API | `http://127.0.0.1:4000/api/v1/health` → 200. Listens on `*:4000`. Not staging/production. |
| Metro | `http://127.0.0.1:8081` running dest client |
| Logins used | Seeded cheat-sheet only: `admin`, `nile`, `carpenter` / `123`. Credentials were not written into application source. |
| iPhone | iPhone 17 Pro — `ADC59F4A-8225-4972-B912-7D8BDE109C3E` — iOS 26.5 |
| iPad 11 | iPad Pro 11-inch (M5) — `C1648120-D36A-4055-B3CB-6B5BA96FC284` — iOS 26.5 |
| iPad 13 | iPad Pro 13-inch (M5) — `62BFE1AD-4B6C-409C-AC14-9712692751D6` — iOS 26.5 |
| Android | AVD `maher_tablet` Pixel Tablet API 35, `emulator-5554`, 2560×1600 @ 320dpi (`sw800dp` landscape) |
| Mac | UDID `00006050-001218660131401C`, Personal Team `NR2ZFUP7R7`, bundle `jo.maheraghbar.furniture` |

## Fixes made because UAT / build proved them

1. **Login form stretch on tablet** — `LoginScreenContent` caps width with `density.dialogMaxWidth` (compact stays full-bleed). Proven on iPad 11 login.
2. **CocoaPods iOS deployment target 11–13.4 vs Xcode ≥15** — `Podfile.properties.json` `ios.deploymentTarget=15.1` + `post_install` on Pod targets. Not a signing issue.
3. **Android emulator API URL** — loopback `EXPO_PUBLIC_API_BASE_URL` now rewrites to `http://10.0.2.2:4000` on Android when Metro has no LAN host. Jest covers it.
4. **Android tablet letterbox / portrait lock** — Expo `orientation: 'portrait'` wrote `android:screenOrientation="portrait"`. Plugin `withAndroidTabletOrientation` never injected because it searched for `super.onCreate(null);` (Java semicolon) on Kotlin. Plugin now sets MainActivity `unspecified` + `FULL_USER` on `sw600dp`. **Not re-proven on a healthy logged-in Android JS session** (Metro died first).
5. **Locale switcher hit-testing** — catcher moved behind the pill; `testID`s added. Runtime EN/HE switch still failed under Maestro; do not treat as proven fixed.

## iPhone 17 Pro — COMPACT — PASS (AR)

Logged in as System Admin, then Dealer (`nile`), then Worker (`carpenter`). Bottom tabs / dealer pill / worker pill. No admin rail. No giant tablet spacing.

Exercised (screenshots under `docs/universal-uat-evidence/iphone/` and `/tmp/universal-uat/screenshots/iphone/`):

- Auth: login (pasteboard; Maestro `inputText` does not fill RN New Architecture fields on iOS), logout, session restore. MFA not on these demo accounts.
- Admin: Home, Orders, Order detail, Production, Production Plan, Scheduling, Inventory (+ QR control; typed dock is EXPANDED+), Purchasing, Products, Dealers, Returns + return detail, Invoices, Cost & Performance, Users, Staff Types, Notifications, Settings, More.
- Deep links: `maher:///(app)/(admin)/…` after dest Open confirm. Dealer hitting an admin URL shows the permission gate.
- Dealer: Home, Catalog, New Order, Orders, Basket, Invoices, Returns, Statement, order detail. iOS password-save sheet often covered the first frame; dismissed with ليس الآن.
- Worker: Home (Khaled / صالة الإنتاج), Tasks, task detail (`SO-GOLDEN-001`), Completed, Notifications. Worker pill, no dealer FAB, no admin rail.

Phone regression: bottom navigation correct; no accidental sidebar; IDs `SO-…` / `INV-…` stay LTR-safe in RTL.

## iPad Pro 11" portrait — MEDIUM — PASS (AR, admin)

Icon rail on the start edge (right in RTL). No bottom-tab dead clearance. Content uses width (orders pipeline, inventory categories, cost 3×2 desks). Login form centered (not stretched).

Runtime: Admin Home, Orders list, Inventory, Scheduling month, Cost & Performance, Production/Purchasing/Products via deep link (dest “Open in app?” often delayed the filename vs. visible screen).

Dealer/worker on this size: **not logged in**. Opening dealer catalog while still admin correctly showed “ليست لديك صلاحية الوصول إلى هذا القسم”.

## iPad Pro 13" portrait — EXPANDED — PASS (AR, admin)

Labeled sidebar. Orders list | detail with `SO-FB1042` selected. Inventory hub | placeholder + typed scan dock. Scheduling month | day. Production Plan 2-pane (third pane is WIDE-only). Cost 6 desks.

## iPad Pro 13" landscape — WIDE — PASS (AR, admin)

Persistent sidebar, permission-filtered (no module dump). Orders list|detail, selection `SO-FB1042` survives. Inventory typed dock. Scheduling split. Production Plan **3-pane** (readiness | editor placeholder | items). Cost 6-desk 3×2, not mobile-card soup. No dead Back on the detail pane.

## Resize / split — LIMITED

What ran: rotate iPad 13 EXPANDED portrait ↔ WIDE landscape with live admin session. Orders selection `SO-FB1042` present in both.  

What did **not** run: Stage Manager / split-view widths (600 / 900 / 1200 pt independently). Do not claim those widths were emulated.

## Languages

| Locale | Runtime |
| --- | --- |
| AR | **PASS** — default demo language; RTL sidebar/rail, split order, IDs bidi-safe |
| EN | **FAIL** — ExpandableLocaleSwitcher never changed the UI off `AR` in this pass |
| HE | **FAIL** — same |
| RTL | **PASS** for Arabic |

## Deep links — PASS (iOS)

`/orders/[id]`, inventory item, return detail, production-plan, worker task, notification-equivalent dest URLs. Master/detail did not replace canonical `/orders/[id]`. Dest client “Open in …?” must be confirmed once.

## Permissions — PASS (spot)

Dealer session hitting admin scheduling → permission gate. Admin session hitting dealer catalog → permission gate. Sidebar/rail stayed admin-only for admin.

## Inventory scan

| Path | Evidence |
| --- | --- |
| Camera | Simulator has no camera. Not a runtime PASS. Library fallback is implemented, not interactively proven here. |
| Typed | **PASS** on iPad 13 EXPANDED/WIDE (persistent dock “امسح أو اكتب الرمز” / SKU / QR). COMPACT uses QR + search, no dock (by `isAtLeast(expanded)`). |

## Scheduling — PASS (iOS admin)

COMPACT month. MEDIUM/EXPANDED/WIDE month|day composition. Focus modes not exhaustively clicked.

## Production Plan — PASS (iOS admin)

COMPACT stack. WIDE 3-pane. No domain/release mutation was attempted beyond viewing `SO-GOLDEN-001`.

## Dealer — PASS on iPhone COMPACT; NOT RUN on tablet login

iPhone dealer chrome (pill + FAB) is correct. iPad dealer login did not complete (logout never left `@admin` account).

## Worker — PASS on iPhone COMPACT; NOT RUN on tablet login

## Keyboard / pointer — LIMITED

No Designed-for-iPad Mac session. iOS Simulator is touch. Implementation (focus ring, Escape, shortcuts host) is in tree; hardware pointer UAT **NOT RUN**.

## PDF / files / maps — NOT RUN this pass (implementation present)

Share-sheet PDF path, ImagePicker library fallback, map + address field exist. This closure pass did not operate them on device.

## Android tablet — FAIL (logged-in UAT incomplete)

- AVD booted. Debug APK **builds** with portable Temurin 17 (`/tmp/universal-uat/jdk-17.0.16+8`) after JDK 24 CMake failure.
- Dest launcher is full-width landscape.
- Connecting to Metro `192.168.1.15:8081` reached a login frame once, then **Error loading app / timeout**, then **ANR**.
- `10.0.2.2:8081` via `adb reverse` also timed out.
- Therefore: **do not treat iPad success as Android PASS.**

## Tests

```
pnpm --filter @maher/mobile typecheck
  PASS

pnpm --filter @maher/mobile test -- --ci --watchAll=false --forceExit
  Test Suites: 385 passed / 385
  Tests:       2302 passed / 2302

pnpm --filter @maher/permissions test -- --ci --watchAll=false --forceExit
  8 suites / 50 tests PASS

pnpm --filter @maher/notifications test -- --ci --watchAll=false --forceExit
  3 suites / 36 tests PASS

pnpm --filter @maher/workflow-domain test -- --ci --watchAll=false --forceExit
  4 suites / 56 tests PASS (1 skipped)
```

`act()` console noise in some RN Testing Library suites is not a failure.

iOS Simulator native rebuild after Pods: `xcodebuild … -destination 'platform=iOS Simulator,id=ADC59F4A-…' CODE_SIGNING_ALLOWED=NO` → **BUILD SUCCEEDED**.

## Mac Designed-for-iPad

| Layer | Result |
| --- | --- |
| Deployment target | **FIXED** (15.1) |
| Signing | **BLOCKED — EXTERNAL** |
| Runtime UAT | **NOT RUN** |

Required next action (account, not code): paid Apple Developer team; register Mac `00006050-001218660131401C`; regenerate profile for `jo.maheraghbar.furniture`; select that team in Xcode/EAS. Do not put Apple passwords in the repo.

## Route matrix — honest split

| Kind | Count |
| --- | --- |
| Implementation rows in COMPLETE_IMPLEMENTATION | 142 |
| Implementation all-class PASS | 134 |
| Implementation NOT APPLICABLE (redirects) | 7 |
| Runtime UAT — manually operated high-traffic flows | Admin Home/Orders/detail/Inventory/Scheduling/Production/Plan/Purchasing/Products/Cost/Users/Notifications/Settings; Dealer COMPACT suite; Worker COMPACT suite; iPad 11 MEDIUM admin; iPad 13 EXPANDED+WIDE admin |
| Runtime UAT — remaining ~100 routes | Structural / implementation only |

Example:

| Route | Compact impl | Medium impl | Expanded impl | Wide impl | Runtime |
| --- | --- | --- | --- | --- | --- |
| Orders | PASS | PASS | PASS | PASS | iPhone PASS; iPad 11 PASS; iPad 13 portrait PASS; iPad wide PASS; Android FAIL; Mac BLOCKED |
| Inventory | PASS | PASS | PASS | PASS | same pattern; typed dock EXPANDED+ |
| Production Plan | PASS | PASS | PASS | PASS | COMPACT + WIDE 3-pane photographed |
| Worker tasks | PASS | PASS | PASS | PASS | iPhone PASS; tablet login NOT RUN |

## Screenshots

`docs/universal-uat-evidence/` (compressed). Raw dumps remain in `/tmp/universal-uat/screenshots/` and are not committed.

Arabic is the language of essentially every iPhone/iPad evidence frame. Hebrew was not captured as a real locale change.

## Windows

Spike only. [WINDOWS_SPIKE.md](./WINDOWS_SPIKE.md). No RN Windows port started.

## Web

`admin-web`, `customer-portal`, `employee-portal` untouched.

## Remaining debt

- Finish Android tablet logged-in UAT after Metro is reachable; re-check landscape letterbox on a healthy JS session.
- Prove EN/HE switch (and RTL for Hebrew) on Admin + Dealer + Worker.
- iPad dealer/worker chrome login.
- Stage Manager / true split widths.
- Mac runtime after paid signing.
- Pre-existing i18n leftovers.
- MFA path (not on demo users used here).
