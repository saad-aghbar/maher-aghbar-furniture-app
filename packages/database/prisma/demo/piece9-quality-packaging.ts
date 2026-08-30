/**
 * Piece 9 deterministic quality / rework / packaging examples (SO/PO-P9-A…L).
 * Pattern mirrors piece8-factory-floor: wipe by distinctive P9 numbers, SO+setup+PO
 * with workflow snapshot, stage instances, and tasks.
 * Workers: inspector / upholsterer / packer (password 123 elsewhere).
 */
import {
  BlockerCategory,
  ChecklistItemResult,
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
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';
import { addDays, demoAsOf } from './clock';
import {
  loadProductInventoryOutputs,
  resolveDemoSnapshotInventory,
} from './inventory-lifecycle';

type DealerRef = { id: string; code: string; name?: string; nameEn?: string; username?: string };
type ProductRef = {
  id: string;
  sku: string;
  nameEn: string;
  basePrice: unknown;
  width?: unknown;
  height?: unknown;
  depth?: unknown;
  workflowCode?: string;
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

export async function seedPiece9QualityPackagingExamples(
  prisma: PrismaClient,
  opts: {
    dealers: DealerRef[];
    products: ProductRef[];
    adminUserId: string;
    workerIds?: string[];
    workers?: WorkerRef[];
  },
) {
  const oasis =
    opts.dealers.find((d) => d.username === 'oasis' || /oasis/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[1] ??
    opts.dealers[0];
  const nile =
    opts.dealers.find((d) => d.username === 'nile' || /nile/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[0];
  if (!oasis || !nile || !opts.products[0]) {
    console.log('  Piece 9 skipped — missing dealers or products.');
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

  // Prefer product whose workflow includes UPHOLSTERY + INSPECTION + PACKAGING.
  let product = opts.products[0]!;
  let defaultWorkflowId = await workflowIdForProduct(product.id);
  for (const p of opts.products) {
    const wfId = await workflowIdForProduct(p.id);
    if (!wfId) continue;
    const compiled = await loadWorkflowNodes(wfId);
    const codes = new Set(compiled?.nodes.map((n) => n.stageCode) ?? []);
    if (codes.has('UPHOLSTERY') && codes.has('INSPECTION') && codes.has('PACKAGING')) {
      product = p;
      defaultWorkflowId = wfId;
      break;
    }
  }
  if (!defaultWorkflowId) {
    console.log('  Piece 9 skipped — no product with active workflow.');
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
          'inspector2',
          'upholsterer',
          'upholsterer2',
          'packer',
          'packer2',
          'carpenter',
          'assembler',
          'foam',
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
  const upholstererId = byUsername.get('upholsterer') ?? inspectorId;
  const packerId = byUsername.get('packer') ?? inspectorId;

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

  const fabricItem = await prisma.inventoryItem.findFirst({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL', category: 'FABRIC' },
    orderBy: { sku: 'asc' },
  });
  const rawFallback = await prisma.inventoryItem.findFirst({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
    orderBy: { sku: 'asc' },
  });
  const fabricOrRaw = fabricItem ?? rawFallback;
  const fabricUnit = Math.max(Number(fabricOrRaw?.standardCost) || 0, 12);

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

  /** All typical production stages before Inspection marked COMPLETED. */
  function priorProductionDone(): Record<string, TaskPlan> {
    return {
      MATERIAL_PREP: donePlan(),
      CARPENTRY: donePlan('carpenter'),
      FOAM: donePlan('foam'),
      UPHOLSTERY: donePlan('upholsterer'),
      ASSEMBLY: donePlan('assembler'),
      PAINTING: donePlan(),
    };
  }

  async function wipeBundle(letter: string) {
    const poNumber = `PO-P9-${letter}`;
    const soNumber = `SO-P9-${letter}`;
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
    await prisma.quotation.deleteMany({ where: { number: `QT-P9-${letter}` } }).catch(() => undefined);
  }

  type BuiltPo = {
    poId: string;
    soId: string;
    lineId: string;
    tasksByCode: Map<string, string>;
    stageInstanceByCode: Map<string, string>;
    snapNodeByCode: Map<string, string>;
    productId: string;
    stageDefByCode: Map<string, string>;
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
    poStatus?: ProductionOrderStatus;
    quantity?: number;
    planByStage: Record<string, TaskPlan>;
    complexity?: ManufacturingComplexity;
    orderDimensions?: { width: number; height: number; depth: number };
    catalogDimensions?: { width: number; height: number; depth: number };
    requestedFabricLabel?: string | null;
    packagingExpectation?: PackagingExpectation;
    currentStageCode?: string;
    progressPercent?: number;
  }): Promise<BuiltPo | null> {
    await wipeBundle(input.letter);
    const qty = input.quantity ?? 1;
    const totals = lineTotals(qty, unitPriceNum, VAT);
    const soNumber = `SO-P9-${input.letter}`;
    const qtNumber = `QT-P9-${input.letter}`;
    const poNumber = `PO-P9-${input.letter}`;
    const complexity = input.complexity ?? ManufacturingComplexity.STANDARD;
    const orderDims =
      input.orderDimensions ?? { width: catalogW, height: catalogH, depth: catalogD };
    const catalogDims =
      input.catalogDimensions ?? { width: catalogW, height: catalogH, depth: catalogD };
    const packExpect = input.packagingExpectation ?? {
      expectedPieceCount: 1,
      pieceLabels: [{ nameEn: 'Package 1', nameAr: 'طرد 1' }],
    };
    const orderSpec = {
      productId: input.productId,
      productName: input.description,
      quantity: qty,
      manufacturingComplexity: complexity,
      catalogDimensions: catalogDims,
      requestedDimensions: orderDims,
      ...(input.requestedFabricLabel
        ? { fabric: { type: input.requestedFabricLabel, label: input.requestedFabricLabel } }
        : {}),
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
        status: SalesOrderStatus.IN_PRODUCTION,
        externalOrderNumber: `P9-${input.letter}`,
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
            needsReview: Boolean(input.requestedFabricLabel),
            sortOrder: 0,
            requestedFabricLabel: input.requestedFabricLabel ?? undefined,
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

    const poStatus = input.poStatus ?? ProductionOrderStatus.IN_PROGRESS;
    const po = await prisma.productionOrder.create({
      data: {
        number: poNumber,
        salesOrderId: so.id,
        salesOrderLineId: line.id,
        customerId: input.customerId,
        productId: input.productId,
        productDescription: input.description,
        quantity: qty,
        status: poStatus,
        createdById: opts.adminUserId,
        notes: input.factoryNotes,
        actualStartDate: asOf,
        plannedStartDate: asOf,
        currentStageCode: input.currentStageCode ?? 'INSPECTION',
        progressPercent: input.progressPercent ?? 70,
      },
    });

    const tasksByCode = new Map<string, string>();
    const stageInstanceByCode = new Map<string, string>();
    const snapNodeByCode = new Map<string, string>();
    const stageDefByCode = new Map<string, string>();

    if (!input.workflowId) {
      return {
        poId: po.id,
        soId: so.id,
        lineId: line.id,
        tasksByCode,
        stageInstanceByCode,
        snapNodeByCode,
        productId: input.productId,
        stageDefByCode,
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
        stageDefByCode,
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
      stageDefByCode.set(n.stageCode, n.stageDefinitionId);

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
        const taskNumber = `TSK-P9-${input.letter}-${String(taskIdx).padStart(2, '0')}`;
        const task = await prisma.productionTask.create({
          data: {
            number: taskNumber,
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
          : status === TaskStatus.IN_PROGRESS ||
              status === TaskStatus.READY ||
              status === TaskStatus.READY_FOR_INSPECTION ||
              status === TaskStatus.BLOCKED
            ? status === TaskStatus.BLOCKED
              ? StageInstanceStatus.BLOCKED
              : status === TaskStatus.IN_PROGRESS
                ? StageInstanceStatus.IN_PROGRESS
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
      stageDefByCode,
    };
  }

  async function createPassInspection(poId: string, number: string, notes: string, at?: Date) {
    return prisma.qualityInspection.create({
      data: {
        number,
        productionOrderId: poId,
        stageCode: 'INSPECTION',
        inspectorId,
        inspectedAt: at ?? asOf,
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

  async function createFailInspection(args: {
    poId: string;
    number: string;
    notes: string;
    at?: Date;
    defectDescription?: string;
  }) {
    return prisma.qualityInspection.create({
      data: {
        number: args.number,
        productionOrderId: args.poId,
        stageCode: 'INSPECTION',
        inspectorId,
        inspectedAt: args.at ?? asOf,
        result: QualityResult.FAILED_REWORK_REQUIRED,
        notes: args.notes,
        items: checklist
          ? {
              create: checklist.items.map((it) => ({
                checklistCode: it.code,
                label: it.labelEn,
                result:
                  it.code === 'FABRIC' || it.code === 'STITCH'
                    ? ChecklistItemResult.FAIL
                    : ChecklistItemResult.PASS,
              })),
            }
          : undefined,
        defects: {
          create: {
            description:
              args.defectDescription ?? 'Upholstery seam puckering on inside arm — P9 seed',
            stageCode: 'UPHOLSTERY',
            severity: 'MAJOR',
            correctiveAction: 'Re-stitch arm and re-inspect',
          },
        },
      },
    });
  }

  // ── P9-A — Ready for Inspection ───────────────────────────────────────────
  await buildPo({
    letter: 'A',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P9-A Ready for Inspection',
    factoryNotes: 'P9-A: prior production COMPLETED — Inspection READY_FOR_INSPECTION',
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
      },
      PACKAGING: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
      },
    },
  });

  // ── P9-B — Inspection PASS → Packaging READY ──────────────────────────────
  const b = await buildPo({
    letter: 'B',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P9-B QC PASS → Packaging READY',
    factoryNotes: 'P9-B: Inspection PASSED — Packaging READY for packer',
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
      },
    },
  });
  if (b) {
    await createPassInspection(b.poId, 'QC-P9-B', 'Final inspection passed — seed P9-B');
  }

  // ── P9-C — Open FAIL + ReworkRequest AWAITING (Upholstery) ─────────────────
  const c = await buildPo({
    letter: 'C',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P9-C FAIL → Rework AWAITING',
    factoryNotes: 'P9-C: QC FAIL Upholstery — ReworkRequest AWAITING_STAGE',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.ON_HOLD,
    currentStageCode: 'INSPECTION',
    progressPercent: 75,
    planByStage: {
      ...priorProductionDone(),
      INSPECTION: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'inspector',
        inspectionStatus: 'FAILED',
      },
      PACKAGING: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
      },
      UPHOLSTERY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'upholsterer',
      },
    },
  });
  if (c) {
    const fail = await createFailInspection({
      poId: c.poId,
      number: 'QC-P9-C',
      notes: 'Failed — upholstery seam defect',
    });
    const uphSi = c.stageInstanceByCode.get('UPHOLSTERY');
    await prisma.reworkRequest.create({
      data: {
        number: 'RW-P9-C',
        productionOrderId: c.poId,
        inspectionId: fail.id,
        description: 'Re-stitch inside arm (Upholstery) — ready for upholsterer',
        status: 'AWAITING_STAGE',
        reentryStageInstanceId: uphSi ?? undefined,
        assignedToId: upholstererId,
      },
    });
  }

  // ── P9-D — Rework IN_PROGRESS assigned upholsterer ────────────────────────
  const d = await buildPo({
    letter: 'D',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P9-D Rework IN_PROGRESS',
    factoryNotes: 'P9-D: Rework IN_PROGRESS — upholsterer assigned',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.IN_PROGRESS,
    currentStageCode: 'UPHOLSTERY',
    progressPercent: 72,
    planByStage: {
      ...priorProductionDone(),
      INSPECTION: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'inspector',
        inspectionStatus: 'FAILED',
      },
      PACKAGING: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
      },
    },
  });
  if (d) {
    const fail = await createFailInspection({
      poId: d.poId,
      number: 'QC-P9-D',
      notes: 'Failed — upholstery rework started',
      at: addDays(asOf, -1),
    });
    const uphSi = d.stageInstanceByCode.get('UPHOLSTERY');
    const uphDef = d.stageDefByCode.get('UPHOLSTERY');
    const rework = await prisma.reworkRequest.create({
      data: {
        number: 'RW-P9-D',
        productionOrderId: d.poId,
        inspectionId: fail.id,
        description: 'Re-stitch arm — in progress',
        status: 'IN_PROGRESS',
        reentryStageInstanceId: uphSi ?? undefined,
        assignedToId: upholstererId,
      },
    });
    if (uphSi && uphDef) {
      await prisma.productionStageInstance.update({
        where: { id: uphSi },
        data: { status: StageInstanceStatus.READY, progressPercent: 40, actualEnd: null },
      });
      await prisma.productionTask.create({
        data: {
          number: 'TSK-P9-D-RW',
          productionOrderId: d.poId,
          stageDefinitionId: uphDef,
          stageInstanceId: uphSi,
          name: 'Upholstery rework',
          description: 'P9-D rework stitching',
          status: TaskStatus.IN_PROGRESS,
          progressPercent: 40,
          isRework: true,
          reworkRequestId: rework.id,
          assignedEmployeeId: upholstererId,
          actualStart: asOf,
          estimatedMinutes: 60,
          targetQty: 1,
        },
      });
    }
  }

  // ── P9-E — Rework COMPLETED + reinspection READY ──────────────────────────
  const e = await buildPo({
    letter: 'E',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P9-E Rework done → Reinspection',
    factoryNotes: 'P9-E: Rework COMPLETED — Inspection READY_FOR_INSPECTION (reinspection)',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.QUALITY_CHECK,
    currentStageCode: 'INSPECTION',
    progressPercent: 78,
    planByStage: {
      ...priorProductionDone(),
      INSPECTION: {
        status: TaskStatus.READY_FOR_INSPECTION,
        stageStatus: StageInstanceStatus.READY,
        progressPercent: 0,
        assignUsername: 'inspector',
        inspectionStatus: 'PENDING_REINSPECTION',
      },
      PACKAGING: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
      },
    },
  });
  if (e) {
    const fail = await createFailInspection({
      poId: e.poId,
      number: 'QC-P9-E-FAIL',
      notes: 'First fail before rework',
      at: addDays(asOf, -3),
    });
    const uphSi = e.stageInstanceByCode.get('UPHOLSTERY');
    const uphDef = e.stageDefByCode.get('UPHOLSTERY');
    const rework = await prisma.reworkRequest.create({
      data: {
        number: 'RW-P9-E',
        productionOrderId: e.poId,
        inspectionId: fail.id,
        description: 'Rework completed — awaiting reinspection',
        status: 'COMPLETED',
        reentryStageInstanceId: uphSi ?? undefined,
        assignedToId: upholstererId,
        completedAt: addDays(asOf, -1),
      },
    });
    if (uphSi && uphDef) {
      await prisma.productionTask.create({
        data: {
          number: 'TSK-P9-E-RW',
          productionOrderId: e.poId,
          stageDefinitionId: uphDef,
          stageInstanceId: uphSi,
          name: 'Upholstery rework',
          description: 'P9-E completed rework',
          status: TaskStatus.COMPLETED,
          progressPercent: 100,
          isRework: true,
          reworkRequestId: rework.id,
          assignedEmployeeId: upholstererId,
          actualStart: addDays(asOf, -2),
          actualCompletion: addDays(asOf, -1),
          estimatedMinutes: 60,
          targetQty: 1,
          completedQty: 1,
        },
      });
    }
  }

  // ── P9-F — Two failed inspections + open rework ───────────────────────────
  const f = await buildPo({
    letter: 'F',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P9-F Two fails + open rework',
    factoryNotes: 'P9-F: two failed QC history + open rework after second fail',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.ON_HOLD,
    currentStageCode: 'UPHOLSTERY',
    progressPercent: 70,
    planByStage: {
      ...priorProductionDone(),
      INSPECTION: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'inspector',
        inspectionStatus: 'FAILED',
      },
      PACKAGING: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
      },
    },
  });
  if (f) {
    const fail1 = await createFailInspection({
      poId: f.poId,
      number: 'QC-P9-F-1',
      notes: 'First fail — historical',
      at: addDays(asOf, -7),
      defectDescription: 'First fail — fabric pull at arm',
    });
    const uphSi = f.stageInstanceByCode.get('UPHOLSTERY');
    const uphDef = f.stageDefByCode.get('UPHOLSTERY');
    const rw1 = await prisma.reworkRequest.create({
      data: {
        number: 'RW-P9-F-1',
        productionOrderId: f.poId,
        inspectionId: fail1.id,
        description: 'First rework completed historically',
        status: 'COMPLETED',
        reentryStageInstanceId: uphSi ?? undefined,
        assignedToId: upholstererId,
        completedAt: addDays(asOf, -5),
        createdAt: addDays(asOf, -7),
      },
    });
    if (uphSi && uphDef) {
      await prisma.productionTask.create({
        data: {
          number: 'TSK-P9-F-RW1',
          productionOrderId: f.poId,
          stageDefinitionId: uphDef,
          stageInstanceId: uphSi,
          name: 'Upholstery rework #1',
          status: TaskStatus.COMPLETED,
          progressPercent: 100,
          isRework: true,
          reworkRequestId: rw1.id,
          assignedEmployeeId: upholstererId,
          actualCompletion: addDays(asOf, -5),
          estimatedMinutes: 45,
          targetQty: 1,
          completedQty: 1,
        },
      });
    }
    const fail2 = await createFailInspection({
      poId: f.poId,
      number: 'QC-P9-F-2',
      notes: 'Second fail — still open',
      at: addDays(asOf, -1),
      defectDescription: 'Second fail — stitch still uneven at arm',
    });
    await prisma.reworkRequest.create({
      data: {
        number: 'RW-P9-F-2',
        productionOrderId: f.poId,
        inspectionId: fail2.id,
        description: 'Second rework open after two fails',
        status: 'AWAITING_STAGE',
        reentryStageInstanceId: uphSi ?? undefined,
        assignedToId: upholstererId,
      },
    });
  }

  // ── P9-G — CUSTOM/MODIFIED specs visible for inspection ───────────────────
  await buildPo({
    letter: 'G',
    customerId: oasis.id,
    productId: product.id,
    description: `${product.nameEn} (custom fabric)`,
    projectName: 'P9-G CUSTOM/MODIFIED inspection specs',
    factoryNotes:
      'P9-G: MODIFIED dims + Bouclé Ivory fabric — inspector must verify orderDimensions + fabric label',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.QUALITY_CHECK,
    currentStageCode: 'INSPECTION',
    progressPercent: 80,
    complexity: ManufacturingComplexity.MODIFIED,
    orderDimensions: { width: catalogW + 20, height: catalogH, depth: catalogD },
    catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
    requestedFabricLabel: 'Bouclé Ivory',
    planByStage: {
      ...priorProductionDone(),
      INSPECTION: {
        status: TaskStatus.READY_FOR_INSPECTION,
        stageStatus: StageInstanceStatus.READY,
        progressPercent: 100,
        assignUsername: 'inspector',
        inspectionStatus: 'READY_FOR_INSPECTION',
        notes: 'Verify Bouclé Ivory + width+20 vs catalog',
      },
      PACKAGING: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
      },
    },
  });

  // ── P9-H — Packaging READY after PASS ─────────────────────────────────────
  const hPack: PackagingExpectation = {
    expectedPieceCount: 2,
    pieceLabels: [
      { nameEn: 'Seat package', nameAr: 'طرد المقعد' },
      { nameEn: 'Back package', nameAr: 'طرد الظهر' },
    ],
  };
  const h = await buildPo({
    letter: 'H',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P9-H Packaging READY after PASS',
    factoryNotes: 'P9-H: Packaging READY after QC PASS — packer can start',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.READY_FOR_PACKAGING,
    currentStageCode: 'PACKAGING',
    progressPercent: 90,
    packagingExpectation: hPack,
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
      },
    },
  });
  if (h) {
    await createPassInspection(h.poId, 'QC-P9-H', 'Passed — packaging ready P9-H');
  }

  // ── P9-I — Packaging IN_PROGRESS partial package confirm ──────────────────
  const iPack: PackagingExpectation = {
    expectedPieceCount: 2,
    pieceLabels: [
      { nameEn: 'Seat package', nameAr: 'طرد المقعد' },
      { nameEn: 'Back package', nameAr: 'طرد الظهر' },
    ],
  };
  const i = await buildPo({
    letter: 'I',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P9-I Packaging partial confirm',
    factoryNotes: 'P9-I: Packaging IN_PROGRESS — 1 of 2 packages confirmed',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.IN_PROGRESS,
    currentStageCode: 'PACKAGING',
    progressPercent: 92,
    packagingExpectation: iPack,
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
        status: TaskStatus.IN_PROGRESS,
        stageStatus: StageInstanceStatus.IN_PROGRESS,
        progressPercent: 50,
        assignUsername: 'packer',
        actualStart: asOf,
        completedQty: 1,
        notes: 'Confirmed: Seat package (1 of 2). Back package pending.',
      },
    },
  });
  if (i) {
    await createPassInspection(i.poId, 'QC-P9-I', 'Passed — packaging in progress P9-I');
  }

  // ── P9-J — Packaging BLOCKED / missing package ────────────────────────────
  const j = await buildPo({
    letter: 'J',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P9-J Packaging missing package',
    factoryNotes: 'P9-J: Packaging BLOCKED — missing package / carton problem',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.ON_HOLD,
    currentStageCode: 'PACKAGING',
    progressPercent: 90,
    packagingExpectation: iPack,
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
        status: TaskStatus.BLOCKED,
        stageStatus: StageInstanceStatus.BLOCKED,
        progressPercent: 20,
        assignUsername: 'packer',
        actualStart: asOf,
        notes: 'Missing Back package carton — cannot complete pack confirm',
      },
    },
  });
  if (j) {
    await createPassInspection(j.poId, 'QC-P9-J', 'Passed — packaging blocked P9-J');
    const packTaskId = j.tasksByCode.get('PACKAGING');
    if (packTaskId) {
      await prisma.taskBlocker.create({
        data: {
          taskId: packTaskId,
          category: BlockerCategory.MATERIAL_MISSING,
          reason: 'P9-J: missing Back package / packaging material — seed blocker',
          reportedById: packerId,
        },
      });
    }
  }

  // ── P9-K — Packaging COMPLETED + FIN lot/tx once ──────────────────────────
  const k = await buildPo({
    letter: 'K',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P9-K Packaging COMPLETE → FIN',
    factoryNotes: 'P9-K: Packaging COMPLETED — FINISHED_GOODS lot + tx seeded once',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.READY_FOR_DELIVERY,
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
  if (k && finWh) {
    await createPassInspection(k.poId, 'QC-P9-K', 'Passed — FIN posted P9-K');
    const fgItem =
      (await prisma.inventoryItem.findFirst({
        where: { productId: k.productId, itemClass: 'FINISHED_GOOD', archivedAt: null },
      })) ??
      (await prisma.inventoryItem.findFirst({
        where: { itemClass: 'FINISHED_GOOD', archivedAt: null },
      }));
    const packSi = k.stageInstanceByCode.get('PACKAGING');
    if (fgItem && packSi) {
      const sourceKey = `FINISHED_GOODS_RECEIPT:${k.poId}:${packSi}:P9-K`;
      await prisma.inventoryTransaction.create({
        data: {
          number: 'ITX-P9-K-FIN',
          type: InventoryTxType.FINISHED_GOODS_RECEIPT,
          inventoryItemId: fgItem.id,
          warehouseId: finWh.id,
          quantity: money(1),
          createdById: opts.adminUserId,
          createdAt: asOf,
          referenceType: 'ProductionOrder',
          referenceId: k.poId,
          idempotencyKey: sourceKey,
          notes: 'P9-K demo FINISHED_GOODS_RECEIPT (once)',
        },
      });
      await prisma.inventoryLot.create({
        data: {
          inventoryItemId: fgItem.id,
          warehouseId: finWh.id,
          quantity: 1,
          status: 'AVAILABLE',
          productionOrderId: k.poId,
          salesOrderId: k.soId,
          salesOrderLineId: k.lineId,
          stageInstanceId: packSi,
          qrCode: 'FIN-P9-K',
          sourceKey,
          producedAt: asOf,
        },
      });
    }
  }

  // ── P9-L — Rework + extra fabric material usage (Piece 5 cost proof) ──────
  const l = await buildPo({
    letter: 'L',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P9-L Rework extra fabric cost',
    factoryNotes: 'P9-L: isRework task with extra fabric usage — Piece 5 reworkCost proof',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.IN_PROGRESS,
    currentStageCode: 'UPHOLSTERY',
    progressPercent: 74,
    planByStage: {
      ...priorProductionDone(),
      INSPECTION: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'inspector',
        inspectionStatus: 'FAILED',
      },
      PACKAGING: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
      },
    },
  });
  if (l && fabricOrRaw) {
    const fail = await createFailInspection({
      poId: l.poId,
      number: 'QC-P9-L',
      notes: 'Fail — extra fabric needed for rework',
      at: addDays(asOf, -2),
    });
    const uphSi = l.stageInstanceByCode.get('UPHOLSTERY');
    const uphDef = l.stageDefByCode.get('UPHOLSTERY');
    const rework = await prisma.reworkRequest.create({
      data: {
        number: 'RW-P9-L',
        productionOrderId: l.poId,
        inspectionId: fail.id,
        description: 'Rework with extra fabric for cost proof',
        status: 'IN_PROGRESS',
        reentryStageInstanceId: uphSi ?? undefined,
        assignedToId: upholstererId,
      },
    });
    if (uphSi && uphDef) {
      await prisma.productionStageInstance.update({
        where: { id: uphSi },
        data: { status: StageInstanceStatus.READY, progressPercent: 60, actualEnd: null },
      });
      const rwTask = await prisma.productionTask.create({
        data: {
          number: 'TSK-P9-L-RW',
          productionOrderId: l.poId,
          stageDefinitionId: uphDef,
          stageInstanceId: uphSi,
          name: 'Upholstery rework',
          description: 'P9-L rework with extra fabric',
          status: TaskStatus.IN_PROGRESS,
          progressPercent: 60,
          isRework: true,
          reworkRequestId: rework.id,
          assignedEmployeeId: upholstererId,
          actualStart: asOf,
          estimatedMinutes: 90,
          targetQty: 1,
        },
      });
      const expected = 0;
      const actual = 1.5;
      const costed = actual;
      await prisma.productionTaskMaterialUsage.create({
        data: {
          taskId: rwTask.id,
          productionOrderId: l.poId,
          inventoryItemId: fabricOrRaw.id,
          sku: fabricOrRaw.sku,
          expectedQty: expected,
          actualQty: actual,
          returnedQty: 0,
          scrapQty: 0,
          varianceQty: costed - expected,
          isExtra: true,
          scrapReason: 'REWORK',
          reasonNotes: 'P9-L extra fabric on isRework task',
          unitCost: money(fabricUnit),
          extendedCost: money(fabricUnit * costed),
          valuedAt: asOf,
          finalizedAt: asOf,
          finalizeIdempotencyKey: `p9-seed:L:${fabricOrRaw.sku}:rw`,
          recordedById: opts.adminUserId,
        },
      });
    }
  }

  console.log('  piece9: P9-A–L quality / rework / packaging examples seeded');
}
