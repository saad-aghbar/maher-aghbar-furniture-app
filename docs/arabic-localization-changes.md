# Arabic localization change report

Every material Arabic value change. Format:

```
KEY
OLD:
NEW:
REASON:
SURFACES:
```

Surfaces: Mobile Admin / Mobile Dealer / Mobile Worker / Admin Web / Customer Web / Employee Web / PDF / Seed / API errors.

---

## statuses

### statuses.BLOCKED
OLD: محظور  
NEW: متوقفة  
REASON: محظور reads as banned/forbidden. Factory meaning is a stage/order stopped by a problem.  
SURFACES: All status badges.

### statuses.AT_RISK
OLD: قد يتأخر  
NEW: معرّضة للتأخير  
REASON: Scheduling meaning; matches glossary.  
SURFACES: Scheduling, statuses.

### statuses.APPROVED
OLD: معتمد  
NEW: تمت الموافقة  
REASON: Align approval language (موافقة, not اعتماد) for status/result.  
SURFACES: All.

### statuses.REJECTED
OLD: مرفوض  
NEW: مرفوضة  
REASON: Most statuses attach to طلبية (feminine); keep root رفض.  
SURFACES: All.

### statuses.COMPLETED
OLD: مكتمل  
NEW: مكتملة  
REASON: Feminine agreement with طلبية/مهمة in most UI.  
SURFACES: All.

### statuses.CANCELLED
OLD: ملغى  
NEW: ملغاة  
REASON: Same gender agreement.  
SURFACES: All.

### statuses.READY
OLD: جاهز  
NEW: جاهزة للبدء  
REASON: Glossary: READY = جاهزة للبدء, not a vague جاهز.  
SURFACES: All.

### statuses.PENDING_APPROVAL
OLD: بانتظار الاعتماد  
NEW: بانتظار الموافقة  
REASON: Approval = موافقة.  
SURFACES: All.

### statuses.AWAITING_APPROVAL
OLD: بانتظار الاعتماد  
NEW: بانتظار الموافقة  
REASON: Same.  
SURFACES: Scheduling, statuses.

### statuses.READY_FOR_PACKAGING
OLD: جاهز للتعبئة  
NEW: جاهزة للتغليف  
REASON: Factory term is التغليف.  
SURFACES: Production.

### statuses.READY_FOR_DELIVERY
OLD: جاهز للتسليم  
NEW: جاهزة للتسليم  
REASON: Gender + glossary.  
SURFACES: Orders, production.

### statuses.HIGH / statuses.URGENT / statuses.LOW / statuses.NORMAL
OLD: مرتفع / عاجل / منخفض / عادي  
NEW: عالية / عاجلة / منخفضة / عادية  
REASON: Priority on مهمة/طلبية is feminine in this product.  
SURFACES: Tasks, orders.

### statuses.LEAD
OLD: عميل محتمل  
NEW: تاجر محتمل  
REASON: CRM lead is a dealer account, not an end customer.  
SURFACES: Admin dealers.

---

## Bulk catalog pass (shared + mobile)

488 Arabic values changed vs the previous HEAD across all 15 namespaces, then this wrap-up added dimension, floor-instruction, activity, and plural keys (en/ar/he parity kept).

| Namespace | Arabic values changed vs original HEAD | Notes |
|-----------|----------------------------------------|-------|
| statuses | 17 | BLOCKED=متوقفة, AT_RISK=معرّضة للتأخير, READY=جاهزة للبدء |
| navigation | 20 | التجار, الطلبيات, سير الإنتاج, الموظفون |
| customers | 45 | وكيل → تاجر throughout |
| production | 60 + new floorInstructions | سير الإنتاج, تبدأ بعد; floor copy moved out of TS |
| mobile | 181 + activity/plurals | Poetic admin copy gone; worker verbs; dealer shopping |
| errors | 53 | Missing API codes added in en/ar/he |
| catalog | 33 + dim* keys | رمز الموديل; dimension labels |
| accounting | 21 | تاجر, كشف الحساب |
| sales | 12 | طلبية |
| auth / common / users / validation / quotations / inventory | 47 | Glossary alignment |

Representative remaining KEY / OLD / NEW from this wrap-up:

### catalog.dimWidth
OLD: (hardcoded in selectProductDetail) العرض  
NEW: catalog.dimWidth = العرض  
REASON: Dimension labels belong in the catalog, not the selector.  
SURFACES: Mobile Dealer product details.

### production.floorInstructions.DELIVERY.l1
OLD: أكد العنوان والوقت وجهة الاتصال في أمر البيع.  
NEW: أكد العنوان والوقت وجهة الاتصال في الطلبية.  
REASON: Dealer-facing factory object is طلبية, not أمر البيع.  
SURFACES: Mobile Worker / Employee Web task detail.

### production.estHoursPlaceholder
OLD: Est h (hardcoded admin-web)  
NEW: ساعات تقديرية  
REASON: English chrome on Arabic production planning.  
SURFACES: Admin Web production order.

### mobile.adminHome.activityVerb.update
OLD: UPDATE / sales-order.hold shown as English enums  
NEW: تحديث / تعليق · طلبية  
REASON: Audit actions must not leak English snake_case.  
SURFACES: Mobile Admin home.

### mobile.dealerHome.dueInDaysOne / Two / Few / Many
OLD: يستحق خلال {n} يوم (singular for every count)  
NEW: يوم واحد / يومين / {n} أيام / {n} يوماً  
REASON: Arabic plural categories.  
SURFACES: Mobile Dealer home balance card.

### common.skipIntro
OLD: Skip intro (accessibilityLabel)  
NEW: تخطي المقدمة  
REASON: Login intro control must follow locale.  
SURFACES: Mobile login (all roles).

### common.retry (ErrorState / UiCopyProvider)
OLD: Try again / Retry English defaults  
NEW: إعادة المحاولة via common.retry  
REASON: Arabic path must not fall through to English chrome.  
SURFACES: Mobile + Admin/Customer/Employee Web.
