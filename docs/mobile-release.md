# Mobile release guide

**Date:** 2026-08-05  
**App:** `@maher/mobile` (Expo SDK 54)  
**Bundle IDs:** `jo.maheraghbar.furniture` (iOS + Android)  
**Version:** `0.1.0` (`eas.json` → `appVersionSource: remote`)

Companions: [mobile-visual-qa.md](./mobile-visual-qa.md), [store-submission.md](./store-submission.md), [mobile-architecture.md](./mobile-architecture.md).

---

## Prerequisites

| Item | Required for |
|------|----------------|
| Node ≥ 20, pnpm 9 | Local QA |
| Running API (`:4000`) + seeded DB | Smokes / Playwright API |
| Expo account + EAS CLI | Cloud builds |
| `EXPO_PUBLIC_API_BASE_URL` **https://** | preview / production EAS |
| Android keystore (EAS-managed OK) | Android APK/AAB |
| Apple Developer (later) | iOS |

---

## Config files

| File | Role |
|------|------|
| [`apps/mobile/app.config.ts`](../apps/mobile/app.config.ts) | Dynamic Expo config (scheme `maher`, permissions, plugins) |
| [`apps/mobile/eas.json`](../apps/mobile/eas.json) | Profiles: `development`, `preview`, `production` |
| [`apps/mobile/.env.example`](../apps/mobile/.env.example) | Local + EAS env documentation |

### Profiles

| Profile | Distribution | Android artifact | API URL (default in eas.json) |
|---------|--------------|------------------|-------------------------------|
| `development` | internal + dev client | APK | `http://10.0.2.2:4000` (Android emulator / iOS **simulator** EAS) |
| `development-device` | internal + dev client | APK | localhost (runtime rewrites to Metro LAN host on a physical phone) |
| `preview` | internal | APK | `https://api.staging.maheraghbar.jo` |
| `production` | store | App Bundle | `https://api.maheraghbar.jo` |

Preview/production **fail the build** if `EXPO_PUBLIC_API_BASE_URL` is missing or not `https://` (`EAS_BUILD=true` + profile check in `app.config.ts` / `getApiBaseUrl()`).

Override staging/prod hosts via EAS Secrets before shipping.

### Config validation checklist

| Check | Status (2026-08-05) |
|-------|---------------------|
| App icon `assets/icon.png` (brand logomark, not Expo placeholder) | Pass |
| Splash `assets/splash-icon.png` (brand lockup on `#E1DFD3`) | Pass |
| Adaptive icon foreground / background / monochrome | Pass |
| Bundle ID / package `jo.maheraghbar.furniture` | Pass |
| Camera / photo / location / Face ID strings | Pass (`app.config.ts`) |
| Document picker plugin | Pass |
| Notifications plugin + `POST_NOTIFICATIONS` | Pass |
| Deep link scheme `maher://` | Pass |
| HTTPS App Links / associated domains | **Blocked** — set `EXPO_ASSOCIATED_DOMAIN` when DNS + AASA/assetlinks exist |
| Production HTTPS API | **Blocked** — placeholder hosts in `eas.json`; replace with real TLS endpoints |

---

## Commands

```bash
# Mobile
pnpm mobile:typecheck
pnpm mobile:lint
pnpm mobile:test
pnpm mobile:doctor

# Monorepo
pnpm typecheck
pnpm lint
pnpm test

# Live API (seeded)
pnpm smoke:scope
pnpm smoke:workflow

# Playwright (install once: pnpm add -Dw @playwright/test && pnpm exec playwright install chromium)
pnpm exec playwright test

# Android preview (requires Expo login + project)
pnpm mobile:eas:preview:android
# or: cd apps/mobile && eas build --profile preview --platform android
```

---

## Automated QA results (2026-08-05)

| Step | Command | Exit | Notes |
|------|---------|------|-------|
| Mobile typecheck | `pnpm mobile:typecheck` | **0** | Clean |
| Mobile lint | `pnpm mobile:lint` | **0** | 16 warnings (array-type style); 0 errors after hooks rename fix |
| Mobile unit | `pnpm mobile:test` | **0** | **44** suites, **129** tests |
| Expo Doctor | `pnpm mobile:doctor` | **0** | 18/18 (bottom-tabs excluded via `expo.install.exclude`) |
| API unit | `pnpm --filter @maher/api test` | **0** | **19** suites, **98** tests |
| Permissions unit | `pnpm --filter @maher/permissions test` | **0** | **3** suites, **7** tests |
| Smoke scope | `pnpm smoke:scope` | **0** | **20/20** dealer ownership + worker isolation |
| Smoke workflow | `pnpm smoke:workflow` | **0** | **31/31** RFQ→SO→PO→delivery→invoice→payment→PR/GRN |
| Playwright E2E | `pnpm exec playwright test` | **0** | API auth+reports+notification templates **passed**; admin login UI **skipped** (admin-web returned HTTP 500 locally) |
| Monorepo typecheck | `pnpm typecheck` | **2** | `@maher/employee-portal` TS2742 React types portability — **pre-existing**, not mobile |
| Monorepo lint | `pnpm lint` | **1** | `@maher/api` max-warnings 0 with unused-var warnings — **pre-existing** |
| Native mobile E2E | Maestro / Detox | **N/A** | Not implemented |

