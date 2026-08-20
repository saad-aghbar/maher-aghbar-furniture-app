import { PrismaClient } from '@prisma/client';
import { classifyScheduleRisk, isInternalScheduleReason } from '../../../../apps/api/src/modules/scheduling/domain/at-risk';
import { STANDARD_FURNITURE_STAGE_CODES } from '../seed/workflow';
import { demoAsOf } from './clock';

export class DemoValidationError extends Error {
  constructor(readonly failures: string[]) {
    super(`demo:validate failed (${failures.length})\n${failures.map((f) => `  - ${f}`).join('\n')}`);
    this.name = 'DemoValidationError';
  }
}

const FORBIDDEN = /\b(UAT|DRUAT|TEST|MOCK|SAMPLE|Lorem)\b/i;

export async function validateDemoFactory(prisma: PrismaClient): Promise<void> {
  const asOf = demoAsOf();
  const failures: string[] = [];
  const fail = (msg: string) => failures.push(msg);

  const delivered = await prisma.salesOrder.findMany({
    where: { status: 'DELIVERED' },
    include: {
      deliveries: true,
      productionOrders: { include: { tasks: true } },
    },
  });
  for (const so of delivered) {
    const okDelivery = so.deliveries.some((d) => d.status === 'DELIVERED');
    if (!okDelivery) fail(`${so.number}: DELIVERED SO without DELIVERED delivery`);
    const active = so.productionOrders.flatMap((po) =>
      po.tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status)),
    );
    if (active.length) fail(`${so.number}: DELIVERED SO has active production tasks`);
  }

  const deliveries = await prisma.delivery.findMany({ include: { salesOrder: true } });
  for (const d of deliveries) {
    if (!d.salesOrder) {
      fail(`${d.number}: delivery without sales order`);
      continue;
    }
    if (d.status === 'DELIVERED' && d.salesOrder.status !== 'DELIVERED') {
      fail(`${d.number}: DELIVERED delivery but SO is ${d.salesOrder.status}`);
    }
    if (d.status === 'PLANNED' && d.salesOrder.status !== 'READY_FOR_DELIVERY') {
      fail(`${d.number}: planned delivery but SO is ${d.salesOrder.status}`);
    }
  }

  const inProd = await prisma.salesOrder.findMany({
    where: { status: 'IN_PRODUCTION' },
    include: { productionOrders: { include: { tasks: true } } },
  });
  for (const so of inProd) {
    const started = so.productionOrders.flatMap((po) =>
      po.tasks.filter((t) => ['IN_PROGRESS', 'PAUSED', 'COMPLETED', 'READY_FOR_INSPECTION', 'BLOCKED'].includes(t.status)),
    );
    if (!started.length) fail(`${so.number}: IN_PRODUCTION with zero started tasks`);
  }

  const waiting = await prisma.salesOrder.findMany({
    where: { status: 'WAITING_FOR_MATERIALS' },
    include: { productionOrders: { include: { tasks: true } } },
  });
  for (const so of waiting) {
    const started = so.productionOrders.flatMap((po) =>
      po.tasks.filter((t) => !['NOT_STARTED', 'READY', 'CANCELLED'].includes(t.status)),
    );
    if (started.length) fail(`${so.number}: WAITING_FOR_MATERIALS has started tasks`);
  }

  const snapshots = await prisma.productionOrderWorkflowSnapshot.findMany({
    include: {
      nodes: true,
      edges: true,
      productionOrder: { include: { stages: true } },
    },
  });
  for (const snap of snapshots) {
    const instById = new Map(snap.productionOrder.stages.map((s) => [s.id, s]));
    const nodeById = new Map(snap.nodes.map((n) => [n.id, n]));
    for (const edge of snap.edges) {
      const from = nodeById.get(edge.fromSnapshotNodeId);
      const to = nodeById.get(edge.toSnapshotNodeId);
      if (!from || !to) continue;
      const fromInst = from.stageInstanceId ? instById.get(from.stageInstanceId) : undefined;
      const toInst = to.stageInstanceId ? instById.get(to.stageInstanceId) : undefined;
      if (toInst?.status === 'COMPLETED' && fromInst && fromInst.status !== 'COMPLETED') {
        fail(`${snap.productionOrderId}: ${to.stageCode} completed before predecessor ${from.stageCode}`);
      }
    }
  }

  const pos = await prisma.productionOrder.findMany({
    where: { status: { notIn: ['DRAFT', 'CANCELLED'] } },
    include: {
      workflowSnapshot: true,
      inspections: true,
      reworkRequests: true,
      salesOrder: { include: { deliveries: true } },
    },
  });
  for (const po of pos) {
    if (!po.workflowSnapshot) fail(`${po.number}: confirmed PO missing workflow snapshot`);
    const deliveredSo = po.salesOrder?.status === 'DELIVERED';
    const hasInspectionNode = true;
    if (deliveredSo && hasInspectionNode) {
      const passed = po.inspections.some((i) => i.result === 'PASSED' || i.result === 'PASSED_WITH_NOTES');
      const failed = po.inspections.some((i) => i.result === 'FAILED_REWORK_REQUIRED' || i.result === 'BLOCKED');
      if (!passed) fail(`${po.number}: delivered without passing QC`);
      if (failed && !po.reworkRequests.some((r) => r.status === 'COMPLETED')) {
        fail(`${po.number}: failed QC delivered without completed rework`);
      }
    }
  }

  const allocations = await prisma.scheduleAllocation.findMany({
    where: { employeeId: { not: null } },
    include: {
      employee: { include: { workerSkills: { where: { isActive: true } } } },
      productionTask: true,
      schedule: true,
    },
  });
  const activeSched = new Set(['APPROVED', 'PROPOSED', 'NEEDS_REVIEW']);
  const byEmployee = new Map<string, typeof allocations>();
  for (const a of allocations) {
    if (!a.employeeId || !activeSched.has(a.schedule.status)) continue;
    const skills = new Set(a.employee?.workerSkills.map((s) => s.stageDefinitionId) ?? []);
    const stageId = a.productionTask?.stageDefinitionId;
    if (stageId && !skills.has(stageId)) {
      fail(`allocation ${a.id}: worker lacks skill for stage`);
    }
    const list = byEmployee.get(a.employeeId) ?? [];
    list.push(a);
    byEmployee.set(a.employeeId, list);
  }
  for (const [emp, list] of byEmployee) {
    const sorted = [...list].sort((a, b) => a.plannedStart.getTime() - b.plannedStart.getTime());
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i]!.plannedStart < sorted[i - 1]!.plannedEnd) {
        fail(`exclusive overlap for worker ${emp} (${sorted[i - 1]!.id} vs ${sorted[i]!.id})`);
      }
    }
  }

  const calendar = await prisma.factoryCalendar.findFirst({ where: { isDefault: true } });
  const exceptions = calendar
    ? await prisma.factoryCalendarException.findMany({ where: { calendarId: calendar.id } })
    : [];
  const extraShiftDays = new Set(
    exceptions.filter((e) => e.type === 'EXTRA_SHIFT').map((e) => e.date.toISOString().slice(0, 10)),
  );
  const working = new Set(calendar?.workingWeekdays ?? [0, 1, 2, 3, 4, 6]);
  for (const a of allocations) {
    if (!activeSched.has(a.schedule.status)) continue;
    const local = new Date(a.plannedStart.getTime() + 3 * 3600 * 1000);
    const ymd = local.toISOString().slice(0, 10);
    const weekday = local.getUTCDay();
    if (!working.has(weekday) && !extraShiftDays.has(ymd) && !a.isPinned) {
      fail(`allocation ${a.id} on closed weekday ${weekday} ${ymd}`);
    }
  }

  const balances = await prisma.inventoryBalance.findMany();
  const txs = await prisma.inventoryTransaction.findMany();
  const txSum = new Map<string, number>();
  for (const tx of txs) {
    const key = `${tx.inventoryItemId}|${tx.warehouseId}|${tx.locationId ?? ''}`;
    txSum.set(key, (txSum.get(key) ?? 0) + Number(tx.quantity));
  }
  for (const b of balances) {
    const key = `${b.inventoryItemId}|${b.warehouseId}|${b.locationId ?? ''}`;
    const sum = txSum.get(key) ?? 0;
    if (Math.abs(sum - Number(b.availableQty)) > 0.02) {
      fail(`balance ${b.inventoryItemId} avail ${b.availableQty} ≠ tx sum ${sum}`);
    }
  }

  const receipts = await prisma.goodsReceipt.findMany({
    include: { purchaseOrder: true, lines: true },
  });
  for (const grn of receipts) {
    if (grn.receiptDate < grn.purchaseOrder.orderDate) {
      fail(`${grn.number}: GRN before PO date`);
    }
    const ordered = await prisma.purchaseOrderLine.findMany({
      where: { purchaseOrderId: grn.purchaseOrderId },
    });
    for (const line of grn.lines) {
      const poLine = ordered.find((l) => l.inventoryItemId === line.inventoryItemId);
      if (poLine && Number(line.receivedQty) - Number(poLine.quantity) > 0.001) {
        fail(`${grn.number}: received ${line.receivedQty} > ordered ${poLine.quantity}`);
      }
    }
  }

  const invoices = await prisma.invoice.findMany({
    include: { payments: true, salesOrder: { include: { lines: true } } },
  });
  for (const inv of invoices) {
    const paySum = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    if (paySum - Number(inv.total) > 0.02) fail(`${inv.number}: payments exceed invoice total`);
    if (Math.abs(paySum - Number(inv.paidAmount)) > 0.02) {
      fail(`${inv.number}: paidAmount ${inv.paidAmount} ≠ payment sum ${paySum}`);
    }
    if (inv.salesOrder) {
      const soTotal = Number(inv.salesOrder.total);
      if (Math.abs(soTotal - Number(inv.total)) > 0.05) {
        fail(`${inv.number}: invoice total ${inv.total} ≠ SO ${soTotal}`);
      }
    }
  }

  const returns = await prisma.returnRequest.findMany({ include: { salesOrder: { include: { lines: true } } } });
  for (const r of returns) {
    if (!r.salesOrder) {
      fail(`${r.number}: return without sales order`);
      continue;
    }
    if (r.salesOrder.status !== 'DELIVERED') fail(`${r.number}: return on non-delivered SO`);
    const ordered = r.salesOrder.lines.reduce((s, l) => s + Number(l.quantity), 0);
    if (Number(r.quantity) - ordered > 0.001) fail(`${r.number}: return qty > ordered`);
  }

  const schedules = await prisma.productionSchedule.findMany({
    include: { productionOrder: true },
  });
  const latest = new Map<string, (typeof schedules)[number]>();
  for (const s of schedules) {
    const prev = latest.get(s.productionOrderId);
    if (!prev || s.version > prev.version) latest.set(s.productionOrderId, s);
  }
  let mayBeLate = 0;
  for (const s of latest.values()) {
    if (!activeSched.has(s.status)) continue;
    const classification = classifyScheduleRisk({
      productionOrderStatus: s.productionOrder.status,
      scheduleStatus: s.status,
      committedDeliveryDate: s.committedDeliveryDate,
      requestedDeliveryDate: s.requestedDeliveryDate,
      projectedCompletion: s.suggestedDeliveryDate,
      requestedDateFeasible: s.requestedDateFeasible,
      unschedulableReason: s.unschedulableReason,
      requiresAdminEstimateReview: s.requiresAdminEstimateReview,
      materialRisk: s.materialRisk,
      now: asOf,
    });
    if (classification.contributesToMayBeLate) mayBeLate += 1;
    if (s.productionOrder.committedDeliveryDate && s.committedDeliveryDate) {
      if (s.productionOrder.committedDeliveryDate.getTime() !== s.committedDeliveryDate.getTime()) {
        fail(`${s.productionOrder.number}: PO committed date ≠ schedule committed date`);
      }
    }
  }
  if (mayBeLate !== 3) {
    fail(`expected exactly 3 may-be-late schedules, found ${mayBeLate}`);
  }

  const products = await prisma.product.findMany({ select: { sku: true, nameEn: true, nameAr: true, bomDefaults: true } });
  const itemSkus = new Set((await prisma.inventoryItem.findMany({ select: { sku: true } })).map((i) => i.sku));
  for (const p of products) {
    const bom = p.bomDefaults as { materials?: Array<{ sku: string }> } | null;
    for (const line of bom?.materials ?? []) {
      if (!itemSkus.has(line.sku)) fail(`${p.sku}: BOM sku ${line.sku} missing as inventory item`);
    }
    if (FORBIDDEN.test(`${p.sku} ${p.nameEn} ${p.nameAr}`)) fail(`forbidden presentation string on product ${p.sku}`);
  }
  const named = await prisma.salesOrder.findMany({ select: { number: true, projectName: true, notes: true } });
  for (const so of named) {
    if (FORBIDDEN.test(`${so.projectName ?? ''} ${so.notes ?? ''}`)) fail(`${so.number}: forbidden presentation string`);
  }
  const wfs = await prisma.productionWorkflow.findMany({ select: { code: true, nameEn: true } });
  for (const w of wfs) {
    if (FORBIDDEN.test(`${w.code} ${w.nameEn}`)) fail(`forbidden workflow ${w.code}`);
  }
  const leftoverWh = await prisma.warehouse.findMany({
    where: { isActive: true },
    select: { code: true, nameEn: true, nameAr: true, nameHe: true },
  });
  const leftoverWhName = /\b(TEST|UAT|DRUAT|SAMPLE|MOCK)\b/i;
  const leftoverWhCodes = new Set(['TEST', 'TEST-2', 'SA', 'RAW-2', 'SEMI-2', 'FIN-2']);
  for (const w of leftoverWh) {
    if (['RAW', 'SEMI', 'FIN'].includes(w.code)) continue;
    if (
      leftoverWhCodes.has(w.code) ||
      leftoverWhName.test(`${w.code} ${w.nameEn} ${w.nameAr} ${w.nameHe ?? ''}`)
    ) {
      fail(`active leftover warehouse ${w.code} (${w.nameEn})`);
    }
  }

  const extraStages = await prisma.productionStageDefinition.findMany({
    where: { isActive: true, code: { notIn: [...STANDARD_FURNITURE_STAGE_CODES] } },
    select: { code: true },
  });
  if (extraStages.length) {
    fail(`extra active stage library codes: ${extraStages.map((s) => s.code).join(',')}`);
  }
  const activeWorkflows = await prisma.productionWorkflow.findMany({
    where: { status: 'ACTIVE', activeVersionId: { not: null } },
    include: {
      versions: {
        include: { nodes: { include: { stageDefinition: true } }, edges: true },
      },
    },
  });
  for (const w of activeWorkflows) {
    const version = w.versions.find((v) => v.id === w.activeVersionId);
    if (!version) continue;
    const terminals = version.nodes
      .filter((n) => !version.edges.some((e) => e.fromNodeId === n.id))
      .map((n) => n.stageDefinition.code);
    if (terminals.length !== 1) {
      fail(`${w.code}: expected 1 terminal, found ${terminals.join(',') || '(none)'}`);
    }
  }

  const soCount = await prisma.salesOrder.count();
  const inProdCount = await prisma.salesOrder.count({
    where: { status: { in: ['READY_FOR_PRODUCTION', 'IN_PRODUCTION', 'WAITING_FOR_MATERIALS'] } },
  });
  const completedCount = await prisma.salesOrder.count({
    where: { status: { in: ['COMPLETED', 'DELIVERED'] } },
  });
  if (soCount < 50) fail(`expected ~65 sales orders, found ${soCount}`);
  if (inProdCount + completedCount < 20) fail('dashboard production/completed counts look empty');

  const workerWithoutSkill = await prisma.user.findMany({
    where: {
      roles: { some: { role: { code: 'PRODUCTION_WORKER' } } },
      workerSkills: { none: { isActive: true } },
    },
    select: { username: true },
  });
  for (const w of workerWithoutSkill) fail(`worker ${w.username} has no WorkerSkill`);

  await assertPresentationReady(prisma, asOf, fail);

  if (failures.length) throw new DemoValidationError(failures);
  console.log(`demo:validate passed (${soCount} sales orders, ${mayBeLate} may-be-late)`);
}

