# Where do I change this?

Paths match the tree as of 2026-08-14. Prefer this page over searching Mobile when you are working on the website.

## Dependency rules

Allowed:

- Mobile → `@maher/types`, `@maher/permissions`, `@maher/i18n` → API over HTTP
- Admin Web / portals → those packages plus `@maher/ui` → API over HTTP
- API → `@maher/database`, `@maher/permissions`, `@maher/types`, `@maher/integrations`, `@maher/logging`
- Worker → `@maher/integrations`, `@maher/logging`
- Shared packages must not import `apps/` (exception: Prisma seed `dealer-orders-recent.ts` imports API scheduling/workflow — leave it)

Forbidden:

- Mobile importing Admin Web / portals / `apps/api/src`
- Admin Web importing Mobile or `apps/api/src`
- Any frontend importing another app’s internals
- API importing `@maher/ui` or any app UI
- `@maher/ui` imported from Mobile

Enforced by `pnpm check:boundaries` (Batch 5).

## Lookup

| I want to change… | Go here |
|-------------------|---------|
| Mobile Inventory UI | `apps/mobile/src/features/inventory/` and routes under `apps/mobile/app/(app)/(admin)/` |
| Website Inventory UI | `apps/admin-web/src/app/[locale]/inventory/` (`inventory-client.tsx`) |
| Inventory **business** behavior | `apps/api/src/modules/inventory/` |
| Warehouse records / types | API `apps/api/src/modules/warehouses/` · Web `apps/admin-web/src/app/[locale]/warehouses/` |
| Production **business** behavior | `apps/api/src/modules/production/` (includes `workflow/`) |
| Website Production UI | `apps/admin-web/src/app/[locale]/production/` |
| Mobile Production UI | `apps/mobile/src/features/production/` and `production-flow/` |
| Workflow snapshots / compiler | `apps/api/src/modules/production/workflow/` — do not casually move |
| Website Workflow builder | `apps/admin-web/src/app/[locale]/production/workflow/` + `src/components/workflow/` |
| Scheduling **engine** | `apps/api/src/modules/scheduling/` |
| Website Scheduling board | `apps/admin-web/src/app/[locale]/production/scheduling/` + `src/components/scheduling/` |
| Mobile Scheduling | `apps/mobile/src/features/scheduling/` |
| Permissions / Staff Types / `can()` | `packages/permissions/` — canonical. Web: `employees/staff-types`. Mobile: `src/features/users/` |
| Shared API TypeScript types | `packages/types/src/` |
| Prisma schema / models | `packages/database/prisma/schema.prisma` |
| Seeds | `packages/database/prisma/seed.ts` and `prisma/seed/` |
| Mobile translations | `packages/i18n/src/messages/{ar,en,he}/mobile.json` (and shared namespaces). Runtime: `apps/mobile/src/i18n/` |
| Web translations | `packages/i18n/src/messages/{ar,en,he}/*.json`. next-intl wiring: `apps/<portal>/src/i18n/` |
| Admin Web theme / shell | `apps/admin-web/src/components/` (`app-shell`, `sidebar`, `nav-items`) + `@maher/ui` |
| Mobile theme / touch bars | `apps/mobile/src/theme/`, `src/navigation/` — freeze unless a Mobile bug |
| Web HTTP client | `apps/admin-web/src/lib/api-client.ts` (copies exist on the other Next apps) |
| Mobile HTTP client | `apps/mobile/src/api/` |
| Auth (API) | `apps/api/src/modules/auth/` |
| Login UI (web) | `apps/admin-web/src/app/[locale]/login/` + `src/components/login-form.tsx` |
| Login UI (mobile) | `apps/mobile/app/(auth)/` + `src/features/auth/` |
| Dealers / customers | API `customers/` · Web `customers/` · Mobile `src/features/dealers/` |
| Orders / RFQs | API `requests`, `quotations`, `sales-orders` · matching folders under Admin Web `src/app/[locale]/` |
| Purchasing | API `purchasing`, `supplier-invoices` · Web `purchasing/` |
| Invoices / payments | API `invoices`, `payments` · Web `invoices/`, `payments/` |
| Deliveries / returns | API `deliveries` · Web `deliveries/`, `returns/` |
| Users / employees | API `users`, `roles` · Web `users/`, `employees/`, `roles/` |
| Factory UAT (88 assertions) | `pnpm smoke:factory-lifecycle` → `scripts/factory-lifecycle-uat.mjs` (API must be up; needs `nile` + `seed:factory-uat-only`) |
| Launch the websites | `pnpm launch` / `pnpm dev:admin` — see root README |
| Launch Mobile (simulator Expo Go 54) | `pnpm mobile:start` with API on `:4000` |
| Launch Mobile (physical iPhone development app) | `pnpm mobile:dev-client` after one-time `pnpm mobile:ios:device` — [mobile-iphone-dev-build.md](../mobile-iphone-dev-build.md) |
