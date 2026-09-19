# ARCHITECTURE_MAP

Where to change X. Source code wins if this drifts.

## API

- Domain modules: [`apps/api/src/modules/`](../../apps/api/src/modules/) (auth, catalog, customers, deliveries, inventory, invoices, payments, production, purchasing, quality, quotations, reports, requests, roles, sales-orders, scheduling, tasks, users, warehouses, …).
- Typical shape: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`.
- Global prefix `api/v1` in [`apps/api/src/main.ts`](../../apps/api/src/main.ts).
- Shared guards / Prisma / filters: [`apps/api/src/common/`](../../apps/api/src/common/).

## Auth and permissions

- Catalog (source of truth): [`packages/permissions/src/catalog.ts`](../../packages/permissions/src/catalog.ts) — `PERMISSIONS`, identity `ROLES`, `ROLE_PERMISSIONS`.
- Surfaces: `resolveAppSurface()` in [`packages/permissions/src/routing.ts`](../../packages/permissions/src/routing.ts) → `'admin' | 'customer' | 'employee'`.
- Global `JwtAuthGuard` + `PermissionsGuard` in [`apps/api/src/app.module.ts`](../../apps/api/src/app.module.ts).
- Decorators: `@RequirePermissions`, `@RequireAnyPermissions`, `@Public` in [`apps/api/src/common/decorators/auth.decorators.ts`](../../apps/api/src/common/decorators/auth.decorators.ts).
- New permission = catalog **and** seed upsert in [`packages/database/prisma/seed/foundation.ts`](../../packages/database/prisma/seed/foundation.ts).
- User → roles → permissions: Prisma `User` / `UserRole` / `Role` / `RolePermission` in [`packages/database/prisma/schema.prisma`](../../packages/database/prisma/schema.prisma). Session payload built in `apps/api/src/modules/auth/`.

## Database and demo

- Schema: [`packages/database/prisma/schema.prisma`](../../packages/database/prisma/schema.prisma).
- Local / CI: `prisma db push`. Production / staging: `prisma migrate deploy`.
- Demo reset entry: [`packages/database/prisma/demo/reset.ts`](../../packages/database/prisma/demo/reset.ts) → `factory-world.ts`. Guard: `env-guard.ts`. Frozen clock: `clock.ts`. Checks: `validate.ts`.
- Empty launch seed: `pnpm db:seed` (foundation only). Father demo: `pnpm demo:reset` then `pnpm demo:validate`.

## Mobile

- Expo Router tree (thin): [`apps/mobile/app/`](../../apps/mobile/app/) — `(auth)`, `(app)/(admin)`, `(app)/(customer)`, `(app)/(employee)`.
- Screen implementations: [`apps/mobile/src/features/`](../../apps/mobile/src/features/).
- Shell / nav: [`apps/mobile/src/navigation/`](../../apps/mobile/src/navigation/) (`AdaptiveShell`, `SurfaceGate`, `AdminSideNav`).
- HTTP: [`apps/mobile/src/api/client.ts`](../../apps/mobile/src/api/client.ts). Base URL: [`apps/mobile/src/api/config.ts`](../../apps/mobile/src/api/config.ts) (`EXPO_PUBLIC_API_BASE_URL`, Expo LAN host, Android `10.0.2.2` → `/api/v1`).
- Surface gates on each group `_layout.tsx` using `resolveAppSurface`.
- Apple Watch (native, not RN): SwiftUI in [`apps/mobile/targets/watch/`](../../apps/mobile/targets/watch/) (injected by `@bacons/apple-targets` at prebuild). iPhone bridge: [`apps/mobile/modules/maher-watch-bridge/`](../../apps/mobile/modules/maher-watch-bridge/). JS contract / session sync: [`apps/mobile/src/watch/`](../../apps/mobile/src/watch/). Wrist aggregators: [`apps/api/src/modules/watch/`](../../apps/api/src/modules/watch/) (`GET /watch/worker/today`, `/admin/summary`, `/dealer/orders`). Mutations reuse existing task / QC / notification routes. Identity from `resolveAppSurface()`; Watch never has a login form. `ios/` stays generated / gitignored.

## Unified web

- Pages: [`apps/web/src/app/[locale]/`](../../apps/web/src/app/) — `admin/**`, `dealer/**`, `worker/**`, `(auth)/**`.
- REST client: [`apps/web/src/lib/api-client.ts`](../../apps/web/src/lib/api-client.ts) (same-origin `/api/v1` rewrite → API `:4000`, cookie auth + single-flight refresh).
- RTL: `getDirection(locale)` from `@maher/i18n` in `[locale]/layout.tsx`.
- Surface routing: `resolveWebHomePath()` → `/admin/dashboard` | `/dealer/dashboard` | `/worker/dashboard`.

## Jobs

- Dedicated consumer: [`apps/worker/src/main.ts`](../../apps/worker/src/main.ts) — emails, sms, whatsapp, pdf, ai, ocr, translation, reports, notifications, file-processing.
- `scheduling` queue is **in-process in the API**: [`apps/api/src/modules/scheduling/scheduling-queue.ts`](../../apps/api/src/modules/scheduling/scheduling-queue.ts). Worker does not consume it.

## Shared packages (who consumes)

- `@maher/types` — API, mobile, web, permissions, i18n, workflow-domain, notifications.
- `@maher/permissions` — API, mobile, web, database seed, notifications.
- `@maher/i18n` — mobile + unified web.
- `@maher/ui` — Next web only (not mobile).
- `@maher/workflow-domain` — mobile workflow editor, web labels, API production workflow.
- `@maher/validation` — declared on API; runtime DTOs use `class-validator`. Treat as unused until proven otherwise.

## Where to change

| Change | Go to |
|--------|--------|
| REST endpoint | `apps/api/src/modules/<domain>/` |
| Permission code | `packages/permissions/src/catalog.ts` + foundation seed |
| DB model | `packages/database/prisma/schema.prisma` |
| Demo scenario | `packages/database/prisma/demo/` |
| Mobile screen | `apps/mobile/src/features/<feature>/` + route in `apps/mobile/app/` |
| Apple Watch screen | `apps/mobile/targets/watch/` (SwiftUI). Do not port RN screens. |
| Watch identity / WCSession | `apps/mobile/src/watch/` + `apps/mobile/modules/maher-watch-bridge/` |
| Web page | `apps/web/src/app/[locale]/{admin,dealer,worker}/<route>/page.tsx` |
| Shared type | `packages/types/src/` |
| Workflow graph | `packages/workflow-domain/src/` + `apps/api/src/modules/production/workflow/` |
| Async job (non-scheduling) | `apps/worker/src/` |
| Scheduling job | `apps/api/src/modules/scheduling/scheduling-queue.ts` |
