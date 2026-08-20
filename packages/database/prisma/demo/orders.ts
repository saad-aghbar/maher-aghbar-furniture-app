/**
 * Direct-Prisma historical seed. Exceptions vs live Nest services:
 * - Snapshots/tasks/schedules written here (same compileWorkflow + forward/backward planner).
 * - Task complete is status/rollup only; requiresPhotosOverride=false on demo templates.
 * - Inventory PRODUCTION_ISSUE applied when MATERIAL_PREP is completed (not TasksService.complete).
 * - QC / delivery / invoice / payment rows match service invariants, timestamps frozen to DEMO_AS_OF.
 */
import {
  InventoryTxType,
  Prisma,
  PrismaClient,
  Priority,
  ProductionOrderStatus,
  QuotationStatus,
  RequestSource,
  RequestStatus,
  ReturnInventoryFate,
  ReturnResolution,
  SalesOrderStatus,
  StageInstanceStatus,
  TaskStatus,
  InvoiceStatus,
  PaymentMethod,
  DeliveryStatus,
  QualityResult,
  ChecklistItemResult,
} from '@prisma/client';
import { compileWorkflow } from '../../../../apps/api/src/modules/production/workflow/domain/workflow-compiler';
import type {
  CompilerEdge,
  CompilerNode,
} from '../../../../apps/api/src/modules/production/workflow/domain/workflow-compiler';
import type {
  OccupancyInterval,
  PlannerOrderInput,
  TimeOfDayRange,
  WorkerCandidate,
} from '../../../../apps/api/src/modules/scheduling/domain/types';
import { WorkingCalendar } from '../../../../apps/api/src/modules/scheduling/domain/working-calendar';
import { buildStageTaskInstructions } from '../stage-task-instructions';
import { STANDARD_FURNITURE_WORKFLOW_CODE } from '../seed/workflow';
import { VAT, lineTotals, money } from '../seed/util';
import { addDays, ammanLocal, demoAsOf, demoWindowStart } from './clock';
import {
  atOrBefore,
  isDemoStageInProgress,
  isHistoricalDemoKind,
  isIntentionalLateKind,
  planDemoAllocations,
  presentationRequiredDelivery,
} from './chronology';
import type { DealerRef } from './people';
import type { ProductRef } from './catalog';
import { applyDemoMovement } from './stock';
import { nextDoc, type SeqBag } from './seq';
import { buildDemoStories, type DemoStory, type StoryKind } from './stories';

async function loadCompiledWorkflow(prisma: PrismaClient, productId: string) {
  const config = await prisma.productWorkflowConfiguration.findUnique({
    where: { productId },
    include: { workflow: true, stageOverrides: true },
  });
  const workflow =
    config?.workflow ??
    (await prisma.productionWorkflow.findUnique({
      where: { code: STANDARD_FURNITURE_WORKFLOW_CODE },
    }));
  if (!workflow?.activeVersionId) {
    throw new Error('No published workflow to snapshot.');
  }
  const version = await prisma.productionWorkflowVersion.findUniqueOrThrow({
    where: { id: workflow.activeVersionId },
    include: { nodes: { include: { stageDefinition: true } }, edges: true },
  });
  const nodes: CompilerNode[] = version.nodes.map((n) => ({
    id: n.id,
    nodeKey: n.nodeKey,
    stageDefinitionId: n.stageDefinitionId,
    sortOrder: n.sortOrder,
    displayX: n.displayX,
    displayY: n.displayY,
    isRequiredByDefault: n.isRequiredByDefault,
    canBeSkipped: n.canBeSkipped,
    defaultEstimatedMinutes: n.defaultEstimatedMinutes,
    responsibleDepartmentId: n.responsibleDepartmentId,
    requiresInspectionOverride: n.requiresInspectionOverride,
    requiresPhotosOverride: false,
    metadata: n.metadata,
    stage: {
      id: n.stageDefinition.id,
      code: n.stageDefinition.code,
      nameAr: n.stageDefinition.nameAr,
      nameEn: n.stageDefinition.nameEn,
      nameHe: n.stageDefinition.nameHe,
      estimatedHours: n.stageDefinition.estimatedHours
        ? Number(n.stageDefinition.estimatedHours)
        : null,
      requiresInspection: n.stageDefinition.requiresInspection,
      requiresPhotos: false,
      responsibleDepartment: n.stageDefinition.responsibleDepartment,
    },
  }));
  const edges: CompilerEdge[] = version.edges.map((e) => ({
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
    dependencyType: 'HARD' as const,
  }));
  const productEstimateMinutes: Record<string, number | null> = {};
  const estimates = await prisma.productStageEstimate.findMany({ where: { productId } });
  for (const e of estimates) {
    const minutes = e.fixedMinutes || (e.setupMinutes ?? 0) + (e.minutesPerUnit ?? 0);
    productEstimateMinutes[e.stageDefinitionId] = minutes || null;
  }
  const compiled = compileWorkflow({
    nodes,
    edges,
    productOverrides:
      config?.stageOverrides.map((o) => ({
        workflowNodeId: o.workflowNodeId,
        stageDefinitionId: o.stageDefinitionId,
        applicability: o.applicability,
        estimatedMinutes: o.estimatedMinutes,
        responsibleDepartmentId: o.responsibleDepartmentId,
      })) ?? [],
    productEstimateMinutes,
  });
  if (compiled.issues.length) {
    throw new Error(compiled.issues[0]?.message ?? 'Compiled workflow invalid');
  }
  return {
    workflowId: workflow.id,
    versionId: version.id,
    versionNumber: version.versionNumber,
    compiled,
  };
}

