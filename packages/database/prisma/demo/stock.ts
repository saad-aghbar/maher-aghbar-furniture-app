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
import { daysAgo } from './clock';
import type { MaterialRef } from './catalog';
import { nextDoc, type SeqBag } from './seq';
import { defaultBinIdForWarehouse } from '../seed/warehouse-bins';

export async function applyDemoMovement(
  prisma: PrismaClient,
  opts: {
    type: InventoryTxType;
    itemId: string;
    warehouseId: string;
    quantity: number;
    unitCost?: number | null;
    userId: string;
    at: Date;
    notes?: string;
    referenceType?: string;
    referenceId?: string;
    productionOrderId?: string;
    productionTaskId?: string;
    salesOrderId?: string;
    locationId?: string;
    /** When set, skip the inbound/outbound type table and use this sign. */
    outbound?: boolean;
    counters: SeqBag;
    reservedDelta?: number;
    onOrderDelta?: number;
  },
) {
  const outboundTypes: InventoryTxType[] = [
    InventoryTxType.PRODUCTION_ISSUE,
    InventoryTxType.DELIVERY_ISSUE,
    InventoryTxType.DAMAGE,
    InventoryTxType.SCRAP,
    InventoryTxType.SEMI_FINISHED_ISSUE,
  ];
  const signed =
    opts.outbound === true
      ? -Math.abs(opts.quantity)
      : opts.outbound === false
        ? Math.abs(opts.quantity)
        : outboundTypes.includes(opts.type)
          ? -Math.abs(opts.quantity)
          : Math.abs(opts.quantity);
  const number = await nextDoc(prisma, 'invtx', opts.counters);

  const locationId = opts.locationId ?? (await defaultBinIdForWarehouse(prisma, opts.warehouseId));
  await prisma.inventoryTransaction.create({
    data: {
      number,
      type: opts.type,
      inventoryItemId: opts.itemId,
      warehouseId: opts.warehouseId,
      locationId,
      quantity: money(signed),
      unitCost: opts.unitCost != null && opts.unitCost > 0 ? money(opts.unitCost) : undefined,
      notes: opts.notes,
      referenceType: opts.referenceType,
      referenceId: opts.referenceId,
      productionOrderId: opts.productionOrderId,
      productionTaskId: opts.productionTaskId,
      salesOrderId: opts.salesOrderId,
      createdById: opts.userId,
      createdAt: opts.at,
    },
  });

  const existing = await prisma.inventoryBalance.findFirst({
    where: { inventoryItemId: opts.itemId, warehouseId: opts.warehouseId, locationId },
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
        locationId,
        availableQty: money(nextAvail),
        reservedQty: money(nextReserved),
        onOrderQty: money(nextOnOrder),
      },
    });
  }
}

