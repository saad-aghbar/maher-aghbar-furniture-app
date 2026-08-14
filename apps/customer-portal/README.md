# Customer portal (`@maher/customer-portal`)

Dealer-facing Next.js App Router site. Port **3001**.

Same shape as Admin Web (`src/app/[locale]/`, `src/lib/api-client.ts`, next-intl) but a smaller route set (catalog, orders, invoices, statement, …).

```bash
pnpm --filter @maher/customer-portal dev
```

Login: http://localhost:3001/ar/login (`nile` / `123` when that dealer exists).

Depends on `@maher/i18n`, `@maher/permissions`, `@maher/types`, `@maher/ui`. Must not import Mobile or `apps/api/src`.
