# Packages

Shared libraries. Something belongs here only if more than one app needs it, or it is a repo-wide contract.

| Package | Name | Use |
|---------|------|-----|
| `types` | `@maher/types` | Shared TS types |
| `permissions` | `@maher/permissions` | RBAC, Staff, `can()`, home/tabs |
| `i18n` | `@maher/i18n` | ar/en/he catalogs for all UIs |
| `ui` | `@maher/ui` | Next DOM components — **not Mobile** |
| `database` | `@maher/database` | Prisma schema, client, seeds |
| `integrations` | `@maher/integrations` | Providers for API + worker |
| `logging` | `@maher/logging` | Logger |
| `tsconfig` | `@maher/tsconfig` | Shared TS configs |

Listed but unused in app source (do not delete in this refactor): `config`, `validation`, `workflow-graph`, `testing`, `eslint-config`.

Packages must not import `apps/` (Prisma seed `dealer-orders-recent.ts` is the known exception).