const SYNTHETIC_KIND_SUFFIX =
  /\s(not_started|in_production|ready_delivery|waiting_materials|at_risk_material|at_risk_wip|at_risk_committed|delivered|packaging|qc|proposed|draft)$/;
const DEALER_SKU_PROJECT =
  /^(nile|oasis|balqis|cedar|zaatar|qasr|rawnaq|diwan|noor|jabal)\s+[A-Z0-9]+(?:-[A-Z0-9]+)+\s/i;

const EXPECTED_FLAGSHIP: Record<string, { so: string; status: string }> = {
  'Abdoun lounge set': { so: 'SO-2026-00001', status: 'DELIVERED' },
  'Sweifieh sectional': { so: 'SO-2026-00047', status: 'IN_PRODUCTION' },
  'Abdali hotel banquettes': { so: 'SO-2026-00019', status: 'READY_FOR_DELIVERY' },
  'Cedar Italian velvet recliner': { so: 'SO-2026-00056', status: 'WAITING_FOR_MATERIALS' },
  'Diwan wingback foam gate': { so: 'SO-2026-00051', status: 'IN_PRODUCTION' },
  'Jabal contract dining': { so: 'SO-2026-00023', status: 'IN_PRODUCTION' },
  'Oasis club armchair QC': { so: 'SO-2026-00042', status: 'IN_PRODUCTION' },
  'Nile loveseat recovered': { so: 'SO-2026-00006', status: 'DELIVERED' },
  'Zaatar ottoman scuff': { so: 'SO-2026-00013', status: 'DELIVERED' },
  'Qasr suite dining': { so: 'SO-2026-00064', status: 'READY_FOR_PRODUCTION' },
  'Noor club chair hold': { so: 'SO-2026-00065', status: 'DRAFT' },
  'Rawnaq dining six': { so: 'SO-2026-00063', status: 'READY_FOR_PRODUCTION' },
};

