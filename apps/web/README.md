# Unified Web (`@maher/web`)

Next.js 14 App Router for admin, dealer, worker, and staff. Port **3000**. Locales `ar` / `en` / `he`.

This is **not** Mobile. Do not import `apps/mobile`. Talk to the API over HTTP only.

## Surfaces

| Path | Surface |
|------|---------|
| `/[locale]/login` | Shared login |
| `/[locale]/admin/**` | Admin / staff |
| `/[locale]/dealer/**` | Dealer |
| `/[locale]/worker/**` | Worker |

Legacy admin paths (`/en/orders`) 308-redirect to `/en/admin/orders`.

## Commands

```bash
pnpm --filter @maher/web dev        # :3000
pnpm --filter @maher/web typecheck
pnpm --filter @maher/web test
pnpm --filter @maher/web build
```

Needs the API on `:4000`. Login: http://localhost:3000/ar/login (`admin` / `123`).
