# PROJECT_MAP

Compact inventory. Prefer the cited docs over re-deriving this.

## Apps

| Path | Name | Role | Port |
|------|------|------|------|
| `apps/api` | `@maher/api` | Nest REST API | 4000 (`/api/v1/health`) |
| `apps/admin-web` | `@maher/admin-web` | Admin / staff Next.js UI | 3000 |
| `apps/customer-portal` | `@maher/customer-portal` | Dealer Next.js portal | 3001 |
| `apps/employee-portal` | `@maher/employee-portal` | Worker Next.js portal | 3002 |
| `apps/mobile` | `@maher/mobile` | Expo / RN universal app (admin, dealer, worker) | Metro 8081 |
| `apps/worker` | `@maher/worker` | BullMQ consumer | none |

## Packages

| Path | Name | Owns |
|------|------|------|
| `packages/types` | `@maher/types` | Shared TS contracts |
| `packages/permissions` | `@maher/permissions` | RBAC catalog, `can()`, surfaces |
| `packages/i18n` | `@maher/i18n` | ar / en / he catalogs |
| `packages/ui` | `@maher/ui` | Tailwind/DOM kit (Next apps only) |
| `packages/database` | `@maher/database` | Prisma schema, seeds, demo reset |
| `packages/integrations` | `@maher/integrations` | Email, SMS, WhatsApp, AI, OCR factories |
| `packages/logging` | `@maher/logging` | Shared JSON logger |
| `packages/notifications` | `@maher/notifications` | Notification domain helpers |
| `packages/workflow-domain` | `@maher/workflow-domain` | Workflow graph model / mutations |
| `packages/workflow-graph` | `@maher/workflow-graph` | DAG layout utilities |
| `packages/config` | `@maher/config` | Env helper (API) |
| `packages/validation` | `@maher/validation` | Zod schemas |
| `packages/tsconfig` | `@maher/tsconfig` | Shared TS config |
| `packages/eslint-config` | `@maher/eslint-config` | Shared ESLint stub |
| `packages/testing` | `@maher/testing` | Shared test stub |

## Versions (from manifests)

- API: NestJS `^10.4.15`, BullMQ `^5.34.5`
- Admin / portals: Next.js `^14.2.22`, React `^18.3.1`
- Mobile: Expo `~54.0.37`, React Native `0.81.5`, React `19.1.0`, Expo Router `~6.0.24`
- Database: Prisma `^6.1.0` + Postgres; Redis for queues

## Commands

| Group | Scripts |
|-------|---------|
| Stack | `/run` `/start` `/fix` `/stop` via [`.cursor/skills/dev-stack/SKILL.md`](../../.cursor/skills/dev-stack/SKILL.md) — API + admin + Metro. `/stop` writes `.run/dev-stack.stopped`; only `/start` clears it. |
| Database / demo | `pnpm db:push`, `pnpm db:seed`, `pnpm demo:reset`, `pnpm demo:validate` |
| Quality | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check:boundaries` |
| Mobile | `pnpm mobile:dev-client`, `pnpm mobile:ios`, `pnpm mobile:android`, `pnpm mobile:test` |
| Smoke | `pnpm smoke:lifecycle`, `pnpm smoke:workflow`, domain `smoke:*-uat` under `scripts/` |

Do not use `pnpm start:all` / `stop:all` for daily Cursor stack work.

## Read these instead of re-deriving

- [docs/README.md](../README.md) — documentation index
- [docs/architecture/repository-map.md](../architecture/repository-map.md) — app/package tree
- [docs/architecture/where-to-change-things.md](../architecture/where-to-change-things.md) — feature → path
- [docs/repository-architecture-audit.md](../repository-architecture-audit.md) — how pieces talk
- [README.md](../../README.md) — operator guide, logins, ports
