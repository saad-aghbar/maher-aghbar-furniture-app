import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS } from '@maher/permissions';
import { seedDemoWorld, wipeOperationalData } from './seed-demo-world';
import {
  ensureFoamStageDefinition,
  seedStandardFurnitureWorkflow,
} from './seed/workflow';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Maher Al-Aghbar ERP…');

  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
  }

  const roleMeta: Record<string, { nameAr: string; nameEn: string }> = {
    CUSTOMER: { nameAr: 'عميل', nameEn: 'Customer' },
    PRODUCTION_WORKER: { nameAr: 'عامل', nameEn: 'Worker' },
    SYSTEM_ADMINISTRATOR: { nameAr: 'مسؤول النظام', nameEn: 'Admin' },
  };

  for (const code of ROLES) {
    const meta = roleMeta[code] ?? { nameAr: code, nameEn: code };
    const role = await prisma.role.upsert({
      where: { code },
      update: { nameAr: meta.nameAr, nameEn: meta.nameEn },
      create: { code, nameAr: meta.nameAr, nameEn: meta.nameEn },
    });

    const perms = ROLE_PERMISSIONS[code as keyof typeof ROLE_PERMISSIONS] ?? [];
    // Replace grants so removed permissions are not left on the role.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const permCode of perms) {
      const permission = await prisma.permission.findUnique({ where: { code: permCode } });
      if (!permission) continue;
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  await prisma.branch.upsert({
    where: { code: 'AMMAN' },
    update: {},
    create: {
      code: 'AMMAN',
      nameAr: 'عمّان',
      nameEn: 'Amman',
      isDefault: true,
    },
  });

  const warehouses = [
    { code: 'RAW', nameAr: 'مستودع خامات', nameEn: 'Raw Materials', type: 'RAW' },
    { code: 'SEMI', nameAr: 'مستودع نصف مصنّع', nameEn: 'Semi-Finished', type: 'SEMI' },
    { code: 'FIN', nameAr: 'مستودع منتج نهائي', nameEn: 'Finished Goods', type: 'FINISHED' },
  ];
  for (const wh of warehouses) {
    await prisma.warehouse.upsert({
      where: { code: wh.code },
      update: {},
      create: wh,
    });
  }

  const departments = [
    { code: 'MGMT', nameAr: 'الإدارة', nameEn: 'Management' },
    { code: 'SALES', nameAr: 'المبيعات', nameEn: 'Sales' },
    { code: 'PURCH', nameAr: 'المشتريات', nameEn: 'Purchasing' },
    { code: 'WH', nameAr: 'المستودعات', nameEn: 'Warehouse' },
    { code: 'PROD', nameAr: 'الإنتاج', nameEn: 'Production' },
    { code: 'CARP', nameAr: 'النجارة', nameEn: 'Carpentry' },
    { code: 'PAINT', nameAr: 'الدهان', nameEn: 'Painting' },
    { code: 'UPHOL', nameAr: 'التنجيد', nameEn: 'Upholstery' },
    { code: 'ASM', nameAr: 'التجميع', nameEn: 'Assembly' },
    { code: 'QC', nameAr: 'الجودة', nameEn: 'Quality' },
    { code: 'PACK', nameAr: 'التغليف', nameEn: 'Packaging' },
    { code: 'DEL', nameAr: 'التسليم', nameEn: 'Delivery' },
    { code: 'ACCT', nameAr: 'المحاسبة', nameEn: 'Accounting' },
  ];
  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { nameAr: dept.nameAr, nameEn: dept.nameEn },
      create: dept,
    });
  }

  const stages: Array<{
    code: string;
    nameAr: string;
    nameEn: string;
    sortOrder: number;
    requiresInspection?: boolean;
    dependsOnCodes: string[];
    responsibleDepartment: string;
  }> = [
    {
      code: 'MATERIAL_PREP',
      nameAr: 'تجهيز المواد',
      nameEn: 'Material preparation',
      sortOrder: 1,
      dependsOnCodes: [],
      responsibleDepartment: 'WH',
    },
    {
      code: 'CARPENTRY',
      nameAr: 'النجارة',
      nameEn: 'Carpentry',
      sortOrder: 2,
      dependsOnCodes: ['MATERIAL_PREP'],
      responsibleDepartment: 'CARP',
    },
    {
      code: 'PAINTING',
      nameAr: 'الدهان',
      nameEn: 'Painting',
      sortOrder: 3,
      dependsOnCodes: ['MATERIAL_PREP'],
      responsibleDepartment: 'PAINT',
    },
    {
      code: 'UPHOLSTERY',
      nameAr: 'التنجيد',
      nameEn: 'Upholstery',
      sortOrder: 4,
      dependsOnCodes: ['CARPENTRY'],
      responsibleDepartment: 'UPHOL',
    },
    {
      code: 'ASSEMBLY',
      nameAr: 'التجميع',
      nameEn: 'Assembly',
      sortOrder: 5,
      dependsOnCodes: ['CARPENTRY', 'PAINTING', 'UPHOLSTERY'],
      responsibleDepartment: 'ASM',
    },
    {
      code: 'INSPECTION',
      nameAr: 'الفحص',
      nameEn: 'Inspection',
      sortOrder: 6,
      requiresInspection: true,
      dependsOnCodes: ['ASSEMBLY'],
      responsibleDepartment: 'QC',
    },
    {
      code: 'PACKAGING',
      nameAr: 'التغليف',
      nameEn: 'Packaging',
      sortOrder: 7,
      dependsOnCodes: ['INSPECTION'],
      responsibleDepartment: 'PACK',
    },
    {
      code: 'DELIVERY',
      nameAr: 'التسليم',
      nameEn: 'Delivery',
      sortOrder: 8,
      dependsOnCodes: ['PACKAGING'],
      responsibleDepartment: 'DEL',
    },
  ];
  for (const s of stages) {
    await prisma.productionStageDefinition.upsert({
      where: { code: s.code },
      update: {
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        sortOrder: s.sortOrder,
        dependsOnCodes: s.dependsOnCodes,
        requiresInspection: s.requiresInspection ?? false,
        responsibleDepartment: s.responsibleDepartment,
      },
      create: {
        code: s.code,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        sortOrder: s.sortOrder,
        dependsOnCodes: s.dependsOnCodes,
        requiresInspection: s.requiresInspection ?? false,
        responsibleDepartment: s.responsibleDepartment,
        requiresPhotos: true,
      },
    });
  }

  await ensureFoamStageDefinition(prisma);
  await seedStandardFurnitureWorkflow(prisma);
  console.log('  workflow: STANDARD_FURNITURE v1 (ACTIVE)');

  await prisma.systemSetting.upsert({
    where: { key: 'default_vat_rate' },
    update: { value: 0.16 },
    create: { key: 'default_vat_rate', value: 0.16 },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'default_currency' },
    update: { value: 'JOD' },
    create: { key: 'default_currency', value: 'JOD' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'company_name' },
    update: {
      value: {
        ar: 'مفروشات ماهر الأغبر وأولاده',
        en: 'Maher Al-Aghbar & Sons Furniture',
      },
    },
    create: {
      key: 'company_name',
      value: {
        ar: 'مفروشات ماهر الأغبر وأولاده',
        en: 'Maher Al-Aghbar & Sons Furniture',
      },
    },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'auto_confirm_so_on_accept' },
    update: { value: true },
    create: { key: 'auto_confirm_so_on_accept', value: true },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'quotation_approval' },
    update: { value: { financeThreshold: 5000 } },
    create: { key: 'quotation_approval', value: { financeThreshold: 5000 } },
  });

  await prisma.qualityChecklistTemplate.upsert({
    where: { code: 'FINAL_QC' },
    update: {},
    create: {
      code: 'FINAL_QC',
      nameAr: 'فحص نهائي',
      nameEn: 'Final inspection',
      stageCode: 'INSPECTION',
      items: {
        create: [
          { code: 'DIM', labelAr: 'المقاسات مطابقة', labelEn: 'Dimensions match', sortOrder: 1 },
          { code: 'FRAME', labelAr: 'ثبات الهيكل', labelEn: 'Frame stability', sortOrder: 2 },
          { code: 'FABRIC', labelAr: 'لون ونوع القماش', labelEn: 'Fabric type/color', sortOrder: 3 },
          { code: 'FINISH', labelAr: 'جودة التشطيب', labelEn: 'Finish quality', sortOrder: 4 },
          { code: 'CLEAN', labelAr: 'نظافة القطعة', labelEn: 'Cleanliness', sortOrder: 5 },
        ],
      },
    },
  });

  const templates = [
    {
      code: 'QUOTE_SENT',
      channel: 'EMAIL',
      subjectAr: 'عرض سعر جديد',
      subjectEn: 'New quotation',
      subjectHe: 'הצעת מחיר חדשה',
      bodyAr: 'تم إرسال عرض السعر {{number}} بمبلغ {{total}} دينار.',
      bodyEn: 'Quotation {{number}} for {{total}} JOD has been sent.',
      bodyHe: 'הצעת מחיר {{number}} בסך {{total}} נשלחה.',
    },
    {
      code: 'ORDER_CONFIRMED',
      channel: 'EMAIL',
      subjectAr: 'تأكيد أمر البيع',
      subjectEn: 'Sales order confirmed',
      subjectHe: 'הזמנה אושרה',
      bodyAr: 'تم تأكيد أمر البيع {{number}}.',
      bodyEn: 'Sales order {{number}} is confirmed.',
      bodyHe: 'הזמנת מכירה {{number}} אושרה.',
    },
    {
      code: 'PAYMENT_RECEIVED',
      channel: 'WHATSAPP',
      subjectAr: 'استلام دفعة',
      subjectEn: 'Payment received',
      subjectHe: 'תשלום התקבל',
      bodyAr: 'تم استلام دفعة بمبلغ {{amount}} دينار.',
      bodyEn: 'Payment of {{amount}} JOD received.',
      bodyHe: 'התקבל תשלום של {{amount}}.',
    },
    {
      code: 'INBOUND_EMAIL_RFQ',
      channel: 'IN_APP',
      subjectAr: 'طلب جديد من بريد الوارد',
      subjectEn: 'New inbound email RFQ',
      subjectHe: 'בקשת הצעת מחיר חדשה מדואר נכנס',
      bodyAr:
        'وصل طلب من {{customerName}} ({{customerCode}}) عبر البريد: {{subject}}. مسودة {{requestNumber}} — راجع الطلب.',
      bodyEn:
        'Inbound RFQ from {{customerName}} ({{customerCode}}): {{subject}}. Draft {{requestNumber}} — please review.',
      bodyHe:
        'בקשה נכנסה מ-{{customerName}} ({{customerCode}}): {{subject}}. טיוטה {{requestNumber}} — נא לבדוק.',
    },
    {
      code: 'INBOUND_WHATSAPP_RFQ',
      channel: 'IN_APP',
      subjectAr: 'طلب جديد من واتساب',
      subjectEn: 'New inbound WhatsApp RFQ',
      subjectHe: 'בקשת הצעת מחיר חדשה מוואטסאפ',
      bodyAr:
        'وصل طلب واتساب من {{customerName}} ({{customerCode}}) — {{from}}. مسودة {{requestNumber}} — راجع الطلب.',
      bodyEn:
        'WhatsApp RFQ from {{customerName}} ({{customerCode}}) — {{from}}. Draft {{requestNumber}} — please review.',
      bodyHe:
        'בקשת וואטסאפ מ-{{customerName}} ({{customerCode}}) — {{from}}. טיוטה {{requestNumber}} — נא לבדוק.',
    },
    {
      code: 'LOW_STOCK',
      channel: 'IN_APP',
      subjectAr: 'تنبيه مخزون منخفض',
      subjectEn: 'Low stock alert',
      subjectHe: 'התראת מלאי נמוך',
      bodyAr: 'هناك {{count}} صنف عند الحد الأدنى أو دونه: {{items}}. طلب شراء: {{prNumber}}.',
      bodyEn: '{{count}} item(s) at or below minimum: {{items}}. Purchase request: {{prNumber}}.',
      bodyHe: '{{count}} פריטים ברמת מינימום או מתחת: {{items}}. בקשת רכש: {{prNumber}}.',
    },
    {
      code: 'NEW_ORDER',
      channel: 'IN_APP',
      subjectAr: 'طلب جديد',
      subjectEn: 'New order',
      subjectHe: 'הזמנה חדשה',
      bodyAr: 'تم تقديم الطلب {{number}} من {{customerName}}.',
      bodyEn: 'Order request {{number}} submitted by {{customerName}}.',
      bodyHe: 'בקשת הזמנה {{number}} הוגשה על ידי {{customerName}}.',
    },
    {
      code: 'AI_DRAFT_READY',
      channel: 'IN_APP',
      subjectAr: 'مسودة ذكاء اصطناعي جاهزة',
      subjectEn: 'AI draft ready',
      subjectHe: 'טיוטת AI מוכנה',
      bodyAr: 'مسودة الاستخراج {{jobNumber}} جاهزة للمراجعة.',
      bodyEn: 'AI extraction draft {{jobNumber}} is ready for review.',
      bodyHe: 'טיוטת חילוץ {{jobNumber}} מוכנה לבדיקה.',
    },
    {
      code: 'WORKER_ASSIGNED',
      channel: 'IN_APP',
      subjectAr: 'مهمة جديدة',
      subjectEn: 'Task assigned',
      subjectHe: 'משימה הוקצתה',
      bodyAr: 'تم تعيينك للمهمة {{taskName}} على أمر الإنتاج {{orderNumber}}.',
      bodyEn: 'You were assigned {{taskName}} on production order {{orderNumber}}.',
      bodyHe: 'הוקצית למשימה {{taskName}} בהזמנת ייצור {{orderNumber}}.',
    },
    {
      code: 'URGENT_TASK',
      channel: 'IN_APP',
      subjectAr: 'مهمة عاجلة',
      subjectEn: 'Urgent task',
      subjectHe: 'משימה דחופה',
      bodyAr: 'مهمة عاجلة: {{taskName}} ({{orderNumber}}).',
      bodyEn: 'Urgent task: {{taskName}} ({{orderNumber}}).',
      bodyHe: 'משימה דחופה: {{taskName}} ({{orderNumber}}).',
    },
    {
      code: 'DELIVERY_APPROACHING',
      channel: 'IN_APP',
      subjectAr: 'التسليم قريب',
      subjectEn: 'Delivery approaching',
      subjectHe: 'משלוח מתקרב',
      bodyAr: 'التسليم {{number}} أصبح جاهزاً / في الطريق.',
      bodyEn: 'Delivery {{number}} is ready / out for delivery.',
      bodyHe: 'משלוח {{number}} מוכן / בדרך.',
    },
    {
      code: 'RETURN_APPROVED',
      channel: 'IN_APP',
      subjectAr: 'قبول المرتجع',
      subjectEn: 'Return approved',
      subjectHe: 'החזרה אושרה',
      bodyAr: 'تم قبول طلب المرتجع {{number}}.',
      bodyEn: 'Return request {{number}} was approved.',
      bodyHe: 'בקשת החזרה {{number}} אושרה.',
    },
    {
      code: 'RETURN_REJECTED',
      channel: 'IN_APP',
      subjectAr: 'رفض المرتجع',
      subjectEn: 'Return rejected',
      subjectHe: 'החזרה נדחתה',
      bodyAr: 'تم رفض طلب المرتجع {{number}}.',
      bodyEn: 'Return request {{number}} was rejected.',
      bodyHe: 'בקשת החזרה {{number}} נדחתה.',
    },
    {
      code: 'INVOICE_CREATED',
      channel: 'IN_APP',
      subjectAr: 'فاتورة جديدة',
      subjectEn: 'Invoice created',
      subjectHe: 'חשבונית נוצרה',
      bodyAr: 'تم إنشاء الفاتورة {{number}} بمبلغ {{total}} دينار.',
      bodyEn: 'Invoice {{number}} for {{total}} JOD was created.',
      bodyHe: 'נוצרה חשבונית {{number}} בסך {{total}}.',
    },
    {
      code: 'SCHEDULE_AWAITING_APPROVAL',
      channel: 'IN_APP',
      subjectAr: 'جدول إنتاج بانتظار الموافقة',
      subjectEn: 'Production schedule awaiting approval',
      subjectHe: 'לוח ייצור ממתין לאישור',
      bodyAr: 'تم إنشاء جدول إنتاج مقترح لأمر الإنتاج {{orderNumber}} (نسخة {{version}}) وينتظر موافقتك.',
      bodyEn: 'A proposed production schedule for order {{orderNumber}} (v{{version}}) is awaiting your approval.',
      bodyHe: 'לוח ייצור מוצע להזמנה {{orderNumber}} (גרסה {{version}}) ממתין לאישורך.',
    },
    {
      code: 'DEALER_DATE_UPDATED',
      channel: 'IN_APP',
      subjectAr: 'تحديث تاريخ التسليم المفضل',
      subjectEn: 'Preferred delivery date updated',
      subjectHe: 'תאריך אספקה מועדף עודכן',
      bodyAr: 'قام التاجر بتحديث تاريخ التسليم المفضل لأمر الإنتاج {{orderNumber}} إلى {{date}}.',
      bodyEn: 'The dealer updated the preferred delivery date for order {{orderNumber}} to {{date}}.',
      bodyHe: 'הסוחר עדכן את תאריך האספקה המועדף להזמנה {{orderNumber}} ל-{{date}}.',
    },
    {
      code: 'DEALER_DATE_CHANGE_REQUEST',
      channel: 'IN_APP',
      subjectAr: 'طلب تغيير تاريخ التسليم',
      subjectEn: 'Delivery date change request',
      subjectHe: 'בקשת שינוי תאריך אספקה',
      bodyAr: 'طلب التاجر تغيير تاريخ التسليم لأمر الإنتاج {{orderNumber}} إلى {{date}}. السبب: {{reason}}.',
      bodyEn: 'The dealer requested a delivery date change for order {{orderNumber}} to {{date}}. Reason: {{reason}}.',
      bodyHe: 'הסוחר ביקש לשנות את תאריך האספקה להזמנה {{orderNumber}} ל-{{date}}. סיבה: {{reason}}.',
    },
    {
      code: 'DELIVERY_DATE_CONFIRMED',
      channel: 'IN_APP',
      subjectAr: 'تأكيد تاريخ التسليم',
      subjectEn: 'Delivery date confirmed',
      subjectHe: 'תאריך אספקה אושר',
      bodyAr: 'تم تأكيد تاريخ التسليم لأمر الإنتاج {{orderNumber}}: {{date}}.',
      bodyEn: 'The delivery date for order {{orderNumber}} has been confirmed: {{date}}.',
      bodyHe: 'תאריך האספקה להזמנה {{orderNumber}} אושר: {{date}}.',
    },
    {
      code: 'DELIVERY_DATE_UPDATED',
      channel: 'IN_APP',
      subjectAr: 'تحديث تاريخ التسليم',
      subjectEn: 'Delivery date updated',
      subjectHe: 'תאריך אספקה עודכן',
      bodyAr: 'تم تحديث تاريخ التسليم المتوقع لأمر الإنتاج {{orderNumber}} إلى {{date}}.',
      bodyEn: 'The expected delivery date for order {{orderNumber}} was updated to {{date}}.',
      bodyHe: 'תאריך האספקה הצפוי להזמנה {{orderNumber}} עודכן ל-{{date}}.',
    },
    {
      code: 'SCHEDULE_AT_RISK',
      channel: 'IN_APP',
      subjectAr: 'جدول إنتاج معرض للخطر',
      subjectEn: 'Production schedule at risk',
      subjectHe: 'לוח ייצור בסיכון',
      bodyAr: 'جدول أمر الإنتاج {{orderNumber}} معرض لخطر التأخير. السبب: {{reason}}.',
      bodyEn: 'The production schedule for order {{orderNumber}} is at risk of delay. Reason: {{reason}}.',
      bodyHe: 'לוח הייצור להזמנה {{orderNumber}} בסיכון לעיכוב. סיבה: {{reason}}.',
    },
    {
      code: 'SCHEDULE_CONFLICT',
      channel: 'IN_APP',
      subjectAr: 'تعارض في جدول الإنتاج',
      subjectEn: 'Production schedule conflict',
      subjectHe: 'התנגשות בלוח הייצור',
      bodyAr: 'تم اكتشاف تعارض في جدول أمر الإنتاج {{orderNumber}}. السبب: {{reason}}.',
      bodyEn: 'A scheduling conflict was detected for order {{orderNumber}}. Reason: {{reason}}.',
      bodyHe: 'זוהתה התנגשות בלוח הייצור להזמנה {{orderNumber}}. סיבה: {{reason}}.',
    },
    {
      code: 'MATERIAL_RISK',
      channel: 'IN_APP',
      subjectAr: 'خطر نقص المواد',
      subjectEn: 'Material availability risk',
      subjectHe: 'סיכון זמינות חומרים',
      bodyAr: 'قد لا تتوفر المواد اللازمة لأمر الإنتاج {{orderNumber}} في الوقت المحدد.',
      bodyEn: 'Materials required for order {{orderNumber}} may not be available in time.',
      bodyHe: 'ייתכן שהחומרים הנדרשים להזמנה {{orderNumber}} לא יהיו זמינים בזמן.',
    },
    {
      code: 'TASK_SCHEDULED_TODAY',
      channel: 'IN_APP',
      subjectAr: 'مهمة مجدولة اليوم',
      subjectEn: 'Task scheduled for today',
      subjectHe: 'משימה מתוזמנת להיום',
      bodyAr: 'لديك مهمة {{taskName}} مجدولة اليوم على أمر الإنتاج {{orderNumber}}.',
      bodyEn: 'You have task {{taskName}} scheduled today on production order {{orderNumber}}.',
      bodyHe: 'יש לך משימה {{taskName}} מתוזמנת להיום בהזמנת ייצור {{orderNumber}}.',
    },
    {
      code: 'SCHEDULE_REPLAN_PROPOSED',
      channel: 'IN_APP',
      subjectAr: 'اقتراح إعادة جدولة',
      subjectEn: 'Schedule replan proposed',
      subjectHe: 'הוצעה תזמון מחדש',
      bodyAr: 'تم اقتراح إعادة جدولة لأمر الإنتاج {{orderNumber}} بسبب {{reason}}. راجع الجدول الجديد.',
      bodyEn: 'A schedule replan was proposed for order {{orderNumber}} due to {{reason}}. Please review the new plan.',
      bodyHe: 'הוצע תזמון מחדש להזמנה {{orderNumber}} עקב {{reason}}. נא לבדוק את התוכנית החדשה.',
    },
  ];
  for (const tpl of templates) {
    await prisma.notificationTemplate.upsert({
      where: { code: tpl.code },
      create: tpl,
      update: tpl,
    });
  }

  // Refresh operational demo (keeps foundation tables above).
  console.log('Wiping operational data…');
  await wipeOperationalData(prisma);

  // Drop legacy roles that are no longer in the three-account model.
  await prisma.rolePermission.deleteMany({
    where: { role: { code: { notIn: [...ROLES] } } },
  });
  await prisma.role.deleteMany({
    where: { code: { notIn: [...ROLES] } },
  });

  const passwordHash = hashSync('123', 12);
  await seedDemoWorld(prisma, passwordHash);

  console.log('Seed complete.');
  console.log('Account types: admin | customer | worker');
  console.log('Demo logins (password: 123):');
  console.log('  admin');
  console.log(
    '  cutter | cutter2 | carpenter | carpenter2 | carpenter3 | painter | painter2 | upholsterer | upholsterer2 | assembler | assembler2 | packer | inspector | driver | driver2',
  );
  console.log(
    '  nile | oasis | balqis',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
