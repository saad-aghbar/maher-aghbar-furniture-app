# Mobile (`@maher/mobile`)

Expo SDK 54 / React Native app. Feature-complete. Prefer **not** moving files in here unless a Mobile bug requires it.

Surfaces: `(admin)`, `(customer)`, `(employee)` under `app/(app)/`.

## What belongs here

| Path | Role |
|------|------|
| `app/` | Expo Router routes |
| `src/features/` | Screen/feature implementation |
| `src/api/` | Bearer HTTP client + domain modules |
| `src/navigation/` | Tabs, Staff adaptive bar, gates |
| `src/theme/`, `src/motion/`, `src/components/` | RN UI (not `@maher/ui`) |
| `src/i18n/` | Wrappers over `@maher/i18n` |
| `assets/` | Icons, splash, brand, fonts |
| `app.config.ts`, `eas.json` | Expo / EAS |

## Run on the physical iPhone

The Maher development app is already installed. From the **repo root**, same Wi‑Fi as the phone:

```bash
pnpm dev:api                 # API :4000
pnpm mobile:dev-client       # Metro :8081 for the iPhone app
```

Tap **Maher Al-Aghbar Furniture** (not Expo Go). Login `admin` / `123`.

Rebuild native only when plugins / native deps / `app.config.ts` change, or the app was deleted:

```bash
pnpm mobile:ios:device
```

Signing, trust, and LAN URL details: [docs/mobile-iphone-dev-build.md](../../docs/mobile-iphone-dev-build.md).

## Commands

```bash
pnpm mobile:dev-client     # Metro for the physical iPhone Maher app (daily)
pnpm mobile:ios:device     # Xcode reinstall onto a connected iPhone
pnpm mobile:start          # Metro for simulator Expo Go 54 only (optional)
pnpm mobile:typecheck
pnpm mobile:test
pnpm mobile:doctor
```

## Dependencies

`@maher/i18n`, `@maher/permissions`, `@maher/types`. **Not** `@maher/ui`. Must not import Admin Web or `apps/api/src`.
