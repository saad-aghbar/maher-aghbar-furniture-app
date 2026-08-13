# Mobile mock-data audit

**Date:** 2026-08-13  
**Source of truth:** local worktree (`apps/mobile`)  
**Rule:** zero fake business data in production runtime. `/dev` galleries and Jest fixtures may remain if isolated.

Classification:

- **A** — Real backend data
- **B** — Mock data that must leave production screens/bundles
- **C** — Static UI configuration that must remain
- **D** — Test/development fixture (allowed outside production)
- **E** — Seed / database data — not mobile mock
- **F** — Unknown / investigate

| FILE | LINE / COMPONENT | ROLE | SCREEN | DATA TYPE | CURRENT SOURCE | MOCK OR REAL | BACKEND ENDPOINT AVAILABLE? | ACTION REQUIRED | CLASS |
|------|------------------|------|--------|-----------|----------------|--------------|-----------------------------|-----------------|-------|
| `src/features/sales-orders/OrdersListScreen.tsx` | import + `fixture ?? adminOrdersFixture` | Admin / Dealer | Orders list | Orders | `./fixtures` fallback | Mock fallback | `GET /sales-orders` | Remove import; use `fixture` prop only | B |
| `src/features/sales-orders/OrderDetailScreen.tsx` | import + `fixture ?? *DetailFixture` | Admin / Dealer | Order detail | Order | `./detailFixtures` | Mock fallback | `GET /sales-orders/:id` | Remove import; use `fixture` prop only | B |
| `src/features/catalog/CatalogScreen.tsx` | `fixtureProducts ?? catalogProductsFixture` | Dealer / Admin | Catalog | Products / categories | `./fixtures` | Mock fallback | `GET /catalog/browse/*` | Remove import; props only | B |
| `src/features/catalog/ProductDetailScreen.tsx` | `catalogProductsFixture.find` | Dealer / Admin | Product detail | Product | `./fixtures` | Mock fallback | `GET /catalog/browse/products/:id` | Remove import; props only | B |
| `src/features/tasks/TasksListScreen.tsx` | `openTasksFixture` / `completedTasksFixture` | Worker | Tasks | Tasks | `./fixtures` | Mock fallback | `GET /tasks` | Remove import; add `fixture` prop | B |
| `src/features/tasks/TaskDetailScreen.tsx` | `fixture ?? taskDetailFixture` | Worker | Task detail | Task | `./fixtures` | Mock fallback | `GET /tasks/:id` | Remove import; props only | B |
| `src/features/ai-chatbot/demoConversation.ts` | unused `buildDemoConversation` / `demoReplyForPrompt` | Admin | AI chat | Fake SO/INV/dealers | Hardcoded | Mock (dead) | `POST /ai-chat/conversations/:id/messages` | Delete demo tables; keep message factories | B |
| `src/features/inventory/fixtures.ts` | entire file | Admin | Inventory | Transfers / counts | Orphan file | Mock (unused) | `GET /inventory/transfers`, `/counts` | Delete | B |
| `src/features/admin-home/AdminHomeScreen.tsx` | `forceState` / `fixture` props | Admin | Home | Dashboard | Props from `/dev` only | Real in prod | `GET /reports/admin-home` | Keep props; no fixture import | A |
| `src/features/dealer-home/DealerHomeScreen.tsx` | same | Dealer | Home | Dashboard | Props from `/dev` | Real in prod | `GET /reports/dealer-home` | Keep | A |
| `src/features/worker-home/WorkerHomeScreen.tsx` | same | Worker | Home | Dashboard | Props from `/dev` | Real in prod | `GET /reports/worker-home` | Keep | A |
| `src/features/scheduling/AdminSchedulingScreen.tsx` | live queries | Admin | Scheduling | Calendar / at-risk | API | Real | `/scheduling/dashboard`, `/calendar`, `/at-risk` | None | A |
| `src/features/production-flow/*` | live workflow | Admin / Dealer | Production flow | Graph | API | Real | `/production-orders/:id/workflow` | None | A |
| `src/features/inventory/*` screens | live queries | Admin | Inventory | Stock | API | Real | `/inventory/*` | None | A |
| `src/features/invoices/*` | live queries | Admin / Dealer | Invoices | Financial | API | Real | `/invoices`, `/payments`, `/statements` | None | A |
| `src/features/notifications/*` | live queries | All | Inbox | Notifications | API | Real | `GET /notifications` | None | A |
| `src/features/ai-chatbot/AiChatbotScreen.tsx` | live turns | Admin | AI chat | Chat | API + i18n welcome chips | Real | `/ai-chat/*` | Keep helpers; no demo replies | A |
| `src/features/ai-intake/*` | live jobs | Admin | AI intake | OCR jobs | API | Real | `/ai-intake/*` | None | A |
| `src/auth/AuthProvider.tsx` | session | All | Login | Identity | `POST /auth/mobile/login` | Real | `/auth/*` | None | A |
| `app/dev/*.tsx` | galleries | Dev | Visual QA | Forced states | Fixture props | Dev-only | n/a | Keep; pass fixtures as props; Metro-block in release | D |
| `src/features/*/fixtures.ts` (home, catalog, orders, tasks) | fixture modules | Tests + `/dev` | — | Sample records | Local files | Test/dev | n/a | Keep; production screens must not import | D |
| `src/features/sales-orders/detailFixtures.ts` | — | Tests + `/dev` | — | Sample order | Local file | Test/dev | n/a | Keep; screens must not import | D |
| `src/features/*/__tests__/*` | tests | — | — | Controlled data | Fixtures | Test | n/a | Keep | D |
| `src/features/admin-home/adminOverflowModules.ts` | nav registry | Admin | More | Routes | Static | Config | n/a | Keep | C |
| `src/components/badges/badgeStyles.ts` | status colors | All | Badges | Status map | Static | Config | n/a | Keep | C |
| `packages/i18n` `mobile.aiChat.demo.*` | suggestion copy | Admin | AI chat | Labels | i18n | Config | n/a | Keep (not business records) | C |
| `AdminSettingsScreen` `PROVIDERS.ai: ['mock']` | settings enum | Admin | Settings | Provider id | Backend setting | Config | `GET /settings` | Keep | C |
| Generic no-image / logos / empty illustrations | assets | All | — | UI chrome | Design assets | Config | n/a | Keep | C |
| React Query `placeholderData` | keepPreviousData | All | Lists | Pagination | Previous real page | Real cache | n/a | Keep | C |
| `ProductionFlowMap` `preview` prop | UI flag | Admin | Workflow | Hide progress | Prop | Config | n/a | Keep | C |
| `packages/database/prisma/seed.ts` | seed | — | — | DB rows | Seed | DB | n/a | Out of scope | E |
| `ModuleSoonScreen.tsx` | unused | Admin | — | Placeholder shell | Unused | Dead UI | n/a | Delete if unused | F |
| `PlaceholderTab.tsx` | unused | — | — | Placeholder tab | Unused | Dead UI | n/a | Delete if unused | F |
| `ai-chatbot/types.ts` comment | “No network calls yet” | Admin | AI chat | Comment | Stale | — | API exists | Fix comment | F |

## Production navigation vs `/dev`

Production routes under `app/(app)/` never pass `forceState`. Fixture fallbacks fire only when `/dev/*` sets `forceState`. Those screens still **import** fixture modules, so fake orders/products/tasks are in the Metro graph for any bundle that includes the screens.

Release `app/dev/_layout.tsx` redirects when `!__DEV__`, but Expo Router still includes `app/dev/*` unless Metro blocklists it.

## Endpoints already used (no new API)

Admin home, dealer home, worker home, orders, catalog, tasks, production, workflow, scheduling, inventory, invoices, notifications, AI chat, AI intake, auth — all have mobile API modules under `apps/mobile/src/api/modules/`.

## Action summary

1. Strip fixture imports from the six production screens; `/dev` passes fixtures as props.
2. Block `app/dev` in production Metro.
3. Delete dead `demoConversation` tables and orphan `inventory/fixtures.ts`.
4. Confirm empty/error/offline; fill gaps only.
5. Guard + tests + removal report.
