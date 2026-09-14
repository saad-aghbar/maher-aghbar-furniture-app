import { PrismaClient } from '@prisma/client';
import { classifyScheduleRisk, isInternalScheduleReason } from '../../../../apps/api/src/modules/scheduling/domain/at-risk';
import {
  PROTECTED_STAGE_CODES,
  TERMINAL_STAGE_CODES,
  workflowGraphChainRequirements,
} from '../../../../packages/types/src/dealer-lifecycle';
import {
  RETURN_RECOVERY_WORKFLOW_CODE,
  RETURN_REPAIR_WORKFLOW_CODE,
  STANDARD_FURNITURE_STAGE_CODES,
} from '../seed/workflow';
import { demoAsOf } from './clock';
import { CEDAR_VELVET_SKU, MATERIAL_PHOTO_BY_SKU, isHttpImageUrl } from './material-photo-pool';
import { COST_UAT } from './cost-performance-uat';
import { assembleActualProduction, saleValueFromCommercial } from '../../../../apps/api/src/modules/reports/production-cost';
import { summarizeLaborEntries } from '../../../../apps/api/src/modules/production/labor-costing';
import { marginFrom } from '../../../../apps/api/src/modules/reports/order-cost-ledger';
import { isInventoryConsumption } from '../../../../apps/api/src/modules/reports/inventory-economics';

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
    if (so.number.startsWith('SO-NILE-RET-')) continue;
    const okDelivery = so.deliveries.some((d) => d.status === 'DELIVERED');
    if (!okDelivery) fail(`${so.number}: DELIVERED SO without DELIVERED delivery`);
    const active = so.productionOrders.flatMap((po) => {
      if (po.originType === 'RETURN_RECOVERY' || po.originType === 'RETURN_WORK' || po.originType === 'REPLACEMENT') {
        return [];
      }
      return po.tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status));
    });
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
    if (so.projectName === 'Nile blank production start') continue;
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
      productionOrder: { include: { stages: true, reworkRequests: true } },
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
        const reopened = snap.productionOrder.reworkRequests.some(
          (rw) =>
            rw.reentryStageInstanceId === fromInst.id &&
            !['COMPLETED', 'CANCELLED'].includes(rw.status),
        );
        if (!reopened) {
          fail(`${snap.productionOrder.number}: ${to.stageCode} completed before predecessor ${from.stageCode}`);
        }
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
    const skipQc =
      ['PLANNED', 'WAITING_FOR_MATERIALS'].includes(po.status) ||
      po.originType === 'REPLACEMENT' ||
      po.originType === 'RETURN_RECOVERY';
    if (deliveredSo && !skipQc) {
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

  const warehouses = await prisma.warehouse.findMany({
    select: { code: true, locations: { select: { isDefault: true, qrCode: true } } },
  });
  for (const wh of warehouses) {
    const defaults = wh.locations.filter((l) => l.isDefault);
    if (defaults.length !== 1) {
      fail(`warehouse ${wh.code} has ${defaults.length} default bins (expected 1)`);
    }
  }
  const missingBinQr = await prisma.warehouseLocation.count({ where: { qrCode: null } });
  if (missingBinQr) fail(`${missingBinQr} bins missing qrCode`);
  const nullBalances = await prisma.inventoryBalance.count({ where: { locationId: null } });
  const nullLots = await prisma.inventoryLot.count({ where: { locationId: null } });
  const nullTxs = await prisma.inventoryTransaction.count({ where: { locationId: null } });
  const nullKits = await prisma.wipKit.count({ where: { locationId: null } });
  if (nullBalances) fail(`${nullBalances} balances still have locationId null`);
  if (nullLots) fail(`${nullLots} lots still have locationId null`);
  if (nullTxs) fail(`${nullTxs} transactions still have locationId null`);
  if (nullKits) fail(`${nullKits} WIP kits still have locationId null`);

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
    include: { payments: true, allocations: true, salesOrder: { include: { lines: true } } },
  });
  for (const inv of invoices) {
    const paySum = inv.allocations.length
      ? inv.allocations.reduce((s, a) => s + Number(a.amount), 0)
      : inv.payments.reduce((s, p) => s + Number(p.amount), 0);
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
  const rawItems = await prisma.inventoryItem.findMany({
    where: { itemClass: 'RAW_MATERIAL', archivedAt: null },
    select: { sku: true, imageUrl: true, qrCode: true, barcode: true },
  });
  const rawBySku = new Map(rawItems.map((i) => [i.sku, i]));
  const curatedSkus = Object.keys(MATERIAL_PHOTO_BY_SKU);
  if (new Set(Object.values(MATERIAL_PHOTO_BY_SKU)).size !== curatedSkus.length) {
    fail('curated raw-material photos are not unique per SKU');
  }
  for (const sku of curatedSkus) {
    const row = rawBySku.get(sku);
    if (!row) {
      fail(`curated raw-material ${sku} missing as inventory item`);
      continue;
    }
    if (!isHttpImageUrl(row.imageUrl)) {
      fail(`${sku}: missing or invalid imageUrl`);
    } else     if (row.imageUrl !== MATERIAL_PHOTO_BY_SKU[sku]) {
      fail(`${sku}: imageUrl does not match curated demo photo`);
    }
    if (row.qrCode !== sku) {
      fail(`${sku}: qrCode must equal sku for printed identity`);
    }
  }
  const cedar = rawBySku.get(CEDAR_VELVET_SKU);
  if (!cedar || !isHttpImageUrl(cedar.imageUrl)) {
    fail(`${CEDAR_VELVET_SKU}: Cedar Italian velvet must have a dedicated image`);
  }
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

  const allowedStageCodes = new Set<string>([
    ...STANDARD_FURNITURE_STAGE_CODES,
    ...PROTECTED_STAGE_CODES,
  ]);
  const extraStages = await prisma.productionStageDefinition.findMany({
    where: { isActive: true, code: { notIn: [...allowedStageCodes] } },
    select: { code: true },
  });
  if (extraStages.length) {
    fail(`extra active stage library codes: ${extraStages.map((s) => s.code).join(',')}`);
  }

  for (const code of PROTECTED_STAGE_CODES) {
    const stage = await prisma.productionStageDefinition.findUnique({
      where: { code },
      select: { isActive: true },
    });
    if (!stage?.isActive) fail(`protected stage ${code} is missing or inactive`);
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

  const dismantle = await prisma.productionStageDefinition.findUnique({
    where: { code: 'DISMANTLE_RECOVER' },
    select: { id: true, isActive: true },
  });
  if (!dismantle?.isActive) fail('DISMANTLE_RECOVER stage is missing or inactive');
  else {
    const recoverSkills = await prisma.workerSkill.count({
      where: { stageDefinitionId: dismantle.id, isActive: true },
    });
    if (recoverSkills < 2) fail(`DISMANTLE_RECOVER needs ≥2 skilled workers, found ${recoverSkills}`);
  }

  const requiredStaff: Array<{ username: string; roleCode: string }> = [
    { username: 'qc2', roleCode: 'QUALITY_CONTROL' },
    { username: 'returnsdesk', roleCode: 'WAREHOUSE_MANAGEMENT' },
    { username: 'finance', roleCode: 'FINANCE' },
    { username: 'recovery1', roleCode: 'PRODUCTION_WORKER' },
    { username: 'recovery2', roleCode: 'PRODUCTION_WORKER' },
  ];
  for (const expected of requiredStaff) {
    const user = await prisma.user.findUnique({
      where: { username: expected.username },
      select: { roles: { select: { role: { select: { code: true } } } } },
    });
    if (!user) fail(`missing returns account ${expected.username}`);
    else if (!user.roles.some((r) => r.role.code === expected.roleCode)) {
      fail(`${expected.username} is missing role ${expected.roleCode}`);
    }
  }

  const returnWorkflows = await prisma.productionWorkflow.findMany({
    where: { status: 'ACTIVE', scope: 'RETURN' },
    include: {
      versions: {
        include: { nodes: { include: { stageDefinition: true } } },
      },
    },
  });
  if (!returnWorkflows.some((w) => w.code === RETURN_RECOVERY_WORKFLOW_CODE)) {
    fail(`${RETURN_RECOVERY_WORKFLOW_CODE} workflow is missing`);
  }
  if (!returnWorkflows.some((w) => w.code === RETURN_REPAIR_WORKFLOW_CODE)) {
    fail(`${RETURN_REPAIR_WORKFLOW_CODE} workflow is missing`);
  }
  for (const workflow of returnWorkflows) {
    const version = workflow.versions.find((v) => v.id === workflow.activeVersionId);
    if (!version) {
      fail(`${workflow.code}: active version missing`);
      continue;
    }
    const codes = version.nodes.map((n) => n.stageDefinition.code);
    const flags = workflowGraphChainRequirements(workflow.scope, codes);
    const recoveryShaped = codes.includes('DISMANTLE_RECOVER');
    if (recoveryShaped) {
      if (flags.requiresOpeningChain || flags.requiresTerminalChain) {
        fail(`${workflow.code}: recovery-shaped RETURN must not require opening or terminal chains`);
      }
    } else {
      if (flags.requiresOpeningChain) {
        fail(`${workflow.code}: repair-shaped RETURN must not require an opening chain`);
      }
      if (!flags.requiresTerminalChain) {
        fail(`${workflow.code}: repair-shaped RETURN must require the finishing trio`);
      }
      const missing = TERMINAL_STAGE_CODES.filter((code) => !codes.includes(code));
      if (missing.length) {
        fail(`${workflow.code}: repair-shaped RETURN missing ${missing.join(',')}`);
      }
    }
  }

  const pieceDemo = await prisma.returnRequest.findUnique({
    where: { number: 'RT-DEMO-PIECE-001' },
    select: { pieces: { select: { decision: true } } },
  });
  if (!pieceDemo) fail('RT-DEMO-PIECE-001 is missing');
  else {
    const decisions = new Set(pieceDemo.pieces.map((p) => p.decision));
    for (const decision of ['REPAIR', 'REPLACEMENT', 'SCRAP_RECOVERY'] as const) {
      if (!decisions.has(decision)) fail(`RT-DEMO-PIECE-001 missing ${decision} piece`);
    }
  }
  const recoveryDemo = await prisma.returnRequest.findUnique({
    where: { number: 'RT-DEMO-RECOVERY-001' },
    select: { pieces: { select: { decision: true } } },
  });
  if (!recoveryDemo?.pieces.some((p) => p.decision === 'SCRAP_RECOVERY')) {
    fail('RT-DEMO-RECOVERY-001 recovery-only case is missing');
  }

  await assertPresentationReady(prisma, asOf, fail);

  if (failures.length) throw new DemoValidationError(failures);
  console.log(`demo:validate passed (${soCount} sales orders, ${mayBeLate} may-be-late)`);
}

const SYNTHETIC_KIND_SUFFIX =
  /\s(not_started|in_production|fresh_production|ready_delivery|waiting_materials|at_risk_material|at_risk_wip|at_risk_committed|delivered|packaging|qc|proposed|draft)$/;
const DEALER_SKU_PROJECT =
  /^(nile|oasis|balqis|cedar|zaatar|qasr|rawnaq|diwan|noor|jabal)\s+[A-Z0-9]+(?:-[A-Z0-9]+)+\s/i;

const EXPECTED_FLAGSHIP: Record<string, { so: string | null | '*'; status: string }> = {
  'Abdoun lounge set': { so: '*', status: 'DELIVERED' },
  'Sweifieh sectional': { so: '*', status: 'IN_PRODUCTION' },
  'Nile blank production start': { so: '*', status: 'IN_PRODUCTION' },
  'Abdali hotel banquettes': { so: '*', status: 'READY_FOR_DELIVERY' },
  'Cedar Italian velvet recliner': { so: '*', status: 'WAITING_FOR_MATERIALS' },
  'Diwan wingback frame gate': { so: '*', status: 'IN_PRODUCTION' },
  'Jabal contract dining': { so: '*', status: 'IN_PRODUCTION' },
  'Oasis club armchair QC': { so: '*', status: 'IN_PRODUCTION' },
  'Nile loveseat recovered': { so: '*', status: 'DELIVERED' },
  'Zaatar ottoman scuff': { so: '*', status: 'DELIVERED' },
  'Qasr suite dining': { so: '*', status: 'READY_FOR_PRODUCTION' },
  'Noor club chair hold': { so: null, status: 'SENT' },
  'Noor banquettes 4 of 6 frames': { so: '*', status: 'IN_PRODUCTION' },
  'Rawnaq dining six': { so: '*', status: 'READY_FOR_PRODUCTION' },
  'Golden factory path': { so: '*', status: 'READY_FOR_PRODUCTION' },
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
    if (!d.deliveryDate) {
      fail(`${d.number}: missing deliveryDate (status ${d.status})`);
      continue;
    }
    if (
      d.status === 'DELIVERED' &&
      d.deliveryDate.getTime() > asOf.getTime() &&
      !d.number.startsWith('DLV-COST-')
    ) {
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
    const expected = EXPECTED_FLAGSHIP[name]!;
    const so = byName.get(name);
    if (expected.so == null) {
      if (so) fail(`${name}: expected no sales order, found ${so.number}`);
      const quote = await prisma.quotation.findFirst({
        where: { request: { projectName: name }, archivedAt: null },
        select: { number: true, status: true, salesOrders: { select: { id: true } } },
      });
      if (!quote) fail(`walkthrough missing quotation for ${name}`);
      else if (quote.status !== 'SENT') fail(`${name}: expected SENT quote, found ${quote.status}`);
      else if (quote.salesOrders.length) fail(`${name}: SENT quote must not have a sales order`);
      continue;
    }
    if (!so) {
      fail(`walkthrough missing ${name}`);
      continue;
    }
    if (expected.so !== '*' && so.number !== expected.so) {
      fail(`${name}: expected ${expected.so}, found ${so.number}`);
    }
    if (so.status !== expected.status) fail(`${name}: expected ${expected.status}, found ${so.status}`);
    if (name === 'Abdoun lounge set' && so.productionOrders.length < 3) {
      fail(`${name}: expected a 3-line basket, found ${so.productionOrders.length} POs`);
    }
    if (name === 'Nile blank production start') {
      const po = so.productionOrders[0];
      if (!po) {
        fail(`${name}: missing production order`);
      } else {
        if (po.status !== 'IN_PROGRESS') fail(`${name}: PO expected IN_PROGRESS, found ${po.status}`);
        const started = po.tasks.filter((t) =>
          ['IN_PROGRESS', 'PAUSED', 'COMPLETED', 'READY_FOR_INSPECTION', 'BLOCKED'].includes(t.status),
        );
        if (started.length) {
          fail(`${name}: expected empty floor (no started tasks), found ${started.length}`);
        }
        const issues = await prisma.inventoryTransaction.count({
          where: { referenceId: po.id, type: 'PRODUCTION_ISSUE' },
        });
        if (issues > 0) fail(`${name}: expected 0 production issues, found ${issues}`);
        const kits = await prisma.wipKit.count({ where: { productionOrderId: po.id } });
        if (kits > 0) fail(`${name}: expected 0 WIP kits, found ${kits}`);
      }
    }
  }

  const accepted = await prisma.quotation.findMany({
    where: { status: 'ACCEPTED', archivedAt: null },
    select: { number: true, acceptedById: true, sentAt: true, acceptedAt: true },
  });
  for (const q of accepted) {
    if (!q.acceptedById) fail(`${q.number}: ACCEPTED without acceptedById`);
    if (!q.sentAt || !q.acceptedAt || q.sentAt.getTime() > q.acceptedAt.getTime()) {
      fail(`${q.number}: sentAt must be set and not after acceptedAt`);
    }
  }

  const abdali = byName.get('Abdali hotel banquettes');
  const abdaliDlv = abdali?.deliveries[0];
  if (!abdaliDlv || abdaliDlv.status !== 'PLANNED' || abdaliDlv.deliveryDate.getTime() < asOf.getTime()) {
    fail(
      `Abdali delivery must be PLANNED on/after as-of (found ${abdaliDlv?.status ?? 'none'} ${abdaliDlv?.deliveryDate.toISOString() ?? ''})`,
    );
  }

  const diwan = byName.get('Diwan wingback frame gate');
  for (const task of diwan?.productionOrders.flatMap((po) => po.tasks) ?? []) {
    const code = task.stageDefinition?.code;
    if ((code === 'FOAM' || code === 'UPHOLSTERY' || code === 'CARPENTRY') && task.status === 'IN_PROGRESS') {
      fail(`Diwan ${code} is IN_PROGRESS; walkthrough says frames (SEMI) gated`);
    }
  }

  // Physical inventory honesty: READY_FOR_DELIVERY with FIN tracking must have FIN lots.
  const readySos = await prisma.salesOrder.findMany({
    where: { status: 'READY_FOR_DELIVERY' },
    include: {
      productionOrders: {
        include: {
          workflowSnapshot: { include: { nodes: true } },
        },
      },
    },
  });
  for (const so of readySos) {
    for (const po of so.productionOrders) {
      const producesFin = po.workflowSnapshot?.nodes.some(
        (n) => n.inventoryTracking === 'PRODUCES_FINISHED',
      );
      if (!producesFin) continue;
      const finLots = await prisma.inventoryLot.count({
        where: {
          productionOrderId: po.id,
          status: { in: ['AVAILABLE', 'RESERVED', 'DELIVERED'] },
          inventoryItem: { itemClass: 'FINISHED_GOOD' },
        },
      });
      if (finLots < 1) {
        fail(`${so.number} (${so.projectName}): READY_FOR_DELIVERY without FIN lots`);
      }
    }
  }

  // Diwan WIP_NOT_READY must match missing SEMI (no AVAILABLE/RESERVED SEMI lots).
  for (const po of diwan?.productionOrders ?? []) {
    const schedule = po.schedules?.[0];
    if (schedule?.unschedulableReason === 'WIP_NOT_READY') {
      const semi = await prisma.inventoryLot.count({
        where: {
          productionOrderId: po.id,
          status: { in: ['AVAILABLE', 'RESERVED'] },
          inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD' },
        },
      });
      if (semi > 0) {
        fail(`${po.number}: WIP_NOT_READY but SEMI lots exist`);
      }
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
  const expectedLate = ['Cedar Italian velvet recliner', 'Diwan wingback frame gate', 'Jabal contract dining'];
  for (const name of expectedLate) {
    if (!mayBeLateNames.has(name)) fail(`may-be-late missing ${name}`);
  }
  for (const name of mayBeLateNames) {
    if (!expectedLate.includes(name)) fail(`unexpected may-be-late ${name}`);
  }

  const activeProducts = await prisma.product.findMany({
    where: { archivedAt: null, isActive: true },
    include: { variants: { where: { archivedAt: null } } },
  });
  for (const product of activeProducts) {
    const defaults = product.variants.filter((v) => v.isDefault);
    if (defaults.length !== 1) {
      fail(`${product.sku}: expected 1 default variant, found ${defaults.length}`);
    }
  }

  const sellableVariants = await prisma.productVariant.findMany({
    where: { archivedAt: null, isActive: true },
  });
  for (const variant of sellableVariants) {
    if (!variant.factoryNotesAr?.trim()) {
      fail(`${variant.sku}: sellable variant missing factoryNotesAr`);
    }
  }

  const soLines = await prisma.salesOrderLine.findMany({
    where: {
      productId: { not: null },
      salesOrder: { archivedAt: null, status: { not: 'CANCELLED' } },
    },
    select: { id: true, variantId: true, salesOrder: { select: { number: true } } },
  });
  for (const line of soLines) {
    if (!line.variantId) fail(`${line.salesOrder.number}: sales order line missing variantId`);
  }

  const releasedPos = await prisma.productionOrder.findMany({
    where: {
      status: { notIn: ['DRAFT', 'CANCELLED'] },
      releasedToFactoryAt: { not: null },
    },
    include: {
      workflowSnapshot: { include: { nodes: true } },
    },
  });
  for (const po of releasedPos) {
    if (!po.variantId) fail(`${po.number}: released PO missing variantId`);
    if (!po.instructionsAr?.trim()) fail(`${po.number}: released PO missing instructionsAr`);
    if (po.plannedMaterialCost == null) fail(`${po.number}: released PO missing plannedMaterialCost`);
    if (po.plannedLaborCost == null) fail(`${po.number}: released PO missing plannedLaborCost`);
    if (!po.plannedCostFrozenAt) fail(`${po.number}: released PO missing plannedCostFrozenAt`);
    const mismatched = (po.workflowSnapshot?.nodes ?? []).filter(
      (n) => (n.instructionsAr ?? '') !== (po.instructionsAr ?? ''),
    );
    if (mismatched.length) {
      fail(`${po.number}: ${mismatched.length} snapshot nodes do not copy PO instructionsAr`);
    }
  }

  const pricedLines = await prisma.salesOrderLine.findMany({
    where: {
      variantId: { not: null },
      salesOrder: { archivedAt: null },
    },
    select: {
      variantId: true,
      productId: true,
      salesOrder: { select: { number: true, customerId: true } },
    },
  });
  for (const line of pricedLines) {
    if (!line.variantId || !line.productId) continue;
    const price = await prisma.dealerPrice.findFirst({
      where: {
        customerId: line.salesOrder.customerId,
        productId: line.productId,
        variantId: line.variantId,
      },
    });
    if (!price) {
      fail(`${line.salesOrder.number}: missing dealer price for variant ${line.variantId}`);
    }
  }

  const golden = await prisma.salesOrder.findFirst({
    where: { projectName: 'Golden factory path', archivedAt: null },
    include: {
      lines: true,
      productionOrders: { select: { id: true, salesOrderLineId: true, originType: true } },
    },
  });
  if (!golden) {
    fail('Golden factory path sales order missing');
  } else {
    if (golden.lines.length !== 4) {
      fail(`Golden factory path: expected 4 lines, got ${golden.lines.length}`);
    }
    const kinds = golden.lines.map((l) => l.manufacturingComplexity).sort();
    if (kinds.filter((k) => k === 'STANDARD').length < 2) {
      fail('Golden factory path: expected two STANDARD lines (STD + named variant)');
    }
    if (!golden.lines.some((l) => l.manufacturingComplexity === 'MODIFIED')) {
      fail('Golden factory path: missing MODIFIED line');
    }
    const custom = golden.lines.find((l) => l.manufacturingComplexity === 'CUSTOM');
    if (!custom) {
      fail('Golden factory path: missing CUSTOM line');
    } else {
      if (custom.productId) fail('Golden factory path: CUSTOM line must have null productId');
      const spec =
        custom.orderSpec && typeof custom.orderSpec === 'object' && !Array.isArray(custom.orderSpec)
          ? (custom.orderSpec as { productImageRef?: string | null })
          : null;
      if (!isHttpImageUrl(spec?.productImageRef)) {
        fail('Golden factory path: CUSTOM line snapshot missing photo');
      }
    }
    for (const line of golden.lines) {
      if (line.manufacturingComplexity !== 'CUSTOM' && !line.variantId) {
        fail(`${golden.number}: catalog line missing variantId`);
      }
      if (!line.productionRequired) continue;
      const pos = golden.productionOrders.filter(
        (po) => po.salesOrderLineId === line.id && po.originType === 'SALES_ORDER',
      );
      if (pos.length !== 1) {
        fail(
          `${golden.number}: line ${line.id} expected 1 SALES_ORDER PO, got ${pos.length}`,
        );
      }
    }
  }

  await validateCostPerformanceWorld(prisma, fail);
}

async function validateCostPerformanceWorld(
  prisma: PrismaClient,
  fail: (msg: string) => void,
) {
  const rates = await prisma.laborRate.findMany();
  const unpriced = await prisma.user.findUnique({ where: { username: COST_UAT.unpricedUser } });
  if (!unpriced) fail('cost.unpriced worker missing');
  else {
    const rate = await prisma.laborRate.findFirst({ where: { userId: unpriced.id } });
    if (rate) fail('cost.unpriced worker must not have a labor rate');
  }

  async function mixFor(number: string) {
    const order = await prisma.salesOrder.findUnique({
      where: { number },
      include: {
        lines: true,
        invoices: { where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } } },
        deliveries: true,
        productionOrders: {
          where: { archivedAt: null, originType: 'SALES_ORDER' },
          include: {
            tasks: { select: { id: true, isRework: true, stageDefinitionId: true } },
          },
        },
      },
    });
    if (!order) {
      fail(`${number}: missing`);
      return null;
    }
    const poIds = order.productionOrders.map((po) => po.id);
    const taskIds = order.productionOrders.flatMap((po) => po.tasks.map((t) => t.id));
    const txs = await prisma.inventoryTransaction.findMany({
      where: {
        OR: [{ productionOrderId: { in: poIds } }, { salesOrderId: order.id, type: { in: ['PRODUCTION_ISSUE', 'PRODUCTION_RETURN', 'SCRAP', 'DAMAGE'] } }],
      },
      include: { inventoryItem: { select: { category: true, materialGroup: true } } },
    });
    const reworkByTask = new Map(order.productionOrders.flatMap((po) => po.tasks.map((t) => [t.id, t.isRework] as const)));
    const entries = await prisma.taskTimeEntry.findMany({ where: { taskId: { in: taskIds } } });
    const labor = summarizeLaborEntries({
      rates,
      tasks: order.productionOrders.flatMap((po) => po.tasks),
      entries,
    });
    const mix = assembleActualProduction({
      labor,
      txs: txs.map((tx) => ({
        type: tx.type,
        quantity: tx.quantity,
        unitCost: tx.unitCost,
        category: tx.inventoryItem.category,
        materialGroup: tx.inventoryItem.materialGroup,
        isRework: tx.productionTaskId ? Boolean(reworkByTask.get(tx.productionTaskId)) : false,
        productionTaskId: tx.productionTaskId,
      })),
    });
    const sale = saleValueFromCommercial({
      invoiceSubtotal: order.invoices[0]?.subtotal,
      lineTotalsSum: order.lines.reduce((sum, line) => sum + Number(line.lineTotal), 0),
      orderSubtotal: order.subtotal,
    });
    const margin = marginFrom(sale, mix.total, mix.complete);
    return { order, mix, sale, margin, labor };
  }

  const golden = await mixFor(COST_UAT.golden);
  if (golden) {
    if (golden.mix.total !== 294) fail(`${COST_UAT.golden}: actual ${golden.mix.total} ≠ 294`);
    if (golden.sale !== 630) fail(`${COST_UAT.golden}: sale ${golden.sale} ≠ 630`);
    if (golden.margin.grossMargin !== 336) fail(`${COST_UAT.golden}: margin ${golden.margin.grossMargin} ≠ 336`);
    if (!golden.mix.complete) fail(`${COST_UAT.golden}: expected complete coverage`);
    const custom = golden.order.lines.find((l) => l.manufacturingComplexity === 'CUSTOM');
    if (!custom || custom.productId) fail(`${COST_UAT.golden}: CUSTOM line must have null productId`);
    if (!golden.order.deliveries.some((d) => d.status === 'DELIVERED' && d.actualDeliveredAt)) {
      fail(`${COST_UAT.golden}: missing delivered actualDeliveredAt`);
    }
  }

  const walkthrough = await prisma.salesOrder.findFirst({
    where: { projectName: 'Golden factory path', archivedAt: null },
    select: { number: true, status: true },
  });
  if (walkthrough?.status === 'DELIVERED' || walkthrough?.status === 'COMPLETED') {
    fail(`${walkthrough.number}: Nile walkthrough must stay incomplete`);
  }

  const low = await mixFor(COST_UAT.low);
  if (low) {
    if (!low.mix.complete) fail(`${COST_UAT.low}: expected complete costing`);
    if (!(low.margin.grossMargin != null && low.margin.grossMargin > 0 && (low.margin.marginPct ?? 0) < 20)) {
      fail(`${COST_UAT.low}: expected low positive margin, got ${low.margin.grossMargin} / ${low.margin.marginPct}%`);
    }
  }

  const loss = await mixFor(COST_UAT.loss);
  if (loss && !(loss.margin.grossMargin != null && loss.margin.grossMargin < 0)) {
    fail(`${COST_UAT.loss}: expected negative margin, got ${loss.margin.grossMargin}`);
  }

  const partial = await mixFor(COST_UAT.partial);
  if (partial) {
    if (partial.mix.complete) fail(`${COST_UAT.partial}: expected incomplete costing`);
    if (!partial.mix.laborTimeKnown || partial.mix.laborCostPriced) {
      fail(`${COST_UAT.partial}: expected timed labor with missing rate`);
    }
    if (partial.mix.labor === 0) fail(`${COST_UAT.partial}: missing labor rate must not become 0`);
  }

  const unused = await mixFor(COST_UAT.unused);
  if (unused) {
    const txs = await prisma.inventoryTransaction.findMany({
      where: { salesOrderId: unused.order.id, type: { in: ['PRODUCTION_ISSUE', 'PRODUCTION_RETURN'] } },
    });
    const issued = txs.filter((t) => t.type === 'PRODUCTION_ISSUE').reduce((s, t) => s + Math.abs(Number(t.quantity)), 0);
    const returned = txs.filter((t) => t.type === 'PRODUCTION_RETURN').reduce((s, t) => s + Math.abs(Number(t.quantity)), 0);
    if (issued !== 10 || returned !== 2) fail(`${COST_UAT.unused}: expected issue 10 return 2, got ${issued}/${returned}`);
  }

  const transfers = await prisma.inventoryTransaction.findMany({ where: { type: 'WAREHOUSE_TRANSFER' } });
  if (transfers.length < 2) fail('COST warehouse transfer txs missing');
  for (const tx of transfers) {
    if (isInventoryConsumption(tx.type)) fail(`${tx.number}: transfer counted as consumption`);
  }

  const recovery = await prisma.returnRequest.findUnique({
    where: { number: COST_UAT.recovery },
    include: { pieces: { include: { recoveryLines: true } } },
  });
  if (!recovery) fail(`${COST_UAT.recovery}: missing`);
  else {
    const recovered = recovery.pieces.flatMap((p) => p.recoveryLines).filter((l) => l.outcome === 'RECOVER_TO_INVENTORY' && l.postedAt);
    if (!recovered.length) fail(`${COST_UAT.recovery}: recovered value rows missing`);
  }

  const gap = await prisma.inventoryItem.findUnique({ where: { sku: COST_UAT.gapSku } });
  if (!gap || Number(gap.standardCost) > 0) fail(`${COST_UAT.gapSku}: valuation gap SKU missing or priced`);

  const semi = await prisma.inventoryItem.findUnique({ where: { sku: COST_UAT.semiSku } });
  if (!semi || Number(semi.standardCost) !== 80) fail(`${COST_UAT.semiSku}: priced SEMI frame missing`);
  const fin = await prisma.inventoryItem.findUnique({ where: { sku: COST_UAT.finSku } });
  if (!fin || Number(fin.standardCost) !== 220) fail(`${COST_UAT.finSku}: priced FIN sofa missing`);

  const customAgg = await prisma.salesOrderLine.findMany({
    where: { salesOrder: { number: { startsWith: 'SO-COST-CUSTOM' } } },
  });
  if (customAgg.some((l) => l.productId)) fail('Cost custom lines must stay outside catalog products');
}
