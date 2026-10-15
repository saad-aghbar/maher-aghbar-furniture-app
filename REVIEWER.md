# Source code review guide

This repository contains the web application, mobile application, API, background worker, shared packages, database schema, seeds, tests, and infrastructure configuration for Maher Al-Aghbar & Sons Furniture ERP.

## Get the source

```bash
git clone https://github.com/saad-aghbar/maher-aghbar-furniture-app.git
cd maher-aghbar-furniture-app
```

Use the `main` branch. GitHub's **Code → Download ZIP** also includes the source files. Private repository access, if required, must be granted by the owner.

## Where to begin

- `apps/web/` — unified Next.js application; admin, staff, dealer, and worker routes are under `src/app/[locale]/`.
- `apps/mobile/` — Expo SDK 54 / React Native application; Expo Router routes are in `app/`, screens and feature logic in `src/features/`, and the HTTP client in `src/api/`.
- `apps/api/` — NestJS REST API; feature controllers, services, DTOs, and tests are in `src/modules/`.
- `apps/worker/` — background queue processing for documents, integrations, and notifications.
- `packages/database/prisma/` — PostgreSQL schema, seed data, demo fixtures, and maintenance scripts.
- `packages/permissions/`, `packages/types/`, `packages/workflow-domain/` — shared authorization rules, contracts, and workflow logic.
- `packages/i18n/`, `packages/ui/` — Arabic, English, and Hebrew translations and shared web UI.
- `scripts/`, `e2e/`, `.maestro/` — smoke/UAT scripts, Playwright tests, and mobile test flows.
- `infra/docker/`, `.github/workflows/` — local infrastructure, Docker builds, and CI.
- `docs/` — architecture, feature documentation, and historical implementation reports.

Start with [the repository map](docs/architecture/repository-map.md), [API documentation](docs/api.md), [permission model](docs/permissions.md), and [database model](docs/database/database-model.md). Older reports may refer to separate admin/customer/employee websites; the current web application is `apps/web/` on port 3000.

## Run from a clean clone

Requirements: Node.js 20 or later, pnpm **9.15.9** (the version in `package.json`), and Docker with Compose for local PostgreSQL and Redis. Alternatively, provide your own local PostgreSQL and Redis instances using the values in `.env`.

Run these commands from the repository root:

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
pnpm install --frozen-lockfile
docker compose -f infra/docker/docker-compose.yml up -d postgres redis
pnpm db:generate
pnpm exec turbo run build --filter='./packages/*'
pnpm db:push
pnpm db:seed
```

Wait for PostgreSQL to accept connections before `pnpm db:push`. Use a dedicated, disposable local database: `pnpm db:seed` clears operational data and restores the local launch accounts. These commands should never target a production database.

In separate terminals:

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

- Web login: <http://localhost:3000/ar/login> (also `/en/login` and `/he/login`).
- API Swagger: <http://localhost:4000/api/docs>.
- API health: <http://localhost:4000/api/v1/health>.

Local launch accounts use username/password login: `admin` / `123` for administration, `nile` / `123` for a dealer, `warehouse` / `123` for warehouse staff, and `floor` / `123` for a worker. These are development fixtures. The launch seed starts with empty operational data; populate records through the UI for a review, or consult [the demo data documentation](docs/demo-data-system-audit.md) before using the optional `pnpm demo:reset` workflow. The old `pnpm db:seed:demo` command is deprecated and exits with an error.

The background worker is optional for initial source/UI review. To process local queued jobs, start another terminal with:

```bash
REDIS_URL=redis://localhost:6379 pnpm --filter @maher/worker dev
```

For production builds, run `pnpm build` with `NODE_ENV` unset or set to `production`; the example `.env` uses development defaults.

## Mobile review

The mobile source includes the local native watch bridge under `apps/mobile/modules/` and watch targets under `apps/mobile/targets/`. Generated `ios/` and `android/` projects are excluded; Expo generates them for a native build.

After the API is running, build a development client with Xcode/iOS Simulator or an Android SDK/emulator:

```bash
pnpm mobile:ios
# or
pnpm mobile:android
```

For iOS device builds, set `APPLE_TEAM_ID` to your own signing team. Use your own `EAS_PROJECT_ID` if building through your Expo account. The defaults in `app.config.ts` identify the owner's development project. An installed development client can subsequently connect using `pnpm mobile:dev-client`.

On a physical phone, the phone and development computer must share a reachable network. `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env` controls the API origin; its localhost default is mapped to the Metro host by the mobile client. Use `http://10.0.2.2:4000` for the standard Android emulator if needed. Match any Expo Go runtime to this project's SDK 54; a native development build is needed for custom native features.

See [mobile architecture](docs/mobile-architecture.md) and [mobile build notes](docs/mobile-iphone-dev-build.md).

## Verification

After dependency installation, Prisma generation, and shared package builds:

```bash
pnpm check:boundaries
pnpm typecheck
pnpm test
pnpm build
```

Unit tests are colocated with source. End-to-end and `smoke:*` commands have separate infrastructure/fixture requirements and can create or modify records; run them against a disposable local review environment. See [testing documentation](docs/testing.md) and [mobile E2E notes](e2e/mobile/README.md).

### Verification status (15 October 2026)

Dependency installation with the frozen lockfile, module-boundary checks, the full TypeScript check, and production builds passed locally. The web test suite passed all 37 files / 159 tests.

The full unit-test command currently fails. The API run reported 303 passing suites and one failing suite: `apps/api/src/modules/scheduling/__tests__/scheduling-dealer-delivery.test.ts`, where the actual-delivery-date assertion receives `1970-01-01` instead of `2026-08-12`. Several mobile suites also fail during native-module initialization with `__fbBatchedBridgeConfig is not set`. The root test run stops on the API failure, so it does not establish a complete mobile or PDF-test result. These failures remain available for review; a passing typecheck/build does not imply that all tests pass. Physical-device and end-to-end review were not performed during repository preparation.

## Configuration and external services

The tracked `.env.example` files contain local defaults and empty optional provider keys. Real `.env` files, signing credentials, dependencies, database backups, uploads, caches, logs, and generated builds are excluded from Git. Install dependencies and generate builds locally.

Email/SMS/WhatsApp providers default to console output; AI/OCR default to mock providers, and files use local disk storage. Paid service credentials are not required for the basic local review. Live integrations need the reviewer's own provider configuration. See [known limitations](docs/known-limitations.md), [security notes](docs/security.md), and [the documentation index](docs/README.md).
