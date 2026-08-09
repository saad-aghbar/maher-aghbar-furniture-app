import type { Locale } from '@maher/types';

type BuildOpts = {
  locale: Locale;
  stageCode: string;
  stageName: string;
  productDescription: string;
  quantity: number | string;
  specifications?: string | null;
};

/**
 * Locale-aware floor instructions for task detail.
 * Order numbers / SKUs stay Latin; human copy follows the active locale.
 */
export function buildLocalizedStageInstructions(opts: BuildOpts): string {
  const qty = Number(opts.quantity);
  const qtyLabel = Number.isFinite(qty) ? String(qty) : String(opts.quantity);
  const productLine = `${opts.productDescription} × ${qtyLabel}`;
  const specs = opts.specifications?.trim();
  const locale = opts.locale === 'he' ? 'he' : opts.locale === 'ar' ? 'ar' : 'en';

  if (locale === 'en') {
    return buildEn(opts.stageCode, opts.stageName, productLine, specs);
  }
  if (locale === 'he') {
    return buildHe(opts.stageCode, opts.stageName, productLine, specs);
  }
  return buildAr(opts.stageCode, opts.stageName, productLine, specs);
}

function specsLine(locale: 'ar' | 'he' | 'en', specs: string | undefined): string {
  if (!specs) return '';
  if (locale === 'ar') return `\nالمواصفات: ${specs}`;
  if (locale === 'he') return `\nמפרט: ${specs}`;
  return `\nSpecs: ${specs}`;
}

function buildAr(
  stageCode: string,
  stageName: string,
  productLine: string,
  specs: string | undefined,
): string {
  const s = specsLine('ar', specs);
  switch (stageCode) {
    case 'MATERIAL_PREP':
      return [
        `تجهيز المواد لـ: ${productLine}.${s}`,
        'اسحب القماش والخشب والإسفنج والملحقات حسب قائمة المواد.',
        'ضع ملصقات على المجموعات للنجارة والطلاء والتنجيد.',
        'أبلغ المشتريات بأي نقص قبل إطلاق المجموعة.',
      ].join('\n');
    case 'CARPENTRY':
      return [
        `نجارة لـ: ${productLine}.${s}`,
        'قصّ وركّب الإطارات حسب أبعاد الرسم.',
        'صنفر كل الأسطح الظاهرة؛ تحقق من الوصلات والاستقامة.',
        'جهّز الإطارات المكتملة للطلاء / التنجيد.',
      ].join('\n');
    case 'PAINTING':
      return [
        `تشطيب / طلاء لـ: ${productLine}.${s}`,
        'طبّق الطبقة التأسيسية وطبقات التشطيب حسب مرجع اللون.',
        'اترك وقت الجفاف الكامل قبل التسليم للتجميع.',
        'احمِ الأسطح النهائية أثناء النقل للمرحلة التالية.',
      ].join('\n');
    case 'UPHOLSTERY':
      return [
        `تنجيد لـ: ${productLine}.${s}`,
        'قص القماش حسب النمط؛ طابق الاتجاه ودفعة اللون.',
        'ركّب الإسفنج والغطاء حسب العينة المعتمدة.',
        'افحص الدرزات والدبابيس قبل تسليم التجميع.',
      ].join('\n');
    case 'ASSEMBLY':
      return [
        `تجميع: ${productLine}.${s}`,
        'اجمع أجزاء النجارة والطلاء والتنجيد.',
        'ركّب الملحقات وتحقق من الأبعاد مقابل الطلب.',
        'انقل الوحدة المكتملة للفحص مع الأوراق.',
      ].join('\n');
    case 'INSPECTION':
      return [
        `فحص جودة لـ: ${productLine}.${s}`,
        'نفّذ قائمة فحص المرحلة؛ صوّر العيوب إن وُجدت.',
        'اقبل فقط إذا طابقت الأبعاد والتشطيب والقماش الطلب.',
        'ارفض مع ملاحظات إعادة عمل واضحة للمرحلة المسؤولة.',
      ].join('\n');
    case 'PACKAGING':
      return [
        `تعبئة: ${productLine}.${s}`,
        'غلّف وصنّد للنقل الآمن؛ أضف حماية للزوايا.',
        'أرفق قائمة التعبئة وملصق أمر المصنع.',
        'جهّز للتسليم فقط بعد اجتياز فحص الجودة.',
      ].join('\n');
    case 'DELIVERY':
      return [
        `تسليم: ${productLine}.${s}`,
        'أكد العنوان والوقت وجهة الاتصال في أمر البيع.',
        'اجمع توقيع / صورة إثبات التسليم.',
        'أبلغ فورًا عن أي ضرر أثناء النقل.',
      ].join('\n');
    default:
      return [
        `${stageName} لـ: ${productLine}.${s}`,
        'اتبع رسم الورشة ومواصفات الطلب.',
        'حدّث تقدم المهمة وأرفق الصور المطلوبة قبل الإنهاء.',
      ].join('\n');
  }
}

