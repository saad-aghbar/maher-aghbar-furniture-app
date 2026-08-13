# Deployment

Infrastructure and environment guidance for **Maher Al-Aghbar & Sons Furniture ERP**.

---

## Docker Compose services (local)

File: `infra/docker/docker-compose.yml` (Phase 1+)

```mermaid
flowchart TB
  subgraph apps [Applications]
    NG[nginx]
    ADM[admin-web]
    CUST[customer-portal]
    EMP[employee-portal]
    API[api]
    WRK[worker]
  end

  subgraph data [Data]
    PG[(postgres)]
    RD[(redis)]
    MN[(minio)]
  end

  NG --> ADM
  NG --> CUST
  NG --> EMP
  NG --> API
  ADM --> API
  CUST --> API
  EMP --> API
  API --> PG
  API --> RD
  API --> MN
  WRK --> PG
  WRK --> RD
  WRK --> MN
```

| Service | Image / build | Ports | Purpose |
|---------|---------------|-------|---------|
| `postgres` | `postgres:16-alpine` | 5432 | Primary database |
| `redis` | `redis:7-alpine` | 6379 | Cache, BullMQ |
| `minio` | `minio/minio` | 9000, 9001 | S3-compatible storage |
| `api` | `apps/api/Dockerfile` | 3001 | NestJS REST |
| `worker` | `apps/worker/Dockerfile` | — | Background jobs |
| `admin-web` | `apps/admin-web/Dockerfile` | 3000 | Admin Next.js |
| `customer-portal` | `apps/customer-portal/Dockerfile` | 3002 | Customer Next.js |
| `employee-portal` | `apps/employee-portal/Dockerfile` | 3003 | Employee Next.js |
| `nginx` | `infra/nginx/Dockerfile` | 80, 443 | Reverse proxy, TLS (staging/prod) |

Optional profiles:

- `clamav` — virus scanning (staging/prod)
- `mailhog` — local email capture

### Local quick start (target)

```bash
cp .env.example .env
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio
pnpm db:migrate && pnpm db:seed
pnpm dev
```

`pnpm db:seed` creates one admin and three empty dealer accounts (`admin`, `nile`, `oasis`, `balqis`). It does **not** load demo products, orders, or invoices. Local QA with a full fake factory: `pnpm db:seed:demo`.

---

## Environment variables

Grouped by concern. Full template in `.env.example`.

### Core

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | Yes | `development` | |
| `APP_URL` | Yes | `http://localhost` | Public base URL |
| `API_URL` | Yes | `http://localhost/api/v1` | Client-facing API base |
| `TZ` | Yes | `Asia/Amman` | |

### Database

| Variable | Required | Example |
|----------|----------|---------|
| `DATABASE_URL` | Yes | `postgresql://erp:erp@postgres:5432/maher_erp` |

### Redis

| Variable | Required | Example |
|----------|----------|---------|
| `REDIS_URL` | Yes | `redis://redis:6379` |

### Auth

| Variable | Required | Example |
|----------|----------|---------|
| `JWT_ACCESS_SECRET` | Yes | random 64+ chars |
| `JWT_REFRESH_SECRET` | Yes | random 64+ chars |
| `JWT_ACCESS_TTL` | No | `15m` |
| `JWT_REFRESH_TTL` | No | `30d` |
| `COOKIE_DOMAIN` | Prod | `.maheraghbar.com` |

### Storage (S3/MinIO)

| Variable | Required | Example |
|----------|----------|---------|
| `S3_ENDPOINT` | Yes | `http://minio:9000` |
| `S3_BUCKET` | Yes | `maher-erp-documents` |
| `S3_ACCESS_KEY` | Yes | — |
| `S3_SECRET_KEY` | Yes | — |
| `S3_REGION` | No | `us-east-1` |
| `S3_FORCE_PATH_STYLE` | Local | `true` |

### AI / integrations

| Variable | Required | Example |
|----------|----------|---------|
| `AI_OCR_PROVIDER` | No | `mock` |
| `AI_LLM_PROVIDER` | No | `mock` |
| `AI_LLM_API_KEY` | Staging+ | — |
| `EMAIL_PROVIDER` | No | `console` |
| `SMS_PROVIDER` | No | `mock` |
| `WHATSAPP_PROVIDER` | No | `mock` |

### App URLs (internal)

| Variable | Example |
|----------|---------|
| `ADMIN_WEB_URL` | `http://localhost:3000` |
| `CUSTOMER_PORTAL_URL` | `http://localhost:3002` |
| `EMPLOYEE_PORTAL_URL` | `http://localhost:3003` |

---

## Environment tiers

| Tier | Purpose | Providers | TLS |
|------|---------|-----------|-----|
| **local** | Developer machines | Mock/console | Optional |
| **development** | Shared dev server | Mock/mailhog | Self-signed |
| **staging** | UAT, client demo | Real OCR/LLM (test keys) | Let's Encrypt |
| **production** | Live factory ops | Production providers | Let's Encrypt / commercial |

Promotion path: PR → CI → staging auto-deploy → manual approval → production.

---

## Staging guidance

- Separate PostgreSQL instance; anonymized seed from prod **never** copied without sanitization.
- MinIO or dedicated S3 bucket `maher-erp-staging`.
- Real provider keys in staging secret store only.
- Feature flags for incomplete modules (`SETTINGS_FEATURE_FLAGS` JSON).
- Staging URL: `https://staging.maheraghbar.com` (placeholder until DNS blocking item resolved).

Smoke test after deploy:

1. `/health/ready` → 200
2. Login as seeded admin
3. Create draft quotation
4. Worker heartbeat metric present

---

## Production guidance

### Hosting assumptions

- Single-region VM or managed Kubernetes (team choice at Phase 11).
- PostgreSQL managed service preferred (backups, PITR).
- Redis persistent for BullMQ; separate cache instance optional at scale.
- S3-compatible storage with versioning enabled.

### nginx

- Terminate TLS; proxy to Next.js apps and API.
- Rate limiting at edge for `/auth/login`.
- Max body size 25 MB (upload init uses direct S3 PUT for large files).

### CI/CD (GitHub Actions)

- Lint, typecheck, unit tests on PR
- Build Docker images → registry
- Migrate DB on deploy (`prisma migrate deploy`)
- Zero-downtime: rolling update API + worker; Next.js static where possible

### Scaling triggers

| Signal | Action |
|--------|--------|
| API p95 > 500 ms | Horizontal API replicas |
| Worker queue lag > 5 min | Scale workers |
| DB CPU > 70% sustained | Read replica for reports (Phase 10+) |

---

## Observability

- Structured JSON logs (`requestId`, `userId`)
- Health endpoints for orchestrator
- Error tracking (Sentry-compatible hook)
- Metrics: request rate, queue depth, job failures

---

## Rollback

1. Revert container image tag to previous release.
2. If migration incompatible, forward-fix migration (no down migrations in prod).
3. Notify ops; audit deploy event.

See `backups.md` for database recovery.
