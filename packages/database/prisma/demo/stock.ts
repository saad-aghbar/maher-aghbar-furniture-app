import {
  InventoryTxType,
  PrismaClient,
  PurchaseOrderStatus,
  PurchaseRequestStatus,
  InvoiceStatus,
  PaymentMethod,
  Priority,
} from '@prisma/client';
import { VAT, money } from '../seed/util';
import { ammanLocal } from './clock';
import type { MaterialRef } from './catalog';
import { nextDoc, type SeqBag } from './seq';

export async function applyDemoMovement(
  prisma: PrismaClient,
  opts: {
    type: InventoryTxType;
    itemId: string;
    warehouseId: string;
    quantity: number;
    unitCost?: number;
    userId: string;
    at: Date;
    notes?: string;
    referenceType?: string;
    referenceId?: string;
    counters: SeqBag;
    reservedDelta?: number;
    onOrderDelta?: number;
  },
) {
  const outbound: InventoryTxType[] = [
    InventoryTxType.PRODUCTION_ISSUE,
    InventoryTxType.DELIVERY_ISSUE,
    InventoryTxType.DAMAGE,
    InventoryTxType.SCRAP,
    InventoryTxType.SEMI_FINISHED_ISSUE,
  ];
  const signed = outbound.includes(opts.type) ? -Math.abs(opts.quantity) : Math.abs(opts.quantity);
  const number = await nextDoc(prisma, 'invtx', opts.counters);

  await prisma.inventoryTransaction.create({
    data: {
      number,
      type: opts.type,
      inventoryItemId: opts.itemId,
      warehouseId: opts.warehouseId,
      quantity: money(signed),
      unitCost: opts.unitCost != null ? money(opts.unitCost) : undefined,
      notes: opts.notes,
      referenceType: opts.referenceType,
      referenceId: opts.referenceId,
      createdById: opts.userId,
      createdAt: opts.at,
    },
  });

  const existing = await prisma.inventoryBalance.findFirst({
    where: { inventoryItemId: opts.itemId, warehouseId: opts.warehouseId, locationId: null },
  });
  const nextAvail = Number(existing?.availableQty ?? 0) + signed;
  const nextReserved = Number(existing?.reservedQty ?? 0) + (opts.reservedDelta ?? 0);
  const nextOnOrder = Number(existing?.onOrderQty ?? 0) + (opts.onOrderDelta ?? 0);
  if (existing) {
    await prisma.inventoryBalance.update({
      where: { id: existing.id },
      data: {
        availableQty: money(nextAvail),
        reservedQty: money(nextReserved),
        onOrderQty: money(nextOnOrder),
      },
    });
  } else {
    await prisma.inventoryBalance.create({
      data: {
        inventoryItemId: opts.itemId,
        warehouseId: opts.warehouseId,
        availableQty: money(nextAvail),
        reservedQty: money(nextReserved),
        onOrderQty: money(nextOnOrder),
      },
    });
  }
}

const SUPPLIERS = [
  { code: 'SUP-TIMBER', nameEn: 'Zarqa Timber Yard', nameAr: 'ساحة أخشاب الزرقاء', phone: '+96253990001', email: 'sales@zarqa-timber.jo', skus: ['MAT-BEECH', 'MAT-OAK', 'MAT-PLY', 'MAT-MDF', 'MAT-PINE'] },
  { code: 'SUP-FOAM', nameEn: 'Jordan Foam Industries', nameAr: 'صناعات الإسفنج الأردنية', phone: '+96265551002', email: 'orders@jo-foam.jo', skus: ['MAT-FOAM-HD', 'MAT-FOAM-MD', 'MAT-FOAM-LD', 'MAT-FOAM-HR'] },
  { code: 'SUP-FABRIC', nameEn: 'Abdali Textile Mill', nameAr: 'مصنع أقمشة العبدلي', phone: '+96265661003', email: 'b2b@abdali-textile.jo', skus: ['MAT-VEL-SAND', 'MAT-VEL-NAVY', 'MAT-LIN-NAT', 'MAT-BOU-CRM'] },
  { code: 'SUP-HW', nameEn: 'Sahab Hardware Co', nameAr: 'شركة سحاب للمعدات', phone: '+96264001004', email: 'desk@sahab-hw.jo', skus: ['MAT-HW-KIT', 'MAT-HW-SCREW', 'MAT-SPRING', 'MAT-MECH-RECL'] },
  { code: 'SUP-FINISH', nameEn: 'Marka Coatings', nameAr: 'دهانات ماركا', phone: '+96264881005', email: 'sales@marka-coatings.jo', skus: ['MAT-LACQ', 'MAT-STAIN-WAL', 'MAT-PRIMER'] },
  { code: 'SUP-PACK', nameEn: 'East Pack Packaging', nameAr: 'إيست باك للتغليف', phone: '+96265111006', email: 'ops@eastpack.jo', skus: ['MAT-FOIL', 'MAT-CARTON', 'MAT-CORNER'] },
  { code: 'SUP-SPRING', nameEn: 'Irbid Spring Works', nameAr: 'أعمال النوابض إربد', phone: '+96227221007', email: 'sales@irbid-spring.jo', skus: ['MAT-SPRING', 'MAT-CASTER'] },
  { code: 'SUP-ADH', nameEn: 'Aqaba Adhesives', nameAr: 'لواصق العقبة', phone: '+96232001008', email: 'orders@aqaba-adh.jo', skus: ['MAT-GLUE', 'MAT-SPRAY-ADH'] },
];

