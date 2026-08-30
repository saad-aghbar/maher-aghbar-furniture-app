/**
 * Piece 3 deterministic production-plan examples (P3-A–H).
 * Released SO/PO with real stage instances + ProductionTasks (non-LOGISTICS).
 * Does not call scheduling.generate.
 */
import {
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
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';
import { addDays, demoAsOf } from './clock';
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
  bomDefaults?: unknown;
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
  forceAssigneeId?: string | null;
  plannedStart?: Date | null;
  plannedCompletion?: Date | null;
  status?: TaskStatus;
  stageStatus?: StageInstanceStatus;
  progressPercent?: number;
  actualStart?: Date | null;
};

function ammanHoursOn(day: Date, hour: number, minute = 0): Date {
  // demoAsOf / addDays are UTC instants; Jordan is UTC+3 year-round.
  const y = day.getUTCFullYear();
  const m = day.getUTCMonth();
  const d = day.getUTCDate();
  return new Date(Date.UTC(y, m, d, hour - 3, minute, 0));
}

function windowOn(day: Date, startHour: number, endHour: number): { start: Date; end: Date } {
  return { start: ammanHoursOn(day, startHour), end: ammanHoursOn(day, endHour) };
}

const STAGE_WORKER_PREFERENCE: Record<string, string[]> = {
  MATERIAL_PREP: ['cutter', 'cutter2', 'packer2'],
  CARPENTRY: ['carpenter', 'carpenter2', 'carpenter3', 'carpenter4'],
  PAINTING: ['painter', 'painter2'],
  FOAM: ['foam', 'foam1', 'foam2', 'upholsterer3'],
  UPHOLSTERY: ['upholsterer', 'upholsterer2', 'upholsterer3'],
  ASSEMBLY: ['assembler', 'carpenter4', 'assembler2'],
  INSPECTION: ['inspector', 'inspector2'],
  PACKAGING: ['packer', 'packer2'],
};

function isExecutableStage(code: string, executionKind: string): boolean {
  if (String(executionKind).toUpperCase() === 'LOGISTICS') return false;
  if (String(code).toUpperCase() === 'DELIVERY') return false;
  return true;
}

