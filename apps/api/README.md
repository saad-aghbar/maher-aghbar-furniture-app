# API (`@maher/api`)

NestJS REST API. Port **4000**. Prefix `/api/v1`. Swagger: http://localhost:4000/api/docs.

Sole authority for authz, inventory math, workflow, scheduling, money, PDFs.

## What belongs here

| Path | Role |
|------|------|
| `src/main.ts` | Bootstrap |
| `src/modules/<feature>/` | Controllers, services, DTOs, domain, colocated tests |
| `src/common/` | Guards, filters, Prisma service, PDF/helpers |
| `assets/` | PDF fonts and brand |
| `*.traineddata` | Tesseract language packs (runtime) |

Do **not** reorganize factory modules (production, workflow, inventory, scheduling) for folder aesthetics.

## Commands

```bash
pnpm --filter @maher/api dev
pnpm --filter @maher/api typecheck
pnpm --filter @maher/api test
pnpm --filter @maher/api build
```

## Dependencies

`@maher/database`, `@maher/permissions`, `@maher/types`, `@maher/integrations`, `@maher/logging`. Must not import `@maher/ui` or any app UI.

Frontends consume this app **over HTTP only**.