export async function seedDemoStock(
  prisma: PrismaClient,
  opts: {
    adminId: string;
    purchasingId: string;
    materials: MaterialRef[];
    counters: SeqBag;
  },
) {
  const rawWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'RAW' } });
  const finWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'FIN' } });
  await prisma.warehouseLocation.create({
    data: { warehouseId: rawWh.id, code: 'RAW-A1', name: 'Raw aisle A1' },
  });
  await prisma.warehouseLocation.create({
    data: { warehouseId: rawWh.id, code: 'RAW-B2', name: 'Raw aisle B2' },
  });
  await prisma.warehouseLocation.create({
    data: { warehouseId: finWh.id, code: 'FIN-DOCK', name: 'Finished dock' },
  });

  const openingAt = ammanLocal(2026, 6, 1, 8, 0);
  for (const m of opts.materials) {
    if (m.opening <= 0) continue;
    await applyDemoMovement(prisma, {
      type: InventoryTxType.OPENING_BALANCE,
      itemId: m.id,
      warehouseId: rawWh.id,
      quantity: m.opening,
      unitCost: m.unitCost,
      userId: opts.adminId,
      at: openingAt,
      notes: 'Factory opening stock 1 Jun 2026',
      counters: opts.counters,
    });
  }

  const supplierIds: Record<string, string> = {};
  for (const s of SUPPLIERS) {
    const row = await prisma.supplier.create({
      data: {
        code: s.code,
        name: s.nameEn,
        nameEn: s.nameEn,
        nameAr: s.nameAr,
        phone: s.phone,
        email: s.email,
        paymentTermsDays: 30,
        leadTimeDays: 10,
        status: 'ACTIVE',
        contacts: {
          create: { name: 'Sales desk', phone: s.phone, email: s.email, isPrimary: true },
        },
      },
    });
    supplierIds[s.code] = row.id;
  }

  const bySku = new Map(opts.materials.map((m) => [m.sku, m]));

  type PoSpec = {
    supplier: string;
    status: PurchaseOrderStatus;
    day: Date;
    lines: Array<{ sku: string; qty: number; receive?: number }>;
    pay?: 'full' | 'partial' | 'none';
    note: string;
  };

  const pos: PoSpec[] = [
    { supplier: 'SUP-TIMBER', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 6, 18, 10), lines: [{ sku: 'MAT-BEECH', qty: 80 }, { sku: 'MAT-PLY', qty: 40 }], pay: 'full', note: 'June timber restock' },
    { supplier: 'SUP-TIMBER', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 7, 8, 10), lines: [{ sku: 'MAT-OAK', qty: 50 }, { sku: 'MAT-MDF', qty: 30 }], pay: 'full', note: 'Oak for dining tables' },
    { supplier: 'SUP-FOAM', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 6, 22, 11), lines: [{ sku: 'MAT-FOAM-HD', qty: 20 }, { sku: 'MAT-FOAM-MD', qty: 16 }], pay: 'full', note: 'Foam cycle June' },
    { supplier: 'SUP-FOAM', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 7, 20, 11), lines: [{ sku: 'MAT-FOAM-HD', qty: 18 }, { sku: 'MAT-FOAM-HR', qty: 8 }], pay: 'partial', note: 'July foam' },
    { supplier: 'SUP-FABRIC', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 6, 25, 9), lines: [{ sku: 'MAT-VEL-SAND', qty: 60 }, { sku: 'MAT-LIN-NAT', qty: 40 }], pay: 'full', note: 'Velvet / linen' },
    { supplier: 'SUP-FABRIC', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 7, 14, 9), lines: [{ sku: 'MAT-VEL-NAVY', qty: 40 }, { sku: 'MAT-BOU-CRM', qty: 30 }], pay: 'partial', note: 'Navy + boucle' },
    { supplier: 'SUP-HW', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 6, 20, 14), lines: [{ sku: 'MAT-HW-KIT', qty: 40 }, { sku: 'MAT-HW-SCREW', qty: 800 }], pay: 'full', note: 'Hardware June' },
    { supplier: 'SUP-HW', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 7, 28, 14), lines: [{ sku: 'MAT-MECH-RECL', qty: 12 }, { sku: 'MAT-SPRING', qty: 10 }], pay: 'none', note: 'Recliner kits' },
    { supplier: 'SUP-FINISH', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 6, 28, 10), lines: [{ sku: 'MAT-LACQ', qty: 24 }, { sku: 'MAT-STAIN-WAL', qty: 12 }], pay: 'full', note: 'Coatings June' },
    { supplier: 'SUP-PACK', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 7, 2, 10), lines: [{ sku: 'MAT-CARTON', qty: 120 }, { sku: 'MAT-FOIL', qty: 20 }], pay: 'full', note: 'Packaging' },
    { supplier: 'SUP-SPRING', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 7, 10, 10), lines: [{ sku: 'MAT-SPRING', qty: 16 }, { sku: 'MAT-CASTER', qty: 20 }], pay: 'partial', note: 'Springs' },
    { supplier: 'SUP-ADH', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 7, 6, 10), lines: [{ sku: 'MAT-GLUE', qty: 30 }, { sku: 'MAT-SPRAY-ADH', qty: 18 }], pay: 'full', note: 'Adhesives' },
    { supplier: 'SUP-TIMBER', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 8, 4, 10), lines: [{ sku: 'MAT-BEECH', qty: 60 }, { sku: 'MAT-OAK', qty: 20 }], pay: 'none', note: 'August timber' },
    { supplier: 'SUP-FOAM', status: PurchaseOrderStatus.RECEIVED, day: ammanLocal(2026, 8, 6, 10), lines: [{ sku: 'MAT-FOAM-MD', qty: 12 }], pay: 'none', note: 'August foam top-up' },
    { supplier: 'SUP-TIMBER', status: PurchaseOrderStatus.PARTIALLY_RECEIVED, day: ammanLocal(2026, 8, 10, 10), lines: [{ sku: 'MAT-PLY', qty: 40, receive: 18 }, { sku: 'MAT-WALNUT', qty: 20, receive: 8 }], pay: 'none', note: 'Partial ply / veneer' },
    { supplier: 'SUP-FABRIC', status: PurchaseOrderStatus.PARTIALLY_RECEIVED, day: ammanLocal(2026, 8, 11, 10), lines: [{ sku: 'MAT-CHE-GRY', qty: 40, receive: 16 }], pay: 'none', note: 'Chenille partial' },
    { supplier: 'SUP-HW', status: PurchaseOrderStatus.PARTIALLY_RECEIVED, day: ammanLocal(2026, 8, 12, 10), lines: [{ sku: 'MAT-HW-KIT', qty: 30, receive: 12 }], pay: 'none', note: 'Hardware partial' },
    { supplier: 'SUP-PACK', status: PurchaseOrderStatus.PARTIALLY_RECEIVED, day: ammanLocal(2026, 8, 13, 10), lines: [{ sku: 'MAT-STRAP', qty: 20, receive: 8 }], pay: 'none', note: 'Strap partial' },
    { supplier: 'SUP-FABRIC', status: PurchaseOrderStatus.SENT, day: ammanLocal(2026, 8, 8, 10), lines: [{ sku: 'MAT-ITAL-VEL', qty: 24 }], pay: 'none', note: 'Italian velvet inbound — Cedar sectional' },
    { supplier: 'SUP-FINISH', status: PurchaseOrderStatus.SENT, day: ammanLocal(2026, 8, 14, 10), lines: [{ sku: 'MAT-WHT-PAINT', qty: 16 }], pay: 'none', note: 'White enamel inbound' },
    { supplier: 'SUP-FOAM', status: PurchaseOrderStatus.SENT, day: ammanLocal(2026, 8, 15, 10), lines: [{ sku: 'MAT-DACRON', qty: 40 }], pay: 'none', note: 'Dacron inbound' },
    { supplier: 'SUP-TIMBER', status: PurchaseOrderStatus.APPROVED, day: ammanLocal(2026, 8, 15, 15), lines: [{ sku: 'MAT-TEAK', qty: 12 }], pay: 'none', note: 'Teak approved not sent' },
  ];

  for (const spec of pos) {
    const supplierId = supplierIds[spec.supplier]!;
    const lineData = spec.lines.map((l) => {
      const mat = bySku.get(l.sku);
      if (!mat) throw new Error(`Unknown PO sku ${l.sku}`);
      const subtotal = l.qty * mat.unitCost;
      const tax = subtotal * VAT;
      return { ...l, mat, subtotal, tax, lineTotal: subtotal + tax };
    });
    const subtotal = lineData.reduce((s, l) => s + l.subtotal, 0);
    const taxAmount = lineData.reduce((s, l) => s + l.tax, 0);
    const prNumber = await nextDoc(prisma, 'purchase_request', opts.counters);
    const poNumber = await nextDoc(prisma, 'purchase_order', opts.counters);

    const po = await prisma.purchaseOrder.create({
      data: {
        number: poNumber,
        supplierId,
        warehouseId: rawWh.id,
        orderDate: spec.day,
        expectedDeliveryDate: new Date(spec.day.getTime() + 10 * 86400000),
        currency: 'ILS',
        status: spec.status,
        subtotal: money(subtotal),
        taxAmount: money(taxAmount),
        total: money(subtotal + taxAmount),
        notes: spec.note,
        createdAt: spec.day,
        lines: {
          create: lineData.map((l) => ({
            inventoryItemId: l.mat.id,
            description: l.mat.nameEn,
            quantity: money(l.qty),
            unit: l.mat.unit,
            unitPrice: money(l.mat.unitCost),
            taxRate: VAT,
            lineTotal: money(l.lineTotal),
          })),
        },
      },
      include: { lines: true },
    });

    await prisma.purchaseRequest.create({
      data: {
        number: prNumber,
        status: PurchaseRequestStatus.ORDERED,
        priority: Priority.NORMAL,
        requiredDate: po.expectedDeliveryDate,
        reason: spec.note,
        requestedById: opts.purchasingId,
        warehouseId: rawWh.id,
        purchaseOrderId: po.id,
        createdAt: spec.day,
        lines: {
          create: lineData.map((l) => ({
            inventoryItemId: l.mat.id,
            description: l.mat.nameEn,
            quantity: money(l.qty),
            unit: l.mat.unit,
          })),
        },
      },
    });

    const shouldReceive =
      spec.status === PurchaseOrderStatus.RECEIVED || spec.status === PurchaseOrderStatus.PARTIALLY_RECEIVED;
    if (shouldReceive) {
      const receiptDate = new Date(spec.day.getTime() + 7 * 86400000);
      const grnNumber = await nextDoc(prisma, 'grn', opts.counters);
      const grn = await prisma.goodsReceipt.create({
        data: {
          number: grnNumber,
          purchaseOrderId: po.id,
          warehouseId: rawWh.id,
          receiptDate,
          createdById: opts.purchasingId,
          createdAt: receiptDate,
          notes: spec.note,
          lines: {
            create: lineData.map((l) => ({
              inventoryItemId: l.mat.id,
              orderedQty: money(l.qty),
              receivedQty: money(l.receive ?? l.qty),
              rejectedQty: money(0),
            })),
          },
        },
      });
      for (const l of lineData) {
        const received = l.receive ?? l.qty;
        if (received <= 0) continue;
        await applyDemoMovement(prisma, {
          type: InventoryTxType.PURCHASE_RECEIPT,
          itemId: l.mat.id,
          warehouseId: rawWh.id,
          quantity: received,
          unitCost: l.mat.unitCost,
          userId: opts.purchasingId,
          at: receiptDate,
          notes: `GRN ${grn.number}`,
          referenceType: 'GoodsReceipt',
          referenceId: grn.id,
          counters: opts.counters,
        });
      }

      if (spec.status === PurchaseOrderStatus.RECEIVED && spec.pay) {
        const invNumber = `SINV-${poNumber.slice(5)}`;
        const paid =
          spec.pay === 'full'
            ? subtotal + taxAmount
            : spec.pay === 'partial'
              ? (subtotal + taxAmount) * 0.4
              : 0;
        const status =
          paid <= 0
            ? InvoiceStatus.ISSUED
            : paid + 0.001 >= subtotal + taxAmount
              ? InvoiceStatus.PAID
              : InvoiceStatus.PARTIALLY_PAID;
        const sinv = await prisma.supplierInvoice.create({
          data: {
            number: invNumber,
            supplierId,
            purchaseOrderId: po.id,
            goodsReceiptId: grn.id,
            invoiceDate: receiptDate,
            dueDate: new Date(receiptDate.getTime() + 30 * 86400000),
            currency: 'ILS',
            status,
            subtotal: money(subtotal),
            taxTotal: money(taxAmount),
            total: money(subtotal + taxAmount),
            paidAmount: money(paid),
            outstandingAmount: money(subtotal + taxAmount - paid),
            lines: {
              create: lineData.map((l, idx) => ({
                description: l.mat.nameEn,
                quantity: money(l.qty),
                unitPrice: money(l.mat.unitCost),
                taxRate: VAT,
                lineTotal: money(l.lineTotal),
                sortOrder: idx,
              })),
            },
          },
        });
        if (paid > 0) {
          await prisma.supplierPayment.create({
            data: {
              number: `SPAY-${poNumber.slice(5)}`,
              supplierId,
              supplierInvoiceId: sinv.id,
              paymentDate: new Date(receiptDate.getTime() + 5 * 86400000),
              amount: money(paid),
              currency: 'ILS',
              method: PaymentMethod.BANK_TRANSFER,
              notes: spec.note,
            },
          });
        }
      }
    } else if (spec.status === PurchaseOrderStatus.SENT || spec.status === PurchaseOrderStatus.APPROVED) {
      for (const l of lineData) {
        const existing = await prisma.inventoryBalance.findFirst({
          where: { inventoryItemId: l.mat.id, warehouseId: rawWh.id, locationId: null },
        });
        if (existing) {
          await prisma.inventoryBalance.update({
            where: { id: existing.id },
            data: { onOrderQty: money(Number(existing.onOrderQty) + l.qty) },
          });
        } else {
          await prisma.inventoryBalance.create({
            data: {
              inventoryItemId: l.mat.id,
              warehouseId: rawWh.id,
              availableQty: money(0),
              onOrderQty: money(l.qty),
            },
          });
        }
      }
    }
  }

  const openPr = await nextDoc(prisma, 'purchase_request', opts.counters);
  const foam = bySku.get('MAT-FOAM-HD')!;
  await prisma.purchaseRequest.create({
    data: {
      number: openPr,
      status: PurchaseRequestStatus.SUBMITTED,
      priority: Priority.HIGH,
      requiredDate: ammanLocal(2026, 8, 22, 10),
      reason: 'HD foam reorder before sectional wave',
      requestedById: opts.purchasingId,
      warehouseId: rawWh.id,
      preferredSupplierId: supplierIds['SUP-FOAM'],
      createdAt: ammanLocal(2026, 8, 14, 11),
      lines: {
        create: [
          {
            inventoryItemId: foam.id,
            description: foam.nameEn,
            quantity: money(24),
            unit: foam.unit,
          },
        ],
      },
    },
  });

  console.log(`  purchasing: ${SUPPLIERS.length} suppliers · ${pos.length} POs + 1 open PR`);
  return { rawWhId: rawWh.id, finWhId: finWh.id, supplierIds };
}
