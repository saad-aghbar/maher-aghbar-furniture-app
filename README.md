# Maher Al-Aghbar & Sons Furniture ERP

Production ERP for **مفروشات ماهر الأغبر وأولاده** — furniture manufacturing from inquiry through production, delivery, and payment.

## Applications

| App | URL (local) | Audience |
|-----|-------------|----------|
| Admin Web | http://localhost:3000 | Management, sales, warehouse, accounting |
| Customer Portal | http://localhost:3001 | Customers |
| Employee Portal | http://localhost:3002 | Production floor |
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
pnpm prepare:launch    # infra check, schema, seed, build all apps
pnpm start:all         # API + 3 portals + worker
```

Stop later:

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

Password for all: `Admin@12345!`

| Email | Role |
|-------|------|
| admin@maher-aghbar.jo | System administrator |
| sales@maher-aghbar.jo | Sales manager |
| worker@maher-aghbar.jo | Production worker |
| customer@cedar-hotel.jo | Customer |

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm prepare:launch` | Ensure Postgres/Redis, push schema, seed, build |
| `pnpm start:all` | Start API + portals + worker |
| `pnpm stop:all` | Stop all local services |
| `pnpm smoke:lifecycle` | API smoke checks |
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
