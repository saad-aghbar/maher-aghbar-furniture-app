/**
 * Piece 5 deterministic manufacturing-cost examples (P5-A–I).
 * Seeds SO/PO/task/usage with stored unitCost/extendedCost for live UAT.
 * Preserves Piece 1–4 rows.
 */
import {
  InventoryCategory,
  InventoryItemClass,
  ManufacturingComplexity,
  PrismaClient,
  QuotationStatus,
  SalesOrderLineSetupStatus,
  SalesOrderMaterialRequirementSource,
  SalesOrderProductionSetupStatus,
  SalesOrderStatus,
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';

type DealerRef = { id: string; code: string; name?: string; nameEn?: string; username?: string };
type ProductRef = {
  id: string;
  sku: string;
  nameEn: string;
  basePrice: unknown;
  width?: unknown;
  height?: unknown;
  depth?: unknown;
};

type UsageSeed = {
  sku: string;
  inventoryItemId: string;
  expectedQty: number;
  actualQty: number;
  returnedQty?: number;
  scrapQty?: number;
  unitCost: number | null;
  isRework?: boolean;
};

export async function seedPiece5ManufacturingCostExamples(
  prisma: PrismaClient,
  opts: {
    dealers: DealerRef[];
    products: ProductRef[];
    adminUserId: string;
  },
) {
  const oasis =
    opts.dealers.find((d) => d.username === 'oasis' || /oasis/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[1] ??
    opts.dealers[0];
  const product = opts.products[0];
  if (!oasis || !product) return;

  const catalogW = product.width != null ? Number(product.width) : 180;
  const catalogH = product.height != null ? Number(product.height) : 90;
  const catalogD = product.depth != null ? Number(product.depth) : 85;
  const unitPriceNum = Number(product.basePrice) || 2500;
  const unitPrice = money(unitPriceNum);
  const sentAt = new Date();
  const acceptedAt = new Date();
  const valuedAt = new Date('2026-06-01T10:00:00Z');

  const workflowConfig = await prisma.productWorkflowConfiguration.findUnique({
    where: { productId: product.id },
    select: { workflowId: true },
  });
  const workflowId = workflowConfig?.workflowId ?? null;

  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
    take: 30,
    orderBy: { sku: 'asc' },
  });
  const fabricItem =
    inventoryItems.find((i) => i.category === 'FABRIC' && Number(i.standardCost) > 0) ??
    inventoryItems.find((i) => Number(i.standardCost) > 0) ??
    inventoryItems[0];
  const woodItem =
    inventoryItems.find((i) => i.category === 'WOOD' && Number(i.standardCost) > 0) ??
    inventoryItems.find((i) => i.id !== fabricItem?.id && Number(i.standardCost) > 0) ??
    inventoryItems[1] ??
    fabricItem;

  if (!fabricItem || !woodItem) return;

  // Ensure fabric/wood have known standard costs for deterministic estimates.
  const fabricUnit = Math.max(Number(fabricItem.standardCost) || 0, 5);
  const woodUnit = Math.max(Number(woodItem.standardCost) || 0, 8);
  await prisma.inventoryItem.update({
    where: { id: fabricItem.id },
    data: { standardCost: money(fabricUnit) },
  });
  await prisma.inventoryItem.update({
    where: { id: woodItem.id },
    data: { standardCost: money(woodUnit) },
  });

  let zeroCostItem = await prisma.inventoryItem.findUnique({ where: { sku: 'P5-ZERO-COST' } });
  if (!zeroCostItem) {
    zeroCostItem = await prisma.inventoryItem.create({
      data: {
        sku: 'P5-ZERO-COST',
        nameEn: 'Piece5 uncosted trim',
        nameAr: 'تقليم بدون تكلفة P5',
        category: InventoryCategory.OTHER,
        itemClass: InventoryItemClass.RAW_MATERIAL,
        unit: 'pcs',
        standardCost: money(0),
        isPurchasable: true,
        isActive: true,
      },
    });
  } else {
    await prisma.inventoryItem.update({
      where: { id: zeroCostItem.id },
      data: { standardCost: money(0), archivedAt: null, isActive: true },
    });
  }

  async function upsertScenario(args: {
    letter: string;
    title: string;
    poStatus: string;
    planned: Array<{
      inventoryItemId: string;
      sku: string;
      displayName: string;
      category: InventoryCategory;
      expectedQty: number;
      unit: string;
    }>;
    usages: UsageSeed[];
    multiLine?: boolean;
  }) {
    const soNumber = `SO-P5-${args.letter}`;
    const qtNumber = `QT-P5-${args.letter}`;
    const poNumber = `PO-P5-${args.letter}`;
    const totals = lineTotals(1, unitPriceNum, VAT);

    const quote = await prisma.quotation.upsert({
      where: { number_version: { number: qtNumber, version: 1 } },
      update: { status: QuotationStatus.ACCEPTED, sentAt, acceptedAt },
      create: {
        number: qtNumber,
        version: 1,
        customerId: oasis!.id,
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
              productId: product!.id,
              description: product!.nameEn,
              quantity: 1,
              unitPrice,
              taxRate: VAT,
              subtotal: totals.subtotalM,
              taxAmount: totals.taxAmountM,
              lineTotal: totals.lineTotalM,
              manufacturingComplexity: ManufacturingComplexity.STANDARD,
              sortOrder: 0,
            },
          ],
        },
      },
    });

    let so = await prisma.salesOrder.findUnique({
      where: { number: soNumber },
      include: { lines: true, productionOrders: true },
    });

    if (!so) {
      so = await prisma.salesOrder.create({
        data: {
          number: soNumber,
          customerId: oasis!.id,
          quotationId: quote.id,
          status: SalesOrderStatus.IN_PRODUCTION,
          externalOrderNumber: `P5-${args.letter}`,
          projectName: args.title,
          subtotal: totals.subtotalM,
          taxTotal: totals.taxAmountM,
          total: totals.lineTotalM,
          createdById: opts.adminUserId,
          lines: {
            create: [
              {
                productId: product!.id,
                description: `${product!.nameEn} — P5-${args.letter}`,
                quantity: 1,
                unitPrice,
                taxRate: VAT,
                lineTotal: totals.lineTotalM,
                manufacturingComplexity: ManufacturingComplexity.STANDARD,
                productionRequired: true,
                orderSpec: {
                  productId: product!.id,
                  productName: product!.nameEn,
                  quantity: 1,
                  manufacturingComplexity: 'STANDARD',
                  catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
                  requestedDimensions: { width: catalogW, height: catalogH, depth: catalogD },
                },
                sortOrder: 0,
              },
              ...(args.multiLine
                ? [
                    {
                      productId: product!.id,
                      description: `${product!.nameEn} — P5-${args.letter} line2`,
                      quantity: 1,
                      unitPrice,
                      taxRate: VAT,
                      lineTotal: totals.lineTotalM,
                      manufacturingComplexity: ManufacturingComplexity.STANDARD,
                      productionRequired: true,
                      orderSpec: {
                        productId: product!.id,
                        productName: product!.nameEn,
                        quantity: 1,
                        manufacturingComplexity: 'STANDARD',
                      },
                      sortOrder: 1,
                    },
                  ]
                : []),
            ],
          },
        },
        include: { lines: true, productionOrders: true },
      });
    } else {
      await prisma.salesOrder.update({
        where: { id: so.id },
        data: {
          status: SalesOrderStatus.IN_PRODUCTION,
          projectName: args.title,
          archivedAt: null,
        },
      });
      so = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: so.id },
        include: { lines: true, productionOrders: true },
      });
    }

    const line = so.lines.sort((a, b) => a.sortOrder - b.sortOrder)[0]!;
    const line2 = args.multiLine ? so.lines.sort((a, b) => a.sortOrder - b.sortOrder)[1] : null;

    const existingSetup = await prisma.salesOrderProductionSetup.findUnique({
      where: { salesOrderId: so.id },
    });
    if (existingSetup) {
      await prisma.salesOrderLineMaterialRequirement.deleteMany({
        where: { lineSetup: { productionSetupId: existingSetup.id } },
      });
      await prisma.salesOrderLineSetup.deleteMany({
        where: { productionSetupId: existingSetup.id },
      });
      await prisma.salesOrderProductionSetup.delete({ where: { id: existingSetup.id } });
    }

    await prisma.salesOrderProductionSetup.create({
      data: {
        salesOrderId: so.id,
        status: SalesOrderProductionSetupStatus.RELEASED,
        releasedAt: valuedAt,
        releasedById: opts.adminUserId,
        lines: {
          create: [
            {
              salesOrderLineId: line.id,
              status: SalesOrderLineSetupStatus.READY,
              manufacturingName: `${product!.nameEn} P5-${args.letter}`,
              manufacturingComplexity: ManufacturingComplexity.STANDARD,
              catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
              orderDimensions: { width: catalogW, height: catalogH, depth: catalogD },
              workflowId,
              factoryNotes: `Piece5 ${args.letter}`,
              materialRequirements: {
                create: args.planned.map((m, i) => ({
                  inventoryItemId: m.inventoryItemId,
                  sku: m.sku,
                  displayName: m.displayName,
                  category: m.category,
                  unit: m.unit,
                  expectedQty: m.expectedQty,
                  source: SalesOrderMaterialRequirementSource.CATALOG_BOM,
                  needsReview: false,
                  sortOrder: i,
                })),
              },
            },
            ...(line2
              ? [
                  {
                    salesOrderLineId: line2.id,
                    status: SalesOrderLineSetupStatus.READY,
                    manufacturingName: `${product!.nameEn} P5-${args.letter} L2`,
                    manufacturingComplexity: ManufacturingComplexity.STANDARD,
                    catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
                    orderDimensions: { width: catalogW, height: catalogH, depth: catalogD },
                    workflowId,
                    factoryNotes: `Piece5 ${args.letter} line2`,
                    materialRequirements: {
                      create: args.planned.map((m, i) => ({
                        inventoryItemId: m.inventoryItemId,
                        sku: m.sku,
                        displayName: m.displayName,
                        category: m.category,
                        unit: m.unit,
                        expectedQty: m.expectedQty,
                        source: SalesOrderMaterialRequirementSource.CATALOG_BOM,
                        needsReview: false,
                        sortOrder: i,
                      })),
                    },
                  },
                ]
              : []),
          ],
        },
      },
    });

    // Wipe prior tasks/usages for idempotent reseed; reuse PO numbers when present.
    const priorPos = await prisma.productionOrder.findMany({
      where: { OR: [{ salesOrderId: so.id }, { number: { startsWith: `PO-P5-${args.letter}` } }] },
      select: { id: true },
    });
    for (const p of priorPos) {
      await prisma.productionTaskMaterialUsage.deleteMany({ where: { productionOrderId: p.id } });
      await prisma.productionTask.deleteMany({ where: { productionOrderId: p.id } });
    }
    await prisma.productionOrder.deleteMany({
      where: { OR: [{ salesOrderId: so.id }, { number: { startsWith: `PO-P5-${args.letter}` } }] },
    });

    async function createPoWithUsage(optsPo: {
      number: string;
      salesOrderLineId: string;
      status: string;
      usages: UsageSeed[];
    }) {
      const po = await prisma.productionOrder.create({
        data: {
          number: optsPo.number,
          salesOrderId: so!.id,
          salesOrderLineId: optsPo.salesOrderLineId,
          customerId: oasis!.id,
          productId: product!.id,
          productDescription: product!.nameEn,
          quantity: 1,
          status: optsPo.status as never,
          progressPercent: optsPo.status === 'COMPLETED' || optsPo.status === 'READY_FOR_DELIVERY' ? 100 : 40,
        },
      });

      const mainTask = await prisma.productionTask.create({
        data: {
          number: `TSK-P5-${args.letter}-${optsPo.number.replace(/[^A-Z0-9]/gi, '').slice(-6)}`,
          productionOrderId: po.id,
          name: `Cut — P5-${args.letter}`,
          status: 'COMPLETED',
          progressPercent: 100,
          isRework: false,
        },
      });

      let reworkTaskId: string | null = null;
      for (const u of optsPo.usages) {
        let taskId = mainTask.id;
        if (u.isRework) {
          if (!reworkTaskId) {
            const rw = await prisma.productionTask.create({
              data: {
                number: `TSK-P5-${args.letter}-RW-${optsPo.number.replace(/[^A-Z0-9]/gi, '').slice(-4)}`,
                productionOrderId: po.id,
                name: `Rework cut — P5-${args.letter}`,
                status: 'COMPLETED',
                progressPercent: 100,
                isRework: true,
              },
            });
            reworkTaskId = rw.id;
          }
          taskId = reworkTaskId;
        }
        const actual = u.actualQty;
        const returned = u.returnedQty ?? 0;
        const scrap = u.scrapQty ?? 0;
        const costedQty = actual + scrap - returned;
        const unitCost = u.unitCost;
        const extendedCost =
          unitCost != null && unitCost > 0 && costedQty > 0
            ? money(unitCost * costedQty)
            : null;
        await prisma.productionTaskMaterialUsage.create({
          data: {
            taskId,
            productionOrderId: po.id,
            inventoryItemId: u.inventoryItemId,
            sku: u.sku,
            expectedQty: u.expectedQty,
            actualQty: actual,
            returnedQty: returned,
            scrapQty: scrap,
            varianceQty: costedQty - u.expectedQty,
            finalizedAt: valuedAt,
            finalizeIdempotencyKey: `p5-seed:${optsPo.number}:${u.sku}:${u.isRework ? 'rw' : 'main'}`,
            unitCost: unitCost != null && unitCost > 0 ? money(unitCost) : null,
            extendedCost,
            valuedAt: unitCost != null && unitCost > 0 ? valuedAt : null,
            recordedById: opts.adminUserId,
          },
        });
      }
      return po;
    }

    await createPoWithUsage({
      number: poNumber,
      salesOrderLineId: line.id,
      status: args.poStatus,
      usages: args.usages,
    });

    if (line2) {
      await createPoWithUsage({
        number: `${poNumber}-B`,
        salesOrderLineId: line2.id,
        status: args.poStatus,
        usages: args.usages,
      });
    }

    return soNumber;
  }

  const fabricPlan = {
    inventoryItemId: fabricItem.id,
    sku: fabricItem.sku,
    displayName: fabricItem.nameEn,
    category: InventoryCategory.FABRIC,
    expectedQty: 10,
    unit: fabricItem.unit || 'm',
  };
  const woodPlan = {
    inventoryItemId: woodItem.id,
    sku: woodItem.sku,
    displayName: woodItem.nameEn,
    category: InventoryCategory.WOOD,
    expectedQty: 8,
    unit: woodItem.unit || 'pcs',
  };
  const zeroPlan = {
    inventoryItemId: zeroCostItem.id,
    sku: zeroCostItem.sku,
    displayName: zeroCostItem.nameEn,
    category: InventoryCategory.OTHER,
    expectedQty: 2,
    unit: 'pcs',
  };

  // P5-A — on budget
  await upsertScenario({
    letter: 'A',
    title: 'Piece5 On Budget',
    poStatus: 'COMPLETED',
    planned: [fabricPlan, woodPlan],
    usages: [
      {
        sku: fabricItem.sku,
        inventoryItemId: fabricItem.id,
        expectedQty: 10,
        actualQty: 10,
        unitCost: fabricUnit,
      },
      {
        sku: woodItem.sku,
        inventoryItemId: woodItem.id,
        expectedQty: 8,
        actualQty: 8,
        unitCost: woodUnit,
      },
    ],
  });

  // P5-B — fabric overrun
  await upsertScenario({
    letter: 'B',
    title: 'Piece5 Fabric Overrun',
    poStatus: 'COMPLETED',
    planned: [fabricPlan, woodPlan],
    usages: [
      {
        sku: fabricItem.sku,
        inventoryItemId: fabricItem.id,
        expectedQty: 10,
        actualQty: 14,
        unitCost: fabricUnit,
      },
      {
        sku: woodItem.sku,
        inventoryItemId: woodItem.id,
        expectedQty: 8,
        actualQty: 8,
        unitCost: woodUnit,
      },
    ],
  });

  // P5-C — return nets
  await upsertScenario({
    letter: 'C',
    title: 'Piece5 Return Nets',
    poStatus: 'COMPLETED',
    planned: [fabricPlan],
    usages: [
      {
        sku: fabricItem.sku,
        inventoryItemId: fabricItem.id,
        expectedQty: 10,
        actualQty: 10,
        returnedQty: 3,
        unitCost: fabricUnit,
      },
    ],
  });

  // P5-D — scrap charged
  await upsertScenario({
    letter: 'D',
    title: 'Piece5 Scrap Charged',
    poStatus: 'COMPLETED',
    planned: [fabricPlan],
    usages: [
      {
        sku: fabricItem.sku,
        inventoryItemId: fabricItem.id,
        expectedQty: 10,
        actualQty: 10,
        scrapQty: 2,
        unitCost: fabricUnit,
      },
    ],
  });

  // P5-E — rework extra
  await upsertScenario({
    letter: 'E',
    title: 'Piece5 Rework Extra',
    poStatus: 'COMPLETED',
    planned: [fabricPlan],
    usages: [
      {
        sku: fabricItem.sku,
        inventoryItemId: fabricItem.id,
        expectedQty: 10,
        actualQty: 10,
        unitCost: fabricUnit,
      },
      {
        sku: fabricItem.sku,
        inventoryItemId: fabricItem.id,
        expectedQty: 0,
        actualQty: 2,
        unitCost: fabricUnit,
        isRework: true,
      },
    ],
  });

  // P5-F — uncosted → INCOMPLETE
  await upsertScenario({
    letter: 'F',
    title: 'Piece5 Incomplete Cost',
    poStatus: 'COMPLETED',
    planned: [fabricPlan, zeroPlan],
    usages: [
      {
        sku: fabricItem.sku,
        inventoryItemId: fabricItem.id,
        expectedQty: 10,
        actualQty: 10,
        unitCost: fabricUnit,
      },
      {
        sku: zeroCostItem.sku,
        inventoryItemId: zeroCostItem.id,
        expectedQty: 2,
        actualQty: 2,
        unitCost: null,
      },
    ],
  });

  // P5-G — multi-line aggregate
  await upsertScenario({
    letter: 'G',
    title: 'Piece5 Multi-Line Aggregate',
    poStatus: 'COMPLETED',
    multiLine: true,
    planned: [fabricPlan],
    usages: [
      {
        sku: fabricItem.sku,
        inventoryItemId: fabricItem.id,
        expectedQty: 10,
        actualQty: 10,
        unitCost: fabricUnit,
      },
    ],
  });

  // P5-H — FINAL stable
  await upsertScenario({
    letter: 'H',
    title: 'Piece5 Final Stable',
    poStatus: 'READY_FOR_DELIVERY',
    planned: [fabricPlan],
    usages: [
      {
        sku: fabricItem.sku,
        inventoryItemId: fabricItem.id,
        expectedQty: 10,
        actualQty: 10,
        unitCost: fabricUnit,
      },
    ],
  });

  // P5-I — IN_PROGRESS to-date
  await upsertScenario({
    letter: 'I',
    title: 'Piece5 In Progress To Date',
    poStatus: 'IN_PROGRESS',
    planned: [fabricPlan, woodPlan],
    usages: [
      {
        sku: fabricItem.sku,
        inventoryItemId: fabricItem.id,
        expectedQty: 10,
        actualQty: 10,
        unitCost: fabricUnit,
      },
    ],
  });

  console.log('  Piece 5 manufacturing cost examples SO-P5-A…I seeded.');
}
