# Employee portal (`@maher/employee-portal`)

Worker-facing Next.js App Router site. Port **3002**. Dashboard, tasks, profile.

```bash
pnpm --filter @maher/employee-portal dev
```

Login: http://localhost:3002/ar/login (create a Worker in Admin if the launch seed has none).

Depends on `@maher/i18n`, `@maher/permissions`, `@maher/types`, `@maher/ui`. Has its own `@/lib/scheduling` helpers — not imported from Admin Web. Must not import Mobile or `apps/api/src`.
