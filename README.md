# Maher Al-Aghbar & Sons Furniture ERP

Production ERP for **مفروشات ماهر الأغبر وأولاده** — furniture manufacturing from inquiry through production, delivery, and payment.

## Account types

Authorization is **Role → permissions**. Users inherit grants from the assigned role. Staff Types are reusable roles with `kind = STAFF` (define the job once, then assign it on Add User).

| Type | Role kind / code | App |
|------|------------------|-----|
| **Admin** | `ADMIN` / `SYSTEM_ADMINISTRATOR` | Admin web + Admin Mobile |
| **Staff** | `STAFF` (e.g. Warehouse Management) | Admin web + Admin Mobile, limited by the type’s permissions |
| **Worker** | `PRODUCTION_WORKER` | Employee portal + Worker Mobile |
| **Customer** | `CUSTOMER` | Customer portal + Dealer Mobile — one login per dealer |

Staff types are managed under **Users → Staff Types**. Add User only **selects** a type; it does not pick permissions. Editing a type updates every assignee.

The first system preset is **Warehouse Management** (`WAREHOUSE_MANAGEMENT`): inventory, warehouses, receive / issue / transfer / count.

## Applications

| App | URL / entry | Audience |
|-----|-------------|----------|
| Admin Web | http://localhost:3000 | Admin / staff |
| Customer Portal | http://localhost:3001 | Customers (dealers) |
| Employee Portal | http://localhost:3002 | Workers |
| Mobile (Expo SDK 54) | `pnpm mobile:start` → Metro `:8081` | Admin, staff, workers, dealers |
| API + Swagger | http://localhost:4000/api/docs | Integrations |
| Worker | background | PDF, AI/OCR, notifications |

The phone talks **directly to the Nest API** (`:4000`), not to Next.js.

## Stack

- Next.js + TypeScript frontends
- NestJS REST API
- Expo 54 / React Native 0.81 mobile (New Architecture on)
- PostgreSQL + Prisma
- Redis / BullMQ (worker)
- Local disk uploads (MinIO optional)
- Arabic / English / Hebrew (RTL)

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable && corepack prepare pnpm@9.15.9 --activate`)
- PostgreSQL 16+ (Homebrew `postgresql@18` or Docker)
- Redis (Homebrew or Docker)
- Mobile: [Expo Go](https://expo.dev/go) **SDK 54** on a phone or simulator (or an EAS dev client)

## First-time setup

```bash
cp .env.example .env          # first time only
cp apps/mobile/.env.example apps/mobile/.env   # optional; localhost is the default
pnpm install
pnpm prepare:launch           # Postgres/Redis, schema, seed, production builds
```

Optional Docker infra only (if you are not using Homebrew Postgres/Redis):

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres redis
```

---

## Start the websites

Two modes. Do not mix them on the same ports.

### Daily coding (watch / hot reload)

Free the production ports first if `pnpm launch` is already running:

```bash
pnpm stop:all
```

Then in separate terminals (or use the combined command):

```bash
pnpm --filter @maher/api dev              # API  → :4000
pnpm --filter @maher/admin-web dev        # Admin → :3000
pnpm --filter @maher/customer-portal dev  # Dealers → :3001
pnpm --filter @maher/employee-portal dev  # Workers → :3002
```

Same thing from the repo root:

```bash
pnpm dev:api
pnpm dev:admin
pnpm dev:customer
pnpm dev:employee
```

All four together:

```bash
pnpm dev:apps
```

Open:

- Admin: http://localhost:3000/ar/login
- Customer: http://localhost:3001/ar/login
- Employee: http://localhost:3002/ar/login
- API docs: http://localhost:4000/api/docs
- API health: http://localhost:4000/api/v1/health

### Production-like local stack (built apps)

Use this when you want the three portals + API + worker as they run after a build (no Next.js hot reload).

```bash
pnpm launch        # prepare if builds are missing, then start everything
# or
pnpm start:all     # same start; auto-runs prepare if `.next` / `dist` are missing
```

Stop:

```bash
pnpm stop:all
```

Logs: `logs/*.log` · PIDs: `.run/*.pid`

After a big `git pull`, re-run `pnpm install` then `pnpm prepare:launch` before `pnpm launch`.

---

## Start the mobile app

The API **must** be running on `:4000` (watch `pnpm --filter @maher/api dev` or the launch stack).

```bash
pnpm mobile:start          # Expo Metro on :8081 (clears cache: expo start -c)
```

Then:

1. Install **Expo Go SDK 54** on the phone or simulator (store listing: “Expo Go”).
2. Scan the QR from the Metro terminal, or press `i` (iOS simulator) / `a` (Android emulator) in that terminal.
3. Sign in with a launch username (`admin`, `nile`, …) and password `123`.

