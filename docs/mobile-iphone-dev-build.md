# Maher development build on a physical iPhone

This is the local **development client** for `@maher/mobile` (Expo SDK **54** / React Native **0.81**). It installs as its own app (`Maher Al-Aghbar Furniture`, bundle `jo.maheraghbar.furniture`) and talks to Metro for Fast Refresh. It is **not** Expo Go and **not** an App Store build.

Do **not** upgrade Expo SDK to match App Store Expo Go 57. Keep this project on SDK 54.

## Why Expo Go is the wrong client now

App Store Expo Go is SDK 57. This repo is SDK 54. Apple will not let an older Expo Go live on a physical iPhone. The development build is the supported physical-device path.

The iOS **Simulator** can still use Expo Go 54 (`pnpm mobile:start` + press `i`). Do not change that workflow.

## One-time Mac + iPhone setup

### 1. Plug in the iPhone and pair it

1. Unlock the iPhone.
2. USB-C/Lightning to the Mac.
3. On the iPhone: **Trust This Computer** → enter the passcode.
4. On the Mac, if prompted: **Trust**.
5. Confirm Xcode sees it: `xcrun xctrace list devices` — the iPhone must appear under **Devices**, not **Devices Offline**.

### 2. Developer Mode (iOS 16+)

On the iPhone: **Settings → Privacy & Security → Developer Mode** → On → restart if asked → confirm.

### 3. Apple Development certificate (required)

`expo run:ios --device` fails with **No code signing certificates are available to use** until Xcode creates an **Apple Development** identity. The Apple ID / Personal Team can exist without any certificate in the keychain.

Exact clicks:

1. Open **Xcode** (Dock or Spotlight).
2. Menu **Xcode → Settings…** (or **Preferences…** on older Xcode) → **Accounts**.
3. If no Apple ID is listed: **+** (bottom left) → **Apple ID** → sign in with Saad’s Apple ID (the one that owns **Saad Aghbar (Personal Team)** / `NR2ZFUP7R7`). Complete 2FA on the phone if asked.
4. Select that Apple ID in the left list.
5. Select **Saad Aghbar (Personal Team)** on the right.
6. Click **Manage Certificates…**
7. Click **+** (bottom left of that sheet) → **Apple Development**.
8. You should now see a certificate named like `Apple Development: …`. Click **Done**.
9. If **Download Manual Profiles** is visible on the account page, click it.
10. Close Settings.

Confirm in Terminal:

```bash
security find-identity -v -p codesigning
```

You must see at least one line containing **Apple Development**. Then:

```bash
pnpm --filter @maher/mobile exec expo run:ios --device 00008130-001924A02651001C
```

Do not pick a different Team. Do not use a Distribution certificate. Personal Team is enough for this phone.

If **+ → Apple Development** is greyed out: open [https://developer.apple.com/account](https://developer.apple.com/account) in Safari, sign in, and accept any pending **Apple Developer Agreement**. Then retry step 7.

If `find-identity` still prints **0 valid identities found** after Xcode created the cert, the Apple Development leaf is in the keychain but **not trusted**. That happens when Apple’s WWDR G3 intermediate is missing (`security verify-cert` reports `CSSMERR_TP_NOT_TRUSTED`). Install it with unspecified trust (do not mark it Always Trust):

```bash
curl -fsSL -o /tmp/AppleWWDRCAG3.cer https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer
security add-trusted-cert -d -r unspecified -k ~/Library/Keychains/login.keychain-db /tmp/AppleWWDRCAG3.cer
security find-identity -v -p codesigning
```

### 4. First native install

API must already be running (`pnpm dev:api`, port **4000**, binds `0.0.0.0`).

From the **repo root**:

```bash
pnpm mobile:ios:device
```

(`expo run:ios --device` inside `apps/mobile`.)

If several devices appear, pick the physical iPhone, not a simulator.

Xcode may open a signing sheet the first time:

1. Select the **Maher Al-Aghbar Furniture** target.
2. **Signing & Capabilities** → check **Automatically manage signing**.
3. **Team:** Saad Aghbar (Personal Team).
4. Bundle identifier stays `jo.maheraghbar.furniture`.

Personal Team cannot provision **Push Notifications**. Local `expo run:ios` strips `aps-environment` for that team only. EAS preview/production keep APNs. The in-app notification inbox still loads from the API.

On the iPhone the first launch may say **Untrusted Developer**:

**Settings → General → VPN & Device Management** → Apple Development / Saad Aghbar → **Trust**.

The home-screen icon is **Maher Al-Aghbar Furniture**. Do **not** open Expo Go.

## Daily workflow

Two processes, same Wi‑Fi as the phone:

```bash
pnpm dev:api              # Nest on http://<mac-lan-ip>:4000
pnpm mobile:dev-client    # Metro --dev-client on :8081
```

Then tap **Maher Al-Aghbar Furniture** on the iPhone. If the launcher asks for a server, choose the `exp://192.168.x.x:8081` entry (same Wi‑Fi). Login `admin` / `123`.

JS/TS/TSX saves Fast Refresh. No native rebuild.

USB is not required after the first install.

### Simulator (optional)

Do not use this for the physical iPhone. Simulator Expo Go 54:

```bash
pnpm mobile:start         # Expo Go Metro (do not pass --dev-client)
# press i in that terminal
```

## API URL on a physical phone

`localhost` on the iPhone is the phone, not the Mac.

Leave `apps/mobile/.env` as:

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
```

`getApiBaseUrl()` already rewrites loopback to the Metro LAN host (e.g. `exp://192.168.1.28:8081` → `http://192.168.1.28:4000`). Do not bake a temporary IP into `eas.json` production/preview.

If auto-detect fails, pin the Mac LAN IP in `apps/mobile/.env` only, then restart Metro:

```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.28:4000
```

API already listens on `0.0.0.0:4000`. Isolated guest Wi‑Fi / client isolation will block the phone.

## Phone cannot find Metro

1. Same Wi‑Fi, not guest/isolated.
2. `pnpm mobile:dev-client` is the running Metro (not Expo Go `mobile:start`).
3. Kill a stale Metro on 8081 and restart `pnpm mobile:dev-client`.
4. In the Maher app, shake / dev menu → change bundler to `http://<mac-lan-ip>:8081`.
5. Confirm the Mac IP: `ipconfig getifaddr en0`.

## When you must rebuild the native app

Run `pnpm mobile:ios:device` again only when native inputs change:

- new/removed native modules or Expo plugins
- `app.config.ts` permissions, bundle id, scheme, ATS
- `expo-dev-client` / Expo SDK (stay on 54)
- first install, or the app was deleted from the phone

Ordinary UI work does **not** need a rebuild.

## Commands

| Command | What |
|---------|------|
| `pnpm mobile:start` | Metro for **simulator Expo Go 54** |
| `pnpm mobile:dev-client` | Metro for the **Maher development app** on a physical iPhone |
| `pnpm mobile:ios` | Open iOS simulator against Expo Go Metro |
| `pnpm mobile:ios:device` | Local Xcode install of the Maher development app onto a connected iPhone |

EAS profile `development` stays simulator-oriented. Profile `development-device` is the cloud equivalent if you later need an EAS device build; local `expo run:ios --device` is the default.
