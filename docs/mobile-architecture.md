# Mobile architecture

## Overview

One Expo React Native app (`apps/mobile` / `@maher/mobile`) serves every ERP role. After login, the NestJS API returns `AuthUser` with **effective permissions**. The shell builds adaptive tabs and menus from those permissions.

```
Mobile App → NestJS /api/v1 → PostgreSQL / Redis / Worker
```

No direct DB or Redis access from the device.

## Layers

| Layer | Responsibility |
|-------|----------------|
| `app/(auth)` | Branded login |
| `app/(app)/(tabs)` | Home (persona dashboard), Workspace, Notifications, More |
| `app/(app)/*` | Feature stacks: tasks, deliveries, quotations, orders, invoices, inventory, quality, purchasing, production, customers, reports |
| `src/ui` | Shared design system (Card, Button, ListRow, MetricCard, StatusBadge, Screen, …) |
| `src/features` | Persona home metrics/focus lists + shared ListScreen |
| `src/api` | Fetch client, Bearer auth, refresh, multipart upload |
| `src/permissions` | `can` / workspace link table / home persona |
| `src/storage` | SecureStore tokens |
| `src/theme` | Brand tokens, status→tone mapping, shadows |
| `src/providers` | Query, i18n (AR/EN/HE + RTL), auth |

After login every role lands on `/(app)` — the home tab adapts KPIs and the “what’s next” list from the user’s persona and permissions. The Workspace tab lists every module they may open.

## Shared packages

- `@maher/types`, `@maher/permissions`, `@maher/validation`, `@maher/i18n` — reused
- `@maher/ui` — **not** imported (DOM)

## Auth

See [mobile-authentication.md](./mobile-authentication.md). Web keeps cookies; mobile uses `client: 'mobile'` for token body + SecureStore.

## Backend authority

Pricing, taxes, stock, workflow transitions, file access, and RBAC remain server-side. The app may hide UI it cannot use; the API still rejects unauthorized calls.
