/**
 * Past-two-weeks mock sales for Nile / Oasis / Balqis — same shape as live confirm:
 * RFQ → quotation → sales order → production order → workflow snapshot → tasks → schedule.
 */
import {
  Prisma,
  PrismaClient,
  Priority,
  ProductionOrderStatus,
  QuotationStatus,
  RequestSource,
  RequestStatus,
  SalesOrderStatus,
  StageInstanceStatus,
  TaskStatus,
} from '@prisma/client';
import { compileWorkflow } from '../../../../apps/api/src/modules/production/workflow/domain/workflow-compiler';
import type {
  CompilerEdge,
  CompilerNode,
} from '../../../../apps/api/src/modules/production/workflow/domain/workflow-compiler';
import { backwardSchedule, forwardSchedule } from '../../../../apps/api/src/modules/scheduling/domain/schedule-planner';
import type {
  OccupancyInterval,
  PlannerOrderInput,
  TimeOfDayRange,
  WorkerCandidate,
} from '../../../../apps/api/src/modules/scheduling/domain/types';
import { WorkingCalendar } from '../../../../apps/api/src/modules/scheduling/domain/working-calendar';
import { buildStageTaskInstructions } from '../stage-task-instructions';
import { STANDARD_FURNITURE_WORKFLOW_CODE } from './workflow';
import type { DealerRef } from './people';
import type { ProductRef } from './catalog';
import {
  VAT,
  addDays,
  createRng,
  daysAgo,
  lineTotals,
  money,
  type Rng,
} from './util';

const DEFAULT_WORKING_WEEKDAYS = [0, 1, 2, 3, 4, 6];

const DEALER_SKU_PREF: Record<string, string[]> = {
  nile: [
    'SOF-3S-LUX',
    'SOF-L-SEC',
    'SOF-RECL',
    'ARM-02',
    'ARM-WING',
    'TABLE-DIN-8',
    'BED-K',
    'SOF-CORN',
  ],
  oasis: [
    'SOF-3S-STD',
    'SOF-2S',
    'ARM-01',
    'CHAIR-DIN',
    'TABLE-CF',
    'TABLE-DIN-6',
    'BED-Q',
    'SOF-MOD',
    'TABLE-SIDE',
  ],
  balqis: [
    'CUS-BANQ',
    'CUS-BOOT',
    'CUS-REC',
    'CUS-BAR',
    'CHAIR-DIN',
    'CHAIR-BAR',
    'BED-Q',
    'BED-TT',
    'TABLE-CONF',
    'CUS-WALL',
  ],
};

type SeqBag = {
  sales_order: number;
  production_order: number;
  task: number;
  rfq: number;
  quotation: number;
  invoice: number;
  payment: number;
  delivery: number;
  contract: number;
};

function pad5(n: number) {
  return String(n).padStart(5, '0');
}

async function nextDoc(
  prisma: PrismaClient,
  key: keyof SeqBag,
  prefix: string,
  counters: SeqBag,
): Promise<string> {
  counters[key] += 1;
  const year = new Date().getFullYear();
  await prisma.sequenceCounter.upsert({
    where: { key_year: { key, year } },
    create: { key, year, current: counters[key] },
    update: { current: counters[key] },
  });
  return `${prefix}-${year}-${pad5(counters[key])}`;
}