function buildHe(
  stageCode: string,
  stageName: string,
  productLine: string,
  specs: string | undefined,
): string {
  const s = specsLine('he', specs);
  switch (stageCode) {
    case 'MATERIAL_PREP':
      return [
        `הכנת חומרים עבור: ${productLine}.${s}`,
        'משכו בד, עץ, ספוג וחומרה לפי ה-BOM.',
        'סמנו ערכות לנגרות, צביעה וריפוד.',
        'דווחו על חוסרים לרכש לפני שחרור הערכה.',
      ].join('\n');
    case 'CARPENTRY':
      return [
        `נגרות עבור: ${productLine}.${s}`,
        'חתכו והרכיבו מסגרות לפי מידות השרטוט.',
        'שייפו משטחים גלויים; בדקו חיבורים וישרות.',
        'העבירו מסגרות מוכנות לצביעה / ריפוד.',
      ].join('\n');
    case 'PAINTING':
      return [
        `גימור / צביעה עבור: ${productLine}.${s}`,
        'מרחו פריימר ושכבות גימור לפי דגימת הצבע.',
        'המתינו לייבוש מלא לפני מסירה להרכבה.',
        'הגנו על משטחים מוגמרים בהעברה לשלב הבא.',
      ].join('\n');
    case 'UPHOLSTERY':
      return [
        `ריפוד עבור: ${productLine}.${s}`,
        'חתכו בד לפי התבנית; התאימו כיוון ואצוות צבע.',
        'ספוג וכיסוי לפי הדגימה המאושרת.',
        'בדקו תפרים וסיכות לפני מסירה להרכבה.',
      ].join('\n');
    case 'ASSEMBLY':
      return [
        `הרכבה: ${productLine}.${s}`,
        'חברו חלקי נגרות, צבע וריפוד.',
        'התקינו חומרה ואמתו מידות מול ההזמנה.',
        'העבירו יחידה מושלמת לבדיקה עם מסמכים.',
      ].join('\n');
    case 'INSPECTION':
      return [
        `בקרת איכות עבור: ${productLine}.${s}`,
        'הריצו את רשימת השלב; צלמו פגמים אם יש.',
        'אשרו רק אם מידות, גימור ובד תואמים להזמנה.',
        'דחו עם הערות תיקון ברורות לשלב האחראי.',
      ].join('\n');
    case 'PACKAGING':
      return [
        `אריזה: ${productLine}.${s}`,
        'עטפו וארזו להובלה בטוחה; הוסיפו הגנת פינות.',
        'צרפו רשימת אריזה ותווית הזמנת מפעל.',
        'הכינו למשלוח רק לאחר מעבר QC.',
      ].join('\n');
    case 'DELIVERY':
      return [
        `משלוח: ${productLine}.${s}`,
        'אמתו כתובת, חלון זמן ואיש קשר בהזמנת המכירה.',
        'אספו חתימת / תמונת POD במסירה.',
        'דווחו מיד על נזק בהובלה.',
      ].join('\n');
    default:
      return [
        `${stageName} עבור: ${productLine}.${s}`,
        'פעלו לפי שרטוט הסדנה ומפרט ההזמנה.',
        'עדכנו התקדמות והעלו תמונות נדרשות לפני סיום.',
      ].join('\n');
  }
}

function buildEn(
  stageCode: string,
  stageName: string,
  productLine: string,
  specs: string | undefined,
): string {
  const s = specsLine('en', specs);
  switch (stageCode) {
    case 'MATERIAL_PREP':
      return [
        `Prepare materials for: ${productLine}.${s}`,
        'Pull fabric, wood, foam, and hardware per BOM.',
        'Label kits for carpentry, painting, and upholstery.',
        'Flag shortages to purchasing before releasing the kit.',
      ].join('\n');
    case 'CARPENTRY':
      return [
        `Carpentry for: ${productLine}.${s}`,
        'Cut and assemble frames to drawing dimensions.',
        'Sand all visible surfaces; check joints and squareness.',
        'Stage completed frames for painting / upholstery.',
      ].join('\n');
    case 'PAINTING':
      return [
        `Finishing / paint for: ${productLine}.${s}`,
        'Apply primer and finish coats per color reference.',
        'Allow full cure time before handing off to assembly.',
        'Protect finished surfaces for transport to next stage.',
      ].join('\n');
    case 'UPHOLSTERY':
      return [
        `Upholstery for: ${productLine}.${s}`,
        'Cut fabric to pattern; match grain and color batch.',
        'Foam and cover to the approved sample.',
        'Inspect seams and staples before assembly handoff.',
      ].join('\n');
    case 'ASSEMBLY':
      return [
        `Assemble: ${productLine}.${s}`,
        'Join carpentry, paint, and upholstery components.',
        'Fit hardware and verify dimensions against the order.',
        'Move complete unit to inspection with paperwork.',
      ].join('\n');
    case 'INSPECTION':
      return [
        `Quality inspection for: ${productLine}.${s}`,
        'Run the stage checklist; photograph defects if any.',
        'Pass only if dimensions, finish, and fabric match the order.',
        'Fail with clear rework notes for the owning stage.',
      ].join('\n');
    case 'PACKAGING':
      return [
        `Package: ${productLine}.${s}`,
        'Wrap and crate for safe transport; add corner protection.',
        'Attach packing list and factory order label.',
        'Stage for delivery only after QC pass.',
      ].join('\n');
    case 'DELIVERY':
      return [
        `Deliver: ${productLine}.${s}`,
        'Confirm address, window, and contact on the sales order.',
        'Collect POD signature / photo on delivery.',
        'Report any transit damage immediately.',
      ].join('\n');
    default:
      return [
        `${stageName} for: ${productLine}.${s}`,
        'Follow the shop drawing and order specifications.',
        'Update task progress and attach required photos before complete.',
      ].join('\n');
  }
}
