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
  }> = [
    {
      code: 'MATERIAL_PREP',
      nameAr: 'تجهيز المواد',
      nameEn: 'Material preparation',
      sortOrder: 1,
      dependsOnCodes: [],
    },
    {
      code: 'CARPENTRY',
      nameAr: 'النجارة',
      nameEn: 'Carpentry',
      sortOrder: 2,
      dependsOnCodes: ['MATERIAL_PREP'],
    },
    {
      code: 'PAINTING',
      nameAr: 'الدهان',
      nameEn: 'Painting',
      sortOrder: 3,
      dependsOnCodes: ['MATERIAL_PREP'],
    },
    {
      code: 'UPHOLSTERY',
      nameAr: 'التنجيد',
      nameEn: 'Upholstery',
      sortOrder: 4,
      dependsOnCodes: ['CARPENTRY'],
    },
    {
      code: 'ASSEMBLY',
      nameAr: 'التجميع',
      nameEn: 'Assembly',
      sortOrder: 5,
      dependsOnCodes: ['CARPENTRY', 'PAINTING', 'UPHOLSTERY'],
    },
    {
      code: 'INSPECTION',
      nameAr: 'الفحص',
      nameEn: 'Inspection',
      sortOrder: 6,
      requiresInspection: true,
      dependsOnCodes: ['ASSEMBLY'],
    },
    {
      code: 'PACKAGING',
      nameAr: 'التغليف',
      nameEn: 'Packaging',
      sortOrder: 7,
      dependsOnCodes: ['INSPECTION'],
    },
    {
      code: 'DELIVERY',
      nameAr: 'التسليم',
      nameEn: 'Delivery',
      sortOrder: 8,
      dependsOnCodes: ['PACKAGING'],
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
      },
      create: {
        code: s.code,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        sortOrder: s.sortOrder,
        dependsOnCodes: s.dependsOnCodes,
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
  await ensureUser({
    email: 'carpenter@maher-aghbar.jo',
    firstName: 'Yousef',
    lastName: 'Carpenter',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000011',
  });
  await ensureUser({
    email: 'painter@maher-aghbar.jo',
    firstName: 'Omar',
    lastName: 'Painter',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000012',
  });
  await ensureUser({
    email: 'upholsterer@maher-aghbar.jo',
    firstName: 'Sami',
    lastName: 'Upholsterer',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000013',
  });
  await ensureUser({
    email: 'assembler@maher-aghbar.jo',
    firstName: 'Khaled',
    lastName: 'Assembler',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000014',
  });
  await ensureUser({
    email: 'packer@maher-aghbar.jo',
    firstName: 'Nour',
    lastName: 'Packer',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000015',
  });

  const customer = await prisma.customer.upsert({
    where: { code: 'CUS-0001' },
    update: {
      nameAr: 'فندق الأرز',
      nameEn: 'Cedar Hotel',
      nameHe: 'מלון הארז',
    },
    create: {
      code: 'CUS-0001',
      name: 'فندق الأرز',
      nameAr: 'فندق الأرز',
      nameEn: 'Cedar Hotel',
      nameHe: 'מלון הארז',
      customerType: CustomerType.COMPANY,
      companyName: 'Cedar Hotel Group',
      status: CustomerStatus.ACTIVE,
      phone: '+96265551234',
      fax: '+96265551235',
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
  } else if (!existingCustUser.customerId) {
    await prisma.user.update({
      where: { id: existingCustUser.id },
      data: { customerId: customer.id },
    });
  }

  // Second demo customer — proves multi-customer isolation in portal logins.
  const customer2 = await prisma.customer.upsert({
    where: { code: 'CUS-0002' },
    update: {
      nameAr: 'مطعم الزيتون',
      nameEn: 'Olive Restaurant',
      nameHe: 'מסעדת הזית',
    },
    create: {
      code: 'CUS-0002',
      name: 'مطعم الزيتون',
      nameAr: 'مطعم الزيتون',
      nameEn: 'Olive Restaurant',
      nameHe: 'מסעדת הזית',
      customerType: CustomerType.COMPANY,
      companyName: 'Olive Restaurant LLC',
      status: CustomerStatus.ACTIVE,
      phone: '+96265559876',
      email: 'orders@olive-restaurant.jo',
      preferredLanguage: Locale.ar,
      paymentTermsDays: 14,
      industry: 'F&B',
      contacts: {
        create: {
          name: 'سارة عمر',
          position: 'Owner',
          phone: '+962790000020',
          email: 'sara@olive-restaurant.jo',
          isPrimary: true,
        },
      },
      addresses: {
        create: {
          label: 'Main',
          city: 'Amman',
          area: 'Jabal Amman',
          street: 'Rainbow Street 8',
          isDefaultBilling: true,
          isDefaultDelivery: true,
        },
      },
    },
  });

  const existingOliveUser = await prisma.user.findUnique({
    where: { email: 'customer@olive-restaurant.jo' },
  });
  if (!existingOliveUser) {
    await prisma.user.create({
      data: {
        email: 'customer@olive-restaurant.jo',
        passwordHash,
        firstName: 'Sara',
        lastName: 'Omar',
        preferredLanguage: Locale.ar,
        isEmailVerified: true,
        customerId: customer2.id,
        roles: { create: { roleId: customerRole.id } },
      },
    });
  } else if (!existingOliveUser.customerId) {
    await prisma.user.update({
      where: { id: existingOliveUser.id },
      data: { customerId: customer2.id },
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

  // Demo customer workflow: quote → sales order → production stages → invoice
  const salesUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'sales@maher-aghbar.jo' },
  });
  const workerUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'worker@maher-aghbar.jo' },
  });
  const carpenter = await prisma.user.findUniqueOrThrow({
    where: { email: 'carpenter@maher-aghbar.jo' },
  });
  const painter = await prisma.user.findUniqueOrThrow({
    where: { email: 'painter@maher-aghbar.jo' },
  });
  const upholsterer = await prisma.user.findUniqueOrThrow({
    where: { email: 'upholsterer@maher-aghbar.jo' },
  });
  const assembler = await prisma.user.findUniqueOrThrow({
    where: { email: 'assembler@maher-aghbar.jo' },
  });
  const packer = await prisma.user.findUniqueOrThrow({
    where: { email: 'packer@maher-aghbar.jo' },
  });
  const stageAssignee: Record<string, string> = {
    MATERIAL_PREP: workerUser.id,
    CARPENTRY: carpenter.id,
    PAINTING: painter.id,
    UPHOLSTERY: upholsterer.id,
    ASSEMBLY: assembler.id,
    INSPECTION: workerUser.id,
    PACKAGING: packer.id,
    DELIVERY: packer.id,
  };
  const sofa = await prisma.product.findUniqueOrThrow({ where: { sku: 'SOF-3S' } });
  const stageDefs = await prisma.productionStageDefinition.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  const demoQuote = await prisma.quotation.upsert({
    where: { number_version: { number: 'Q-DEMO-001', version: 1 } },
    update: {},
    create: {
      number: 'Q-DEMO-001',
      version: 1,
      customerId: customer.id,
      status: 'SENT',
      paymentTerms: '30 days',
      deliveryTerms: 'Amman delivery included',
      subtotal: 2550,
      taxTotal: 408,
      total: 2958,
      sentAt: new Date(),
      createdById: salesUser.id,
      salesRepId: salesUser.id,
      lines: {
        create: [
          {
            productId: sofa.id,
            description: '3-Seater Sofa — lobby set',
            quantity: 3,
            unitPrice: 850,
            taxRate: 0.16,
            subtotal: 2550,
            taxAmount: 408,
            lineTotal: 2958,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  let demoSo = await prisma.salesOrder.findUnique({ where: { number: 'SO-DEMO-001' } });
  if (!demoSo) {
    demoSo = await prisma.salesOrder.create({
      data: {
        number: 'SO-DEMO-001',
        customerId: customer.id,
        quotationId: demoQuote.id,
        status: 'CONFIRMED',
        deliveryAddress: 'Cedar Street 12, Abdoun, Amman',
        requiredDeliveryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21),
        projectName: 'Cedar Hotel lobby refresh',
        subtotal: 2550,
        taxTotal: 408,
        total: 2958,
        createdById: salesUser.id,
        lines: {
          create: [
            {
              productId: sofa.id,
              description: '3-Seater Sofa — lobby set',
              quantity: 3,
              unitPrice: 850,
              taxRate: 0.16,
              lineTotal: 2958,
              productionRequired: true,
              sortOrder: 0,
            },
          ],
        },
      },
    });
  }

  let demoPo = await prisma.productionOrder.findUnique({ where: { number: 'PO-DEMO-001' } });
  if (!demoPo && stageDefs.length) {
    demoPo = await prisma.productionOrder.create({
      data: {
        number: 'PO-DEMO-001',
        salesOrderId: demoSo.id,
        customerId: customer.id,
        productId: sofa.id,
        productDescription: '3-Seater Sofa — lobby set',
        quantity: 3,
        status: 'IN_PROGRESS',
        currentStageCode: 'CARPENTRY',
        progressPercent: 12,
        requiredDeliveryDate: demoSo.requiredDeliveryDate,
        createdById: salesUser.id,
        stages: {
          create: stageDefs.map((stage) => {
            const code = stage.code;
            const status =
              code === 'MATERIAL_PREP'
                ? 'COMPLETED'
                : code === 'CARPENTRY'
                  ? 'IN_PROGRESS'
                  : code === 'PAINTING'
                    ? 'READY'
                    : 'PENDING';
            return {
              stageDefinitionId: stage.id,
              status,
              progressPercent: status === 'COMPLETED' ? 100 : status === 'IN_PROGRESS' ? 40 : 0,
              actualStart:
                status === 'COMPLETED' || status === 'IN_PROGRESS'
                  ? new Date(Date.now() - 1000 * 60 * 60 * 24)
                  : undefined,
              actualEnd: status === 'COMPLETED' ? new Date(Date.now() - 1000 * 60 * 60 * 12) : undefined,
            };
          }),
        },
      },
      include: { stages: true },
    });

    for (const stageInstance of demoPo.stages) {
      const stageDef = stageDefs.find((s) => s.id === stageInstance.stageDefinitionId)!;
      const taskNumber = `TSK-DEMO-${stageDef.code}`;
      const existingTask = await prisma.productionTask.findUnique({ where: { number: taskNumber } });
      if (existingTask) continue;
      await prisma.productionTask.create({
        data: {
          number: taskNumber,
          productionOrderId: demoPo.id,
          stageDefinitionId: stageDef.id,
          stageInstanceId: stageInstance.id,
          name: stageDef.nameEn,
          status:
            stageInstance.status === 'COMPLETED'
              ? 'COMPLETED'
              : stageInstance.status === 'IN_PROGRESS'
                ? 'IN_PROGRESS'
                : stageInstance.status === 'READY'
                  ? 'READY'
                  : 'NOT_STARTED',
          progressPercent: stageInstance.progressPercent,
          assignedEmployeeId: stageAssignee[stageDef.code],
          priority: stageDef.code === 'CARPENTRY' ? 'HIGH' : 'NORMAL',
        },
      });
    }
  } else if (demoPo) {
    // Reset demo PO to a consistent mid-pipeline snapshot for specialists
    await prisma.productionOrder.update({
      where: { id: demoPo.id },
      data: {
        status: 'IN_PROGRESS',
        currentStageCode: 'CARPENTRY',
        progressPercent: 12,
        actualCompletionDate: null,
      },
    });
    const instances = await prisma.productionStageInstance.findMany({
      where: { productionOrderId: demoPo.id },
      include: { stageDefinition: true, tasks: true },
    });
    for (const stage of instances) {
      const code = stage.stageDefinition.code;
      const status =
        code === 'MATERIAL_PREP'
          ? 'COMPLETED'
          : code === 'CARPENTRY'
            ? 'IN_PROGRESS'
            : code === 'PAINTING'
              ? 'READY'
              : 'PENDING';
      await prisma.productionStageInstance.update({
        where: { id: stage.id },
        data: {
          status,
          progressPercent: status === 'COMPLETED' ? 100 : status === 'IN_PROGRESS' ? 40 : 0,
          actualEnd: status === 'COMPLETED' ? new Date() : null,
        },
      });
      for (const task of stage.tasks) {
        await prisma.productionTask.update({
          where: { id: task.id },
          data: {
            assignedEmployeeId: stageAssignee[code],
            priority: code === 'CARPENTRY' ? 'HIGH' : 'NORMAL',
            status:
              status === 'COMPLETED'
                ? 'COMPLETED'
                : status === 'IN_PROGRESS'
                  ? 'IN_PROGRESS'
                  : status === 'READY'
                    ? 'READY'
                    : 'NOT_STARTED',
            progressPercent: status === 'COMPLETED' ? 100 : status === 'IN_PROGRESS' ? 40 : 0,
            actualCompletion: status === 'COMPLETED' ? new Date() : null,
          },
        });
      }
    }
  }

  const existingInvoice = await prisma.invoice.findUnique({ where: { number: 'INV-DEMO-001' } });
  if (!existingInvoice) {
    await prisma.invoice.create({
      data: {
        number: 'INV-DEMO-001',
        customerId: customer.id,
        salesOrderId: demoSo.id,
        status: 'ISSUED',
        subtotal: 2550,
        taxTotal: 408,
        total: 2958,
        outstandingAmount: 2958,
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        createdById: salesUser.id,
        lines: {
          create: [
            {
              description: '3-Seater Sofa — lobby set × 3',
              quantity: 3,
              unitPrice: 850,
              taxRate: 0.16,
              lineTotal: 2958,
            },
          ],
        },
      },
    });
  }

  const existingDelivery = await prisma.delivery.findUnique({ where: { number: 'DEL-DEMO-001' } });
  if (!existingDelivery) {
    await prisma.delivery.create({
      data: {
        number: 'DEL-DEMO-001',
        salesOrderId: demoSo.id,
        customerId: customer.id,
        deliveryAddress: 'Cedar Street 12, Abdoun, Amman',
        deliveryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
        deliveryWindow: '09:00–13:00',
        status: 'PLANNED',
        recipientName: 'Laila Hassan',
        items: {
          create: [{ description: '3-Seater Sofa', quantity: 3 }],
        },
      },
    });
  }

  console.log('Seed complete.');
  console.log('Demo logins (password: Admin@12345!):');
  console.log('  admin@maher-aghbar.jo');
  console.log('  sales@maher-aghbar.jo');
  console.log('  worker@maher-aghbar.jo');
  console.log('  carpenter@maher-aghbar.jo');
  console.log('  painter@maher-aghbar.jo');
  console.log('  upholsterer@maher-aghbar.jo');
  console.log('  assembler@maher-aghbar.jo');
  console.log('  packer@maher-aghbar.jo');
  console.log('  customer@cedar-hotel.jo');
  console.log('  customer@olive-restaurant.jo');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
