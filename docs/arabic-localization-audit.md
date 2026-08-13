# Arabic localization audit

**Date:** 2026-08-13  
**Source of truth:** local worktree  
**Catalog:** `packages/i18n/src/messages/{ar,en,he}/` — 15 namespaces

This audit was completed **before** terminology rewrites. Implementation follows [`arabic-terminology-glossary.md`](./arabic-terminology-glossary.md). Changes are logged in [`arabic-localization-changes.md`](./arabic-localization-changes.md).

## Catalog size

| Locale | Leaf keys |
|--------|-----------|
| en | 4,222 |
| ar | 4,223 |
| he | 4,223 |

Parity gap before this work: `mobile.catalog.priceLabel` present in ar/he, missing in en. No empty Arabic values. No TODO/TBD placeholders.

Namespaces: `common`, `auth`, `customers`, `quotations`, `sales`, `production`, `inventory`, `accounting`, `navigation`, `validation`, `users`, `statuses`, `catalog`, `mobile`, `errors`.

Default locale: **ar**. Web: next-intl (no cross-locale fallback). Mobile: locale → en → ar → raw key.

## Terminology conflicts (pre-fix)

| Concept | Arabic variants found |
|---------|----------------------|
| Dealer | التاجر، الوكيل/الوكلاء، البائع، العميل |
| Order | طلب، طلبات، طلبية، طلبيات، أمر بيع، الأمر |
| Workflow | سير عمل الإنتاج، مسار الإنتاج |
| Snapshot | لقطة الأمر |
| Dependencies | التبعيات |
| Runs after | يعمل بعد |
| Blocked | محظور (status) vs تعليق (production action) |
| At risk | قد يتأخر، معرض للخطر (seed notifications) |
| Employees nav | المستخدمون (wrong — should be الموظفون) |
| Foam | الفوم vs الإسفنج |
| Packaging | التعبئة vs التغليف |

## Poetic / machine-translated admin mobile copy

In `packages/i18n/src/messages/ar/mobile.json`:

- أختام حية
- الأرض هادئة / الأرض تتنفس بهدوء
- افتح مقعداً / اقرأ الورشة، ثم افتح مقعداً للعمل
- ضغط الوردية
- طاولات اليوم
- روبوت المحادثة
- {count} ساخن
- المنزل باب، لا تقرير

## Hardcoded user-visible strings (outside JSON)

| Location | Issue |
|----------|--------|
| `apps/api/src/common/helpers/pdf-i18n.ts` | Separate AR/EN/HE PDF dictionary (`العميل`, `أمر البيع`) |
| `packages/database/prisma/seed.ts` | Role `CUSTOMER` = عميل; notification `جدول إنتاج معرض للخطر` |
| `apps/mobile/src/api/queryClient.ts` | `You are offline` / `Something went wrong` / raw `error.message` |
| `apps/mobile/src/components/feedback/OfflineBanner.tsx` | English default |
| `apps/mobile/src/features/catalog/selectProductDetail.ts` | Hardcoded dimension labels (عرض/ارتفاع/عمق) |
| `apps/mobile/src/features/tasks/buildLocalizedStageInstructions.ts` | Hardcoded Arabic stage instructions |
| Catalog/returns/purchasing sheets | `label(key, 'English fallback')` |
| More/profile screens | `role.replace(/_/g, ' ')` → PRODUCTION WORKER |
| Customer portal statement page | English table headers |
| Employee portal task detail | `Work timer` / `Live` |
| `packages/ui` | English defaults if caller omits props |

## Backend errors

API returns English `message` + stable `code`. Frontends should map `code` → `errors.*`.

Missing from top-level `errors.json` (fall through to English): `SCHEDULE_STALE`, `WORKFLOW_*` (also nested under `production.workflow.errors`), `ORDER_WORKFLOW_LOCKED`, `AI_CHAT_DISABLED`, `AI_CHAT_RATE_LIMIT`, `TASK_TERMINAL`, `DATE_CHANGE_LOCKED`, `WORKER_OVERLAP`, `USERNAME_TAKEN`, `NO_PORTAL_USER`, `INVALID_PORTAL_CREDENTIALS`, `INVALID_URL`, `URL_FETCH_FAILED`, `EMPTY_FILE`, `FILE_TOO_LARGE`, `WORKFLOW_STAGE_IN_USE`, `CUSTOMER_REQUIRED`.

`WEAK_PASSWORD` Arabic currently says «كلمة المرور مطلوبة» (wrong meaning).

## Dynamic database names

`localizedName()` in `@maher/i18n`. Seed stages already use factory Arabic (النجارة، التنجيد، التغليف، تجهيز الإسفنج). Inspection seed is `الفحص`. Workflow seed name is `سير عمل الأثاث القياسي`.

**Do not** migrate live customized `nameAr`. Seed source only.

Hebrew `nameHe` is missing on many department/stage seeds — documented remaining issue, no schema change in this pass.

## Pluralization and numbers

No ICU plural forms. Counts use `{n}` + a singular noun. Dates/numbers: mobile forces Latin digits and en-GB calendar by design. Do not switch to Arabic-Indic digits.

## Out of scope

- User-entered notes, custom product descriptions
- Identifiers (SKU, order numbers, emails)
- Rewriting English or Hebrew wording except new keys for parity
- Rewriting Zod internals
- Sending `Accept-Language` on every REST call
- Unifying web vs mobile date formatters
- Destructive schema migrations