async function loadCalendar(prisma: PrismaClient) {
  const row = await prisma.factoryCalendar.findFirstOrThrow({ where: { isDefault: true } });
  const exceptions = await prisma.factoryCalendarException.findMany({
    where: { calendarId: row.id },
    orderBy: { date: 'asc' },
  });
  return new WorkingCalendar({
    timezone: row.timezone,
    workingWeekdays: row.workingWeekdays,
    shiftStart: row.shiftStart,
    shiftEnd: row.shiftEnd,
    breaks: (row.breaks as TimeOfDayRange[] | null) ?? [],
    exceptions: exceptions.map((e) => ({
      date: e.date,
      type: e.type,
      shiftStart: e.shiftStart,
      shiftEnd: e.shiftEnd,
      note: e.note,
    })),
  });
}

async function loadWorkers(prisma: PrismaClient): Promise<WorkerCandidate[]> {
  const workers = await prisma.user.findMany({
    where: {
      isActive: true,
      archivedAt: null,
      roles: { some: { role: { code: 'PRODUCTION_WORKER' } } },
    },
    select: {
      id: true,
      department: { select: { code: true } },
      workerSkills: { where: { isActive: true }, select: { stageDefinitionId: true } },
    },
  });
  return workers.map((w) => ({
    id: w.id,
    isActive: true,
    departmentCode: w.department?.code ?? null,
    skillStageDefinitionIds: w.workerSkills.map((s) => s.stageDefinitionId),
  }));
}

function soStatusFor(kind: StoryKind): SalesOrderStatus {
  switch (kind) {
    case 'draft':
      return SalesOrderStatus.DRAFT;
    case 'waiting_materials':
    case 'at_risk_material':
      return SalesOrderStatus.WAITING_FOR_MATERIALS;
    case 'not_started':
    case 'proposed':
      return SalesOrderStatus.READY_FOR_PRODUCTION;
    case 'delivered':
    case 'rework_historical':
      return SalesOrderStatus.DELIVERED;
    case 'ready_delivery':
      return SalesOrderStatus.READY_FOR_DELIVERY;
    default:
      return SalesOrderStatus.IN_PRODUCTION;
  }
}

function poStatusFor(kind: StoryKind): ProductionOrderStatus {
  switch (kind) {
    case 'waiting_materials':
    case 'at_risk_material':
      return ProductionOrderStatus.WAITING_FOR_MATERIALS;
    case 'not_started':
    case 'proposed':
      return ProductionOrderStatus.READY;
    case 'delivered':
    case 'rework_historical':
      return ProductionOrderStatus.COMPLETED;
    case 'ready_delivery':
      return ProductionOrderStatus.READY_FOR_DELIVERY;
    case 'packaging':
      return ProductionOrderStatus.READY_FOR_PACKAGING;
    case 'qc':
    case 'rework_current':
      return kind === 'rework_current'
        ? ProductionOrderStatus.ON_HOLD
        : ProductionOrderStatus.QUALITY_CHECK;
    default:
      return ProductionOrderStatus.IN_PROGRESS;
  }
}

function completeThroughFor(kind: StoryKind, story: DemoStory, includedCodes: string[]): string | null {
  if (kind === 'delivered' || kind === 'rework_historical') return includedCodes[includedCodes.length - 1] ?? null;
  if (kind === 'ready_delivery') return includedCodes.includes('PACKAGING') ? 'PACKAGING' : includedCodes.at(-2) ?? null;
  if (kind === 'packaging') return includedCodes.includes('INSPECTION') ? 'INSPECTION' : story.completeThrough ?? null;
  if (kind === 'qc' || kind === 'rework_current') {
    const idx = includedCodes.indexOf('INSPECTION');
    return idx > 0 ? includedCodes[idx - 1]! : story.completeThrough ?? null;
  }
  if (kind === 'not_started' || kind === 'proposed' || kind === 'waiting_materials' || kind === 'at_risk_material' || kind === 'draft') {
    return null;
  }
  if (story.completeThrough && includedCodes.includes(story.completeThrough)) {
    return story.completeThrough;
  }
  return null;
}

function completedCodes(
  target: string | null,
  included: Array<{ stageCode: string; nodeKey: string }>,
  edges: Array<{ fromNodeKey: string; toNodeKey: string }>,
): Set<string> {
  const done = new Set<string>();
  if (!target) return done;
  const preds = (key: string) => edges.filter((e) => e.toNodeKey === key).map((e) => e.fromNodeKey);
  const byCode = new Map(included.map((n) => [n.stageCode, n.nodeKey]));
  const walk = (code: string) => {
    const key = byCode.get(code) ?? code;
    if (done.has(code)) return;
    for (const p of preds(key)) {
      const pred = included.find((n) => n.nodeKey === p);
      if (pred) walk(pred.stageCode);
    }
    done.add(code);
  };
  walk(target);
  return done;
}

