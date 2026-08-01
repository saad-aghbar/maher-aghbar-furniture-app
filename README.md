# Maher Al-Aghbar & Sons Furniture ERP

Production ERP for **مفروشات ماهر الأغبر وأولاده** — furniture manufacturing from inquiry through production, delivery, and payment.

## Applications

| App | URL / entry | Audience |
|-----|-------------|----------|
| Admin Web | http://localhost:3000 | Management, sales, warehouse, accounting |
| Customer Portal | http://localhost:3001 | Customers |
| Employee Portal | http://localhost:3002 | Production floor (web) |
| **Mobile (unified)** | Expo — `pnpm mobile:start` | **All roles** (permission-based) |
| API + Swagger | http://localhost:4000/api/docs | Integrations |
| Worker | background | PDF, AI/OCR, notifications |

One mobile login serves customers, sales, warehouse, production, quality, delivery, finance, and admins. Navigation is built from **backend permissions**, not separate apps.

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

Every account below uses the same password:

| Email | Password | App / portal |
|-------|----------|--------------|
| `admin@maher-aghbar.jo` | `Admin@12345!` | Admin web — system administrator |
| `sales@maher-aghbar.jo` | `Admin@12345!` | Admin web — sales manager |
| `worker@maher-aghbar.jo` | `Admin@12345!` | Employee portal / mobile — material prep & QC |
| `carpenter@maher-aghbar.jo` | `Admin@12345!` | Employee portal / mobile — carpentry |
| `painter@maher-aghbar.jo` | `Admin@12345!` | Employee portal / mobile — painting |
| `upholsterer@maher-aghbar.jo` | `Admin@12345!` | Employee portal / mobile — upholstery |
| `assembler@maher-aghbar.jo` | `Admin@12345!` | Employee portal / mobile — assembly |
| `packer@maher-aghbar.jo` | `Admin@12345!` | Employee portal / mobile — packaging & delivery |
| `customer@cedar-hotel.jo` | `Admin@12345!` | Customer portal / mobile — Cedar Hotel only |
| `customer@olive-restaurant.jo` | `Admin@12345!` | Customer portal / mobile — Olive Restaurant only |

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

## Security notes

- Backend enforces permissions on every protected route
- Refresh tokens stored hashed; cookies are HTTP-only
- Financial totals and inventory balances are server-authoritative
- AI intake always requires human approval before creating draft RFQs
