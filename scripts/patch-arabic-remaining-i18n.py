#!/usr/bin/env python3
"""Insert remaining i18n keys for the Arabic localization wrap-up. Idempotent."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "packages/i18n/src/messages"


def load(locale: str, ns: str) -> dict:
    return json.loads((ROOT / locale / f"{ns}.json").read_text())


def save(locale: str, ns: str, data: dict) -> None:
    path = ROOT / locale / f"{ns}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def insert_after(obj: dict, after_key: str, new_items: dict) -> dict:
    out = {}
    for k, v in obj.items():
        out[k] = v
        if k == after_key:
            for nk, nv in new_items.items():
                if nk not in out:
                    out[nk] = nv
    for nk, nv in new_items.items():
        if nk not in out:
            out[nk] = nv
    return out


FLOOR = {
    "en": {
        "specs": "Specs: {specs}",
        "heading": "{stage} for: {productLine}.",
        "MATERIAL_PREP": {
            "heading": "Prepare materials for: {productLine}.",
            "l1": "Pull fabric, wood, foam, and hardware per the bill of materials.",
            "l2": "Label kits for carpentry, painting, and upholstery.",
            "l3": "Flag shortages to purchasing before releasing the kit.",
        },
        "CARPENTRY": {
            "heading": "Carpentry for: {productLine}.",
            "l1": "Cut and assemble frames to drawing dimensions.",
            "l2": "Sand all visible surfaces; check joints and squareness.",
            "l3": "Stage completed frames for painting / upholstery.",
        },
        "PAINTING": {
            "heading": "Finishing / paint for: {productLine}.",
            "l1": "Apply primer and finish coats per color reference.",
            "l2": "Allow full cure time before handing off to assembly.",
            "l3": "Protect finished surfaces for transport to next stage.",
        },
        "UPHOLSTERY": {
            "heading": "Upholstery for: {productLine}.",
            "l1": "Cut fabric to pattern; match grain and color batch.",
            "l2": "Foam and cover to the approved sample.",
            "l3": "Inspect seams and staples before assembly handoff.",
        },
        "ASSEMBLY": {
            "heading": "Assemble: {productLine}.",
            "l1": "Join carpentry, paint, and upholstery components.",
            "l2": "Fit hardware and verify dimensions against the order.",
            "l3": "Move complete unit to inspection with paperwork.",
        },
        "INSPECTION": {
            "heading": "Quality inspection for: {productLine}.",
            "l1": "Run the stage checklist; photograph defects if any.",
            "l2": "Pass only if dimensions, finish, and fabric match the order.",
            "l3": "Fail with clear rework notes for the owning stage.",
        },
        "PACKAGING": {
            "heading": "Package: {productLine}.",
            "l1": "Wrap and crate for safe transport; add corner protection.",
            "l2": "Attach packing list and factory order label.",
            "l3": "Stage for delivery only after QC pass.",
        },
        "DELIVERY": {
            "heading": "Deliver: {productLine}.",
            "l1": "Confirm address, window, and contact on the sales order.",
            "l2": "Collect POD signature / photo on delivery.",
            "l3": "Report any transit damage immediately.",
        },
        "DEFAULT": {
            "l1": "Follow the shop drawing and order specifications.",
            "l2": "Update task progress and attach required photos before complete.",
        },
    },
    "ar": {
        "specs": "المواصفات: {specs}",
        "heading": "{stage} لـ: {productLine}.",
        "MATERIAL_PREP": {
            "heading": "تجهيز المواد لـ: {productLine}.",
            "l1": "اسحب القماش والخشب والإسفنج والملحقات حسب قائمة المواد.",
            "l2": "ضع ملصقات على المجموعات للنجارة والطلاء والتنجيد.",
            "l3": "أبلغ المشتريات بأي نقص قبل إطلاق المجموعة.",
        },
        "CARPENTRY": {
            "heading": "نجارة لـ: {productLine}.",
            "l1": "قصّ وركّب الإطارات حسب أبعاد الرسم.",
            "l2": "صنفر كل الأسطح الظاهرة؛ تحقق من الوصلات والاستقامة.",
            "l3": "جهّز الإطارات المكتملة للطلاء / التنجيد.",
        },
        "PAINTING": {
            "heading": "تشطيب / طلاء لـ: {productLine}.",
            "l1": "طبّق الطبقة التأسيسية وطبقات التشطيب حسب مرجع اللون.",
            "l2": "اترك وقت الجفاف الكامل قبل التسليم للتجميع.",
            "l3": "احمِ الأسطح النهائية أثناء النقل للمرحلة التالية.",
        },
        "UPHOLSTERY": {
            "heading": "تنجيد لـ: {productLine}.",
            "l1": "قص القماش حسب النمط؛ طابق الاتجاه ودفعة اللون.",
            "l2": "ركّب الإسفنج والغطاء حسب العينة المعتمدة.",
            "l3": "افحص الدرزات والدبابيس قبل تسليم التجميع.",
        },
        "ASSEMBLY": {
            "heading": "تجميع: {productLine}.",
            "l1": "اجمع أجزاء النجارة والطلاء والتنجيد.",
            "l2": "ركّب الملحقات وتحقق من الأبعاد مقابل الطلبية.",
            "l3": "انقل الوحدة المكتملة للفحص مع الأوراق.",
        },
        "INSPECTION": {
            "heading": "فحص جودة لـ: {productLine}.",
            "l1": "نفّذ قائمة فحص المرحلة؛ صوّر العيوب إن وُجدت.",
            "l2": "اقبل فقط إذا طابقت الأبعاد والتشطيب والقماش الطلبية.",
            "l3": "ارفض مع ملاحظات إعادة عمل واضحة للمرحلة المسؤولة.",
        },
        "PACKAGING": {
            "heading": "تغليف: {productLine}.",
            "l1": "غلّف وصنّد للنقل الآمن؛ أضف حماية للزوايا.",
            "l2": "أرفق قائمة التعبئة وملصق أمر المصنع.",
            "l3": "جهّز للتسليم فقط بعد اجتياز فحص الجودة.",
        },
        "DELIVERY": {
            "heading": "تسليم: {productLine}.",
            "l1": "أكد العنوان والوقت وجهة الاتصال في الطلبية.",
            "l2": "اجمع توقيع / صورة إثبات التسليم.",
            "l3": "أبلغ فورًا عن أي ضرر أثناء النقل.",
        },
        "DEFAULT": {
            "l1": "اتبع رسم الورشة ومواصفات الطلبية.",
            "l2": "حدّث تقدم المهمة وأرفق الصور المطلوبة قبل الإنهاء.",
        },
    },
    "he": {
        "specs": "מפרט: {specs}",
        "heading": "{stage} עבור: {productLine}.",
        "MATERIAL_PREP": {
            "heading": "הכנת חומרים עבור: {productLine}.",
            "l1": "משכו בד, עץ, ספוג וחומרה לפי רשימת החומרים.",
            "l2": "סמנו ערכות לנגרות, צביעה וריפוד.",
            "l3": "דווחו על חוסרים לרכש לפני שחרור הערכה.",
        },
        "CARPENTRY": {
            "heading": "נגרות עבור: {productLine}.",
            "l1": "חתכו והרכיבו מסגרות לפי מידות השרטוט.",
            "l2": "שייפו משטחים גלויים; בדקו חיבורים וישרות.",
            "l3": "העבירו מסגרות מוכנות לצביעה / ריפוד.",
        },
        "PAINTING": {
            "heading": "גימור / צביעה עבור: {productLine}.",
            "l1": "מרחו פריימר ושכבות גימור לפי דגימת הצבע.",
            "l2": "המתינו לייבוש מלא לפני מסירה להרכבה.",
            "l3": "הגנו על משטחים מוגמרים בהעברה לשלב הבא.",
        },
        "UPHOLSTERY": {
            "heading": "ריפוד עבור: {productLine}.",
            "l1": "חתכו בד לפי התבנית; התאימו כיוון ואצוות צבע.",
            "l2": "ספוג וכיסוי לפי הדגימה המאושרת.",
            "l3": "בדקו תפרים וסיכות לפני מסירה להרכבה.",
        },
        "ASSEMBLY": {
            "heading": "הרכבה: {productLine}.",
            "l1": "חברו חלקי נגרות, צבע וריפוד.",
            "l2": "התקינו חומרה ואמתו מידות מול ההזמנה.",
            "l3": "העבירו יחידה מושלמת לבדיקה עם מסמכים.",
        },
        "INSPECTION": {
            "heading": "בקרת איכות עבור: {productLine}.",
            "l1": "הריצו את רשימת השלב; צלמו פגמים אם יש.",
            "l2": "אשרו רק אם מידות, גימור ובד תואמים להזמנה.",
            "l3": "דחו עם הערות תיקון ברורות לשלב האחראי.",
        },
        "PACKAGING": {
            "heading": "אריזה: {productLine}.",
            "l1": "עטפו וארזו להובלה בטוחה; הוסיפו הגנת פינות.",
            "l2": "צרפו רשימת אריזה ותווית הזמנת מפעל.",
            "l3": "הכינו למשלוח רק לאחר מעבר בדיקת איכות.",
        },
        "DELIVERY": {
            "heading": "משלוח: {productLine}.",
            "l1": "אמתו כתובת, חלון זמן ואיש קשר בהזמנה.",
            "l2": "אספו חתימת / תמונת מסירה.",
            "l3": "דווחו מיד על נזק בהובלה.",
        },
        "DEFAULT": {
            "l1": "פעלו לפי שרטוט הסדנה ומפרט ההזמנה.",
            "l2": "עדכנו התקדמות והעלו תמונות נדרשות לפני סיום.",
        },
    },
}

CATALOG_DIMS = {
    "en": {
        "dimWidth": "Width",
        "dimHeight": "Height",
        "dimDepth": "Depth",
        "dimSeatHeight": "Seat height",
        "emptyValue": "—",
        "dimensionSummarySeat": "Seat {n} cm",
    },
    "ar": {
        "dimWidth": "العرض",
        "dimHeight": "الارتفاع",
        "dimDepth": "العمق",
        "dimSeatHeight": "ارتفاع المقعد",
        "emptyValue": "—",
        "dimensionSummarySeat": "ارتفاع المقعد {n} سم",
    },
    "he": {
        "dimWidth": "רוחב",
        "dimHeight": "גובה",
        "dimDepth": "עומק",
        "dimSeatHeight": "גובה מושב",
        "emptyValue": "—",
        "dimensionSummarySeat": "מושב {n} ס״מ",
    },
}

COMMON_EXTRA = {
    "en": {"skipIntro": "Skip intro", "unknown": "Unknown"},
    "ar": {"skipIntro": "تخطي المقدمة", "unknown": "غير معروف"},
    "he": {"skipIntro": "דלג על הפתיח", "unknown": "לא ידוע"},
}

PROD_EXTRA = {
    "en": {
        "estHoursPlaceholder": "Est h",
        "estMinutesPlaceholder": "Est m",
        "holdReasonDefault": "On hold",
    },
    "ar": {
        "estHoursPlaceholder": "ساعات تقديرية",
        "estMinutesPlaceholder": "دقائق تقديرية",
        "holdReasonDefault": "معلّقة",
    },
    "he": {
        "estHoursPlaceholder": "שעות משוערות",
        "estMinutesPlaceholder": "דקות משוערות",
        "holdReasonDefault": "בהמתנה",
    },
}

ACTIVITY_VERBS = {
    "en": {
        "create": "Created",
        "update": "Updated",
        "updated": "Updated",
        "delete": "Deleted",
        "hold": "On hold",
        "approve": "Approved",
        "submit": "Submitted",
        "login": "Signed in",
        "logout": "Signed out",
        "activate": "Activated",
        "deactivate": "Deactivated",
        "assign": "Assigned",
        "complete": "Completed",
        "record": "Recorded",
        "send": "Sent",
        "convert": "Converted",
        "status": "Status changed",
        "skipped": "Skipped",
        "patch": "Updated",
        "upsert": "Saved",
        "invite": "Invited",
        "offer": "Offer sent",
        "fallback": "Update",
    },
    "ar": {
        "create": "إنشاء",
        "update": "تحديث",
        "updated": "تحديث",
        "delete": "حذف",
        "hold": "تعليق",
        "approve": "موافقة",
        "submit": "إرسال",
        "login": "تسجيل دخول",
        "logout": "تسجيل خروج",
        "activate": "تفعيل",
        "deactivate": "إيقاف",
        "assign": "إسناد",
        "complete": "إكمال",
        "record": "تسجيل",
        "send": "إرسال",
        "convert": "تحويل",
        "status": "تغيير الحالة",
        "skipped": "تخطي",
        "patch": "تحديث",
        "upsert": "حفظ",
        "invite": "دعوة",
        "offer": "عرض سعر",
        "fallback": "تحديث",
    },
    "he": {
        "create": "נוצר",
        "update": "עודכן",
        "updated": "עודכן",
        "delete": "נמחק",
        "hold": "בהמתנה",
        "approve": "אושר",
        "submit": "נשלח",
        "login": "התחברות",
        "logout": "התנתקות",
        "activate": "הופעל",
        "deactivate": "הושבת",
        "assign": "הוקצה",
        "complete": "הושלם",
        "record": "נרשם",
        "send": "נשלח",
        "convert": "הומר",
        "status": "הסטטוס השתנה",
        "skipped": "דולג",
        "patch": "עודכן",
        "upsert": "נשמר",
        "invite": "הוזמן",
        "offer": "הצעה נשלחה",
        "fallback": "עדכון",
    },
}

ACTIVITY_ENTITIES = {
    "en": {
        "SalesOrder": "Sales order",
        "Customer": "Dealer",
        "User": "User",
        "Invoice": "Invoice",
        "Payment": "Payment",
        "ProductionOrder": "Production order",
        "PurchaseOrder": "Purchase order",
        "PurchaseRequest": "Purchase request",
        "Supplier": "Supplier",
        "SupplierInvoice": "Supplier invoice",
        "InventoryItem": "Inventory item",
        "Warehouse": "Warehouse",
        "Delivery": "Delivery",
        "Quotation": "Quotation",
        "RequestForQuotation": "Quote request",
        "ReturnRequest": "Return",
        "Department": "Department",
        "Role": "Role",
        "Contract": "Contract",
        "GoodsReceipt": "Goods receipt",
        "QualityInspection": "Quality inspection",
        "ReworkRequest": "Rework",
        "AIExtractionJob": "AI intake",
        "SystemSetting": "Setting",
        "DealerPrice": "Dealer price",
        "ProductionStageDefinition": "Stage",
        "QualityChecklistTemplate": "Quality template",
        "SupplierPayment": "Supplier payment",
        "Notification": "Notification",
    },
    "ar": {
        "SalesOrder": "طلبية",
        "Customer": "تاجر",
        "User": "مستخدم",
        "Invoice": "فاتورة",
        "Payment": "دفعة",
        "ProductionOrder": "أمر إنتاج",
        "PurchaseOrder": "أمر شراء",
        "PurchaseRequest": "طلب شراء",
        "Supplier": "مورّد",
        "SupplierInvoice": "فاتورة مورّد",
        "InventoryItem": "صنف مخزون",
        "Warehouse": "مستودع",
        "Delivery": "تسليم",
        "Quotation": "عرض سعر",
        "RequestForQuotation": "طلب عرض سعر",
        "ReturnRequest": "إرجاع",
        "Department": "قسم",
        "Role": "دور",
        "Contract": "عقد",
        "GoodsReceipt": "سند استلام",
        "QualityInspection": "فحص جودة",
        "ReworkRequest": "إعادة عمل",
        "AIExtractionJob": "قراءة طلبية",
        "SystemSetting": "إعداد",
        "DealerPrice": "سعر تاجر",
        "ProductionStageDefinition": "مرحلة",
        "QualityChecklistTemplate": "قالب فحص",
        "SupplierPayment": "دفعة مورّد",
        "Notification": "إشعار",
    },
    "he": {
        "SalesOrder": "הזמנה",
        "Customer": "סוחר",
        "User": "משתמש",
        "Invoice": "חשבונית",
        "Payment": "תשלום",
        "ProductionOrder": "הזמנת ייצור",
        "PurchaseOrder": "הזמנת רכש",
        "PurchaseRequest": "בקשת רכש",
        "Supplier": "ספק",
        "SupplierInvoice": "חשבונית ספק",
        "InventoryItem": "פריט מלאי",
        "Warehouse": "מחסן",
        "Delivery": "משלוח",
        "Quotation": "הצעת מחיר",
        "RequestForQuotation": "בקשת הצעה",
        "ReturnRequest": "החזרה",
        "Department": "מחלקה",
        "Role": "תפקיד",
        "Contract": "חוזה",
        "GoodsReceipt": "קבלת סחורה",
        "QualityInspection": "בקרת איכות",
        "ReworkRequest": "תיקון",
        "AIExtractionJob": "קליטת הזמנה",
        "SystemSetting": "הגדרה",
        "DealerPrice": "מחיר סוחר",
        "ProductionStageDefinition": "שלב",
        "QualityChecklistTemplate": "תבנית בדיקה",
        "SupplierPayment": "תשלום לספק",
        "Notification": "התראה",
    },
}

PLURALS = {
    "en": {
        "dueInDaysZero": "No amount due",
        "dueInDaysOne": "Due in {n} day",
        "dueInDaysTwo": "Due in {n} days",
        "dueInDaysFew": "Due in {n} days",
        "dueInDaysMany": "Due in {n} days",
        "overdueDaysZero": "Not overdue",
        "overdueDaysOne": "Overdue by {n} day",
        "overdueDaysTwo": "Overdue by {n} days",
        "overdueDaysFew": "Overdue by {n} days",
        "overdueDaysMany": "Overdue by {n} days",
        "collectionItemsZero": "No items",
        "collectionItemsOne": "{n} item",
        "collectionItemsTwo": "{n} items",
        "collectionItemsFew": "{n} items",
        "collectionItemsMany": "{n} items",
    },
    "ar": {
        "dueInDaysZero": "لا يوجد استحقاق",
        "dueInDaysOne": "يستحق خلال يوم واحد",
        "dueInDaysTwo": "يستحق خلال يومين",
        "dueInDaysFew": "يستحق خلال {n} أيام",
        "dueInDaysMany": "يستحق خلال {n} يوماً",
        "overdueDaysZero": "غير متأخر",
        "overdueDaysOne": "متأخر يوماً واحداً",
        "overdueDaysTwo": "متأخر يومين",
        "overdueDaysFew": "متأخر {n} أيام",
        "overdueDaysMany": "متأخر {n} يوماً",
        "collectionItemsZero": "لا قطع",
        "collectionItemsOne": "قطعة واحدة",
        "collectionItemsTwo": "قطعتان",
        "collectionItemsFew": "{n} قطع",
        "collectionItemsMany": "{n} قطعة",
    },
    "he": {
        "dueInDaysZero": "אין יתרה לתשלום",
        "dueInDaysOne": "לתשלום תוך יום",
        "dueInDaysTwo": "לתשלום תוך {n} ימים",
        "dueInDaysFew": "לתשלום תוך {n} ימים",
        "dueInDaysMany": "לתשלום תוך {n} ימים",
        "overdueDaysZero": "לא באיחור",
        "overdueDaysOne": "באיחור של יום",
        "overdueDaysTwo": "באיחור של {n} ימים",
        "overdueDaysFew": "באיחור של {n} ימים",
        "overdueDaysMany": "באיחור של {n} ימים",
        "collectionItemsZero": "אין פריטים",
        "collectionItemsOne": "פריט אחד",
        "collectionItemsTwo": "{n} פריטים",
        "collectionItemsFew": "{n} פריטים",
        "collectionItemsMany": "{n} פריטים",
    },
}

UNREAD_PLURALS = {
    "en": {
        "unreadCountZero": "No unread",
        "unreadCountOne": "{count} unread",
        "unreadCountTwo": "{count} unread",
        "unreadCountFew": "{count} unread",
        "unreadCountMany": "{count} unread",
    },
    "ar": {
        "unreadCountZero": "لا غير مقروء",
        "unreadCountOne": "إشعار غير مقروء",
        "unreadCountTwo": "إشعاران غير مقروءين",
        "unreadCountFew": "{count} إشعارات غير مقروءة",
        "unreadCountMany": "{count} إشعاراً غير مقروء",
    },
    "he": {
        "unreadCountZero": "אין שלא נקראו",
        "unreadCountOne": "אחת שלא נקראה",
        "unreadCountTwo": "{count} שלא נקראו",
        "unreadCountFew": "{count} שלא נקראו",
        "unreadCountMany": "{count} שלא נקראו",
    },
}


def main() -> None:
    for loc in ("en", "ar", "he"):
        catalog = load(loc, "catalog")
        catalog = insert_after(catalog, "seatHeight", CATALOG_DIMS[loc])
        if loc == "ar":
            catalog["sellerPricesHint"] = (
                "كل تاجر يمكن أن يكون له سعر بيع خاص. تكلفة الإنتاج واحدة لجميع التجار."
            )
            catalog["noSellersLeftForPrice"] = (
                "لكل التجار سعر بالفعل. عدّل البطاقة لتغيير السعر."
            )
        save(loc, "catalog", catalog)

        common = load(loc, "common")
        common = insert_after(common, "retry", COMMON_EXTRA[loc])
        save(loc, "common", common)

        production = load(loc, "production")
        production = insert_after(production, "hold", PROD_EXTRA[loc])
        production["floorInstructions"] = FLOOR[loc]
        save(loc, "production", production)

        mobile = load(loc, "mobile")
        admin = mobile["adminHome"]
        admin["activityVerb"] = ACTIVITY_VERBS[loc]
        admin["activityEntity"] = ACTIVITY_ENTITIES[loc]
        dealer = mobile["dealerHome"]
        for k, v in PLURALS[loc].items():
            dealer[k] = v
        notif = mobile["notifications"]
        for k, v in UNREAD_PLURALS[loc].items():
            notif[k] = v
        mobile["inventory"]["txType"]["OTHER"] = {
            "en": "Movement",
            "ar": "حركة مخزون",
            "he": "תנועת מלאי",
        }[loc]
        save(loc, "mobile", mobile)

    print("patched catalog, common, production, mobile for en/ar/he")


if __name__ == "__main__":
    main()
