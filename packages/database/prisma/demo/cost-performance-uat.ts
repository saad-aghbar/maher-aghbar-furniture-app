/**
 * Deterministic Cost & Performance demo world.
 * Numbers come from posted inventory txs, TaskTimeEntry × LaborRate, invoices, and returns.
 * Do not invent report-level totals. Nile walkthrough SO is left incomplete.
 */
import {
  DeliveryPurpose,
  DeliveryStatus,
  InventoryCategory,
  InventoryItemClass,
  InventoryTxType,
  InvoiceStatus,
  Locale,
  ManufacturingComplexity,
  PaymentMethod,
  PrismaClient,
  ProductionOrderOriginType,
  ProductionOrderStatus,
  QualityResult,
  QuotationStatus,
  ReturnLifecycleState,
  ReturnPieceDecision,
  ReturnPieceState,
  ReturnReason,
  ReturnRecoveryOutcome,
  ReturnResolution,
  SalesOrderStatus,
  TaskStatus,
} from '@prisma/client';
import { COMPANY_DOMAIN, money } from '../seed/util';
import { encryptPortalPassword } from '../seed/secret-box';
import { attachMinimalWorkflowSnapshot } from './workflow-snapshot';
import { applyDemoMovement } from './stock';
import { ammanLocal, DEMO_TZ, demoAsOf } from './clock';
import { MATERIAL_PHOTO_BY_SKU } from './material-photo-pool';
import { defaultBinIdForWarehouse } from '../seed/warehouse-bins';
import type { SeqBag } from './seq';

export const COST_UAT = {
  golden: 'SO-COST-GOLDEN',
  profit: 'SO-COST-PROFIT',
  low: 'SO-COST-LOW',
  loss: 'SO-COST-LOSS',
  partial: 'SO-COST-PARTIAL',
  norate: 'SO-COST-NORATE',
  unused: 'SO-COST-UNUSED',
  waste: 'SO-COST-WASTE',
  rework: 'SO-COST-REWORK',
  fabricOld: 'SO-COST-FAB-OLD',
  fabricNew: 'SO-COST-FAB-NEW',
  life: 'SO-COST-LIFE',
  customA: 'SO-COST-CUSTOM-A',
  customB: 'SO-COST-CUSTOM-B',
  customC: 'SO-COST-CUSTOM-C',
  varStd1: 'SO-COST-VAR-STD-1',
  varStd2: 'SO-COST-VAR-STD-2',
  varKar1: 'SO-COST-VAR-KAR-1',
  varKar2: 'SO-COST-VAR-KAR-2',
  varUkr1: 'SO-COST-VAR-UKR-1',
  varUkr2: 'SO-COST-VAR-UKR-2',
  noMat: 'SO-COST-NOMAT',
  noFab: 'SO-COST-NOFAB',
  repair: 'RT-COST-REPAIR',
  replacement: 'RT-COST-REPL',
  recovery: 'RT-COST-RECOVERY',
  incompleteReturn: 'RT-COST-INCOMPLETE',
  transfer: 'WHT-COST-1',
  gapSku: 'COST-GAP-TRIM',
  semiSku: 'SEMI-COST-FRAME',
  finSku: 'FIN-COST-SOFA',
  unpricedUser: 'cost.unpriced',
} as const;

type DealerRef = { id: string; username: string; nameEn?: string; street?: string; area?: string; city?: string };
type ProductRef = {
  id: string;
  sku: string;
  nameEn: string;
  defaultVariantId?: string;
  defaultVariantSku?: string;
  defaultVariantLabel?: string;
  factoryNotesAr?: string | null;
};
type WorkerRef = { id: string; username: string };

type MovementSpec = {
  sku: string;
  qty: number;
  unitCost: number | null;
  type?: InventoryTxType;
  isRework?: boolean;
};

type LineSpec = {
  key: string;
  sku?: string;
  variantCode?: string;
  custom?: boolean;
  customName?: string;
  qty: number;
  lineTotal: number;
  complexity: ManufacturingComplexity;
  width?: number;
  movements: MovementSpec[];
  laborMinutes: number;
  laborUser: 'priced' | 'unpriced';
  reworkMinutes?: number;
};

function ammanParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEMO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  return {
    y: Number(parts.find((p) => p.type === 'year')?.value),
    m: Number(parts.find((p) => p.type === 'month')?.value),
    d: Number(parts.find((p) => p.type === 'day')?.value),
  };
}

function midday(y: number, m: number, d: number) {
  return ammanLocal(y, m, d, 12, 0);
}

function weekdayAmman(y: number, m: number, d: number) {
  return midday(y, m, d).getUTCDay();
}

export function costPeriodAnchors(now = new Date()) {
  const asOf = demoAsOf();
  const civil = ammanParts(now);
  const today = midday(civil.y, civil.m, civil.d);
  const dow = weekdayAmman(civil.y, civil.m, civil.d);
  const sunday = new Date(today.getTime() - dow * 24 * 60 * 60 * 1000);
  const sunParts = ammanParts(sunday);
  const weekNotToday =
    dow === 0 ? today : midday(sunParts.y, sunParts.m, sunParts.d);
  const monthStart = midday(civil.y, civil.m, 1);
  const monthNotWeek = civil.d >= 8 ? midday(civil.y, civil.m, 3) : monthStart;
  const historical = midday(civil.y, civil.m === 1 ? 12 : civil.m - 1, 25);
  return { asOf, today, weekNotToday, monthNotWeek, historical, orderDate: historical };
}

function dealerAddress(d: DealerRef) {
  return [d.street, d.area, d.city].filter(Boolean).join(', ') || 'Amman, Jordan';
}