Shortcuts:

```bash
pnpm mobile:ios            # open iOS simulator
pnpm mobile:android        # open Android emulator
pnpm dev:mobile            # alias of mobile:start
```

### Simulator vs physical phone

- **iOS Simulator:** `EXPO_PUBLIC_API_BASE_URL=http://localhost:4000` in `apps/mobile/.env` is enough.
- **Physical device (Expo Go):** phone and Mac on the **same Wi‑Fi**. Leave the env as localhost — the app rewrites it to the Expo LAN host (the IP Metro prints, e.g. `exp://192.168.1.16:8081` → API `http://192.168.1.16:4000`). Dev login shows that URL under the form.
- If auto-detect fails, pin the Mac LAN IP in `apps/mobile/.env`:
  `EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:4000`
  then restart Metro (`pnpm mobile:start`).
- Isolated guest Wi‑Fi / client isolation: phone cannot see the Mac. Use the same LAN, or `npx expo start --tunnel` from `apps/mobile` (slower).
- A **network error** on login almost always means the API is not running, or the phone cannot reach port 4000 (wrong Wi‑Fi, stale IP, or macOS firewall).

Reload JS without restarting Metro: press `r` in the Metro terminal.

---

## When Expo / ABI breaks

This project is **Expo SDK 54** + **React Native 0.81** + **New Architecture**. Expo Go on the device must be the **SDK 54** build. A mismatch shows up as a red screen, a blank app, “incompatible”, or an **ABI** error (Hermes / native binary does not match the JS bundle).

### 1. Expo Go version (most common)

Update or reinstall Expo Go from the App Store / Play Store so it is SDK 54.

Then:

```bash
pnpm mobile:start          # already starts with -c (clears Metro cache)
```

In the Expo Go app, close the project completely and scan the QR again. Do not keep an old SDK 53 session open.

### 2. Native package versions drifted (`expo install --fix`)

After `pnpm add` / a lockfile change / “could not find native module”:

```bash
cd apps/mobile
npx expo install --fix
cd ../..
pnpm install
pnpm mobile:doctor         # expo-doctor — expect 18/18
pnpm mobile:start
```

`expo install --check` lists mismatches without writing.

### 3. Metro / Watchman cache

```bash
# stop Metro (Ctrl+C), then:
lsof -tiTCP:8081 -sTCP:LISTEN | xargs kill -9   # if :8081 is stuck

watchman watch-del-all     # if file watching is stale (macOS)
rm -rf apps/mobile/.expo apps/mobile/node_modules/.cache

pnpm mobile:start          # expo start -c
```

### 4. Android ABI / emulator architecture

`INSTALL_FAILED_NO_MATCHING_ABIS` or “does not support the device's CPU ABI” means the APK/emulator CPU do not match (common on Apple Silicon vs an x86_64 image).

- Use an **arm64** Android Virtual Device on Apple Silicon (Pixel arm64-v8a), not an old x86 image.
- Prefer Expo Go from the Play Store / emulator Play Store over a random APK.
- EAS binary: `pnpm mobile:eas:preview:android` builds a matching APK for your account.

### 5. Nuclear reset (still red after the steps above)

```bash
pnpm stop:all
lsof -tiTCP:8081 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true

rm -rf node_modules apps/mobile/node_modules apps/mobile/.expo
pnpm install
cd apps/mobile && npx expo install --fix && cd ../..
pnpm mobile:doctor
pnpm --filter @maher/api dev    # terminal 1
pnpm mobile:start               # terminal 2
```

If Expo Go still refuses the project, the native modules are beyond Go — use an EAS **development** build (`apps/mobile/eas.json` profile `development`) instead of Expo Go.

---

## When the websites / API break

| Symptom | Fix |
|---------|-----|
| Port in use (`EADDRINUSE` on 3000/3001/3002/4000) | `pnpm stop:all` — also kills listeners on those ports |
| `pnpm launch` but pages 500 / missing BUILD_ID | `pnpm prepare:launch` then `pnpm launch` |
| Postgres not reachable | `brew services start postgresql@18` (or `postgresql`), then `pnpm prepare:launch` |
| Redis not reachable | `brew services start redis` or `redis-server --daemonize yes` |
| Prisma client / “generated client” errors | `pnpm db:generate` then restart API |
| Schema out of date after a pull | `pnpm db:push` (local) or `pnpm db:migrate` |
| Empty / wrong login data | `pnpm db:seed` (empty launch accounts) or `pnpm db:seed:demo` (full QA catalog) |
| Account locked (5 failed logins) | Wait 15 minutes, or clear `lockedUntil` in the DB |
| Cookie / CORS login on web | `.env` `CORS_ORIGINS` must include the portal origins; `credentials: 'include'` is already wired |
| Prisma / workspace path errors | From repo root: `pnpm --filter @maher/database generate` then `pnpm --filter @maher/types build` and `pnpm --filter @maher/permissions build` |

