# Repository map

**Updated:** 2026-10-15
See also: [where-to-change-things.md](./where-to-change-things.md), [repository-architecture-audit.md](../repository-architecture-audit.md).

The top-level `apps/` and `packages/` names already match ownership. This map explains them; it does not propose a rename.

## Tree

```
maher-aghbar-furniture-app
├── apps
│   ├── api                 Nest REST API (:4000)
│   ├── web                 Unified admin / staff / dealer / worker website (:3000)
│   ├── mobile              Expo / React Native app (Metro :8081)
│   └── worker              BullMQ background jobs
├── packages
│   ├── types               Shared TS contracts
│   ├── permissions         Canonical RBAC / Staff
│   ├── workflow-domain     Shared workflow and production lifecycle logic
│   ├── notifications       Shared notification contracts and rules
│   ├── i18n                ar/en/he message catalogs
│   ├── ui                  Next.js DOM components (not Mobile)
│   ├── database            Prisma schema + seeds
│   ├── integrations        Email/SMS/WhatsApp/AI/OCR
│   ├── logging             JSON logger
│   ├── tsconfig            Shared TypeScript configs
│   ├── config              Unused env helper (listed on API)
│   ├── validation          Unused Zod schemas (listed on API)
│   ├── workflow-graph      Unused DAG layout package
│   ├── testing             Unused test stub
│   └── eslint-config       Unused ESLint stub
├── scripts                 Launch, smoke, factory UAT, asset helpers
├── docs                    Product + architecture + historical reports
├── e2e                     Playwright specs
├── infra/docker            Compose + Dockerfiles
└── design-references       Brand source images
```

## Apps (one sentence)

| Directory | What lives here |
|-----------|-----------------|
| `apps/api` | Nest modules under `src/modules/<feature>/`. Business behavior. |
| `apps/web` | Next App Router UI. Admin, dealer, and worker routes in `src/app/[locale]/`. |
| `apps/mobile` | Finished Expo app. Feature code in `src/features/`. Do not mix with Web. |
| `apps/worker` | Queue consumers. Not a UI. |

## Packages (one sentence)

| Directory | What lives here |
|-----------|-----------------|
| `packages/types` | Shared types consumed by apps over `@maher/types`. |
| `packages/permissions` | Permission catalog, `can()`, Staff kinds, home/tab helpers. |
| `packages/i18n` | Translation JSON for all UIs. |
| `packages/ui` | Tailwind/DOM kit for the unified Next app only. |
| `packages/workflow-domain` | Shared workflow and production lifecycle logic. |
| `packages/notifications` | Shared notification contracts and rules. |
| `packages/database` | `prisma/schema.prisma` and seeds. |
| `packages/integrations` | Provider factories for API + worker. |
| `packages/logging` | `createLogger`. |
| `packages/tsconfig` | Base `tsconfig` JSON. |

## Communication

Mobile and the website talk to the API **over HTTP** (`/api/v1`). They do not import `apps/api/src`. Mobile and Web do not import each other's source.

## Generated (do not edit)

`.next/`, `dist/`, `.expo/`, `logs/`, `uploads/`, `.run/`, `coverage/`, Playwright reports, Prisma client in `node_modules`.