function progressForRecent(daysAgoCreated: number, rng: Rng): {
  soStatus: SalesOrderStatus;
  progress: number | null;
  priority: Priority;
} {
  if (daysAgoCreated <= 1) {
    const roll = rng.next();
    if (roll < 0.2) return { soStatus: SalesOrderStatus.DRAFT, progress: null, priority: Priority.NORMAL };
    if (roll < 0.4) return { soStatus: SalesOrderStatus.CONFIRMED, progress: null, priority: Priority.HIGH };
    if (roll < 0.55) {
      return { soStatus: SalesOrderStatus.WAITING_FOR_PAYMENT, progress: null, priority: Priority.NORMAL };
    }
    return {
      soStatus: SalesOrderStatus.READY_FOR_PRODUCTION,
      progress: rng.int(0, 8),
      priority: Priority.NORMAL,
    };
  }
  if (daysAgoCreated <= 5) {
    const roll = rng.next();
    if (roll < 0.1) {
      return { soStatus: SalesOrderStatus.WAITING_FOR_MATERIALS, progress: rng.int(5, 15), priority: Priority.HIGH };
    }
    if (roll < 0.35) {
      return {
        soStatus: SalesOrderStatus.READY_FOR_PRODUCTION,
        progress: rng.int(2, 12),
        priority: Priority.NORMAL,
      };
    }
    return {
      soStatus: SalesOrderStatus.IN_PRODUCTION,
      progress: rng.int(15, 55),
      priority: rng.chance(0.2) ? Priority.URGENT : Priority.NORMAL,
    };
  }
  if (daysAgoCreated <= 10) {
    const roll = rng.next();
    if (roll < 0.12) {
      return { soStatus: SalesOrderStatus.WAITING_FOR_MATERIALS, progress: rng.int(8, 20), priority: Priority.HIGH };
    }
    if (roll < 0.7) {
      return {
        soStatus: SalesOrderStatus.IN_PRODUCTION,
        progress: rng.int(35, 85),
        priority: rng.chance(0.25) ? Priority.HIGH : Priority.NORMAL,
      };
    }
    if (roll < 0.9) {
      return {
        soStatus: SalesOrderStatus.READY_FOR_DELIVERY,
        progress: rng.int(90, 100),
        priority: Priority.HIGH,
      };
    }
    return { soStatus: SalesOrderStatus.DELIVERED, progress: 100, priority: Priority.NORMAL };
  }
  // days 11–13
  const roll = rng.next();
  if (roll < 0.45) {
    return {
      soStatus: SalesOrderStatus.IN_PRODUCTION,
      progress: rng.int(50, 90),
      priority: Priority.NORMAL,
    };
  }
  if (roll < 0.7) {
    return {
      soStatus: SalesOrderStatus.READY_FOR_DELIVERY,
      progress: rng.int(92, 100),
      priority: Priority.HIGH,
    };
  }
  if (roll < 0.9) return { soStatus: SalesOrderStatus.DELIVERED, progress: 100, priority: Priority.NORMAL };
  return { soStatus: SalesOrderStatus.COMPLETED, progress: 100, priority: Priority.NORMAL };
}

function productionStatusFor(progress: number): ProductionOrderStatus {
  if (progress >= 100) return ProductionOrderStatus.COMPLETED;
  if (progress >= 90) return ProductionOrderStatus.READY_FOR_DELIVERY;
  if (progress >= 78) return ProductionOrderStatus.QUALITY_CHECK;
  if (progress > 0) return ProductionOrderStatus.IN_PROGRESS;
  return ProductionOrderStatus.PLANNED;
}

function stageStatuses(progress: number, stageCount: number): StageInstanceStatus[] {
  const activeIdx = Math.min(stageCount - 1, Math.floor((progress / 100) * stageCount));
  return Array.from({ length: stageCount }, (_, i) => {
    if (progress >= 100) return StageInstanceStatus.COMPLETED;
    if (i < activeIdx) return StageInstanceStatus.COMPLETED;
    if (i === activeIdx) {
      if (progress === 0) return StageInstanceStatus.READY;
      return StageInstanceStatus.IN_PROGRESS;
    }
    if (i === activeIdx + 1 && progress > 0) return StageInstanceStatus.READY;
    return StageInstanceStatus.PENDING;
  });
}

function taskStatusFor(stage: StageInstanceStatus): TaskStatus {
  if (stage === StageInstanceStatus.COMPLETED) return TaskStatus.COMPLETED;
  if (stage === StageInstanceStatus.IN_PROGRESS) return TaskStatus.IN_PROGRESS;
  if (stage === StageInstanceStatus.READY) return TaskStatus.READY;
  if (stage === StageInstanceStatus.SKIPPED) return TaskStatus.CANCELLED;
  return TaskStatus.NOT_STARTED;
}

