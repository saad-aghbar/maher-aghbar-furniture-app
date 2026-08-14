# Architecture

## System context

```mermaid
flowchart TB
  Admin[AdminWeb_Nextjs]
  Customer[CustomerPortal_Nextjs]
  Employee[EmployeePortal_Nextjs]
  API[NestJS_API]
  Worker[BullMQ_Worker]
  DB[(PostgreSQL)]
  Redis[(Redis)]
  S3[(S3_or_MinIO)]
  Providers[Email_SMS_WhatsApp_AI_OCR]

  Admin --> API
  Customer --> API
  Employee --> API
  API --> DB
  API --> Redis
  API --> S3
  API --> Worker
  Worker --> DB
  Worker --> Redis
  Worker --> S3
  Worker --> Providers
```

## Layering

1. **Presentation** — Next.js App Router apps (`admin-web`, `customer-portal`, `employee-portal`).
2. **API gateway** — NestJS REST, OpenAPI, rate limits, request IDs.
3. **Application services** — domain modules; transactions; permission checks.
4. **Persistence** — Prisma + PostgreSQL.
5. **Async** — BullMQ workers for PDF, AI/OCR, notifications, reports, thumbnails.
6. **Integrations** — provider interfaces with mock/console implementations for local.

## Authority

The **backend is the sole authority** for authz, workflow transitions, pricing/tax, inventory math, financial totals, PDF generation, audit, AI processing, and file access.

## Monorepo

```
apps/api | admin-web | customer-portal | employee-portal | mobile | worker
packages/types | permissions | i18n | ui | database | integrations | logging | tsconfig
         (+ unused: validation, config, testing, eslint-config, workflow-graph)
scripts/  docs/  e2e/  infra/docker/  design-references/
```

Map and “where do I change this?”: [architecture/repository-map.md](architecture/repository-map.md), [architecture/where-to-change-things.md](architecture/where-to-change-things.md). Index: [README.md](README.md).

## Environments

`local` → `development` → `staging` → `production`

Secrets via environment variables only; never committed.
