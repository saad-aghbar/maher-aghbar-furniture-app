/**
 * Piece 6 deterministic purchasing / receiving examples (PO-P6-A…J).
 * GRNs post unitCost on GoodsReceiptLine + PURCHASE_RECEIPT txs (valuation map).
 * Preserves Piece 1–5 rows; upserts by PO number PO-P6-*.
 */
import {
  InventoryCategory,
  InventoryItemClass,
  InventoryTxType,
  PrismaClient,
  PurchaseOrderStatus,
} from '@prisma/client';
import { VAT, money } from '../seed/util';
import { ammanLocal } from './clock';

type LineSpec = {
  item: { id: string; sku: string; nameEn: string; unit: string; standardCost?: unknown };
  qty: number;
  unitPrice: number;
};

type GrnLineSpec = {
  inventoryItemId: string;
  orderedQty: number;
  receivedQty: number;
  rejectedQty?: number;
  unitCost: number;
};

export async function seedPiece6PurchasingReceivingExamples(
  prisma: PrismaClient,
  opts: { adminUserId: string },
) {
  const rawWarehouses = await prisma.warehouse.findMany({
    where: { type: 'RAW_MATERIALS', isActive: true },
    orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
  });
  const rawWh = rawWarehouses.find((w) => w.code === 'RAW') ?? rawWarehouses[0];
  if (!rawWh) {
    console.log('  Piece 6 skipped — no RAW_MATERIALS warehouse.');
    return;
  }
  const multiRaw = rawWarehouses.length > 1;
  if (!multiRaw) {
    console.log(
      '  Piece 6 note: only one RAW_MATERIALS warehouse (RAW) — P6-I uses single warehouse.',
    );
  }

  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { archivedAt: null, isActive: true, itemClass: InventoryItemClass.RAW_MATERIAL },
    orderBy: { sku: 'asc' },
  });
  const bySku = new Map(inventoryItems.map((i) => [i.sku, i]));
  const wood = bySku.get('MAT-BEECH') ?? inventoryItems.find((i) => i.category === InventoryCategory.WOOD);
  const foam = bySku.get('MAT-FOAM-HD') ?? inventoryItems.find((i) => i.category === InventoryCategory.FOAM);
  const fabric =
    bySku.get('MAT-VEL-SAND') ?? inventoryItems.find((i) => i.category === InventoryCategory.FABRIC);
  const lacq = bySku.get('MAT-LACQ') ?? inventoryItems.find((i) => i.category === InventoryCategory.PAINT);
  const primer = bySku.get('MAT-PRIMER') ?? lacq;
  // Zero opening stock in catalog — good shortage vehicle.
  const shortItem = bySku.get('MAT-ITAL-VEL') ?? fabric;
  const hw = bySku.get('MAT-HW-KIT') ?? inventoryItems[0];

  if (!wood || !foam || !fabric || !lacq || !shortItem || !hw || !primer) {
    console.log('  Piece 6 skipped — missing RAW materials.');
    return;
  }

  const supplierCodes = ['SUP-TIMBER', 'SUP-FOAM', 'SUP-FABRIC', 'SUP-FINISH', 'SUP-HW'] as const;
  for (const code of supplierCodes) {
    await prisma.supplier.updateMany({
      where: { code },
      data: { isCertified: true },
    });
  }
  const suppliers = await prisma.supplier.findMany({
    where: { code: { in: [...supplierCodes] } },
  });
  const supplierByCode = new Map(suppliers.map((s) => [s.code, s]));
  const timber = supplierByCode.get('SUP-TIMBER') ?? suppliers[0];
  const foamSup = supplierByCode.get('SUP-FOAM') ?? timber;
  const fabricSup = supplierByCode.get('SUP-FABRIC') ?? timber;
  const finishSup = supplierByCode.get('SUP-FINISH') ?? timber;
  const hwSup = supplierByCode.get('SUP-HW') ?? timber;
  if (!timber) {
    console.log('  Piece 6 skipped — no suppliers.');
    return;
  }

  async function wipePurchaseOrder(number: string) {
    const existing = await prisma.purchaseOrder.findUnique({
      where: { number },
      include: { goodsReceipts: { select: { id: true } } },
    });
    if (!existing) return;
    const grnIds = existing.goodsReceipts.map((g) => g.id);
    if (grnIds.length) {
      const txs = await prisma.inventoryTransaction.findMany({
        where: { referenceType: 'GoodsReceipt', referenceId: { in: grnIds } },
      });
      for (const tx of txs) {
        const qty = Number(tx.quantity);
        const bal = await prisma.inventoryBalance.findFirst({
          where: {
            inventoryItemId: tx.inventoryItemId,
            warehouseId: tx.warehouseId,
            locationId: null,
          },
        });
        if (bal) {
          await prisma.inventoryBalance.update({
            where: { id: bal.id },
            data: { availableQty: money(Math.max(0, Number(bal.availableQty) - qty)) },
          });
        }
      }
      await prisma.inventoryTransaction.deleteMany({
        where: { referenceType: 'GoodsReceipt', referenceId: { in: grnIds } },
      });
      await prisma.goodsReceiptLine.deleteMany({ where: { goodsReceiptId: { in: grnIds } } });
      await prisma.goodsReceipt.deleteMany({ where: { id: { in: grnIds } } });
    }
    await prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: existing.id } });
    await prisma.purchaseOrder.delete({ where: { id: existing.id } });
  }

  async function wipeDemandPo(number: string) {
    const po = await prisma.productionOrder.findUnique({
      where: { number },
      include: { workflowSnapshot: { include: { nodes: { select: { id: true } } } } },
    });
    if (!po) return;
    const nodeIds = po.workflowSnapshot?.nodes.map((n) => n.id) ?? [];
    if (nodeIds.length) {
      await prisma.productionOrderWorkflowSnapshotMaterialInput.deleteMany({
        where: { snapshotNodeId: { in: nodeIds } },
      });
    }
    if (po.workflowSnapshot) {
      await prisma.productionOrderWorkflowSnapshotNode.deleteMany({
        where: { snapshotId: po.workflowSnapshot.id },
      });
      await prisma.productionOrderWorkflowSnapshot.delete({ where: { id: po.workflowSnapshot.id } });
    }
    await prisma.productionOrder.delete({ where: { id: po.id } });
  }

  async function upsertPo(args: {
    number: string;
    supplierId: string;
    warehouseId: string;
    status: PurchaseOrderStatus;
    orderDate: Date;
    expectedDeliveryDate: Date | null;
    notes: string;
    lines: LineSpec[];
  }) {
    await wipePurchaseOrder(args.number);
    const subtotal = args.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const taxAmount = subtotal * VAT;
    return prisma.purchaseOrder.create({
      data: {
        number: args.number,
        supplierId: args.supplierId,
        warehouseId: args.warehouseId,
        orderDate: args.orderDate,
        expectedDeliveryDate: args.expectedDeliveryDate,
        currency: 'ILS',
        status: args.status,
        paymentTermsDays: 30,
        subtotal: money(subtotal),
        taxAmount: money(taxAmount),
        total: money(subtotal + taxAmount),
        notes: args.notes,
        createdAt: args.orderDate,
        lines: {
          create: args.lines.map((l) => ({
            inventoryItemId: l.item.id,
            description: l.item.nameEn,
            quantity: money(l.qty),
            unit: l.item.unit || 'pcs',
            unitPrice: money(l.unitPrice),
            taxRate: VAT,
            lineTotal: money(l.qty * l.unitPrice * (1 + VAT)),
          })),
        },
      },
      include: { lines: true },
    });
  }

  async function postGrn(args: {
    number: string;
    purchaseOrderId: string;
    warehouseId: string;
    receiptDate: Date;
    deliveryDocRef?: string;
    notes?: string;
    idempotencyKey?: string;
    lines: GrnLineSpec[];
  }) {
    const grn = await prisma.goodsReceipt.create({
      data: {
        number: args.number,
        purchaseOrderId: args.purchaseOrderId,
        warehouseId: args.warehouseId,
        receiptDate: args.receiptDate,
        deliveryDocRef: args.deliveryDocRef,
        notes: args.notes,
        createdById: opts.adminUserId,
        createdAt: args.receiptDate,
        ...(args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : {}),
        lines: {
          create: args.lines.map((l) => {
            const rejected = l.rejectedQty ?? 0;
            const accepted = Math.max(0, l.receivedQty - rejected);
            return {
              inventoryItemId: l.inventoryItemId,
              orderedQty: money(l.orderedQty),
              receivedQty: money(l.receivedQty),
              rejectedQty: money(rejected),
              unitCost: money(l.unitCost),
              extendedCost: money(l.unitCost * accepted),
              qualityStatus: 'OK',
            };
          }),
        },
      },
    });

    for (const l of args.lines) {
      const rejected = l.rejectedQty ?? 0;
      const accepted = Math.max(0, l.receivedQty - rejected);
      if (accepted <= 0) continue;
      const txNumber = `ITX-${args.number}-${l.inventoryItemId.slice(0, 8)}`;
      await prisma.inventoryTransaction.create({
        data: {
          number: txNumber,
          type: InventoryTxType.PURCHASE_RECEIPT,
          inventoryItemId: l.inventoryItemId,
          warehouseId: args.warehouseId,
          quantity: money(accepted),
          unitCost: money(l.unitCost),
          referenceType: 'GoodsReceipt',
          referenceId: grn.id,
          notes: `GRN ${args.number}`,
          createdById: opts.adminUserId,
          createdAt: args.receiptDate,
          idempotencyKey: `p6-seed:${args.number}:${l.inventoryItemId}`,
        },
      });
      const existing = await prisma.inventoryBalance.findFirst({
        where: {
          inventoryItemId: l.inventoryItemId,
          warehouseId: args.warehouseId,
          locationId: null,
        },
      });
      if (existing) {
        await prisma.inventoryBalance.update({
          where: { id: existing.id },
          data: { availableQty: money(Number(existing.availableQty) + accepted) },
        });
      } else {
        await prisma.inventoryBalance.create({
          data: {
            inventoryItemId: l.inventoryItemId,
            warehouseId: args.warehouseId,
            availableQty: money(accepted),
            reservedQty: money(0),
            onOrderQty: money(0),
          },
        });
      }
    }
    return grn;
  }

  async function ensureDemandPo(args: {
    number: string;
    sku: string;
    inventoryItemId: string;
    qtyPerUnit: number;
    unit: string;
  }) {
    await wipeDemandPo(args.number);
    const po = await prisma.productionOrder.create({
      data: {
        number: args.number,
        productDescription: `Piece6 demand ${args.number}`,
        quantity: money(1),
        status: 'WAITING_FOR_MATERIALS',
        progressPercent: 0,
        notes: 'Piece 6 material-demand fixture',
        createdById: opts.adminUserId,
      },
    });
    const snap = await prisma.productionOrderWorkflowSnapshot.create({
      data: {
        productionOrderId: po.id,
        isLegacyBackfill: true,
      },
    });
    const node = await prisma.productionOrderWorkflowSnapshotNode.create({
      data: {
        snapshotId: snap.id,
        nodeKey: 'p6-prep',
        stageCode: 'MATERIAL_PREP',
        nameEnSnapshot: 'Material Prep',
        nameArSnapshot: 'تحضير المواد',
        consumesRawMaterials: true,
        executionKind: 'PRODUCTION',
      },
    });
    await prisma.productionOrderWorkflowSnapshotMaterialInput.create({
      data: {
        snapshotNodeId: node.id,
        stageCode: 'MATERIAL_PREP',
        inventoryItemId: args.inventoryItemId,
        sku: args.sku,
        qtyPerUnit: money(args.qtyPerUnit),
        unit: args.unit,
        required: true,
      },
    });
    return po;
  }

  const orderDay = ammanLocal(2026, 8, 10, 10, 0);
  const futureEta = ammanLocal(2026, 8, 28, 10, 0);
  const pastEta = ammanLocal(2026, 8, 1, 10, 0);
  const receiptDay = ammanLocal(2026, 8, 14, 11, 0);

  const woodPrice = Math.max(Number(wood.standardCost) || 0, 11.5);
  const foamPrice = Math.max(Number(foam.standardCost) || 0, 92);
  const fabricPrice = Math.max(Number(fabric.standardCost) || 0, 12);
  const lacqPrice = Math.max(Number(lacq.standardCost) || 0, 7.8);
  const primerPrice = Math.max(Number(primer.standardCost) || 0, 6.4);
  const shortPrice = Math.max(Number(shortItem.standardCost) || 0, 24);
  const hwPrice = Math.max(Number(hw.standardCost) || 0, 8);

  // ─── P6-A DRAFT multi-material ───────────────────────────────────────────
  await upsertPo({
    number: 'PO-P6-A',
    supplierId: timber!.id,
    warehouseId: rawWh.id,
    status: PurchaseOrderStatus.DRAFT,
    orderDate: orderDay,
    expectedDeliveryDate: futureEta,
    notes: 'Piece6 DRAFT multi-material',
    lines: [
      { item: wood, qty: 40, unitPrice: woodPrice },
      { item: foam, qty: 8, unitPrice: foamPrice },
      { item: fabric, qty: 20, unitPrice: fabricPrice },
    ],
  });

  // ─── P6-B ORDERED (SENT) — no GRN / no stock from send alone ─────────────
  await upsertPo({
    number: 'PO-P6-B',
    supplierId: finishSup!.id,
    warehouseId: rawWh.id,
    status: PurchaseOrderStatus.SENT,
    orderDate: orderDay,
    expectedDeliveryDate: futureEta,
    notes: 'Piece6 ORDERED — create/send must not change stock',
    lines: [{ item: lacq, qty: 30, unitPrice: lacqPrice }],
  });

  // ─── P6-C PARTIAL 100 → 60 ───────────────────────────────────────────────
  {
    const po = await upsertPo({
      number: 'PO-P6-C',
      supplierId: timber!.id,
      warehouseId: rawWh.id,
      status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
      orderDate: orderDay,
      expectedDeliveryDate: futureEta,
      notes: 'Piece6 PARTIAL 100 ordered / 60 received',
      lines: [{ item: wood, qty: 100, unitPrice: woodPrice }],
    });
    await postGrn({
      number: 'GRN-P6-C-1',
      purchaseOrderId: po.id,
      warehouseId: rawWh.id,
      receiptDate: receiptDay,
      deliveryDocRef: 'DN-P6-C',
      lines: [
        {
          inventoryItemId: wood.id,
          orderedQty: 100,
          receivedQty: 60,
          unitCost: woodPrice,
        },
      ],
    });
  }

  // ─── P6-D Multi GRN accumulate (40 + 35 of 100) ──────────────────────────
  {
    const po = await upsertPo({
      number: 'PO-P6-D',
      supplierId: foamSup!.id,
      warehouseId: rawWh.id,
      status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
      orderDate: orderDay,
      expectedDeliveryDate: futureEta,
      notes: 'Piece6 multi-GRN accumulate',
      lines: [{ item: foam, qty: 100, unitPrice: foamPrice }],
    });
    await postGrn({
      number: 'GRN-P6-D-1',
      purchaseOrderId: po.id,
      warehouseId: rawWh.id,
      receiptDate: receiptDay,
      lines: [
        { inventoryItemId: foam.id, orderedQty: 100, receivedQty: 40, unitCost: foamPrice },
      ],
    });
    await postGrn({
      number: 'GRN-P6-D-2',
      purchaseOrderId: po.id,
      warehouseId: rawWh.id,
      receiptDate: ammanLocal(2026, 8, 15, 11, 0),
      lines: [
        { inventoryItemId: foam.id, orderedQty: 100, receivedQty: 35, unitCost: foamPrice },
      ],
    });
  }

  // ─── P6-E Price variance (GRN unitCost ≠ PO unitPrice) ───────────────────
  {
    const poPrice = 10;
    const grnCost = 12.5;
    const po = await upsertPo({
      number: 'PO-P6-E',
      supplierId: fabricSup!.id,
      warehouseId: rawWh.id,
      status: PurchaseOrderStatus.RECEIVED,
      orderDate: orderDay,
      expectedDeliveryDate: futureEta,
      notes: 'Piece6 price variance expected≠actual',
      lines: [{ item: fabric, qty: 80, unitPrice: poPrice }],
    });
    await postGrn({
      number: 'GRN-P6-E-1',
      purchaseOrderId: po.id,
      warehouseId: rawWh.id,
      receiptDate: receiptDay,
      lines: [
        {
          inventoryItemId: fabric.id,
          orderedQty: 80,
          receivedQty: 80,
          unitCost: grnCost,
        },
      ],
    });
  }

  // ─── P6-F Shortage: open PO incoming + production stillNeeded ────────────
  {
    await upsertPo({
      number: 'PO-P6-F',
      supplierId: fabricSup!.id,
      warehouseId: rawWh.id,
      status: PurchaseOrderStatus.SENT,
      orderDate: orderDay,
      expectedDeliveryDate: futureEta,
      notes: 'Piece6 shortage open PO (incoming)',
      lines: [{ item: shortItem, qty: 40, unitPrice: shortPrice }],
    });
    // Need far above free (≈0 for MAT-ITAL-VEL) + incoming (40 + any other open).
    await ensureDemandPo({
      number: 'PO-PROD-P6-F',
      sku: shortItem.sku,
      inventoryItemId: shortItem.id,
      qtyPerUnit: 500,
      unit: shortItem.unit || 'm',
    });
  }

  // ─── P6-G Fully RECEIVED ─────────────────────────────────────────────────
  {
    const po = await upsertPo({
      number: 'PO-P6-G',
      supplierId: hwSup!.id,
      warehouseId: rawWh.id,
      status: PurchaseOrderStatus.RECEIVED,
      orderDate: orderDay,
      expectedDeliveryDate: futureEta,
      notes: 'Piece6 fully RECEIVED',
      lines: [{ item: hw, qty: 50, unitPrice: hwPrice }],
    });
    await postGrn({
      number: 'GRN-P6-G-1',
      purchaseOrderId: po.id,
      warehouseId: rawWh.id,
      receiptDate: receiptDay,
      lines: [
        { inventoryItemId: hw.id, orderedQty: 50, receivedQty: 50, unitCost: hwPrice },
      ],
    });
  }

  // ─── P6-H Receipt stocks material for open production need ───────────────
  {
    const po = await upsertPo({
      number: 'PO-P6-H',
      supplierId: finishSup!.id,
      warehouseId: rawWh.id,
      status: PurchaseOrderStatus.RECEIVED,
      orderDate: orderDay,
      expectedDeliveryDate: futureEta,
      notes: 'Piece6 GRN adds stock for production readiness',
      lines: [{ item: primer, qty: 25, unitPrice: primerPrice }],
    });
    await postGrn({
      number: 'GRN-P6-H-1',
      purchaseOrderId: po.id,
      warehouseId: rawWh.id,
      receiptDate: receiptDay,
      lines: [
        {
          inventoryItemId: primer.id,
          orderedQty: 25,
          receivedQty: 25,
          unitCost: primerPrice,
        },
      ],
    });
    await ensureDemandPo({
      number: 'PO-PROD-P6-H',
      sku: primer.sku,
      inventoryItemId: primer.id,
      qtyPerUnit: 10,
      unit: primer.unit || 'L',
    });
  }

  // ─── P6-I multi RAW warehouse (or single RAW note) ───────────────────────
  {
    const wh = multiRaw ? rawWarehouses[1]! : rawWh;
    const po = await upsertPo({
      number: 'PO-P6-I',
      supplierId: timber!.id,
      warehouseId: wh.id,
      status: PurchaseOrderStatus.RECEIVED,
      orderDate: orderDay,
      expectedDeliveryDate: futureEta,
      notes: multiRaw
        ? `Piece6 multi RAW warehouse receipt → ${wh.code}`
        : 'Piece6 single RAW warehouse (domain has one RAW_MATERIALS)',
      lines: [{ item: wood, qty: 15, unitPrice: woodPrice }],
    });
    await postGrn({
      number: 'GRN-P6-I-1',
      purchaseOrderId: po.id,
      warehouseId: wh.id,
      receiptDate: receiptDay,
      lines: [
        { inventoryItemId: wood.id, orderedQty: 15, receivedQty: 15, unitCost: woodPrice },
      ],
    });
  }

  // ─── P6-J overdue attention (ETA past + remaining) ───────────────────────
  {
    const po = await upsertPo({
      number: 'PO-P6-J',
      supplierId: timber!.id,
      warehouseId: rawWh.id,
      status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
      orderDate: ammanLocal(2026, 7, 20, 10, 0),
      expectedDeliveryDate: pastEta,
      notes: 'Piece6 overdue PARTIAL — attention OVERDUE_ETA',
      lines: [{ item: wood, qty: 80, unitPrice: woodPrice }],
    });
    await postGrn({
      number: 'GRN-P6-J-1',
      purchaseOrderId: po.id,
      warehouseId: rawWh.id,
      receiptDate: ammanLocal(2026, 7, 28, 11, 0),
      lines: [
        { inventoryItemId: wood.id, orderedQty: 80, receivedQty: 30, unitCost: woodPrice },
      ],
    });
  }

  console.log('  Piece 6 purchasing/receiving examples PO-P6-A…J seeded.');
}
