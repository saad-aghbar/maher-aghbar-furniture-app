import { PrismaClient, Locale, CustomerStatus, CustomerType, InventoryCategory } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS } from '@maher/permissions';

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
    SALES_REPRESENTATIVE: { nameAr: 'مندوب مبيعات', nameEn: 'Sales Representative' },
    SALES_MANAGER: { nameAr: 'مدير مبيعات', nameEn: 'Sales Manager' },
    PURCHASING_EMPLOYEE: { nameAr: 'موظف مشتريات', nameEn: 'Purchasing Employee' },
    PURCHASING_MANAGER: { nameAr: 'مدير مشتريات', nameEn: 'Purchasing Manager' },
    WAREHOUSE_EMPLOYEE: { nameAr: 'موظف مستودع', nameEn: 'Warehouse Employee' },
    WAREHOUSE_MANAGER: { nameAr: 'مدير مستودع', nameEn: 'Warehouse Manager' },
    PRODUCTION_WORKER: { nameAr: 'عامل إنتاج', nameEn: 'Production Worker' },
    PRODUCTION_SUPERVISOR: { nameAr: 'مشرف إنتاج', nameEn: 'Production Supervisor' },
    QUALITY_INSPECTOR: { nameAr: 'مفتش جودة', nameEn: 'Quality Inspector' },
    DELIVERY_EMPLOYEE: { nameAr: 'موظف توصيل', nameEn: 'Delivery Employee' },
    ACCOUNTANT: { nameAr: 'محاسب', nameEn: 'Accountant' },
    FINANCE_MANAGER: { nameAr: 'مدير مالية', nameEn: 'Finance Manager' },
    GENERAL_MANAGER: { nameAr: 'مدير عام', nameEn: 'General Manager' },
    SYSTEM_ADMINISTRATOR: { nameAr: 'مسؤول النظام', nameEn: 'System Administrator' },
  };

  for (const code of ROLES) {
    const meta = roleMeta[code] ?? { nameAr: code, nameEn: code };
    const role = await prisma.role.upsert({
      where: { code },
      update: { nameAr: meta.nameAr, nameEn: meta.nameEn },
      create: { code, nameAr: meta.nameAr, nameEn: meta.nameEn },
    });

    const perms = ROLE_PERMISSIONS[code as keyof typeof ROLE_PERMISSIONS] ?? [];
    for (const permCode of perms) {
      const permission = await prisma.permission.findUnique({ where: { code: permCode } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
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

  const stages = [
    { code: 'MATERIAL_PREP', nameAr: 'تجهيز المواد', nameEn: 'Material preparation', sortOrder: 1 },
    { code: 'CARPENTRY', nameAr: 'النجارة', nameEn: 'Carpentry', sortOrder: 2 },
    { code: 'PAINTING', nameAr: 'الدهان', nameEn: 'Painting', sortOrder: 3 },
    { code: 'UPHOLSTERY', nameAr: 'التنجيد', nameEn: 'Upholstery', sortOrder: 4 },
    { code: 'ASSEMBLY', nameAr: 'التجميع', nameEn: 'Assembly', sortOrder: 5 },
    { code: 'INSPECTION', nameAr: 'الفحص', nameEn: 'Inspection', sortOrder: 6, requiresInspection: true },
    { code: 'PACKAGING', nameAr: 'التغليف', nameEn: 'Packaging', sortOrder: 7 },
    { code: 'DELIVERY', nameAr: 'التسليم', nameEn: 'Delivery', sortOrder: 8 },
  ];
  for (const s of stages) {
    await prisma.productionStageDefinition.upsert({
      where: { code: s.code },
      update: {},
      create: {
        code: s.code,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        sortOrder: s.sortOrder,
        requiresInspection: s.requiresInspection ?? false,
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

  const passwordHash = hashSync('Admin@12345!', 12);

  async function ensureUser(opts: {
    email: string;
    firstName: string;
    lastName: string;
    roleCode: string;
    phone?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: opts.email } });
    if (existing) return existing;
    const role = await prisma.role.findUniqueOrThrow({ where: { code: opts.roleCode } });
    return prisma.user.create({
      data: {
        email: opts.email,
        phone: opts.phone,
        passwordHash,
        firstName: opts.firstName,
        lastName: opts.lastName,
        preferredLanguage: Locale.ar,
        isEmailVerified: true,
        isActive: true,
        roles: { create: { roleId: role.id } },
      },
    });
  }

  await ensureUser({
    email: 'admin@maher-aghbar.jo',
    firstName: 'System',
    lastName: 'Admin',
    roleCode: 'SYSTEM_ADMINISTRATOR',
    phone: '+962790000001',
  });
  await ensureUser({
    email: 'sales@maher-aghbar.jo',
    firstName: 'Sara',
    lastName: 'Saleh',
    roleCode: 'SALES_MANAGER',
    phone: '+962790000002',
  });
  await ensureUser({
    email: 'worker@maher-aghbar.jo',
    firstName: 'Ahmad',
    lastName: 'Najjar',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000003',
  });

  const customer = await prisma.customer.upsert({
    where: { code: 'CUS-0001' },
    update: {},
    create: {
      code: 'CUS-0001',
      name: 'فندق الأرز',
      nameAr: 'فندق الأرز',
      customerType: CustomerType.COMPANY,
      companyName: 'Cedar Hotel Group',
      status: CustomerStatus.ACTIVE,
      phone: '+96265551234',
      email: 'procurement@cedar-hotel.jo',
      preferredLanguage: Locale.ar,
      paymentTermsDays: 30,
      industry: 'Hospitality',
      contacts: {
        create: {
          name: 'ليلى حسن',
          position: 'Purchasing',
          phone: '+962790000010',
          email: 'laila@cedar-hotel.jo',
          isPrimary: true,
        },
      },
      addresses: {
        create: {
          label: 'Main',
          city: 'Amman',
          area: 'Abdoun',
          street: 'Cedar Street 12',
          isDefaultBilling: true,
          isDefaultDelivery: true,
        },
      },
    },
  });

  const customerRole = await prisma.role.findUniqueOrThrow({ where: { code: 'CUSTOMER' } });
  const existingCustUser = await prisma.user.findUnique({ where: { email: 'customer@cedar-hotel.jo' } });
  if (!existingCustUser) {
    await prisma.user.create({
      data: {
        email: 'customer@cedar-hotel.jo',
        passwordHash,
        firstName: 'Laila',
        lastName: 'Hassan',
        preferredLanguage: Locale.ar,
        isEmailVerified: true,
        customerId: customer.id,
        roles: { create: { roleId: customerRole.id } },
      },
    });
  }

  const categories = [
    { code: 'SOFA', nameAr: 'كنب', nameEn: 'Sofas' },
    { code: 'CHAIR', nameAr: 'كراسي', nameEn: 'Chairs' },
    { code: 'BED', nameAr: 'غرف نوم', nameEn: 'Bedroom' },
    { code: 'CUSTOM', nameAr: 'تفصيل', nameEn: 'Custom' },
  ];
  for (const c of categories) {
    await prisma.productCategory.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }

  const sofaCat = await prisma.productCategory.findUniqueOrThrow({ where: { code: 'SOFA' } });
  await prisma.product.upsert({
    where: { sku: 'SOF-3S' },
    update: {},
    create: {
      sku: 'SOF-3S',
      nameAr: 'كنبة ثلاثية',
      nameEn: '3-Seater Sofa',
      categoryId: sofaCat.id,
      basePrice: 850,
      unit: 'pcs',
    },
  });
  await prisma.product.upsert({
    where: { sku: 'ARM-01' },
    update: {},
    create: {
      sku: 'ARM-01',
      nameAr: 'كرسي بذراعين',
      nameEn: 'Armchair',
      categoryId: sofaCat.id,
      basePrice: 320,
      unit: 'pcs',
    },
  });

  await prisma.fabric.upsert({
    where: { code: 'FAB-VEL-01' },
    update: {},
    create: { code: 'FAB-VEL-01', nameAr: 'قطيفة رمادي', nameEn: 'Grey Velvet', color: 'Grey' },
  });

  const materials = [
    { sku: 'WOOD-BEECH', nameAr: 'خشب زان', nameEn: 'Beech wood', category: InventoryCategory.WOOD, unit: 'm', minStock: 50 },
    { sku: 'FOAM-HD', nameAr: 'إسفنج عالي الكثافة', nameEn: 'HD Foam', category: InventoryCategory.FOAM, unit: 'm3', minStock: 10 },
    { sku: 'FAB-ROLL', nameAr: 'قماش تنجيد', nameEn: 'Upholstery fabric', category: InventoryCategory.FABRIC, unit: 'm', minStock: 100 },
  ];
  for (const m of materials) {
    const material = await prisma.material.upsert({
      where: { sku: m.sku },
      update: {},
      create: m,
    });
    await prisma.inventoryItem.upsert({
      where: { sku: m.sku },
      update: {},
      create: {
        sku: m.sku,
        barcode: `BC-${m.sku}`,
        nameAr: m.nameAr,
        nameEn: m.nameEn,
        category: m.category,
        unit: m.unit,
        minStock: m.minStock,
        materialId: material.id,
      },
    });
  }

  const rawWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'RAW' } });
  const wood = await prisma.inventoryItem.findUniqueOrThrow({ where: { sku: 'WOOD-BEECH' } });
  await prisma.inventoryBalance.upsert({
    where: {
      inventoryItemId_warehouseId_locationId: {
        inventoryItemId: wood.id,
        warehouseId: rawWh.id,
        locationId: null as unknown as string,
      },
    },
    update: { availableQty: 120 },
    create: {
      inventoryItemId: wood.id,
      warehouseId: rawWh.id,
      availableQty: 120,
      reservedQty: 0,
    },
  }).catch(async () => {
    const existing = await prisma.inventoryBalance.findFirst({
      where: { inventoryItemId: wood.id, warehouseId: rawWh.id },
    });
    if (existing) {
      await prisma.inventoryBalance.update({
        where: { id: existing.id },
        data: { availableQty: 120 },
      });
    } else {
      await prisma.inventoryBalance.create({
        data: {
          inventoryItemId: wood.id,
          warehouseId: rawWh.id,
          availableQty: 120,
        },
      });
    }
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
  ];
  for (const tpl of templates) {
    await prisma.notificationTemplate.upsert({
      where: { code: tpl.code },
      create: tpl,
      update: tpl,
    });
  }

  console.log('Seed complete.');
  console.log('Demo logins (password: Admin@12345!):');
  console.log('  admin@maher-aghbar.jo');
  console.log('  sales@maher-aghbar.jo');
  console.log('  worker@maher-aghbar.jo');
  console.log('  customer@cedar-hotel.jo');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
