# Maher Al-Aghbar & Sons Furniture ERP

Production ERP for **مفروشات ماهر الأغبر وأولاده** — furniture manufacturing from inquiry through production, delivery, and payment.

## Account types

The system has exactly **three** account types:

| Type | Role code | Portal |
|------|-----------|--------|
| **Admin** | `SYSTEM_ADMINISTRATOR` | Admin web (`:3000`) |
| **Customer** | `CUSTOMER` | Customer portal (`:3001`) — one login per dealer |
| **Worker** | `PRODUCTION_WORKER` | Employee portal (`:3002`) — floor tasks, QC, delivery |

Every dealer (customer company/showroom) has a linked **customer** login for the portal.

## Applications

| App | URL / entry | Audience |
|-----|-------------|----------|
| Admin Web | http://localhost:3000 | Admin |
| Customer Portal | http://localhost:3001 | Customers (dealers) |
| Employee Portal | http://localhost:3002 | Workers |
| API + Swagger | http://localhost:4000/api/docs | Integrations |
| Worker | background | PDF, AI/OCR, notifications |

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
```

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

## Launch accounts

**Local / launch seed only — change these passwords before production.**

Every account below uses password **`123`**. Sign in with **username** (not email).

`pnpm db:seed` creates **empty** accounts: no products, inventory, orders, or invoices.

| Username | Password | Type | App |
|----------|----------|------|-----|
| `admin` | `123` | Admin | Admin web |
| `nile` | `123` | Customer | Customer portal — Nile Interiors |
| `oasis` | `123` | Customer | Customer portal — Oasis Living |
| `balqis` | `123` | Customer | Customer portal — Balqis Hospitality |

Worker accounts are not seeded. Create them in Admin when you staff the floor.

Legacy email addresses (e.g. `admin@maher-aghbar.jo`) still exist on user records but login accepts **username only**.

Full catalog/orders demo (local QA only): `pnpm db:seed:demo`.

Login URLs:

- Admin: http://localhost:3000/ar/login
- Customer: http://localhost:3001/ar/login
- Employee: http://localhost:3002/ar/login

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm prepare:launch` | Ensure Postgres/Redis, push schema, seed, build |
| `pnpm start:all` | Start API + portals + worker |
| `pnpm stop:all` | Stop all local services |
| `pnpm smoke:lifecycle` | API smoke checks |
| `pnpm smoke:workflow` | Critical-path accept→PO→QC→delivery smoke |
| `pnpm smoke:scope` | Multi-customer + multi-worker isolation smoke |
| `pnpm typecheck` | TypeScript across packages |
| `pnpm build` | Production builds |
| `pnpm db:seed` | Launch seed: admin + 3 empty dealers |
| `pnpm db:seed:demo` | Full demo catalog, orders, inventory (local QA) |

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