export async function seedPiece3ProductionPlanExamples(
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
  const product = opts.products[0];
  if (!oasis || !nile || !product) return;

  const sectionalProduct =
    opts.products.find((p) => p.workflowCode === WF_SECTIONAL) ??
    opts.products.find((p) => /SEC|CORN|BANQ/i.test(p.sku)) ??
    product;

  const catalogW = product.width != null ? Number(product.width) : 180;
  const catalogH = product.height != null ? Number(product.height) : 90;
  const catalogD = product.depth != null ? Number(product.depth) : 85;
  const unitPriceNum = Number(product.basePrice) || 2500;
  const unitPrice = money(unitPriceNum);
  const sentAt = new Date();
  const acceptedAt = new Date();
  const asOf = demoAsOf();
  const day0 = asOf;
  const day1 = addDays(asOf, 1);

  const workerUsernames = [
    'carpenter',
    'carpenter2',
    'carpenter3',
    'carpenter4',
    'upholsterer',
    'upholsterer2',
    'upholsterer3',
    'foam',
    'foam1',
    'foam2',
    'cutter',
    'cutter2',
    'assembler',
    'assembler2',
    'inspector',
    'inspector2',
    'painter',
    'painter2',
    'packer',
    'packer2',
  ];
  const workerUsers = await prisma.user.findMany({
    where: { username: { in: workerUsernames } },
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
  const fallbackWorkerId =
    byUsername.get('carpenter') ??
    opts.workerIds?.[0] ??
    workerUsers.find(() => true)?.id ??
    opts.adminUserId;

  const skills = await prisma.workerSkill.findMany({
    where: { isActive: true },
    select: { userId: true, stageDefinitionId: true, stageDefinition: { select: { code: true } } },
  });
  const skilledByStage = new Map<string, string[]>();
  for (const s of skills) {
    const code = s.stageDefinition.code;
    const list = skilledByStage.get(code) ?? [];
    list.push(s.userId);
    skilledByStage.set(code, list);
  }

  function resolveWorkerId(stageCode: string, preferredUsername?: string | null): string {
    if (preferredUsername) {
      const id = byUsername.get(preferredUsername.toLowerCase());
      if (id) return id;
    }
    for (const u of STAGE_WORKER_PREFERENCE[stageCode] ?? []) {
      const id = byUsername.get(u);
      if (id) return id;
    }
    const skilled = skilledByStage.get(stageCode);
    if (skilled?.length) return skilled[0]!;
    return fallbackWorkerId;
  }

  async function workflowIdForProduct(productId: string): Promise<string | null> {
    const cfg = await prisma.productWorkflowConfiguration.findUnique({
      where: { productId },
      select: { workflowId: true },
    });
    return cfg?.workflowId ?? null;
  }

  const defaultWorkflowId = await workflowIdForProduct(product.id);
  const sectionalWorkflowId = await workflowIdForProduct(sectionalProduct.id);

  const stageMaterials = await prisma.productStageMaterialInput.findMany({
    where: { productId: product.id },
    include: {
      inventoryItem: {
        select: { id: true, sku: true, nameEn: true, category: true, unit: true },
      },
    },
    take: 20,
  });
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
    take: 10,
    orderBy: { sku: 'asc' },
  });
  const fabricItem =
    inventoryItems.find((i) => i.category === 'FABRIC') ?? inventoryItems[0] ?? null;
  const woodItem =
    inventoryItems.find((i) => i.category === 'WOOD') ?? inventoryItems[1] ?? inventoryItems[0] ?? null;

  const packagingOutputs = await prisma.productStageInventoryOutput.findMany({
    where: { productId: product.id },
    select: { expectedPieceCount: true, pieceLabels: true, inventoryTracking: true },
  });
  const finished =
    packagingOutputs.find((o) => o.inventoryTracking === 'PRODUCES_FINISHED') ??
    packagingOutputs[0];
  const packagingExpectation = {
    pieceLabels: Array.isArray(finished?.pieceLabels) ? finished!.pieceLabels : [],
    expectedPieceCount: finished?.expectedPieceCount ?? 1,
  };

  function catalogMaterialCreates(needsReview: boolean, fabricLabel?: string | null) {
    if (stageMaterials.length) {
      const byItem = new Map<string, (typeof stageMaterials)[number]>();
      for (const row of stageMaterials) {
        if (!byItem.has(row.inventoryItemId)) byItem.set(row.inventoryItemId, row);
      }
      return [...byItem.values()].map((row, idx) => ({
        inventoryItemId: row.inventoryItemId,
        sku: row.inventoryItem.sku,
        displayName: row.inventoryItem.nameEn,
        category: row.inventoryItem.category,
        unit: row.unit || row.inventoryItem.unit || 'pcs',
        expectedQty: Number(row.qtyPerUnit) || 1,
        source: SalesOrderMaterialRequirementSource.CATALOG,
        needsReview: needsReview && row.inventoryItem.category === 'FABRIC',
        requestedFabricLabel:
          row.inventoryItem.category === 'FABRIC' ? fabricLabel ?? undefined : undefined,
        sortOrder: idx,
      }));
    }
    const rows = [
      woodItem && {
        inventoryItemId: woodItem.id,
        sku: woodItem.sku,
        displayName: woodItem.nameEn,
        category: woodItem.category,
        unit: woodItem.unit,
        expectedQty: 4,
        source: SalesOrderMaterialRequirementSource.CATALOG,
        needsReview: false,
        sortOrder: 0,
      },
      fabricItem && {
        inventoryItemId: fabricItem.id,
        sku: fabricItem.sku,
        displayName: fabricItem.nameEn,
        category: fabricItem.category,
        unit: fabricItem.unit,
        expectedQty: 12,
        source: SalesOrderMaterialRequirementSource.CATALOG,
        needsReview,
        requestedFabricLabel: fabricLabel ?? undefined,
        sortOrder: 1,
      },
    ].filter(Boolean) as Array<{
      inventoryItemId: string;
      sku: string;
      displayName: string;
      category: NonNullable<typeof fabricItem>['category'];
      unit: string;
      expectedQty: number;
      source: SalesOrderMaterialRequirementSource;
      needsReview: boolean;
      requestedFabricLabel?: string;
      sortOrder: number;
    }>;
    return rows;
  }

  async function upsertAcceptedSo(input: {
    soNumber: string;
    qtNumber: string;
    customerId: string;
    projectName: string;
    externalOrderNumber: string;
    productId: string;
    description: string;
    quantity: number;
    soStatus: SalesOrderStatus;
  }) {
    const totals = lineTotals(input.quantity, unitPriceNum, VAT);
    const orderSpec = {
      productId: input.productId,
      productName: input.description,
      quantity: input.quantity,
      manufacturingComplexity: 'STANDARD',
      catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      requestedDimensions: { width: catalogW, height: catalogH, depth: catalogD },
    };
    const quote = await prisma.quotation.upsert({
      where: { number_version: { number: input.qtNumber, version: 1 } },
      update: { status: QuotationStatus.ACCEPTED, sentAt, acceptedAt },
      create: {
        number: input.qtNumber,
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
              quantity: input.quantity,
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

    const existing = await prisma.salesOrder.findUnique({
      where: { number: input.soNumber },
      include: { lines: true, productionOrders: { select: { id: true } } },
    });
    if (existing?.productionOrders.length) {
      await prisma.salesOrder.update({
        where: { id: existing.id },
        data: { status: input.soStatus, archivedAt: null },
      });
      return prisma.salesOrder.findUniqueOrThrow({
        where: { id: existing.id },
        include: { lines: true },
      });
    }
    if (existing) {
      await prisma.salesOrderLineMaterialRequirement.deleteMany({
        where: { lineSetup: { productionSetup: { salesOrderId: existing.id } } },
      });
      await prisma.salesOrderLineSetup.deleteMany({
        where: { productionSetup: { salesOrderId: existing.id } },
      });
      await prisma.salesOrderProductionSetup.deleteMany({ where: { salesOrderId: existing.id } });
      await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: existing.id } });
      await prisma.salesOrder.update({
        where: { id: existing.id },
        data: {
          status: input.soStatus,
          archivedAt: null,
          projectName: input.projectName,
          externalOrderNumber: input.externalOrderNumber,
          quotationId: quote.id,
        },
      });
      await prisma.salesOrderLine.create({
        data: {
          salesOrderId: existing.id,
          productId: input.productId,
          description: input.description,
          quantity: input.quantity,
          unitPrice,
          taxRate: VAT,
          lineTotal: totals.lineTotalM,
          manufacturingComplexity: ManufacturingComplexity.STANDARD,
          orderSpec,
          sortOrder: 0,
        },
      });
      return prisma.salesOrder.findUniqueOrThrow({
        where: { id: existing.id },
        include: { lines: true },
      });
    }

    return prisma.salesOrder.create({
      data: {
        number: input.soNumber,
        customerId: input.customerId,
        quotationId: quote.id,
        status: input.soStatus,
        externalOrderNumber: input.externalOrderNumber,
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
              quantity: input.quantity,
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
  }

  async function ensureReleasedSetup(input: {
    salesOrderId: string;
    lineId: string;
    productId: string;
    workflowId: string | null;
    factoryNotes: string;
    shortageQty?: boolean;
  }) {
    const existing = await prisma.salesOrderProductionSetup.findUnique({
      where: { salesOrderId: input.salesOrderId },
    });
    if (existing) return;

    const mats = catalogMaterialCreates(false).map((m, idx) =>
      input.shortageQty && idx === 0
        ? { ...m, expectedQty: 5000, needsReview: false }
        : { ...m, needsReview: false },
    );
    await prisma.salesOrderProductionSetup.create({
      data: {
        salesOrderId: input.salesOrderId,
        status: SalesOrderProductionSetupStatus.RELEASED,
        releasedAt: new Date(),
        releasedById: opts.adminUserId,
        lines: {
          create: {
            salesOrderLineId: input.lineId,
            status: SalesOrderLineSetupStatus.READY,
            manufacturingName: product.nameEn,
            manufacturingComplexity: ManufacturingComplexity.STANDARD,
            catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
            orderDimensions: { width: catalogW, height: catalogH, depth: catalogD },
            workflowId: input.workflowId ?? undefined,
            workflowConfirmedAt: input.workflowId ? new Date() : undefined,
            packagingExpectation,
            factoryNotes: input.factoryNotes,
            materialsReviewedAt: new Date(),
            materialRequirements: mats.length ? { create: mats } : undefined,
          },
        },
      },
    });
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

  async function ensurePoWithTasks(input: {
    demoId: string;
    soNumber: string;
    qtNumber: string;
    poNumber: string;
    customerId: string;
    productId: string;
    description: string;
    projectName: string;
    factoryNotes: string;
    workflowId: string | null;
    soStatus: SalesOrderStatus;
    poStatus: ProductionOrderStatus;
    shortageQty?: boolean;
    /** Per stage-code plan; missing keys default to unassigned / no dates / NOT_STARTED */
    planByStage: Record<string, TaskPlan>;
    /** When true, stages not in planByStage still get skill-based assignment + sequential dates */
    defaultAssignAll?: boolean;
    /** Force every executable task onto this username (e.g. carpenter2) */
    assignAllToUsername?: string | null;
    /** Opening + first parallel wave only */
    openingOnly?: boolean;
  }): Promise<{ poId: string; tasksByCode: Map<string, string> }> {
    const so = await upsertAcceptedSo({
      soNumber: input.soNumber,
      qtNumber: input.qtNumber,
      customerId: input.customerId,
      projectName: input.projectName,
      externalOrderNumber: input.demoId,
      productId: input.productId,
      description: input.description,
      quantity: 1,
      soStatus: input.soStatus,
    });
    const line = so.lines[0]!;
    await ensureReleasedSetup({
      salesOrderId: so.id,
      lineId: line.id,
      productId: input.productId,
      workflowId: input.workflowId,
      factoryNotes: input.factoryNotes,
      shortageQty: input.shortageQty,
    });

    const po = await prisma.productionOrder.upsert({
      where: { number: input.poNumber },
      update: {
        salesOrderId: so.id,
        salesOrderLineId: line.id,
        customerId: input.customerId,
        productId: input.productId,
        productDescription: input.description,
        status: input.poStatus,
        notes: input.factoryNotes,
        archivedAt: null,
        ...(input.poStatus === ProductionOrderStatus.IN_PROGRESS
          ? { actualStartDate: asOf, plannedStartDate: asOf, currentStageCode: 'CARPENTRY', progressPercent: 20 }
          : { actualStartDate: null, progressPercent: 0 }),
      },
      create: {
        number: input.poNumber,
        salesOrderId: so.id,
        salesOrderLineId: line.id,
        customerId: input.customerId,
        productId: input.productId,
        productDescription: input.description,
        quantity: 1,
        status: input.poStatus,
        createdById: opts.adminUserId,
        notes: input.factoryNotes,
        ...(input.poStatus === ProductionOrderStatus.IN_PROGRESS
          ? { actualStartDate: asOf, plannedStartDate: asOf, currentStageCode: 'CARPENTRY', progressPercent: 20 }
          : {}),
      },
    });

    await prisma.salesOrder.update({
      where: { id: so.id },
      data: { status: input.soStatus },
    });

    if (!input.workflowId) {
      return { poId: po.id, tasksByCode: new Map() };
    }

    const compiled = await loadWorkflowNodes(input.workflowId);
    if (!compiled) {
      return { poId: po.id, tasksByCode: new Map() };
    }

    let snapshot = await prisma.productionOrderWorkflowSnapshot.findUnique({
      where: { productionOrderId: po.id },
    });

    const existingTasks = await prisma.productionTask.findMany({
      where: { productionOrderId: po.id },
      include: { stageDefinition: { select: { code: true } } },
    });

    const tasksByCode = new Map<string, string>();
    const stageInstanceByCode = new Map<string, string>();

    if (!snapshot) {
      snapshot = await prisma.productionOrderWorkflowSnapshot.create({
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
          },
        });
        snapNodeIdBySource.set(n.id, snapNode.id);

        if (isExecutableStage(n.stageCode, n.executionKind)) {
          taskIdx += 1;
          const taskNumber = `TSK-${input.demoId}-${String(taskIdx).padStart(2, '0')}`;
          const task = await prisma.productionTask.upsert({
            where: { number: taskNumber },
            update: {
              productionOrderId: po.id,
              stageDefinitionId: n.stageDefinitionId,
              stageInstanceId: stageInstance.id,
              name: n.nameEn,
              status: TaskStatus.NOT_STARTED,
              progressPercent: 0,
              estimatedMinutes: 120,
              targetQty: 1,
              completedQty: 0,
            },
            create: {
              number: taskNumber,
              productionOrderId: po.id,
              stageDefinitionId: n.stageDefinitionId,
              stageInstanceId: stageInstance.id,
              name: n.nameEn,
              description: `${n.nameEn} for ${input.description}`,
              status: TaskStatus.NOT_STARTED,
              progressPercent: 0,
              estimatedMinutes: 120,
              targetQty: 1,
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
    } else {
      const instances = await prisma.productionStageInstance.findMany({
        where: { productionOrderId: po.id },
        include: { stageDefinition: { select: { code: true, executionKind: true } } },
      });
      for (const inst of instances) {
        stageInstanceByCode.set(inst.stageDefinition.code, inst.id);
      }
      for (const t of existingTasks) {
        const code = t.stageDefinition?.code;
        if (code) tasksByCode.set(code, t.id);
      }

      // Backfill missing executable tasks (e.g. older P2-F-style snapshot without tasks).
      let taskIdx = existingTasks.length;
      for (const n of compiled.nodes) {
        if (!isExecutableStage(n.stageCode, n.executionKind)) continue;
        if (tasksByCode.has(n.stageCode)) continue;
        const stageInstanceId = stageInstanceByCode.get(n.stageCode);
        if (!stageInstanceId) continue;
        taskIdx += 1;
        const taskNumber = `TSK-${input.demoId}-${String(taskIdx).padStart(2, '0')}`;
        const task = await prisma.productionTask.upsert({
          where: { number: taskNumber },
          update: {
            productionOrderId: po.id,
            stageDefinitionId: n.stageDefinitionId,
            stageInstanceId,
            name: n.nameEn,
          },
          create: {
            number: taskNumber,
            productionOrderId: po.id,
            stageDefinitionId: n.stageDefinitionId,
            stageInstanceId,
            name: n.nameEn,
            description: `${n.nameEn} for ${input.description}`,
            status: TaskStatus.NOT_STARTED,
            progressPercent: 0,
            estimatedMinutes: 120,
            targetQty: 1,
            completedQty: 0,
          },
        });
        tasksByCode.set(n.stageCode, task.id);
      }
    }

    const executableNodes = compiled.nodes.filter((n) =>
      isExecutableStage(n.stageCode, n.executionKind),
    );
    const inbound = new Map<string, string[]>();
    for (const n of compiled.nodes) inbound.set(n.id, []);
    for (const e of compiled.edges) {
      const list = inbound.get(e.toNodeId) ?? [];
      list.push(e.fromNodeId);
      inbound.set(e.toNodeId, list);
    }
    const rootIds = new Set(
      compiled.nodes.filter((n) => (inbound.get(n.id) ?? []).length === 0).map((n) => n.id),
    );
    const openingWaveCodes = new Set<string>();
    for (const n of compiled.nodes) {
      if (rootIds.has(n.id) && isExecutableStage(n.stageCode, n.executionKind)) {
        openingWaveCodes.add(n.stageCode);
      }
    }
    // First parallel wave: nodes whose predecessors are all roots
    for (const n of compiled.nodes) {
      if (!isExecutableStage(n.stageCode, n.executionKind)) continue;
      const preds = inbound.get(n.id) ?? [];
      if (preds.length > 0 && preds.every((p) => rootIds.has(p))) {
        openingWaveCodes.add(n.stageCode);
      }
    }

    let dateCursor = 0;
    for (const n of executableNodes) {
      const taskId = tasksByCode.get(n.stageCode);
      const stageInstanceId = stageInstanceByCode.get(n.stageCode);
      if (!taskId || !stageInstanceId) continue;

      let plan: TaskPlan = { ...(input.planByStage[n.stageCode] ?? {}) };
      const hasExplicitPlan = Boolean(input.planByStage[n.stageCode]);

      if (input.openingOnly) {
        if (openingWaveCodes.has(n.stageCode)) {
          if (!plan.assignUsername && !plan.forceAssigneeId) {
            plan = {
              ...plan,
              assignUsername: STAGE_WORKER_PREFERENCE[n.stageCode]?.[0] ?? null,
              plannedStart: plan.plannedStart ?? windowOn(addDays(day0, dateCursor), 8, 12).start,
              plannedCompletion:
                plan.plannedCompletion ?? windowOn(addDays(day0, dateCursor), 8, 12).end,
            };
            dateCursor += 1;
          }
        } else {
          plan = {
            assignUsername: null,
            forceAssigneeId: null,
            plannedStart: null,
            plannedCompletion: null,
            status: TaskStatus.NOT_STARTED,
            stageStatus: StageInstanceStatus.PENDING,
            progressPercent: 0,
          };
        }
      } else if (input.assignAllToUsername) {
        const win = windowOn(addDays(day0, dateCursor), 8, 12);
        plan = {
          ...plan,
          forceAssigneeId: resolveWorkerId(n.stageCode, input.assignAllToUsername),
          plannedStart: plan.plannedStart ?? win.start,
          plannedCompletion: plan.plannedCompletion ?? win.end,
          status: plan.status ?? TaskStatus.NOT_STARTED,
        };
        dateCursor += 1;
      } else if (input.defaultAssignAll && !hasExplicitPlan) {
        const win = windowOn(addDays(day0, dateCursor), 8, 12);
        plan = {
          assignUsername: STAGE_WORKER_PREFERENCE[n.stageCode]?.[0] ?? null,
          plannedStart: win.start,
          plannedCompletion: win.end,
          status: TaskStatus.NOT_STARTED,
        };
        dateCursor += 1;
      } else if (!hasExplicitPlan) {
        // Default: leave unassigned / undated (Needs planning demos + partial plans)
        plan = {
          assignUsername: null,
          forceAssigneeId: null,
          plannedStart: null,
          plannedCompletion: null,
          status: TaskStatus.NOT_STARTED,
          stageStatus: StageInstanceStatus.PENDING,
          progressPercent: 0,
          actualStart: null,
        };
      }

      const assigneeId =
        plan.forceAssigneeId !== undefined && plan.forceAssigneeId !== null
          ? plan.forceAssigneeId
          : plan.assignUsername
            ? resolveWorkerId(n.stageCode, plan.assignUsername)
            : plan.assignUsername === null
              ? null
              : undefined;

      const clearAssignment = plan.assignUsername === null && plan.forceAssigneeId == null;
      const status = plan.status ?? TaskStatus.NOT_STARTED;
      const stageStatus =
        plan.stageStatus ??
        (status === TaskStatus.IN_PROGRESS
          ? StageInstanceStatus.IN_PROGRESS
          : status === TaskStatus.COMPLETED
            ? StageInstanceStatus.COMPLETED
            : StageInstanceStatus.PENDING);

      await prisma.productionTask.update({
        where: { id: taskId },
        data: {
          status,
          progressPercent: plan.progressPercent ?? (status === TaskStatus.IN_PROGRESS ? 35 : 0),
          assignedEmployeeId: clearAssignment
            ? null
            : assigneeId !== undefined
              ? assigneeId
              : undefined,
          plannedStart: plan.plannedStart === undefined ? undefined : plan.plannedStart,
          plannedCompletion:
            plan.plannedCompletion === undefined ? undefined : plan.plannedCompletion,
          actualStart: plan.actualStart === undefined ? undefined : plan.actualStart,
          estimatedMinutes: 120,
        },
      });

      await prisma.productionStageInstance.update({
        where: { id: stageInstanceId },
        data: {
          status: stageStatus,
          progressPercent: plan.progressPercent ?? (status === TaskStatus.IN_PROGRESS ? 35 : 0),
          plannedStart: plan.plannedStart === undefined ? undefined : plan.plannedStart,
          plannedEnd: plan.plannedCompletion === undefined ? undefined : plan.plannedCompletion,
          actualStart: plan.actualStart === undefined ? undefined : plan.actualStart,
        },
      });
    }

    return { poId: po.id, tasksByCode };
  }

  // ── P3-A — Needs planning: all unassigned, no dates ──────────────────────
  await ensurePoWithTasks({
    demoId: 'P3-A',
    soNumber: 'SO-P3-A',
    qtNumber: 'QT-P3-A',
    poNumber: 'PO-P3-A',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'Piece3 Needs Planning',
    factoryNotes: 'P3-A: all tasks unassigned — Needs planning',
    workflowId: defaultWorkflowId,
    soStatus: SalesOrderStatus.READY_FOR_PRODUCTION,
    poStatus: ProductionOrderStatus.PLANNED,
    planByStage: {},
  });

  // ── P3-B — Partial: first executable → carpenter + dates ─────────────────
  {
    const nodes = defaultWorkflowId ? await loadWorkflowNodes(defaultWorkflowId) : null;
    const first = nodes?.nodes.find((n) => isExecutableStage(n.stageCode, n.executionKind));
    const win = windowOn(day1, 8, 12);
    const planByStage: Record<string, TaskPlan> = {};
    if (first) {
      planByStage[first.stageCode] = {
        assignUsername: 'carpenter',
        plannedStart: win.start,
        plannedCompletion: win.end,
        status: TaskStatus.NOT_STARTED,
      };
    }
    await ensurePoWithTasks({
      demoId: 'P3-B',
      soNumber: 'SO-P3-B',
      qtNumber: 'QT-P3-B',
      poNumber: 'PO-P3-B',
      customerId: oasis.id,
      productId: product.id,
      description: product.nameEn,
      projectName: 'Piece3 Partial Plan',
      factoryNotes: 'P3-B: first executable stage assigned to carpenter',
      workflowId: defaultWorkflowId,
      soStatus: SalesOrderStatus.READY_FOR_PRODUCTION,
      poStatus: ProductionOrderStatus.PLANNED,
      planByStage,
    });
  }

  // ── P3-C — Ready for factory: all assigned + dated ───────────────────────
  await ensurePoWithTasks({
    demoId: 'P3-C',
    soNumber: 'SO-P3-C',
    qtNumber: 'QT-P3-C',
    poNumber: 'PO-P3-C',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'Piece3 Ready For Factory',
    factoryNotes: 'P3-C: fully assigned — Ready for factory',
    workflowId: defaultWorkflowId,
    soStatus: SalesOrderStatus.READY_FOR_PRODUCTION,
    poStatus: ProductionOrderStatus.PLANNED,
    planByStage: {},
    defaultAssignAll: true,
  });

  // ── P3-D — IN_PROGRESS; carpenter on CARPENTRY today ─────────────────────
  {
    const carpWin = windowOn(day0, 8, 12);
    const prepWin = windowOn(addDays(day0, -1), 8, 12);
    await ensurePoWithTasks({
      demoId: 'P3-D',
      soNumber: 'SO-P3-D',
      qtNumber: 'QT-P3-D',
      poNumber: 'PO-P3-D',
      customerId: oasis.id,
      productId: product.id,
      description: product.nameEn,
      projectName: 'Piece3 In Production',
      factoryNotes: 'P3-D: carpenter active on carpentry',
      workflowId: defaultWorkflowId,
      soStatus: SalesOrderStatus.IN_PRODUCTION,
      poStatus: ProductionOrderStatus.IN_PROGRESS,
      planByStage: {
        MATERIAL_PREP: {
          assignUsername: 'cutter',
          plannedStart: prepWin.start,
          plannedCompletion: prepWin.end,
          status: TaskStatus.COMPLETED,
          stageStatus: StageInstanceStatus.COMPLETED,
          progressPercent: 100,
          actualStart: prepWin.start,
        },
        CARPENTRY: {
          assignUsername: 'carpenter',
          plannedStart: carpWin.start,
          plannedCompletion: carpWin.end,
          status: TaskStatus.IN_PROGRESS,
          stageStatus: StageInstanceStatus.IN_PROGRESS,
          progressPercent: 35,
          actualStart: carpWin.start,
        },
      },
    });
  }

  // ── P3-E — Fully planned but WAITING_FOR_MATERIALS (Attention) ───────────
  await ensurePoWithTasks({
    demoId: 'P3-E',
    soNumber: 'SO-P3-E',
    qtNumber: 'QT-P3-E',
    poNumber: 'PO-P3-E',
    customerId: nile.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'Piece3 Materials Hold',
    factoryNotes: 'P3-E: plan complete — materials shortage Attention',
    workflowId: defaultWorkflowId,
    soStatus: SalesOrderStatus.WAITING_FOR_MATERIALS,
    poStatus: ProductionOrderStatus.WAITING_FOR_MATERIALS,
    shortageQty: true,
    planByStage: {},
    defaultAssignAll: true,
  });

  // ── P3-F — Conflict: carpenter overlaps P3-D carpentry window ────────────
  {
    const conflictWin = windowOn(day0, 10, 14); // overlaps P3-D 08:00–12:00
    await ensurePoWithTasks({
      demoId: 'P3-F',
      soNumber: 'SO-P3-F',
      qtNumber: 'QT-P3-F',
      poNumber: 'PO-P3-F',
      customerId: oasis.id,
      productId: product.id,
      description: product.nameEn,
      projectName: 'Piece3 Assignment Conflict',
      factoryNotes: 'P3-F: carpenter carpentry overlaps PO-P3-D',
      workflowId: defaultWorkflowId,
      soStatus: SalesOrderStatus.READY_FOR_PRODUCTION,
      poStatus: ProductionOrderStatus.PLANNED,
      planByStage: {
        CARPENTRY: {
          assignUsername: 'carpenter',
          plannedStart: conflictWin.start,
          plannedCompletion: conflictWin.end,
          status: TaskStatus.NOT_STARTED,
        },
      },
      // Fill remaining with other workers / later days so readiness isn't "needs planning"
      // for conflict demo — still leave non-carpentry skill-assigned so conflict is visible
      // on the carpentry assign path. Partial plan is enough for conflict UX.
    });
  }

  // ── P3-G — Parallel opening wave assigned; downstream open ───────────────
  await ensurePoWithTasks({
    demoId: 'P3-G',
    soNumber: 'SO-P3-G',
    qtNumber: 'QT-P3-G',
    poNumber: 'PO-P3-G',
    customerId: nile.id,
    productId: sectionalProduct.id,
    description: sectionalProduct.nameEn,
    projectName: 'Piece3 Parallel Opening',
    factoryNotes: 'P3-G: opening + parallel wave assigned',
    workflowId: sectionalWorkflowId ?? defaultWorkflowId,
    soStatus: SalesOrderStatus.READY_FOR_PRODUCTION,
    poStatus: ProductionOrderStatus.PLANNED,
    planByStage: {},
    openingOnly: true,
  });

  // ── P3-H — Fully assigned to carpenter2 (pre-start reassignment) ─────────
  await ensurePoWithTasks({
    demoId: 'P3-H',
    soNumber: 'SO-P3-H',
    qtNumber: 'QT-P3-H',
    poNumber: 'PO-P3-H',
    customerId: oasis.id,
    productId: product.id,
    description: product.nameEn,
    projectName: 'Piece3 Reassignment Demo',
    factoryNotes: 'P3-H: all tasks on carpenter2 — reassignment demo',
    workflowId: defaultWorkflowId,
    soStatus: SalesOrderStatus.READY_FOR_PRODUCTION,
    poStatus: ProductionOrderStatus.PLANNED,
    planByStage: {},
    assignAllToUsername: 'carpenter2',
  });

  console.log('  piece3: P3-A–H production plan examples seeded');
}
