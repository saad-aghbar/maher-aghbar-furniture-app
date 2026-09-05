/**
 * Demo fabric procurement: SO-FB1042 three-fabric sofa spanning arrived,
 * waiting, unavailable-then-redirected, and partial — plus FABRIC-HOLD lots.
 *
 * This leaves the setup at READY_FOR_RELEASE. Production Detail and the worker
 * fabric take-in need a production order, which only the canonical release can
 * create, so `demo:reset` finishes by running `@maher/api demo:fabric-uat` —
 * that releases this order through the real service and then asserts the whole
 * fabric UAT world. Seeding a production order here instead would drift from
 * real release behaviour.
 */
import {
  FabricProcurementEventKind,
  FabricProcurementState,
  InventoryAllocationMode,
  InventoryCategory,
  InventoryLotStatus,
  ManufacturingComplexity,
  Prisma,
  PrismaClient,
  QuotationStatus,
  SalesOrderLineSetupStatus,
  SalesOrderMaterialRequirementSource,
  SalesOrderProductionSetupStatus,
  SalesOrderStatus,
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';

const SO_NUMBER = 'SO-FB1042';
const QT_NUMBER = 'QT-FB1042';

type DealerRef = { id: string; code: string; name?: string; nameEn?: string; username?: string };
type ProductRef = {
  id: string;
  sku: string;
  nameEn: string;
  basePrice: unknown;
};

const FABRICS = [
  {
    key: 'fab-main',
    type: 'Velvet 302',
    code: 'VEL-302',
    color: 'Sand',
    role: 'Main body',
    quantity: 24,
    unit: 'm',
    sku: 'MAT-VEL-SAND',
  },
  {
    key: 'fab-cushions',
    type: 'Bouclé 611',
    code: 'BOU-611',
    color: 'Cream',
    role: 'Cushions',
    quantity: 8,
    unit: 'm',
    sku: 'MAT-BOU-CRM',
  },
  {
    key: 'fab-piping',
    type: 'Linen 180',
    code: 'LIN-180',
    color: 'Natural',
    role: 'Piping',
    quantity: 12,
    unit: 'm',
    sku: 'MAT-LIN-NAT',
  },
] as const;

export async function seedDemoFabricProcurement(
  prisma: PrismaClient,
  opts: {
    dealers: DealerRef[];
    products: ProductRef[];
    adminUserId: string;
  },
) {
  const dealer =
    opts.dealers.find((d) => d.username === 'oasis' || /oasis/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[0];
  const product = opts.products[0];
  if (!dealer || !product) {
    console.log('  Fabric procurement demo skipped — missing dealer or product.');
    return;
  }

  const rawWh = await prisma.warehouse.findFirst({
    where: { code: 'RAW', isActive: true },
  });
  if (!rawWh) {
    console.log('  Fabric procurement demo skipped — no RAW warehouse.');
    return;
  }

  const hold =
    (await prisma.warehouseLocation.findUnique({
      where: { warehouseId_code: { warehouseId: rawWh.id, code: 'FABRIC-HOLD' } },
    })) ??
    (await prisma.warehouseLocation.create({
      data: { warehouseId: rawWh.id, code: 'FABRIC-HOLD', name: 'Fabric Holding A-3' },
    }));

  const bySku = new Map(
    (
      await prisma.inventoryItem.findMany({
        where: { sku: { in: FABRICS.map((f) => f.sku) } },
      })
    ).map((i) => [i.sku, i]),
  );
  if (FABRICS.some((f) => !bySku.get(f.sku))) {
    console.log('  Fabric procurement demo skipped — missing fabric SKUs.');
    return;
  }

  const mill = await prisma.supplier.findFirst({ where: { code: 'SUP-FABRIC' } });
  const altMill =
    (await prisma.supplier.findFirst({ where: { code: 'SUP-PACK' } })) ?? mill;
  if (!mill) {
    console.log('  Fabric procurement demo skipped — missing SUP-FABRIC.');
    return;
  }

  const unitPriceNum = Number(product.basePrice) || 2500;
  const totals = lineTotals(1, unitPriceNum, VAT);
  const unitPrice = money(unitPriceNum);
  const sentAt = new Date();
  const acceptedAt = new Date();
  const fabricsJson = FABRICS.map((f) => ({
    key: f.key,
    type: f.type,
    code: f.code,
    color: f.color,
    role: f.role,
    quantity: f.quantity,
    unit: f.unit,
  }));
  const orderSpec = {
    fabric: { type: FABRICS[0].type, code: FABRICS[0].code, color: FABRICS[0].color },
    fabrics: fabricsJson,
  };

  const quote = await prisma.quotation.upsert({
    where: { number_version: { number: QT_NUMBER, version: 1 } },
    update: { status: QuotationStatus.ACCEPTED, sentAt, acceptedAt },
    create: {
      number: QT_NUMBER,
      version: 1,
      customerId: dealer.id,
      status: QuotationStatus.ACCEPTED,
      sentAt,
      acceptedAt,
      acceptedById: opts.adminUserId,
      subtotal: totals.subtotalM,
      taxTotal: totals.taxAmountM,
      total: totals.lineTotalM,
      lines: {
        create: [
          {
            productId: product.id,
            description: `${product.nameEn} — three fabrics`,
            quantity: 1,
            unitPrice,
            taxRate: VAT,
            subtotal: totals.subtotalM,
            taxAmount: totals.taxAmountM,
            lineTotal: totals.lineTotalM,
            manufacturingComplexity: ManufacturingComplexity.STANDARD,
            fabric: FABRICS[0].type,
            color: FABRICS[0].color,
            fabrics: fabricsJson as Prisma.InputJsonValue,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  let so = await prisma.salesOrder.findUnique({
    where: { number: SO_NUMBER },
    include: {
      lines: true,
      productionSetup: { include: { lines: true } },
      productionOrders: { select: { id: true } },
    },
  });

  if (so?.productionOrders.length) {
    console.log(`  ${SO_NUMBER} already has production orders — leaving fabric rows in place.`);
    return;
  }

  if (so) {
    await prisma.inventoryLot.deleteMany({
      where: { qrCode: { startsWith: 'FB-SOFB1042-' } },
    });
    await prisma.fabricProcurement.deleteMany({ where: { salesOrderId: so.id } });
    await prisma.salesOrderLineMaterialRequirement.deleteMany({
      where: { lineSetup: { productionSetup: { salesOrderId: so.id } } },
    });
    await prisma.salesOrderLineSetup.deleteMany({
      where: { productionSetup: { salesOrderId: so.id } },
    });
    await prisma.salesOrderProductionSetup.deleteMany({ where: { salesOrderId: so.id } });
    await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: so.id } });
    so = await prisma.salesOrder.update({
      where: { id: so.id },
      data: {
        status: SalesOrderStatus.CONFIRMED,
        archivedAt: null,
        projectName: 'Three-fabric sofa',
        externalOrderNumber: 'FB-1042',
        quotationId: quote.id,
        lines: {
          create: {
            productId: product.id,
            description: `${product.nameEn} — three fabrics`,
            specifications: 'Velvet 302 · Bouclé 611 · Linen 180',
            quantity: 1,
            unitPrice,
            taxRate: VAT,
            lineTotal: totals.lineTotalM,
            manufacturingComplexity: ManufacturingComplexity.STANDARD,
            orderSpec: orderSpec as Prisma.InputJsonValue,
            sortOrder: 0,
          },
        },
      },
      include: {
        lines: true,
        productionSetup: { include: { lines: true } },
        productionOrders: { select: { id: true } },
      },
    });
  } else {
    so = await prisma.salesOrder.create({
      data: {
        number: SO_NUMBER,
        customerId: dealer.id,
        quotationId: quote.id,
        status: SalesOrderStatus.CONFIRMED,
        externalOrderNumber: 'FB-1042',
        projectName: 'Three-fabric sofa',
        subtotal: totals.subtotalM,
        taxTotal: totals.taxAmountM,
        total: totals.lineTotalM,
        createdById: opts.adminUserId,
        lines: {
          create: [
            {
              productId: product.id,
              description: `${product.nameEn} — three fabrics`,
              specifications: 'Velvet 302 · Bouclé 611 · Linen 180',
              quantity: 1,
              unitPrice,
              taxRate: VAT,
              lineTotal: totals.lineTotalM,
              manufacturingComplexity: ManufacturingComplexity.STANDARD,
              orderSpec: orderSpec as Prisma.InputJsonValue,
              sortOrder: 0,
            },
          ],
        },
      },
      include: {
        lines: true,
        productionSetup: { include: { lines: true } },
        productionOrders: { select: { id: true } },
      },
    });
  }

  const line = so.lines[0];
  if (!line) {
    console.log('  Fabric procurement demo skipped — missing sales order line.');
    return;
  }

  const workflowConfig = await prisma.productWorkflowConfiguration.findUnique({
    where: { productId: product.id },
    select: { workflowId: true },
  });

  const setup = await prisma.salesOrderProductionSetup.create({
    data: {
      salesOrderId: so.id,
      status: SalesOrderProductionSetupStatus.READY_FOR_RELEASE,
      lines: {
        create: {
          salesOrderLineId: line.id,
          status: SalesOrderLineSetupStatus.READY,
          manufacturingName: `${product.nameEn} — three fabrics`,
          manufacturingComplexity: ManufacturingComplexity.STANDARD,
          requestedFabricLabel: 'Velvet 302 · Sand; Bouclé 611 · Cream; Linen 180 · Natural',
          workflowId: workflowConfig?.workflowId ?? undefined,
          workflowConfirmedAt: new Date(),
          materialsReviewedAt: new Date(),
          materialRequirements: {
            create: FABRICS.map((f, index) => {
              const item = bySku.get(f.sku)!;
              return {
                inventoryItemId: item.id,
                sku: item.sku,
                displayName: item.nameEn,
                category: InventoryCategory.FABRIC,
                unit: 'm',
                expectedQty: f.quantity,
                source: SalesOrderMaterialRequirementSource.CATALOG,
                needsReview: false,
                requestedFabricLabel: `${f.type} · ${f.color}`,
                stageCode: 'UPHOLSTERY',
                fabricRole: f.role,
                fabricSelectionKey: f.key,
                sortOrder: index,
              };
            }),
          },
        },
      },
    },
    include: { lines: { include: { materialRequirements: true } } },
  });

  const reqs = setup.lines[0]?.materialRequirements ?? [];
  const byKey = new Map(reqs.map((r) => [r.fabricSelectionKey, r]));

  async function createProcurement(input: {
    key: string;
    supplierId: string;
    state: FabricProcurementState;
    orderedQty: number;
    expectedAvailableAt?: Date;
    waitingSince?: Date;
    whatsappSentAt?: Date;
    events: Array<{
      kind: FabricProcurementEventKind;
      note?: string;
      supplierId?: string;
      payload?: Record<string, unknown>;
    }>;
    lot?: { qty: number; qrSuffix: string; unitCost: number };
  }) {
    const requirement = byKey.get(input.key);
    if (!requirement) return;
    const procurement = await prisma.fabricProcurement.create({
      data: {
        requirementId: requirement.id,
        salesOrderId: so!.id,
        salesOrderLineId: line!.id,
        supplierId: input.supplierId,
        state: input.state,
        orderedQty: input.orderedQty,
        unit: 'm',
        expectedAvailableAt: input.expectedAvailableAt,
        waitingSince: input.waitingSince,
        whatsappSentAt: input.whatsappSentAt,
        whatsappLastBody: input.whatsappSentAt
          ? `Fabric request for order ${SO_NUMBER}`
          : undefined,
        whatsappLastTo: input.whatsappSentAt ? mill!.phone : undefined,
      },
    });
    for (const ev of input.events) {
      await prisma.fabricProcurementEvent.create({
        data: {
          procurementId: procurement.id,
          kind: ev.kind,
          userId: opts.adminUserId,
          supplierId: ev.supplierId ?? input.supplierId,
          note: ev.note,
          payload: ev.payload as Prisma.InputJsonValue | undefined,
        },
      });
    }
    if (input.lot) {
      await prisma.inventoryLot.create({
        data: {
          inventoryItemId: requirement.inventoryItemId!,
          warehouseId: rawWh.id,
          locationId: hold.id,
          salesOrderId: so!.id,
          salesOrderLineId: line!.id,
          quantity: money(input.lot.qty),
          remainingQty: money(input.lot.qty),
          status: InventoryLotStatus.AVAILABLE,
          allocationMode: InventoryAllocationMode.ORDER_ALLOCATED,
          sourceKey: `demo:${SO_NUMBER}:${input.key}`,
          qrCode: `FB-SOFB1042-${input.lot.qrSuffix}`,
          fabricProcurementId: procurement.id,
          supplierId: input.supplierId,
          unitCost: money(input.lot.unitCost),
        },
      });
    }
  }

  await createProcurement({
    key: 'fab-main',
    supplierId: mill.id,
    state: FabricProcurementState.READY_FOR_PICKUP,
    orderedQty: 24,
    whatsappSentAt: sentAt,
    events: [
      { kind: FabricProcurementEventKind.REQUESTED, note: 'Batched WhatsApp to Abdali' },
      { kind: FabricProcurementEventKind.READY_FOR_PICKUP, note: 'Mill confirmed ready' },
      { kind: FabricProcurementEventKind.RECEIVED, note: 'Received into Fabric Holding A-3' },
    ],
    lot: { qty: 24, qrSuffix: '001', unitCost: 12 },
  });

  await createProcurement({
    key: 'fab-cushions',
    supplierId: mill.id,
    state: FabricProcurementState.WAITING,
    orderedQty: 8,
    expectedAvailableAt: new Date('2026-10-01T00:00:00.000Z'),
    waitingSince: sentAt,
    whatsappSentAt: sentAt,
    events: [
      { kind: FabricProcurementEventKind.REQUESTED, note: 'Batched WhatsApp to Abdali' },
      { kind: FabricProcurementEventKind.SUPPLIER_CONFIRMED, note: 'Confirmed, later delayed' },
      { kind: FabricProcurementEventKind.WAIT, note: 'Mill asked to wait until October' },
    ],
  });

  await createProcurement({
    key: 'fab-piping',
    supplierId: altMill!.id,
    state: FabricProcurementState.PARTIALLY_AVAILABLE,
    orderedQty: 12,
    events: [
      {
        kind: FabricProcurementEventKind.REQUESTED,
        supplierId: mill.id,
        note: 'First mill asked for piping linen',
      },
      {
        kind: FabricProcurementEventKind.SUPPLIER_UNAVAILABLE,
        supplierId: mill.id,
        note: 'Abdali does not have LIN-180',
      },
      {
        kind: FabricProcurementEventKind.REDIRECTED,
        supplierId: altMill!.id,
        note: 'Redirected to another mill',
        payload: { fromSupplierId: mill.id, toSupplierId: altMill!.id },
      },
      { kind: FabricProcurementEventKind.PARTIAL, note: '4 m of 12 m arrived' },
    ],
    lot: { qty: 4, qrSuffix: '002', unitCost: 9 },
  });

  console.log(`  Seeded ${SO_NUMBER} fabric procurement (arrived / waiting / redirected+partial).`);
}
