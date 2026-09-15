import type { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, SYSTEM_STAFF_PRESETS } from '@maher/permissions';
import {
  ensureFoamStageDefinition,
  seedStandardFurnitureWorkflow,
  STAGE_LIBRARY_NAME_HE,
  seedReturnRecoveryWorkflow,
  seedReturnRepairWorkflow,
} from './workflow';
import { ensureDefaultWarehouseBin } from './warehouse-bins';
import { seedNotificationTopicTemplates } from './notification-topics';

/** IAM, org, stage library, STANDARD_FURNITURE, settings, QC, notification templates. */
export async function seedFoundation(prisma: PrismaClient): Promise<void> {
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
  }

  const identityRoleMeta: Record<
    (typeof ROLES)[number],
    { nameAr: string; nameEn: string; nameHe: string; kind: 'CUSTOMER' | 'PRODUCTION_WORKER' | 'ADMIN' }
  > = {
    CUSTOMER: { nameAr: 'تاجر', nameEn: 'Customer', nameHe: 'לקוח', kind: 'CUSTOMER' },
    PRODUCTION_WORKER: { nameAr: 'عامل', nameEn: 'Worker', nameHe: 'עובד', kind: 'PRODUCTION_WORKER' },
    SYSTEM_ADMINISTRATOR: {
      nameAr: 'مسؤول النظام',
      nameEn: 'Admin',
      nameHe: 'מנהל מערכת',
      kind: 'ADMIN',
    },
  };

  for (const code of ROLES) {
    const meta = identityRoleMeta[code];
    const role = await prisma.role.upsert({
      where: { code },
      update: {
        nameAr: meta.nameAr,
        nameEn: meta.nameEn,
        nameHe: meta.nameHe,
        kind: meta.kind,
        isSystem: true,
        isActive: true,
      },
      create: {
        code,
        nameAr: meta.nameAr,
        nameEn: meta.nameEn,
        nameHe: meta.nameHe,
        kind: meta.kind,
        isSystem: true,
        isActive: true,
      },
    });

    const perms = ROLE_PERMISSIONS[code] ?? [];
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const permCode of perms) {
      const permission = await prisma.permission.findUnique({ where: { code: permCode } });
      if (!permission) continue;
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  for (const preset of Object.values(SYSTEM_STAFF_PRESETS)) {
    // System presets only. Custom staff types (isSystem: false) are never listed here
    // and must not be overwritten or silently granted new permissions.
    const role = await prisma.role.upsert({
      where: { code: preset.code },
      update: {
        nameAr: preset.nameAr,
        nameEn: preset.nameEn,
        nameHe: preset.nameHe,
        descriptionEn: preset.descriptionEn,
        descriptionAr: preset.descriptionAr,
        descriptionHe: preset.descriptionHe,
        kind: 'STAFF',
        isSystem: true,
        isActive: true,
        iconKey: preset.iconKey,
      },
      create: {
        code: preset.code,
        nameAr: preset.nameAr,
        nameEn: preset.nameEn,
        nameHe: preset.nameHe,
        descriptionEn: preset.descriptionEn,
        descriptionAr: preset.descriptionAr,
        descriptionHe: preset.descriptionHe,
        kind: 'STAFF',
        isSystem: true,
        isActive: true,
        iconKey: preset.iconKey,
      },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const permCode of preset.permissionCodes) {
      const permission = await prisma.permission.findUnique({ where: { code: permCode } });
      if (!permission) continue;
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  await prisma.branch.upsert({
    where: { code: 'AMMAN' },
    update: { nameAr: 'عمّان', nameEn: 'Amman', nameHe: 'עמאן' },
    create: {
      code: 'AMMAN',
      nameAr: 'عمّان',
      nameEn: 'Amman',
      nameHe: 'עמאן',
      isDefault: true,
    },
  });

  const warehouses = [
    { code: 'RAW', nameAr: 'مستودع المواد الخام', nameEn: 'Raw Materials', nameHe: 'חומרי גלם', type: 'RAW_MATERIALS' as const, isDefault: true },
    { code: 'SEMI', nameAr: 'مستودع المنتجات نصف المصنّعة', nameEn: 'Semi-Finished', nameHe: 'חצי מוגמר', type: 'SEMI_FINISHED' as const, isDefault: true },
    { code: 'FIN', nameAr: 'مستودع المنتجات الجاهزة', nameEn: 'Finished Goods', nameHe: 'מוצרים מוגמרים', type: 'FINISHED_GOODS' as const, isDefault: true },
  ];
  for (const wh of warehouses) {
    const row = await prisma.warehouse.upsert({
      where: { code: wh.code },
      update: { type: wh.type, isDefault: wh.isDefault, nameAr: wh.nameAr, nameEn: wh.nameEn, nameHe: wh.nameHe, isActive: true },
      create: wh,
    });
    await ensureDefaultWarehouseBin(prisma, { id: row.id, code: row.code });
  }

  await prisma.warehouse.updateMany({
    where: {
      code: { notIn: ['RAW', 'SEMI', 'FIN'] },
      OR: [
        { code: { in: ['TEST', 'TEST-2', 'SA', 'RAW-2', 'SEMI-2', 'FIN-2', 'TERS', 'WH'] } },
        { nameEn: { contains: 'TEST', mode: 'insensitive' } },
        { nameEn: { contains: 'UAT', mode: 'insensitive' } },
        { nameEn: { contains: 'SAMPLE', mode: 'insensitive' } },
      ],
    },
    data: { isActive: false },
  });

  const departments = [
    { code: 'MGMT', nameAr: 'الإدارة', nameEn: 'Management', nameHe: 'הנהלה' },
    { code: 'SALES', nameAr: 'المبيعات', nameEn: 'Sales', nameHe: 'מכירות' },
    { code: 'PURCH', nameAr: 'المشتريات', nameEn: 'Purchasing', nameHe: 'רכש' },
    { code: 'WH', nameAr: 'المستودعات', nameEn: 'Warehouse', nameHe: 'מחסן' },
    { code: 'PROD', nameAr: 'الإنتاج', nameEn: 'Production', nameHe: 'ייצור' },
    { code: 'CARP', nameAr: 'النجارة', nameEn: 'Carpentry', nameHe: 'נגרות' },
    { code: 'PAINT', nameAr: 'الدهان', nameEn: 'Painting', nameHe: 'צביעה' },
    { code: 'UPHOL', nameAr: 'التنجيد', nameEn: 'Upholstery', nameHe: 'ריפוד' },
    { code: 'ASM', nameAr: 'التجميع', nameEn: 'Assembly', nameHe: 'הרכבה' },
    { code: 'QC', nameAr: 'الجودة', nameEn: 'Quality', nameHe: 'איכות' },
    { code: 'PACK', nameAr: 'التغليف', nameEn: 'Packaging', nameHe: 'אריזה' },
    { code: 'DEL', nameAr: 'التسليم', nameEn: 'Delivery', nameHe: 'משלוח' },
    { code: 'ACCT', nameAr: 'المحاسبة', nameEn: 'Accounting', nameHe: 'הנהלת חשבונות' },
  ];
  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { nameAr: dept.nameAr, nameEn: dept.nameEn, nameHe: dept.nameHe },
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
    executionKind?: 'PRODUCTION' | 'QUALITY' | 'LOGISTICS';
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
      nameAr: 'فحص الجودة',
      nameEn: 'Inspection',
      sortOrder: 6,
      requiresInspection: true,
      dependsOnCodes: ['ASSEMBLY'],
      responsibleDepartment: 'QC',
      executionKind: 'QUALITY',
    },
    {
      code: 'PACKAGING',
      nameAr: 'التغليف',
      nameEn: 'Packaging',
      sortOrder: 7,
      dependsOnCodes: ['INSPECTION'],
      responsibleDepartment: 'PACK',
      executionKind: 'PRODUCTION',
    },
    {
      code: 'DELIVERY',
      nameAr: 'التسليم',
      nameEn: 'Delivery',
      sortOrder: 8,
      dependsOnCodes: ['PACKAGING'],
      responsibleDepartment: 'DEL',
      executionKind: 'LOGISTICS',
    },
    {
      code: 'DISMANTLE_RECOVER',
      nameAr: 'تفكيك واسترداد',
      nameEn: 'Dismantle & recover',
      sortOrder: 90,
      dependsOnCodes: [],
      responsibleDepartment: 'WH',
      executionKind: 'PRODUCTION',
    },
  ];
  for (const s of stages) {
    const nameHe = STAGE_LIBRARY_NAME_HE[s.code];
    await prisma.productionStageDefinition.upsert({
      where: { code: s.code },
      update: {
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        nameHe,
        sortOrder: s.sortOrder,
        dependsOnCodes: s.dependsOnCodes,
        requiresInspection: s.requiresInspection ?? false,
        responsibleDepartment: s.responsibleDepartment,
        executionKind: s.executionKind ?? 'PRODUCTION',
        isActive: true,
      },
      create: {
        code: s.code,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        nameHe,
        sortOrder: s.sortOrder,
        dependsOnCodes: s.dependsOnCodes,
        requiresInspection: s.requiresInspection ?? false,
        responsibleDepartment: s.responsibleDepartment,
        executionKind: s.executionKind ?? 'PRODUCTION',
        requiresPhotos: true,
        isActive: true,
      },
    });
  }

  await ensureFoamStageDefinition(prisma);
  await seedStandardFurnitureWorkflow(prisma);
  await seedReturnRecoveryWorkflow(prisma);
  await seedReturnRepairWorkflow(prisma);
  console.log('  workflow: STANDARD_FURNITURE + RETURN_RECOVERY + RETURN_REPAIR');

  await prisma.systemSetting.upsert({
    where: { key: 'default_vat_rate' },
    update: { value: 0.16 },
    create: { key: 'default_vat_rate', value: 0.16 },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'default_currency' },
    update: { value: 'ILS' },
    create: { key: 'default_currency', value: 'ILS' },
  });
  await Promise.all([
    prisma.dealerPrice.updateMany({ where: { currency: 'JOD' }, data: { currency: 'ILS' } }),
    prisma.supplierQuoteOffer.updateMany({ where: { currency: 'JOD' }, data: { currency: 'ILS' } }),
    prisma.purchaseOrder.updateMany({ where: { currency: 'JOD' }, data: { currency: 'ILS' } }),
    prisma.requestForQuotation.updateMany({ where: { currency: 'JOD' }, data: { currency: 'ILS' } }),
    prisma.quotation.updateMany({ where: { currency: 'JOD' }, data: { currency: 'ILS' } }),
    prisma.salesOrder.updateMany({ where: { currency: 'JOD' }, data: { currency: 'ILS' } }),
    prisma.contract.updateMany({ where: { currency: 'JOD' }, data: { currency: 'ILS' } }),
    prisma.invoice.updateMany({ where: { currency: 'JOD' }, data: { currency: 'ILS' } }),
    prisma.payment.updateMany({ where: { currency: 'JOD' }, data: { currency: 'ILS' } }),
    prisma.supplierInvoice.updateMany({ where: { currency: 'JOD' }, data: { currency: 'ILS' } }),
    prisma.supplierPayment.updateMany({ where: { currency: 'JOD' }, data: { currency: 'ILS' } }),
  ]);
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
    update: { value: false },
    create: { key: 'auto_confirm_so_on_accept', value: false },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'quotation_approval' },
    update: { value: { financeThreshold: 5000 } },
    create: { key: 'quotation_approval', value: { financeThreshold: 5000 } },
  });

  await prisma.qualityChecklistTemplate.upsert({
    where: { code: 'FINAL_QC' },
    update: {
      nameAr: 'فحص نهائي',
      nameEn: 'Final inspection',
      stageCode: 'INSPECTION',
      isActive: true,
    },
    create: {
      code: 'FINAL_QC',
      nameAr: 'فحص نهائي',
      nameEn: 'Final inspection',
      stageCode: 'INSPECTION',
    },
  });
  const finalQc = await prisma.qualityChecklistTemplate.findUniqueOrThrow({
    where: { code: 'FINAL_QC' },
  });
  const furnitureChecks = [
    { code: 'DIM', labelAr: 'المقاسات مطابقة', labelEn: 'Dimensions match', sortOrder: 1 },
    { code: 'FRAME', labelAr: 'ثبات الهيكل', labelEn: 'Structure / stability', sortOrder: 2 },
    { code: 'WOOD', labelAr: 'تشطيب الخشب', labelEn: 'Wood / carpentry finish', sortOrder: 3 },
    { code: 'PAINT', labelAr: 'الطلاء والتشطيب', labelEn: 'Paint / finish', sortOrder: 4 },
    { code: 'FABRIC', labelAr: 'القماش والتنجيد', labelEn: 'Fabric / upholstery', sortOrder: 5 },
    { code: 'STITCH', labelAr: 'الخياطة', labelEn: 'Stitching', sortOrder: 6 },
    { code: 'FOAM', labelAr: 'الإسفنج والراحة', labelEn: 'Foam / comfort', sortOrder: 7 },
    { code: 'ASSEMBLY', labelAr: 'التجميع', labelEn: 'Assembly', sortOrder: 8 },
    { code: 'HARDWARE', labelAr: 'الملحقات', labelEn: 'Hardware', sortOrder: 9 },
    { code: 'COLOR', labelAr: 'مطابقة اللون والموديل', labelEn: 'Color / model match', sortOrder: 10 },
    { code: 'QTY', labelAr: 'الكمية والمكونات', labelEn: 'Quantity / components', sortOrder: 11 },
    { code: 'DAMAGE', labelAr: 'أضرار ظاهرة', labelEn: 'Visible damage', sortOrder: 12 },
    { code: 'CLEAN', labelAr: 'نظافة القطعة', labelEn: 'Cleanliness', sortOrder: 13 },
    { code: 'SPEC', labelAr: 'مطابقة المواصفات', labelEn: 'Order / custom specification match', sortOrder: 14 },
  ];
  for (const item of furnitureChecks) {
    const existing = await prisma.qualityChecklistItem.findFirst({
      where: { templateId: finalQc.id, code: item.code },
    });
    if (existing) {
      await prisma.qualityChecklistItem.update({
        where: { id: existing.id },
        data: {
          labelAr: item.labelAr,
          labelEn: item.labelEn,
          sortOrder: item.sortOrder,
        },
      });
    } else {
      await prisma.qualityChecklistItem.create({
        data: { templateId: finalQc.id, ...item },
      });
    }
  }

  const templates = [
    {
      code: 'QUOTE_SENT',
      channel: 'EMAIL',
      subjectAr: 'عرض سعر جديد',
      subjectEn: 'New quotation',
      subjectHe: 'הצעת מחיר חדשה',
      bodyAr: 'تم إرسال عرض السعر {{number}} بمبلغ {{total}} شيكل.',
      bodyEn: 'Quotation {{number}} for {{total}} ILS has been sent.',
      bodyHe: 'הצעת מחיר {{number}} בסך {{total}} נשלחה.',
    },
    {
      code: 'QUOTE_ACCEPTED',
      channel: 'IN_APP',
      subjectAr: 'قبل التاجر عرض السعر',
      subjectEn: 'Dealer accepted quotation',
      subjectHe: 'הסוחר קיבל את הצעת המחיר',
      bodyAr: 'قبل التاجر عرض السعر {{number}} بمبلغ {{total}}.',
      bodyEn: 'The dealer accepted quotation {{number}} for {{total}}.',
      bodyHe: 'הסוחר קיבל את הצעת המחיר {{number}} בסך {{total}}.',
    },
    {
      code: 'QUOTE_REJECTED',
      channel: 'IN_APP',
      subjectAr: 'رفض التاجر عرض السعر',
      subjectEn: 'Dealer rejected quotation',
      subjectHe: 'הסוחר דחה את הצעת המחיר',
      bodyAr: 'رفض التاجر عرض السعر {{number}}.',
      bodyEn: 'The dealer rejected quotation {{number}}.',
      bodyHe: 'הסוחר דחה את הצעת המחיר {{number}}.',
    },
    {
      code: 'QUOTE_REVISION_REQUESTED',
      channel: 'IN_APP',
      subjectAr: 'طلب التاجر تعديل العرض',
      subjectEn: 'Dealer requested quotation revision',
      subjectHe: 'הסוחר ביקש תיקון להצעת המחיר',
      bodyAr: 'طلب التاجر تعديل عرض السعر {{number}}.',
      bodyEn: 'The dealer requested a revision of quotation {{number}}.',
      bodyHe: 'הסוחר ביקש לתקן את הצעת המחיר {{number}}.',
    },
    {
      code: 'ORDER_CONFIRMED',
      channel: 'EMAIL',
      subjectAr: 'تأكيد الطلبية',
      subjectEn: 'Sales order confirmed',
      subjectHe: 'הזמנה אושרה',
      bodyAr: 'تم تأكيد الطلبية {{number}}.',
      bodyEn: 'Sales order {{number}} is confirmed.',
      bodyHe: 'הזמנת מכירה {{number}} אושרה.',
    },
    {
      code: 'PAYMENT_RECEIVED',
      channel: 'WHATSAPP',
      subjectAr: 'استلام دفعة',
      subjectEn: 'Payment received',
      subjectHe: 'תשלום התקבל',
      bodyAr: 'تم استلام دفعة بمبلغ {{amount}} شيكل.',
      bodyEn: 'Payment of {{amount}} ILS received.',
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
      code: 'MATERIAL_OVER_ISSUE',
      channel: 'IN_APP',
      subjectAr: 'تجاوز كمية المواد',
      subjectEn: 'Material over-issue',
      subjectHe: 'חריגת חומר',
      bodyAr:
        '{{workerName}} استخدم {{actual}} من {{sku}} على {{orderNumber}} / {{taskName}} (المخطط {{expected}}). {{reason}}',
      bodyEn:
        '{{workerName}} used {{actual}} of {{sku}} on {{orderNumber}} / {{taskName}} (planned {{expected}}). {{reason}}',
      bodyHe:
        '{{workerName}} השתמש ב-{{actual}} מ-{{sku}} ב-{{orderNumber}} / {{taskName}} (מתוכנן {{expected}}). {{reason}}',
    },
    {
      code: 'MATERIAL_UNDER_ISSUE',
      channel: 'IN_APP',
      subjectAr: 'استخدام مواد أقل من المخطط',
      subjectEn: 'Material under-issue',
      subjectHe: 'שימוש חסר בחומר',
      bodyAr:
        '{{workerName}} استخدم {{actual}} من {{sku}} على {{orderNumber}} / {{taskName}} (المخطط {{expected}}). {{reason}}',
      bodyEn:
        '{{workerName}} used {{actual}} of {{sku}} on {{orderNumber}} / {{taskName}} (planned {{expected}}). {{reason}}',
      bodyHe:
        '{{workerName}} השתמש ב-{{actual}} מ-{{sku}} ב-{{orderNumber}} / {{taskName}} (מתוכנן {{expected}}). {{reason}}',
    },
    {
      code: 'MATERIAL_EXTRA_ISSUE',
      channel: 'IN_APP',
      subjectAr: 'مادة إضافية خارج الخطة',
      subjectEn: 'Extra material used',
      subjectHe: 'חומר נוסף מחוץ לתוכנית',
      bodyAr:
        '{{workerName}} أضاف {{sku}} ({{actual}}) على {{orderNumber}} / {{taskName}}. {{reason}}',
      bodyEn:
        '{{workerName}} added extra {{sku}} ({{actual}}) on {{orderNumber}} / {{taskName}}. {{reason}}',
      bodyHe:
        '{{workerName}} הוסיף {{sku}} ({{actual}}) ב-{{orderNumber}} / {{taskName}}. {{reason}}',
    },
    {
      code: 'PRODUCTION_PROBLEM_ANSWERED',
      channel: 'IN_APP',
      subjectAr: 'رد على مشكلة الإنتاج',
      subjectEn: 'Production problem answered',
      subjectHe: 'תשובה לבעיית ייצור',
      bodyAr: 'رد المشرف على مشكلتك في {{orderNumber}} / {{taskName}}: {{resolution}}',
      bodyEn: 'A supervisor answered your problem on {{orderNumber}} / {{taskName}}: {{resolution}}',
      bodyHe: 'מנהל ענה לבעיה שלך ב-{{orderNumber}} / {{taskName}}: {{resolution}}',
    },
    {
      code: 'EXECUTION_RIPPLE',
      channel: 'IN_APP',
      subjectAr: 'تعديل جدول بسبب الوقت الفعلي',
      subjectEn: 'Schedule shifted from actual time',
      subjectHe: 'הלוח זז בגלל זמן בפועל',
      bodyAr: '{{workerName}} اختار {{mode}} على {{orderNumber}}. الدفعة {{rippleBatchId}}.',
      bodyEn: '{{workerName}} chose {{mode}} on {{orderNumber}}. Batch {{rippleBatchId}}.',
      bodyHe: '{{workerName}} בחר {{mode}} ב-{{orderNumber}}. אצווה {{rippleBatchId}}.',
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
      code: 'ORDER_NEEDS_INFORMATION',
      channel: 'IN_APP',
      subjectAr: 'الطلب يحتاج معلومات',
      subjectEn: 'Order needs information',
      subjectHe: 'ההזמנה דורשת מידע',
      bodyAr: 'طلبك {{number}} يحتاج معلومات إضافية: {{reason}}',
      bodyEn: 'Your order {{number}} needs more information: {{reason}}',
      bodyHe: 'ההזמנה {{number}} דורשת מידע נוסף: {{reason}}',
    },
    {
      code: 'ORDER_PRODUCTION_SETUP',
      channel: 'IN_APP',
      subjectAr: 'الطلب مقبول — إعداد الإنتاج',
      subjectEn: 'Order accepted — production setup',
      subjectHe: 'ההזמנה התקבלה — הכנת ייצור',
      bodyAr: 'تم قبول الطلبية {{number}}. المصنع يعد الإنتاج.',
      bodyEn: 'Sales order {{number}} was accepted. The factory will prepare production.',
      bodyHe: 'הזמנת מכירה {{number}} התקבלה. המפעל יכין את הייצור.',
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
      subjectAr: 'الطلب غادر المصنع',
      subjectEn: 'Order left the factory',
      subjectHe: 'ההזמנה יצאה מהמפעל',
      bodyAr: 'الطلب {{number}} غادر المصنع وهو في الطريق إليك.',
      bodyEn: 'Order {{number}} has left the factory and is on its way to you.',
      bodyHe: 'הזמנה {{number}} יצאה מהמפעל ובדרך אליך.',
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
      code: 'RETURN_RECEIVED',
      channel: 'IN_APP',
      subjectAr: 'وصول المرتجع للمصنع',
      subjectEn: 'Return received at factory',
      subjectHe: 'ההחזרה התקבלה במפעל',
      bodyAr: 'وصل المرتجع {{number}} إلى المصنع.',
      bodyEn: 'Return {{number}} arrived at the factory.',
      bodyHe: 'החזרה {{number}} הגיעה למפעל.',
    },
    {
      code: 'RETURN_NEED_INFO',
      channel: 'IN_APP',
      subjectAr: 'المرتجع يحتاج معلومات',
      subjectEn: 'Return needs information',
      subjectHe: 'ההחזרה דורשת מידע',
      bodyAr: 'طلب المرتجع {{number}} يحتاج معلومات إضافية: {{note}}',
      bodyEn: 'Return {{number}} needs more information: {{note}}',
      bodyHe: 'החזרה {{number}} דורשת מידע נוסף: {{note}}',
    },
    {
      code: 'RETURN_DECISION',
      channel: 'IN_APP',
      subjectAr: 'قرار المصنع على المرتجع',
      subjectEn: 'Factory decision on your return',
      subjectHe: 'החלטת המפעל על ההחזרה',
      bodyAr: 'اتخذ المصنع قراراً على المرتجع {{number}}.',
      bodyEn: 'The factory made a decision on return {{number}}.',
      bodyHe: 'המפעל קיבל החלטה על החזרה {{number}}.',
    },
    {
      code: 'RETURN_WORK_STARTED',
      channel: 'IN_APP',
      subjectAr: 'بدأ عمل المصنع على المرتجع',
      subjectEn: 'Factory work started on your return',
      subjectHe: 'עבודת המפעל על ההחזרה החלה',
      bodyAr: 'بدأ المصنع العمل على المرتجع {{number}}.',
      bodyEn: 'Factory work started on return {{number}}.',
      bodyHe: 'עבודת המפעל על החזרה {{number}} החלה.',
    },
    {
      code: 'RETURN_READY',
      channel: 'IN_APP',
      subjectAr: 'المرتجع جاهز للإعادة',
      subjectEn: 'Return is ready to ship back',
      subjectHe: 'ההחזרה מוכנה למשלוח חזרה',
      bodyAr: 'المرتجع {{number}} جاهز للإعادة إليك.',
      bodyEn: 'Return {{number}} is ready to ship back to you.',
      bodyHe: 'החזרה {{number}} מוכנה למשלוח חזרה אליך.',
    },
    {
      code: 'RETURN_RESHIP_SCHEDULED',
      channel: 'IN_APP',
      subjectAr: 'تم جدولة إعادة المرتجع',
      subjectEn: 'Return shipment scheduled',
      subjectHe: 'משלוח ההחזרה נקבע',
      bodyAr: 'تم جدولة شحنة إعادة المرتجع {{number}} ({{delivery}}).',
      bodyEn: 'Return {{number}} is scheduled for shipment ({{delivery}}).',
      bodyHe: 'משלוח החזרה {{number}} נקבע ({{delivery}}).',
    },
    {
      code: 'RETURN_DELIVERED',
      channel: 'IN_APP',
      subjectAr: 'وصل المرتجع',
      subjectEn: 'Return delivered',
      subjectHe: 'ההחזרה נמסרה',
      bodyAr: 'وصل المرتجع {{number}} إليك.',
      bodyEn: 'Return {{number}} was delivered.',
      bodyHe: 'החזרה {{number}} נמסרה.',
    },
    {
      code: 'RETURN_CHARGED',
      channel: 'IN_APP',
      subjectAr: 'فاتورة مرتجع',
      subjectEn: 'Return invoice created',
      subjectHe: 'נוצרה חשבונית החזרה',
      bodyAr: 'تم إنشاء الفاتورة {{invoice}} للمرتجع {{number}} بمبلغ {{total}}.',
      bodyEn: 'Invoice {{invoice}} for return {{number}} ({{total}}) was created.',
      bodyHe: 'נוצרה חשבונית {{invoice}} להחזרה {{number}} בסך {{total}}.',
    },
    {
      code: 'RETURN_CHARGE_PROPOSED',
      channel: 'IN_APP',
      subjectAr: 'مبلغ مرتجع بانتظار تأكيدك',
      subjectEn: 'Return charge awaiting your confirmation',
      subjectHe: 'חיוב החזרה ממתין לאישורך',
      bodyAr: 'المصنع يقترح مبلغ {{amount}} للمرتجع {{number}}. أكّد أو ارفض المبلغ.',
      bodyEn: 'The factory proposed {{amount}} for return {{number}}. Confirm or reject the amount.',
      bodyHe: 'המפעל הציע {{amount}} להחזרה {{number}}. אשרו או דחו את הסכום.',
    },
    {
      code: 'RETURN_CHARGE_REJECTED',
      channel: 'IN_APP',
      subjectAr: 'التاجر رفض مبلغ المرتجع',
      subjectEn: 'Dealer rejected the return charge',
      subjectHe: 'הסוחר דחה את חיוב ההחזרה',
      bodyAr: 'رفض التاجر مبلغ المرتجع {{number}}: {{note}}',
      bodyEn: 'The dealer rejected the charge for return {{number}}: {{note}}',
      bodyHe: 'הסוחר דחה את החיוב להחזרה {{number}}: {{note}}',
    },
    {
      code: 'INVOICE_CREATED',
      channel: 'IN_APP',
      subjectAr: 'فاتورة جديدة',
      subjectEn: 'Invoice created',
      subjectHe: 'חשבונית נוצרה',
      bodyAr: 'تم إنشاء الفاتورة {{number}} بمبلغ {{total}} شيكل.',
      bodyEn: 'Invoice {{number}} for {{total}} ILS was created.',
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
      code: 'DELIVERY_MAY_BE_DELAYED',
      channel: 'IN_APP',
      subjectAr: 'قد يتأخر التسليم',
      subjectEn: 'Delivery may be delayed',
      subjectHe: 'ייתכן עיכוב באספקה',
      bodyAr: 'الإنتاج يستغرق وقتاً أطول من المتوقع لأمر {{orderNumber}}. التاريخ المؤكد يبقى {{date}}.',
      bodyEn: 'Production is taking longer than expected for order {{orderNumber}}. The confirmed date remains {{date}}.',
      bodyHe: 'הייצור אורך יותר מהצפוי להזמנה {{orderNumber}}. התאריך המאושר נשאר {{date}}.',
    },
    {
      code: 'DELIVERY_COMPLETED',
      channel: 'IN_APP',
      subjectAr: 'تم التسليم',
      subjectEn: 'Order delivered',
      subjectHe: 'ההזמנה נמסרה',
      bodyAr: 'تم تسليم أمر {{orderNumber}} بتاريخ {{date}}.',
      bodyEn: 'Order {{orderNumber}} was delivered on {{date}}.',
      bodyHe: 'הזמנה {{orderNumber}} נמסרה בתאריך {{date}}.',
    },
    {
      code: 'SCHEDULE_AT_RISK',
      channel: 'IN_APP',
      subjectAr: 'جدول إنتاج معرّض للتأخير',
      subjectEn: 'Production schedule at risk',
      subjectHe: 'לוח ייצור בסיכון',
      bodyAr: 'جدول أمر الإنتاج {{orderNumber}} معرّض للتأخير. السبب: {{reason}}.',
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
  await seedNotificationTopicTemplates(prisma);

  const returns = await prisma.returnRequest.findMany({
    select: {
      id: true,
      lifecycleState: true,
      approvalStatus: true,
      physicalStatus: true,
      inventoryFate: true,
    },
  });
  for (const row of returns) {
    const approval = String(row.approvalStatus ?? 'PENDING').trim().toUpperCase();
    const physical = String(row.physicalStatus ?? 'NONE').trim().toUpperCase();
    const fate = String(row.inventoryFate ?? 'PENDING').trim().toUpperCase();
    const next =
      approval === 'REJECTED'
        ? 'REJECTED'
        : physical === 'RESOLVED'
          ? 'COMPLETED'
          : fate === 'RETURN_TO_STOCK'
            ? 'RETURNED_TO_STOCK'
            : fate === 'DAMAGED' || fate === 'SCRAP'
              ? 'SCRAPPED'
              : fate === 'REWORK'
                ? 'REWORKING'
                : physical === 'INSPECTING'
                  ? 'INSPECTING'
                  : physical === 'RETURNED'
                    ? 'RECEIVED'
                    : physical === 'WAITING_RETURN' || approval === 'APPROVED'
                      ? 'APPROVED'
                      : approval === 'NEED_INFO'
                        ? 'NEED_INFO'
                        : 'REQUESTED';
    if (row.lifecycleState === next) continue;
    await prisma.returnRequest.update({
      where: { id: row.id },
      data: { lifecycleState: next },
    });
  }
}

export function preservedRoleCodes(): string[] {
  return [...ROLES, ...Object.values(SYSTEM_STAFF_PRESETS).map((p) => p.code)];
}
