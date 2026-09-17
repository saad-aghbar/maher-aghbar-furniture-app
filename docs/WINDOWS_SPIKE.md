# Windows feasibility spike (gated, last)

**Status: spike only. No React Native Windows port was started.**

This document is the Wave 11 gate from the Universal App complete plan. Apple Silicon Mac, iPad, and Android tablet work come first. Windows is evaluated here and then stopped.

## What was asked

Run a feasibility spike for a Windows desktop host of the same Maher mobile product (not a second UI): RNW host, routing, secure credential storage, Reanimated, scanner keyboard-wedge, Metro/monorepo integration. Either document exact blockers or produce a Windows plan. Do not start the port.

## Product constraint that already helps

Designed-for-iPad on Apple Silicon reports `Platform.OS === 'ios'`. A Windows host would be a **new** `Platform.OS === 'windows'` (RNW) or a web surface. This repo froze the websites. A Windows port is therefore a new native target, not a reuse of admin-web.

## Findings

### 1. Expo SDK 54 / Expo Router 6 do not host Windows

`apps/mobile/app.config.ts` declares `platforms: ['ios', 'android']`. Expo SDK 54 does not ship a first-party Windows runtime. Expo Router 6 file-based routes, Expo modules (`expo-secure-store`, `expo-camera`, `expo-local-authentication`, `expo-location`, `expo-file-system`, `expo-notifications`), and the Expo config plugins (`withAndroidTabletOrientation`, `withPersonalTeamIosCapabilities`) are iOS/Android (and web) only.

A Windows app would need either:

- **React Native Windows** (community, RN 0.81 line exists but is not wired to Expo Router), or
- **A separate RNW host** that imports shared `src/features/*` and re-implements navigation, or
- **PWA / RN-web** — rejected; websites stay frozen and the product contract is native chrome.

**Blocker: Expo Router + Expo modules are the app shell. There is no supported `expo run:windows`.**

### 2. Routing

Live routes live under `apps/mobile/app/` (141 files). Expo Router owns deep links (`maher://`), surface guards, and tab layouts.

RNW would need React Navigation 7 without Expo Router, or an unproven Expo Router Windows plugin. Either way, every `Href` string and `router.setParams({ selected })` desk host would have to keep working. That is a rewrite of `app/`, not a config flag.

**Blocker: no Expo Router Windows adapter in this repo or in Expo SDK 54.**

### 3. Secure credential storage / MFA / biometrics

Today: `expo-secure-store` (iOS Keychain / Android Keystore), `expo-local-authentication` (Face ID / biometrics), MFA screen in `(auth)/mfa`.

Windows equivalent is Windows Hello + Credential Locker (`PasswordVault`) or DPAPI. `expo-secure-store` does not implement Windows. `react-native-windows` has no drop-in SecureStore.

**Blocker: auth storage would be a new native module. Do not ship dealer passwords in AsyncStorage.** Until that module exists and is reviewed, Windows is a security non-starter.

### 4. Reanimated 4

The floor aesthetic and `AnimatedPressable` / overlay motion use `react-native-reanimated` ~4.1 with the New Architecture. RNW Reanimated support historically lags and often needs the paper renderer or a reduced animation path.

**Likely blocker / high risk:** overlay open/close, tab pill, and press scale would need a Windows-specific motion fallback. Not proven in this repo.

### 5. Scanner keyboard-wedge

This is the one area Windows is *easier*. HID barcode wedges already type into `CodeField` / `TextField`. Wave 1 typed paths (`dispatchIdentifyCode`, `applyCode`, `runLabelVerify(undefined, code)`, `scanWarehouseBin(typed)`, delivery `applyLotQr`, task `onScan(typed)`) are the canonical resolvers. A Windows wedge would hit those fields without a camera.

Camera remains for phones/tablets. On a desk PC, typed/wedge is the intended path.

**Not a blocker** — typed scan is already the shared business path.

### 6. Metro / monorepo

The app is `apps/mobile` in a pnpm + turbo monorepo with workspace packages (`@maher/permissions`, `@maher/i18n`, `@maher/types`, …). Metro is configured for Expo. RNW typically wants `react-native-windows` autolinking and a `.sln` / C++ host.

**Blocker: Metro config, autolinking, and the Windows CMake/MSBuild host are not present. Adding them is a new native project, not a package.json script.**

### 7. Maps, PDF, files

- `react-native-maps` is iOS/Android. Windows would use address-only (already in `LocationMapPicker`) or Bing/MapControl.
- PDF open/share uses `Share.share` + `expo-file-system`. Windows would use `Launcher.LaunchFileAsync` / print broker.
- `expo-document-picker` exists as a dependency but camera fallback already uses `expo-image-picker` library.

These are work, not conceptual blockers, **after** the shell exists.

## Decision

**Do not start a Windows port.** Exact blockers, in order:

1. Expo SDK 54 + Expo Router 6 have no Windows host.
2. SecureStore / biometrics have no Windows implementation; shipping without one is a security defect.
3. Reanimated 4 + New Architecture on RNW is unproven here.
4. Metro/monorepo + RNW autolinking would be a new native project (Visual Studio, Windows SDK, C++/WinRT).

A future Windows plan, if requested after Apple/tablet UAT, would be a separate RNW app that:

- Reuses `src/features/**`, `src/adaptive/**`, and `@maher/*` packages.
- Replaces `app/` with a React Navigation 7 tree that mirrors Expo Router hrefs.
- Adds a reviewed Credential Locker module before any login.
- Uses keyboard-wedge + `CodeField` as the scanner.
- Disables or stubs camera, push, and maps until each has a Windows module.
- Treats Reanimated as optional; CSS-like RNW animation as the fallback.

Estimated effort: a dedicated project (weeks), not a config plugin. Not scheduled.

## Out of scope (confirmed)

- No `react-native-windows` package added.
- No `.sln` / `windows/` folder.
- No change to `platforms` in `app.config.ts`.
- Websites remain frozen.
