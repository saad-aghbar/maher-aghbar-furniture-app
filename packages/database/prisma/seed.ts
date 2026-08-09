import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS } from '@maher/permissions';
import { seedDemoWorld, wipeOperationalData } from './seed-demo-world';

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
    '  nile | oasis | balqis | jerash | aqaba | zarqa | irbid | madaba | salt | karak | mafraq | ajloun | rum | deadsea',
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
