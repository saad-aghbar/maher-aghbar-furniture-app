import {
  PrismaClient,
  PurchaseRequestStatus,
  PurchaseOrderStatus,
  InventoryTxType,
  InvoiceStatus,
  PaymentMethod,
  Priority,
} from '@prisma/client';
import { VAT, daysAgo, money, monthsAgo } from './util';
import type { InvItemRef } from './inventory';

export async function seedPurchasing(
  prisma: PrismaClient,
  opts: {
    adminId: string;
    items: InvItemRef[];
    rawWhId: string;
  },
) {
  const suppliers = [
    { code: 'SUP-TIMBER', nameEn: 'Zarqa Timber Yard', nameAr: 'ساحة أخشاب الزرقاء', phone: '+96253990001', email: 'sales@zarqa-timber.jo' },
    { code: 'SUP-FOAM', nameEn: 'Jordan Foam Industries', nameAr: 'صناعات الإسفنج الأردنية', phone: '+96265551002', email: 'orders@jo-foam.jo' },
    { code: 'SUP-FABRIC', nameEn: 'Abdali Textile Mill', nameAr: 'مصنع أقمشة العبدلي', phone: '+96265661003', email: 'b2b@abdali-textile.jo' },
    { code: 'SUP-HW', nameEn: 'Sahab Hardware Co', nameAr: 'شركة سحاب للمعدات', phone: '+96264001004', email: 'desk@sahab-hw.jo' },
    { code: 'SUP-FINISH', nameEn: 'Marka Coatings', nameAr: 'دهانات ماركا', phone: '+96264881005', email: 'sales@marka-coatings.jo' },
    { code: 'SUP-PACK', nameEn: 'East Pack Packaging', nameAr: 'إيست باك للتغليف', phone: '+96265111006', email: 'ops@eastpack.jo' },
  ];

  const supplierIds: Record<string, string> = {};
  for (const s of suppliers) {
    const row = await prisma.supplier.create({
      data: {
        code: s.code,
        name: s.nameEn,
        nameEn: s.nameEn,
        nameAr: s.nameAr,
        phone: s.phone,
        email: s.email,
        paymentTermsDays: 30,
        status: 'ACTIVE',
        contacts: {
          create: { name: 'Sales Desk', phone: s.phone, email: s.email, isPrimary: true },
        },
      },
    });
    supplierIds[s.code] = row.id;
  }

  const wood = opts.items.find((i) => i.sku === 'MAT-BEECH')!;
  const foam = opts.items.find((i) => i.sku === 'MAT-FOAM-HD')!;
  const fabric = opts.items.find((i) => i.sku === 'MAT-FAB-ROLL')!;
  const hw = opts.items.find((i) => i.sku === 'MAT-HW-KIT')!;
  const lacq = opts.items.find((i) => i.sku === 'MAT-LACQ')!;

  let buySeq = 1;
  for (const mo of [7, 5, 3, 1]) {
    const when = monthsAgo(mo, 8);
    const n = String(buySeq).padStart(3, '0');
    buySeq += 1;

    const pr = await prisma.purchaseRequest.create({
      data: {
        number: `PR-2025-${n}`,
        status: PurchaseRequestStatus.ORDERED,
        priority: Priority.NORMAL,
        requiredDate: daysAgo(mo * 30 - 5),
        reason: `Restock cycle M-${mo}`,
        requestedById: opts.adminId,
        warehouseId: opts.rawWhId,
        createdAt: when,
        lines: {
          create: [
            { inventoryItemId: wood.id, description: 'Beech lumber', quantity: money(80), unit: 'm' },
            { inventoryItemId: foam.id, description: 'HD foam', quantity: money(12), unit: 'block' },
          ],
        },
      },
    });

    await prisma.supplierQuoteOffer.create({
      data: {
        purchaseRequestId: pr.id,
        supplierId: supplierIds['SUP-TIMBER']!,
        unitPrice: money(11.4),
        leadTimeDays: 5,
        qualityScore: money(4.7),
        isSelected: true,
        notes: 'Kiln-dried beech',
      },
    });

    const sub = 80 * 11.5 + 12 * 92;
    const tax = sub * VAT;
    const po = await prisma.purchaseOrder.create({
      data: {
        number: `PO-BUY-${n}`,
        supplierId: supplierIds['SUP-TIMBER']!,
        warehouseId: opts.rawWhId,
        orderDate: daysAgo(mo * 30 - 2),
        expectedDeliveryDate: daysAgo(mo * 30 - 10),
        status: PurchaseOrderStatus.RECEIVED,
        paymentTermsDays: 30,
        subtotal: money(sub),
        taxAmount: money(tax),
        total: money(sub + tax),
        createdAt: daysAgo(mo * 30 - 2),
        lines: {
          create: [
            {
              inventoryItemId: wood.id,
              description: 'Beech lumber',
              quantity: money(80),
              unitPrice: money(11.5),
              taxRate: VAT,
              lineTotal: money(80 * 11.5 * (1 + VAT)),
            },
            {
              inventoryItemId: foam.id,
              description: 'HD foam',
              quantity: money(12),
              unitPrice: money(92),
              taxRate: VAT,
              lineTotal: money(12 * 92 * (1 + VAT)),
            },
          ],
        },
      },
    });

    await prisma.purchaseRequest.update({
      where: { id: pr.id },
      data: { purchaseOrderId: po.id, status: PurchaseRequestStatus.ORDERED },
    });

    await prisma.goodsReceipt.create({
      data: {
        number: `GRN-${n}`,
        purchaseOrderId: po.id,
        warehouseId: opts.rawWhId,
        receiptDate: daysAgo(mo * 30 - 10),
        deliveryDocRef: `DN-TIM-${n}`,
        createdById: opts.adminId,
        lines: {
          create: [
            { inventoryItemId: wood.id, orderedQty: money(80), receivedQty: money(80), qualityStatus: 'OK', batchNumber: `BCH-${n}` },
            { inventoryItemId: foam.id, orderedQty: money(12), receivedQty: money(12), qualityStatus: 'OK', batchNumber: `FOAM-${n}` },
          ],
        },
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        number: `ITX-PO-${n}-W`,
        type: InventoryTxType.PURCHASE_RECEIPT,
        inventoryItemId: wood.id,
        warehouseId: opts.rawWhId,
        quantity: money(80),
        unitCost: money(11.5),
        referenceType: 'PurchaseOrder',
        referenceId: po.id,
        createdById: opts.adminId,
        createdAt: daysAgo(mo * 30 - 10),
      },
    });

    const sin = await prisma.supplierInvoice.create({
      data: {
        number: `SIN-${n}`,
        supplierId: supplierIds['SUP-TIMBER']!,
        purchaseOrderId: po.id,
        status: InvoiceStatus.PAID,
        invoiceDate: daysAgo(mo * 30 - 9),
        dueDate: daysAgo(mo * 30 - 9 + 30),
        subtotal: money(sub),
        taxTotal: money(tax),
        total: money(sub + tax),
        paidAmount: money(sub + tax),
        outstandingAmount: money(0),
        createdById: opts.adminId,
        lines: {
          create: [
            { description: 'Beech + foam restock', quantity: money(1), unitPrice: money(sub), taxRate: VAT, lineTotal: money(sub + tax) },
          ],
        },
      },
    });

    await prisma.supplierPayment.create({
      data: {
        number: `SPAY-${n}`,
        supplierId: supplierIds['SUP-TIMBER']!,
        supplierInvoiceId: sin.id,
        amount: money(sub + tax),
        method: PaymentMethod.BANK_TRANSFER,
        paymentDate: daysAgo(mo * 30 - 20),
        referenceNumber: `TRF-TIM-${n}`,
        createdById: opts.adminId,
      },
    });
  }

  await prisma.purchaseRequest.create({
    data: {
      number: 'PR-OPEN-FAB',
      status: PurchaseRequestStatus.APPROVED,
      priority: Priority.HIGH,
      requiredDate: daysAgo(-7),
      reason: 'Urgent fabric restock — roll level below reorder',
      requestedById: opts.adminId,
      warehouseId: opts.rawWhId,
      createdAt: daysAgo(3),
      lines: {
        create: [
          { inventoryItemId: fabric.id, description: 'Upholstery fabric roll', quantity: money(120), unit: 'm' },
          { inventoryItemId: hw.id, description: 'Hardware kits', quantity: money(40), unit: 'kit' },
        ],
      },
    },
  });

  const lacqSub = 40 * 7.8;
  await prisma.purchaseOrder.create({
    data: {
      number: 'PO-BUY-OPEN-01',
      supplierId: supplierIds['SUP-FINISH']!,
      warehouseId: opts.rawWhId,
      orderDate: daysAgo(4),
      expectedDeliveryDate: daysAgo(-6),
      status: PurchaseOrderStatus.SENT,
      paymentTermsDays: 30,
      subtotal: money(lacqSub),
      taxAmount: money(lacqSub * VAT),
      total: money(lacqSub * (1 + VAT)),
      notes: 'Lacquer top-up — awaiting delivery',
      lines: {
        create: [
          {
            inventoryItemId: lacq.id,
            description: 'Lacquer clear',
            quantity: money(40),
            unitPrice: money(7.8),
            taxRate: VAT,
            lineTotal: money(40 * 7.8 * (1 + VAT)),
          },
        ],
      },
    },
  });

  const openPr = await prisma.purchaseRequest.findUniqueOrThrow({ where: { number: 'PR-OPEN-FAB' } });
  await prisma.supplierQuoteOffer.createMany({
    data: [
      {
        purchaseRequestId: openPr.id,
        supplierId: supplierIds['SUP-FABRIC']!,
        unitPrice: money(6.4),
        leadTimeDays: 4,
        qualityScore: money(4.5),
        isSelected: true,
        notes: 'Sand/velvet mix available',
      },
      {
        purchaseRequestId: openPr.id,
        supplierId: supplierIds['SUP-PACK']!,
        unitPrice: money(6.9),
        leadTimeDays: 7,
        qualityScore: money(4.0),
        isSelected: false,
        notes: 'Alternate mill — longer lead',
      },
    ],
  });

  return { supplierIds };
}