Health check:

```bash
curl -sS http://localhost:4000/api/v1/health
```

---

## Launch accounts

**Local / launch seed only — change these passwords before production.**

Every account below uses password **`123`**. Sign in with **username** (not email).

`pnpm db:seed` creates **empty** accounts: no products, inventory, orders, or invoices.

| Username | Password | Type | App |
|----------|----------|------|-----|
| `admin` | `123` | Admin | Admin web / Admin Mobile |
| `nile` | `123` | Customer | Customer portal / Dealer Mobile — Nile Interiors |
| `oasis` | `123` | Customer | Customer portal / Dealer Mobile — Oasis Living |
| `balqis` | `123` | Customer | Customer portal / Dealer Mobile — Balqis Hospitality |

Worker and extra staff accounts are not in the empty launch seed. Create them in Admin (Users): Worker, or Staff + a Staff Type.

Full catalog/orders demo (local QA only): `pnpm db:seed:demo` — also seeds `warehouse` (Warehouse Management staff) and floor workers.

Legacy email addresses (e.g. `admin@maher-aghbar.jo`) still exist on user records but login accepts **username only**.

---

## Command cheat sheet

### Stack

| Command | Purpose |
|---------|---------|
| `pnpm prepare:launch` | Ensure Postgres/Redis, push schema, seed, build all web apps |
| `pnpm launch` | Prepare if needed, then start API + 3 portals + worker |
| `pnpm start:all` | Start API + portals + worker (prepare if builds missing) |
| `pnpm stop:all` | Stop those services and free ports 3000–3002 and 4000 |
| `pnpm --filter @maher/api dev` | API watch mode on `:4000` |
| `pnpm dev:apps` | API + 3 portals in watch mode |
| `pnpm --filter @maher/admin-web dev` | Admin web watch `:3000` |
| `pnpm --filter @maher/customer-portal dev` | Customer portal watch `:3001` |
| `pnpm --filter @maher/employee-portal dev` | Employee portal watch `:3002` |

### Mobile

| Command | Purpose |
|---------|---------|
| `pnpm mobile:start` | Expo Metro (`expo start -c`) on `:8081` |
| `pnpm mobile:ios` / `pnpm mobile:android` | Open simulator / emulator |
| `pnpm mobile:doctor` | Expo Doctor (SDK / native ABI alignment) |
| `npx expo install --fix` | Run **inside `apps/mobile`** — pin native modules to SDK 54 |
| `pnpm mobile:typecheck` | Mobile TypeScript |
| `pnpm mobile:test` | Mobile Jest |
| `pnpm mobile:lint` | `expo lint` |
| `pnpm mobile:eas:preview:android` | EAS preview APK |

### Database

| Command | Purpose |
|---------|---------|
| `pnpm db:generate` | Prisma client |
| `pnpm db:push` | Push schema (local) |
| `pnpm db:migrate` | Dev migrations |
| `pnpm db:seed` | Launch seed: admin + 3 empty dealers |
| `pnpm db:seed:demo` | Full demo catalog, orders, inventory |
| `pnpm db:studio` | Prisma Studio |

### Quality

| Command | Purpose |
|---------|---------|
| `pnpm typecheck` | TypeScript across packages |
| `pnpm lint` | Lint |
| `pnpm test` | Unit / package tests |
| `pnpm build` | Production builds |
| `pnpm smoke:lifecycle` | API smoke checks |
| `pnpm smoke:workflow` | Accept → PO → QC → delivery |
| `pnpm smoke:scope` | Multi-customer + multi-worker isolation |
| `pnpm smoke:factory-uat` | Factory production-setup smoke |
| `pnpm smoke:factory-lifecycle` | Factory lifecycle (88 assertions) |

See [docs/launch-checklist.md](docs/launch-checklist.md) and [docs/troubleshooting.md](docs/troubleshooting.md).

## Documentation

See [`docs/`](docs/) for architecture, permissions, workflows, security, deployment, and PDF compliance.

- Mobile release / EAS: [docs/mobile-release.md](docs/mobile-release.md)
- Phase 2 credential-gated integrations (IMAP, WhatsApp, Maps): [docs/factory-ux-phase2.md](docs/factory-ux-phase2.md)

## Security notes

- Backend enforces permissions on every protected route
- Refresh tokens stored hashed; cookies are HTTP-only
- Financial totals and inventory balances are server-authoritative
- AI intake always requires human approval before creating draft RFQs
