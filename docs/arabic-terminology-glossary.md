# Arabic terminology glossary

Canonical Arabic for **Maher Al-Aghbar & Sons Furniture ERP**.

Style: clear Modern Standard Arabic with natural Palestinian factory/business phrasing. Professional, simple, direct. Not slang. Not literal English. Not academic.

Use this table everywhere: mobile, web, PDF labels, seed templates, notifications. Do not invent a second word for the same concept.

## People and accounts

| English | Canonical Arabic | Never use (for this meaning) | Notes |
|---------|------------------|------------------------------|-------|
| Dealer (showroom account) | التاجر / التجار | الوكيل، العميل، البائع، الموزّع | The business customer of the factory |
| End customer of the dealer | زبون التاجر / الزبون النهائي | التاجر، العميل (when the screen is the dealer account) | Use الزبون النهائي on forms |
| User (login entity) | المستخدم / المستخدمون | الموظف، العامل | Access/account |
| Employee (HR/org record) | الموظف / الموظفون | المستخدم، العامل | Admin/office staff |
| Worker (production floor) | العامل / العمال | الموظف، المستخدم | Floor labor |
| Supplier | المورّد / المورّدون | — | Purchasing |
| Department | قسم / الأقسام | — | |

## Orders and production

| English | Canonical Arabic | Never use | Notes |
|---------|------------------|-----------|-------|
| Dealer-facing order | طلبية / طلبيات | طلب (when it is a furniture order), أمر بيع (dealer UI) | Factory object stays أمر إنتاج |
| Production order | أمر إنتاج / أوامر الإنتاج | طلبية إنتاج (unless a screen truly means that) | Internal factory object |
| Production | الإنتاج | التصنيع (prefer الإنتاج in ops UI) | |
| Production stage | مرحلة إنتاج | — | Dynamic names from DB `nameAr` |
| Workflow | سير الإنتاج | سير عمل الإنتاج، مسار الإنتاج، التبعيات | |
| Workflow builder | إعداد سير الإنتاج | — | |
| Stage library | مراحل الإنتاج | مكتبة المراحل (too abstract) | |
| Snapshot | نسخة سير الإنتاج للطلبية | لقطة | |
| Dependencies | المراحل التي يجب أن تكتمل أولاً | التبعيات | |
| Runs after | تبدأ بعد | يعمل بعد | |
| Parallel stages | مراحل تعمل بالتوازي | — | |
| Required / optional / excluded stage | إلزامية / اختيارية / غير مستخدمة | مستبعد | |
| Production floor | أرضية الإنتاج / قسم الإنتاج | الأرض (poetic) | Match the current screen |
| Task | مهمة | — | |
| Worker assignment | إسناد العامل | تعيين (when it means assigning a worker) | |
| Allocation (schedule) | حجز وقت / توزيع على الجدول | التخصيصات (generic) | Context: scheduling |

## Scheduling

| English | Canonical Arabic | Never use |
|---------|------------------|-----------|
| Scheduling | جدولة الإنتاج | لوحة الشهر |
| Month board | جدول الشهر / خطة الشهر | لوحة الشهر |
| At risk | معرّضة للتأخير | في خطر، معرض للخطر |
| Awaiting approval | بانتظار الموافقة | بانتظار الاعتماد (status/action: موافقة) |
| Conflicts | تعارضات الجدولة | — |
| Capacity | الطاقة الإنتاجية | الطاقة الاستيعابية (unless space, not labor) |
| Busy / light / half / closed | ضغط مرتفع / خفيف / متوسط / مغلق | — |
| Earliest / requested / suggested / confirmed delivery | أقرب موعد متاح / موعد التسليم المطلوب / المقترح / المؤكد | — |
| Recalculate / approve / move schedule | إعادة حساب الجدول / اعتماد الجدول / تعديل الموعد | — |
| On track / late | ضمن الجدول / متأخرة | — |

## Inventory and purchasing

| English | Canonical Arabic | Never use |
|---------|------------------|-----------|
| Inventory | المخزون | — |
| Materials / raw materials | المواد / المواد الخام | — |
| Fabric / foam / wood / accessories | الأقمشة / الإسفنج / الأخشاب / الإكسسوارات | الفوم (use الإسفنج) |
| Low / out / in stock | مخزون منخفض / نفد المخزون / متوفر | — |
| Adjustment / stock history | تعديل مخزون / سجل حركة المخزون | — |
| Warehouse | المستودع | Only in inventory/admin. Never in dealer copy |
| Purchasing | المشتريات | — |
| Purchase order | أمر شراء | — |
| Receiving / expected arrival | الاستلام / موعد الوصول المتوقع | — |

## Finance, returns, catalog

| English | Canonical Arabic | Never use |
|---------|------------------|-----------|
| Invoice / invoices | فاتورة / الفواتير | — |
| Payment / payments | دفعة / الدفعات | المدفوعات is acceptable in nav |
| Account statement | كشف الحساب | — |
| Outstanding / amount due | الرصيد المستحق / المبلغ المستحق | — |
| Paid / unpaid / overdue | مدفوعة / غير مدفوعة / متأخرة | — |
| Cash / cheque / bank transfer | نقداً / شيك / تحويل بنكي | — |
| Billing & collections | الفواتير والتحصيل | — |
| Returns / return request | المرتجعات / طلب إرجاع | — |
| Restock | إعادة للمخزون | — |
| Product / model / model code | منتج / موديل / رمز الموديل | SKU in dealer-facing Arabic |
| Catalog | الكتالوج | — |

## Statuses (one phrase per code)

Gender/number may flex by noun (طلبية مؤنث، أمر مذكر) but the **root must not change** across screens.

| Code | Canonical Arabic |
|------|------------------|
| DRAFT | مسودة |
| PENDING | قيد الانتظار |
| READY | جاهزة للبدء |
| IN_PROGRESS | قيد التنفيذ |
| COMPLETED | مكتملة |
| SKIPPED | تم تجاوزها |
| BLOCKED | متوقفة |
| CANCELLED | ملغاة |
| APPROVED | تمت الموافقة |
| REJECTED | مرفوضة |
| OVERDUE | متأخرة |
| AT_RISK | معرّضة للتأخير |
| AWAITING_APPROVAL / PENDING_APPROVAL | بانتظار الموافقة |
| PENDING_REVIEW | بانتظار المراجعة |

Priority: عاجلة / عالية / عادية / منخفضة.

## Approval language

| English | Arabic |
|---------|--------|
| Approval | موافقة |
| Approve (button) | موافقة |
| Approved (status/result) | تمت الموافقة |
| Rejected | مرفوض / مرفوضة |
| Publish workflow | اعتماد سير الإنتاج |
| Approve schedule | اعتماد الجدول |

## Buttons, empty, loading

Save حفظ · Cancel إلغاء · Edit تعديل · Delete حذف · Confirm تأكيد · View تفاصيل عرض التفاصيل · Continue متابعة · Back رجوع · Done تم · Add إضافة · Remove إزالة · Retry إعادة المحاولة · Apply تطبيق · Reset إعادة ضبط.

Empty: `لا توجد طلبيات حالياً` — not robotic.

Loading: `جاري التحميل…` — no English provider names.

## Notes

| Kind | Arabic |
|------|--------|
| Notes | ملاحظات |
| Internal notes | ملاحظات داخلية |
| Dealer notes | ملاحظات التاجر |
| Worker notes | ملاحظات العامل |

## Identifiers (never translate)

SKU, model code, order number, PO number, invoice number, user ID, serials, phones, emails, URLs, API codes. Isolate LTR in RTL layouts.
