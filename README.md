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
| Mobile (Expo SDK 54) | Physical iPhone: `pnpm mobile:dev-client` → **Maher Al-Aghbar Furniture** | Admin, staff, workers, dealers |
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
- Mobile: the **Maher Al-Aghbar Furniture** development app on a physical iPhone (already installed). Do **not** use App Store Expo Go 57. Details: [docs/mobile-iphone-dev-build.md](docs/mobile-iphone-dev-build.md).

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

## Start the mobile app (physical iPhone)

This is the normal way to run mobile. The Maher development app is already on the iPhone (`Maher Al-Aghbar Furniture`). Do **not** open Expo Go. Do **not** boot the iOS Simulator.

App Store Expo Go is SDK 57 and cannot load this SDK 54 project.

### Every time you want the app later

Phone and Mac on the **same Wi‑Fi** (not guest / client-isolation). Unlock the phone.

Two terminals from the **repo root**:

```bash
pnpm dev:api                 # Nest API on :4000 (must listen; Postgres + Redis already up)
pnpm mobile:dev-client       # Metro for the Maher iPhone app on :8081
```

Then on the iPhone tap **Maher Al-Aghbar Furniture**. If it asks for a server, pick `exp://<your-mac-lan-ip>:8081`.

Login: `admin` / `123` (other demo users also use password `123`).

JS/TS/TSX saves Fast Refresh. Press `r` in the Metro terminal to reload. Leave `apps/mobile/.env` as `EXPO_PUBLIC_API_BASE_URL=http://localhost:4000` — the app rewrites that to the Mac LAN IP automatically.

You do **not** need USB after the first install, and you do **not** run `pnpm mobile:ios:device` for ordinary UI work.

### First install / native rebuild only

Already done on this Mac + iPhone. Run again only if you delete the app, change Expo plugins / native modules / `app.config.ts`, or a new phone:

```bash
pnpm mobile:ios:device       # Xcode install onto the plugged-in iPhone
```

First launch on a new phone: **Settings → General → VPN & Device Management** → Apple Development / Saad Aghbar → **Trust**. If iOS blocks launch: **Settings → Privacy & Security → Developer Mode** → On.

Full signing notes: [docs/mobile-iphone-dev-build.md](docs/mobile-iphone-dev-build.md).

### “Network error. Check API URL and connection.”

You need **both** `pnpm dev:api` and `pnpm mobile:dev-client`. Metro alone is not enough.

1. API health: `curl -sS http://localhost:4000/api/v1/health` — expect `{"status":"ok",...}`.
2. Same Wi‑Fi, not guest/isolated. Confirm Mac IP: `ipconfig getifaddr en0`.
3. You opened **Maher Al-Aghbar Furniture**, not Expo Go.
4. If auto-detect fails, pin the Mac IP in `apps/mobile/.env` (`EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_IP:4000`) and restart `pnpm mobile:dev-client`.
5. After a Wi‑Fi / IP change, restart `pnpm mobile:dev-client`.

### iOS Simulator (optional, Expo Go 54 only)

Do not use this for the physical iPhone. Simulator Expo Go 54:

```bash
pnpm mobile:start            # Metro without --dev-client
# press i in that terminal
```

`pnpm mobile:ios` opens a simulator. `pnpm mobile:android` opens an Android emulator. `pnpm dev:mobile` is an alias of `mobile:start`.

---

## When Expo / ABI breaks

This project is **Expo SDK 54** + **React Native 0.81** + **New Architecture**. On the **physical iPhone** use **Maher Al-Aghbar Furniture** + `pnpm mobile:dev-client` — App Store Expo Go 57 will not work. Simulator-only Expo Go must be SDK 54.

A mismatch shows up as a red screen, a blank app, “incompatible”, or an **ABI** error (Hermes / native binary does not match the JS bundle).

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
| `pnpm mobile:dev-client` | Daily Metro for the **Maher iPhone app** (`:8081`) |
| `pnpm mobile:ios:device` | Reinstall that app onto a plugged-in iPhone (native changes only) |
| `pnpm mobile:start` | Metro for **simulator Expo Go 54** only |
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

- [Repository map](docs/architecture/repository-map.md) — which app/package owns what
- [Where to change things](docs/architecture/where-to-change-things.md) — feature → path (Web vs Mobile vs API)
- [Docs index](docs/README.md)

Also: architecture, permissions, workflows, security, deployment, PDF compliance.

- Mobile release / EAS: [docs/mobile-release.md](docs/mobile-release.md)
- Phase 2 credential-gated integrations (IMAP, WhatsApp, Maps): [docs/factory-ux-phase2.md](docs/factory-ux-phase2.md)

## Security notes

- Backend enforces permissions on every protected route
- Refresh tokens stored hashed; cookies are HTTP-only
- Financial totals and inventory balances are server-authoritative
- AI intake always requires human approval before creating draft RFQs
