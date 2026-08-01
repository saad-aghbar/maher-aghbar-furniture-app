# Mobile local development

## Prerequisites

- API running (`pnpm start:all` or `pnpm start:api` after prepare)
- Node 20+, pnpm 9+
- **Expo Go compatible with SDK 54** (or a development build)

## Install

```bash
pnpm install
pnpm --filter @maher/types build
pnpm --filter @maher/permissions build
pnpm --filter @maher/i18n build
pnpm --filter @maher/validation build
```

## Environment

Leave `EXPO_PUBLIC_API_BASE_URL` unset for local development. The app reuses the
Expo dev-server host so physical phones, the iOS simulator, and the Android
emulator all resolve the API correctly. Set it only to pin a deployed backend:

```bash
# apps/mobile/.env (optional)
# EXPO_PUBLIC_API_BASE_URL=https://api.maher-aghbar.jo
EXPO_PUBLIC_ENVIRONMENT=local
```

Ensure the API binds on `0.0.0.0` / is reachable on LAN. CORS does not apply to native clients.

## Start

```bash
pnpm start:all          # or at least the API
pnpm mobile:start       # Expo Metro
# then press i / a, or scan QR with Expo Go
```

## Demo accounts

Password: `Admin@12345!`

- `admin@maher-aghbar.jo`
- `sales@maher-aghbar.jo`
- `worker@maher-aghbar.jo`
- `customer@cedar-hotel.jo`

**Never use these passwords in production.**

## Troubleshooting

- Login network error → wrong `EXPO_PUBLIC_API_BASE_URL` or API down  
- 401 after login → rebuild API so `client: 'mobile'` returns tokens  
- RTL looks wrong until reload after locale switch (RN `I18nManager` limitation)
