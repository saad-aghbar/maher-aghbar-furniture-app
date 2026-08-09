# Store submission checklist (iOS + Android)

**App name:** Maher Al-Aghbar Furniture  
**Slug:** `maher-aghbar-furniture`  
**Bundle / package:** `jo.maheraghbar.furniture`  
**Expo config:** [`apps/mobile/app.config.ts`](../apps/mobile/app.config.ts)  
**EAS profiles:** [`apps/mobile/eas.json`](../apps/mobile/eas.json)

Companions: [mobile-release.md](./mobile-release.md), [mobile-visual-qa.md](./mobile-visual-qa.md).

---

## Accounts (external)

| Account | Purpose | Status |
|---------|---------|--------|
| Expo / EAS | Cloud builds, credentials | Linked — `@saad-aghbar/maher-aghbar-furniture` (`bd5ccf7c-…`); Android keystore on Expo; preview build queued (concurrency limit) |
| Apple Developer Program | iOS TestFlight / App Store | Required for iOS |
| Google Play Console | Internal testing / production | Required for Play |
| APNs key + Apple Team ID | iOS push delivery | Optional until push sender ships |
| Firebase / FCM (`google-services.json`) | Android push delivery | Optional until push sender ships |

---

## Build artifacts

| Store | EAS profile | Artifact | Command |
|-------|-------------|----------|---------|
| Internal QA | `preview` | Android APK | `eas build --profile preview --platform android` |
| Play production | `production` | Android App Bundle | `eas build --profile production --platform android` |
| TestFlight | `production` (iOS) | IPA | `eas build --profile production --platform ios` |

Submit:

```bash
cd apps/mobile
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

---

## Listing copy placeholders

| Field | Draft |
|-------|-------|
| Name | Maher Al-Aghbar Furniture |
| Subtitle / short | Factory ERP for dealers and floor teams |
| Description | Order tracking, production tasks, inventory, invoices, and returns for Maher Al-Aghbar & Sons Furniture. |
| Support URL | **TBD** (company support page) |
| Privacy Policy URL | **TBD** (required by both stores) |
| Marketing URL | **TBD** |
| Category | Business / Productivity |

---

## Privacy / data collection

Declare accurately in App Privacy / Data safety forms:

| Data | Collected? | Linked to identity? | Purpose |
|------|------------|---------------------|---------|
| Account credentials | Yes | Yes | Auth |
| Name / contact | Yes | Yes | Profile, orders |
| Photos / camera | Yes (user-initiated) | Yes | Order / return / task attachments |
| Approximate location | Yes (user-initiated) | Yes | Delivery pin on new order |
| Push token | Yes | Yes | Notifications registration |
| Device identifiers | Via Expo / OS | Possibly | Crash / push |

**Do not claim** “push notifications deliver reliably” until server-side Expo/APNs/FCM send exists. Client only registers tokens today.

---

## Permissions copy (must match binaries)

Already set in `app.config.ts`:

- Camera — order photos and returns  
- Photo library — order attachments and returns  
- Location when in use — delivery pins  
- Face ID — app unlock  
- Notifications — in-app / future push  
- Documents — AI intake / file uploads  

---

## Versioning

- Marketing version: `0.1.0`  
- EAS `appVersionSource: remote` + production `autoIncrement` for native build numbers  
- Bump `version` in `app.config.ts` for user-facing releases  

---

## Screenshots / preview video

Required before submission (capture via [mobile-visual-qa.md](./mobile-visual-qa.md)):

| Platform | Sizes (typical) |
|----------|-----------------|
| iPhone | 6.7" and 6.1" (or current ASC required set) |
| Android | Phone + optional 7" tablet |
| Locales | Prefer **Arabic** primary + English secondary |

Screens: login, role home, orders, catalog/tasks, invoices/statement.

---

## Deep links

| Type | Status |
|------|--------|
| Custom scheme `maher://` | Ready |
| Universal Links / App Links | Blocked on `EXPO_ASSOCIATED_DOMAIN` + hosting `apple-app-site-association` / `assetlinks.json` |

---

## Pre-submit gate

- [ ] `pnpm mobile:typecheck` / `mobile:test` / `mobile:doctor` green  
- [ ] `pnpm smoke:scope` + `smoke:workflow` against staging API  
- [ ] Preview APK installed on at least one Android device  
- [ ] Visual QA matrix partially filled for `ar` + `en`  
- [ ] HTTPS staging/production API verified with TLS  
- [ ] Privacy policy + support URLs live  
- [ ] Store screenshots uploaded  
- [ ] Push claims reviewed (omit or soften until sender ships)  

---

## Known product caveats for reviewers

1. Demo/seed logins are for internal builds only — never ship seed passwords in production listings.  
2. Offline mode caches recent lists; mutations (except task photo/notes outbox) require network.  
3. JoFotara / payment rails may be mock on staging — label internal builds clearly.
