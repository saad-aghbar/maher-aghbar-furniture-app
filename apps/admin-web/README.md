# Admin Web (`@maher/admin-web`)

Next.js 14 App Router website for Admin and Staff. Port **3000**. Locales `ar` / `en` / `he`.

This is **not** Mobile. Do not import `apps/mobile`. Talk to the API over HTTP only.

## What belongs here

| Path | Role |
|------|------|
| `src/app/[locale]/` | Routes. Keep `page.tsx` / `layout.tsx` here (App Router). Many pages are fat — that is current shape, not a bug. |
| `src/components/` | Shell + feature UI folders (`workflow/`, `scheduling/`, `catalog/`, `admin/`, `ai-chat/`) |
| `src/lib/api-client.ts` | Cookie `fetch` to `NEXT_PUBLIC_API_URL` + `/api/v1` |
| `src/hooks/` | `use-api-mutation`, `use-auth-me` |
| `src/i18n/` | next-intl wiring; catalogs live in `packages/i18n` |
| `src/providers/` | React Query, status labels |
| `public/` | Static brand images |
| `middleware.ts` | Locale prefix |

## Commands

```bash
pnpm --filter @maher/admin-web dev        # :3000
pnpm --filter @maher/admin-web typecheck
pnpm --filter @maher/admin-web test       # Vitest (4 files)
pnpm --filter @maher/admin-web build
```

Needs the API on `:4000`. Login: http://localhost:3000/ar/login (`admin` / `123`).

## Feature → route → extras

Routes are under `src/app/[locale]/`.

| Feature | Route | Extra UI / helpers |
|---------|-------|--------------------|
| Login / auth | `login/` | `src/components/login-form.tsx`, `src/lib/post-login.ts` |
| Home | `dashboard/` | `src/components/nav-items.ts` (RBAC via `@maher/permissions`) |
| Inventory | `inventory/` | `inventory/inventory-client.tsx` |
| Warehouses | `warehouses/` | |
| Products / BOM / production setup | `products/`, `products/[id]/` | `src/components/catalog/product-production-setup.tsx` |
| Catalog masters | `categories/`, `colors/`, `fabrics/`, `materials/`, `raw-materials/`, `units/` | `src/components/admin/master-crud-page.tsx` |
| Production orders | `production/`, `production/[id]/` | |
| Workflow builder | `production/workflow/`, `…/workflow/[id]/`, `…/workflow/stages/`, `production-stages/` | `src/components/workflow/`, `src/lib/workflow-*.ts` |
| Scheduling | `production/scheduling/` | `src/components/scheduling/`, `src/lib/scheduling*.ts` |
| Quality / rework | `quality/` | |
| Requests (RFQ) | `requests/` | |
| Quotations | `quotations/` | |
| Sales orders | `sales-orders/`, `orders/` | |
| Purchasing | `purchasing/`, `purchasing/requests/`, `purchasing/supplier-invoices/` | |
| Invoices / payments | `invoices/`, `payments/` | |
| Deliveries / returns | `deliveries/`, `returns/` | `src/components/delivery-location-map.tsx` |
| Dealers | `customers/` | `customers/[id]/dealer-sections.tsx` |
| Users / Staff Types | `users/`, `employees/`, `employees/staff-types/`, `roles/` | Permissions from `@maher/permissions` |
| Reports | `reports/` | |
| Settings / org | `settings/`, `departments/`, `suppliers/` | |
| Documents / contracts / audit | `documents/`, `contracts/`, `audit/` | |
| AI | `ai-intake/`, `ai-chat/` | `src/components/ai-chat/` |
| Notifications | `notifications/` | |

## Dependencies

`@maher/i18n`, `@maher/permissions`, `@maher/types`, `@maher/ui`. Alias `@/*` → `./src/*`.

## Business behavior

Inventory math, workflow, scheduling, and permissions are **not** implemented here. Change those in `apps/api` and `packages/permissions`.
