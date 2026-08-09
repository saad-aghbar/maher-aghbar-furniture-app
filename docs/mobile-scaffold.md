# Mobile scaffold

**Date:** 2026-08-05  
**Package:** `@maher/mobile` at [`apps/mobile`](../apps/mobile)  
**SDK:** Expo `~54` · Expo Router `~6` · React Native `0.81.5` · React `19.1.0`

Scaffold only: Expo Router boot screen + providers + feature folder tree. **No business screens.**

See also: [mobile-architecture.md](./mobile-architecture.md), [mobile-implementation-plan.md](./mobile-implementation-plan.md)

---

## What was added

### App

| Path | Role |
|------|------|
| `apps/mobile/app/_layout.tsx` | Gesture Handler, `AppProviders`, Stack |
| `apps/mobile/app/index.tsx` | Boot screen (API URL, i18n, permissions, haptics) |
| `apps/mobile/src/api/` | Fetch client, refresh, domain modules, query keys — see [mobile-api-client.md](./mobile-api-client.md) |
| `apps/mobile/src/api/config.ts` | `EXPO_PUBLIC_API_BASE_URL` → base + `/api/v1` |
| `apps/mobile/src/providers/*` | Safe Area + TanStack Query |
| `apps/mobile/src/theme/tokens.ts` | Army Camo RN tokens |
| `apps/mobile/src/features/*` | Empty feature dirs (`.gitkeep`) |
| `apps/mobile/src/{auth,components,hooks,i18n,permissions,storage,types,utils,validation}` | Placeholders |
| `apps/mobile/assets/*` | Icons/splash restored from prior mobile commit |

### Dependencies (selected)

Expo Router, Gesture Handler, Reanimated (+ worklets `0.5.1`), TanStack Query, React Hook Form, Zod, SecureStore, Localization, Haptics, workspace `@maher/types` / `@maher/permissions` / `@maher/i18n`.

### Monorepo

| Change | Detail |
|--------|--------|
| `pnpm-workspace.yaml` | Unchanged (`apps/*` already covers mobile) |
| Root `package.json` | `dev:mobile`, `mobile:start\|android\|ios\|typecheck\|lint\|test\|doctor` |
| Root `pnpm.overrides` | Pin `@maher/mobile` `@types/react` / `@types/react-dom` to 19.x |
| `.github/workflows/ci.yml` | `pnpm --filter @maher/mobile typecheck` + `test` after shared builds |
| `.gitignore` | `.expo` |

### Environment

[`apps/mobile/.env.example`](../apps/mobile/.env.example):

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
```

- **Public only** — never put secrets in `EXPO_PUBLIC_*`.
- If unset, `getApiBaseUrl()` derives host from Expo `hostUri` (LAN / Android emulator `10.0.2.2` fallback).

---

## Root scripts

```bash
pnpm mobile:start      # expo start -c
pnpm mobile:android
pnpm mobile:ios
pnpm mobile:typecheck
pnpm mobile:lint
pnpm mobile:test
pnpm mobile:doctor     # pnpm --filter @maher/mobile run doctor  (avoids pnpm's own doctor CLI)
pnpm dev:mobile        # alias of mobile:start
```

---

## Verification results (2026-08-05)

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm install` | **0** | 19 workspace projects; lockfile updated |
| `pnpm mobile:doctor` | **0** | 18/18 Expo Doctor checks passed |
| `pnpm mobile:typecheck` | **0** | `tsc --noEmit` strict |
| `pnpm mobile:lint` | **0** | `expo lint` (legacy ESLint config warning only) |
| `pnpm mobile:test` | **0** | 1 Jest suite (`api/config`) passed |

### Notes from verification

- `pnpm --filter @maher/mobile doctor` without `run` hits **pnpm’s** `doctor` command — root script uses `run doctor`.
- Dual `@types/react` (Next 18 vs RN 19) required `createElement` for `QueryClientProvider` children typing in `QueryProvider.tsx`.
- `react-native-worklets` pinned to `0.5.1` for Expo SDK 54 doctor compliance.

---

## Boot screen proves

1. Expo Router index route  
2. Providers (Safe Area, Query)  
3. Workspace Metro resolution (`@maher/i18n`, `@maher/permissions`, `@maher/types`)  
4. `expo-localization` + `expo-haptics`  

Next implementation steps: surface tab navigators in [mobile-implementation-plan.md](./mobile-implementation-plan.md). Auth UX: [mobile-authentication.md](./mobile-authentication.md). API client: [mobile-api-client.md](./mobile-api-client.md).