### Scenario → proof map

| Scenario | Result |
|----------|--------|
| Login / session restore / refresh | Pass (mobile Jest + API `auth.mobile`) |
| Role navigation / permissions | Pass (surfaceGuard, tabConfig, permissions pkg) |
| Dealer ownership / worker isolation | Pass (`smoke:scope`) |
| Dealer order creation / 3-day edit / fabric lock | Pass (API request specs + mobile validation) |
| AI upload/review / admin approval helpers | Pass (AI intake specs + `selectAiReview`) |
| Worker completion | Pass (`tasks.lifecycle.spec`) |
| Inventory / invoices / statement | Pass (selectors + inventory cost + workflow invoice/payment) |
| Returns | Partial — workflow pendingReturns KPI; **no dedicated returns Jest** |
| RTL / offline / reduced motion | Pass (mobile Jest) |
| Visual matrix (devices × locales × themes) | Manual — see [mobile-visual-qa.md](./mobile-visual-qa.md) |

---

## Android preview build (EAS attempt 2026-08-05)

| Item | Result |
|------|--------|
| `eas whoami` | **saad-aghbar** (Owner; also `saad-aghbars-team`) |
| `eas init --non-interactive --force` | Created project `@saad-aghbar/maher-aghbar-furniture` — projectId `bd5ccf7c-9b99-4bc5-a0bc-2a52d781c023` (wired as default in `app.config.ts`; dynamic config cannot be auto-written) |
| First `--non-interactive` build | **Failed:** `Generating a new Keystore is not supported in --non-interactive mode` |
| Interactive build (keystore auto-yes) | **Queued** — keystore created on Expo server; archive uploaded (56.2 MB) |
| Build URL | https://expo.dev/accounts/saad-aghbar/projects/maher-aghbar-furniture/builds/9bb846dc-e526-4833-8cf1-c0b7652fc506 |
| Status at record time | `IN_QUEUE` — *Build concurrency limit reached for your account* (free/plan concurrency) |
| Profile / platform | `preview` / Android APK, `appVersion` 0.1.0, `versionCode` 1 |
| Env baked | `EXPO_PUBLIC_API_BASE_URL=https://api.staging.maheraghbar.jo` (placeholder host — app will need a real TLS API once installed) |

```bash
cd apps/mobile
eas whoami
# project already linked — DEFAULT_EAS_PROJECT_ID in app.config.ts
# Override staging URL when real host exists:
# eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://YOUR_STAGING_API --environment preview
eas build --profile preview --platform android
```

---

## External blockers

1. ~~**Expo / EAS account**~~ — logged in as `saad-aghbar`  
2. ~~**`EAS_PROJECT_ID` / `eas init`**~~ — `bd5ccf7c-9b99-4bc5-a0bc-2a52d781c023` in `app.config.ts`  
3. ~~**Android keystore**~~ — EAS-managed keystore created on first interactive build  
4. **EAS build concurrency / billing** — preview build `9bb846dc-…` stuck `IN_QUEUE` until a concurrency slot frees or plan is upgraded  
5. **Real HTTPS API hostnames** — `api.staging.maheraghbar.jo` / `api.maheraghbar.jo` are placeholders until DNS + TLS exist  
6. **Apple Developer Program** — iOS IPA / TestFlight  
7. **Google Play Console** — production AAB upload  
8. **APNs + FCM** — client registers tokens; **server push send not implemented**  
9. **Associated domains / Digital Asset Links** — HTTPS deep links  
10. **Admin-web local 500** — blocked Playwright UI login check in this run  
11. **Store listing assets** — privacy policy URL, support URL, device screenshots  
12. **Monorepo typecheck/lint failures** outside mobile (employee-portal / api warnings)

---

## Notes

- Push: register via `POST /notifications/device-token` after login; do **not** market reliable push until a sender exists.
- Offline cache whitelist: catalog + tasks + sales-orders lists + statement detail (`shouldDehydrateQuery`).
- Native Maestro/Detox remains a follow-up; do not block store prep on it if API smokes + mobile Jest are green.
