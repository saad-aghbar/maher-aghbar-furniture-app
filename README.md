# Maher Al-Aghbar & Sons Furniture ERP

Production ERP for **مفروشات ماهر الأغبر وأولاده** — furniture manufacturing from inquiry through production, delivery, and payment.

## Account types

The system has exactly **three** account types:

| Type | Role code | Portal |
|------|-----------|--------|
| **Admin** | `SYSTEM_ADMINISTRATOR` | Admin web (`:3000`) + mobile |
| **Customer** | `CUSTOMER` | Customer portal (`:3001`) + mobile — one login per dealer |
| **Worker** | `PRODUCTION_WORKER` | Employee portal (`:3002`) + mobile — floor tasks, QC, delivery |

Every dealer (customer company/showroom) has a linked **customer** login for the portal.

## Applications

| App | URL / entry | Audience |
|-----|-------------|----------|
| Admin Web | http://localhost:3000 | Admin |
| Customer Portal | http://localhost:3001 | Customers (dealers) |
| Employee Portal | http://localhost:3002 | Workers |
| **Mobile (unified)** | Expo — `pnpm mobile:start` | All three account types |
| API + Swagger | http://localhost:4000/api/docs | Integrations |
| Worker | background | PDF, AI/OCR, notifications |

One mobile login serves admin, customer, and worker. Navigation is built from **backend permissions**.

Mobile docs: [docs/mobile-audit.md](docs/mobile-audit.md), [docs/mobile-local-development.md](docs/mobile-local-development.md).

## Stack

- Next.js + TypeScript frontends
- NestJS REST API
- PostgreSQL + Prisma
- Redis / BullMQ (worker)
- Local disk uploads (MinIO optional)
- Arabic / English / Hebrew (RTL)

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable && corepack prepare pnpm@9.15.9 --activate`)
- PostgreSQL 16+ (Homebrew `postgresql@18` or Docker)
- Redis (Homebrew or Docker)

## Quick start

```bash
cp .env.example .env   # first time only
pnpm install
pnpm prepare:launch    # infra, schema, seed, build all apps
pnpm launch            # API + 3 portals + worker
pnpm mobile:start      # unified Expo app (second terminal)
```

For mobile, scan the QR code with **Expo Go** — no Xcode or Android Studio
needed. The app reads the API host from the Expo dev server, so a physical phone
works as long as it shares the Mac's Wi-Fi.

Stop web stack:

```bash
pnpm stop:all
```

Open:

- Admin: http://localhost:3000/ar/login
- Customer: http://localhost:3001/ar/login
- Employee: http://localhost:3002/ar/login
- API docs: http://localhost:4000/api/docs

`pnpm start:all` auto-runs prepare if builds are missing.

Optional Docker infra only:

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres redis
```

## Demo accounts

**Local / demo only — never use these in production.**

Every account below uses password **`Admin@12345!`**. Sign in with **username** (not email).

Still only three **types** (admin / customer / worker). Specialty floor logins are all Worker accounts — each sees **only their assigned tasks**.

| Username | Password | Type | App / specialty |
|----------|----------|------|-----------------|
| `admin` | `Admin@12345!` | Admin | Admin web / mobile — assign stages, run the factory |
| `worker` | `Admin@12345!` | Worker | Material prep (WH) |
| `carpenter` | `Admin@12345!` | Worker | Carpentry — Cedar PO |
| `carpenter2` | `Admin@12345!` | Worker | Carpentry — Olive PO (same specialty, isolated tasks) |
| `painter` | `Admin@12345!` | Worker | Painting |
| `upholsterer` | `Admin@12345!` | Worker | Upholstery |
| `assembler` | `Admin@12345!` | Worker | Assembly |
| `packer` | `Admin@12345!` | Worker | Packaging |
| `inspector` | `Admin@12345!` | Worker | Quality inspection |
| `driver` | `Admin@12345!` | Worker | Delivery |
| `cedar` | `Admin@12345!` | Customer | Customer portal — Cedar Hotel |
| `olive` | `Admin@12345!` | Customer | Customer portal — Olive Restaurant |
| `petra` | `Admin@12345!` | Customer | Customer portal — Petra Showroom |
| `villa` | `Admin@12345!` | Customer | Customer portal — Amman Villa |

Quick smoke logins: **`admin`**, **`cedar`**, **`carpenter`** — same password.

**Workflow:** Admin opens a production order and assigns a worker per stage (filtered by department). When a worker completes their stage, the pipeline unlocks the next ready stages (e.g. carpentry done → upholstery / assembly can proceed; packaging done → delivery). Workers never see each other’s tasks.

Demo data (`pnpm db:seed`) tells a full Amman factory story: Cedar lobby sofas mid-production with a partial AR payment, Olive dining chairs delivered and paid (with a pending return), Petra showroom quote pending, open fabric purchase request for low stock, and supplier AP against a received timber/foam PO. Each dealer has its own customer portal account.

Legacy email addresses (e.g. `admin@maher-aghbar.jo`) still exist on user records but login accepts **username only**.

Login URLs:

- Admin: http://localhost:3000/ar/login
- Customer: http://localhost:3001/ar/login
- Employee: http://localhost:3002/ar/login
- Mobile: Expo Go via `pnpm mobile:start`

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm prepare:launch` | Ensure Postgres/Redis, push schema, seed, build |
| `pnpm start:all` | Start API + portals + worker |
| `pnpm stop:all` | Stop all local services |
| `pnpm mobile:start` | Expo Metro for unified mobile app |
| `pnpm mobile:android` / `mobile:ios` | Open Android / iOS |
| `pnpm mobile:typecheck` | Mobile TypeScript |
| `pnpm smoke:lifecycle` | API smoke checks |
| `pnpm smoke:workflow` | Critical-path accept→PO→QC→delivery smoke |
| `pnpm smoke:scope` | Multi-customer + multi-worker isolation smoke |
| `pnpm typecheck` | TypeScript across packages |
| `pnpm build` | Production builds |
| `pnpm db:seed` | Re-seed demo data |

Logs: `logs/*.log` · PIDs: `.run/*.pid`

See [docs/launch-checklist.md](docs/launch-checklist.md).

## Documentation

See [`docs/`](docs/) for architecture, permissions, workflows, security, deployment, and PDF compliance.

Phase 2 credential-gated integrations (IMAP, WhatsApp, Maps): [docs/factory-ux-phase2.md](docs/factory-ux-phase2.md).

## Security notes

- Backend enforces permissions on every protected route
- Refresh tokens stored hashed; cookies are HTTP-only
- Financial totals and inventory balances are server-authoritative
- AI intake always requires human approval before creating draft RFQs