export async function seedCostPerformanceWorld(
  prisma: PrismaClient,
  opts: {
    adminId: string;
    warehouseUserId: string;
    inspectorId: string;
    driverId: string;
    dealers: DealerRef[];
    workers: WorkerRef[];
    products: ProductRef[];
    counters: SeqBag;
    passwordHash: string;
  },
) {
  const anchors = costPeriodAnchors();
  const sofa = opts.products.find((p) => p.sku === 'SOF-3S-STD') ?? opts.products[0];
  if (!sofa) {
    console.log('  Cost world skipped — no catalog product.');
    return;
  }

  const dealer = (username: string) =>
    opts.dealers.find((d) => d.username === username) ?? opts.dealers[0]!;
  const carpenter =
    opts.workers.find((w) => w.username === 'carpenter') ?? opts.workers[0]!;
  const rawWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'RAW' } });
  const semiWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'SEMI' } });
  const finWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'FIN' } });

  const itemBySku = new Map(
    (await prisma.inventoryItem.findMany({ where: { archivedAt: null } })).map((i) => [i.sku, i]),
  );
  const requireSku = (sku: string) => {
    const item = itemBySku.get(sku);
    if (!item) throw new Error(`Cost world missing inventory SKU ${sku}`);
    return item;
  };

  const unpricedId = await ensureUnpricedWorker(prisma, opts.passwordHash);

  async function variantFor(productId: string, code?: string) {
    if (code) {
      const named = await prisma.productVariant.findFirst({
        where: { productId, code, archivedAt: null },
      });
      if (named) return named;
    }
    return prisma.productVariant.findFirst({
      where: { productId, isDefault: true, archivedAt: null },
    });
  }

  async function move(args: {
    type: InventoryTxType;
    sku: string;
    qty: number;
    unitCost: number | null;
    at: Date;
    warehouseId?: string;
    outbound?: boolean;
    productionOrderId?: string;
    productionTaskId?: string;
    salesOrderId?: string;
    notes: string;
  }) {
    const item = requireSku(args.sku);
    await applyDemoMovement(prisma, {
      type: args.type,
      itemId: item.id,
      warehouseId: args.warehouseId ?? rawWh.id,
      quantity: args.qty,
      unitCost: args.unitCost,
      userId: opts.warehouseUserId,
      at: args.at,
      notes: args.notes,
      referenceType: args.productionOrderId ? 'ProductionOrder' : undefined,
      referenceId: args.productionOrderId,
      productionOrderId: args.productionOrderId,
      productionTaskId: args.productionTaskId,
      salesOrderId: args.salesOrderId,
      outbound: args.outbound,
      counters: opts.counters,
    });
  }

  async function buildOrder(input: {
    soNumber: string;
    projectName: string;
    dealerUsername: string;
    orderDate: Date;
    activityAt: Date;
    deliveredAt: Date | null;
    payment: 'paid' | 'partial' | 'unpaid';
    lines: LineSpec[];
    originType?: ProductionOrderOriginType;
    returnRequestId?: string;
  }) {
    const customer = dealer(input.dealerUsername);
    const soNumber = input.soNumber;
    const code = soNumber.replace(/^SO-/, '');
    const subtotal = input.lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const status = input.deliveredAt ? SalesOrderStatus.DELIVERED : SalesOrderStatus.IN_PRODUCTION;
    const quote = await prisma.quotation.create({
      data: {
        number: `QT-${code}`,
        version: 1,
        customerId: customer.id,
        status: QuotationStatus.ACCEPTED,
        sentAt: input.orderDate,
        acceptedAt: input.orderDate,
        acceptedById: opts.adminId,
        subtotal: money(subtotal),
        taxTotal: money(0),
        total: money(subtotal),
      },
    });

    const so = await prisma.salesOrder.create({
      data: {
        number: soNumber,
        customerId: customer.id,
        quotationId: quote.id,
        status,
        orderDate: input.orderDate,
        externalOrderNumber: code,
        projectName: input.projectName,
        subtotal: money(subtotal),
        taxTotal: money(0),
        total: money(subtotal),
        createdById: opts.adminId,
        createdAt: input.orderDate,
        notes: 'Cost desk ledger example — derived from factory records.',
      },
    });

    const createdLines: Array<{
      lineId: string;
      poId: string;
      taskId: string;
      reworkTaskId: string | null;
      spec: LineSpec;
    }> = [];

    for (const [index, spec] of input.lines.entries()) {
      const custom = spec.custom === true;
      const product = custom ? null : sofa;
      const variant = custom ? null : await variantFor(sofa.id, spec.variantCode);
      const description = custom
        ? spec.customName ?? 'Custom bench'
        : variant?.nameEn ?? sofa.nameEn;
      const line = await prisma.salesOrderLine.create({
        data: {
          salesOrderId: so.id,
          productId: custom ? null : sofa.id,
          variantId: variant?.id ?? null,
          variantSku: variant?.sku ?? null,
          variantLabel: variant?.nameEn ?? variant?.code ?? null,
          description,
          quantity: money(spec.qty),
          unitPrice: money(spec.lineTotal / spec.qty),
          taxRate: money(0),
          lineTotal: money(spec.lineTotal),
          manufacturingComplexity: spec.complexity,
          productionRequired: true,
          sortOrder: index,
          orderSpec: custom
            ? {
                productImageRef: MATERIAL_PHOTO_BY_SKU['MAT-BOU-CRM'],
                productName: description,
                quantity: spec.qty,
                manufacturingComplexity: 'CUSTOM',
              }
            : {
                productId: sofa.id,
                productName: sofa.nameEn,
                quantity: spec.qty,
                manufacturingComplexity: spec.complexity,
                requestedDimensions: spec.width
                  ? { width: spec.width, height: 90, depth: 85 }
                  : undefined,
              },
        },
      });

      const po = await prisma.productionOrder.create({
        data: {
          number: `PO-${code}-${spec.key}`,
          salesOrderId: so.id,
          salesOrderLineId: line.id,
          customerId: customer.id,
          productId: custom ? null : sofa.id,
          variantId: variant?.id ?? null,
          variantSku: variant?.sku ?? null,
          variantLabel: variant?.nameEn ?? null,
          productDescription: description,
          quantity: money(spec.qty),
          status: input.deliveredAt ? ProductionOrderStatus.COMPLETED : ProductionOrderStatus.IN_PROGRESS,
          progressPercent: input.deliveredAt ? 100 : 55,
          originType: input.originType ?? ProductionOrderOriginType.SALES_ORDER,
          returnRequestId: input.returnRequestId,
          actualStartDate: input.activityAt,
          actualCompletionDate: input.deliveredAt ?? undefined,
          createdById: opts.adminId,
        },
      });
      await attachMinimalWorkflowSnapshot(prisma, po.id, `cost-${code}-${spec.key}`.slice(0, 40));

      const laborUserId = spec.laborUser === 'unpriced' ? unpricedId : carpenter.id;
      const task = await prisma.productionTask.create({
        data: {
          number: `TSK-${code}-${spec.key}`,
          productionOrderId: po.id,
          name: `Make — ${spec.key}`,
          status: input.deliveredAt ? TaskStatus.COMPLETED : TaskStatus.IN_PROGRESS,
          progressPercent: input.deliveredAt ? 100 : 40,
          assignedEmployeeId: laborUserId,
          actualStart: input.activityAt,
          actualCompletion: input.deliveredAt ?? undefined,
          isRework: false,
        },
      });
      if (spec.laborMinutes > 0) {
        await prisma.taskTimeEntry.create({
          data: {
            taskId: task.id,
            userId: laborUserId,
            startedAt: input.activityAt,
            endedAt: new Date(input.activityAt.getTime() + spec.laborMinutes * 60_000),
            minutes: spec.laborMinutes,
          },
        });
      }

      let reworkTaskId: string | null = null;
      if ((spec.reworkMinutes ?? 0) > 0) {
        const rw = await prisma.productionTask.create({
          data: {
            number: `TSK-${code}-${spec.key}-RW`,
            productionOrderId: po.id,
            name: `Rework — ${spec.key}`,
            status: TaskStatus.COMPLETED,
            progressPercent: 100,
            assignedEmployeeId: carpenter.id,
            actualStart: input.activityAt,
            actualCompletion: input.deliveredAt ?? input.activityAt,
            isRework: true,
          },
        });
        reworkTaskId = rw.id;
        await prisma.taskTimeEntry.create({
          data: {
            taskId: rw.id,
            userId: carpenter.id,
            startedAt: input.activityAt,
            endedAt: new Date(input.activityAt.getTime() + (spec.reworkMinutes ?? 0) * 60_000),
            minutes: spec.reworkMinutes,
          },
        });
      }

      if (input.deliveredAt) {
        await prisma.qualityInspection.create({
          data: {
            number: `QC-${code}-${spec.key}`,
            productionOrderId: po.id,
            stageCode: 'INSPECTION',
            inspectorId: opts.inspectorId,
            inspectedAt: input.deliveredAt,
            result: QualityResult.PASSED,
            notes: 'Cost ledger QC pass',
          },
        });
      }

      for (const mv of spec.movements) {
        const taskId = mv.isRework && reworkTaskId ? reworkTaskId : task.id;
        await move({
          type: mv.type ?? InventoryTxType.PRODUCTION_ISSUE,
          sku: mv.sku,
          qty: mv.qty,
          unitCost: mv.unitCost,
          at: input.activityAt,
          productionOrderId: po.id,
          productionTaskId: taskId,
          salesOrderId: so.id,
          notes: `COST ${soNumber} ${spec.key} ${mv.type ?? 'PRODUCTION_ISSUE'}`,
        });
      }

      createdLines.push({ lineId: line.id, poId: po.id, taskId: task.id, reworkTaskId, spec });
    }

    if (input.deliveredAt) {
      await prisma.delivery.create({
        data: {
          number: `DLV-${code}`,
          salesOrderId: so.id,
          customerId: customer.id,
          deliveryAddress: dealerAddress(customer),
          deliveryDate: input.deliveredAt,
          driverId: opts.driverId,
          status: DeliveryStatus.DELIVERED,
          purpose: DeliveryPurpose.OUTBOUND_ORDER,
          actualDeliveredAt: input.deliveredAt,
          customerConfirmedAt: input.deliveredAt,
          notes: 'Cost desk delivered',
          items: { create: [{ description: input.projectName, quantity: money(1) }] },
        },
      });
    }

    const invStatus =
      input.payment === 'paid'
        ? InvoiceStatus.PAID
        : input.payment === 'partial'
          ? InvoiceStatus.PARTIALLY_PAID
          : InvoiceStatus.ISSUED;
    const paid =
      input.payment === 'paid' ? subtotal : input.payment === 'partial' ? Math.round(subtotal * 0.4) : 0;
    const invoice = await prisma.invoice.create({
      data: {
        number: `INV-${code}`,
        customerId: customer.id,
        salesOrderId: so.id,
        status: invStatus,
        invoiceDate: input.deliveredAt ?? input.activityAt,
        subtotal: money(subtotal),
        taxTotal: money(0),
        total: money(subtotal),
        paidAmount: money(paid),
        outstandingAmount: money(subtotal - paid),
        createdById: opts.adminId,
        lines: {
          create: [
            {
              description: input.projectName,
              quantity: money(1),
              unitPrice: money(subtotal),
              taxRate: money(0),
              lineTotal: money(subtotal),
            },
          ],
        },
      },
    });
    if (paid > 0) {
      await prisma.payment.create({
        data: {
          number: `PAY-${code}`,
          customerId: customer.id,
          invoiceId: invoice.id,
          paymentDate: input.deliveredAt ?? input.activityAt,
          amount: money(paid),
          method: PaymentMethod.BANK_TRANSFER,
          createdById: opts.adminId,
        },
      });
    }

    return { so, lines: createdLines, customer, subtotal };
  }

  const wood = 'MAT-BEECH';
  const fabricSand = 'MAT-VEL-SAND';
  const fabricNavy = 'MAT-VEL-NAVY';
  const foam = 'MAT-FOAM-HD';
  const hw = 'MAT-HW-KIT';

  await buildOrder({
    soNumber: COST_UAT.golden,
    projectName: 'Cost Golden factory ledger',
    dealerUsername: 'nile',
    orderDate: anchors.orderDate,
    activityAt: anchors.monthNotWeek,
    deliveredAt: anchors.asOf,
    payment: 'paid',
    lines: [
      {
        key: 'STD',
        sku: sofa.sku,
        variantCode: 'STD',
        qty: 2,
        lineTotal: 200,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [
          { sku: wood, qty: 8, unitCost: 8 },
          { sku: wood, qty: 2, unitCost: 4, type: InventoryTxType.SCRAP },
        ],
        laborMinutes: 60,
        laborUser: 'priced',
      },
      {
        key: 'KARINA',
        sku: sofa.sku,
        variantCode: 'KARINA',
        qty: 1,
        lineTotal: 180,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [{ sku: fabricNavy, qty: 5, unitCost: 12 }],
        laborMinutes: 24,
        laborUser: 'priced',
      },
      {
        key: 'MOD',
        sku: sofa.sku,
        variantCode: 'STD',
        qty: 1,
        lineTotal: 150,
        complexity: ManufacturingComplexity.MODIFIED,
        width: 280,
        movements: [{ sku: wood, qty: 5, unitCost: 10 }],
        laborMinutes: 36,
        laborUser: 'priced',
      },
      {
        key: 'CUSTOM',
        custom: true,
        customName: 'Custom corner bench',
        qty: 1,
        lineTotal: 100,
        complexity: ManufacturingComplexity.CUSTOM,
        movements: [{ sku: wood, qty: 3, unitCost: 4 }],
        laborMinutes: 120,
        laborUser: 'priced',
      },
    ],
  });

  await buildOrder({
    soNumber: COST_UAT.profit,
    projectName: 'Cost profitable complete',
    dealerUsername: 'oasis',
    orderDate: anchors.today,
    activityAt: anchors.today,
    deliveredAt: anchors.today,
    payment: 'paid',
    lines: [
      {
        key: 'A',
        variantCode: 'STD',
        qty: 1,
        lineTotal: 1800,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [
          { sku: wood, qty: 6, unitCost: 20 },
          { sku: foam, qty: 4, unitCost: 15 },
        ],
        laborMinutes: 120,
        laborUser: 'priced',
      },
    ],
  });

  await buildOrder({
    soNumber: COST_UAT.low,
    projectName: 'Cost low margin',
    dealerUsername: 'oasis',
    orderDate: anchors.weekNotToday,
    activityAt: anchors.weekNotToday,
    deliveredAt: anchors.weekNotToday,
    payment: 'partial',
    lines: [
      {
        key: 'A',
        variantCode: 'KARINA',
        qty: 1,
        lineTotal: 1000,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [
          { sku: fabricNavy, qty: 20, unitCost: 30 },
          { sku: wood, qty: 10, unitCost: 20 },
        ],
        laborMinutes: 240,
        laborUser: 'priced',
      },
    ],
  });

  await buildOrder({
    soNumber: COST_UAT.loss,
    projectName: 'Cost negative margin',
    dealerUsername: 'cedar',
    orderDate: anchors.weekNotToday,
    activityAt: anchors.weekNotToday,
    deliveredAt: anchors.weekNotToday,
    payment: 'unpaid',
    lines: [
      {
        key: 'A',
        variantCode: 'UKR',
        qty: 1,
        lineTotal: 400,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [{ sku: wood, qty: 20, unitCost: 25 }],
        laborMinutes: 120,
        laborUser: 'priced',
      },
    ],
  });

  await buildOrder({
    soNumber: COST_UAT.partial,
    projectName: 'Cost partial labor rate',
    dealerUsername: 'balqis',
    orderDate: anchors.monthNotWeek,
    activityAt: anchors.monthNotWeek,
    deliveredAt: anchors.monthNotWeek,
    payment: 'partial',
    lines: [
      {
        key: 'A',
        variantCode: 'STD',
        qty: 1,
        lineTotal: 900,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [
          { sku: wood, qty: 8, unitCost: 10 },
          { sku: fabricSand, qty: 4, unitCost: 12 },
        ],
        laborMinutes: 90,
        laborUser: 'unpriced',
      },
    ],
  });

  await buildOrder({
    soNumber: COST_UAT.norate,
    projectName: 'Cost labor rate missing',
    dealerUsername: 'balqis',
    orderDate: anchors.today,
    activityAt: anchors.today,
    deliveredAt: anchors.today,
    payment: 'unpaid',
    lines: [
      {
        key: 'A',
        variantCode: 'STD',
        qty: 1,
        lineTotal: 700,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [{ sku: wood, qty: 4, unitCost: 12 }],
        laborMinutes: 80,
        laborUser: 'unpriced',
      },
    ],
  });

  await buildOrder({
    soNumber: COST_UAT.unused,
    projectName: 'Cost unused material return',
    dealerUsername: 'zaatar',
    orderDate: anchors.asOf,
    activityAt: anchors.asOf,
    deliveredAt: anchors.asOf,
    payment: 'paid',
    lines: [
      {
        key: 'A',
        variantCode: 'STD',
        qty: 1,
        lineTotal: 500,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [
          { sku: wood, qty: 10, unitCost: 8 },
          { sku: wood, qty: 2, unitCost: 8, type: InventoryTxType.PRODUCTION_RETURN },
        ],
        laborMinutes: 48,
        laborUser: 'priced',
      },
    ],
  });

  await buildOrder({
    soNumber: COST_UAT.waste,
    projectName: 'Cost waste scrap',
    dealerUsername: 'qasr',
    orderDate: anchors.monthNotWeek,
    activityAt: anchors.monthNotWeek,
    deliveredAt: anchors.monthNotWeek,
    payment: 'paid',
    lines: [
      {
        key: 'A',
        variantCode: 'STD',
        qty: 1,
        lineTotal: 650,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [
          { sku: wood, qty: 8, unitCost: 10 },
          { sku: wood, qty: 2, unitCost: 10, type: InventoryTxType.SCRAP },
        ],
        laborMinutes: 60,
        laborUser: 'priced',
      },
    ],
  });

  await buildOrder({
    soNumber: COST_UAT.rework,
    projectName: 'Cost rework',
    dealerUsername: 'rawnaq',
    orderDate: anchors.asOf,
    activityAt: anchors.asOf,
    deliveredAt: anchors.asOf,
    payment: 'paid',
    lines: [
      {
        key: 'A',
        variantCode: 'STD',
        qty: 1,
        lineTotal: 800,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [
          { sku: wood, qty: 6, unitCost: 10 },
          { sku: wood, qty: 2, unitCost: 10, isRework: true },
        ],
        laborMinutes: 60,
        laborUser: 'priced',
        reworkMinutes: 48,
      },
    ],
  });

  await buildOrder({
    soNumber: COST_UAT.fabricOld,
    projectName: 'Cost fabric historic lot',
    dealerUsername: 'diwan',
    orderDate: anchors.historical,
    activityAt: anchors.historical,
    deliveredAt: anchors.historical,
    payment: 'paid',
    lines: [
      {
        key: 'A',
        variantCode: 'KARINA',
        qty: 1,
        lineTotal: 720,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [{ sku: fabricNavy, qty: 4, unitCost: 9 }],
        laborMinutes: 40,
        laborUser: 'priced',
      },
    ],
  });

  await buildOrder({
    soNumber: COST_UAT.fabricNew,
    projectName: 'Cost fabric current lot',
    dealerUsername: 'diwan',
    orderDate: anchors.today,
    activityAt: anchors.today,
    deliveredAt: anchors.today,
    payment: 'paid',
    lines: [
      {
        key: 'A',
        variantCode: 'KARINA',
        qty: 1,
        lineTotal: 760,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [{ sku: fabricNavy, qty: 4, unitCost: 18 }],
        laborMinutes: 40,
        laborUser: 'priced',
      },
    ],
  });

  const life = await buildOrder({
    soNumber: COST_UAT.life,
    projectName: 'Cost lifetime factory cost',
    dealerUsername: 'nile',
    orderDate: anchors.historical,
    activityAt: anchors.historical,
    deliveredAt: anchors.historical,
    payment: 'paid',
    lines: [
      {
        key: 'A',
        variantCode: 'STD',
        qty: 1,
        lineTotal: 900,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [{ sku: wood, qty: 8, unitCost: 12 }],
        laborMinutes: 72,
        laborUser: 'priced',
      },
    ],
  });

  for (const [soNumber, name, dealerName, at] of [
    [COST_UAT.customA, 'Cost custom banquettes', 'jabal', anchors.today],
    [COST_UAT.customB, 'Cost custom reception desk', 'jabal', anchors.weekNotToday],
    [COST_UAT.customC, 'Cost custom wall panel', 'noor', anchors.monthNotWeek],
  ] as const) {
    await buildOrder({
      soNumber,
      projectName: name,
      dealerUsername: dealerName,
      orderDate: at,
      activityAt: at,
      deliveredAt: at,
      payment: 'paid',
      lines: [
        {
          key: 'C',
          custom: true,
          customName: name,
          qty: 1,
          lineTotal: 420,
          complexity: ManufacturingComplexity.CUSTOM,
          movements: [{ sku: wood, qty: 5, unitCost: 11 }],
          laborMinutes: 90,
          laborUser: 'priced',
        },
      ],
    });
  }

  const variantRows: Array<[string, string, string, Date, number, number]> = [
    [COST_UAT.varStd1, 'STD', 'nile', anchors.today, 1100, 8],
    [COST_UAT.varStd2, 'STD', 'oasis', anchors.monthNotWeek, 1050, 10],
    [COST_UAT.varKar1, 'KARINA', 'nile', anchors.weekNotToday, 980, 12],
    [COST_UAT.varKar2, 'KARINA', 'oasis', anchors.asOf, 990, 14],
    [COST_UAT.varUkr1, 'UKR', 'cedar', anchors.today, 940, 9],
    [COST_UAT.varUkr2, 'UKR', 'zaatar', anchors.historical, 920, 11],
  ];
  for (const [soNumber, variantCode, dealerName, at, sale, woodQty] of variantRows) {
    await buildOrder({
      soNumber,
      projectName: `Cost variant ${variantCode}`,
      dealerUsername: dealerName,
      orderDate: at,
      activityAt: at,
      deliveredAt: at,
      payment: 'paid',
      lines: [
        {
          key: variantCode,
          variantCode,
          qty: 1,
          lineTotal: sale,
          complexity: ManufacturingComplexity.STANDARD,
          movements: [{ sku: wood, qty: woodQty, unitCost: 15 }],
          laborMinutes: 50 + woodQty,
          laborUser: 'priced',
        },
      ],
    });
  }

  await buildOrder({
    soNumber: COST_UAT.noMat,
    projectName: 'Cost missing material price',
    dealerUsername: 'qasr',
    orderDate: anchors.today,
    activityAt: anchors.today,
    deliveredAt: anchors.today,
    payment: 'unpaid',
    lines: [
      {
        key: 'A',
        variantCode: 'STD',
        qty: 1,
        lineTotal: 500,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [{ sku: wood, qty: 3, unitCost: null }],
        laborMinutes: 30,
        laborUser: 'priced',
      },
    ],
  });

  await buildOrder({
    soNumber: COST_UAT.noFab,
    projectName: 'Cost missing fabric price',
    dealerUsername: 'rawnaq',
    orderDate: anchors.weekNotToday,
    activityAt: anchors.weekNotToday,
    deliveredAt: anchors.weekNotToday,
    payment: 'unpaid',
    lines: [
      {
        key: 'A',
        variantCode: 'KARINA',
        qty: 1,
        lineTotal: 520,
        complexity: ManufacturingComplexity.STANDARD,
        movements: [{ sku: fabricSand, qty: 3, unitCost: null }],
        laborMinutes: 30,
        laborUser: 'priced',
      },
    ],
  });

  await seedReturns(prisma, {
    life,
    dealer: dealer('nile'),
    adminId: opts.adminId,
    inspectorId: opts.inspectorId,
    warehouseUserId: opts.warehouseUserId,
    carpenterId: carpenter.id,
    woodSku: wood,
    foamSku: foam,
    rawWhId: rawWh.id,
    finWhId: finWh.id,
    sofa,
    counters: opts.counters,
    at: anchors.asOf,
    weekAt: anchors.weekNotToday,
    monthAt: anchors.monthNotWeek,
  });

  await seedInventoryEconomics(prisma, {
    adminId: opts.adminId,
    warehouseUserId: opts.warehouseUserId,
    counters: opts.counters,
    rawWhId: rawWh.id,
    semiWhId: semiWh.id,
    finWhId: finWh.id,
    today: anchors.today,
    weekAt: anchors.weekNotToday,
    monthAt: anchors.monthNotWeek,
    historical: anchors.historical,
    wood,
    fabricNavy,
    foam,
    hw,
    itemBySku,
  });

  const navy = requireSku(fabricNavy);
  await prisma.inventoryItem.update({
    where: { id: navy.id },
    data: { standardCost: money(22) },
  });

  console.log(
    `  Cost world: ${COST_UAT.golden} 294/630/336 · ${COST_UAT.low} · ${COST_UAT.loss} · ${COST_UAT.partial}`,
  );
}

