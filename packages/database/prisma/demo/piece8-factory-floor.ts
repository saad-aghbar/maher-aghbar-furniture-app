/**
 * Piece 8 deterministic factory-floor SEMI handoff examples (SO/PO-P8-A…L).
 * Reuses WipKit / WipHandoff. Wipe/upsert by distinctive P8 numbers.
 * Workers: carpenter / assembler (and foam/upholsterer where needed).
 */
import {
  InventoryTracking,
  ManufacturingComplexity,
  PrismaClient,
  ProductionOrderStatus,
  QuotationStatus,
  SalesOrderLineSetupStatus,
  SalesOrderMaterialRequirementSource,
  SalesOrderProductionSetupStatus,
  SalesOrderStatus,
  StageInstanceStatus,
  TaskStatus,
  WipKitStatus,
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';
import { addDays, demoAsOf } from './clock';
import {
  loadProductInventoryOutputs,
  resolveDemoSnapshotInventory,
} from './inventory-lifecycle';
import { WF_SECTIONAL } from './workflows';

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
};

function isExecutableStage(code: string, executionKind: string): boolean {
  if (String(executionKind).toUpperCase() === 'LOGISTICS') return false;
  if (String(code).toUpperCase() === 'DELIVERY') return false;
  return true;
}

export async function seedPiece8FactoryFloorExamples(
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
    console.log('  Piece 8 skipped — missing dealers or products.');
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

  // Prefer a product whose active workflow includes ASSEMBLY (standard upholstered path).
  let product = opts.products[0]!;
  let defaultWorkflowId = await workflowIdForProduct(product.id);
  for (const p of opts.products) {
    const wfId = await workflowIdForProduct(p.id);
    if (!wfId) continue;
    const compiled = await loadWorkflowNodes(wfId);
    if (compiled?.nodes.some((n) => n.stageCode === 'ASSEMBLY')) {
      product = p;
      defaultWorkflowId = wfId;
      break;
    }
  }

  const sectionalProduct =
    opts.products.find((p) => p.workflowCode === WF_SECTIONAL) ??
    opts.products.find((p) => /SEC|CORN|BANQ/i.test(p.sku)) ??
    product;

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
          'carpenter',
          'carpenter2',
          'assembler',
          'assembler2',
          'foam',
          'foam1',
          'upholsterer',
          'inspector',
          'packer',
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
  const carpenterId = byUsername.get('carpenter') ?? opts.workerIds?.[0] ?? opts.adminUserId;
  const assemblerId = byUsername.get('assembler') ?? carpenterId;

  const semiWh =
    (await prisma.warehouse.findFirst({
      where: { type: 'SEMI_FINISHED', isActive: true },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    })) ?? null;
  const finWh =
    (await prisma.warehouse.findFirst({
      where: { type: 'FINISHED_GOODS', isActive: true },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    })) ?? null;

  async function ensureBin(code: string, name: string) {
    if (!semiWh) return null;
    const existing = await prisma.warehouseLocation.findUnique({
      where: { warehouseId_code: { warehouseId: semiWh.id, code } },
    });
    if (existing) return existing;
    return prisma.warehouseLocation.create({
      data: { warehouseId: semiWh.id, code, name },
    });
  }

  const woodItem = await prisma.inventoryItem.findFirst({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL', category: 'WOOD' },
    orderBy: { sku: 'asc' },
  });
  const rawFallback = await prisma.inventoryItem.findFirst({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
    orderBy: { sku: 'asc' },
  });
  const rawItem = woodItem ?? rawFallback;

  const sectionalWorkflowId = await workflowIdForProduct(sectionalProduct.id);

  /** Piece 8 override: which stages produce/consume SEMI for floor demos. */
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
    if (code === 'ASSEMBLY' || code === 'UPHOLSTERY' || code === 'PACKAGING') {
      return {
        inventoryTracking:
          code === 'PACKAGING'
            ? InventoryTracking.PRODUCES_FINISHED
            : InventoryTracking.NONE,
        consumesSemiFinished: true,
      };
    }
    return { inventoryTracking: InventoryTracking.NONE, consumesSemiFinished: false };
  }

  async function wipeBundle(letter: string) {
    const poNumber = `PO-P8-${letter}`;
    const soNumber = `SO-P8-${letter}`;
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
      await prisma.qualityInspectionItem
        .deleteMany({ where: { inspection: { productionOrderId: po.id } } })
        .catch(() => undefined);
      await prisma.qualityInspection.deleteMany({ where: { productionOrderId: po.id } }).catch(() => undefined);
      await prisma.inventoryTransaction.deleteMany({
        where: { referenceType: 'ProductionOrder', referenceId: po.id },
      });
      await prisma.inventoryLot.deleteMany({ where: { productionOrderId: po.id } });
      await prisma.productionTask.deleteMany({ where: { productionOrderId: po.id } });
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
    await prisma.quotation.deleteMany({ where: { number: `QT-P8-${letter}` } }).catch(() => undefined);
  }

  type BuiltPo = {
    poId: string;
    soId: string;
    tasksByCode: Map<string, string>;
    stageInstanceByCode: Map<string, string>;
    snapNodeByCode: Map<string, string>;
    productId: string;
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
    /** Extra: ASSEMBLY also produces SEMI (mid-chain for P8-H). */
    assemblyProducesSemi?: boolean;
  }): Promise<BuiltPo | null> {
    await wipeBundle(input.letter);
    const qty = input.quantity ?? 1;
    const totals = lineTotals(qty, unitPriceNum, VAT);
    const soNumber = `SO-P8-${input.letter}`;
    const qtNumber = `QT-P8-${input.letter}`;
    const poNumber = `PO-P8-${input.letter}`;
    const orderSpec = {
      productId: input.productId,
      productName: input.description,
      quantity: qty,
      manufacturingComplexity: 'STANDARD',
      catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      requestedDimensions: { width: catalogW, height: catalogH, depth: catalogD },
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
        status: SalesOrderStatus.IN_PRODUCTION,
        externalOrderNumber: `P8-${input.letter}`,
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
              manufacturingComplexity: ManufacturingComplexity.STANDARD,
              orderSpec,
              sortOrder: 0,
            },
          ],
        },
      },
      include: { lines: true },
    });
    const line = so.lines[0]!;

    const mats = rawItem
      ? [
          {
            inventoryItemId: rawItem.id,
            sku: rawItem.sku,
            displayName: rawItem.nameEn,
            category: rawItem.category,
            unit: rawItem.unit || 'pcs',
            expectedQty: 4,
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
            manufacturingComplexity: ManufacturingComplexity.STANDARD,
            catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
            orderDimensions: { width: catalogW, height: catalogH, depth: catalogD },
            workflowId: input.workflowId ?? undefined,
            workflowConfirmedAt: input.workflowId ? new Date() : undefined,
            packagingExpectation: { expectedPieceCount: 1, pieceLabels: [] },
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
        currentStageCode: 'CARPENTRY',
        progressPercent: 25,
      },
    });

    const tasksByCode = new Map<string, string>();
    const stageInstanceByCode = new Map<string, string>();
    const snapNodeByCode = new Map<string, string>();

    if (!input.workflowId) {
      return {
        poId: po.id,
        soId: so.id,
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
      if (input.assemblyProducesSemi && n.stageCode === 'ASSEMBLY') {
        flags.inventoryTracking = InventoryTracking.PRODUCES_SEMI_FINISHED;
        flags.consumesSemiFinished = true;
      }
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
      // Prefer Piece 8 floor flags when product recipe would clear SEMI consume/produce.
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
          expectedPieceCount: resolved.expectedPieceCount || 1,
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
        const taskNumber = `TSK-P8-${input.letter}-${String(taskIdx).padStart(2, '0')}`;
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
            estimatedMinutes: 120,
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
            plan.progressPercent ??
            (status === TaskStatus.COMPLETED ? 100 : status === TaskStatus.IN_PROGRESS ? 40 : 0),
          assignedEmployeeId: assignee === undefined ? undefined : assignee,
          actualStart: plan.actualStart === undefined ? undefined : plan.actualStart,
          plannedStart: addDays(asOf, 0),
          plannedCompletion: addDays(asOf, 1),
        },
      });
      await prisma.productionStageInstance.update({
        where: { id: stageInstanceId },
        data: {
          status: stageStatus,
          progressPercent:
            plan.progressPercent ??
            (status === TaskStatus.COMPLETED ? 100 : status === TaskStatus.IN_PROGRESS ? 40 : 0),
          actualStart: plan.actualStart === undefined ? undefined : plan.actualStart,
          actualEnd: status === TaskStatus.COMPLETED ? asOf : undefined,
        },
      });
    }

    return {
      poId: po.id,
      soId: so.id,
      tasksByCode,
      stageInstanceByCode,
      snapNodeByCode,
      productId: input.productId,
    };
  }

  async function createKit(args: {
    poId: string;
    letter: string;
    producerCode: string;
    status: WipKitStatus;
    pieces: number;
    stageInstanceByCode: Map<string, string>;
    snapNodeByCode: Map<string, string>;
    productId: string;
    consumerCodes?: string[];
    producingTaskId?: string | null;
    claimedByUserId?: string | null;
    claimedByTaskId?: string | null;
  }) {
    const stageInstanceId = args.stageInstanceByCode.get(args.producerCode);
    if (!stageInstanceId) {
      console.log(`  Piece 8 kit skip P8-${args.letter}: no stage ${args.producerCode}`);
      return null;
    }
    if (!semiWh) {
      console.log(`  Piece 8 kit skip P8-${args.letter}: no SEMI warehouse`);
      return null;
    }
    const bin = await ensureBin(args.producerCode, `${args.producerCode} bin`);
    const snapNodeId = args.snapNodeByCode.get(args.producerCode) ?? null;
    const nextIds = (args.consumerCodes ?? [])
      .map((c) => args.snapNodeByCode.get(c))
      .filter((id): id is string => Boolean(id));

    let outputItem = await prisma.inventoryItem.findFirst({
      where: {
        productId: args.productId,
        itemClass: 'SEMI_FINISHED_GOOD',
        archivedAt: null,
      },
    });
    if (!outputItem) {
      outputItem = await prisma.inventoryItem.findFirst({
        where: { itemClass: 'SEMI_FINISHED_GOOD', archivedAt: null },
      });
    }
    if (!outputItem) {
      console.log(`  Piece 8 kit skip P8-${args.letter}: no SEMI inventory item`);
      return null;
    }

    const qrCode = `WIP-P8-${args.letter}-${args.producerCode}`;
    // Clear any orphan lot/kit with this QR (idempotent reseed).
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
        locationId: bin?.id ?? null,
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
        status: args.status,
        expectedPieceCount: args.pieces,
        qrCode,
        warehouseId: semiWh.id,
        locationId: bin?.id ?? null,
        nextSnapshotNodeIds: nextIds,
        claimedAt: args.status === WipKitStatus.CLAIMED ? asOf : null,
        claimedByUserId: args.claimedByUserId ?? null,
        claimedByTaskId: args.claimedByTaskId ?? null,
      },
    });

    for (let p = 0; p < args.pieces; p++) {
      await prisma.wipPiece.create({
        data: {
          kitId: kit.id,
          sortOrder: p,
          label: `Piece ${p + 1}`,
          inventoryLotId: p === 0 ? lot.id : null,
          qrCode: args.pieces > 1 ? `${qrCode}-P${String(p + 1).padStart(2, '0')}` : null,
        },
      });
    }

    return { kit, lot, stageInstanceId };
  }

  async function createHandoff(args: {
    kitId: string;
    lotId: string;
    poId: string;
    sourceStageInstanceId: string;
    destCode: string;
    stageInstanceByCode: Map<string, string>;
    quantity: number;
    receivedById: string;
    receivingTaskId?: string | null;
    letter: string;
  }) {
    const destId = args.stageInstanceByCode.get(args.destCode);
    if (!destId) return null;
    return prisma.wipHandoff.create({
      data: {
        kitId: args.kitId,
        lotId: args.lotId,
        productionOrderId: args.poId,
        sourceStageInstanceId: args.sourceStageInstanceId,
        destinationStageInstanceId: destId,
        quantity: args.quantity,
        receivedById: args.receivedById,
        receivedAt: asOf,
        receivingTaskId: args.receivingTaskId ?? null,
        idempotencyKey: `p8-seed:${args.letter}:${args.kitId}:${args.destCode}`,
      },
    });
  }

  // ── P8-A — Carpentry ready (first SEMI producer, no incoming) ─────────────
  await buildPo({
    letter: 'A',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P8-A Carpentry ready',
    factoryNotes: 'P8-A: first stage carpentry READY — no SEMI input',
    workflowId: defaultWorkflowId,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      CARPENTRY: {
        status: TaskStatus.READY,
        stageStatus: StageInstanceStatus.READY,
        assignUsername: 'carpenter',
      },
    },
  });

  // ── P8-B — Carpentry done → SEMI kit READY waiting Assembly ───────────────
  const b = await buildPo({
    letter: 'B',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P8-B Kit READY for Assembly',
    factoryNotes: 'P8-B: carpentry complete — SEMI kit READY',
    workflowId: defaultWorkflowId,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      CARPENTRY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
        actualStart: asOf,
      },
      ASSEMBLY: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
        assignUsername: 'assembler',
      },
    },
  });
  if (b) {
    await createKit({
      poId: b.poId,
      letter: 'B',
      producerCode: 'CARPENTRY',
      status: WipKitStatus.READY,
      pieces: 1,
      stageInstanceByCode: b.stageInstanceByCode,
      snapNodeByCode: b.snapNodeByCode,
      productId: b.productId,
      consumerCodes: ['ASSEMBLY'],
      producingTaskId: b.tasksByCode.get('CARPENTRY'),
    });
  }

  // ── P8-C — Assembly ready to receive ──────────────────────────────────────
  const c = await buildPo({
    letter: 'C',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P8-C Assembly ready to receive',
    factoryNotes: 'P8-C: assembly READY — kit waiting pickup',
    workflowId: defaultWorkflowId,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      CARPENTRY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      ASSEMBLY: {
        status: TaskStatus.READY,
        stageStatus: StageInstanceStatus.READY,
        assignUsername: 'assembler',
      },
    },
  });
  if (c) {
    await createKit({
      poId: c.poId,
      letter: 'C',
      producerCode: 'CARPENTRY',
      status: WipKitStatus.READY,
      pieces: 2,
      stageInstanceByCode: c.stageInstanceByCode,
      snapNodeByCode: c.snapNodeByCode,
      productId: c.productId,
      consumerCodes: ['ASSEMBLY'],
      producingTaskId: c.tasksByCode.get('CARPENTRY'),
    });
  }

  // ── P8-D — Assembly received (CLAIMED) → ready to start ───────────────────
  const d = await buildPo({
    letter: 'D',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P8-D Assembly CLAIMED',
    factoryNotes: 'P8-D: assembly received SEMI — ready to start',
    workflowId: defaultWorkflowId,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      CARPENTRY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      ASSEMBLY: {
        status: TaskStatus.READY,
        stageStatus: StageInstanceStatus.READY,
        assignUsername: 'assembler',
      },
    },
  });
  if (d) {
    const kit = await createKit({
      poId: d.poId,
      letter: 'D',
      producerCode: 'CARPENTRY',
      status: WipKitStatus.CLAIMED,
      pieces: 1,
      stageInstanceByCode: d.stageInstanceByCode,
      snapNodeByCode: d.snapNodeByCode,
      productId: d.productId,
      consumerCodes: ['ASSEMBLY'],
      producingTaskId: d.tasksByCode.get('CARPENTRY'),
      claimedByUserId: assemblerId,
      claimedByTaskId: d.tasksByCode.get('ASSEMBLY'),
    });
    if (kit) {
      await createHandoff({
        kitId: kit.kit.id,
        lotId: kit.lot.id,
        poId: d.poId,
        sourceStageInstanceId: kit.stageInstanceId,
        destCode: 'ASSEMBLY',
        stageInstanceByCode: d.stageInstanceByCode,
        quantity: 1,
        receivedById: assemblerId,
        receivingTaskId: d.tasksByCode.get('ASSEMBLY'),
        letter: 'D',
      });
    }
  }

  // ── P8-E — Parallel: Carpentry ready, Foam waiting ────────────────────────
  await buildPo({
    letter: 'E',
    customerId: oasis.id,
    productId: sectionalProduct.id,
    description: sectionalProduct.nameEn,
    projectName: 'P8-E Parallel carpentry/foam',
    factoryNotes: 'P8-E: parallel opening — carpentry READY, foam waiting',
    workflowId: sectionalWorkflowId ?? defaultWorkflowId,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      CARPENTRY: {
        status: TaskStatus.READY,
        stageStatus: StageInstanceStatus.READY,
        assignUsername: 'carpenter',
      },
      FOAM: {
        status: TaskStatus.NOT_STARTED,
        stageStatus: StageInstanceStatus.PENDING,
        assignUsername: 'foam',
      },
    },
  });

  // ── P8-F — Partial handoff 4/6 ────────────────────────────────────────────
  const f = await buildPo({
    letter: 'F',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P8-F Partial handoff 4/6',
    factoryNotes: 'P8-F: partial SEMI receive 4 of 6',
    workflowId: defaultWorkflowId,
    quantity: 6,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      CARPENTRY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      ASSEMBLY: {
        status: TaskStatus.READY,
        stageStatus: StageInstanceStatus.READY,
        assignUsername: 'assembler',
      },
    },
  });
  if (f) {
    const kit = await createKit({
      poId: f.poId,
      letter: 'F',
      producerCode: 'CARPENTRY',
      status: WipKitStatus.READY,
      pieces: 6,
      stageInstanceByCode: f.stageInstanceByCode,
      snapNodeByCode: f.snapNodeByCode,
      productId: f.productId,
      consumerCodes: ['ASSEMBLY'],
      producingTaskId: f.tasksByCode.get('CARPENTRY'),
    });
    if (kit) {
      await createHandoff({
        kitId: kit.kit.id,
        lotId: kit.lot.id,
        poId: f.poId,
        sourceStageInstanceId: kit.stageInstanceId,
        destCode: 'ASSEMBLY',
        stageInstanceByCode: f.stageInstanceByCode,
        quantity: 4,
        receivedById: assemblerId,
        receivingTaskId: f.tasksByCode.get('ASSEMBLY'),
        letter: 'F',
      });
    }
  }

  // ── P8-G — Open discrepancy attention on assembly ─────────────────────────
  const g = await buildPo({
    letter: 'G',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P8-G Discrepancy attention',
    factoryNotes: 'P8-G: PREVIOUS_STAGE_DEFECT blocker on assembly',
    workflowId: defaultWorkflowId,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      CARPENTRY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      ASSEMBLY: {
        status: TaskStatus.READY,
        stageStatus: StageInstanceStatus.READY,
        assignUsername: 'assembler',
      },
    },
  });
  if (g) {
    await createKit({
      poId: g.poId,
      letter: 'G',
      producerCode: 'CARPENTRY',
      status: WipKitStatus.READY,
      pieces: 1,
      stageInstanceByCode: g.stageInstanceByCode,
      snapNodeByCode: g.snapNodeByCode,
      productId: g.productId,
      consumerCodes: ['ASSEMBLY'],
      producingTaskId: g.tasksByCode.get('CARPENTRY'),
    });
    const assemblyTaskId = g.tasksByCode.get('ASSEMBLY');
    if (assemblyTaskId) {
      await prisma.taskBlocker.create({
        data: {
          taskId: assemblyTaskId,
          category: 'PREVIOUS_STAGE_DEFECT',
          reason: 'SEMI handoff discrepancy: DAMAGED — seed P8-G open attention',
          reportedById: assemblerId,
        },
      });
    }
  }

  // ── P8-H — Assembly/Foam done → Upholstery waiting ────────────────────────
  const h = await buildPo({
    letter: 'H',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P8-H Upholstery waiting',
    factoryNotes: 'P8-H: carpentry kit READY — upholstery waiting receive',
    workflowId: defaultWorkflowId,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      CARPENTRY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      FOAM: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'foam',
      },
      UPHOLSTERY: {
        status: TaskStatus.READY,
        stageStatus: StageInstanceStatus.READY,
        assignUsername: 'upholsterer',
      },
    },
  });
  if (h) {
    await createKit({
      poId: h.poId,
      letter: 'H',
      producerCode: 'CARPENTRY',
      status: WipKitStatus.READY,
      pieces: 1,
      stageInstanceByCode: h.stageInstanceByCode,
      snapNodeByCode: h.snapNodeByCode,
      productId: h.productId,
      consumerCodes: ['UPHOLSTERY', 'ASSEMBLY'],
      producingTaskId: h.tasksByCode.get('CARPENTRY'),
    });
  }

  // ── P8-I — Toward Inspection (assembly done, inspection ready) ────────────
  const i = await buildPo({
    letter: 'I',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P8-I Toward Inspection',
    factoryNotes: 'P8-I: assembly complete — inspection READY',
    workflowId: defaultWorkflowId,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      CARPENTRY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      FOAM: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'foam',
      },
      UPHOLSTERY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'upholsterer',
      },
      ASSEMBLY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'assembler',
      },
      INSPECTION: {
        status: TaskStatus.READY,
        stageStatus: StageInstanceStatus.READY,
        assignUsername: 'inspector',
      },
    },
  });
  if (i) {
    const kit = await createKit({
      poId: i.poId,
      letter: 'I',
      producerCode: 'CARPENTRY',
      status: WipKitStatus.CLAIMED,
      pieces: 1,
      stageInstanceByCode: i.stageInstanceByCode,
      snapNodeByCode: i.snapNodeByCode,
      productId: i.productId,
      consumerCodes: ['ASSEMBLY'],
      producingTaskId: i.tasksByCode.get('CARPENTRY'),
      claimedByUserId: assemblerId,
      claimedByTaskId: i.tasksByCode.get('ASSEMBLY'),
    });
    if (kit) {
      await createHandoff({
        kitId: kit.kit.id,
        lotId: kit.lot.id,
        poId: i.poId,
        sourceStageInstanceId: kit.stageInstanceId,
        destCode: 'ASSEMBLY',
        stageInstanceByCode: i.stageInstanceByCode,
        quantity: 1,
        receivedById: assemblerId,
        receivingTaskId: i.tasksByCode.get('ASSEMBLY'),
        letter: 'I',
      });
    }
  }

  // ── P8-J — QC pass (inspection complete, packaging ready) ─────────────────
  const j = await buildPo({
    letter: 'J',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P8-J QC pass',
    factoryNotes: 'P8-J: inspection COMPLETE — packaging READY',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.QUALITY_CHECK,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
      },
      CARPENTRY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      FOAM: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'foam',
      },
      UPHOLSTERY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'upholsterer',
      },
      ASSEMBLY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'assembler',
      },
      INSPECTION: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'inspector',
      },
      PACKAGING: {
        status: TaskStatus.READY,
        stageStatus: StageInstanceStatus.READY,
        assignUsername: 'packer',
      },
    },
  });

  // ── P8-K — Packaging→FIN (packaging complete, delivery logistics only) ────
  const k = await buildPo({
    letter: 'K',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P8-K Packaging FIN',
    factoryNotes: 'P8-K: packaging COMPLETE — FIN lot; Delivery tasks=0',
    workflowId: defaultWorkflowId,
    poStatus: ProductionOrderStatus.READY_FOR_DELIVERY,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
      },
      CARPENTRY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'carpenter',
      },
      FOAM: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'foam',
      },
      UPHOLSTERY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'upholsterer',
      },
      ASSEMBLY: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'assembler',
      },
      INSPECTION: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'inspector',
      },
      PACKAGING: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
        assignUsername: 'packer',
      },
    },
  });
  if (k && finWh) {
    const fgItem =
      (await prisma.inventoryItem.findFirst({
        where: { productId: k.productId, itemClass: 'FINISHED_GOOD', archivedAt: null },
      })) ??
      (await prisma.inventoryItem.findFirst({
        where: { itemClass: 'FINISHED_GOOD', archivedAt: null },
      }));
    const packSi = k.stageInstanceByCode.get('PACKAGING');
    if (fgItem && packSi) {
      await prisma.inventoryLot.create({
        data: {
          inventoryItemId: fgItem.id,
          warehouseId: finWh.id,
          quantity: 1,
          status: 'AVAILABLE',
          productionOrderId: k.poId,
          salesOrderId: k.soId,
          stageInstanceId: packSi,
          qrCode: `FIN-P8-K`,
          producedAt: asOf,
        },
      });
    }
    await prisma.productionOrder.update({
      where: { id: k.poId },
      data: { progressPercent: 100, currentStageCode: 'PACKAGING' },
    });
  }

  // ── P8-L — RAW usage with scrap + unused on carpentry ─────────────────────
  const l = await buildPo({
    letter: 'L',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'P8-L RAW scrap+unused',
    factoryNotes: 'P8-L: carpentry RAW usage scrap+returned; no SEMI cost',
    workflowId: defaultWorkflowId,
    planByStage: {
      MATERIAL_PREP: {
        status: TaskStatus.COMPLETED,
        stageStatus: StageInstanceStatus.COMPLETED,
        progressPercent: 100,
      },
      CARPENTRY: {
        status: TaskStatus.IN_PROGRESS,
        stageStatus: StageInstanceStatus.IN_PROGRESS,
        progressPercent: 50,
        assignUsername: 'carpenter',
        actualStart: asOf,
      },
    },
  });
  if (l && rawItem) {
    const carpentryTaskId = l.tasksByCode.get('CARPENTRY');
    if (carpentryTaskId) {
      const expected = 4;
      const actual = 3;
      const scrap = 0.5;
      const returned = 0.5;
      const costed = actual + scrap - returned;
      const unitCost = 25;
      await prisma.productionTaskMaterialUsage.create({
        data: {
          taskId: carpentryTaskId,
          productionOrderId: l.poId,
          inventoryItemId: rawItem.id,
          sku: rawItem.sku,
          expectedQty: expected,
          actualQty: actual,
          returnedQty: returned,
          scrapQty: scrap,
          varianceQty: costed - expected,
          unitCost: money(unitCost),
          extendedCost: money(unitCost * costed),
          valuedAt: asOf,
          finalizedAt: asOf,
          finalizeIdempotencyKey: `p8-seed:L:${rawItem.sku}`,
          recordedById: opts.adminUserId,
        },
      });
    }
  }

  console.log('  piece8: P8-A–L factory floor SEMI examples seeded');
}
