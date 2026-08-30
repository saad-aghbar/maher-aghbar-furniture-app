/**
 * Piece 10 deterministic finished outbound / dealer receipt examples (SO/PO/DLV-P10-A…L).
 * Pattern mirrors piece9: wipe by distinctive P10 numbers, SO+setup+PO with packaging FIN,
 * Delivery + DeliveryLoadPiece materialization.
 * Dealers: balqis (G/H confirm), nile (cross-deny). Password 123 elsewhere.
 */
import {
  DeliveryStatus,
  InventoryAllocationMode,
  InventoryLotStatus,
  InventoryTracking,
  InventoryTxType,
  ManufacturingComplexity,
  PrismaClient,
  ProductionOrderStatus,
  QualityResult,
  QuotationStatus,
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

export async function seedPiece10FinishedOutboundExamples(
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
    console.log('  Piece 10 skipped — missing dealers or products.');
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
    if (codes.has('PACKAGING') && codes.has('INSPECTION')) {
      product = p;
      defaultWorkflowId = wfId;
      break;
    }
  }
  if (!defaultWorkflowId) {
    console.log('  Piece 10 skipped — no product with active packaging workflow.');
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
  const balqisUserId = byUsername.get('balqis') ?? null;

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

  // Second FIN warehouse for P10-I (created if missing).
  let finWhAlt =
    (await prisma.warehouse.findFirst({
      where: { code: 'FIN-P10', type: 'FINISHED_GOODS' },
    })) ?? null;
  if (!finWhAlt && finWh) {
    finWhAlt = await prisma.warehouse.create({
      data: {
        code: 'FIN-P10',
        nameEn: 'Finished Goods — Piece 10 Alt',
        nameAr: 'منتجات جاهزة — قطعة 10',
        type: 'FINISHED_GOODS',
        isActive: true,
        isDefault: false,
        branchId: finWh.branchId,
      },
    });
  }

  const fabricItem = await prisma.inventoryItem.findFirst({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL', category: 'FABRIC' },
    orderBy: { sku: 'asc' },
  });
  const rawFallback = await prisma.inventoryItem.findFirst({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
    orderBy: { sku: 'asc' },
  });
  const fabricOrRaw = fabricItem ?? rawFallback;

  const checklist = await prisma.qualityChecklistTemplate.findUnique({
    where: { code: 'FINAL_QC' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });

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

  function priorProductionDone(): Record<string, TaskPlan> {
    return {
      MATERIAL_PREP: donePlan(),
      CARPENTRY: donePlan('carpenter'),
      FOAM: donePlan(),
      UPHOLSTERY: donePlan('upholsterer'),
      ASSEMBLY: donePlan('assembler'),
      PAINTING: donePlan(),
    };
  }

  function packagingCompletePlan(pieceCount = 1): Record<string, TaskPlan> {
    return {
      ...priorProductionDone(),
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
        completedQty: pieceCount,
      },
    };
  }

  async function wipeBundle(letter: string) {
    const poNumber = `PO-P10-${letter}`;
    const soNumber = `SO-P10-${letter}`;
    const dlvNumber = `DLV-P10-${letter}`;

    const delivery = await prisma.delivery.findUnique({
      where: { number: dlvNumber },
      select: { id: true },
    });
    if (delivery) {
      await prisma.deliveryLoadPiece.deleteMany({ where: { deliveryId: delivery.id } });
      await prisma.inventoryTransaction.deleteMany({
        where: { referenceType: 'Delivery', referenceId: delivery.id },
      });
      await prisma.deliveryItem.deleteMany({ where: { deliveryId: delivery.id } });
      await prisma.delivery.delete({ where: { id: delivery.id } });
    }

    const po = await prisma.productionOrder.findUnique({
      where: { number: poNumber },
      select: { id: true },
    });
    if (po) {
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
    await prisma.quotation.deleteMany({ where: { number: `QT-P10-${letter}` } }).catch(() => undefined);
  }

  type BuiltPo = {
    poId: string;
    soId: string;
    lineId: string;
    tasksByCode: Map<string, string>;
    stageInstanceByCode: Map<string, string>;
    snapNodeByCode: Map<string, string>;
    productId: string;
  };

  type PackagingExpectation = {
    expectedPieceCount: number;
    pieceLabels: Array<{ nameEn: string; nameAr?: string; nameHe?: string | null }>;
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
    poStatus?: ProductionOrderStatus;
    quantity?: number;
    planByStage: Record<string, TaskPlan>;
    packagingExpectation?: PackagingExpectation;
    currentStageCode?: string;
    progressPercent?: number;
  }): Promise<BuiltPo | null> {
    await wipeBundle(input.letter);
    const qty = input.quantity ?? 1;
    const totals = lineTotals(qty, unitPriceNum, VAT);
    const soNumber = `SO-P10-${input.letter}`;
    const qtNumber = `QT-P10-${input.letter}`;
    const poNumber = `PO-P10-${input.letter}`;
    const complexity = ManufacturingComplexity.STANDARD;
    const orderDims = { width: catalogW, height: catalogH, depth: catalogD };
    const catalogDims = { width: catalogW, height: catalogH, depth: catalogD };
    const packExpect = input.packagingExpectation ?? {
      expectedPieceCount: 1,
      pieceLabels: [{ nameEn: `P10-${input.letter} Package 1`, nameAr: `طرد P10-${input.letter}` }],
    };
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
        status: input.soStatus ?? SalesOrderStatus.READY_FOR_DELIVERY,
        externalOrderNumber: `P10-${input.letter}`,
        projectName: input.projectName,
        subtotal: totals.subtotalM,
        taxTotal: totals.taxAmountM,
        total: totals.lineTotalM,
        createdById: opts.adminUserId,
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

    await prisma.salesOrderProductionSetup.create({
      data: {
        salesOrderId: so.id,
        status: SalesOrderProductionSetupStatus.RELEASED,
        releasedAt: new Date(),
        releasedById: opts.adminUserId,
        lines: {
          create: {
            salesOrderLineId: line.id,
            status: SalesOrderLineSetupStatus.READY,
            manufacturingName: input.description,
            manufacturingComplexity: complexity,
            catalogDimensions: catalogDims,
            orderDimensions: orderDims,
            workflowId: input.workflowId ?? undefined,
            workflowConfirmedAt: input.workflowId ? new Date() : undefined,
            packagingExpectation: packExpect,
            factoryNotes: input.factoryNotes,
            materialsReviewedAt: new Date(),
            materialRequirements: mats.length ? { create: mats } : undefined,
          },
        },
      },
    });

    const po = await prisma.productionOrder.create({
      data: {
        number: poNumber,
        salesOrderId: so.id,
        salesOrderLineId: line.id,
        customerId: input.customerId,
        productId: input.productId,
        productDescription: input.description,
        quantity: qty,
        status: input.poStatus ?? ProductionOrderStatus.READY_FOR_DELIVERY,
        createdById: opts.adminUserId,
        notes: input.factoryNotes,
        actualStartDate: asOf,
        plannedStartDate: asOf,
        currentStageCode: input.currentStageCode ?? 'PACKAGING',
        progressPercent: input.progressPercent ?? 100,
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

      const isPack = n.stageCode === 'PACKAGING' || n.stageCode === 'PACK';
      const expectedPieces = isPack
        ? packExpect.expectedPieceCount
        : resolved.expectedPieceCount || 1;
      const packMeta = isPack
        ? { pieceLabels: packExpect.pieceLabels, expectedPieceCount: expectedPieces }
        : undefined;

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
          expectedPieceCount: expectedPieces,
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
          metadata: packMeta,
        },
      });
      snapNodeIdBySource.set(n.id, snapNode.id);
      snapNodeByCode.set(n.stageCode, snapNode.id);

      if (isExecutableStage(n.stageCode, n.executionKind)) {
        taskIdx += 1;
        const task = await prisma.productionTask.create({
          data: {
            number: `TSK-P10-${input.letter}-${String(taskIdx).padStart(2, '0')}`,
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
      const plan = input.planByStage[code] ?? {};
      const stageInstanceId = stageInstanceByCode.get(code);
      if (!stageInstanceId) continue;
      const status = plan.status ?? TaskStatus.NOT_STARTED;
      const stageStatus =
        plan.stageStatus ??
        (status === TaskStatus.COMPLETED
          ? StageInstanceStatus.COMPLETED
          : status === TaskStatus.IN_PROGRESS
            ? StageInstanceStatus.IN_PROGRESS
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
    };
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

  async function seedFinLot(args: {
    letter: string;
    poId: string;
    soId: string;
    lineId: string;
    packSi: string;
    productId: string;
    warehouseId: string;
    status: InventoryLotStatus;
    qty?: number;
    qrSuffix?: string;
    sourceTag?: string;
  }) {
    const fgItem = await resolveFgItem(args.productId);
    if (!fgItem) return null;
    const qty = args.qty ?? 1;
    const tag = args.sourceTag ?? args.letter;
    const sourceKey = `FINISHED_GOODS_RECEIPT:${args.poId}:${args.packSi}:P10-${tag}`;
    await prisma.inventoryTransaction.create({
      data: {
        number: `ITX-P10-${tag}-FIN`,
        type: InventoryTxType.FINISHED_GOODS_RECEIPT,
        inventoryItemId: fgItem.id,
        warehouseId: args.warehouseId,
        quantity: money(qty),
        createdById: opts.adminUserId,
        createdAt: asOf,
        referenceType: 'ProductionOrder',
        referenceId: args.poId,
        idempotencyKey: sourceKey,
        notes: `P10-${args.letter} demo FINISHED_GOODS_RECEIPT`,
      },
    });
    return prisma.inventoryLot.create({
      data: {
        inventoryItemId: fgItem.id,
        warehouseId: args.warehouseId,
        quantity: qty,
        status: args.status,
        allocationMode: InventoryAllocationMode.ORDER_ALLOCATED,
        productionOrderId: args.poId,
        salesOrderId: args.soId,
        salesOrderLineId: args.lineId,
        stageInstanceId: args.packSi,
        qrCode: `FIN-P10-${args.qrSuffix ?? args.letter}`,
        sourceKey,
        producedAt: asOf,
      },
    });
  }

  async function seedDelivery(args: {
    letter: string;
    soId: string;
    dealer: DealerRef;
    status: DeliveryStatus;
    deliveryDate: Date | null;
    notes?: string;
    customerConfirmedAt?: Date | null;
    customerConfirmedById?: string | null;
    actualDeliveredAt?: Date | null;
    failureReason?: string | null;
  }) {
    return prisma.delivery.create({
      data: {
        number: `DLV-P10-${args.letter}`,
        salesOrderId: args.soId,
        customerId: args.dealer.id,
        deliveryAddress: dealerAddress(args.dealer),
        latitude: args.dealer.lat ?? null,
        longitude: args.dealer.lng ?? null,
        deliveryDate: args.deliveryDate,
        driverId,
        vehicle: 'Hyundai H-1',
        status: args.status,
        recipientName: args.dealer.nameEn ?? args.dealer.name ?? null,
        notes: args.notes ?? `P10-${args.letter} outbound seed`,
        customerConfirmedAt: args.customerConfirmedAt ?? undefined,
        customerConfirmedById: args.customerConfirmedById ?? undefined,
        actualDeliveredAt: args.actualDeliveredAt ?? undefined,
        failureReason: args.failureReason ?? undefined,
        items: {
          create: [{ description: product.nameEn, quantity: money(1) }],
        },
      },
    });
  }

  /** Materialize DeliveryLoadPiece rows (mirrors DeliveryLoadService.materializeLoadPieces). */
  async function seedLoadPieces(args: {
    deliveryId: string;
    lotId: string;
    pieceCount: number;
    loadedCount: number;
    loadedAt?: Date;
  }) {
    const rows = [];
    for (let i = 1; i <= args.pieceCount; i += 1) {
      const loaded = i <= args.loadedCount;
      rows.push({
        deliveryId: args.deliveryId,
        inventoryLotId: args.lotId,
        pieceIndex: i,
        loadedAt: loaded ? (args.loadedAt ?? asOf) : null,
        loadedById: loaded ? driverId : null,
      });
    }
    if (rows.length) {
      await prisma.deliveryLoadPiece.createMany({ data: rows, skipDuplicates: true });
    }
  }

  async function seedDeliveryIssue(args: {
    letter: string;
    deliveryId: string;
    lot: { id: string; inventoryItemId: string; warehouseId: string; quantity: unknown };
    at?: Date;
  }) {
    const qty = Number(args.lot.quantity) || 1;
    await prisma.inventoryTransaction.create({
      data: {
        number: `ITX-P10-${args.letter}-ISSUE`,
        type: InventoryTxType.DELIVERY_ISSUE,
        inventoryItemId: args.lot.inventoryItemId,
        warehouseId: args.lot.warehouseId,
        quantity: money(-qty),
        createdById: opts.adminUserId,
        createdAt: args.at ?? asOf,
        referenceType: 'Delivery',
        referenceId: args.deliveryId,
        idempotencyKey: `delivery-issue:${args.deliveryId}:${args.lot.id}`,
        notes: `P10-${args.letter} demo DELIVERY_ISSUE at truck departure`,
      },
    });
  }

  async function seedDeliveryRestore(args: {
    letter: string;
    deliveryId: string;
    lot: { id: string; inventoryItemId: string; warehouseId: string; quantity: unknown };
  }) {
    const qty = Number(args.lot.quantity) || 1;
    await prisma.inventoryTransaction.create({
      data: {
        number: `ITX-P10-${args.letter}-RESTORE`,
        type: InventoryTxType.DELIVERY_RESTORE,
        inventoryItemId: args.lot.inventoryItemId,
        warehouseId: args.lot.warehouseId,
        quantity: money(qty),
        createdById: opts.adminUserId,
        createdAt: asOf,
        referenceType: 'Delivery',
        referenceId: args.deliveryId,
        idempotencyKey: `delivery-restore:${args.deliveryId}:${args.lot.id}`,
        notes: `P10-${args.letter} demo DELIVERY_RESTORE after FAILED`,
      },
    });
  }

  type OutboundStory = {
    letter: string;
    dealer: DealerRef;
    projectName: string;
    factoryNotes: string;
    deliveryStatus: DeliveryStatus;
    deliveryDate: Date | null;
    soStatus?: SalesOrderStatus;
    pieceCount?: number;
    pieceLabels?: PackagingExpectation['pieceLabels'];
    loadedCount?: number;
    finStatus?: InventoryLotStatus;
    issueOnSeed?: boolean;
    restoreOnSeed?: boolean;
    confirmOnSeed?: boolean;
    failureReason?: string;
    warehouseId?: string;
    extraAltWarehouseLot?: boolean;
  };

  if (!finWh) {
    console.log('  Piece 10 skipped — no FINISHED_GOODS warehouse.');
    return;
  }

  const sixLabels = (letter: string) =>
    Array.from({ length: 6 }, (_, i) => ({
      nameEn: `P10-${letter} Crate ${i + 1}`,
      nameAr: `صندوق P10-${letter} ${i + 1}`,
    }));

  const stories: OutboundStory[] = [
    {
      letter: 'A',
      dealer: oasis,
      projectName: 'P10-A FIN waiting for truck',
      factoryNotes: 'P10-A: FIN AVAILABLE in warehouse — delivery READY, no load checks',
      deliveryStatus: DeliveryStatus.READY,
      deliveryDate: addDays(asOf, 2),
      pieceCount: 1,
      loadedCount: 0,
      finStatus: InventoryLotStatus.AVAILABLE,
    },
    {
      letter: 'B',
      dealer: nile,
      projectName: 'P10-B Pickup planned tomorrow',
      factoryNotes: 'P10-B: pickup planned tomorrow',
      deliveryStatus: DeliveryStatus.PLANNED,
      deliveryDate: addDays(asOf, 1),
      pieceCount: 1,
      loadedCount: 0,
      finStatus: InventoryLotStatus.AVAILABLE,
    },
    {
      letter: 'C',
      dealer: oasis,
      projectName: 'P10-C Leaving today',
      factoryNotes: 'P10-C: leave date = today (as-of)',
      deliveryStatus: DeliveryStatus.READY,
      deliveryDate: asOf,
      pieceCount: 1,
      loadedCount: 0,
      finStatus: InventoryLotStatus.AVAILABLE,
    },
    {
      letter: 'D',
      dealer: nile,
      projectName: 'P10-D Overdue leave date',
      factoryNotes: 'P10-D: leave date overdue vs as-of',
      deliveryStatus: DeliveryStatus.PLANNED,
      deliveryDate: addDays(asOf, -3),
      pieceCount: 1,
      loadedCount: 0,
      finStatus: InventoryLotStatus.AVAILABLE,
    },
    {
      letter: 'E',
      dealer: oasis,
      projectName: 'P10-E Load 3/6 incomplete',
      factoryNotes: 'P10-E: 3 of 6 packages checked — FIN still AVAILABLE; depart blocked',
      deliveryStatus: DeliveryStatus.READY,
      deliveryDate: asOf,
      pieceCount: 6,
      pieceLabels: sixLabels('E'),
      loadedCount: 3,
      finStatus: InventoryLotStatus.AVAILABLE,
    },
    {
      letter: 'F',
      dealer: nile,
      projectName: 'P10-F Load 6/6 ready to depart',
      factoryNotes: 'P10-F: all 6 packages loaded — still READY; FIN present for smoke depart',
      deliveryStatus: DeliveryStatus.READY,
      deliveryDate: asOf,
      pieceCount: 6,
      pieceLabels: sixLabels('F'),
      loadedCount: 6,
      finStatus: InventoryLotStatus.AVAILABLE,
    },
    {
      letter: 'G',
      dealer: balqis,
      projectName: 'P10-G Out for delivery awaiting confirm',
      factoryNotes: 'P10-G: OUT_FOR_DELIVERY — FIN issued; awaiting balqis confirm-receipt',
      deliveryStatus: DeliveryStatus.OUT_FOR_DELIVERY,
      deliveryDate: addDays(asOf, -1),
      pieceCount: 2,
      pieceLabels: [
        { nameEn: 'P10-G Seat', nameAr: 'مقعد P10-G' },
        { nameEn: 'P10-G Back', nameAr: 'ظهر P10-G' },
      ],
      loadedCount: 2,
      finStatus: InventoryLotStatus.DELIVERED,
      issueOnSeed: true,
    },
    {
      letter: 'H',
      dealer: balqis,
      projectName: 'P10-H Delivered dealer confirmed',
      factoryNotes: 'P10-H: DELIVERED with customerConfirmedAt/ById (balqis)',
      deliveryStatus: DeliveryStatus.DELIVERED,
      deliveryDate: addDays(asOf, -2),
      soStatus: SalesOrderStatus.DELIVERED,
      pieceCount: 2,
      pieceLabels: [
        { nameEn: 'P10-H Banquette A', nameAr: 'أريكة P10-H أ' },
        { nameEn: 'P10-H Banquette B', nameAr: 'أريكة P10-H ب' },
      ],
      loadedCount: 2,
      finStatus: InventoryLotStatus.DELIVERED,
      issueOnSeed: true,
      confirmOnSeed: true,
    },
    {
      letter: 'I',
      dealer: oasis,
      projectName: 'P10-I Two FIN warehouses',
      factoryNotes: 'P10-I: two FIN lots in FIN + FIN-P10 for same SO',
      deliveryStatus: DeliveryStatus.PLANNED,
      deliveryDate: addDays(asOf, 4),
      pieceCount: 1,
      loadedCount: 0,
      finStatus: InventoryLotStatus.AVAILABLE,
      extraAltWarehouseLot: Boolean(finWhAlt),
    },
    {
      letter: 'J',
      dealer: nile,
      projectName: 'P10-J Failed ship + restore',
      factoryNotes: 'P10-J: FAILED after ship + DELIVERY_RESTORE — FIN back AVAILABLE',
      deliveryStatus: DeliveryStatus.FAILED,
      deliveryDate: addDays(asOf, -1),
      pieceCount: 1,
      loadedCount: 1,
      finStatus: InventoryLotStatus.AVAILABLE,
      issueOnSeed: true,
      restoreOnSeed: true,
      failureReason: 'Customer closed — return to factory (P10-J seed)',
    },
    {
      letter: 'K',
      dealer: oasis,
      projectName: 'P10-K Distinct searchable package labels',
      factoryNotes: 'P10-K: searchable labels P10K-ARMREST-CRATE / P10K-SEAT-CRATE',
      deliveryStatus: DeliveryStatus.READY,
      deliveryDate: addDays(asOf, 5),
      pieceCount: 2,
      pieceLabels: [
        { nameEn: 'P10K-ARMREST-CRATE', nameAr: 'صندوق مسند P10K' },
        { nameEn: 'P10K-SEAT-CRATE', nameAr: 'صندوق مقعد P10K' },
      ],
      loadedCount: 0,
      finStatus: InventoryLotStatus.AVAILABLE,
    },
    {
      letter: 'L',
      dealer: nile,
      projectName: 'P10-L History left factory',
      factoryNotes: 'P10-L: left factory — DELIVERED lot for finished-lots history filter',
      deliveryStatus: DeliveryStatus.OUT_FOR_DELIVERY,
      deliveryDate: addDays(asOf, -5),
      pieceCount: 1,
      pieceLabels: [{ nameEn: 'P10-L History Crate', nameAr: 'صندوق تاريخ P10-L' }],
      loadedCount: 1,
      finStatus: InventoryLotStatus.DELIVERED,
      issueOnSeed: true,
    },
  ];

  for (const story of stories) {
    const pieceCount = story.pieceCount ?? 1;
    const built = await buildPo({
      letter: story.letter,
      customerId: story.dealer.id,
      productId: product.id,
      description: product.nameEn,
      projectName: story.projectName,
      factoryNotes: story.factoryNotes,
      workflowId: defaultWorkflowId,
      soStatus: story.soStatus,
      poStatus: ProductionOrderStatus.READY_FOR_DELIVERY,
      quantity: 1,
      packagingExpectation: {
        expectedPieceCount: pieceCount,
        pieceLabels:
          story.pieceLabels ??
          Array.from({ length: pieceCount }, (_, i) => ({
            nameEn: `P10-${story.letter} Package ${i + 1}`,
            nameAr: `طرد P10-${story.letter} ${i + 1}`,
          })),
      },
      planByStage: packagingCompletePlan(pieceCount),
      currentStageCode: 'PACKAGING',
      progressPercent: 100,
    });
    if (!built) continue;

    await createPassInspection(
      built.poId,
      `QC-P10-${story.letter}`,
      `Passed — P10-${story.letter} outbound seed`,
    );

    const packSi = built.stageInstanceByCode.get('PACKAGING');
    if (!packSi) continue;

    const warehouseId = story.warehouseId ?? finWh.id;
    const lot = await seedFinLot({
      letter: story.letter,
      poId: built.poId,
      soId: built.soId,
      lineId: built.lineId,
      packSi,
      productId: built.productId,
      warehouseId,
      status: story.finStatus ?? InventoryLotStatus.AVAILABLE,
    });
    if (!lot) continue;

    if (story.extraAltWarehouseLot && finWhAlt) {
      await seedFinLot({
        letter: story.letter,
        poId: built.poId,
        soId: built.soId,
        lineId: built.lineId,
        packSi,
        productId: built.productId,
        warehouseId: finWhAlt.id,
        status: InventoryLotStatus.AVAILABLE,
        qrSuffix: `${story.letter}-ALT`,
        sourceTag: `${story.letter}-ALT`,
      });
    }

    const delivery = await seedDelivery({
      letter: story.letter,
      soId: built.soId,
      dealer: story.dealer,
      status: story.deliveryStatus,
      deliveryDate: story.deliveryDate,
      notes: story.factoryNotes,
      failureReason: story.failureReason,
      customerConfirmedAt: story.confirmOnSeed ? asOf : undefined,
      customerConfirmedById: story.confirmOnSeed ? balqisUserId : undefined,
      actualDeliveredAt: story.confirmOnSeed ? asOf : undefined,
    });

    await seedLoadPieces({
      deliveryId: delivery.id,
      lotId: lot.id,
      pieceCount,
      loadedCount: story.loadedCount ?? 0,
    });

    if (story.issueOnSeed) {
      await seedDeliveryIssue({
        letter: story.letter,
        deliveryId: delivery.id,
        lot,
      });
    }
    if (story.restoreOnSeed) {
      await seedDeliveryRestore({
        letter: story.letter,
        deliveryId: delivery.id,
        lot,
      });
      // Lot already AVAILABLE from seedFinLot after restore story.
      await prisma.inventoryLot.update({
        where: { id: lot.id },
        data: { status: InventoryLotStatus.AVAILABLE },
      });
    }
  }

  if (!finWhAlt) {
    console.log('  piece10: P10-I alt warehouse skipped — could not create FIN-P10');
  }

  console.log('  piece10: P10-A–L finished outbound / dealer receipt examples seeded');
}
