/**
 * Coherent operational demo data for Maher Al-Aghbar & Sons (Amman).
 * Foundation (roles, permissions, warehouses, departments, stage defs,
 * QC FINAL_QC, notification templates, base settings) is seeded by seed.ts first.
 */
import {
  PrismaClient,
  Prisma,
  Locale,
  CustomerStatus,
  CustomerType,
  InventoryCategory,
  InventoryTxType,
  PurchaseRequestStatus,
  PurchaseOrderStatus,
  Priority,
  PaymentMethod,
  InvoiceStatus,
  RequestStatus,
  RequestSource,
  QuotationStatus,
  SalesOrderStatus,
  ContractStatus,
  ProductionOrderStatus,
  StageInstanceStatus,
  TaskStatus,
  QualityResult,
  ChecklistItemResult,
  DeliveryStatus,
  ReturnReason,
  DiscountType,
} from '@prisma/client';
import { buildStageTaskInstructions } from './stage-task-instructions';

const VAT = 0.16;
const COMPANY_DOMAIN = 'maher-aghbar.jo';

/** JOD money with 3 decimal places. */
function money(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(3));
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function lineTotals(qty: number, unitPrice: number, taxRate = VAT) {
  const subtotal = qty * unitPrice;
  const taxAmount = subtotal * taxRate;
  const lineTotal = subtotal + taxAmount;
  return {
    subtotal: money(subtotal),
    taxAmount: money(taxAmount),
    lineTotal: money(lineTotal),
    taxRate,
  };
}

function orderTotals(lines: Array<{ subtotal: number; taxAmount: number; lineTotal: number }>) {
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const taxTotal = lines.reduce((s, l) => s + l.taxAmount, 0);
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  return { subtotal: money(subtotal), taxTotal: money(taxTotal), total: money(total) };
}

/**
 * Wipe operational data so demo world can be re-seeded idempotently.
 * Preserves IAM foundation, warehouses, departments, stage defs, QC templates,
 * notification templates, and system_settings.
 */
export async function wipeOperationalData(prisma: PrismaClient): Promise<void> {
  const tables = [
    'ai_extraction_fields',
    'ai_extraction_jobs',
    'audit_events',
    'communication_logs',
    'notifications',
    'documents',
    'return_requests',
    'supplier_payments',
    'supplier_invoice_lines',
    'supplier_invoices',
    'statement_entries',
    'payments',
    'invoice_lines',
    'invoices',
    'delivery_items',
    'deliveries',
    'quality_defects',
    'quality_inspection_items',
    'rework_requests',
    'quality_inspections',
    'task_blockers',
    'task_time_entries',
    'production_tasks',
    'production_stage_instances',
    'production_orders',
    'contracts',
    'sales_order_lines',
    'sales_orders',
    'quotation_approvals',
    'quotation_lines',
    'quotations',
    'request_items',
    'requests_for_quotation',
    'warehouse_transfer_lines',
    'warehouse_transfers',
    'inventory_count_lines',
    'inventory_counts',
    'inventory_transactions',
    'inventory_balances',
    'goods_receipt_lines',
    'goods_receipts',
    'purchase_order_lines',
    'purchase_orders',
    'supplier_quote_offers',
    'purchase_request_lines',
    'purchase_requests',
    'inventory_items',
    'warehouse_locations',
    'dealer_prices',
    'products',
    'product_categories',
    'materials',
    'fabrics',
    'color_references',
    'supplier_contacts',
    'suppliers',
    'customer_addresses',
    'customer_contacts',
    'customers',
    'sessions',
    'user_roles',
    'users',
    'sequence_counters',
  ];

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

async function ensureUser(
  prisma: PrismaClient,
  passwordHash: string,
  opts: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    roleCode: string;
    phone?: string;
    departmentCode?: string;
    customerId?: string;
  },
) {
  const username = opts.username.toLowerCase();
  const role = await prisma.role.findUniqueOrThrow({ where: { code: opts.roleCode } });
  const departmentId = opts.departmentCode
    ? (await prisma.department.findUniqueOrThrow({ where: { code: opts.departmentCode } })).id
    : undefined;

  const existing =
    (await prisma.user.findUnique({ where: { email: opts.email } })) ??
    (await prisma.user.findUnique({ where: { username } }));

  if (existing) {
    await prisma.userRole.deleteMany({ where: { userId: existing.id } });
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        username,
        email: opts.email,
        phone: opts.phone,
        passwordHash,
        firstName: opts.firstName,
        lastName: opts.lastName,
        preferredLanguage: Locale.ar,
        isEmailVerified: true,
        isActive: true,
        departmentId: departmentId ?? null,
        customerId: opts.customerId ?? null,
        roles: { create: { roleId: role.id } },
      },
    });
    return updated;
  }

  return prisma.user.create({
    data: {
      username,
      email: opts.email,
      phone: opts.phone,
      passwordHash,
      firstName: opts.firstName,
      lastName: opts.lastName,
      preferredLanguage: Locale.ar,
      isEmailVerified: true,
      isActive: true,
      departmentId,
      customerId: opts.customerId,
      roles: { create: { roleId: role.id } },
    },
  });
}

async function upsertBalance(
  prisma: PrismaClient,
  opts: {
    inventoryItemId: string;
    warehouseId: string;
    locationId?: string | null;
    availableQty: number;
    reservedQty?: number;
  },
) {
  const locationId = opts.locationId ?? null;
  const existing = await prisma.inventoryBalance.findFirst({
    where: {
      inventoryItemId: opts.inventoryItemId,
      warehouseId: opts.warehouseId,
      locationId,
    },
  });
  if (existing) {
    return prisma.inventoryBalance.update({
      where: { id: existing.id },
      data: {
        availableQty: money(opts.availableQty),
        reservedQty: money(opts.reservedQty ?? 0),
      },
    });
  }
  return prisma.inventoryBalance.create({
    data: {
      inventoryItemId: opts.inventoryItemId,
      warehouseId: opts.warehouseId,
      locationId,
      availableQty: money(opts.availableQty),
      reservedQty: money(opts.reservedQty ?? 0),
    },
  });
}

