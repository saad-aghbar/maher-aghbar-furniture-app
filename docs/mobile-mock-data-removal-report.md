# Mobile mock-data removal report

**Date:** 2026-08-13  
**Scope:** `apps/mobile` production runtime. `/dev` galleries and Jest fixtures remain isolated.

## Totals

| Item | Count |
|------|------:|
| Production screens stripped of fixture imports | 6 |
| `/dev` galleries now passing fixtures as props | 6 updated + 2 added |
| Dead files deleted | 4 (`demoConversation.ts`, `inventory/fixtures.ts`, `ModuleSoonScreen.tsx`, `PlaceholderTab.tsx`) |
| Production Metro `app/dev` block | 1 |
| Guard tests added | 5 assertions in `src/__tests__/no-production-fixture-imports.test.ts` |
| Mobile unit tests | **106 suites / 506 passed** |
| Lint | 0 errors (pre-existing warnings only) |
| `expo-doctor` | 18/18 passed |

## Per-item old → new source

| Screen / module | Old source | New production source |
|-----------------|------------|------------------------|
| `OrdersListScreen` | `fixture ?? adminOrdersFixture` / `dealerOrdersFixture` | Live `GET /sales-orders`. `forceState` uses optional `fixture` prop or `[]`. |
| `OrderDetailScreen` | `fixture ?? *DetailFixture` | Live `GET /sales-orders/:id`. `forceState` uses optional `fixture` only. |
| `CatalogScreen` | `fixtureProducts ?? catalogProductsFixture` (empty still kept default categories) | Live `GET /catalog/browse/*`. Empty/`forceState` without props → `[]`. |
| `ProductDetailScreen` | `catalogProductsFixture.find` / `[0]` | Live product query. Missing fixture → existing empty/error UI. |
| `TasksListScreen` | Always `openTasksFixture` / `completedTasksFixture` when `forceState` | Live `GET /tasks`. New optional `fixture` prop; otherwise empty. |
| `TaskDetailScreen` | `fixture ?? taskDetailFixture` | Live `GET /tasks/:id`. Missing record → EmptyState (not skeleton). |
| Admin / Dealer / Worker home | Already props-only | Unchanged. Production routes pass nothing. |
| Scheduling, production flow, inventory, invoices, notifications, AI intake | Already API | Unchanged. |
| AI chat | Live `/ai-chat` + helpers in `demoConversation.ts` | Same API. Helpers moved to `chatMessageFactories.ts`. No demo replies. OfflineBanner added. |
| `/dev/orders`, `order-detail`, `catalog`, `product-detail` | Relied on internal `?? fixture` fallbacks | Import fixtures and pass as props. |
| `/dev/tasks`, `/dev/task-detail` | Did not exist | New galleries for visual QA. |
| `demoConversation.ts` | Hardcoded SO/INV/dealer tables | Deleted. |
| `inventory/fixtures.ts` | Orphan, unused | Deleted. |
| `ModuleSoonScreen` / `PlaceholderTab` | Unused shells | Deleted. |

Production routes under `app/(app)/` never pass `forceState` or `fixture`.

## Empty / error / offline

Walked Admin home, Dealer home, Worker home, orders, catalog, tasks, scheduling, production flow, inventory, invoices, notifications, AI chat, AI intake.

Gaps filled (existing i18n only, no demo rows):

- Catalog `forceState === 'empty'` no longer keeps default fixture categories.
- Task detail with no record shows EmptyState (`mobile.tasks.detailErrorTitle` / `errorBody`) instead of an infinite skeleton.
- AI chat shows `OfflineBanner` (self-gated) and keeps existing error copy on boot/send failure.

All other listed surfaces already had loading / empty / error / offline.

## Verification

- `pnpm --filter @maher/mobile test` — 106 passed / 506 tests.
- `pnpm --filter @maher/mobile lint` — 0 errors.
- `pnpm run doctor` in `apps/mobile` — 18/18.
- Mobile typecheck not chased (pre-existing errors remain).
- Production Metro `blockList` (`NODE_ENV=production`): `app/dev/*.tsx` **BLOCK**; production screens **allow**.
- Production import crawl from `app/(app)` + `app/(auth)` (697 modules, `app/dev` excluded by blocklist): **zero** `fixtures.ts` / `detailFixtures.ts`; **zero** `ORD-1256` / `SO-1042` in reachable app source.

**Live smoke (empty account + one real record):** not run. No API/DB session was available in this pass. Empty UI with an empty database is the intended production behavior.

## Remaining grep matches (safe)

| Match | Where | Why safe |
|-------|-------|----------|
| `fixtures.ts` / `detailFixtures.ts` | Feature folders + `__tests__` + `app/dev` | Class D. Production screens do not import them. `/dev` is Metro-blocked in release. Guard test enforces this. |
| `ORD-1256` | `tasks/fixtures.ts` + `selectTask.test.ts` | Test/dev fixture only. Absent from production import graph. |
| `SO-1042` | `packages/i18n` `mobile.mixedSample` and unused `mobile.aiChat.demo.*` copy | Class C labels / bidi sample. Not business records. `mixedSample` is not referenced by mobile screens. Suggestion chips still use `mobile.aiChat.demo.*` keys as copy. |
| `ai: ['mock']` / `ocr: ['mock']` | `AdminSettingsScreen` | Backend provider enum, not fake orders. |
| `demoConversation` string | Guard test + audit doc | Pattern to forbid, not a runtime module. |
| React Query `placeholderData`, workflow `preview`, no-image assets | Various | Class C UI/config. |

## Architecture after this pass

```
Production screens → real API only (no fixture imports)
/dev galleries (__DEV__ + production Metro block) → fixtures as props → same screens
Jest → fixtures (unchanged)
```
