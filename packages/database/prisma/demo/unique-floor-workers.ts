/**
 * Ready-to-work floor orders for the four unique-task workers:
 * inspector, packer, driver, recovery1 (password 123).
 *
 * Prefix UF- so this can reseed without wiping P8–P11 UAT data.
 * plannedStart / deadlines use wall-clock now so My Tasks Due today lights up.
 */
import {
  ChecklistItemResult,
  DeliveryStatus,
  InventoryAllocationMode,
  InventoryLotStatus,
  InventoryTracking,
  InventoryTxType,
  ManufacturingComplexity,
  PrismaClient,
  ProductionOrderOriginType,
  ProductionOrderStatus,
  QualityResult,
  QuotationStatus,
  ReturnInventoryFate,
  ReturnLifecycleState,
  ReturnPieceDecision,
  ReturnPieceState,
  ReturnReason,
  ReturnRecoveryOutcome,
  SalesOrderLineSetupStatus,
  SalesOrderProductionSetupStatus,
  SalesOrderStatus,
  StageExecutionKind,
  StageInstanceStatus,
  TaskStatus,
  WipKitStatus,
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';
import { demoAsOf } from './clock';
import { defaultBinIdForWarehouse } from '../seed/warehouse-bins';
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
  requiresPhotos: boolean;
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

type BundleKey = 'QC-OPEN' | 'QC-DONE' | 'PK-OPEN' | 'PK-DONE' | 'RC-OPEN' | 'RC-DONE' | 'DL-OPEN' | 'DL-DONE';

function isExecutableStage(code: string, executionKind: string): boolean {
  if (String(executionKind).toUpperCase() === 'LOGISTICS') return false;
  if (String(code).toUpperCase() === 'DELIVERY') return false;
  return true;
}

function dealerAddress(d: DealerRef): string {
  return [d.street, d.area, d.city].filter(Boolean).join(', ') || 'Amman';
}

export async function seedUniqueFloorWorkerExamples(
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
  const oasis =
    opts.dealers.find((d) => d.username === 'oasis' || /oasis/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[1] ??
    opts.dealers[0];
  const nile =
    opts.dealers.find((d) => d.username === 'nile' || /nile/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[0];
  const balqis =
    opts.dealers.find((d) => d.username === 'balqis' || /balqis/i.test(d.nameEn ?? d.name ?? '')) ??
    nile ??
    opts.dealers[0];
  if (!oasis || !nile || !opts.products[0]) {
    console.log('  unique-floor skipped — missing dealers or products.');
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
                    requiresPhotos: true,
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
        requiresPhotos: n.stageDefinition.requiresPhotos,
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
    if (codes.has('INSPECTION') && codes.has('PACKAGING')) {
      product = p;
      defaultWorkflowId = wfId;
      break;
    }
  }
  if (!defaultWorkflowId) {
    console.log('  unique-floor skipped — no product with inspection + packaging.');
    return;
  }

  const recoveryWf = await prisma.productionWorkflow.findFirst({
    where: { code: 'RETURN_RECOVERY', archivedAt: null, status: { not: 'ARCHIVED' } },
    select: { id: true },
  });

  const catalogW = product.width != null ? Number(product.width) : 180;
  const catalogH = product.height != null ? Number(product.height) : 90;
  const catalogD = product.depth != null ? Number(product.depth) : 85;
  const unitPriceNum = Number(product.basePrice) || 2500;
  const unitPrice = money(unitPriceNum);
  const asOf = new Date();
  const clock = demoAsOf();
  const qty = 1;

  const workerUsers = await prisma.user.findMany({
    where: {
      username: {
        in: [
          'inspector',
          'packer',
          'driver',
          'recovery1',
          'carpenter',
          'assembler',
          'upholsterer',
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
  const inspectorId = byUsername.get('inspector') ?? opts.adminUserId;
  const packerId = byUsername.get('packer') ?? inspectorId;
  const recoveryId = byUsername.get('recovery1') ?? opts.adminUserId;
  const driverId = opts.driverId ?? byUsername.get('driver') ?? opts.adminUserId;

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

  const checklist = await prisma.qualityChecklistTemplate.findUnique({
    where: { code: 'FINAL_QC' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  const rawItem = await prisma.inventoryItem.findFirst({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
    orderBy: { sku: 'asc' },
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
      return { inventoryTracking: InventoryTracking.NONE, consumesSemiFinished: true };
    }
    if (code === 'PACKAGING' || code === 'PACK') {
      return {
        inventoryTracking: InventoryTracking.PRODUCES_FINISHED,
        consumesSemiFinished: true,
      };
    }
    if (code === 'INSPECTION') {
      return { inventoryTracking: InventoryTracking.NONE, consumesSemiFinished: true };
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

  async function wipeBundle(key: BundleKey) {
    const poNumber = `PO-UF-${key}`;
    const soNumber = `SO-UF-${key}`;
    const dlvNumber = `DLV-UF-${key}`;
    const retNumber = `RET-UF-${key}`;

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

    const ret = await prisma.returnRequest.findUnique({
      where: { number: retNumber },
      select: { id: true },
    });
    if (ret) {
      await prisma.returnRecoveryLine.deleteMany({ where: { returnPiece: { returnRequestId: ret.id } } });
      await prisma.returnPiece.updateMany({
        where: { returnRequestId: ret.id },
        data: { recoveryOrderId: null, productionOrderId: null },
      });
    }

    const po = await prisma.productionOrder.findUnique({
      where: { number: poNumber },
      select: { id: true },
    });
    if (po) {
      await prisma.productionOrder.update({
        where: { id: po.id },
        data: { returnPieceId: null, returnRequestId: null },
      });
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
        await prisma.returnRecoveryLine.deleteMany({ where: { productionTaskId: { in: taskIds } } });
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
        await prisma.productionOrderWorkflowSnapshotEdge.deleteMany({ where: { snapshotId: snap.id } });
        await prisma.productionOrderWorkflowSnapshotMaterialInput.deleteMany({
          where: { snapshotNode: { snapshotId: snap.id } },
        });
        await prisma.productionOrderWorkflowSnapshotNode.deleteMany({ where: { snapshotId: snap.id } });
        await prisma.productionOrderWorkflowSnapshot.delete({ where: { id: snap.id } });
      }
      await prisma.productionStageInstance.deleteMany({ where: { productionOrderId: po.id } });
      await prisma.document.deleteMany({ where: { productionOrderId: po.id } }).catch(() => undefined);
      await prisma.productionOrder.delete({ where: { id: po.id } });
    }

    if (ret) {
      await prisma.returnPiece.deleteMany({ where: { returnRequestId: ret.id } });
      await prisma.returnRequest.delete({ where: { id: ret.id } });
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
    await prisma.quotation.deleteMany({ where: { number: `QT-UF-${key}` } }).catch(() => undefined);
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

  async function buildPo(input: {
    key: BundleKey;
    customerId: string;
    productId: string;
    description: string;
    projectName: string;
    factoryNotes: string;
    workflowId: string | null;
    poStatus?: ProductionOrderStatus;
    soStatus?: SalesOrderStatus;
    originType?: ProductionOrderOriginType;
    currentStageCode?: string;
    progressPercent?: number;
    planByStage: Record<string, TaskPlan>;
    packagingExpectation?: {
      expectedPieceCount: number;
      pieceLabels: Array<{ nameEn: string; nameAr?: string }>;
    };
  }): Promise<BuiltPo | null> {
    await wipeBundle(input.key);
    const totals = lineTotals(qty, unitPriceNum, VAT);
    const soNumber = `SO-UF-${input.key}`;
    const qtNumber = `QT-UF-${input.key}`;
    const poNumber = `PO-UF-${input.key}`;
    const packExpect = input.packagingExpectation ?? {
      expectedPieceCount: 2,
      pieceLabels: [
        { nameEn: `UF ${input.key} crate 1`, nameAr: `طرد UF ${input.key} 1` },
        { nameEn: `UF ${input.key} crate 2`, nameAr: `طرد UF ${input.key} 2` },
      ],
    };
    const catalogDims = { width: catalogW, height: catalogH, depth: catalogD };

    const quote = await prisma.quotation.create({
      data: {
        number: qtNumber,
        version: 1,
        customerId: input.customerId,
        status: QuotationStatus.ACCEPTED,
        sentAt: asOf,
        acceptedAt: asOf,
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
              manufacturingComplexity: ManufacturingComplexity.STANDARD,
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
        status: input.soStatus ?? SalesOrderStatus.IN_PRODUCTION,
        externalOrderNumber: `UF-${input.key}`,
        projectName: input.projectName,
        requiredDeliveryDate: asOf,
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
              manufacturingComplexity: ManufacturingComplexity.STANDARD,
              sortOrder: 0,
            },
          ],
        },
      },
      include: { lines: true },
    });
    const line = so.lines[0]!;

    await prisma.salesOrderProductionSetup.create({
      data: {
        salesOrderId: so.id,
        status: SalesOrderProductionSetupStatus.RELEASED,
        releasedAt: asOf,
        releasedById: opts.adminUserId,
        lines: {
          create: {
            salesOrderLineId: line.id,
            status: SalesOrderLineSetupStatus.READY,
            manufacturingName: input.description,
            manufacturingComplexity: ManufacturingComplexity.STANDARD,
            catalogDimensions: catalogDims,
            orderDimensions: catalogDims,
            workflowId: input.workflowId ?? undefined,
            workflowConfirmedAt: input.workflowId ? asOf : undefined,
            packagingExpectation: packExpect,
            factoryNotes: input.factoryNotes,
            materialsReviewedAt: asOf,
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
        status: input.poStatus ?? ProductionOrderStatus.IN_PROGRESS,
        originType: input.originType ?? ProductionOrderOriginType.SALES_ORDER,
        createdById: opts.adminUserId,
        notes: input.factoryNotes,
        actualStartDate: asOf,
        plannedStartDate: asOf,
        plannedCompletionDate: asOf,
        requiredDeliveryDate: asOf,
        releasedToFactoryAt: asOf,
        releasedToFactoryById: opts.adminUserId,
        currentStageCode: input.currentStageCode ?? 'INSPECTION',
        progressPercent: input.progressPercent ?? 80,
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
      const consumesSemi = flags.consumesSemiFinished || Boolean(resolved.consumesSemiFinished);
      const isPack = n.stageCode === 'PACKAGING' || n.stageCode === 'PACK';
      const expectedPieces = isPack ? packExpect.expectedPieceCount : resolved.expectedPieceCount || 1;
      const packMeta = isPack
        ? { pieceLabels: packExpect.pieceLabels, expectedPieceCount: expectedPieces }
        : undefined;
      const executionKind = (
        ['PRODUCTION', 'QUALITY', 'LOGISTICS'].includes(String(n.executionKind).toUpperCase())
          ? n.executionKind.toUpperCase()
          : 'PRODUCTION'
      ) as StageExecutionKind;

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
          executionKind,
          requiresPhotos: n.requiresPhotos,
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
            number: `TSK-UF-${input.key}-${String(taskIdx).padStart(2, '0')}`,
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
            : status === TaskStatus.READY ||
                status === TaskStatus.READY_FOR_INSPECTION ||
                status === TaskStatus.BLOCKED
              ? status === TaskStatus.BLOCKED
                ? StageInstanceStatus.BLOCKED
                : StageInstanceStatus.READY
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
            plan.progressPercent ??
            (status === TaskStatus.COMPLETED
              ? 100
              : status === TaskStatus.IN_PROGRESS
                ? 40
                : status === TaskStatus.READY_FOR_INSPECTION
                  ? 100
                  : 0),
          assignedEmployeeId: assignee === undefined ? undefined : assignee,
          actualStart: plan.actualStart === undefined ? undefined : plan.actualStart,
          plannedStart: asOf,
          plannedCompletion: asOf,
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
            plan.progressPercent ??
            (status === TaskStatus.COMPLETED
              ? 100
              : status === TaskStatus.IN_PROGRESS
                ? 40
                : status === TaskStatus.READY_FOR_INSPECTION
                  ? 100
                  : 0),
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

  async function createReadyKit(args: {
    poId: string;
    key: BundleKey;
    producerCode: string;
    consumerCode: string;
    pieces: number;
    stageInstanceByCode: Map<string, string>;
    snapNodeByCode: Map<string, string>;
    productId: string;
    producingTaskId?: string | null;
  }) {
    const stageInstanceId = args.stageInstanceByCode.get(args.producerCode);
    if (!stageInstanceId || !semiWh) return null;
    const snapNodeId = args.snapNodeByCode.get(args.producerCode) ?? null;
    const nextId = args.snapNodeByCode.get(args.consumerCode);
    let outputItem = await prisma.inventoryItem.findFirst({
      where: { productId: args.productId, itemClass: 'SEMI_FINISHED_GOOD', archivedAt: null },
    });
    if (!outputItem) {
      outputItem = await prisma.inventoryItem.findFirst({
        where: { itemClass: 'SEMI_FINISHED_GOOD', archivedAt: null },
      });
    }
    if (!outputItem) return null;

    const qrCode = `WIP-UF-${args.key}-${args.producerCode}`;
    const orphanKits = await prisma.wipKit.findMany({ where: { qrCode }, select: { id: true } });
    if (orphanKits.length) {
      const ids = orphanKits.map((k) => k.id);
      await prisma.wipHandoff.deleteMany({ where: { kitId: { in: ids } } });
      await prisma.wipPiece.deleteMany({ where: { kitId: { in: ids } } });
      await prisma.wipKit.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.inventoryLot.deleteMany({ where: { qrCode } });

    const lot = await prisma.inventoryLot.create({
      data: {
        inventoryItemId: outputItem.id,
        warehouseId: semiWh.id,
        locationId: await defaultBinIdForWarehouse(prisma, semiWh.id),
        quantity: args.pieces,
        status: 'AVAILABLE',
        productionOrderId: args.poId,
        stageInstanceId,
        qrCode,
        producedAt: asOf,
      },
    });
    const kit = await prisma.wipKit.create({
      data: {
        productionOrderId: args.poId,
        stageInstanceId,
        snapshotNodeId: snapNodeId,
        producingTaskId: args.producingTaskId ?? null,
        status: WipKitStatus.READY,
        expectedPieceCount: args.pieces,
        qrCode,
        warehouseId: semiWh.id,
        locationId: await defaultBinIdForWarehouse(prisma, semiWh.id),
        nextSnapshotNodeIds: nextId ? [nextId] : [],
      },
    });
    await prisma.wipPiece.create({
      data: {
        kitId: kit.id,
        sortOrder: 0,
        label: 'Piece 1',
        inventoryLotId: lot.id,
      },
    });
    return { kit, lot, qrCode };
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
    key: BundleKey;
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
    const sourceKey = `FINISHED_GOODS_RECEIPT:${args.poId}:${args.packSi}:UF-${args.key}`;
    await prisma.inventoryTransaction.create({
      data: {
        number: `ITX-UF-${args.key}-FIN`,
        type: InventoryTxType.FINISHED_GOODS_RECEIPT,
        inventoryItemId: fgItem.id,
        warehouseId: finWh.id,
        locationId: await defaultBinIdForWarehouse(prisma, finWh.id),
        quantity: money(1),
        createdById: opts.adminUserId,
        createdAt: asOf,
        referenceType: 'ProductionOrder',
        referenceId: args.poId,
        idempotencyKey: sourceKey,
        notes: `UF ${args.key} finished receipt`,
      },
    });
    return prisma.inventoryLot.create({
      data: {
        inventoryItemId: fgItem.id,
        warehouseId: finWh.id,
        locationId: await defaultBinIdForWarehouse(prisma, finWh.id),
        quantity: 1,
        status: args.status,
        allocationMode: InventoryAllocationMode.ORDER_ALLOCATED,
        productionOrderId: args.poId,
        salesOrderId: args.soId,
        salesOrderLineId: args.lineId,
        stageInstanceId: args.packSi,
        qrCode: `FIN-UF-${args.key}`,
        sourceKey,
        producedAt: asOf,
      },
    });
  }

  // ── Inspector — ready to inspect ──────────────────────────────────────────
  await buildPo({
    key: 'QC-OPEN',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'UF inspector — ready to inspect',
    factoryNotes: 'Unique-floor UAT: Inspection READY for inspector',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.QUALITY_CHECK,
    currentStageCode: 'INSPECTION',
    progressPercent: 80,
    planByStage: {
      ...priorProductionDone(),
      INSPECTION: {
        status: TaskStatus.READY_FOR_INSPECTION,
        stageStatus: StageInstanceStatus.READY,
        progressPercent: 100,
        assignUsername: 'inspector',
        inspectionStatus: 'READY_FOR_INSPECTION',
        notes: 'UF test: pass or fail this inspection',
      },
      PACKAGING: { status: TaskStatus.NOT_STARTED, stageStatus: StageInstanceStatus.PENDING },
    },
  });

  const qcDone = await buildPo({
    key: 'QC-DONE',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'UF inspector — view-only done',
    factoryNotes: 'Unique-floor UAT: Inspection COMPLETED (view-only)',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.READY_FOR_PACKAGING,
    currentStageCode: 'PACKAGING',
    progressPercent: 90,
    planByStage: {
      ...priorProductionDone(),
      INSPECTION: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'inspector',
        inspectionStatus: 'PASSED',
        notes: 'UF test: completed inspection — should be view-only',
      },
      PACKAGING: { status: TaskStatus.NOT_STARTED, stageStatus: StageInstanceStatus.PENDING },
    },
  });
  if (qcDone) {
    await createPassInspection(qcDone.poId, 'QC-UF-QC-DONE', 'Passed — unique-floor inspector done');
  }

  // ── Packer — take-in then confirm packages ────────────────────────────────
  const pkOpen = await buildPo({
    key: 'PK-OPEN',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'UF packer — take-in then pack',
    factoryNotes: 'Unique-floor UAT: Packaging READY — SEMI kit waiting take-in',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.READY_FOR_PACKAGING,
    currentStageCode: 'PACKAGING',
    progressPercent: 90,
    planByStage: {
      ...priorProductionDone(),
      INSPECTION: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'inspector',
        inspectionStatus: 'PASSED',
      },
      PACKAGING: {
        status: TaskStatus.READY,
        stageStatus: StageInstanceStatus.READY,
        assignUsername: 'packer',
        notes: 'UF test: receive SEMI kit then confirm packages',
      },
    },
  });
  if (pkOpen) {
    await createPassInspection(pkOpen.poId, 'QC-UF-PK-OPEN', 'Passed — unique-floor packer open');
    const producerCode = pkOpen.snapNodeByCode.has('CARPENTRY') ? 'CARPENTRY' : 'ASSEMBLY';
    await createReadyKit({
      poId: pkOpen.poId,
      key: 'PK-OPEN',
      producerCode,
      consumerCode: 'PACKAGING',
      pieces: 1,
      stageInstanceByCode: pkOpen.stageInstanceByCode,
      snapNodeByCode: pkOpen.snapNodeByCode,
      productId: pkOpen.productId,
      producingTaskId: pkOpen.tasksByCode.get(producerCode),
    });
  }

  const pkDone = await buildPo({
    key: 'PK-DONE',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'UF packer — view-only done',
    factoryNotes: 'Unique-floor UAT: Packaging COMPLETED (view-only)',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.READY_FOR_DELIVERY,
    soStatus: SalesOrderStatus.READY_FOR_DELIVERY,
    currentStageCode: 'PACKAGING',
    progressPercent: 100,
    planByStage: {
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
        completedQty: 1,
        notes: 'UF test: completed packaging — should be view-only',
      },
    },
  });
  if (pkDone) {
    await createPassInspection(pkDone.poId, 'QC-UF-PK-DONE', 'Passed — unique-floor packer done');
    const packSi = pkDone.stageInstanceByCode.get('PACKAGING');
    if (packSi) {
      await seedFinLot({
        key: 'PK-DONE',
        poId: pkDone.poId,
        soId: pkDone.soId,
        lineId: pkDone.lineId,
        packSi,
        productId: pkDone.productId,
        status: InventoryLotStatus.AVAILABLE,
      });
    }
  }

  // ── Recovery — dismantle & recover ────────────────────────────────────────
  if (recoveryWf) {
    const rcOpen = await buildPo({
      key: 'RC-OPEN',
      customerId: balqis.id,
      productId: product.id,
      description: product.nameEn,
      projectName: 'UF recovery — dismantle open',
      factoryNotes: 'Unique-floor UAT: DISMANTLE_RECOVER READY for recovery1',
      workflowId: recoveryWf.id,
      poStatus: ProductionOrderStatus.IN_PROGRESS,
      originType: ProductionOrderOriginType.RETURN_RECOVERY,
      soStatus: SalesOrderStatus.DELIVERED,
      currentStageCode: 'DISMANTLE_RECOVER',
      progressPercent: 10,
      planByStage: {
        DISMANTLE_RECOVER: {
          status: TaskStatus.READY,
          stageStatus: StageInstanceStatus.READY,
          assignUsername: 'recovery1',
          notes: 'UF test: record recovered materials then finish (photos required)',
        },
      },
    });
    if (rcOpen) {
      await prisma.delivery.create({
        data: {
          number: 'DLV-UF-RC-OPEN',
          salesOrderId: rcOpen.soId,
          customerId: balqis.id,
          deliveryAddress: dealerAddress(balqis),
          deliveryDate: clock,
          driverId,
          status: DeliveryStatus.DELIVERED,
          recipientName: balqis.nameEn ?? balqis.name ?? null,
          notes: 'UF recovery original delivery',
          actualDeliveredAt: clock,
          items: { create: [{ description: product.nameEn, quantity: money(1) }] },
        },
      });
      const ret = await prisma.returnRequest.create({
        data: {
          number: 'RET-UF-RC-OPEN',
          customerId: balqis.id,
          salesOrderId: rcOpen.soId,
          productDesc: product.nameEn,
          quantity: money(1),
          reason: ReturnReason.MANUFACTURING_DEFECT,
          description: 'Unique-floor UAT recovery open',
          approvalStatus: 'APPROVED',
          physicalStatus: 'RETURNED',
          lifecycleState: ReturnLifecycleState.REWORKING,
          inventoryFate: ReturnInventoryFate.SCRAP,
          receivedAt: asOf,
          receivedById: opts.adminUserId,
        },
      });
      const piece = await prisma.returnPiece.create({
        data: {
          returnRequestId: ret.id,
          pieceNo: 1,
          code: 'RET-UF-RC-OPEN-P1',
          salesOrderId: rcOpen.soId,
          salesOrderLineId: rcOpen.lineId,
          productId: product.id,
          productDesc: product.nameEn,
          state: ReturnPieceState.IN_PROGRESS,
          decision: ReturnPieceDecision.SCRAP_RECOVERY,
          outboundEligible: false,
          receivedAt: asOf,
          recoveryOrderId: rcOpen.poId,
        },
      });
      await prisma.productionOrder.update({
        where: { id: rcOpen.poId },
        data: { returnRequestId: ret.id, returnPieceId: piece.id },
      });
    }

    const rcDone = await buildPo({
      key: 'RC-DONE',
      customerId: balqis.id,
      productId: product.id,
      description: product.nameEn,
      projectName: 'UF recovery — view-only done',
      factoryNotes: 'Unique-floor UAT: DISMANTLE_RECOVER COMPLETED (view-only)',
      workflowId: recoveryWf.id,
      poStatus: ProductionOrderStatus.COMPLETED,
      originType: ProductionOrderOriginType.RETURN_RECOVERY,
      soStatus: SalesOrderStatus.DELIVERED,
      currentStageCode: 'DISMANTLE_RECOVER',
      progressPercent: 100,
      planByStage: {
        DISMANTLE_RECOVER: {
          status: TaskStatus.COMPLETED,
          stageStatus: StageInstanceStatus.COMPLETED,
          progressPercent: 100,
          assignUsername: 'recovery1',
          notes: 'UF test: completed recovery — should be view-only',
        },
      },
    });
    if (rcDone) {
      await prisma.delivery.create({
        data: {
          number: 'DLV-UF-RC-DONE',
          salesOrderId: rcDone.soId,
          customerId: balqis.id,
          deliveryAddress: dealerAddress(balqis),
          deliveryDate: clock,
          driverId,
          status: DeliveryStatus.DELIVERED,
          recipientName: balqis.nameEn ?? balqis.name ?? null,
          notes: 'UF recovery original delivery',
          actualDeliveredAt: clock,
          items: { create: [{ description: product.nameEn, quantity: money(1) }] },
        },
      });
      const ret = await prisma.returnRequest.create({
        data: {
          number: 'RET-UF-RC-DONE',
          customerId: balqis.id,
          salesOrderId: rcDone.soId,
          productDesc: product.nameEn,
          quantity: money(1),
          reason: ReturnReason.MANUFACTURING_DEFECT,
          description: 'Unique-floor UAT recovery done',
          approvalStatus: 'APPROVED',
          physicalStatus: 'RESOLVED',
          lifecycleState: ReturnLifecycleState.SCRAPPED,
          inventoryFate: ReturnInventoryFate.SCRAP,
          receivedAt: asOf,
          receivedById: opts.adminUserId,
        },
      });
      const piece = await prisma.returnPiece.create({
        data: {
          returnRequestId: ret.id,
          pieceNo: 1,
          code: 'RET-UF-RC-DONE-P1',
          salesOrderId: rcDone.soId,
          salesOrderLineId: rcDone.lineId,
          productId: product.id,
          productDesc: product.nameEn,
          state: ReturnPieceState.RECOVERED,
          decision: ReturnPieceDecision.SCRAP_RECOVERY,
          outboundEligible: false,
          receivedAt: asOf,
          recoveryOrderId: rcDone.poId,
        },
      });
      await prisma.productionOrder.update({
        where: { id: rcDone.poId },
        data: { returnRequestId: ret.id, returnPieceId: piece.id, actualCompletionDate: asOf },
      });
      const destWh = rawWh ?? finWh;
      await prisma.returnRecoveryLine.create({
        data: {
          returnPieceId: piece.id,
          productionTaskId: rcDone.tasksByCode.get('DISMANTLE_RECOVER') ?? null,
          inventoryItemId: rawItem?.id ?? null,
          label: rawItem?.nameEn ?? 'Recovered wood',
          quantity: money(1),
          unit: rawItem?.unit ?? 'pcs',
          outcome: ReturnRecoveryOutcome.RECOVER_TO_INVENTORY,
          destinationWarehouseId: destWh?.id ?? null,
          recordedById: recoveryId,
          recordedAt: asOf,
          postedAt: asOf,
          idempotencyKey: 'uf-rc-done-line-1',
        },
      });
    }
  } else {
    console.log('  unique-floor recovery skipped — RETURN_RECOVERY workflow missing.');
  }

  // ── Driver — load sheet (not My Tasks) ────────────────────────────────────
  if (finWh) {
    const dlOpen = await buildPo({
      key: 'DL-OPEN',
      customerId: balqis.id,
      productId: product.id,
      description: product.nameEn,
      projectName: 'UF driver — ready to load',
      factoryNotes: 'Unique-floor UAT: delivery READY — load 2 packages',
      workflowId: defaultWorkflowId,
      poStatus: ProductionOrderStatus.READY_FOR_DELIVERY,
      soStatus: SalesOrderStatus.READY_FOR_DELIVERY,
      currentStageCode: 'PACKAGING',
      progressPercent: 100,
      packagingExpectation: {
        expectedPieceCount: 2,
        pieceLabels: [
          { nameEn: 'UF driver crate 1', nameAr: 'طرد السائق 1' },
          { nameEn: 'UF driver crate 2', nameAr: 'طرد السائق 2' },
        ],
      },
      planByStage: {
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
          completedQty: 1,
        },
      },
    });
    if (dlOpen) {
      await createPassInspection(dlOpen.poId, 'QC-UF-DL-OPEN', 'Passed — unique-floor driver open');
      const packSi = dlOpen.stageInstanceByCode.get('PACKAGING');
      if (packSi) {
        const lot = await seedFinLot({
          key: 'DL-OPEN',
          poId: dlOpen.poId,
          soId: dlOpen.soId,
          lineId: dlOpen.lineId,
          packSi,
          productId: dlOpen.productId,
          status: InventoryLotStatus.AVAILABLE,
        });
        if (lot) {
          const delivery = await prisma.delivery.create({
            data: {
              number: 'DLV-UF-DL-OPEN',
              salesOrderId: dlOpen.soId,
              customerId: balqis.id,
              deliveryAddress: dealerAddress(balqis),
              latitude: balqis.lat ?? null,
              longitude: balqis.lng ?? null,
              deliveryDate: asOf,
              driverId,
              vehicle: 'Hyundai H-1',
              status: DeliveryStatus.READY,
              recipientName: balqis.nameEn ?? balqis.name ?? null,
              notes: 'UF test: check both packages onto the truck',
              items: { create: [{ description: product.nameEn, quantity: money(1) }] },
            },
          });
          await prisma.deliveryLoadPiece.createMany({
            data: [
              { deliveryId: delivery.id, inventoryLotId: lot.id, pieceIndex: 1 },
              { deliveryId: delivery.id, inventoryLotId: lot.id, pieceIndex: 2 },
            ],
          });
        }
      }
    }

    const dlDone = await buildPo({
      key: 'DL-DONE',
      customerId: oasis.id,
      productId: product.id,
      description: product.nameEn,
      projectName: 'UF driver — history',
      factoryNotes: 'Unique-floor UAT: delivery DELIVERED (history)',
      workflowId: defaultWorkflowId,
      poStatus: ProductionOrderStatus.COMPLETED,
      soStatus: SalesOrderStatus.DELIVERED,
      currentStageCode: 'PACKAGING',
      progressPercent: 100,
      planByStage: {
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
          completedQty: 1,
        },
      },
    });
    if (dlDone) {
      await createPassInspection(dlDone.poId, 'QC-UF-DL-DONE', 'Passed — unique-floor driver done');
      const packSi = dlDone.stageInstanceByCode.get('PACKAGING');
      if (packSi) {
        const lot = await seedFinLot({
          key: 'DL-DONE',
          poId: dlDone.poId,
          soId: dlDone.soId,
          lineId: dlDone.lineId,
          packSi,
          productId: dlDone.productId,
          status: InventoryLotStatus.AVAILABLE,
        });
        if (lot) {
          const delivery = await prisma.delivery.create({
            data: {
              number: 'DLV-UF-DL-DONE',
              salesOrderId: dlDone.soId,
              customerId: oasis.id,
              deliveryAddress: dealerAddress(oasis),
              latitude: oasis.lat ?? null,
              longitude: oasis.lng ?? null,
              deliveryDate: clock,
              driverId,
              vehicle: 'Hyundai H-1',
              status: DeliveryStatus.DELIVERED,
              recipientName: oasis.nameEn ?? oasis.name ?? null,
              notes: 'UF test: already delivered',
              actualDeliveredAt: clock,
              items: { create: [{ description: product.nameEn, quantity: money(1) }] },
            },
          });
          await prisma.deliveryLoadPiece.createMany({
            data: [
              {
                deliveryId: delivery.id,
                inventoryLotId: lot.id,
                pieceIndex: 1,
                loadedAt: asOf,
                loadedById: driverId,
              },
              {
                deliveryId: delivery.id,
                inventoryLotId: lot.id,
                pieceIndex: 2,
                loadedAt: asOf,
                loadedById: driverId,
              },
            ],
          });
        }
      }
    }
  } else {
    console.log('  unique-floor delivery skipped — no FINISHED_GOODS warehouse.');
  }

  console.log('  unique-floor: inspector / packer / recovery1 / driver test orders seeded');
  console.log('  logins (password 123): inspector | packer | recovery1 | driver');
}