export async function seedDemoWorld(prisma: PrismaClient, passwordHash: string): Promise<void> {
  console.log('Seeding demo operational world…');

  // ── Settings extras ──────────────────────────────────────────────────────
  const companyExisting = await prisma.systemSetting.findUnique({ where: { key: 'company' } });
  const companyBase =
    companyExisting?.value && typeof companyExisting.value === 'object' && !Array.isArray(companyExisting.value)
      ? (companyExisting.value as Record<string, unknown>)
      : {};
  await prisma.systemSetting.upsert({
    where: { key: 'company' },
    update: {
      value: {
        ...companyBase,
        nameAr: 'مفروشات ماهر الأغبر وأولاده',
        nameEn: 'Maher Al-Aghbar & Sons Furniture',
        currency: 'JOD',
        defaultVatPercent: 16,
        timezone: 'Asia/Amman',
        lowStockAlertsEnabled: true,
        autoReorderEnabled: true,
      },
    },
    create: {
      key: 'company',
      value: {
        nameAr: 'مفروشات ماهر الأغبر وأولاده',
        nameEn: 'Maher Al-Aghbar & Sons Furniture',
        currency: 'JOD',
        defaultVatPercent: 16,
        timezone: 'Asia/Amman',
        lowStockAlertsEnabled: true,
        autoReorderEnabled: true,
      },
    },
  });

  // ── Warehouses & locations ───────────────────────────────────────────────
  const rawWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'RAW' } });
  const finWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'FIN' } });

  const locA1 = await prisma.warehouseLocation.upsert({
    where: { warehouseId_code: { warehouseId: rawWh.id, code: 'RAW-A1' } },
    update: { name: 'Raw aisle A1' },
    create: { warehouseId: rawWh.id, code: 'RAW-A1', name: 'Raw aisle A1' },
  });
  await prisma.warehouseLocation.upsert({
    where: { warehouseId_code: { warehouseId: rawWh.id, code: 'RAW-B2' } },
    update: { name: 'Raw aisle B2' },
    create: { warehouseId: rawWh.id, code: 'RAW-B2', name: 'Raw aisle B2' },
  });

  // ── Customers ────────────────────────────────────────────────────────────
  const cedar = await prisma.customer.create({
    data: {
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

  const olive = await prisma.customer.create({
    data: {
      code: 'CUS-0002',
      name: 'مطعم الزيتون',
      nameAr: 'مطعم الزيتون',
      nameEn: 'Olive Restaurant',
      nameHe: 'מסעדת הזית',
      customerType: CustomerType.COMPANY,
      companyName: 'Olive Restaurant LLC',
      status: CustomerStatus.ACTIVE,
      phone: '+96265559876',
      fax: '+96265559877',
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
          area: 'Rainbow St',
          street: 'Rainbow Street 8',
          isDefaultBilling: true,
          isDefaultDelivery: true,
        },
      },
    },
  });

  const petra = await prisma.customer.create({
    data: {
      code: 'CUS-0003',
      name: 'معرض البتراء',
      nameAr: 'معرض البتراء',
      nameEn: 'Petra Showroom',
      nameHe: 'אולם תצוגה פטרה',
      customerType: CustomerType.SHOWROOM,
      companyName: 'Petra Furniture Showroom',
      status: CustomerStatus.ACTIVE,
      phone: '+96265554433',
      fax: '+96265554434',
      email: 'buy@petra-showroom.jo',
      preferredLanguage: Locale.ar,
      paymentTermsDays: 21,
      industry: 'Furniture retail',
      contacts: {
        create: {
          name: 'رامي خليل',
          position: 'Buyer',
          phone: '+962790000030',
          email: 'rami@petra-showroom.jo',
          isPrimary: true,
        },
      },
      addresses: {
        create: {
          label: 'Showroom',
          city: 'Amman',
          area: 'Sweifieh',
          street: 'Wakalat Street 22',
          isDefaultBilling: true,
          isDefaultDelivery: true,
        },
      },
    },
  });

  const villa = await prisma.customer.create({
    data: {
      code: 'CUS-0004',
      name: 'فيلا عمّان',
      nameAr: 'فيلا عمّان',
      nameEn: 'Amman Villa',
      customerType: CustomerType.INDIVIDUAL,
      status: CustomerStatus.ACTIVE,
      phone: '+962790000040',
      email: 'guest@amman-villa.jo',
      preferredLanguage: Locale.ar,
      paymentTermsDays: 7,
      industry: 'Residential',
      contacts: {
        create: {
          name: 'نادية فهد',
          position: 'Homeowner',
          phone: '+962790000041',
          email: 'nadia@amman-villa.jo',
          isPrimary: true,
        },
      },
      addresses: {
        create: {
          label: 'Home',
          city: 'Amman',
          area: 'Khalda',
          street: 'Villa Lane 5',
          isDefaultBilling: true,
          isDefaultDelivery: true,
        },
      },
    },
  });

  // ── Users: admin + specialty workers (all PRODUCTION_WORKER) + customers ─
  const admin = await ensureUser(prisma, passwordHash, {
    username: 'admin',
    email: `admin@${COMPANY_DOMAIN}`,
    firstName: 'System',
    lastName: 'Admin',
    roleCode: 'SYSTEM_ADMINISTRATOR',
    phone: '+962790000001',
    departmentCode: 'MGMT',
  });

  const worker = await ensureUser(prisma, passwordHash, {
    username: 'worker',
    email: `worker@${COMPANY_DOMAIN}`,
    firstName: 'Ahmad',
    lastName: 'Najjar',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000003',
    departmentCode: 'WH',
  });

  const carpenter = await ensureUser(prisma, passwordHash, {
    username: 'carpenter',
    email: `carpenter@${COMPANY_DOMAIN}`,
    firstName: 'Yousef',
    lastName: 'Carpenter',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000011',
    departmentCode: 'CARP',
  });

  const carpenter2 = await ensureUser(prisma, passwordHash, {
    username: 'carpenter2',
    email: `carpenter2@${COMPANY_DOMAIN}`,
    firstName: 'Tariq',
    lastName: 'Carpenter',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000022',
    departmentCode: 'CARP',
  });

  const painter = await ensureUser(prisma, passwordHash, {
    username: 'painter',
    email: `painter@${COMPANY_DOMAIN}`,
    firstName: 'Omar',
    lastName: 'Painter',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000012',
    departmentCode: 'PAINT',
  });

  const upholsterer = await ensureUser(prisma, passwordHash, {
    username: 'upholsterer',
    email: `upholsterer@${COMPANY_DOMAIN}`,
    firstName: 'Sami',
    lastName: 'Upholsterer',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000013',
    departmentCode: 'UPHOL',
  });

  const assembler = await ensureUser(prisma, passwordHash, {
    username: 'assembler',
    email: `assembler@${COMPANY_DOMAIN}`,
    firstName: 'Khaled',
    lastName: 'Assembler',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000014',
    departmentCode: 'ASM',
  });

  const packer = await ensureUser(prisma, passwordHash, {
    username: 'packer',
    email: `packer@${COMPANY_DOMAIN}`,
    firstName: 'Nour',
    lastName: 'Packer',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000015',
    departmentCode: 'PACK',
  });

  const inspector = await ensureUser(prisma, passwordHash, {
    username: 'inspector',
    email: `inspector@${COMPANY_DOMAIN}`,
    firstName: 'Lina',
    lastName: 'Inspector',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000016',
    departmentCode: 'QC',
  });

  const driver = await ensureUser(prisma, passwordHash, {
    username: 'driver',
    email: `driver@${COMPANY_DOMAIN}`,
    firstName: 'Fadi',
    lastName: 'Driver',
    roleCode: 'PRODUCTION_WORKER',
    phone: '+962790000017',
    departmentCode: 'DEL',
  });

  await ensureUser(prisma, passwordHash, {
    username: 'cedar',
    email: 'customer@cedar-hotel.jo',
    firstName: 'Laila',
    lastName: 'Hassan',
    roleCode: 'CUSTOMER',
    phone: '+962790000018',
    customerId: cedar.id,
  });

  await ensureUser(prisma, passwordHash, {
    username: 'olive',
    email: 'customer@olive-restaurant.jo',
    firstName: 'Sara',
    lastName: 'Omar',
    roleCode: 'CUSTOMER',
    phone: '+962790000019',
    customerId: olive.id,
  });

  await ensureUser(prisma, passwordHash, {
    username: 'petra',
    email: 'customer@petra-showroom.jo',
    firstName: 'Rami',
    lastName: 'Khalil',
    roleCode: 'CUSTOMER',
    phone: '+962790000021',
    customerId: petra.id,
  });

  await ensureUser(prisma, passwordHash, {
    username: 'villa',
    email: 'customer@amman-villa.jo',
    firstName: 'Nadia',
    lastName: 'Villa',
    roleCode: 'CUSTOMER',
    phone: '+962790000041',
    customerId: villa.id,
  });

  // Link account managers (admin owns dealer relationships in the 3-role model)
  await prisma.customer.update({
    where: { id: cedar.id },
    data: { accountManagerId: admin.id },
  });
  await prisma.customer.update({
    where: { id: olive.id },
    data: { accountManagerId: admin.id },
  });
  await prisma.customer.update({
    where: { id: petra.id },
    data: { accountManagerId: admin.id },
  });
  await prisma.customer.update({
    where: { id: villa.id },
    data: { accountManagerId: admin.id },
  });

  /** Default specialty assignees (Cedar PO). Olive carpentry uses carpenter2. */
  const stageAssignee: Record<string, string> = {
    MATERIAL_PREP: worker.id,
    CARPENTRY: carpenter.id,
    PAINTING: painter.id,
    UPHOLSTERY: upholsterer.id,
    ASSEMBLY: assembler.id,
    INSPECTION: inspector.id,
    PACKAGING: packer.id,
    DELIVERY: driver.id,
  };

  const oliveStageAssignee: Record<string, string> = {
    ...stageAssignee,
    CARPENTRY: carpenter2.id,
  };

  // ── Catalog ──────────────────────────────────────────────────────────────
  const categories = [
    { code: 'SOFA', nameAr: 'كنب', nameEn: 'Sofas' },
    { code: 'CHAIR', nameAr: 'كراسي', nameEn: 'Chairs' },
    { code: 'BED', nameAr: 'غرف نوم', nameEn: 'Bedroom' },
    { code: 'TABLE', nameAr: 'طاولات', nameEn: 'Tables' },
    { code: 'CUSTOM', nameAr: 'تفصيل', nameEn: 'Custom' },
  ];
  for (const c of categories) {
    await prisma.productCategory.create({ data: c });
  }

  const sofaCat = await prisma.productCategory.findUniqueOrThrow({ where: { code: 'SOFA' } });
  const chairCat = await prisma.productCategory.findUniqueOrThrow({ where: { code: 'CHAIR' } });
  const bedCat = await prisma.productCategory.findUniqueOrThrow({ where: { code: 'BED' } });
  const tableCat = await prisma.productCategory.findUniqueOrThrow({ where: { code: 'TABLE' } });

  const sofaBom = {
    materials: [
      { sku: 'FAB-ROLL', qty: 12, category: 'FABRIC' },
      { sku: 'WOOD-BEECH', qty: 8, category: 'WOOD' },
      { sku: 'FOAM-HD', qty: 0.45, category: 'FOAM' },
    ],
  };
  const sofaLBom = {
    materials: [
      { sku: 'FAB-ROLL', qty: 22, category: 'FABRIC' },
      { sku: 'WOOD-BEECH', qty: 14, category: 'WOOD' },
      { sku: 'FOAM-HD', qty: 0.8, category: 'FOAM' },
    ],
  };
  const armBom = {
    materials: [
      { sku: 'FAB-ROLL', qty: 4, category: 'FABRIC' },
      { sku: 'WOOD-BEECH', qty: 3, category: 'WOOD' },
      { sku: 'FOAM-HD', qty: 0.15, category: 'FOAM' },
    ],
  };
  const chairDinBom = {
    materials: [
      { sku: 'WOOD-OAK', qty: 2, category: 'WOOD' },
      { sku: 'FAB-LINEN', qty: 1.5, category: 'FABRIC' },
      { sku: 'FOAM-MD', qty: 0.05, category: 'FOAM' },
    ],
  };
  const bedBom = {
    materials: [
      { sku: 'WOOD-BEECH', qty: 14, category: 'WOOD' },
      { sku: 'FAB-ROLL', qty: 6, category: 'FABRIC' },
      { sku: 'FOAM-HD', qty: 0.3, category: 'FOAM' },
    ],
  };
  const tableBom = {
    materials: [
      { sku: 'WOOD-OAK', qty: 4, category: 'WOOD' },
      { sku: 'PAINT-CLEAR', qty: 0.5, category: 'PAINT' },
      { sku: 'HARDWARE-KIT', qty: 1, category: 'METAL_ACCESSORY' },
    ],
  };

  const img = {
    sofa: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
    sofaL: 'https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=800&q=80',
    chair: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=800&q=80',
    dining: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=800&q=80',
    bed: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80',
    table: 'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80',
  };

  const sof3s = await prisma.product.create({
    data: {
      sku: 'SOF-3S',
      nameAr: 'كنبة ثلاثية',
      nameEn: '3-Seater Sofa',
      categoryId: sofaCat.id,
      basePrice: money(850),
      manufacturingCost: money(410),
      bomDefaults: sofaBom,
      unit: 'pcs',
      imageUrl: img.sofa,
      width: money(220),
      height: money(85),
      depth: money(95),
      seatHeight: money(45),
    },
  });

  const sofL = await prisma.product.create({
    data: {
      sku: 'SOF-L',
      nameAr: 'كنبة حرف L',
      nameEn: 'L-Shape Sofa',
      categoryId: sofaCat.id,
      basePrice: money(1450),
      manufacturingCost: money(680),
      bomDefaults: sofaLBom,
      unit: 'pcs',
      imageUrl: img.sofaL,
      width: money(280),
      height: money(85),
      depth: money(180),
      seatHeight: money(45),
    },
  });

  const arm01 = await prisma.product.create({
    data: {
      sku: 'ARM-01',
      nameAr: 'كرسي بذراعين',
      nameEn: 'Armchair',
      categoryId: chairCat.id,
      basePrice: money(320),
      manufacturingCost: money(145),
      bomDefaults: armBom,
      unit: 'pcs',
      imageUrl: img.chair,
      width: money(80),
      height: money(90),
      depth: money(85),
      seatHeight: money(45),
    },
  });

  const chairDin = await prisma.product.create({
    data: {
      sku: 'CHAIR-DIN',
      nameAr: 'كرسي سفرة',
      nameEn: 'Dining Chair',
      categoryId: chairCat.id,
      basePrice: money(95),
      manufacturingCost: money(42),
      bomDefaults: chairDinBom,
      unit: 'pcs',
      imageUrl: img.dining,
      width: money(45),
      height: money(95),
      depth: money(50),
      seatHeight: money(46),
    },
  });

  const bedQ = await prisma.product.create({
    data: {
      sku: 'BED-Q',
      nameAr: 'سرير كوين',
      nameEn: 'Queen Bed',
      categoryId: bedCat.id,
      basePrice: money(1100),
      manufacturingCost: money(520),
      bomDefaults: bedBom,
      unit: 'pcs',
      imageUrl: img.bed,
      width: money(160),
      height: money(110),
      depth: money(200),
    },
  });

  await prisma.product.create({
    data: {
      sku: 'TABLE-CF',
      nameAr: 'طاولة قهوة',
      nameEn: 'Coffee Table',
      categoryId: tableCat.id,
      basePrice: money(280),
      manufacturingCost: money(120),
      bomDefaults: tableBom,
      unit: 'pcs',
      imageUrl: img.table,
      width: money(110),
      height: money(45),
      depth: money(60),
    },
  });

  // Dealer prices
  const dealerPriceRows: Array<{ customerId: string; productId: string; price: number }> = [
    { customerId: cedar.id, productId: sof3s.id, price: 820 },
    { customerId: cedar.id, productId: sofL.id, price: 1380 },
    { customerId: cedar.id, productId: arm01.id, price: 295 },
    { customerId: cedar.id, productId: bedQ.id, price: 1050 },
    { customerId: olive.id, productId: sof3s.id, price: 900 },
    { customerId: olive.id, productId: sofL.id, price: 1500 },
    { customerId: olive.id, productId: arm01.id, price: 340 },
    { customerId: olive.id, productId: chairDin.id, price: 88 },
    { customerId: petra.id, productId: sof3s.id, price: 860 },
    { customerId: petra.id, productId: sofL.id, price: 1420 },
    { customerId: petra.id, productId: arm01.id, price: 310 },
    { customerId: petra.id, productId: chairDin.id, price: 90 },
    { customerId: petra.id, productId: bedQ.id, price: 1080 },
  ];
  for (const row of dealerPriceRows) {
    await prisma.dealerPrice.create({
      data: {
        customerId: row.customerId,
        productId: row.productId,
        price: money(row.price),
        currency: 'JOD',
      },
    });
  }

  await prisma.fabric.create({
    data: { code: 'FAB-VEL-01', nameAr: 'قطيفة رمادي', nameEn: 'Grey Velvet', color: 'Grey' },
  });
  await prisma.fabric.create({
    data: { code: 'FAB-LIN-02', nameAr: 'كتان بيج', nameEn: 'Beige Linen', color: 'Beige' },
  });

  await prisma.colorReference.create({
    data: { code: 'CLR-WAL', nameAr: 'جوز', nameEn: 'Walnut', hex: '#5C4033' },
  });
  await prisma.colorReference.create({
    data: { code: 'CLR-OAK', nameAr: 'بلوط', nameEn: 'Oak', hex: '#C4A35A' },
  });
  await prisma.colorReference.create({
    data: { code: 'CLR-WHT', nameAr: 'أبيض', nameEn: 'White', hex: '#F5F5F0' },
  });

  // ── Suppliers ────────────────────────────────────────────────────────────
  const timber = await prisma.supplier.create({
    data: {
      code: 'SUP-TIMBER',
      name: 'ساحة الزرقاء للأخشاب',
      nameAr: 'ساحة الزرقاء للأخشاب',
      nameEn: 'Al-Zarqa Timber Yard',
      companyName: 'Al-Zarqa Timber Yard',
      phone: '+96253991234',
      email: 'sales@zarqa-timber.jo',
      address: 'Zarqa Industrial Zone',
      paymentTermsDays: 30,
      leadTimeDays: 5,
      isCertified: true,
      contacts: {
        create: {
          name: 'خالد الزرقاء',
          phone: '+962790000050',
          email: 'khaled@zarqa-timber.jo',
          isPrimary: true,
        },
      },
    },
  });

  const foamSup = await prisma.supplier.create({
    data: {
      code: 'SUP-FOAM',
      name: 'مصانع عمّان للإسفنج',
      nameAr: 'مصانع عمّان للإسفنج',
      nameEn: 'Amman Foam Industries',
      companyName: 'Amman Foam Industries',
      phone: '+96265550111',
      email: 'orders@amman-foam.jo',
      address: 'Sahab Industrial City',
      paymentTermsDays: 21,
      leadTimeDays: 4,
      isCertified: true,
      contacts: {
        create: {
          name: 'منى فواز',
          phone: '+962790000051',
          email: 'mona@amman-foam.jo',
          isPrimary: true,
        },
      },
    },
  });

  const fabricSup = await prisma.supplier.create({
    data: {
      code: 'SUP-FABRIC',
      name: 'منسوجات بلاد الشام للتنجيد',
      nameAr: 'منسوجات بلاد الشام للتنجيد',
      nameEn: 'Levant Upholstery Textiles',
      companyName: 'Levant Upholstery Textiles',
      phone: '+96265550222',
      email: 'sales@levant-textiles.jo',
      address: 'Marka, Amman',
      paymentTermsDays: 30,
      leadTimeDays: 7,
      isCertified: true,
      contacts: {
        create: {
          name: 'إياد منصور',
          phone: '+962790000052',
          email: 'eyad@levant-textiles.jo',
          isPrimary: true,
        },
      },
    },
  });

  // ── Materials + inventory ────────────────────────────────────────────────
  type MatDef = {
    sku: string;
    nameAr: string;
    nameEn: string;
    category: InventoryCategory;
    unit: string;
    minStock: number;
    preferredSupplierId?: string;
    stock: number;
    unitCost: number;
    locationId?: string | null;
  };

  const materialDefs: MatDef[] = [
    {
      sku: 'WOOD-BEECH',
      nameAr: 'خشب زان',
      nameEn: 'Beech wood',
      category: InventoryCategory.WOOD,
      unit: 'm',
      minStock: 50,
      preferredSupplierId: timber.id,
      stock: 120,
      unitCost: 12,
      locationId: locA1.id,
    },
    {
      sku: 'WOOD-OAK',
      nameAr: 'خشب بلوط',
      nameEn: 'Oak wood',
      category: InventoryCategory.WOOD,
      unit: 'm',
      minStock: 30,
      preferredSupplierId: timber.id,
      stock: 80,
      unitCost: 18,
      locationId: locA1.id,
    },
    {
      sku: 'FOAM-HD',
      nameAr: 'إسفنج عالي الكثافة',
      nameEn: 'HD Foam',
      category: InventoryCategory.FOAM,
      unit: 'm3',
      minStock: 8,
      preferredSupplierId: foamSup.id,
      stock: 22,
      unitCost: 95,
    },
    {
      sku: 'FOAM-MD',
      nameAr: 'إسفنج متوسط الكثافة',
      nameEn: 'MD Foam',
      category: InventoryCategory.FOAM,
      unit: 'm3',
      minStock: 5,
      preferredSupplierId: foamSup.id,
      stock: 14,
      unitCost: 70,
    },
    {
      sku: 'FAB-ROLL',
      nameAr: 'قماش تنجيد',
      nameEn: 'Upholstery fabric',
      category: InventoryCategory.FABRIC,
      unit: 'm',
      minStock: 100,
      preferredSupplierId: fabricSup.id,
      stock: 35, // below min — low-stock story
      unitCost: 8.5,
    },
    {
      sku: 'FAB-LINEN',
      nameAr: 'قماش كتان',
      nameEn: 'Linen fabric',
      category: InventoryCategory.FABRIC,
      unit: 'm',
      minStock: 40,
      preferredSupplierId: fabricSup.id,
      stock: 65,
      unitCost: 6.5,
    },
    {
      sku: 'PAINT-CLEAR',
      nameAr: 'طلاء شفاف',
      nameEn: 'Clear lacquer',
      category: InventoryCategory.PAINT,
      unit: 'L',
      minStock: 20,
      stock: 45,
      unitCost: 4.2,
    },
    {
      sku: 'HARDWARE-KIT',
      nameAr: 'طقم أدوات تثبيت',
      nameEn: 'Hardware kit',
      category: InventoryCategory.METAL_ACCESSORY,
      unit: 'pcs',
      minStock: 50,
      stock: 120,
      unitCost: 3.5,
    },
    {
      sku: 'PACK-CARTON',
      nameAr: 'كراتين تغليف',
      nameEn: 'Packaging carton',
      category: InventoryCategory.PACKAGING,
      unit: 'pcs',
      minStock: 30,
      stock: 90,
      unitCost: 1.2,
    },
  ];

  const invBySku = new Map<string, { id: string; sku: string }>();

  for (const m of materialDefs) {
    const material = await prisma.material.create({
      data: {
        sku: m.sku,
        nameAr: m.nameAr,
        nameEn: m.nameEn,
        category: m.category,
        unit: m.unit,
        minStock: money(m.minStock),
      },
    });
    const item = await prisma.inventoryItem.create({
      data: {
        sku: m.sku,
        barcode: `BC-${m.sku}`,
        nameAr: m.nameAr,
        nameEn: m.nameEn,
        category: m.category,
        unit: m.unit,
        minStock: money(m.minStock),
        materialId: material.id,
        preferredSupplierId: m.preferredSupplierId,
        reorderQty: money(m.minStock * 2),
      },
    });
    invBySku.set(m.sku, item);

    await prisma.inventoryTransaction.create({
      data: {
        number: `ITX-SEED-${m.sku}`,
        type: InventoryTxType.INVENTORY_ADJUSTMENT,
        inventoryItemId: item.id,
        warehouseId: rawWh.id,
        quantity: money(m.stock),
        unitCost: money(m.unitCost),
        notes: 'Demo seed opening stock / unit cost',
        idempotencyKey: `SEED-COST-${m.sku}`,
        createdById: admin.id,
      },
    });

    await upsertBalance(prisma, {
      inventoryItemId: item.id,
      warehouseId: rawWh.id,
      locationId: m.locationId ?? null,
      availableQty: m.stock,
    });
  }

  // Finished goods sample in FIN warehouse
  const fgSofa = await prisma.inventoryItem.create({
    data: {
      sku: 'FG-SOF-3S',
      barcode: 'BC-FG-SOF-3S',
      nameAr: 'كنبة ثلاثية — جاهزة',
      nameEn: '3-Seater Sofa — finished',
      category: InventoryCategory.FINISHED,
      unit: 'pcs',
      minStock: money(0),
    },
  });
  await prisma.inventoryTransaction.create({
    data: {
      number: 'ITX-SEED-FG-SOF-3S',
      type: InventoryTxType.FINISHED_GOODS_RECEIPT,
      inventoryItemId: fgSofa.id,
      warehouseId: finWh.id,
      quantity: money(2),
      unitCost: money(410),
      notes: 'Demo finished stock',
      idempotencyKey: 'SEED-FG-SOF-3S',
      createdById: admin.id,
    },
  });
  await upsertBalance(prisma, {
    inventoryItemId: fgSofa.id,
    warehouseId: finWh.id,
    availableQty: 2,
  });

  // ── Purchasing story ─────────────────────────────────────────────────────
  const woodItem = invBySku.get('WOOD-BEECH')!;
  const foamItem = invBySku.get('FOAM-HD')!;
  const fabricItem = invBySku.get('FAB-ROLL')!;

  const pr1 = await prisma.purchaseRequest.create({
    data: {
      number: 'PR-DEMO-001',
      requestedById: admin.id,
      department: 'PURCH',
      warehouseId: rawWh.id,
      requiredDate: daysFromNow(7),
      priority: Priority.NORMAL,
      status: PurchaseRequestStatus.APPROVED,
      reason: 'Restock beech wood and HD foam for Cedar lobby production',
      lines: {
        create: [
          {
            inventoryItemId: woodItem.id,
            description: 'Beech wood restock',
            quantity: money(100),
            unit: 'm',
          },
          {
            inventoryItemId: foamItem.id,
            description: 'HD foam restock',
            quantity: money(10),
            unit: 'm3',
          },
        ],
      },
    },
  });

  await prisma.supplierQuoteOffer.create({
    data: {
      purchaseRequestId: pr1.id,
      supplierId: timber.id,
      unitPrice: money(11.5),
      leadTimeDays: 4,
      qualityScore: money(4.6),
      notes: 'Beech lumber — kiln dried',
      isSelected: true,
    },
  });
  await prisma.supplierQuoteOffer.create({
    data: {
      purchaseRequestId: pr1.id,
      supplierId: foamSup.id,
      unitPrice: money(92),
      leadTimeDays: 3,
      qualityScore: money(4.4),
      notes: 'HD foam blocks',
      isSelected: true,
    },
  });

  const poBuySub = 100 * 11.5 + 10 * 92; // 2070
  const poBuyTax = poBuySub * VAT;
  const poBuyTotal = poBuySub + poBuyTax;

  const poBuy = await prisma.purchaseOrder.create({
    data: {
      number: 'PO-BUY-001',
      supplierId: timber.id,
      warehouseId: rawWh.id,
      orderDate: daysAgo(10),
      expectedDeliveryDate: daysAgo(3),
      status: PurchaseOrderStatus.RECEIVED,
      paymentTermsDays: 30,
      subtotal: money(poBuySub),
      taxAmount: money(poBuyTax),
      total: money(poBuyTotal),
      notes: 'Combined wood+foam receive against PR-DEMO-001 (demo)',
      lines: {
        create: [
          {
            inventoryItemId: woodItem.id,
            description: 'Beech wood',
            quantity: money(100),
            unitPrice: money(11.5),
            taxRate: VAT,
            lineTotal: money(100 * 11.5 * (1 + VAT)),
          },
          {
            inventoryItemId: foamItem.id,
            description: 'HD foam',
            quantity: money(10),
            unitPrice: money(92),
            taxRate: VAT,
            lineTotal: money(10 * 92 * (1 + VAT)),
          },
        ],
      },
    },
  });

  await prisma.purchaseRequest.update({
    where: { id: pr1.id },
    data: { purchaseOrderId: poBuy.id, status: PurchaseRequestStatus.ORDERED },
  });

  const grn = await prisma.goodsReceipt.create({
    data: {
      number: 'GRN-DEMO-001',
      purchaseOrderId: poBuy.id,
      warehouseId: rawWh.id,
      receiptDate: daysAgo(3),
      deliveryDocRef: 'DN-ZARQA-441',
      createdById: admin.id,
      lines: {
        create: [
          {
            inventoryItemId: woodItem.id,
            orderedQty: money(100),
            receivedQty: money(100),
            qualityStatus: 'OK',
            batchNumber: 'BCH-2026-08',
          },
          {
            inventoryItemId: foamItem.id,
            orderedQty: money(10),
            receivedQty: money(10),
            qualityStatus: 'OK',
            batchNumber: 'FOAM-2026-08',
          },
        ],
      },
    },
  });

  await prisma.inventoryTransaction.create({
    data: {
      number: 'ITX-GRN-WOOD-BEECH',
      type: InventoryTxType.PURCHASE_RECEIPT,
      inventoryItemId: woodItem.id,
      warehouseId: rawWh.id,
      quantity: money(100),
      unitCost: money(11.5),
      referenceType: 'GoodsReceipt',
      referenceId: grn.id,
      idempotencyKey: 'SEED-GRN-WOOD-BEECH',
      createdById: admin.id,
    },
  });
  await prisma.inventoryTransaction.create({
    data: {
      number: 'ITX-GRN-FOAM-HD',
      type: InventoryTxType.PURCHASE_RECEIPT,
      inventoryItemId: foamItem.id,
      warehouseId: rawWh.id,
      quantity: money(10),
      unitCost: money(92),
      referenceType: 'GoodsReceipt',
      referenceId: grn.id,
      idempotencyKey: 'SEED-GRN-FOAM-HD',
      createdById: admin.id,
    },
  });

  const sinPaid = 800;
  const sin = await prisma.supplierInvoice.create({
    data: {
      number: 'SIN-DEMO-001',
      supplierId: timber.id,
      purchaseOrderId: poBuy.id,
      goodsReceiptId: grn.id,
      invoiceDate: daysAgo(2),
      dueDate: daysFromNow(28),
      status: InvoiceStatus.PARTIALLY_PAID,
      subtotal: money(poBuySub),
      taxTotal: money(poBuyTax),
      total: money(poBuyTotal),
      paidAmount: money(sinPaid),
      outstandingAmount: money(poBuyTotal - sinPaid),
      createdById: admin.id,
      lines: {
        create: [
          {
            description: 'Beech wood × 100 m',
            quantity: money(100),
            unitPrice: money(11.5),
            taxRate: VAT,
            lineTotal: money(100 * 11.5 * (1 + VAT)),
            sortOrder: 0,
          },
          {
            description: 'HD foam × 10 m³',
            quantity: money(10),
            unitPrice: money(92),
            taxRate: VAT,
            lineTotal: money(10 * 92 * (1 + VAT)),
            sortOrder: 1,
          },
        ],
      },
    },
  });

  await prisma.supplierPayment.create({
    data: {
      number: 'SPAY-DEMO-001',
      supplierId: timber.id,
      supplierInvoiceId: sin.id,
      paymentDate: daysAgo(1),
      amount: money(sinPaid),
      method: PaymentMethod.BANK_TRANSFER,
      referenceNumber: 'TRF-SPAY-001',
      notes: 'Partial payment on SIN-DEMO-001',
      createdById: admin.id,
    },
  });

  // Open low-stock PR for fabric
  await prisma.purchaseRequest.create({
    data: {
      number: 'PR-DEMO-002',
      requestedById: admin.id,
      department: 'PURCH',
      warehouseId: rawWh.id,
      requiredDate: daysFromNow(5),
      priority: Priority.HIGH,
      status: PurchaseRequestStatus.SUBMITTED,
      reason: 'FAB-ROLL below minimum (35 / 100) — urgent restock',
      lines: {
        create: [
          {
            inventoryItemId: fabricItem.id,
            description: 'Upholstery fabric roll restock',
            quantity: money(200),
            unit: 'm',
          },
        ],
      },
    },
  });

  // ── Stage definitions (already seeded) ───────────────────────────────────
  const stageDefs = await prisma.productionStageDefinition.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  const qcTemplate = await prisma.qualityChecklistTemplate.findUniqueOrThrow({
    where: { code: 'FINAL_QC' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });

  // ── Cedar lobby (in flight) ──────────────────────────────────────────────
  const cedarRfq = await prisma.requestForQuotation.create({
    data: {
      number: 'RFQ-CED-001',
      customerId: cedar.id,
      contactName: 'ليلى حسن',
      source: RequestSource.PORTAL,
      assignedSalesId: admin.id,
      status: RequestStatus.QUOTED,
      priority: Priority.HIGH,
      projectName: 'Cedar Hotel lobby refresh',
      deliveryAddress: 'Cedar Street 12, Abdoun, Amman',
      requiredDeliveryDate: daysFromNow(21),
      createdById: admin.id,
      items: {
        create: [
          {
            category: 'SOFA',
            productName: '3-Seater Sofa',
            description: 'Lobby seating set — grey velvet',
            quantity: money(3),
            fabricType: 'Velvet',
            fabricCode: 'FAB-VEL-01',
            fabricColor: 'Grey',
            woodColor: 'Walnut',
            sortOrder: 0,
          },
        ],
      },
    },
  });

  const cedarLine = { qty: 3, unitPrice: 850, subtotal: 2550, taxAmount: 408, lineTotal: 2958 };
  const cedarQuote = await prisma.quotation.create({
    data: {
      number: 'Q-DEMO-001',
      version: 1,
      customerId: cedar.id,
      requestId: cedarRfq.id,
      status: QuotationStatus.ACCEPTED,
      paymentTerms: '30 days',
      deliveryTerms: 'Amman delivery included',
      subtotal: money(cedarLine.subtotal),
      taxTotal: money(cedarLine.taxAmount),
      total: money(cedarLine.lineTotal),
      sentAt: daysAgo(8),
      acceptedAt: daysAgo(6),
      createdById: admin.id,
      salesRepId: admin.id,
      lines: {
        create: [
          {
            productId: sof3s.id,
            description: '3-Seater Sofa — lobby set',
            quantity: money(cedarLine.qty),
            unitPrice: money(cedarLine.unitPrice),
            taxRate: VAT,
            discountType: DiscountType.NONE,
            subtotal: money(cedarLine.subtotal),
            taxAmount: money(cedarLine.taxAmount),
            lineTotal: money(cedarLine.lineTotal),
            fabric: 'FAB-VEL-01',
            color: 'CLR-WAL',
            sortOrder: 0,
          },
        ],
      },
    },
  });

  const cedarSo = await prisma.salesOrder.create({
    data: {
      number: 'SO-DEMO-001',
      customerId: cedar.id,
      quotationId: cedarQuote.id,
      status: SalesOrderStatus.IN_PRODUCTION,
      deliveryAddress: 'Cedar Street 12, Abdoun, Amman',
      requiredDeliveryDate: daysFromNow(21),
      projectName: 'Cedar Hotel lobby refresh',
      paymentTerms: '30 days',
      subtotal: money(cedarLine.subtotal),
      taxTotal: money(cedarLine.taxAmount),
      total: money(cedarLine.lineTotal),
      createdById: admin.id,
      lines: {
        create: [
          {
            productId: sof3s.id,
            description: '3-Seater Sofa — lobby set',
            quantity: money(cedarLine.qty),
            unitPrice: money(cedarLine.unitPrice),
            taxRate: VAT,
            lineTotal: money(cedarLine.lineTotal),
            productionRequired: true,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  await prisma.contract.create({
    data: {
      number: 'CTR-DEMO-001',
      customerId: cedar.id,
      salesOrderId: cedarSo.id,
      startDate: daysAgo(5),
      endDate: daysFromNow(90),
      contractValue: money(cedarLine.lineTotal),
      currency: 'JOD',
      paymentSchedule: '30% deposit, balance on delivery',
      warranty: '24 months manufacturing warranty',
      terms: 'Signed commercial supply agreement — Cedar Hotel lobby refresh',
      status: ContractStatus.ACTIVE,
    },
  });

  const cedarPo = await prisma.productionOrder.create({
    data: {
      number: 'PO-DEMO-001',
      salesOrderId: cedarSo.id,
      customerId: cedar.id,
      productId: sof3s.id,
      productDescription: '3-Seater Sofa — lobby set',
      quantity: money(3),
      status: ProductionOrderStatus.IN_PROGRESS,
      currentStageCode: 'CARPENTRY',
      progressPercent: 12,
      requiredDeliveryDate: cedarSo.requiredDeliveryDate,
      actualStartDate: daysAgo(4),
      createdById: admin.id,
      stages: {
        create: stageDefs.map((stage) => {
          const code = stage.code;
          const status: StageInstanceStatus =
            code === 'MATERIAL_PREP'
              ? StageInstanceStatus.COMPLETED
              : code === 'CARPENTRY'
                ? StageInstanceStatus.IN_PROGRESS
                : code === 'PAINTING'
                  ? StageInstanceStatus.READY
                  : StageInstanceStatus.PENDING;
          return {
            stageDefinitionId: stage.id,
            status,
            progressPercent: status === StageInstanceStatus.COMPLETED ? 100 : status === StageInstanceStatus.IN_PROGRESS ? 40 : 0,
            actualStart:
              status === StageInstanceStatus.COMPLETED || status === StageInstanceStatus.IN_PROGRESS
                ? daysAgo(3)
                : undefined,
            actualEnd: status === StageInstanceStatus.COMPLETED ? daysAgo(2) : undefined,
          };
        }),
      },
    },
    include: { stages: true },
  });

  for (const stageInstance of cedarPo.stages) {
    const stageDef = stageDefs.find((s) => s.id === stageInstance.stageDefinitionId)!;
    const taskStatus: TaskStatus =
      stageInstance.status === StageInstanceStatus.COMPLETED
        ? TaskStatus.COMPLETED
        : stageInstance.status === StageInstanceStatus.IN_PROGRESS
          ? TaskStatus.IN_PROGRESS
          : stageInstance.status === StageInstanceStatus.READY
            ? TaskStatus.READY
            : TaskStatus.NOT_STARTED;
    await prisma.productionTask.create({
      data: {
        number: `TSK-CED-${stageDef.code}`,
        productionOrderId: cedarPo.id,
        stageDefinitionId: stageDef.id,
        stageInstanceId: stageInstance.id,
        name: stageDef.nameEn,
        description: buildStageTaskInstructions({
          stageCode: stageDef.code,
          stageNameEn: stageDef.nameEn,
          productDescription: '3-Seater Sofa — lobby set',
          quantity: 3,
          specifications: 'Fabric FAB-VEL-01 · Color CLR-WAL',
        }),
        status: taskStatus,
        progressPercent: stageInstance.progressPercent,
        assignedEmployeeId: stageAssignee[stageDef.code],
        priority: stageDef.code === 'CARPENTRY' ? Priority.HIGH : Priority.NORMAL,
        actualStart:
          taskStatus === TaskStatus.COMPLETED || taskStatus === TaskStatus.IN_PROGRESS
            ? daysAgo(3)
            : undefined,
        actualCompletion: taskStatus === TaskStatus.COMPLETED ? daysAgo(2) : undefined,
      },
    });
  }

  const cedarInv = await prisma.invoice.create({
    data: {
      number: 'INV-DEMO-001',
      customerId: cedar.id,
      salesOrderId: cedarSo.id,
      status: InvoiceStatus.PARTIALLY_PAID,
      invoiceDate: daysAgo(5),
      dueDate: daysFromNow(25),
      subtotal: money(cedarLine.subtotal),
      taxTotal: money(cedarLine.taxAmount),
      total: money(cedarLine.lineTotal),
      paidAmount: money(1000),
      outstandingAmount: money(1958),
      createdById: admin.id,
      lines: {
        create: [
          {
            description: '3-Seater Sofa — lobby set × 3',
            quantity: money(3),
            unitPrice: money(850),
            taxRate: VAT,
            lineTotal: money(2958),
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      number: 'PAY-CED-001',
      customerId: cedar.id,
      invoiceId: cedarInv.id,
      paymentDate: daysAgo(4),
      amount: money(1000),
      method: PaymentMethod.BANK_TRANSFER,
      referenceNumber: 'TRF-CED-001',
      notes: 'Deposit on INV-DEMO-001',
      createdById: admin.id,
      idempotencyKey: 'SEED-PAY-CED-001',
    },
  });

  await prisma.statementEntry.create({
    data: {
      customerId: cedar.id,
      entryDate: daysAgo(5),
      type: 'INVOICE',
      reference: 'INV-DEMO-001',
      debit: money(2958),
      credit: money(0),
      balance: money(2958),
      description: 'Invoice issued — lobby sofas',
    },
  });
  await prisma.statementEntry.create({
    data: {
      customerId: cedar.id,
      entryDate: daysAgo(4),
      type: 'PAYMENT',
      reference: 'PAY-CED-001',
      debit: money(0),
      credit: money(1000),
      balance: money(1958),
      description: 'Partial payment received',
    },
  });

  await prisma.delivery.create({
    data: {
      number: 'DEL-DEMO-001',
      salesOrderId: cedarSo.id,
      customerId: cedar.id,
      deliveryAddress: 'Cedar Street 12, Abdoun, Amman',
      deliveryDate: daysFromNow(14),
      deliveryWindow: '09:00–13:00',
      status: DeliveryStatus.PLANNED,
      recipientName: 'ليلى حسن',
      driverId: driver.id,
      items: {
        create: [{ description: '3-Seater Sofa', quantity: money(3) }],
      },
    },
  });

  // ── Olive dining (completed) ─────────────────────────────────────────────
  const oliveLine = { qty: 12, unitPrice: 95, subtotal: 1140, taxAmount: 182.4, lineTotal: 1322.4 };

  const oliveRfq = await prisma.requestForQuotation.create({
    data: {
      number: 'RFQ-OLV-001',
      customerId: olive.id,
      contactName: 'سارة عمر',
      source: RequestSource.SALES,
      assignedSalesId: admin.id,
      status: RequestStatus.QUOTED,
      priority: Priority.NORMAL,
      projectName: 'Olive dining chairs',
      deliveryAddress: 'Rainbow Street 8, Amman',
      requiredDeliveryDate: daysAgo(2),
      createdById: admin.id,
      items: {
        create: [
          {
            category: 'CHAIR',
            productName: 'Dining Chair',
            description: 'Beige linen dining chairs',
            quantity: money(12),
            fabricType: 'Linen',
            fabricCode: 'FAB-LIN-02',
            fabricColor: 'Beige',
            woodColor: 'Oak',
            sortOrder: 0,
          },
        ],
      },
    },
  });

  const oliveQuote = await prisma.quotation.create({
    data: {
      number: 'Q-OLV-001',
      version: 1,
      customerId: olive.id,
      requestId: oliveRfq.id,
      status: QuotationStatus.ACCEPTED,
      paymentTerms: '14 days',
      deliveryTerms: 'Rainbow Street delivery',
      subtotal: money(oliveLine.subtotal),
      taxTotal: money(oliveLine.taxAmount),
      total: money(oliveLine.lineTotal),
      sentAt: daysAgo(35),
      acceptedAt: daysAgo(32),
      createdById: admin.id,
      salesRepId: admin.id,
      lines: {
        create: [
          {
            productId: chairDin.id,
            description: 'Dining Chair — beige linen',
            quantity: money(oliveLine.qty),
            unitPrice: money(oliveLine.unitPrice),
            taxRate: VAT,
            discountType: DiscountType.NONE,
            subtotal: money(oliveLine.subtotal),
            taxAmount: money(oliveLine.taxAmount),
            lineTotal: money(oliveLine.lineTotal),
            fabric: 'FAB-LIN-02',
            color: 'CLR-OAK',
            sortOrder: 0,
          },
        ],
      },
    },
  });

  const oliveSo = await prisma.salesOrder.create({
    data: {
      number: 'SO-OLV-001',
      customerId: olive.id,
      quotationId: oliveQuote.id,
      status: SalesOrderStatus.DELIVERED,
      deliveryAddress: 'Rainbow Street 8, Amman',
      requiredDeliveryDate: daysAgo(5),
      projectName: 'Olive dining chairs',
      paymentTerms: '14 days',
      subtotal: money(oliveLine.subtotal),
      taxTotal: money(oliveLine.taxAmount),
      total: money(oliveLine.lineTotal),
      receivingDate: daysAgo(3),
      createdById: admin.id,
      lines: {
        create: [
          {
            productId: chairDin.id,
            description: 'Dining Chair — beige linen',
            quantity: money(oliveLine.qty),
            unitPrice: money(oliveLine.unitPrice),
            taxRate: VAT,
            lineTotal: money(oliveLine.lineTotal),
            productionRequired: true,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  const olivePo = await prisma.productionOrder.create({
    data: {
      number: 'PO-OLV-001',
      salesOrderId: oliveSo.id,
      customerId: olive.id,
      productId: chairDin.id,
      productDescription: 'Dining Chair — beige linen',
      quantity: money(12),
      status: ProductionOrderStatus.COMPLETED,
      currentStageCode: 'DELIVERY',
      progressPercent: 100,
      requiredDeliveryDate: oliveSo.requiredDeliveryDate,
      actualStartDate: daysAgo(28),
      actualCompletionDate: daysAgo(6),
      createdById: admin.id,
      stages: {
        create: stageDefs.map((stage) => ({
          stageDefinitionId: stage.id,
          status: StageInstanceStatus.COMPLETED,
          progressPercent: 100,
          actualStart: daysAgo(28 - stage.sortOrder),
          actualEnd: daysAgo(27 - stage.sortOrder),
        })),
      },
    },
    include: { stages: true },
  });

  for (const stageInstance of olivePo.stages) {
    const stageDef = stageDefs.find((s) => s.id === stageInstance.stageDefinitionId)!;
    await prisma.productionTask.create({
      data: {
        number: `TSK-OLV-${stageDef.code}`,
        productionOrderId: olivePo.id,
        stageDefinitionId: stageDef.id,
        stageInstanceId: stageInstance.id,
        name: stageDef.nameEn,
        description: buildStageTaskInstructions({
          stageCode: stageDef.code,
          stageNameEn: stageDef.nameEn,
          productDescription: 'Dining Chair — beige linen',
          quantity: 12,
          specifications: 'Fabric FAB-LIN-01 · Color CLR-BGE',
        }),
        status: TaskStatus.COMPLETED,
        progressPercent: 100,
        assignedEmployeeId: oliveStageAssignee[stageDef.code],
        priority: Priority.NORMAL,
        actualStart: daysAgo(20),
        actualCompletion: daysAgo(6),
      },
    });
  }

  await prisma.qualityInspection.create({
    data: {
      number: 'QI-OLV-001',
      productionOrderId: olivePo.id,
      stageCode: 'INSPECTION',
      inspectorId: inspector.id,
      inspectedAt: daysAgo(7),
      result: QualityResult.PASSED,
      notes: 'All dining chairs passed final QC',
      items: {
        create: qcTemplate.items.map((item) => ({
          checklistCode: item.code,
          label: item.labelEn,
          result: ChecklistItemResult.PASS,
        })),
      },
    },
  });

  await prisma.delivery.create({
    data: {
      number: 'DEL-OLV-001',
      salesOrderId: oliveSo.id,
      customerId: olive.id,
      deliveryAddress: 'Rainbow Street 8, Amman',
      deliveryDate: daysAgo(3),
      deliveryWindow: '10:00–14:00',
      status: DeliveryStatus.DELIVERED,
      recipientName: 'سارة عمر',
      driverId: driver.id,
      items: {
        create: [{ description: 'Dining Chair', quantity: money(12) }],
      },
    },
  });

  const oliveInv = await prisma.invoice.create({
    data: {
      number: 'INV-OLV-001',
      customerId: olive.id,
      salesOrderId: oliveSo.id,
      status: InvoiceStatus.PAID,
      invoiceDate: daysAgo(10),
      dueDate: daysAgo(0),
      subtotal: money(oliveLine.subtotal),
      taxTotal: money(oliveLine.taxAmount),
      total: money(oliveLine.lineTotal),
      paidAmount: money(oliveLine.lineTotal),
      outstandingAmount: money(0),
      createdById: admin.id,
      lines: {
        create: [
          {
            description: 'Dining Chair × 12',
            quantity: money(12),
            unitPrice: money(95),
            taxRate: VAT,
            lineTotal: money(oliveLine.lineTotal),
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      number: 'PAY-OLV-001',
      customerId: olive.id,
      invoiceId: oliveInv.id,
      paymentDate: daysAgo(2),
      amount: money(oliveLine.lineTotal),
      method: PaymentMethod.BANK_TRANSFER,
      referenceNumber: 'TRF-OLV-001',
      notes: 'Full payment INV-OLV-001',
      createdById: admin.id,
      idempotencyKey: 'SEED-PAY-OLV-001',
    },
  });

  await prisma.statementEntry.create({
    data: {
      customerId: olive.id,
      entryDate: daysAgo(10),
      type: 'INVOICE',
      reference: 'INV-OLV-001',
      debit: money(oliveLine.lineTotal),
      credit: money(0),
      balance: money(oliveLine.lineTotal),
      description: 'Invoice issued — dining chairs',
    },
  });
  await prisma.statementEntry.create({
    data: {
      customerId: olive.id,
      entryDate: daysAgo(2),
      type: 'PAYMENT',
      reference: 'PAY-OLV-001',
      debit: money(0),
      credit: money(oliveLine.lineTotal),
      balance: money(0),
      description: 'Payment received in full',
    },
  });

  await prisma.returnRequest.create({
    data: {
      number: 'RET-OLV-001',
      customerId: olive.id,
      salesOrderId: oliveSo.id,
      productDesc: 'Dining Chair — beige linen',
      quantity: money(1),
      reason: ReturnReason.MANUFACTURING_DEFECT,
      description: 'Seat fabric tear / fabric damage on one chair after delivery',
      approvalStatus: 'PENDING',
      // Demo evidence photos (absolute URLs — list API passes these through)
      reasonPhotoKey:
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
      issuePhotoKey:
        'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
    },
  });

  // ── Petra showroom (pipeline front) ──────────────────────────────────────
  const petraRfq = await prisma.requestForQuotation.create({
    data: {
      number: 'RFQ-PET-001',
      customerId: petra.id,
      contactName: 'رامي خليل',
      source: RequestSource.PORTAL,
      assignedSalesId: admin.id,
      status: RequestStatus.READY_FOR_QUOTATION,
      priority: Priority.NORMAL,
      projectName: 'Petra showroom floor refresh',
      deliveryAddress: 'Wakalat Street 22, Sweifieh, Amman',
      requiredDeliveryDate: daysFromNow(45),
      createdById: admin.id,
      items: {
        create: [
          {
            category: 'BED',
            productName: 'Queen Bed',
            description: 'Showroom display beds',
            quantity: money(2),
            woodColor: 'Walnut',
            sortOrder: 0,
          },
          {
            category: 'SOFA',
            productName: 'L-Shape Sofa',
            description: 'Corner display sofa',
            quantity: money(1),
            fabricType: 'Velvet',
            fabricCode: 'FAB-VEL-01',
            sortOrder: 1,
          },
        ],
      },
    },
  });

  const petraLines = [
    { qty: 2, unitPrice: 1100, subtotal: 2200, taxAmount: 352, lineTotal: 2552 },
    { qty: 1, unitPrice: 1450, subtotal: 1450, taxAmount: 232, lineTotal: 1682 },
  ];
  const petraTotals = orderTotals(petraLines);

  await prisma.quotation.create({
    data: {
      number: 'Q-PET-001',
      version: 1,
      customerId: petra.id,
      requestId: petraRfq.id,
      status: QuotationStatus.SENT,
      paymentTerms: '21 days',
      deliveryTerms: 'Sweifieh showroom delivery',
      subtotal: petraTotals.subtotal,
      taxTotal: petraTotals.taxTotal,
      total: petraTotals.total,
      sentAt: daysAgo(1),
      createdById: admin.id,
      salesRepId: admin.id,
      lines: {
        create: [
          {
            productId: bedQ.id,
            description: 'Queen Bed — showroom',
            quantity: money(2),
            unitPrice: money(1100),
            taxRate: VAT,
            discountType: DiscountType.NONE,
            subtotal: money(2200),
            taxAmount: money(352),
            lineTotal: money(2552),
            color: 'CLR-WAL',
            sortOrder: 0,
          },
          {
            productId: sofL.id,
            description: 'L-Shape Sofa — display',
            quantity: money(1),
            unitPrice: money(1450),
            taxRate: VAT,
            discountType: DiscountType.NONE,
            subtotal: money(1450),
            taxAmount: money(232),
            lineTotal: money(1682),
            fabric: 'FAB-VEL-01',
            sortOrder: 1,
          },
        ],
      },
    },
  });

  await prisma.requestForQuotation.update({
    where: { id: petraRfq.id },
    data: { status: RequestStatus.QUOTED },
  });

  // ── Villa draft quote ────────────────────────────────────────────────────
  const villaLines = lineTotals(2, 320);
  await prisma.quotation.create({
    data: {
      number: 'Q-VIL-001',
      version: 1,
      customerId: villa.id,
      status: QuotationStatus.DRAFT,
      paymentTerms: '7 days',
      deliveryTerms: 'Khalda delivery',
      subtotal: villaLines.subtotal,
      taxTotal: villaLines.taxAmount,
      total: villaLines.lineTotal,
      createdById: admin.id,
      salesRepId: admin.id,
      lines: {
        create: [
          {
            productId: arm01.id,
            description: 'Armchair — guest lounge',
            quantity: money(2),
            unitPrice: money(320),
            taxRate: VAT,
            discountType: DiscountType.NONE,
            subtotal: villaLines.subtotal,
            taxAmount: villaLines.taxAmount,
            lineTotal: villaLines.lineTotal,
            fabric: 'FAB-VEL-01',
            color: 'CLR-WHT',
            sortOrder: 0,
          },
        ],
      },
    },
  });

  // ── Notifications ────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        type: 'LOW_STOCK',
        titleAr: 'تنبيه مخزون منخفض',
        titleEn: 'Low stock alert',
        bodyAr: 'قماش التنجيد FAB-ROLL عند 35 م (الحد الأدنى 100). طلب الشراء PR-DEMO-002 مفتوح.',
        bodyEn: 'Upholstery fabric FAB-ROLL at 35 m (min 100). Open PR-DEMO-002.',
        linkUrl: '/inventory',
      },
      {
        userId: admin.id,
        type: 'LOW_STOCK',
        titleAr: 'إعادة طلب قماش',
        titleEn: 'Fabric reorder needed',
        bodyAr: 'FAB-ROLL أقل من الحد الأدنى — راجع PR-DEMO-002.',
        bodyEn: 'FAB-ROLL below minimum — review PR-DEMO-002.',
        linkUrl: '/purchasing',
      },
      {
        userId: admin.id,
        type: 'QUOTE_SENT',
        titleAr: 'عرض سعر مرسل',
        titleEn: 'Quotation sent',
        bodyAr: 'تم إرسال عرض السعر Q-DEMO-001 لفندق الأرز.',
        bodyEn: 'Quotation Q-DEMO-001 sent to Cedar Hotel.',
        linkUrl: '/quotations',
        readAt: daysAgo(7),
      },
      {
        userId: admin.id,
        type: 'PAYMENT_RECEIVED',
        titleAr: 'استلام دفعة',
        titleEn: 'Payment received',
        bodyAr: `تم استلام دفعة كاملة بمبلغ ${oliveLine.lineTotal.toFixed(3)} دينار من مطعم الزيتون.`,
        bodyEn: `Full payment of ${oliveLine.lineTotal.toFixed(3)} JOD received from Olive Restaurant.`,
        linkUrl: '/payments',
      },
    ],
  });

  // ── Summary ──────────────────────────────────────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    customers: await prisma.customer.count(),
    products: await prisma.product.count(),
    materials: await prisma.material.count(),
    inventoryItems: await prisma.inventoryItem.count(),
    suppliers: await prisma.supplier.count(),
    purchaseRequests: await prisma.purchaseRequest.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    rfqs: await prisma.requestForQuotation.count(),
    quotations: await prisma.quotation.count(),
    salesOrders: await prisma.salesOrder.count(),
    productionOrders: await prisma.productionOrder.count(),
    tasks: await prisma.productionTask.count(),
    invoices: await prisma.invoice.count(),
    payments: await prisma.payment.count(),
    deliveries: await prisma.delivery.count(),
    notifications: await prisma.notification.count(),
    returns: await prisma.returnRequest.count(),
  };

  console.log('Demo world seeded:');
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key}: ${value}`);
  }
}
