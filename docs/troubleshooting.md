# Troubleshooting

## Docker not installed

Local infra expects Docker for Postgres, Redis, and MinIO:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

If Docker is unavailable, point `DATABASE_URL` and `REDIS_URL` at managed services and create the MinIO/S3 bucket manually.

## Prisma client / monorepo path errors

Run from repo root:

```bash
pnpm --filter @maher/database generate
pnpm --filter @maher/types build
pnpm --filter @maher/permissions build
pnpm --filter @maher/i18n build
pnpm --filter @maher/ui build
```

## Cookie auth across ports

Browsers treat `localhost:3000` and `localhost:4000` as same-site for lax cookies when API sets cookies without Domain restriction. Ensure `credentials: 'include'` on fetches and CORS origins match `.env`.

## Account locked

Five failed logins lock the account for 15 minutes. Unlock by waiting or clearing `lockedUntil` in the database.

## Physical iPhone: Expo Go incompatible / cannot find Metro

App Store Expo Go is SDK 57; this app is SDK 54. Use the Maher development build, not Expo Go. See [mobile-iphone-dev-build.md](mobile-iphone-dev-build.md).

## AI intake never creates confirmed orders

By design. Approve only creates a **draft RFQ** after human review.