async function ensureUnpricedWorker(prisma: PrismaClient, passwordHash: string) {
  const existing = await prisma.user.findUnique({ where: { username: COST_UAT.unpricedUser } });
  if (existing) return existing.id;
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'PRODUCTION_WORKER' } });
  const dept = await prisma.department.findUnique({ where: { code: 'CARP' } });
  const user = await prisma.user.create({
    data: {
      username: COST_UAT.unpricedUser,
      email: `${COST_UAT.unpricedUser}@${COMPANY_DOMAIN}`,
      phone: '+962790109901',
      passwordHash,
      portalPasswordEnc: encryptPortalPassword('123'),
      firstName: 'Nader',
      lastName: 'Unpriced',
      preferredLanguage: Locale.ar,
      isEmailVerified: true,
      isActive: true,
      departmentId: dept?.id,
      roles: { create: { roleId: role.id } },
    },
  });
  const carpentry = await prisma.productionStageDefinition.findUnique({ where: { code: 'CARPENTRY' } });
  if (carpentry) {
    await prisma.workerSkill.create({
      data: { userId: user.id, stageDefinitionId: carpentry.id, proficiency: 2, isActive: true },
    });
  }
  return user.id;
}

async function seedReturns(
  prisma: PrismaClient,
  opts: {
    life: { so: { id: string; number: string }; lines: Array<{ lineId: string; poId: string }>; customer: DealerRef };
    dealer: DealerRef;
    adminId: string;
    inspectorId: string;
    warehouseUserId: string;
    carpenterId: string;
    woodSku: string;
    foamSku: string;
    rawWhId: string;
    finWhId: string;
    sofa: ProductRef;
    counters: SeqBag;
    at: Date;
    weekAt: Date;
    monthAt: Date;
  },
) {
  const wood = await prisma.inventoryItem.findUniqueOrThrow({ where: { sku: opts.woodSku } });
  const foam = await prisma.inventoryItem.findUniqueOrThrow({ where: { sku: opts.foamSku } });
  const lifeLine = opts.life.lines[0]!;

  async function makeReturn(args: {
    number: string;
    decision: ReturnPieceDecision;
    origin: ProductionOrderOriginType;
    resolution: ReturnResolution;
    at: Date;
    withCost: boolean;
    recover?: boolean;
    incomplete?: boolean;
  }) {
    const ret = await prisma.returnRequest.create({
      data: {
        number: args.number,
        customerId: opts.dealer.id,
        salesOrderId: opts.life.so.id,
        salesOrderLineId: lifeLine.lineId,
        productId: opts.sofa.id,
        variantId: opts.sofa.defaultVariantId,
        sourceProductionOrderId: lifeLine.poId,
        productDesc: opts.sofa.nameEn,
        quantity: money(1),
        reason: ReturnReason.MANUFACTURING_DEFECT,
        description: args.number,
        approvalStatus: 'APPROVED',
        physicalStatus: args.incomplete ? 'RETURNED' : 'RESOLVED',
        lifecycleState: args.incomplete ? ReturnLifecycleState.RECEIVED : ReturnLifecycleState.COMPLETED,
        resolution: args.resolution,
        receivedAt: args.at,
        receivedById: opts.adminId,
        createdAt: args.at,
      },
    });
    const piece = await prisma.returnPiece.create({
      data: {
        returnRequestId: ret.id,
        pieceNo: 1,
        code: `${args.number}-P1`,
        salesOrderId: opts.life.so.id,
        salesOrderLineId: lifeLine.lineId,
        productId: opts.sofa.id,
        variantId: opts.sofa.defaultVariantId,
        productDesc: opts.sofa.nameEn,
        state: args.recover ? ReturnPieceState.RECOVERED : ReturnPieceState.READY_TO_RETURN,
        decision: args.decision,
        receivedAt: args.at,
        receivedById: opts.adminId,
      },
    });
    if (args.incomplete) return;

    const po = await prisma.productionOrder.create({
      data: {
        number: `PO-${args.number}`,
        salesOrderId: opts.life.so.id,
        salesOrderLineId: lifeLine.lineId,
        customerId: opts.dealer.id,
        productId: opts.sofa.id,
        variantId: opts.sofa.defaultVariantId,
        productDescription: `${args.number} work`,
        quantity: money(1),
        status: ProductionOrderStatus.COMPLETED,
        progressPercent: 100,
        originType: args.origin,
        returnRequestId: ret.id,
        returnPieceId: piece.id,
        actualStartDate: args.at,
        actualCompletionDate: args.at,
        createdById: opts.adminId,
      },
    });
    await attachMinimalWorkflowSnapshot(prisma, po.id, `cost-${args.number}`);
    const task = await prisma.productionTask.create({
      data: {
        number: `TSK-${args.number}`,
        productionOrderId: po.id,
        name: `${args.number} work`,
        status: TaskStatus.COMPLETED,
        progressPercent: 100,
        assignedEmployeeId: opts.carpenterId,
        isRework: args.origin === ProductionOrderOriginType.RETURN_WORK,
      },
    });
    await prisma.qualityInspection.create({
      data: {
        number: `QC-${args.number}`,
        productionOrderId: po.id,
        inspectorId: opts.inspectorId,
        inspectedAt: args.at,
        result: QualityResult.PASSED,
      },
    });
    if (args.withCost) {
      await applyDemoMovement(prisma, {
        type: InventoryTxType.PRODUCTION_ISSUE,
        itemId: wood.id,
        warehouseId: opts.rawWhId,
        quantity: 2,
        unitCost: 14,
        userId: opts.warehouseUserId,
        at: args.at,
        notes: `COST ${args.number} repair issue`,
        referenceType: 'ProductionOrder',
        referenceId: po.id,
        productionOrderId: po.id,
        productionTaskId: task.id,
        salesOrderId: opts.life.so.id,
        counters: opts.counters,
      });
      await prisma.taskTimeEntry.create({
        data: {
          taskId: task.id,
          userId: opts.carpenterId,
          startedAt: args.at,
          endedAt: new Date(args.at.getTime() + 48 * 60_000),
          minutes: 48,
        },
      });
    }
    if (args.recover) {
      await prisma.returnRecoveryLine.create({
        data: {
          returnPieceId: piece.id,
          productionTaskId: task.id,
          inventoryItemId: foam.id,
          label: foam.nameEn,
          quantity: money(2),
          unit: foam.unit || 'pcs',
          outcome: ReturnRecoveryOutcome.RECOVER_TO_INVENTORY,
          destinationWarehouseId: opts.rawWhId,
          unitCost: money(15),
          recordedById: opts.adminId,
          recordedAt: args.at,
          postedAt: args.at,
          idempotencyKey: `${args.number}-rec-1`,
        },
      });
      await applyDemoMovement(prisma, {
        type: InventoryTxType.CUSTOMER_RETURN,
        itemId: foam.id,
        warehouseId: opts.rawWhId,
        quantity: 2,
        unitCost: 15,
        userId: opts.warehouseUserId,
        at: args.at,
        notes: `COST ${args.number} recovered foam`,
        salesOrderId: opts.life.so.id,
        counters: opts.counters,
      });
      await prisma.returnRecoveryLine.create({
        data: {
          returnPieceId: piece.id,
          label: 'Disposed foam scrap',
          quantity: money(1),
          unit: 'pcs',
          outcome: ReturnRecoveryOutcome.DISPOSE,
          unitCost: money(8),
          recordedById: opts.adminId,
          recordedAt: args.at,
          postedAt: args.at,
          idempotencyKey: `${args.number}-disp-1`,
        },
      });
    }
    await prisma.returnPiece.update({
      where: { id: piece.id },
      data: {
        productionOrderId: args.origin === ProductionOrderOriginType.RETURN_RECOVERY ? null : po.id,
        recoveryOrderId: args.origin === ProductionOrderOriginType.RETURN_RECOVERY ? po.id : null,
      },
    });
  }

  await makeReturn({
    number: COST_UAT.repair,
    decision: ReturnPieceDecision.REPAIR,
    origin: ProductionOrderOriginType.RETURN_WORK,
    resolution: ReturnResolution.REPAIR,
    at: opts.at,
    withCost: true,
  });
  await makeReturn({
    number: COST_UAT.replacement,
    decision: ReturnPieceDecision.REPLACEMENT,
    origin: ProductionOrderOriginType.REPLACEMENT,
    resolution: ReturnResolution.REPLACEMENT,
    at: opts.weekAt,
    withCost: true,
  });
  await makeReturn({
    number: COST_UAT.recovery,
    decision: ReturnPieceDecision.SCRAP_RECOVERY,
    origin: ProductionOrderOriginType.RETURN_RECOVERY,
    resolution: ReturnResolution.CREDIT_NOTE,
    at: opts.monthAt,
    withCost: true,
    recover: true,
  });
  await makeReturn({
    number: COST_UAT.incompleteReturn,
    decision: ReturnPieceDecision.REPAIR,
    origin: ProductionOrderOriginType.RETURN_WORK,
    resolution: ReturnResolution.REPAIR,
    at: opts.at,
    withCost: false,
    incomplete: true,
  });
}