export async function seedDemoOrders(
  prisma: PrismaClient,
  opts: {
    adminId: string;
    salesId: string;
    inspectorId: string;
    driverId: string;
    warehouseUserId: string;
    dealers: DealerRef[];
    products: ProductRef[];
    counters: SeqBag;
    rawWhId: string;
  },
) {
  const calendar = await loadCalendar(prisma);
  const workers = await loadWorkers(prisma);
  const occupancy: OccupancyInterval[] = [];
  const asOf = demoAsOf();
  const windowStart = demoWindowStart();
  const stories = buildDemoStories().sort((a, b) => a.orderDay - b.orderDay || a.id.localeCompare(b.id));
  const dealerByUser = new Map(opts.dealers.map((d) => [d.username, d]));
  const productBySku = new Map(opts.products.map((p) => [p.sku, p]));
  const itemsBySku = new Map(
    (await prisma.inventoryItem.findMany({ select: { id: true, sku: true, standardCost: true } })).map((i) => [
      i.sku,
      i,
    ]),
  );
  const checklist = await prisma.qualityChecklistTemplate.findUnique({
    where: { code: 'FINAL_QC' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });

  let salesOrders = 0;
  let productionOrders = 0;
  const pending: Array<{
    story: DemoStory;
    dealer: DealerRef;
    product: ProductRef;
    so: { id: string; number: string; priority: Priority };
    po: { id: string; number: string };
    line: { description: string };
    address: string;
    createdAt: Date;
    requiredDelivery: Date;
    totals: { subtotal: number; taxAmount: number; lineTotal: number };
    unit: number;
    done: Set<string>;
    nextReady: { stageCode: string } | undefined;
    taskRows: Array<{
      id: string;
      stageDefinitionId: string;
      stageInstanceId: string;
      stageCode: string;
      estimatedMinutes: number;
    }>;
    stages: PlannerOrderInput['stages'];
    included: Array<{ stageCode: string; requiresInspection?: boolean }>;
  }> = [];

  for (const story of stories) {
    const dealer = dealerByUser.get(story.dealer);
    const product = productBySku.get(story.sku);
    if (!dealer || !product) {
      throw new Error(`Story ${story.id} missing dealer ${story.dealer} or sku ${story.sku}`);
    }
    const createdAt = addDays(windowStart, story.orderDay);
    createdAt.setUTCHours(createdAt.getUTCHours() + (story.orderDay % 5));
    const requiredDelivery = presentationRequiredDelivery(story, createdAt, asOf);
    const dealerPrice = await prisma.dealerPrice.findUnique({
      where: { customerId_productId: { customerId: dealer.id, productId: product.id } },
    });
    const unit = Number(dealerPrice?.price ?? product.basePrice);
    const totals = lineTotals(story.qty, unit);
    const mfg = Number(product.manufacturingCost ?? unit * 0.45) * story.qty;
    const specText = [story.fabric, story.wood].filter(Boolean).join(' / ') || null;
    const soStatus = soStatusFor(story.kind);
    const needsQuote = true;

    const rfqNumber = await nextDoc(prisma, 'rfq', opts.counters);
    const rfq = await prisma.requestForQuotation.create({
      data: {
        number: rfqNumber,
        customerId: dealer.id,
        source: RequestSource.PORTAL,
        status: story.kind === 'draft' ? RequestStatus.QUOTED : RequestStatus.CLOSED,
        priority: Priority.NORMAL,
        projectName: story.projectName,
        requiredDeliveryDate: requiredDelivery,
        externalOrderNumber: `PO-${dealer.username.toUpperCase()}-${story.orderDay + 100}`,
        requestDate: addDays(createdAt, -3),
        submittedAt: addDays(createdAt, -2),
        createdById: opts.salesId,
        assignedSalesId: opts.salesId,
        createdAt: addDays(createdAt, -3),
        updatedAt: createdAt,
        items: {
          create: [
            {
              productId: product.id,
              productName: product.nameEn,
              quantity: money(story.qty),
              width: product.basePrice ? undefined : undefined,
              fabricType: story.fabric,
              fabricCode: story.fabric ? `FAB-${story.sku}` : undefined,
              woodType: story.wood,
              notes: story.notes,
              sortOrder: 0,
            },
          ],
        },
      },
    });

    const qNumber = await nextDoc(prisma, 'quotation', opts.counters);
    const quote = await prisma.quotation.create({
      data: {
        number: qNumber,
        version: 1,
        customerId: dealer.id,
        requestId: rfq.id,
        status: story.kind === 'draft' ? QuotationStatus.SENT : QuotationStatus.ACCEPTED,
        issueDate: addDays(createdAt, -1),
        expirationDate: addDays(createdAt, 21),
        salesRepId: opts.salesId,
        createdById: opts.salesId,
        sentAt: addDays(createdAt, -1),
        acceptedAt: story.kind === 'draft' ? undefined : createdAt,
        subtotal: money(totals.subtotal),
        taxTotal: money(totals.taxAmount),
        total: money(totals.lineTotal),
        paymentTerms: `${dealer.username === 'qasr' ? 60 : 30} days`,
        createdAt: addDays(createdAt, -1),
        updatedAt: createdAt,
        lines: {
          create: [
            {
              productId: product.id,
              description: product.nameEn,
              quantity: money(story.qty),
              unitPrice: money(unit),
              taxRate: VAT,
              subtotal: money(totals.subtotal),
              taxAmount: money(totals.taxAmount),
              lineTotal: money(totals.lineTotal),
              sortOrder: 0,
            },
          ],
        },
      },
    });
    void needsQuote;

    const soNumber = await nextDoc(prisma, 'sales_order', opts.counters);
    const address = `${dealer.street}, ${dealer.area}, ${dealer.city}`;
    const so = await prisma.salesOrder.create({
      data: {
        number: soNumber,
        customerId: dealer.id,
        quotationId: quote.id,
        orderDate: createdAt,
        requiredDeliveryDate: requiredDelivery,
        status: soStatus,
        priority: story.kind.startsWith('at_risk') ? Priority.HIGH : Priority.NORMAL,
        projectName: story.projectName,
        externalOrderNumber: `EXT-${dealer.username.toUpperCase()}-${String(story.orderDay).padStart(3, '0')}`,
        deliveryAddress: address,
        paymentTerms: '30% deposit, balance on delivery',
        assignedEmployeeId: opts.salesId,
        notes: story.notes ?? null,
        subtotal: money(totals.subtotal),
        taxTotal: money(totals.taxAmount),
        total: money(totals.lineTotal),
        manufacturingCost: money(mfg),
        depositRequired: money(totals.lineTotal * 0.3),
        createdById: opts.adminId,
        createdAt,
        updatedAt: createdAt,
        lines: {
          create: [
            {
              productId: product.id,
              description: product.nameEn,
              specifications: specText,
              quantity: money(story.qty),
              unitPrice: money(unit),
              taxRate: VAT,
              lineTotal: money(totals.lineTotal),
              productionRequired: true,
              deliveryRequired: true,
              sortOrder: 0,
            },
          ],
        },
      },
      include: { lines: true },
    });
    salesOrders += 1;

    if (story.kind === 'draft') continue;

    const line = so.lines[0]!;
    const { workflowId, versionId, versionNumber, compiled } = await loadCompiledWorkflow(
      prisma,
      product.id,
    );
    const included = [...compiled.included].sort((a, b) => a.sortOrder - b.sortOrder);
    const codes = included.map((n) => n.stageCode);
    const through = completeThroughFor(story.kind, story, codes);
    const done = completedCodes(through, included, compiled.edges);
    const nextReady = included.find((n) => {
      if (done.has(n.stageCode)) return false;
      const preds = compiled.edges.filter((e) => e.toNodeKey === n.nodeKey).map((e) => e.fromNodeKey);
      return preds.every((k) => {
        const pred = included.find((x) => x.nodeKey === k);
        return !pred || done.has(pred.stageCode);
      });
    });

    const po = await prisma.productionOrder.create({
      data: {
        number: await nextDoc(prisma, 'production_order', opts.counters),
        salesOrderId: so.id,
        salesOrderLineId: line.id,
        customerId: dealer.id,
        productId: product.id,
        productDescription: line.description,
        quantity: line.quantity,
        specifications: line.specifications,
        requiredDeliveryDate: requiredDelivery,
        status: poStatusFor(story.kind),
        priority: so.priority,
        progressPercent: Math.round((done.size / Math.max(included.length, 1)) * 100),
        plannedStartDate: createdAt,
        createdById: opts.adminId,
        createdAt,
        updatedAt: createdAt,
        currentStageCode: nextReady?.stageCode ?? included.at(-1)?.stageCode,
      },
    });
    productionOrders += 1;

    const snapshot = await prisma.productionOrderWorkflowSnapshot.create({
      data: {
        productionOrderId: po.id,
        sourceWorkflowId: workflowId,
        sourceWorkflowVersionId: versionId,
        sourceVersionNumber: versionNumber,
        createdAt,
      },
    });

    const nodeIdByKey = new Map<string, string>();
    const taskRows: Array<{
      id: string;
      stageDefinitionId: string;
      stageInstanceId: string;
      stageCode: string;
      estimatedMinutes: number;
    }> = [];

    for (const n of included) {
      const completed = done.has(n.stageCode);
      const inProgress =
        !completed && nextReady?.stageCode === n.stageCode && isDemoStageInProgress(story.kind);
      const st = completed
        ? StageInstanceStatus.COMPLETED
        : inProgress
          ? story.kind === 'qc' || story.kind === 'rework_current'
            ? StageInstanceStatus.IN_PROGRESS
            : StageInstanceStatus.IN_PROGRESS
          : nextReady?.stageCode === n.stageCode
            ? StageInstanceStatus.READY
            : StageInstanceStatus.PENDING;
      const stageInstance = await prisma.productionStageInstance.create({
        data: {
          productionOrderId: po.id,
          stageDefinitionId: n.stageDefinitionId,
          status: st,
          progressPercent: completed ? 100 : inProgress ? 45 : 0,
        },
      });
      const snapNode = await prisma.productionOrderWorkflowSnapshotNode.create({
        data: {
          snapshotId: snapshot.id,
          sourceWorkflowNodeId: n.sourceWorkflowNodeId,
          stageDefinitionId: n.stageDefinitionId,
          stageInstanceId: stageInstance.id,
          nodeKey: n.nodeKey,
          stageCode: n.stageCode,
          nameArSnapshot: n.nameAr,
          nameEnSnapshot: n.nameEn,
          nameHeSnapshot: n.nameHe,
          isRequired: n.isRequired,
          isSkipped: false,
          responsibleDepartmentId: n.responsibleDepartmentId,
          responsibleDepartmentCode: n.responsibleDepartmentCode,
          estimatedMinutes: n.estimatedMinutes,
          estimateReviewRequired: false,
          requiresInspection: n.requiresInspection,
          requiresPhotos: false,
          sortOrder: n.sortOrder,
          displayX: n.displayX,
          displayY: n.displayY,
          metadata: n.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      nodeIdByKey.set(n.nodeKey, snapNode.id);
      const estimatedMinutes =
        n.estimatedMinutes ?? Math.max(30, Math.round((Number(line.quantity) || 1) * 45));
      const task = await prisma.productionTask.create({
        data: {
          number: await nextDoc(prisma, 'task', opts.counters),
          productionOrderId: po.id,
          stageDefinitionId: n.stageDefinitionId,
          stageInstanceId: stageInstance.id,
          name: n.nameEn,
          description: buildStageTaskInstructions({
            stageCode: n.stageCode,
            stageNameEn: n.nameEn,
            productDescription: line.description,
            quantity: Number(line.quantity),
            specifications: line.specifications,
          }),
          status: completed
            ? TaskStatus.COMPLETED
            : inProgress
              ? n.requiresInspection
                ? TaskStatus.READY_FOR_INSPECTION
                : TaskStatus.IN_PROGRESS
              : st === StageInstanceStatus.READY
                ? TaskStatus.READY
                : TaskStatus.NOT_STARTED,
          progressPercent: completed ? 100 : inProgress ? 45 : 0,
          estimatedMinutes,
          priority: so.priority,
          createdAt,
          updatedAt: createdAt,
        },
      });
      taskRows.push({
        id: task.id,
        stageDefinitionId: n.stageDefinitionId,
        stageInstanceId: stageInstance.id,
        stageCode: n.stageCode,
        estimatedMinutes,
      });
    }

    for (const e of compiled.edges) {
      const fromId = nodeIdByKey.get(e.fromNodeKey);
      const toId = nodeIdByKey.get(e.toNodeKey);
      if (!fromId || !toId) continue;
      await prisma.productionOrderWorkflowSnapshotEdge.create({
        data: {
          snapshotId: snapshot.id,
          fromSnapshotNodeId: fromId,
          toSnapshotNodeId: toId,
          dependencyType: 'HARD',
        },
      });
    }

    const dependsByInstance = new Map<string, string[]>();
    const codeByKey = new Map(included.map((n) => [n.nodeKey, n.stageCode]));
    for (const n of included) {
      const preds = compiled.edges
        .filter((e) => e.toNodeKey === n.nodeKey)
        .map((e) => codeByKey.get(e.fromNodeKey)!)
        .filter(Boolean);
      const inst = taskRows.find((t) => t.stageCode === n.stageCode);
      if (inst) dependsByInstance.set(inst.stageInstanceId, preds);
    }
    const stages = taskRows.map((t) => ({
      code: t.stageCode,
      stageDefinitionId: t.stageDefinitionId,
      dependsOnCodes: dependsByInstance.get(t.stageInstanceId) ?? [],
      estimatedMinutes: t.estimatedMinutes,
      departmentCode: included.find((n) => n.stageCode === t.stageCode)?.responsibleDepartmentCode ?? null,
      productionTaskId: t.id,
      stageInstanceId: t.stageInstanceId,
      isPinned: false,
      pinnedStart: null as Date | null,
      pinnedEnd: null as Date | null,
      preferredEmployeeId: null as string | null,
    }));
    pending.push({
      story,
      dealer,
      product,
      so,
      po,
      line,
      address,
      createdAt,
      requiredDelivery,
      totals,
      unit,
      done,
      nextReady,
      taskRows,
      stages,
      included,
    });
  }

  const planned = new Map<string, ReturnType<typeof planDemoAllocations>>();
  const waves = [
    pending.filter((p) => isHistoricalDemoKind(p.story.kind)),
    pending.filter((p) => isIntentionalLateKind(p.story.kind)),
    pending.filter((p) => !isHistoricalDemoKind(p.story.kind) && !isIntentionalLateKind(p.story.kind)),
  ];
  for (const wave of waves) {
    for (const p of wave) {
      planned.set(
        p.po.id,
        planDemoAllocations({
          story: p.story,
          poId: p.po.id,
          dealerId: p.dealer.id,
          priority: p.so.priority,
          createdAt: p.createdAt,
          requiredDelivery: p.requiredDelivery,
          asOf,
          stages: p.stages,
          completedCodes: p.done,
          calendar,
          workers,
          occupancy,
        }),
      );
    }
  }

  for (const p of pending) {
    const { story, dealer, product, so, po, address, createdAt, requiredDelivery, totals, unit, done, nextReady, taskRows, included } = p;
    const result = planned.get(po.id);
    if (!result) throw new Error(`Missing plan for ${po.number}`);

    const earliestStart =
      result.allocations.length > 0
        ? result.allocations.reduce(
            (min, a) => (a.plannedStart.getTime() < min.getTime() ? a.plannedStart : min),
            result.allocations[0]!.plannedStart,
          )
        : null;

    const approved =
      story.kind !== 'proposed' && story.kind !== 'at_risk_material' && story.kind !== 'at_risk_wip';
    const materialRisk = story.kind === 'at_risk_material';
    const wipRisk = story.kind === 'at_risk_wip';
    const committedLate = story.kind === 'at_risk_committed';
    const deliveredLike = isHistoricalDemoKind(story.kind);
    const committedDate = committedLate
      ? ammanLocal(2026, 8, 10, 16, 0)
      : deliveredLike
        ? atOrBefore(result.earliestCompletion ?? requiredDelivery, asOf)
        : null;

    const schedule = await prisma.productionSchedule.create({
      data: {
        productionOrderId: po.id,
        version: 1,
        status: wipRisk || materialRisk ? 'NEEDS_REVIEW' : approved ? 'APPROVED' : 'PROPOSED',
        promiseState:
          deliveredLike
            ? 'COMPLETED'
            : committedLate
              ? 'LATE'
              : materialRisk || wipRisk
                ? 'AT_RISK'
                : approved
                  ? 'CONFIRMED'
                  : 'AWAITING_APPROVAL',
        requestedDeliveryDate: requiredDelivery,
        requestedDateFeasible: !committedLate,
        earliestAvailableDate: result.earliestCompletion,
        suggestedDeliveryDate: result.earliestCompletion,
        committedCompletionDate: committedDate,
        committedDeliveryDate: committedDate,
        reason: null,
        generatedBy: opts.adminId,
        generatedAt: createdAt,
        requiresAdminEstimateReview: false,
        estimateConfidence: 'HIGH',
        estimateReviewStatus: 'NOT_REQUIRED',
        materialRisk,
        unschedulableReason: materialRisk ? 'MATERIAL_NOT_READY' : wipRisk ? 'WIP_NOT_READY' : null,
        approvedAt: approved ? createdAt : undefined,
        approvedById: approved ? opts.adminId : undefined,
      },
    });

    for (const alloc of result.allocations) {
      await prisma.scheduleAllocation.create({
        data: {
          scheduleId: schedule.id,
          productionTaskId: alloc.productionTaskId ?? undefined,
          stageInstanceId: alloc.stageInstanceId ?? undefined,
          resourceType: alloc.resourceType,
          employeeId: alloc.employeeId ?? undefined,
          plannedStart: alloc.plannedStart,
          plannedEnd: alloc.plannedEnd,
          estimatedMinutes: alloc.estimatedMinutes,
          isPinned: alloc.isPinned,
        },
      });
      if (alloc.productionTaskId) {
        const task = taskRows.find((t) => t.id === alloc.productionTaskId);
        const completed = task ? done.has(task.stageCode) : false;
        const inProgress =
          Boolean(task && nextReady?.stageCode === task.stageCode && !completed && isDemoStageInProgress(story.kind));
        await prisma.productionTask.update({
          where: { id: alloc.productionTaskId },
          data: {
            plannedStart: alloc.plannedStart,
            plannedCompletion: alloc.plannedEnd,
            estimatedMinutes: alloc.estimatedMinutes,
            assignedEmployeeId: alloc.employeeId ?? undefined,
            actualStart: completed || inProgress ? alloc.plannedStart : undefined,
            actualCompletion: completed ? alloc.plannedEnd : undefined,
            actualMinutes: completed ? alloc.estimatedMinutes : undefined,
          },
        });
        if (task) {
          await prisma.productionStageInstance.update({
            where: { id: task.stageInstanceId },
            data: {
              actualStart: completed || inProgress ? alloc.plannedStart : undefined,
              actualEnd: completed ? alloc.plannedEnd : undefined,
            },
          });
        }
      }
    }

    await prisma.productionOrder.update({
      where: { id: po.id },
      data: {
        ...(earliestStart ? { plannedStartDate: earliestStart } : {}),
        ...(result.earliestCompletion ? { plannedCompletionDate: result.earliestCompletion } : {}),
        ...(committedDate ? { committedDeliveryDate: committedDate } : {}),
        ...(done.size > 0 ? { actualStartDate: earliestStart ?? createdAt } : {}),
        ...(deliveredLike
          ? { actualCompletionDate: atOrBefore(result.earliestCompletion ?? requiredDelivery, asOf) }
          : {}),
      },
    });

    if (done.has('MATERIAL_PREP')) {
      const prepTask = taskRows.find((t) => t.stageCode === 'MATERIAL_PREP');
      const alloc = result.allocations.find((a) => a.productionTaskId === prepTask?.id);
      const at = alloc?.plannedStart ?? createdAt;
      for (const bom of product.bom) {
        const item = itemsBySku.get(bom.sku);
        if (!item) continue;
        const qty = bom.qty * story.qty;
        if (qty <= 0) continue;
        await applyDemoMovement(prisma, {
          type: InventoryTxType.PRODUCTION_ISSUE,
          itemId: item.id,
          warehouseId: opts.rawWhId,
          quantity: qty,
          unitCost: Number(item.standardCost),
          userId: opts.warehouseUserId,
          at,
          notes: `Issue ${po.number} ${bom.sku}`,
          referenceType: 'ProductionOrder',
          referenceId: po.id,
          counters: opts.counters,
        });
      }
    }

    const inspectionNeeded = included.some((n) => n.requiresInspection || n.stageCode === 'INSPECTION');
    const readyLike = story.kind === 'ready_delivery' || story.kind === 'packaging';
    if (inspectionNeeded && (deliveredLike || readyLike || story.kind === 'qc' || story.kind === 'rework_current')) {
      const fail = story.kind === 'rework_current' || story.kind === 'rework_historical';
      const inspectedAt =
        result.allocations.find((a) => taskRows.find((t) => t.id === a.productionTaskId)?.stageCode === 'INSPECTION')
          ?.plannedEnd ?? addDays(createdAt, 12);
      if (story.kind === 'rework_historical' || story.kind === 'rework_current') {
        const failInsp = await prisma.qualityInspection.create({
          data: {
            number: await nextDoc(prisma, 'quality', opts.counters),
            productionOrderId: po.id,
            stageCode: 'INSPECTION',
            inspectorId: opts.inspectorId,
            inspectedAt: addDays(inspectedAt, -2),
            result: QualityResult.FAILED_REWORK_REQUIRED,
            notes: 'Seam puckering on inside arm.',
            items: checklist
              ? {
                  create: checklist.items.map((it) => ({
                    checklistCode: it.code,
                    label: it.labelEn,
                    result:
                      it.code === 'FABRIC' ? ChecklistItemResult.FAIL : ChecklistItemResult.PASS,
                  })),
                }
              : undefined,
            defects: {
              create: {
                description: 'Upholstery seam puckering on inside arm',
                stageCode: 'UPHOLSTERY',
                severity: 'MAJOR',
                correctiveAction: 'Re-stitch arm and re-inspect',
              },
            },
          },
        });
        const rework = await prisma.reworkRequest.create({
          data: {
            number: await nextDoc(prisma, 'rework', opts.counters),
            productionOrderId: po.id,
            inspectionId: failInsp.id,
            description: 'Re-stitch inside arm and re-inspect.',
            status: story.kind === 'rework_current' ? 'AWAITING_STAGE' : 'COMPLETED',
            assignedToId: opts.inspectorId,
            completedAt: story.kind === 'rework_historical' ? inspectedAt : undefined,
            createdAt: addDays(inspectedAt, -2),
          },
        });
        void rework;
        void fail;
      }
      if (story.kind !== 'rework_current' && story.kind !== 'qc') {
        await prisma.qualityInspection.create({
          data: {
            number: await nextDoc(prisma, 'quality', opts.counters),
            productionOrderId: po.id,
            stageCode: 'INSPECTION',
            inspectorId: opts.inspectorId,
            inspectedAt,
            result: QualityResult.PASSED,
            notes: story.kind === 'rework_historical' ? 'Passed after rework.' : 'Final inspection passed.',
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
    }

    if (deliveredLike) {
      const deliveredAt = atOrBefore(result.earliestCompletion ?? requiredDelivery, asOf);
      const delivery = await prisma.delivery.create({
        data: {
          number: await nextDoc(prisma, 'delivery', opts.counters),
          salesOrderId: so.id,
          customerId: dealer.id,
          deliveryAddress: address,
          latitude: dealer.lat,
          longitude: dealer.lng,
          deliveryDate: deliveredAt,
          driverId: opts.driverId,
          vehicle: 'Hyundai H-1',
          status: DeliveryStatus.DELIVERED,
          recipientName: dealer.nameEn,
          createdAt: deliveredAt,
          updatedAt: deliveredAt,
          items: {
            create: [{ description: product.nameEn, quantity: money(story.qty) }],
          },
        },
      });
      void delivery;
      const paymentKind = story.payment ?? 'paid';
      const paid =
        paymentKind === 'paid' ? totals.lineTotal : paymentKind === 'partial' ? totals.lineTotal * 0.4 : 0;
      const invStatus =
        paid <= 0
          ? InvoiceStatus.ISSUED
          : paid + 0.01 >= totals.lineTotal
            ? InvoiceStatus.PAID
            : InvoiceStatus.PARTIALLY_PAID;
      const invoice = await prisma.invoice.create({
        data: {
          number: await nextDoc(prisma, 'invoice', opts.counters),
          customerId: dealer.id,
          salesOrderId: so.id,
          invoiceDate: deliveredAt,
          dueDate: addDays(deliveredAt, 30),
          currency: 'ILS',
          status: invStatus,
          subtotal: money(totals.subtotal),
          taxTotal: money(totals.taxAmount),
          total: money(totals.lineTotal),
          paidAmount: money(paid),
          outstandingAmount: money(totals.lineTotal - paid),
          createdById: opts.adminId,
          createdAt: deliveredAt,
          lines: {
            create: [
              {
                description: product.nameEn,
                quantity: money(story.qty),
                unitPrice: money(unit),
                taxRate: VAT,
                lineTotal: money(totals.lineTotal),
              },
            ],
          },
        },
      });
      if (paid > 0) {
        await prisma.payment.create({
          data: {
            number: await nextDoc(prisma, 'payment', opts.counters),
            customerId: dealer.id,
            invoiceId: invoice.id,
            paymentDate: atOrBefore(addDays(deliveredAt, 2), asOf),
            amount: money(paid),
            currency: 'ILS',
            method: PaymentMethod.BANK_TRANSFER,
            createdById: opts.adminId,
          },
        });
      }
      await prisma.statementEntry.create({
        data: {
          customerId: dealer.id,
          entryDate: deliveredAt,
          type: 'INVOICE',
          reference: invoice.number,
          debit: money(totals.lineTotal),
          credit: money(0),
          balance: money(totals.lineTotal),
          description: `Invoice ${invoice.number}`,
        },
      });
      if (paid > 0) {
        await prisma.statementEntry.create({
          data: {
            customerId: dealer.id,
            entryDate: atOrBefore(addDays(deliveredAt, 2), asOf),
            type: 'PAYMENT',
            reference: invoice.number,
            debit: money(0),
            credit: money(paid),
            balance: money(totals.lineTotal - paid),
            description: `Payment ${invoice.number}`,
          },
        });
      }
      if (story.returnInfo) {
        await prisma.returnRequest.create({
          data: {
            number: await nextDoc(prisma, 'return_request', opts.counters),
            customerId: dealer.id,
            salesOrderId: so.id,
            productDesc: product.nameEn,
            quantity: money(Math.min(story.returnInfo.qty, story.qty)),
            reason: story.returnInfo.reason,
            description: 'Dealer return from delivered order.',
            approvalStatus: story.returnInfo.approval,
            resolution:
              story.returnInfo.approval === 'APPROVED'
                ? ReturnResolution.CREDIT_NOTE
                : story.returnInfo.approval === 'REJECTED'
                  ? ReturnResolution.REJECTED
                  : undefined,
            inventoryFate:
              story.returnInfo.approval === 'APPROVED'
                ? ReturnInventoryFate.RETURN_TO_STOCK
                : ReturnInventoryFate.PENDING,
            createdAt: atOrBefore(addDays(deliveredAt, 4), asOf),
          },
        });
      }
    } else if (story.kind === 'ready_delivery') {
      const plannedDate =
        result.earliestCompletion && result.earliestCompletion.getTime() > requiredDelivery.getTime()
          ? result.earliestCompletion
          : requiredDelivery;
      const deliveryDate = plannedDate.getTime() < asOf.getTime() ? addDays(asOf, 3) : plannedDate;
      await prisma.delivery.create({
        data: {
          number: await nextDoc(prisma, 'delivery', opts.counters),
          salesOrderId: so.id,
          customerId: dealer.id,
          deliveryAddress: address,
          latitude: dealer.lat,
          longitude: dealer.lng,
          deliveryDate,
          driverId: opts.driverId,
          status: DeliveryStatus.PLANNED,
          createdAt: asOf,
          items: {
            create: [{ description: product.nameEn, quantity: money(story.qty) }],
          },
        },
      });
    }
  }

  const extraRfq = await nextDoc(prisma, 'rfq', opts.counters);
  const nile = dealerByUser.get('nile')!;
  const sofa = productBySku.get('SOF-3S-LUX')!;
  await prisma.requestForQuotation.create({
    data: {
      number: extraRfq,
      customerId: nile.id,
      source: RequestSource.WHATSAPP,
      status: RequestStatus.READY_FOR_QUOTATION,
      projectName: 'Nile luxury sofa enquiry',
      requiredDeliveryDate: addDays(asOf, 30),
      requestDate: addDays(asOf, -2),
      submittedAt: addDays(asOf, -1),
      createdById: opts.salesId,
      assignedSalesId: opts.salesId,
      items: {
        create: [
          {
            productId: sofa.id,
            productName: sofa.nameEn,
            quantity: money(1),
            fabricType: 'Velvet Navy',
            woodType: 'Walnut',
            notes: 'Need quote for Abdoun penthouse.',
          },
        ],
      },
    },
  });

  console.log(`  sales: ${salesOrders} SO · ${productionOrders} PO`);
  return { salesOrders, productionOrders };
}
