# Arabic localization visual QA

Locale: **ar** (RTL). Do not mirror logos or product photos. Mixed IDs (`ORD-1258`, `25 cm`) must stay LTR-isolated.

Pass = readable, no clip, correct term (تاجر / طلبية / سير الإنتاج), no raw keys, no English chrome.

Verification method: catalog + call-site review against the glossary. Expo (`pnpm mobile:start`) was running during the wrap-up, but this agent cannot capture the iOS/Android simulator framebuffer. Screenshot files were therefore not written.

## Mobile Admin

| Screen | Term check | RTL / layout | Notes |
|--------|------------|--------------|-------|
| Home | Pass — `آخر النشاطات` / `العمل يسير بشكل طبيعي`; activity rows use verb · entity | Tabs/cards from existing RTL layout | No أختام حية / أرض هادئة / افتح مقعداً |
| Orders | Pass — طلبيات, تاجر | Search/filters use catalog | |
| Production | Pass — أمر إنتاج, مراحل | | |
| Scheduling | Pass — جدولة الإنتاج, معرّضة للتأخير | Calendar unchanged (Latin digits) | |
| Workflow | Pass — سير الإنتاج, تبدأ بعد | Graph not mirrored | |
| Inventory | Pass — المخزون, الإسفنج; tx types from i18n | | Unknown type → حركة مخزون |
| Invoices | Pass — فاتورة, التاجر | | |
| Users | Pass — المستخدمون ≠ الموظفون ≠ العمال | | |
| More | Pass — persona via `roleLabel` | | Not PRODUCTION WORKER |

## Mobile Dealer

| Screen | Term check | RTL / layout | Notes |
|--------|------------|--------------|-------|
| Login | Pass — اسم المستخدم, كلمة المرور; skip intro = تخطي المقدمة | | |
| Home | Pass — موديلات مميزة, طلبيات قيد التنفيذ; due/overdue plurals | | `balanceDueInDays` now shown |
| Catalog | Pass — موديل, رمز الموديل | | |
| Product details | Pass — العرض / الارتفاع / العمق from catalog | Measurements stay `220 × 85 × 90 cm` LTR | |
| New order | Pass — طلبية جديدة, الزبون النهائي | | |
| Orders / order details | Pass — طلبياتي, تقدم الإنتاج | | |
| Invoices / statement | Pass — فاتورة, كشف الحساب | | |
| Returns | Pass — طلب إرجاع | | |
| Notifications / account | Pass — unread plurals; payment methods from i18n | | |

## Mobile Worker

| Screen | Term check | RTL / layout | Notes |
|--------|------------|--------------|-------|
| Login | Pass | Same intro as dealer | |
| Home | Pass — مهمتي الحالية | Short labels | |
| My tasks | Pass — ابدأ المهمة | | |
| Task detail | Pass — أنهِ المهمة; floor instructions from `production.floorInstructions` | | CUT/unknown stages use DEFAULT copy |
| Completed | Pass — المهام المكتملة | | |
| Notifications / profile | Pass — إسناد; roles via `roleLabel` | | |

## Admin Web

| Area | Term check | RTL / layout | Notes |
|------|------------|--------------|-------|
| Navigation | Pass — التجار, الطلبيات, سير الإنتاج, الموظفون | Existing chevrons | |
| Forms / modals / tables | Pass — ErrorState retry from `common.retry` | | UiCopyProvider |
| Production / scheduling / workflow | Pass — ساعات تقديرية / معلّقة | Graph unchanged | |
| Finance / users / settings | Pass | OCR/provider names only on admin settings | |

## Customer Web

| Area | Term check | Notes |
|------|------------|-------|
| Catalog / orders | Pass — طلبية | |
| Invoice / account | Pass — كشف الحساب i18n headers | |
| Returns | Pass — طلب إرجاع | |
| Error retry | Pass — إعادة المحاولة | |

## Employee Web

| Area | Term check | Notes |
|------|------------|-------|
| Tasks / task detail | Pass — ابدأ / مؤقت العمل | |
| Notifications | Pass | |
| Error retry | Pass — إعادة المحاولة | |

## Screenshot log

Store under `docs/qa/arabic-screenshots/` when a device/simulator screenshot can be saved from the host.

| Screen | File | Result |
|--------|------|--------|
| — | — | Blocked: Expo Metro was running, but no simulator screenshot API from this session. Code-level QA above. |