function pickProductsForDealer(
  dealer: DealerRef,
  products: ProductRef[],
  rng: Rng,
  count: number,
): ProductRef[] {
  const pref = DEALER_SKU_PREF[dealer.username] ?? [];
  const preferred = products.filter((p) => pref.includes(p.sku));
  const pool = preferred.length ? preferred : products;
  const picked: ProductRef[] = [];
  for (let i = 0; i < count; i += 1) {
    picked.push(rng.pick(pool));
  }
  return picked;
}

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
    throw new Error('No published STANDARD_FURNITURE workflow to snapshot.');
  }

  const version = await prisma.productionWorkflowVersion.findUniqueOrThrow({
    where: { id: workflow.activeVersionId },
    include: {
      nodes: { include: { stageDefinition: true } },
      edges: true,
    },
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
    requiresPhotosOverride: n.requiresPhotosOverride,
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
      requiresPhotos: n.stageDefinition.requiresPhotos,
      responsibleDepartment: n.stageDefinition.responsibleDepartment,
    },
  }));

  const edges: CompilerEdge[] = version.edges.map((e) => ({
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
    dependencyType: 'HARD' as const,
  }));

  const productOverrides =
    config?.stageOverrides.map((o) => ({
      workflowNodeId: o.workflowNodeId,
      stageDefinitionId: o.stageDefinitionId,
      applicability: o.applicability,
      estimatedMinutes: o.estimatedMinutes,
      responsibleDepartmentId: o.responsibleDepartmentId,
    })) ?? [];

  const productEstimateMinutes: Record<string, number | null> = {};
  if (productId) {
    const estimates = await prisma.productStageEstimate.findMany({ where: { productId } });
    for (const e of estimates) {
      const minutes =
        e.fixedMinutes ||
        (e.setupMinutes ?? 0) + (e.minutesPerUnit ?? 0);
      productEstimateMinutes[e.stageDefinitionId] = minutes || null;
    }
  }

  const compiled = compileWorkflow({
    nodes,
    edges,
    productOverrides,
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

async function ensureFactoryCalendar(prisma: PrismaClient) {
  let row = await prisma.factoryCalendar.findFirst({ where: { isDefault: true } });
  if (!row) {
    row = await prisma.factoryCalendar.create({
      data: {
        name: 'Default',
        timezone: 'Asia/Amman',
        workingWeekdays: DEFAULT_WORKING_WEEKDAYS,
        shiftStart: '08:00',
        shiftEnd: '16:00',
        breaks: [{ start: '12:00', end: '13:00' }] as unknown as Prisma.InputJsonValue,
        isDefault: true,
      },
    });
  }
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

export async function seedDealerOrdersRecent(
  prisma: PrismaClient,
  opts: {
    adminId: string;
    dealers: DealerRef[];
    products: ProductRef[];
    stageAssignees: Record<string, string[]>;
  },
): Promise<{ salesOrders: number; productionOrders: number; schedules: number }> {
  const rng = createRng(20260812);
  const calendar = await ensureFactoryCalendar(prisma);
  const workers = await loadWorkers(prisma);
  const occupancy: OccupancyInterval[] = [];

  const counters: SeqBag = {
    sales_order: 0,
    production_order: 0,
    task: 0,
    rfq: 0,
    quotation: 0,
    invoice: 0,
    payment: 0,
    delivery: 0,
    contract: 0,
  };

  let salesOrders = 0;
  let productionOrders = 0;
  let schedules = 0;

  // Day 13 → 0 (oldest first) so schedules accumulate occupancy realistically.
  for (let day = 13; day >= 0; day -= 1) {
    const createdAt = daysAgo(day);
    createdAt.setHours(9 + rng.int(0, 6), rng.int(0, 59), 0, 0);
    const weekday = createdAt.getDay();
    const weekendish = weekday === 5; // Friday quieter

    for (const dealer of opts.dealers) {
      const baseChance = weekendish ? 0.45 : 0.85;
      const orderCount = rng.chance(baseChance) ? (rng.chance(0.35) ? 2 : 1) : 0;
      if (orderCount === 0) continue;

      for (let o = 0; o < orderCount; o += 1) {
        const lineProducts = pickProductsForDealer(
          dealer,
          opts.products,
          rng,
          rng.chance(0.22) ? 2 : 1,
        );
        const { soStatus, progress, priority } = progressForRecent(day, rng);
        const deliveryOffset = rng.int(12, 28);
        const requiredDelivery = addDays(createdAt, deliveryOffset);
        const projectName = `${dealer.nameEn.split(' ')[0]} · ${lineProducts[0]!.nameEn}${
          lineProducts.length > 1 ? ` +${lineProducts.length - 1}` : ''
        }`;

        const lineSpecs = lineProducts.map((product) => {
          const qty =
            product.categoryCode === 'CHAIR' ? rng.int(2, 12) : rng.int(1, product.categoryCode === 'CUSTOM' ? 6 : 4);
          const dealerPrice = Number(product.basePrice) * (['nile', 'balqis'].includes(dealer.username) ? 0.94 : 0.9);
          const unit = dealerPrice * (0.97 + rng.next() * 0.08);
          const totals = lineTotals(qty, unit);
          const mfg = Number(product.manufacturingCost ?? unit * 0.45) * qty;
          return { product, qty, unit, totals, mfg };
        });

        const subtotal = lineSpecs.reduce((s, l) => s + l.totals.subtotal, 0);
        const taxTotal = lineSpecs.reduce((s, l) => s + l.totals.taxAmount, 0);
        const total = lineSpecs.reduce((s, l) => s + l.totals.lineTotal, 0);
        const mfgTotal = lineSpecs.reduce((s, l) => s + l.mfg, 0);

        let quotationId: string | undefined;
        if (soStatus !== SalesOrderStatus.DRAFT || rng.chance(0.35)) {
          const rfqNumber = await nextDoc(prisma, 'rfq', 'RFQ', counters);
          const rfq = await prisma.requestForQuotation.create({
            data: {
              number: rfqNumber,
              customerId: dealer.id,
              source: rng.chance(0.6) ? RequestSource.PORTAL : RequestSource.SALES,
              status: RequestStatus.QUOTED,
              priority,
              projectName,
              requiredDeliveryDate: requiredDelivery,
              externalOrderNumber: `PO-${dealer.username.toUpperCase()}-${rng.int(100, 999)}`,
              requestDate: addDays(createdAt, -2),
              submittedAt: addDays(createdAt, -1),
              createdById: opts.adminId,
              assignedSalesId: opts.adminId,
              createdAt: addDays(createdAt, -2),
              updatedAt: addDays(createdAt, -1),
              items: {
                create: lineSpecs.map((l, idx) => ({
                  productId: l.product.id,
                  productName: l.product.nameEn,
                  quantity: money(l.qty),
                  fabricType: rng.pick(['Velvet', 'Linen', 'Bouclé', 'Leatherette']),
                  fabricCode: `FAB-${rng.int(100, 999)}`,
                  woodType: rng.pick(['Beech', 'Oak', 'Walnut']),
                  sortOrder: idx,
                })),
              },
            },
          });

          const qNumber = await nextDoc(prisma, 'quotation', 'Q', counters);
          const quote = await prisma.quotation.create({
            data: {
              number: qNumber,
              version: 1,
              customerId: dealer.id,
              requestId: rfq.id,
              status: QuotationStatus.ACCEPTED,
              issueDate: addDays(createdAt, -1),
              expirationDate: addDays(createdAt, 21),
              salesRepId: opts.adminId,
              createdById: opts.adminId,
              sentAt: addDays(createdAt, -1),
              acceptedAt: createdAt,
              subtotal: money(subtotal),
              taxTotal: money(taxTotal),
              total: money(total),
              paymentTerms: '30% deposit, balance on delivery',
              createdAt: addDays(createdAt, -1),
              updatedAt: createdAt,
              lines: {
                create: lineSpecs.map((l, idx) => ({
                  productId: l.product.id,
                  description: l.product.nameEn,
                  quantity: money(l.qty),
                  unitPrice: money(l.unit),
                  taxRate: VAT,
                  subtotal: money(l.totals.subtotal),
                  taxAmount: money(l.totals.taxAmount),
                  lineTotal: money(l.totals.lineTotal),
                  sortOrder: idx,
                })),
              },
            },
          });
          quotationId = quote.id;
        }

        const soNumber = await nextDoc(prisma, 'sales_order', 'SO', counters);
        const so = await prisma.salesOrder.create({
          data: {
            number: soNumber,
            customerId: dealer.id,
            quotationId,
            orderDate: createdAt,
            requiredDeliveryDate: requiredDelivery,
            status: soStatus,
            priority,
            projectName,
            externalOrderNumber: `EXT-${dealer.username.toUpperCase()}-${rng.int(1000, 9999)}`,
            deliveryAddress: `${dealer.nameEn}, Amman, Jordan`,
            paymentTerms: '30% deposit, balance on delivery',
            assignedEmployeeId: opts.adminId,
            notes: rng.chance(0.28) ? 'Match approved fabric / finish sample on file.' : null,
            subtotal: money(subtotal),
            taxTotal: money(taxTotal),
            total: money(total),
            manufacturingCost: money(mfgTotal),
            costBreakdown: {
              fabricCost: mfgTotal * 0.35,
              woodCost: mfgTotal * 0.4,
              foamCost: mfgTotal * 0.15,
              accessoriesCost: mfgTotal * 0.1,
            },
            depositRequired: money(total * 0.3),
            createdById: opts.adminId,
            createdAt,
            updatedAt: createdAt,
            lines: {
              create: lineSpecs.map((l, idx) => ({
                productId: l.product.id,
                description: l.product.nameEn,
                specifications: rng.chance(0.4)
                  ? `${rng.pick(['Sand velvet', 'Charcoal linen', 'Walnut stain', 'White lacquer'])}`
                  : null,
                quantity: money(l.qty),
                unitPrice: money(l.unit),
                taxRate: VAT,
                lineTotal: money(l.totals.lineTotal),
                productionRequired: true,
                deliveryRequired: true,
                sortOrder: idx,
              })),
            },
          },
          include: { lines: true },
        });
        salesOrders += 1;

        const needsProduction =
          progress != null &&
          ![SalesOrderStatus.DRAFT, SalesOrderStatus.CONFIRMED, SalesOrderStatus.WAITING_FOR_PAYMENT].includes(
            soStatus,
          );

        if (!needsProduction) continue;

        for (let li = 0; li < so.lines.length; li += 1) {
          const line = so.lines[li]!;
          const spec = lineSpecs[li]!;
          if (!line.productId) continue;

          const { workflowId, versionId, versionNumber, compiled } = await loadCompiledWorkflow(
            prisma,
            line.productId,
          );

          const poNumber = await nextDoc(prisma, 'production_order', 'PO', counters);
          const poStatus = productionStatusFor(progress!);
          const po = await prisma.productionOrder.create({
            data: {
              number: poNumber,
              salesOrderId: so.id,
              salesOrderLineId: line.id,
              customerId: dealer.id,
              productId: line.productId,
              productDescription: line.description,
              quantity: line.quantity,
              specifications: line.specifications,
              requiredDeliveryDate: requiredDelivery,
              status: poStatus,
              priority,
              progressPercent: progress!,
              plannedStartDate: createdAt,
              createdById: opts.adminId,
              createdAt,
              updatedAt: createdAt,
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

          const included = [...compiled.included].sort((a, b) => a.sortOrder - b.sortOrder);
          const statuses = stageStatuses(progress!, included.length);
          const nodeIdByKey = new Map<string, string>();
          const stageInstanceIds: string[] = [];
          const taskRows: Array<{
            id: string;
            stageDefinitionId: string;
            stageInstanceId: string;
            stageCode: string;
            estimatedMinutes: number;
          }> = [];

          for (let si = 0; si < included.length; si += 1) {
            const n = included[si]!;
            const st = statuses[si]!;
            const stageProgress =
              st === StageInstanceStatus.COMPLETED
                ? 100
                : st === StageInstanceStatus.IN_PROGRESS
                  ? rng.int(20, 80)
                  : 0;

            const stageInstance = await prisma.productionStageInstance.create({
              data: {
                productionOrderId: po.id,
                stageDefinitionId: n.stageDefinitionId,
                status: st,
                progressPercent: stageProgress,
                actualStart:
                  st === StageInstanceStatus.IN_PROGRESS || st === StageInstanceStatus.COMPLETED
                    ? addDays(createdAt, Math.min(si, day))
                    : undefined,
                actualEnd: st === StageInstanceStatus.COMPLETED ? addDays(createdAt, Math.min(si + 1, day)) : undefined,
              },
            });
            stageInstanceIds.push(stageInstance.id);

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
                estimateReviewRequired: n.estimateReviewRequired,
                requiresInspection: n.requiresInspection,
                requiresPhotos: n.requiresPhotos,
                sortOrder: n.sortOrder,
                displayX: n.displayX,
                displayY: n.displayY,
                metadata: n.metadata as Prisma.InputJsonValue | undefined,
              },
            });
            nodeIdByKey.set(n.nodeKey, snapNode.id);

            const assignees = opts.stageAssignees[n.stageCode] ?? [];
            const assignee =
              assignees.length && (st === StageInstanceStatus.IN_PROGRESS || st === StageInstanceStatus.COMPLETED)
                ? rng.pick(assignees)
                : assignees.length && st === StageInstanceStatus.READY
                  ? rng.pick(assignees)
                  : undefined;

            const estimatedMinutes =
              n.estimatedMinutes ??
              Math.max(30, Math.round((Number(spec.qty) || 1) * 45));

            const taskNumber = await nextDoc(prisma, 'task', 'TSK', counters);
            const task = await prisma.productionTask.create({
              data: {
                number: taskNumber,
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
                status: taskStatusFor(st),
                progressPercent: stageProgress,
                estimatedMinutes,
                assignedEmployeeId: assignee,
                priority,
                actualStart: stageInstance.actualStart ?? undefined,
                actualCompletion: stageInstance.actualEnd ?? undefined,
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

          const activeIdx = statuses.findIndex(
            (s) => s === StageInstanceStatus.IN_PROGRESS || s === StageInstanceStatus.READY,
          );
          const currentCode =
            activeIdx >= 0 ? included[activeIdx]!.stageCode : included[included.length - 1]?.stageCode;
          if (currentCode) {
            await prisma.productionOrder.update({
              where: { id: po.id },
              data: { currentStageCode: currentCode },
            });
          }

          // Schedule (same planner as live SchedulingService)
          const dependsByInstance = new Map<string, string[]>();
          const codeByKey = new Map(included.map((n) => [n.nodeKey, n.stageCode]));
          const keyByCode = new Map(included.map((n) => [n.stageCode, n.nodeKey]));
          for (const n of included) {
            const preds = compiled.edges
              .filter((e) => e.toNodeKey === n.nodeKey)
              .map((e) => codeByKey.get(e.fromNodeKey)!)
              .filter(Boolean);
            const inst = taskRows.find((t) => t.stageCode === n.stageCode);
            if (inst) dependsByInstance.set(inst.stageInstanceId, preds);
          }
          void keyByCode;

          const stages = taskRows.map((t) => ({
            code: t.stageCode,
            stageDefinitionId: t.stageDefinitionId,
            dependsOnCodes: dependsByInstance.get(t.stageInstanceId) ?? [],
            estimatedMinutes: t.estimatedMinutes,
            departmentCode:
              included.find((n) => n.stageCode === t.stageCode)?.responsibleDepartmentCode ?? null,
            productionTaskId: t.id,
            stageInstanceId: t.stageInstanceId,
            isPinned: false,
            pinnedStart: null as Date | null,
            pinnedEnd: null as Date | null,
            preferredEmployeeId: null as string | null,
          }));

          const totalMinutes = stages.reduce((sum, s) => sum + s.estimatedMinutes, 0);
          const orderInput: PlannerOrderInput = {
            id: po.id,
            customerId: dealer.id,
            priority,
            committedDeliveryDate: null,
            requestedDeliveryDate: requiredDelivery,
            createdAt,
            stages,
            bufferMinutes: Math.round(0.1 * totalMinutes),
          };

          const now = createdAt;
          const ctx = { calendar, workers, existingOccupancy: occupancy, now };
          const result = requiredDelivery
            ? backwardSchedule([orderInput], ctx)
            : forwardSchedule([orderInput], ctx);

          const earliestStart =
            result.allocations.length > 0
              ? result.allocations.reduce(
                  (min, a) => (a.plannedStart.getTime() < min.getTime() ? a.plannedStart : min),
                  result.allocations[0]!.plannedStart,
                )
              : null;

          const productHasEstimates =
            (await prisma.productStageEstimate.count({ where: { productId: line.productId } })) > 0 &&
            Boolean(
              await prisma.productProductionProfile.findUnique({
                where: { productId: line.productId },
              }),
            );
          const requiresReview = !productHasEstimates;

          const schedule = await prisma.productionSchedule.create({
            data: {
              productionOrderId: po.id,
              version: 1,
              status: progress! >= 100 ? 'APPROVED' : 'PROPOSED',
              promiseState: progress! >= 100 ? 'CONFIRMED' : 'AWAITING_APPROVAL',
              requestedDeliveryDate: requiredDelivery,
              earliestAvailableDate: result.earliestCompletion,
              suggestedDeliveryDate: result.earliestCompletion,
              committedCompletionDate: result.usedBackward ? requiredDelivery : null,
              committedDeliveryDate: progress! >= 90 ? requiredDelivery : null,
              reason: 'seed:dealer-orders-recent',
              generatedBy: opts.adminId,
              generatedAt: createdAt,
              requiresAdminEstimateReview: requiresReview,
              estimateConfidence: requiresReview ? 'LOW' : 'HIGH',
              estimateReviewStatus: requiresReview ? 'PENDING' : 'NOT_REQUIRED',
              approvedAt: progress! >= 100 ? createdAt : undefined,
              approvedById: progress! >= 100 ? opts.adminId : undefined,
            },
          });
          schedules += 1;

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
            if (alloc.employeeId) {
              occupancy.push({
                employeeId: alloc.employeeId,
                start: alloc.plannedStart,
                end: alloc.plannedEnd,
                allocationId: 'seed',
              });
            }
            if (alloc.productionTaskId) {
              await prisma.productionTask.update({
                where: { id: alloc.productionTaskId },
                data: {
                  plannedStart: alloc.plannedStart,
                  plannedCompletion: alloc.plannedEnd,
                  estimatedMinutes: alloc.estimatedMinutes,
                  ...(alloc.employeeId ? { assignedEmployeeId: alloc.employeeId } : {}),
                },
              });
            }
          }

          await prisma.productionOrder.update({
            where: { id: po.id },
            data: {
              ...(earliestStart ? { plannedStartDate: earliestStart } : {}),
              ...(result.earliestCompletion ? { plannedCompletionDate: result.earliestCompletion } : {}),
              ...(progress! >= 100
                ? { committedDeliveryDate: requiredDelivery, actualCompletionDate: addDays(createdAt, Math.min(day, 10)) }
                : {}),
              ...(progress! > 0 ? { actualStartDate: createdAt } : {}),
            },
          });
        }
      }
    }
  }

  return { salesOrders, productionOrders, schedules };
}