async function seedInventoryEconomics(
  prisma: PrismaClient,
  opts: {
    adminId: string;
    warehouseUserId: string;
    counters: SeqBag;
    rawWhId: string;
    semiWhId: string;
    finWhId: string;
    today: Date;
    weekAt: Date;
    monthAt: Date;
    historical: Date;
    wood: string;
    fabricNavy: string;
    foam: string;
    hw: string;
    itemBySku: Map<string, { id: string; sku: string }>;
  },
) {
  const wood = opts.itemBySku.get(opts.wood);
  const fabric = opts.itemBySku.get(opts.fabricNavy);
  const foam = opts.itemBySku.get(opts.foam);
  const hw = opts.itemBySku.get(opts.hw);
  if (!wood || !fabric || !foam || !hw) return;

  await applyDemoMovement(prisma, {
    type: InventoryTxType.PURCHASE_RECEIPT,
    itemId: fabric.id,
    warehouseId: opts.rawWhId,
    quantity: 20,
    unitCost: 9,
    userId: opts.warehouseUserId,
    at: opts.historical,
    notes: 'COST historic navy velvet receipt',
    counters: opts.counters,
  });
  await applyDemoMovement(prisma, {
    type: InventoryTxType.PURCHASE_RECEIPT,
    itemId: fabric.id,
    warehouseId: opts.rawWhId,
    quantity: 16,
    unitCost: 18,
    userId: opts.warehouseUserId,
    at: opts.today,
    notes: 'COST current navy velvet receipt',
    counters: opts.counters,
  });

  const semiItem =
    (await prisma.inventoryItem.findUnique({ where: { sku: 'SEMI-COST-FRAME' } })) ??
    (await prisma.inventoryItem.create({
      data: {
        sku: 'SEMI-COST-FRAME',
        nameEn: 'Cost sofa frame WIP',
        nameAr: 'هيكل كنبة نصف مصنع',
        nameHe: 'שלד ספה WIP',
        category: InventoryCategory.SEMI_FINISHED,
        itemClass: InventoryItemClass.SEMI_FINISHED_GOOD,
        unit: 'pcs',
        standardCost: money(80),
        isPurchasable: false,
        isActive: true,
      },
    }));
  const finItem =
    (await prisma.inventoryItem.findUnique({ where: { sku: 'FIN-COST-SOFA' } })) ??
    (await prisma.inventoryItem.create({
      data: {
        sku: 'FIN-COST-SOFA',
        nameEn: 'Cost finished sofa',
        nameAr: 'كنبة جاهزة تكلفة',
        nameHe: 'ספה גמורה לחישוב עלות',
        category: InventoryCategory.FINISHED,
        itemClass: InventoryItemClass.FINISHED_GOOD,
        unit: 'pcs',
        standardCost: money(220),
        isPurchasable: false,
        isActive: true,
      },
    }));
  await prisma.inventoryItem.update({
    where: { id: semiItem.id },
    data: { standardCost: money(80), archivedAt: null, isActive: true },
  });
  await prisma.inventoryItem.update({
    where: { id: finItem.id },
    data: { standardCost: money(220), archivedAt: null, isActive: true },
  });

  await applyDemoMovement(prisma, {
    type: InventoryTxType.SEMI_FINISHED_RECEIPT,
    itemId: semiItem.id,
    warehouseId: opts.semiWhId,
    quantity: 6,
    unitCost: 80,
    userId: opts.warehouseUserId,
    at: opts.weekAt,
    notes: 'COST WIP output',
    counters: opts.counters,
  });
  await applyDemoMovement(prisma, {
    type: InventoryTxType.FINISHED_GOODS_RECEIPT,
    itemId: finItem.id,
    warehouseId: opts.finWhId,
    quantity: 4,
    unitCost: 220,
    userId: opts.warehouseUserId,
    at: opts.today,
    notes: 'COST finished output',
    counters: opts.counters,
  });
  await applyDemoMovement(prisma, {
    type: InventoryTxType.INVENTORY_ADJUSTMENT,
    itemId: wood.id,
    warehouseId: opts.rawWhId,
    quantity: -1,
    unitCost: 8,
    userId: opts.warehouseUserId,
    at: opts.monthAt,
    notes: 'COST cycle count short',
    outbound: true,
    counters: opts.counters,
  });

  const transfer = await prisma.warehouseTransfer.create({
    data: {
      number: COST_UAT.transfer,
      fromWarehouseId: opts.rawWhId,
      toWarehouseId: opts.semiWhId,
      status: 'COMPLETED',
      notes: 'COST transfer is not consumption',
      createdById: opts.adminId,
      createdAt: opts.today,
      lines: {
        create: [
          {
            inventoryItemId: hw.id,
            quantity: money(4),
            fromLocationId: await defaultBinIdForWarehouse(prisma, opts.rawWhId),
            toLocationId: await defaultBinIdForWarehouse(prisma, opts.semiWhId),
          },
        ],
      },
    },
  });
  await applyDemoMovement(prisma, {
    type: InventoryTxType.WAREHOUSE_TRANSFER,
    itemId: hw.id,
    warehouseId: opts.rawWhId,
    quantity: 4,
    unitCost: 6,
    userId: opts.warehouseUserId,
    at: opts.today,
    notes: `COST transfer ${transfer.number} out`,
    referenceType: 'WarehouseTransfer',
    referenceId: transfer.id,
    outbound: true,
    counters: opts.counters,
  });
  await applyDemoMovement(prisma, {
    type: InventoryTxType.WAREHOUSE_TRANSFER,
    itemId: hw.id,
    warehouseId: opts.semiWhId,
    quantity: 4,
    unitCost: 6,
    userId: opts.warehouseUserId,
    at: opts.today,
    notes: `COST transfer ${transfer.number} in`,
    referenceType: 'WarehouseTransfer',
    referenceId: transfer.id,
    outbound: false,
    counters: opts.counters,
  });

  let gap = await prisma.inventoryItem.findUnique({ where: { sku: COST_UAT.gapSku } });
  if (!gap) {
    gap = await prisma.inventoryItem.create({
      data: {
        sku: COST_UAT.gapSku,
        nameEn: 'Unpriced trim leftover',
        nameAr: 'تقليم بدون تسعير',
        nameHe: 'קישוט ללא מחיר',
        category: InventoryCategory.OTHER,
        itemClass: InventoryItemClass.RAW_MATERIAL,
        unit: 'pcs',
        standardCost: money(0),
        isPurchasable: true,
        isActive: true,
      },
    });
  }
  await applyDemoMovement(prisma, {
    type: InventoryTxType.OPENING_BALANCE,
    itemId: gap.id,
    warehouseId: opts.rawWhId,
    quantity: 14,
    unitCost: null,
    userId: opts.warehouseUserId,
    at: opts.historical,
    notes: 'COST valuation gap stock',
    counters: opts.counters,
  });

  await applyDemoMovement(prisma, {
    type: InventoryTxType.PRODUCTION_ISSUE,
    itemId: wood.id,
    warehouseId: opts.rawWhId,
    quantity: 1,
    unitCost: 8,
    userId: opts.warehouseUserId,
    at: opts.today,
    notes: 'COST unattributed issue',
    counters: opts.counters,
  });
}
