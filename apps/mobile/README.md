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

## Commands

```bash
pnpm mobile:start          # Metro :8081 (clears cache)
pnpm mobile:typecheck
pnpm mobile:test
pnpm mobile:doctor
```

API must be on `:4000`. See root README for Expo Go / ABI recovery.

## Dependencies

`@maher/i18n`, `@maher/permissions`, `@maher/types`. **Not** `@maher/ui`. Must not import Admin Web or `apps/api/src`.