const SUPPLIERS = [
  {
    code: 'SUP-TIMBER',
    nameEn: 'Zarqa Timber Yard',
    nameAr: 'ساحة أخشاب الزرقاء',
    nameHe: 'חצר עץ זרקא',
    phone: '+96253990001',
    email: 'sales@zarqa-timber.jo',
  },
  {
    code: 'SUP-FABRIC',
    nameEn: 'Abdali Textile Mill',
    nameAr: 'مصنع أقمشة العبدلي',
    nameHe: 'מפעל טקסטיל עבדלי',
    phone: '+96265661003',
    email: 'b2b@abdali-textile.jo',
  },
  {
    code: 'SUP-FOAM',
    nameEn: 'Jordan Foam & Hardware',
    nameAr: 'إسفنج ومعدات الأردن',
    nameHe: 'ספוג וחומרה',
    phone: '+96265551002',
    email: 'orders@jo-foam.jo',
  },
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
  const semiWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'SEMI' } });

  const openingAt = daysAgo(35, 8, 0);
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
      notes: 'Factory opening stock',
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
        nameHe: s.nameHe,
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
    number: string;
    /** Days after orderDate for expected delivery. Negative = already overdue. */
    expectedOffsetDays: number;
  };

  const pos: PoSpec[] = [
    {
      supplier: 'SUP-TIMBER',
      status: PurchaseOrderStatus.RECEIVED,
      day: daysAgo(20, 10),
      lines: [
        { sku: 'MAT-PINE', qty: 40 },
        { sku: 'MAT-BEECH', qty: 10 },
      ],
      pay: 'full',
      note: 'Fully received timber restock',
      number: 'PORD-DEMO-RCVD',
      expectedOffsetDays: 7,
    },
    {
      supplier: 'SUP-FABRIC',
      status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
      day: daysAgo(10, 10),
      lines: [
        { sku: 'MAT-VEL-SAND', qty: 40, receive: 18 },
        { sku: 'MAT-LIN-NAT', qty: 24, receive: 12 },
      ],
      pay: 'none',
      note: 'Partially received fabric',
      number: 'PORD-DEMO-PARTIAL',
      expectedOffsetDays: 7,
    },
    {
      supplier: 'SUP-FOAM',
      status: PurchaseOrderStatus.SENT,
      day: daysAgo(3, 10),
      lines: [
        { sku: 'MAT-FOAM-HD', qty: 12 },
        { sku: 'MAT-HW-KIT', qty: 20 },
      ],
      pay: 'none',
      note: 'Open inbound foam / hardware',
      number: 'PORD-DEMO-OPEN',
      expectedOffsetDays: 10,
    },
    {
      supplier: 'SUP-TIMBER',
      status: PurchaseOrderStatus.SENT,
      day: daysAgo(18, 10),
      lines: [{ sku: 'MAT-BEECH', qty: 50 }],
      pay: 'none',
      note: 'Late beech PO — past expected delivery',
      number: 'PORD-DEMO-LATE',
      expectedOffsetDays: -5,
    },
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
    const poNumber = spec.number;
    const expectedDeliveryDate = new Date(spec.day.getTime() + spec.expectedOffsetDays * 86400000);

    const po = await prisma.purchaseOrder.create({
      data: {
        number: poNumber,
        supplierId,
        warehouseId: rawWh.id,
        orderDate: spec.day,
        expectedDeliveryDate,
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
      spec.status === PurchaseOrderStatus.RECEIVED ||
      spec.status === PurchaseOrderStatus.PARTIALLY_RECEIVED;
    if (shouldReceive) {
      const receiptDate = new Date(spec.day.getTime() + 5 * 86400000);
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
        const invNumber = `SINV-${poNumber.replace(/^PORD-/, '')}`;
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
              number: `SPAY-${poNumber.replace(/^PORD-/, '')}`,
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
      const rawBinId = await defaultBinIdForWarehouse(prisma, rawWh.id);
      for (const l of lineData) {
        const existing = await prisma.inventoryBalance.findFirst({
          where: { inventoryItemId: l.mat.id, warehouseId: rawWh.id, locationId: rawBinId },
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
              locationId: rawBinId,
              availableQty: money(0),
              onOrderQty: money(l.qty),
            },
          });
        }
      }
    }
  }

  const beech = bySku.get('MAT-BEECH')!;
  const openPr = await nextDoc(prisma, 'purchase_request', opts.counters);
  await prisma.purchaseRequest.create({
    data: {
      number: openPr,
      status: PurchaseRequestStatus.SUBMITTED,
      priority: Priority.HIGH,
      requiredDate: daysAgo(0, 10),
      reason: 'Low-stock beech reorder (MAT-BEECH)',
      requestedById: opts.purchasingId,
      warehouseId: rawWh.id,
      preferredSupplierId: supplierIds['SUP-TIMBER'],
      createdAt: daysAgo(1, 11),
      lines: {
        create: [
          {
            inventoryItemId: beech.id,
            description: beech.nameEn,
            quantity: money(60),
            unit: beech.unit,
          },
        ],
      },
    },
  });

  // Transfer must not become consumption (signed move RAW→SEMI).
  const pine = bySku.get('MAT-PINE')!;
  await applyDemoMovement(prisma, {
    type: InventoryTxType.WAREHOUSE_TRANSFER,
    itemId: pine.id,
    warehouseId: rawWh.id,
    quantity: 5,
    unitCost: pine.unitCost,
    userId: opts.adminId,
    at: daysAgo(2, 9),
    notes: 'Transfer sample outbound RAW→SEMI (not consumption)',
    outbound: true,
    counters: opts.counters,
  });
  await applyDemoMovement(prisma, {
    type: InventoryTxType.WAREHOUSE_TRANSFER,
    itemId: pine.id,
    warehouseId: semiWh.id,
    quantity: 5,
    unitCost: pine.unitCost,
    userId: opts.adminId,
    at: daysAgo(2, 9),
    notes: 'Transfer sample inbound SEMI',
    outbound: false,
    counters: opts.counters,
  });
  await applyDemoMovement(prisma, {
    type: InventoryTxType.INVENTORY_ADJUSTMENT,
    itemId: beech.id,
    warehouseId: rawWh.id,
    quantity: -1,
    unitCost: beech.unitCost,
    userId: opts.adminId,
    at: daysAgo(1, 15),
    notes: 'Cycle-count adjustment sample',
    outbound: true,
    counters: opts.counters,
  });

  console.log(`  purchasing: ${SUPPLIERS.length} suppliers · ${pos.length} POs + 1 open PR`);
  return { rawWhId: rawWh.id, finWhId: finWh.id, supplierIds };
}