function isSyntheticProjectName(name: string): boolean {
  return FORBIDDEN.test(name) || SYNTHETIC_KIND_SUFFIX.test(name) || DEALER_SKU_PROJECT.test(name);
}

async function assertPresentationReady(
  prisma: PrismaClient,
  asOf: Date,
  fail: (msg: string) => void,
): Promise<void> {
  const salesOrders = await prisma.salesOrder.findMany({
    select: {
      number: true,
      status: true,
      projectName: true,
      requiredDeliveryDate: true,
    },
  });
  for (const so of salesOrders) {
    const name = so.projectName ?? '';
    if (!name || isSyntheticProjectName(name)) {
      fail(`${so.number}: synthetic or empty projectName "${name}"`);
    }
  }

  const debugReasons = await prisma.productionSchedule.findMany({
    where: { OR: [{ reason: { startsWith: 'demo:' } }, { reason: { startsWith: 'async:' } }] },
    select: { reason: true, productionOrder: { select: { number: true } } },
  });
  for (const row of debugReasons) {
    if (isInternalScheduleReason(row.reason)) {
      fail(`${row.productionOrder.number}: internal schedule reason ${row.reason}`);
    }
  }

  const deliveries = await prisma.delivery.findMany({
    select: { number: true, status: true, deliveryDate: true, salesOrder: { select: { number: true, projectName: true } } },
  });
  for (const d of deliveries) {
    if (d.status === 'DELIVERED' && d.deliveryDate.getTime() > asOf.getTime()) {
      fail(`${d.number}: DELIVERED after DEMO_AS_OF (${d.deliveryDate.toISOString()})`);
    }
    if (d.status === 'PLANNED' && d.deliveryDate.getTime() < asOf.getTime()) {
      fail(`${d.number}: PLANNED before DEMO_AS_OF (${d.deliveryDate.toISOString()})`);
    }
  }

  const OPEN_TASK = ['NOT_STARTED', 'READY', 'IN_PROGRESS', 'PAUSED', 'BLOCKED', 'READY_FOR_INSPECTION'];
  const staleAlloc = await prisma.scheduleAllocation.findMany({
    where: {
      plannedEnd: { lt: asOf },
      schedule: { status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] } },
      productionTask: { status: { in: OPEN_TASK } },
    },
    include: {
      productionTask: {
        select: {
          status: true,
          productionOrder: {
            select: {
              number: true,
              salesOrder: { select: { number: true, projectName: true } },
            },
          },
        },
      },
    },
  });
  const unjustified = staleAlloc.filter(
    (a) => a.productionTask?.productionOrder.salesOrder?.projectName !== 'Jabal contract dining',
  );
  if (unjustified.length) {
    const sample = unjustified
      .slice(0, 8)
      .map((a) => a.productionTask?.productionOrder.salesOrder?.number ?? a.productionTask?.productionOrder.number)
      .join(', ');
    fail(`${unjustified.length} stale open allocations before as-of (e.g. ${sample})`);
  }

  const incompletePastDue = salesOrders.filter(
    (so) =>
      !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(so.status) &&
      so.requiredDeliveryDate != null &&
      so.requiredDeliveryDate.getTime() < asOf.getTime() &&
      so.projectName !== 'Jabal contract dining',
  );
  for (const so of incompletePastDue) {
    fail(`${so.number}: incomplete with requiredDeliveryDate before as-of`);
  }

  const flagship = await prisma.salesOrder.findMany({
    where: { projectName: { in: Object.keys(EXPECTED_FLAGSHIP) } },
    include: {
      productionOrders: {
        include: {
          tasks: { include: { stageDefinition: { select: { code: true } } } },
          schedules: { orderBy: { version: 'desc' }, take: 1 },
        },
      },
      deliveries: true,
    },
  });
  const byName = new Map(flagship.map((so) => [so.projectName ?? '', so]));
  for (const name of Object.keys(EXPECTED_FLAGSHIP)) {
    const expected = EXPECTED_FLAGSHIP[name];
    const so = byName.get(name);
    if (!so) {
      fail(`walkthrough missing ${name}`);
      continue;
    }
    if (expected && so.number !== expected.so) fail(`${name}: expected ${expected.so}, found ${so.number}`);
    if (expected && so.status !== expected.status) fail(`${name}: expected ${expected.status}, found ${so.status}`);
  }

  const abdali = byName.get('Abdali hotel banquettes');
  const abdaliDlv = abdali?.deliveries[0];
  if (!abdaliDlv || abdaliDlv.status !== 'PLANNED' || abdaliDlv.deliveryDate.getTime() < asOf.getTime()) {
    fail(
      `Abdali delivery must be PLANNED on/after as-of (found ${abdaliDlv?.status ?? 'none'} ${abdaliDlv?.deliveryDate.toISOString() ?? ''})`,
    );
  }

  const diwan = byName.get('Diwan wingback foam gate');
  for (const task of diwan?.productionOrders.flatMap((po) => po.tasks) ?? []) {
    const code = task.stageDefinition?.code;
    if ((code === 'FOAM' || code === 'UPHOLSTERY') && task.status === 'IN_PROGRESS') {
      fail(`Diwan ${code} is IN_PROGRESS; walkthrough says foam/upholstery gated`);
    }
  }

  const cedar = byName.get('Cedar Italian velvet recliner');
  const cedarReason = cedar?.productionOrders[0]?.schedules[0]?.reason;
  if (isInternalScheduleReason(cedarReason)) {
    fail(`Cedar schedule reason leaks ${cedarReason}`);
  }

  const mayBeLateNames = new Set<string>();
  const schedules = await prisma.productionSchedule.findMany({
    where: { status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] } },
    include: { productionOrder: { include: { salesOrder: { select: { projectName: true } } } } },
  });
  const latest = new Map<string, (typeof schedules)[number]>();
  for (const s of schedules) {
    const prev = latest.get(s.productionOrderId);
    if (!prev || s.version > prev.version) latest.set(s.productionOrderId, s);
  }
  for (const s of latest.values()) {
    if (['CANCELLED', 'COMPLETED'].includes(s.productionOrder.status)) continue;
    const classification = classifyScheduleRisk({
      productionOrderStatus: s.productionOrder.status,
      scheduleStatus: s.status,
      committedDeliveryDate: s.committedDeliveryDate,
      requestedDeliveryDate: s.requestedDeliveryDate,
      projectedCompletion: s.suggestedDeliveryDate,
      requestedDateFeasible: s.requestedDateFeasible,
      unschedulableReason: s.unschedulableReason,
      requiresAdminEstimateReview: s.requiresAdminEstimateReview,
      materialRisk: s.materialRisk,
      now: asOf,
    });
    if (classification.contributesToMayBeLate) {
      mayBeLateNames.add(s.productionOrder.salesOrder?.projectName ?? s.productionOrder.number);
    }
  }
  const expectedLate = ['Cedar Italian velvet recliner', 'Diwan wingback foam gate', 'Jabal contract dining'];
  for (const name of expectedLate) {
    if (!mayBeLateNames.has(name)) fail(`may-be-late missing ${name}`);
  }
  for (const name of mayBeLateNames) {
    if (!expectedLate.includes(name)) fail(`unexpected may-be-late ${name}`);
  }
}
