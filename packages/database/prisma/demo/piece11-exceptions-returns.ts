/**
 * Piece 11 deterministic exceptions / returns / cancel / correction examples (SO/PO/RET-P11-A…L).
 * Pattern mirrors piece10: wipe by distinctive P11 numbers, SO+setup+PO where needed,
 * FIN/SEMI/RAW ledger rows, ReturnRequest physicalStatus lifecycle.
 * Dealers: balqis (F–J returns), nile (cross-deny). Password 123 elsewhere.
 */
import {
  DeliveryStatus,
  InventoryAllocationMode,
  InventoryLotStatus,
  InventoryTracking,
  InventoryTxType,
  InvoiceStatus,
  ManufacturingComplexity,
  PaymentMethod,
  PrismaClient,
  ProductionOrderStatus,
  QualityResult,
  QuotationStatus,
  ReturnInventoryFate,
  ReturnReason,
  ReturnResolution,
  SalesOrderLineSetupStatus,
  SalesOrderMaterialRequirementSource,
  SalesOrderProductionSetupStatus,
  SalesOrderStatus,
  StageInstanceStatus,
  TaskStatus,
  ChecklistItemResult,
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';
import { addDays, demoAsOf } from './clock';
import {
  loadProductInventoryOutputs,
  resolveDemoSnapshotInventory,
} from './inventory-lifecycle';

type DealerRef = {
  id: string;
  code: string;
  name?: string;
  nameEn?: string;
  username?: string;
  street?: string;
  area?: string;
  city?: string;
  lat?: number;
  lng?: number;
};
type ProductRef = {
  id: string;
  sku: string;
  nameEn: string;
  basePrice: unknown;
  width?: unknown;
  height?: unknown;
  depth?: unknown;
};
type WorkerRef = { id: string; username?: string };

type StageNode = {
  id: string;
  nodeKey: string;
  sortOrder: number;
  stageDefinitionId: string;
  stageCode: string;
  nameEn: string;
  nameAr: string;
  nameHe: string | null;
  executionKind: string;
};

type TaskPlan = {
  assignUsername?: string | null;
  status?: TaskStatus;
  stageStatus?: StageInstanceStatus;
  progressPercent?: number;
  actualStart?: Date | null;
  completedQty?: number;
  notes?: string | null;
  inspectionStatus?: string | null;
};

function isExecutableStage(code: string, executionKind: string): boolean {
  if (String(executionKind).toUpperCase() === 'LOGISTICS') return false;
  if (String(code).toUpperCase() === 'DELIVERY') return false;
  return true;
}

function dealerAddress(d: DealerRef): string {
  return [d.street, d.area, d.city].filter(Boolean).join(', ') || 'Amman, Jordan';
}

export async function seedPiece11ExceptionsReturnsExamples(
  prisma: PrismaClient,
  opts: {
    dealers: DealerRef[];
    products: ProductRef[];
    adminUserId: string;
    workerIds?: string[];
    workers?: WorkerRef[];
    driverId?: string;
  },
) {
  const balqis =
    opts.dealers.find((d) => d.username === 'balqis' || /balqis/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[2] ??
    opts.dealers[0];
  const nile =
    opts.dealers.find((d) => d.username === 'nile' || /nile/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[0];
  const oasis =
    opts.dealers.find((d) => d.username === 'oasis' || /oasis/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[1] ??
    opts.dealers[0];
  if (!balqis || !nile || !opts.products[0]) {
    console.log('  Piece 11 skipped — missing dealers or products.');
    return;
  }

  async function workflowIdForProduct(productId: string): Promise<string | null> {
    const cfg = await prisma.productWorkflowConfiguration.findUnique({
      where: { productId },
      select: { workflowId: true },
    });
    return cfg?.workflowId ?? null;
  }

  async function loadWorkflowNodes(workflowId: string): Promise<{
    versionId: string;
    versionNumber: number;
    nodes: StageNode[];
    edges: Array<{ fromNodeId: string; toNodeId: string }>;
  } | null> {
    const wf = await prisma.productionWorkflow.findUnique({
      where: { id: workflowId },
      select: {
        activeVersionId: true,
        activeVersion: {
          select: {
            id: true,
            versionNumber: true,
            nodes: {
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                nodeKey: true,
                sortOrder: true,
                stageDefinitionId: true,
                stageDefinition: {
                  select: {
                    code: true,
                    nameEn: true,
                    nameAr: true,
                    nameHe: true,
                    executionKind: true,
                  },
                },
              },
            },
            edges: { select: { fromNodeId: true, toNodeId: true } },
          },
        },
      },
    });
    const version = wf?.activeVersion;
    if (!version) return null;
    return {
      versionId: version.id,
      versionNumber: version.versionNumber,
      nodes: version.nodes.map((n) => ({
        id: n.id,
        nodeKey: n.nodeKey,
        sortOrder: n.sortOrder,
        stageDefinitionId: n.stageDefinitionId,
        stageCode: n.stageDefinition.code,
        nameEn: n.stageDefinition.nameEn || n.stageDefinition.code,
        nameAr: n.stageDefinition.nameAr || n.stageDefinition.code,
        nameHe: n.stageDefinition.nameHe ?? null,
        executionKind: n.stageDefinition.executionKind,
      })),
      edges: version.edges,
    };
  }

  let product = opts.products[0]!;
  let defaultWorkflowId = await workflowIdForProduct(product.id);
  for (const p of opts.products) {
    const wfId = await workflowIdForProduct(p.id);
    if (!wfId) continue;
    const compiled = await loadWorkflowNodes(wfId);
    const codes = new Set(compiled?.nodes.map((n) => n.stageCode) ?? []);
    if (codes.has('PACKAGING') && codes.has('INSPECTION') && codes.has('CARPENTRY')) {
      product = p;
      defaultWorkflowId = wfId;
      break;
    }
  }
  if (!defaultWorkflowId) {
    console.log('  Piece 11 skipped — no product with active packaging workflow.');
    return;
  }

  const catalogW = product.width != null ? Number(product.width) : 180;
  const catalogH = product.height != null ? Number(product.height) : 90;
  const catalogD = product.depth != null ? Number(product.depth) : 85;
  const unitPriceNum = Number(product.basePrice) || 2500;
  const unitPrice = money(unitPriceNum);
  const asOf = demoAsOf();
  const sentAt = new Date();
  const acceptedAt = new Date();

  const workerUsers = await prisma.user.findMany({
    where: {
      username: {
        in: [
          'inspector',
          'packer',
          'carpenter',
          'assembler',
          'upholsterer',
          'driver',
          'balqis',
          'nile',
          'oasis',
        ],
      },
    },
    select: { id: true, username: true },
  });
  const byUsername = new Map(
    workerUsers
      .filter((u): u is { id: string; username: string } => Boolean(u.username))
      .map((u) => [u.username.toLowerCase(), u.id]),
  );
  for (const w of opts.workers ?? []) {
    if (w.username && !byUsername.has(w.username.toLowerCase())) {
      byUsername.set(w.username.toLowerCase(), w.id);
    }
  }
  const inspectorId = byUsername.get('inspector') ?? opts.workerIds?.[0] ?? opts.adminUserId;
  const driverId = opts.driverId ?? byUsername.get('driver') ?? opts.adminUserId;
  const carpenterId = byUsername.get('carpenter') ?? opts.adminUserId;

  const finWh =
    (await prisma.warehouse.findFirst({
      where: { type: 'FINISHED_GOODS', isActive: true },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    })) ?? null;
  const semiWh =
    (await prisma.warehouse.findFirst({
      where: { type: 'SEMI_FINISHED', isActive: true },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    })) ?? null;
  const rawWh =
    (await prisma.warehouse.findFirst({
      where: { type: 'RAW_MATERIALS', isActive: true },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    })) ?? null;

  const fabricItem = await prisma.inventoryItem.findFirst({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL', category: 'FABRIC' },
    orderBy: { sku: 'asc' },
  });
  const woodItem = await prisma.inventoryItem.findFirst({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL', category: 'WOOD' },
    orderBy: { sku: 'asc' },
  });
  const rawFallback = await prisma.inventoryItem.findFirst({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
    orderBy: { sku: 'asc' },
  });
  const fabricOrRaw = fabricItem ?? rawFallback;
  const woodOrRaw = woodItem ?? rawFallback;

  const checklist = await prisma.qualityChecklistTemplate.findUnique({
    where: { code: 'FINAL_QC' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });

  let quarantineLoc = finWh
    ? await prisma.warehouseLocation.findFirst({
        where: { warehouseId: finWh.id, code: 'QUARANTINE' },
      })
    : null;
  if (finWh && !quarantineLoc) {
    quarantineLoc = await prisma.warehouseLocation.create({
      data: {
        warehouseId: finWh.id,
        code: 'QUARANTINE',
        name: 'Quarantine',
      },
    });
  }

  function inventoryFlagsForStage(stageCode: string): {
    inventoryTracking: InventoryTracking;
    consumesSemiFinished: boolean;
  } {
    const code = stageCode.toUpperCase();
    if (code === 'CARPENTRY' || code === 'FOAM') {
      return {
        inventoryTracking: InventoryTracking.PRODUCES_SEMI_FINISHED,
        consumesSemiFinished: false,
      };
    }
    if (code === 'ASSEMBLY' || code === 'UPHOLSTERY') {
      return {
        inventoryTracking: InventoryTracking.NONE,
        consumesSemiFinished: true,
      };
    }
    if (code === 'PACKAGING' || code === 'PACK') {
      return {
        inventoryTracking: InventoryTracking.PRODUCES_FINISHED,
        consumesSemiFinished: true,
      };
    }
    return { inventoryTracking: InventoryTracking.NONE, consumesSemiFinished: false };
  }

  function donePlan(assignUsername?: string): TaskPlan {
    return {
      status: TaskStatus.COMPLETED,
      stageStatus: StageInstanceStatus.COMPLETED,
      progressPercent: 100,
      assignUsername,
      actualStart: asOf,
    };
  }

  function priorThroughCarpentryOpen(): Record<string, TaskPlan> {
    return {
      MATERIAL_PREP: donePlan(),
      CARPENTRY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
        actualStart: asOf,
      },
      FOAM: {
        status: TaskStatus.READY,
        stageStatus: StageInstanceStatus.READY,
        progressPercent: 0,
        assignUsername: null,
      },
      UPHOLSTERY: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
        progressPercent: 0,
      },
      ASSEMBLY: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
        progressPercent: 0,
      },
      PAINTING: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
        progressPercent: 0,
      },
      INSPECTION: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
        progressPercent: 0,
      },
      PACKAGING: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
        progressPercent: 0,
      },
    };
  }

  function packagingCompletePlan(): Record<string, TaskPlan> {
    return {
      MATERIAL_PREP: donePlan(),
      CARPENTRY: donePlan('carpenter'),
      FOAM: donePlan(),
      UPHOLSTERY: donePlan('upholsterer'),
      ASSEMBLY: donePlan('assembler'),
      PAINTING: donePlan(),
      INSPECTION: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'inspector',
        inspectionStatus: 'PASSED',
      },
      PACKAGING: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'packer',
        completedQty: 1,
      },
    };
  }

  async function wipeBundle(letter: string) {
    const poNumber = `PO-P11-${letter}`;
    const soNumber = `SO-P11-${letter}`;
    const dlvNumber = `DLV-P11-${letter}`;
    const retNumber = `RET-P11-${letter}`;
    const invNumber = `INV-P11-${letter}`;
    const payNumber = `PAY-P11-${letter}`;
    const cntNumber = `CNT-P11-${letter}`;
    const replPoNumber = `PO-P11-${letter}-REPL`;

    const ret = await prisma.returnRequest.findUnique({
      where: { number: retNumber },
      select: { id: true },
    });
    if (ret) {
      await prisma.reworkRequest.deleteMany({ where: { returnRequestId: ret.id } });
      await prisma.inventoryTransaction.deleteMany({
        where: { referenceType: 'ReturnRequest', referenceId: ret.id },
      });
      await prisma.inventoryLot.deleteMany({
        where: { sourceKey: `return-quarantine:${ret.id}` },
      });
      await prisma.returnRequest.delete({ where: { id: ret.id } });
    }

    const delivery = await prisma.delivery.findUnique({
      where: { number: dlvNumber },
      select: { id: true },
    });
    if (delivery) {
      await prisma.returnRequest.updateMany({
        where: { deliveryId: delivery.id },
        data: { deliveryId: null },
      });
      await prisma.deliveryLoadPiece.deleteMany({ where: { deliveryId: delivery.id } });
      await prisma.inventoryTransaction.deleteMany({
        where: { referenceType: 'Delivery', referenceId: delivery.id },
      });
      await prisma.deliveryItem.deleteMany({ where: { deliveryId: delivery.id } });
      await prisma.delivery.delete({ where: { id: delivery.id } });
    }

    const pay = await prisma.payment.findUnique({
      where: { number: payNumber },
      select: { id: true },
    });
    if (pay) {
      await prisma.paymentAllocation.deleteMany({ where: { paymentId: pay.id } });
      await prisma.statementEntry.deleteMany({ where: { reference: payNumber } }).catch(() => undefined);
      await prisma.payment.delete({ where: { id: pay.id } });
    }

    const inv = await prisma.invoice.findUnique({
      where: { number: invNumber },
      select: { id: true },
    });
    if (inv) {
      await prisma.paymentAllocation.deleteMany({ where: { invoiceId: inv.id } });
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: inv.id } });
      await prisma.statementEntry.deleteMany({ where: { reference: invNumber } }).catch(() => undefined);
      await prisma.invoice.delete({ where: { id: inv.id } });
    }

    const count = await prisma.inventoryCount.findUnique({
      where: { number: cntNumber },
      select: { id: true },
    });
    if (count) {
      await prisma.inventoryCountLine.deleteMany({ where: { inventoryCountId: count.id } });
      await prisma.inventoryCount.delete({ where: { id: count.id } });
    }

    await prisma.inventoryTransaction.deleteMany({
      where: { number: { startsWith: `ITX-P11-${letter}` } },
    });

    for (const poNum of [replPoNumber, poNumber]) {
      const po = await prisma.productionOrder.findUnique({
        where: { number: poNum },
        select: { id: true },
      });
      if (!po) continue;
      const kits = await prisma.wipKit.findMany({
        where: { productionOrderId: po.id },
        select: { id: true },
      });
      const kitIds = kits.map((k) => k.id);
      if (kitIds.length) {
        await prisma.wipHandoff.deleteMany({ where: { kitId: { in: kitIds } } });
        await prisma.wipPiece.deleteMany({ where: { kitId: { in: kitIds } } });
        await prisma.wipKit.deleteMany({ where: { id: { in: kitIds } } });
      }
      await prisma.wipHandoff.deleteMany({ where: { productionOrderId: po.id } });
      await prisma.productionTaskMaterialUsage.deleteMany({ where: { productionOrderId: po.id } });
      const tasks = await prisma.productionTask.findMany({
        where: { productionOrderId: po.id },
        select: { id: true },
      });
      const taskIds = tasks.map((t) => t.id);
      if (taskIds.length) {
        await prisma.taskBlocker.deleteMany({ where: { taskId: { in: taskIds } } });
        await prisma.taskTimeEntry.deleteMany({ where: { taskId: { in: taskIds } } });
        await prisma.scheduleAllocation
          .deleteMany({ where: { productionTaskId: { in: taskIds } } })
          .catch(() => undefined);
      }
      await prisma.productionTask.deleteMany({ where: { productionOrderId: po.id } });
      await prisma.reworkRequest.deleteMany({ where: { productionOrderId: po.id } });
      await prisma.qualityInspectionItem
        .deleteMany({ where: { inspection: { productionOrderId: po.id } } })
        .catch(() => undefined);
      await prisma.qualityDefect
        .deleteMany({ where: { inspection: { productionOrderId: po.id } } })
        .catch(() => undefined);
      await prisma.qualityInspection.deleteMany({ where: { productionOrderId: po.id } }).catch(() => undefined);
      await prisma.inventoryTransaction.deleteMany({
        where: { referenceType: 'ProductionOrder', referenceId: po.id },
      });
      const lots = await prisma.inventoryLot.findMany({
        where: { productionOrderId: po.id },
        select: { id: true },
      });
      if (lots.length) {
        await prisma.deliveryLoadPiece.deleteMany({
          where: { inventoryLotId: { in: lots.map((l) => l.id) } },
        });
      }
      await prisma.inventoryLot.deleteMany({ where: { productionOrderId: po.id } });
      const snap = await prisma.productionOrderWorkflowSnapshot.findUnique({
        where: { productionOrderId: po.id },
        select: { id: true },
      });
      if (snap) {
        await prisma.productionOrderWorkflowSnapshotEdge.deleteMany({
          where: { snapshotId: snap.id },
        });
        await prisma.productionOrderWorkflowSnapshotMaterialInput.deleteMany({
          where: { snapshotNode: { snapshotId: snap.id } },
        });
        await prisma.productionOrderWorkflowSnapshotNode.deleteMany({
          where: { snapshotId: snap.id },
        });
        await prisma.productionOrderWorkflowSnapshot.delete({ where: { id: snap.id } });
      }
      await prisma.productionStageInstance.deleteMany({ where: { productionOrderId: po.id } });
      await prisma.productionOrder.delete({ where: { id: po.id } });
    }

    const so = await prisma.salesOrder.findUnique({
      where: { number: soNumber },
      select: { id: true },
    });
    if (so) {
      await prisma.returnRequest.deleteMany({ where: { salesOrderId: so.id } });
      const leftoverDlv = await prisma.delivery.findMany({
        where: { salesOrderId: so.id },
        select: { id: true },
      });
      for (const d of leftoverDlv) {
        await prisma.deliveryLoadPiece.deleteMany({ where: { deliveryId: d.id } });
        await prisma.inventoryTransaction.deleteMany({
          where: { referenceType: 'Delivery', referenceId: d.id },
        });
        await prisma.deliveryItem.deleteMany({ where: { deliveryId: d.id } });
        await prisma.delivery.delete({ where: { id: d.id } });
      }
      await prisma.inventoryLot.deleteMany({ where: { salesOrderId: so.id } });
      await prisma.salesOrderLineMaterialRequirement.deleteMany({
        where: { lineSetup: { productionSetup: { salesOrderId: so.id } } },
      });
      await prisma.salesOrderLineSetup.deleteMany({
        where: { productionSetup: { salesOrderId: so.id } },
      });
      await prisma.salesOrderProductionSetup.deleteMany({ where: { salesOrderId: so.id } });
      await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: so.id } });
      await prisma.salesOrder.delete({ where: { id: so.id } });
    }
    await prisma.quotation.deleteMany({ where: { number: `QT-P11-${letter}` } }).catch(() => undefined);
  }

  type BuiltPo = {
    poId: string;
    soId: string;
    lineId: string;
    tasksByCode: Map<string, string>;
    stageInstanceByCode: Map<string, string>;
    snapNodeByCode: Map<string, string>;
    productId: string;
    totals: { subtotal: number; taxAmount: number; lineTotal: number };
  };

  async function buildPo(input: {
    letter: string;
    customerId: string;
    productId: string;
    description: string;
    projectName: string;
    factoryNotes: string;
    workflowId: string | null;
    soStatus?: SalesOrderStatus;
    poStatus?: ProductionOrderStatus | null;
    quantity?: number;
    planByStage?: Record<string, TaskPlan>;
    skipPo?: boolean;
    setupStatus?: SalesOrderProductionSetupStatus;
    cancellationReason?: string | null;
    currentStageCode?: string;
    progressPercent?: number;
  }): Promise<BuiltPo | null> {
    await wipeBundle(input.letter);
    const qty = input.quantity ?? 1;
    const totals = lineTotals(qty, unitPriceNum, VAT);
    const soNumber = `SO-P11-${input.letter}`;
    const qtNumber = `QT-P11-${input.letter}`;
    const poNumber = `PO-P11-${input.letter}`;
    const complexity = ManufacturingComplexity.STANDARD;
    const orderDims = { width: catalogW, height: catalogH, depth: catalogD };
    const catalogDims = { width: catalogW, height: catalogH, depth: catalogD };
    const orderSpec = {
      productId: input.productId,
      productName: input.description,
      quantity: qty,
      manufacturingComplexity: complexity,
      catalogDimensions: catalogDims,
      requestedDimensions: orderDims,
    };

    const quote = await prisma.quotation.create({
      data: {
        number: qtNumber,
        version: 1,
        customerId: input.customerId,
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
              productId: input.productId,
              description: input.description,
              quantity: qty,
              unitPrice,
              taxRate: VAT,
              subtotal: totals.subtotalM,
              taxAmount: totals.taxAmountM,
              lineTotal: totals.lineTotalM,
              manufacturingComplexity: complexity,
              sortOrder: 0,
            },
          ],
        },
      },
    });

    const so = await prisma.salesOrder.create({
      data: {
        number: soNumber,
        customerId: input.customerId,
        quotationId: quote.id,
        status: input.soStatus ?? SalesOrderStatus.DRAFT,
        externalOrderNumber: `P11-${input.letter}`,
        projectName: input.projectName,
        subtotal: totals.subtotalM,
        taxTotal: totals.taxAmountM,
        total: totals.lineTotalM,
        createdById: opts.adminUserId,
        cancellationReason: input.cancellationReason ?? undefined,
        lines: {
          create: [
            {
              productId: input.productId,
              description: input.description,
              quantity: qty,
              unitPrice,
              taxRate: VAT,
              lineTotal: totals.lineTotalM,
              manufacturingComplexity: complexity,
              orderSpec,
              sortOrder: 0,
            },
          ],
        },
      },
      include: { lines: true },
    });
    const line = so.lines[0]!;

    const mats = fabricOrRaw
      ? [
          {
            inventoryItemId: fabricOrRaw.id,
            sku: fabricOrRaw.sku,
            displayName: fabricOrRaw.nameEn,
            category: fabricOrRaw.category,
            unit: fabricOrRaw.unit || 'm',
            expectedQty: 6,
            source: SalesOrderMaterialRequirementSource.CATALOG,
            needsReview: false,
            sortOrder: 0,
          },
        ]
      : [];

    const setupStatus = input.setupStatus ?? SalesOrderProductionSetupStatus.RELEASED;
    if (input.soStatus !== SalesOrderStatus.DRAFT || input.setupStatus) {
      await prisma.salesOrderProductionSetup.create({
        data: {
          salesOrderId: so.id,
          status: setupStatus,
          releasedAt:
            setupStatus === SalesOrderProductionSetupStatus.RELEASED ? new Date() : undefined,
          releasedById:
            setupStatus === SalesOrderProductionSetupStatus.RELEASED
              ? opts.adminUserId
              : undefined,
          lines: {
            create: {
              salesOrderLineId: line.id,
              status:
                setupStatus === SalesOrderProductionSetupStatus.RELEASED
                  ? SalesOrderLineSetupStatus.READY
                  : SalesOrderLineSetupStatus.NOT_STARTED,
              manufacturingName: input.description,
              manufacturingComplexity: complexity,
              catalogDimensions: catalogDims,
              orderDimensions: orderDims,
              workflowId: input.workflowId ?? undefined,
              workflowConfirmedAt: input.workflowId ? new Date() : undefined,
              packagingExpectation: {
                expectedPieceCount: 1,
                pieceLabels: [{ nameEn: `P11-${input.letter} Package 1` }],
              },
              factoryNotes: input.factoryNotes,
              materialsReviewedAt: new Date(),
              materialRequirements: mats.length ? { create: mats } : undefined,
            },
          },
        },
      });
    }

    if (input.skipPo || input.poStatus === null) {
      return {
        poId: '',
        soId: so.id,
        lineId: line.id,
        tasksByCode: new Map(),
        stageInstanceByCode: new Map(),
        snapNodeByCode: new Map(),
        productId: input.productId,
        totals: {
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          lineTotal: totals.lineTotal,
        },
      };
    }

    const po = await prisma.productionOrder.create({
      data: {
        number: poNumber,
        salesOrderId: so.id,
        salesOrderLineId: line.id,
        customerId: input.customerId,
        productId: input.productId,
        productDescription: input.description,
        quantity: qty,
        status: input.poStatus ?? ProductionOrderStatus.IN_PRODUCTION,
        createdById: opts.adminUserId,
        notes: input.factoryNotes,
        actualStartDate: asOf,
        plannedStartDate: asOf,
        currentStageCode: input.currentStageCode ?? 'CARPENTRY',
        progressPercent: input.progressPercent ?? 40,
      },
    });

    const tasksByCode = new Map<string, string>();
    const stageInstanceByCode = new Map<string, string>();
    const snapNodeByCode = new Map<string, string>();

    if (!input.workflowId) {
      return {
        poId: po.id,
        soId: so.id,
        lineId: line.id,
        tasksByCode,
        stageInstanceByCode,
        snapNodeByCode,
        productId: input.productId,
        totals: {
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          lineTotal: totals.lineTotal,
        },
      };
    }

    const compiled = await loadWorkflowNodes(input.workflowId);
    if (!compiled) {
      return {
        poId: po.id,
        soId: so.id,
        lineId: line.id,
        tasksByCode,
        stageInstanceByCode,
        snapNodeByCode,
        productId: input.productId,
        totals: {
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          lineTotal: totals.lineTotal,
        },
      };
    }

    const productOutputs = await loadProductInventoryOutputs(prisma, input.productId);
    const snapshot = await prisma.productionOrderWorkflowSnapshot.create({
      data: {
        productionOrderId: po.id,
        sourceWorkflowId: input.workflowId,
        sourceWorkflowVersionId: compiled.versionId,
        sourceVersionNumber: compiled.versionNumber,
      },
    });
    const snapNodeIdBySource = new Map<string, string>();
    let taskIdx = 0;
    const planByStage = input.planByStage ?? {};

    for (const n of compiled.nodes) {
      const flags = inventoryFlagsForStage(n.stageCode);
      const resolved = resolveDemoSnapshotInventory(
        {
          sourceWorkflowNodeId: n.id,
          stageDefinitionId: n.stageDefinitionId,
          stageCode: n.stageCode,
          nodeKey: n.nodeKey,
          inventoryTracking: flags.inventoryTracking,
          consumesSemiFinished: flags.consumesSemiFinished,
        },
        productOutputs,
      );
      const tracking =
        flags.inventoryTracking !== InventoryTracking.NONE
          ? flags.inventoryTracking
          : (resolved.tracking as InventoryTracking);
      const consumesSemi =
        flags.consumesSemiFinished || Boolean(resolved.consumesSemiFinished);

      const stageInstance = await prisma.productionStageInstance.create({
        data: {
          productionOrderId: po.id,
          stageDefinitionId: n.stageDefinitionId,
          status: StageInstanceStatus.PENDING,
          progressPercent: 0,
        },
      });
      stageInstanceByCode.set(n.stageCode, stageInstance.id);

      const snapNode = await prisma.productionOrderWorkflowSnapshotNode.create({
        data: {
          snapshotId: snapshot.id,
          sourceWorkflowNodeId: n.id,
          stageDefinitionId: n.stageDefinitionId,
          stageInstanceId: stageInstance.id,
          nodeKey: n.nodeKey,
          stageCode: n.stageCode,
          nameEnSnapshot: n.nameEn,
          nameArSnapshot: n.nameAr,
          nameHeSnapshot: n.nameHe,
          executionKind: n.executionKind as 'PRODUCTION' | 'QUALITY' | 'LOGISTICS',
          inventoryTracking: tracking,
          consumesRawMaterials: Boolean(resolved.consumesRawMaterials),
          consumesSemiFinished: consumesSemi,
          outputQtyPerUnit: resolved.qtyPerUnit ?? (tracking !== InventoryTracking.NONE ? 1 : undefined),
          expectedPieceCount: 1,
          outputNameEn: resolved.nameEn ?? undefined,
          outputNameAr: resolved.nameAr ?? undefined,
          outputNameHe: resolved.nameHe ?? undefined,
          outputUnit: resolved.unit ?? undefined,
          outputDefinitionId: resolved.outputDefinitionId ?? undefined,
          outputInventoryItemId: resolved.inventoryItemId ?? undefined,
          defaultWarehouseId:
            resolved.warehouseId ??
            (tracking === InventoryTracking.PRODUCES_FINISHED
              ? finWh?.id
              : tracking === InventoryTracking.PRODUCES_SEMI_FINISHED
                ? semiWh?.id
                : undefined),
          sortOrder: n.sortOrder,
        },
      });
      snapNodeIdBySource.set(n.id, snapNode.id);
      snapNodeByCode.set(n.stageCode, snapNode.id);

      if (isExecutableStage(n.stageCode, n.executionKind)) {
        taskIdx += 1;
        const task = await prisma.productionTask.create({
          data: {
            number: `TSK-P11-${input.letter}-${String(taskIdx).padStart(2, '0')}`,
            productionOrderId: po.id,
            stageDefinitionId: n.stageDefinitionId,
            stageInstanceId: stageInstance.id,
            name: n.nameEn,
            description: `${n.nameEn} for ${input.description}`,
            status: TaskStatus.NOT_STARTED,
            progressPercent: 0,
            estimatedMinutes: 90,
            targetQty: qty,
            completedQty: 0,
          },
        });
        tasksByCode.set(n.stageCode, task.id);
      }
    }

    for (const e of compiled.edges) {
      const fromId = snapNodeIdBySource.get(e.fromNodeId);
      const toId = snapNodeIdBySource.get(e.toNodeId);
      if (!fromId || !toId) continue;
      await prisma.productionOrderWorkflowSnapshotEdge.create({
        data: {
          snapshotId: snapshot.id,
          fromSnapshotNodeId: fromId,
          toSnapshotNodeId: toId,
        },
      });
    }

    for (const [code, taskId] of tasksByCode) {
      const plan = planByStage[code] ?? {};
      const stageInstanceId = stageInstanceByCode.get(code);
      if (!stageInstanceId) continue;
      const status = plan.status ?? TaskStatus.NOT_STARTED;
      const stageStatus =
        plan.stageStatus ??
        (status === TaskStatus.COMPLETED
          ? StageInstanceStatus.COMPLETED
          : status === TaskStatus.IN_PROGRESS || status === TaskStatus.READY
            ? StageInstanceStatus.READY
            : StageInstanceStatus.PENDING);
      const assignee =
        plan.assignUsername === null
          ? null
          : plan.assignUsername
            ? byUsername.get(plan.assignUsername.toLowerCase()) ?? null
            : undefined;

      await prisma.productionTask.update({
        where: { id: taskId },
        data: {
          status,
          progressPercent:
            plan.progressPercent ?? (status === TaskStatus.COMPLETED ? 100 : 0),
          assignedEmployeeId: assignee === undefined ? undefined : assignee,
          actualStart: plan.actualStart === undefined ? undefined : plan.actualStart,
          plannedStart: addDays(asOf, 0),
          plannedCompletion: addDays(asOf, 1),
          completedQty: plan.completedQty ?? (status === TaskStatus.COMPLETED ? qty : 0),
          notes: plan.notes ?? undefined,
          actualCompletion: status === TaskStatus.COMPLETED ? asOf : undefined,
        },
      });
      await prisma.productionStageInstance.update({
        where: { id: stageInstanceId },
        data: {
          status: stageStatus,
          progressPercent:
            plan.progressPercent ?? (status === TaskStatus.COMPLETED ? 100 : 0),
          actualStart: plan.actualStart === undefined ? undefined : plan.actualStart,
          actualEnd: status === TaskStatus.COMPLETED ? asOf : undefined,
          inspectionStatus: plan.inspectionStatus ?? undefined,
        },
      });
    }

    return {
      poId: po.id,
      soId: so.id,
      lineId: line.id,
      tasksByCode,
      stageInstanceByCode,
      snapNodeByCode,
      productId: input.productId,
      totals: {
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        lineTotal: totals.lineTotal,
      },
    };
  }

  async function resolveFgItem(productId: string) {
    return (
      (await prisma.inventoryItem.findFirst({
        where: { productId, itemClass: 'FINISHED_GOOD', archivedAt: null },
      })) ??
      (await prisma.inventoryItem.findFirst({
        where: { itemClass: 'FINISHED_GOOD', archivedAt: null },
      }))
    );
  }

  async function resolveSemiItem(productId: string) {
    return (
      (await prisma.inventoryItem.findFirst({
        where: { productId, itemClass: 'SEMI_FINISHED_GOOD', archivedAt: null },
      })) ??
      (await prisma.inventoryItem.findFirst({
        where: { itemClass: 'SEMI_FINISHED_GOOD', archivedAt: null },
      }))
    );
  }

  async function seedProductionIssue(args: {
    letter: string;
    poId: string;
    qty?: number;
  }) {
    if (!woodOrRaw || !rawWh) return null;
    const qty = args.qty ?? 4;
    return prisma.inventoryTransaction.create({
      data: {
        number: `ITX-P11-${args.letter}-ISSUE`,
        type: InventoryTxType.PRODUCTION_ISSUE,
        inventoryItemId: woodOrRaw.id,
        warehouseId: rawWh.id,
        quantity: money(-qty),
        createdById: opts.adminUserId,
        createdAt: asOf,
        referenceType: 'ProductionOrder',
        referenceId: args.poId,
        idempotencyKey: `p11-prod-issue:${args.poId}:${woodOrRaw.id}`,
        notes: `P11-${args.letter} demo PRODUCTION_ISSUE consumed RAW`,
      },
    });
  }

  async function seedSemiLot(args: {
    letter: string;
    poId: string;
    soId: string;
    lineId: string;
    stageInstanceId: string;
    productId: string;
    status: InventoryLotStatus;
  }) {
    if (!semiWh) return null;
    const semiItem = await resolveSemiItem(args.productId);
    if (!semiItem) return null;
    const sourceKey = `SEMI_FINISHED_RECEIPT:${args.poId}:P11-${args.letter}`;
    await prisma.inventoryTransaction.create({
      data: {
        number: `ITX-P11-${args.letter}-SEMI`,
        type: InventoryTxType.SEMI_FINISHED_RECEIPT,
        inventoryItemId: semiItem.id,
        warehouseId: semiWh.id,
        quantity: money(1),
        createdById: opts.adminUserId,
        createdAt: asOf,
        referenceType: 'ProductionOrder',
        referenceId: args.poId,
        idempotencyKey: sourceKey,
        notes: `P11-${args.letter} demo SEMI_FINISHED_RECEIPT`,
      },
    });
    return prisma.inventoryLot.create({
      data: {
        inventoryItemId: semiItem.id,
        warehouseId: semiWh.id,
        quantity: 1,
        status: args.status,
        allocationMode: InventoryAllocationMode.ORDER_ALLOCATED,
        productionOrderId: args.poId,
        salesOrderId: args.soId,
        salesOrderLineId: args.lineId,
        stageInstanceId: args.stageInstanceId,
        qrCode: `SEMI-P11-${args.letter}`,
        sourceKey,
        producedAt: asOf,
      },
    });
  }

  async function seedFinLot(args: {
    letter: string;
    poId: string;
    soId: string;
    lineId: string;
    packSi: string;
    productId: string;
    status: InventoryLotStatus;
  }) {
    if (!finWh) return null;
    const fgItem = await resolveFgItem(args.productId);
    if (!fgItem) return null;
    const sourceKey = `FINISHED_GOODS_RECEIPT:${args.poId}:P11-${args.letter}`;
    await prisma.inventoryTransaction.create({
      data: {
        number: `ITX-P11-${args.letter}-FIN`,
        type: InventoryTxType.FINISHED_GOODS_RECEIPT,
        inventoryItemId: fgItem.id,
        warehouseId: finWh.id,
        quantity: money(1),
        createdById: opts.adminUserId,
        createdAt: asOf,
        referenceType: 'ProductionOrder',
        referenceId: args.poId,
        idempotencyKey: sourceKey,
        notes: `P11-${args.letter} demo FINISHED_GOODS_RECEIPT`,
      },
    });
    return prisma.inventoryLot.create({
      data: {
        inventoryItemId: fgItem.id,
        warehouseId: finWh.id,
        quantity: 1,
        status: args.status,
        allocationMode: InventoryAllocationMode.ORDER_ALLOCATED,
        productionOrderId: args.poId,
        salesOrderId: args.soId,
        salesOrderLineId: args.lineId,
        stageInstanceId: args.packSi,
        qrCode: `FIN-P11-${args.letter}`,
        sourceKey,
        producedAt: asOf,
      },
    });
  }

  async function createPassInspection(poId: string, number: string, notes: string) {
    return prisma.qualityInspection.create({
      data: {
        number,
        productionOrderId: poId,
        stageCode: 'INSPECTION',
        inspectorId,
        inspectedAt: asOf,
        result: QualityResult.PASSED,
        notes,
        items: checklist
          ? {
              create: checklist.items.map((it) => ({
                checklistCode: it.code,
                label: it.labelEn,
                result: ChecklistItemResult.PASS,
              })),
            }
          : undefined,
      },
    });
  }

  async function seedDelivery(args: {
    letter: string;
    soId: string;
    dealer: DealerRef;
    status: DeliveryStatus;
    confirmed?: boolean;
  }) {
    return prisma.delivery.create({
      data: {
        number: `DLV-P11-${args.letter}`,
        salesOrderId: args.soId,
        customerId: args.dealer.id,
        deliveryAddress: dealerAddress(args.dealer),
        latitude: args.dealer.lat ?? null,
        longitude: args.dealer.lng ?? null,
        deliveryDate: addDays(asOf, -2),
        driverId,
        vehicle: 'Hyundai H-1',
        status: args.status,
        recipientName: args.dealer.nameEn ?? args.dealer.name ?? null,
        notes: `P11-${args.letter} outbound for return story`,
        customerConfirmedAt: args.confirmed ? addDays(asOf, -1) : undefined,
        customerConfirmedById: args.confirmed ? byUsername.get('balqis') ?? undefined : undefined,
        actualDeliveredAt: args.confirmed ? addDays(asOf, -1) : undefined,
        items: {
          create: [{ description: product.nameEn, quantity: money(1) }],
        },
      },
    });
  }

  async function seedDeliveryIssue(args: {
    letter: string;
    deliveryId: string;
    lot: { id: string; inventoryItemId: string; warehouseId: string; quantity: unknown };
  }) {
    const qty = Number(args.lot.quantity) || 1;
    await prisma.inventoryTransaction.create({
      data: {
        number: `ITX-P11-${args.letter}-DLVISSUE`,
        type: InventoryTxType.DELIVERY_ISSUE,
        inventoryItemId: args.lot.inventoryItemId,
        warehouseId: args.lot.warehouseId,
        quantity: money(-qty),
        createdById: opts.adminUserId,
        createdAt: addDays(asOf, -2),
        referenceType: 'Delivery',
        referenceId: args.deliveryId,
        idempotencyKey: `delivery-issue:${args.deliveryId}:${args.lot.id}`,
        notes: `P11-${args.letter} demo DELIVERY_ISSUE`,
      },
    });
  }

  async function seedReturn(args: {
    letter: string;
    customerId: string;
    salesOrderId: string;
    deliveryId?: string | null;
    approvalStatus: string;
    physicalStatus: string;
    resolution?: ReturnResolution | null;
    inventoryFate?: ReturnInventoryFate;
    description: string;
    received?: boolean;
  }) {
    return prisma.returnRequest.create({
      data: {
        number: `RET-P11-${args.letter}`,
        customerId: args.customerId,
        salesOrderId: args.salesOrderId,
        deliveryId: args.deliveryId ?? undefined,
        productDesc: product.nameEn,
        quantity: money(1),
        reason: ReturnReason.MANUFACTURING_DEFECT,
        description: args.description,
        approvalStatus: args.approvalStatus,
        physicalStatus: args.physicalStatus,
        resolution: args.resolution ?? undefined,
        inventoryFate: args.inventoryFate ?? ReturnInventoryFate.PENDING,
        receivedAt: args.received ? asOf : undefined,
        receivedById: args.received ? opts.adminUserId : undefined,
        createdAt: addDays(asOf, -1),
      },
    });
  }

  async function seedQuarantineLot(args: {
    letter: string;
    returnId: string;
    soId: string;
    productId: string;
  }) {
    if (!finWh) return null;
    const fgItem = await resolveFgItem(args.productId);
    if (!fgItem) return null;
    const sourceKey = `return-quarantine:${args.returnId}`;
    await prisma.inventoryTransaction.create({
      data: {
        number: `ITX-P11-${args.letter}-CRET`,
        type: InventoryTxType.CUSTOMER_RETURN,
        inventoryItemId: fgItem.id,
        warehouseId: finWh.id,
        quantity: money(1),
        createdById: opts.adminUserId,
        createdAt: asOf,
        referenceType: 'ReturnRequest',
        referenceId: args.returnId,
        idempotencyKey: sourceKey,
        notes: `P11-${args.letter} demo CUSTOMER_RETURN quarantine`,
      },
    });
    return prisma.inventoryLot.create({
      data: {
        inventoryItemId: fgItem.id,
        warehouseId: finWh.id,
        locationId: quarantineLoc?.id ?? null,
        salesOrderId: args.soId,
        quantity: 1,
        status: InventoryLotStatus.QUARANTINED,
        allocationMode: InventoryAllocationMode.ORDER_ALLOCATED,
        sourceKey,
        producedAt: asOf,
        qrCode: `QRET-P11-${args.letter}`,
      },
    });
  }

  async function seedInvoicePartial(args: {
    letter: string;
    soId: string;
    customerId: string;
    totals: { subtotal: number; taxAmount: number; lineTotal: number };
    paidFraction?: number;
  }) {
    const paid = money(args.totals.lineTotal * (args.paidFraction ?? 0.5));
    const paidNum = Number(paid);
    const inv = await prisma.invoice.create({
      data: {
        number: `INV-P11-${args.letter}`,
        customerId: args.customerId,
        salesOrderId: args.soId,
        invoiceDate: asOf,
        dueDate: addDays(asOf, 30),
        currency: 'ILS',
        status: InvoiceStatus.PARTIALLY_PAID,
        subtotal: money(args.totals.subtotal),
        taxTotal: money(args.totals.taxAmount),
        total: money(args.totals.lineTotal),
        paidAmount: paid,
        outstandingAmount: money(args.totals.lineTotal - paidNum),
        createdById: opts.adminUserId,
        notes: `P11-${args.letter} partial invoice — financial attention on cancel`,
        lines: {
          create: [
            {
              description: product.nameEn,
              quantity: money(1),
              unitPrice,
              taxRate: VAT,
              lineTotal: money(args.totals.lineTotal),
            },
          ],
        },
      },
    });
    await prisma.payment.create({
      data: {
        number: `PAY-P11-${args.letter}`,
        customerId: args.customerId,
        invoiceId: inv.id,
        paymentDate: asOf,
        amount: paid,
        currency: 'ILS',
        method: PaymentMethod.BANK_TRANSFER,
        createdById: opts.adminUserId,
        notes: `P11-${args.letter} partial payment`,
        idempotencyKey: `demo-pay-p11-${args.letter}`,
      },
    });
    return inv;
  }

  // ── Stories ───────────────────────────────────────────────────────────────

  // A — Draft SO cancellable (no PO)
  await buildPo({
    letter: 'A',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P11-A Draft cancellable',
    factoryNotes: 'P11-A: DRAFT SO — easy cancel (phase 1)',
    workflowId: null,
    soStatus: SalesOrderStatus.DRAFT,
    skipPo: true,
  });

  // B — Setup / ready-for-production cancellable
  await buildPo({
    letter: 'B',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P11-B Ready for production cancellable',
    factoryNotes: 'P11-B: READY_FOR_PRODUCTION — setup released, cancellable (phase 2)',
    workflowId: defaultWorkflowId,
    soStatus: SalesOrderStatus.READY_FOR_PRODUCTION,
    poStatus: ProductionOrderStatus.PLANNED,
    setupStatus: SalesOrderProductionSetupStatus.RELEASED,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.READY,
        stageStatus: StageInstanceStatus.READY,
        progressPercent: 0,
      },
    },
    currentStageCode: 'MATERIAL_PREP',
    progressPercent: 0,
  });

  // C — IN_PRODUCTION + consumed RAW + open tasks + SEMI
  {
    const built = await buildPo({
      letter: 'C',
      customerId: oasis.id,
      productId: product.id,
      description: product.nameEn,
      projectName: 'P11-C In production with consumption',
      factoryNotes: 'P11-C: IN_PRODUCTION — PRODUCTION_ISSUE RAW + open tasks + SEMI lot',
      workflowId: defaultWorkflowId,
      soStatus: SalesOrderStatus.IN_PRODUCTION,
      poStatus: ProductionOrderStatus.IN_PRODUCTION,
      planByStage: priorThroughCarpentryOpen(),
      currentStageCode: 'FOAM',
      progressPercent: 35,
    });
    if (built?.poId) {
      await seedProductionIssue({ letter: 'C', poId: built.poId });
      const carpSi = built.stageInstanceByCode.get('CARPENTRY');
      if (carpSi) {
        await seedSemiLot({
          letter: 'C',
          poId: built.poId,
          soId: built.soId,
          lineId: built.lineId,
          stageInstanceId: carpSi,
          productId: built.productId,
          status: InventoryLotStatus.AVAILABLE,
        });
      }
    }
  }

  // D — Already cancelled + SEMI REQUIRES_REVIEW
  {
    const built = await buildPo({
      letter: 'D',
      customerId: nile.id,
      productId: product.id,
      description: product.nameEn,
      projectName: 'P11-D Cancelled with SEMI review',
      factoryNotes: 'P11-D: CANCELLED — SEMI REQUIRES_REVIEW disposition',
      workflowId: defaultWorkflowId,
      soStatus: SalesOrderStatus.CANCELLED,
      poStatus: ProductionOrderStatus.CANCELLED,
      cancellationReason: 'Dealer requested: customer withdrew before assembly',
      planByStage: {
        ...priorThroughCarpentryOpen(),
        FOAM: {
          status: TaskStatus.CANCELLED,
          stageStatus: StageInstanceStatus.SKIPPED,
          progressPercent: 0,
        },
      },
      currentStageCode: 'CARPENTRY',
      progressPercent: 30,
    });
    if (built?.poId) {
      await seedProductionIssue({ letter: 'D', poId: built.poId, qty: 2 });
      const carpSi = built.stageInstanceByCode.get('CARPENTRY');
      if (carpSi) {
        await seedSemiLot({
          letter: 'D',
          poId: built.poId,
          soId: built.soId,
          lineId: built.lineId,
          stageInstanceId: carpSi,
          productId: built.productId,
          status: InventoryLotStatus.REQUIRES_REVIEW,
        });
      }
    }
  }

  // E — READY_FOR_DELIVERY + FIN AVAILABLE (hold disposition)
  {
    const built = await buildPo({
      letter: 'E',
      customerId: oasis.id,
      productId: product.id,
      description: product.nameEn,
      projectName: 'P11-E Ready for delivery FIN hold',
      factoryNotes: 'P11-E: READY_FOR_DELIVERY — FIN AVAILABLE (finDispositionRequired)',
      workflowId: defaultWorkflowId,
      soStatus: SalesOrderStatus.READY_FOR_DELIVERY,
      poStatus: ProductionOrderStatus.READY_FOR_DELIVERY,
      planByStage: packagingCompletePlan(),
      currentStageCode: 'PACKAGING',
      progressPercent: 100,
    });
    if (built?.poId) {
      await createPassInspection(built.poId, 'QI-P11-E', 'P11-E passed');
      const packSi = built.stageInstanceByCode.get('PACKAGING');
      if (packSi) {
        await seedFinLot({
          letter: 'E',
          poId: built.poId,
          soId: built.soId,
          lineId: built.lineId,
          packSi,
          productId: built.productId,
          status: InventoryLotStatus.AVAILABLE,
        });
      }
    }
  }

  // Helper: delivered SO + FIN DELIVERED + delivery for return stories F–J
  async function buildDeliveredReturnBase(letter: string, projectName: string, factoryNotes: string) {
    const built = await buildPo({
      letter,
      customerId: balqis.id,
      productId: product.id,
      description: product.nameEn,
      projectName,
      factoryNotes,
      workflowId: defaultWorkflowId,
      soStatus: SalesOrderStatus.DELIVERED,
      poStatus: ProductionOrderStatus.COMPLETED,
      planByStage: packagingCompletePlan(),
      currentStageCode: 'PACKAGING',
      progressPercent: 100,
    });
    if (!built?.poId || !finWh) return null;
    await createPassInspection(built.poId, `QI-P11-${letter}`, `P11-${letter} passed`);
    const packSi = built.stageInstanceByCode.get('PACKAGING');
    if (!packSi) return null;
    const lot = await seedFinLot({
      letter,
      poId: built.poId,
      soId: built.soId,
      lineId: built.lineId,
      packSi,
      productId: built.productId,
      status: InventoryLotStatus.DELIVERED,
    });
    const delivery = await seedDelivery({
      letter,
      soId: built.soId,
      dealer: balqis,
      status: DeliveryStatus.DELIVERED,
      confirmed: true,
    });
    if (lot) {
      await seedDeliveryIssue({ letter, deliveryId: delivery.id, lot });
    }
    return { built, delivery, lot };
  }

  // F — DELIVERED + Return PENDING reported — 0 quarantine
  {
    const base = await buildDeliveredReturnBase(
      'F',
      'P11-F Delivered return pending',
      'P11-F: DELIVERED + RET PENDING — no quarantine yet',
    );
    if (base) {
      await seedReturn({
        letter: 'F',
        customerId: balqis.id,
        salesOrderId: base.built.soId,
        deliveryId: base.delivery.id,
        approvalStatus: 'PENDING',
        physicalStatus: 'NONE',
        description: 'P11-F dealer reported defect — awaiting admin approve',
      });
    }
  }

  // G — Return APPROVED + WAITING_RETURN — 0 stock (smoke receive target)
  {
    const base = await buildDeliveredReturnBase(
      'G',
      'P11-G Approved waiting return',
      'P11-G: APPROVED + WAITING_RETURN — 0 CUSTOMER_RETURN until receive',
    );
    if (base) {
      await seedReturn({
        letter: 'G',
        customerId: balqis.id,
        salesOrderId: base.built.soId,
        deliveryId: base.delivery.id,
        approvalStatus: 'APPROVED',
        physicalStatus: 'WAITING_RETURN',
        resolution: ReturnResolution.REPAIR,
        description: 'P11-G approved — physical furniture not yet received',
      });
    }
  }

  // H — Return RETURNED + QUARANTINED lot awaiting inspection
  {
    const base = await buildDeliveredReturnBase(
      'H',
      'P11-H Returned quarantined',
      'P11-H: RETURNED + QUARANTINED lot awaiting inspection/fate',
    );
    if (base) {
      const ret = await seedReturn({
        letter: 'H',
        customerId: balqis.id,
        salesOrderId: base.built.soId,
        deliveryId: base.delivery.id,
        approvalStatus: 'APPROVED',
        physicalStatus: 'RETURNED',
        resolution: ReturnResolution.REPAIR,
        description: 'P11-H physically returned — quarantined awaiting inspection',
        received: true,
      });
      await seedQuarantineLot({
        letter: 'H',
        returnId: ret.id,
        soId: base.built.soId,
        productId: base.built.productId,
      });
    }
  }

  // I — Return REWORK fate + rework request
  {
    const base = await buildDeliveredReturnBase(
      'I',
      'P11-I Return rework repair',
      'P11-I: return REWORK fate + ReworkRequest (repair path)',
    );
    if (base) {
      const ret = await seedReturn({
        letter: 'I',
        customerId: balqis.id,
        salesOrderId: base.built.soId,
        deliveryId: base.delivery.id,
        approvalStatus: 'APPROVED',
        physicalStatus: 'RETURNED',
        resolution: ReturnResolution.REPAIR,
        inventoryFate: ReturnInventoryFate.REWORK,
        description: 'P11-I repair/rework path after return receive',
        received: true,
      });
      await seedQuarantineLot({
        letter: 'I',
        returnId: ret.id,
        soId: base.built.soId,
        productId: base.built.productId,
      });
      const uphSi = base.built.stageInstanceByCode.get('UPHOLSTERY');
      await prisma.reworkRequest.create({
        data: {
          number: `RW-P11-I`,
          productionOrderId: base.built.poId,
          returnRequestId: ret.id,
          description: `Customer return ${ret.number} — repair path`,
          notes: 'P11-I rework from return',
          status: 'AWAITING_STAGE',
          reentryStageInstanceId: uphSi ?? undefined,
          assignedToId: carpenterId,
        },
      });
    }
  }

  // J — Return REPLACEMENT + linked replacement PO notes containing REPLACEMENT
  {
    const base = await buildDeliveredReturnBase(
      'J',
      'P11-J Return replacement PO',
      'P11-J: REPLACEMENT resolution + replacement PO notes',
    );
    if (base) {
      const ret = await seedReturn({
        letter: 'J',
        customerId: balqis.id,
        salesOrderId: base.built.soId,
        deliveryId: base.delivery.id,
        approvalStatus: 'APPROVED',
        physicalStatus: 'RETURNED',
        resolution: ReturnResolution.REPLACEMENT,
        inventoryFate: ReturnInventoryFate.SCRAP,
        description: 'P11-J replacement path — original PO untouched',
        received: true,
      });
      await seedQuarantineLot({
        letter: 'J',
        returnId: ret.id,
        soId: base.built.soId,
        productId: base.built.productId,
      });
      await prisma.productionOrder.create({
        data: {
          number: `PO-P11-J-REPL`,
          salesOrderId: base.built.soId,
          salesOrderLineId: base.built.lineId,
          customerId: balqis.id,
          productId: product.id,
          productDescription: `REPLACEMENT — ${ret.number}`,
          quantity: 1,
          status: ProductionOrderStatus.PLANNED,
          createdById: opts.adminUserId,
          notes: `REPLACEMENT — ${ret.number} for SO-P11-J (do not mutate original PO)`,
          plannedStartDate: addDays(asOf, 1),
        },
      });
    }
  }

  // K — Inventory correction: cycle count + INVENTORY_ADJUSTMENT on RAW
  {
    await buildPo({
      letter: 'K',
      customerId: oasis.id,
      productId: product.id,
      description: product.nameEn,
      projectName: 'P11-K Inventory correction',
      factoryNotes: 'P11-K: cycle count / INVENTORY_ADJUSTMENT on RAW',
      workflowId: null,
      soStatus: SalesOrderStatus.CONFIRMED,
      skipPo: true,
    });
    if (woodOrRaw && rawWh) {
      const count = await prisma.inventoryCount.create({
        data: {
          number: 'CNT-P11-K',
          warehouseId: rawWh.id,
          status: 'POSTED',
          countedAt: asOf,
          notes: 'P11-K cycle count correction — wood variance',
          createdById: opts.adminUserId,
          lines: {
            create: [
              {
                inventoryItemId: woodOrRaw.id,
                systemQty: money(100),
                countedQty: money(98),
                varianceQty: money(-2),
              },
            ],
          },
        },
      });
      await prisma.inventoryTransaction.create({
        data: {
          number: 'ITX-P11-K-ADJ',
          type: InventoryTxType.INVENTORY_ADJUSTMENT,
          inventoryItemId: woodOrRaw.id,
          warehouseId: rawWh.id,
          quantity: money(-2),
          createdById: opts.adminUserId,
          createdAt: asOf,
          referenceType: 'InventoryCount',
          referenceId: count.id,
          idempotencyKey: `p11-count-adj:${count.id}:${woodOrRaw.id}`,
          notes: 'P11-K cycle count adjustment — reason: physical count short',
        },
      });
    }
  }

  // L — SO with partial invoice + cancel attention (phase 2/3)
  {
    const built = await buildPo({
      letter: 'L',
      customerId: nile.id,
      productId: product.id,
      description: product.nameEn,
      projectName: 'P11-L Partial invoice cancel attention',
      factoryNotes: 'P11-L: READY_FOR_PRODUCTION + PARTIALLY_PAID invoice — financialAttention',
      workflowId: defaultWorkflowId,
      soStatus: SalesOrderStatus.READY_FOR_PRODUCTION,
      poStatus: ProductionOrderStatus.PLANNED,
      planByStage: {
        MATERIAL_PREP: {
          status: TaskStatus.READY,
          stageStatus: StageInstanceStatus.READY,
          progressPercent: 0,
        },
      },
      currentStageCode: 'MATERIAL_PREP',
      progressPercent: 0,
    });
    if (built) {
      await seedInvoicePartial({
        letter: 'L',
        soId: built.soId,
        customerId: nile.id,
        totals: built.totals,
        paidFraction: 0.4,
      });
    }
  }

  console.log('  piece11: P11-A–L exceptions / returns / cancel / correction examples seeded');
}
