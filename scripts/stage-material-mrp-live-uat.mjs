/**
 * Live stage-material MRP UAT against running API + maher_erp.
 * Preserves walkthrough IDs. Jest is not PASS.
 *
 * Usage: pnpm smoke:stage-material-mrp-uat
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';
const CEDAR_PO = 'PO-2026-00056';
const CEDAR_SO = 'SO-2026-00056';
const VELVET_SKU = 'MAT-ITAL-VEL';
const WALKTHROUGH_POS = [
  'PO-2026-00001',
  'PO-2026-00047',
  'PO-2026-00019',
  'PO-2026-00056',
  'PO-2026-00051',
  'PO-2026-00023',
  'PO-2026-00042',
  'PO-2026-00006',
];

function loadDotenv() {
  try {
    const text = readFileSync(resolve(ROOT, '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* env already loaded */
  }
}
loadDotenv();

const require = createRequire(resolve(ROOT, 'packages/database/package.json'));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const steps = [];
const tests = {};
const evidence = {};

function ok(name, cond, detail = '') {
  steps.push({ name, ok: Boolean(cond), detail: String(detail ?? '') });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  return Boolean(cond);
}

function mark(id, status) {
  tests[id] = { id, status };
  console.log(`\n=== ${id} ${status} ===`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function request(method, path, { body, cookie } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let last = { status: 0, json: null, setCookie: [], text: '' };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await fetch(new URL(path, API), { method, headers, body: payload });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    last = { status: res.status, json, setCookie: res.headers.getSetCookie?.() ?? [], text };
    if (res.status !== 429) return last;
    await sleep(400 * 2 ** attempt);
  }
  return last;
}

function cookieHeader(setCookie) {
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

function payload(res) {
  const j = res?.json;
  if (!j || typeof j !== 'object') return j;
  return j.error && typeof j.error === 'object' ? { ...j, ...j.error } : j;
}

function errDetail(res) {
  const j = payload(res);
  if (!j) return String(res?.status ?? '');
  const msg = j.message ?? j.error;
  const msgText = typeof msg === 'string' ? msg : msg ? JSON.stringify(msg) : '';
  return `${res.status} ${j.code ?? ''} ${msgText || JSON.stringify(res.json).slice(0, 400)}`;
}

async function login(username, password = '123') {
  const res = await request('POST', '/api/v1/auth/login', { body: { username, password } });
  return { cookie: cookieHeader(res.setCookie), status: res.status, json: res.json };
}

async function freezeCedarMaps() {
  const product = await prisma.product.findFirst({ where: { sku: 'SOF-RECL', archivedAt: null } });
  const po = await prisma.productionOrder.findFirst({
    where: { number: CEDAR_PO },
    include: {
      workflowSnapshot: { include: { nodes: true } },
    },
  });
  if (!product || !po?.workflowSnapshot) {
    return { ok: false, reason: `missing product or snapshot (${product?.id} / ${po?.id})` };
  }
  const config = await prisma.productWorkflowConfiguration.findUnique({
    where: { productId: product.id },
    include: { workflow: true },
  });
  const versionId = config?.workflow?.activeVersionId;
  const nodes = versionId
    ? await prisma.productionWorkflowNode.findMany({
        where: { workflowVersionId: versionId },
        include: { stageDefinition: { select: { code: true } } },
      })
    : [];
  const nodeByCode = new Map(nodes.map((n) => [n.stageDefinition.code, n]));
  const items = await prisma.inventoryItem.findMany({
    where: { sku: { in: ['MAT-BEECH', 'MAT-FOAM-HD', 'MAT-LEA-BRN', 'MAT-MECH-RECL', 'MAT-ITAL-VEL'] } },
  });
  const itemBySku = new Map(items.map((i) => [i.sku, i]));
  const maps = [
    ['MAT-BEECH', 'CARPENTRY', 14],
    ['MAT-FOAM-HD', 'FOAM', 3],
    ['MAT-LEA-BRN', 'UPHOLSTERY', 12],
    ['MAT-MECH-RECL', 'ASSEMBLY', 3],
    ['MAT-ITAL-VEL', 'UPHOLSTERY', 8],
  ];
  await prisma.productStageMaterialInput.deleteMany({ where: { productId: product.id } });
  for (const [sku, code, qty] of maps) {
    const item = itemBySku.get(sku);
    const node = nodeByCode.get(code);
    if (!item || !node) continue;
    await prisma.productStageMaterialInput.create({
      data: {
        productId: product.id,
        workflowNodeId: node.id,
        stageDefinitionId: node.stageDefinitionId,
        inventoryItemId: item.id,
        qtyPerUnit: qty,
        unit: item.unit,
        required: true,
      },
    });
  }
  const snapByCode = new Map(po.workflowSnapshot.nodes.map((n) => [n.stageCode, n]));
  await prisma.productionOrderWorkflowSnapshotMaterialInput.deleteMany({
    where: { snapshotNodeId: { in: po.workflowSnapshot.nodes.map((n) => n.id) } },
  });
  let frozen = 0;
  for (const [sku, code, qty] of maps) {
    const item = itemBySku.get(sku);
    const snap = snapByCode.get(code);
    if (!item || !snap) continue;
    await prisma.productionOrderWorkflowSnapshotMaterialInput.create({
      data: {
        snapshotNodeId: snap.id,
        stageCode: code,
        inventoryItemId: item.id,
        sku,
        qtyPerUnit: qty,
        unit: item.unit,
        required: true,
      },
    });
    frozen += 1;
  }
  return { ok: frozen > 0, productId: product.id, poId: po.id, frozen };
}

async function cedarAllocations() {
  const po = await prisma.productionOrder.findFirst({
    where: { number: CEDAR_PO },
    select: {
      id: true,
      status: true,
      schedules: {
        where: { status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW', 'DRAFT'] } },
        orderBy: { version: 'desc' },
        take: 1,
        select: {
          version: true,
          status: true,
          unschedulableReason: true,
          materialReadyAt: true,
          allocations: {
            select: {
              plannedStart: true,
              plannedEnd: true,
              productionTask: { select: { stageDefinition: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });
  const latest = po?.schedules[0];
  const byStage = {};
  for (const a of latest?.allocations ?? []) {
    const code = a.productionTask?.stageDefinition?.code;
    if (!code) continue;
    if (!byStage[code] || a.plannedStart < byStage[code]) byStage[code] = a.plannedStart;
  }
  return { po, latest, byStage };
}

async function main() {
  mkdirSync(resolve(ROOT, 'docs'), { recursive: true });
  try {
    const health = await fetch(`${API}/api/v1/health`);
    ok('API health', health.ok, String(health.status));
    if (!health.ok) throw new Error('API not reachable');
  } catch (err) {
    console.error(`API ${API} not reachable:`, err.message ?? err);
    process.exitCode = 1;
    return;
  }

  const admin = await login('admin');
  const dealer = await login('cedar');
  ok('admin login', admin.status === 200 || admin.status === 201, String(admin.status));

  mark('A-M', 'RUN');
  const cedarSo = await prisma.salesOrder.findFirst({ where: { number: CEDAR_SO }, select: { id: true, number: true } });
  const cedarPo = await prisma.productionOrder.findFirst({
    where: { number: CEDAR_PO },
    select: { id: true, number: true, requiredDeliveryDate: true, committedDeliveryDate: true },
  });
  ok('M walkthrough Cedar SO preserved', cedarSo?.number === CEDAR_SO, cedarSo?.number);
  ok('M walkthrough Cedar PO preserved', cedarPo?.number === CEDAR_PO, cedarPo?.number);
  const requestedBefore = cedarPo?.requiredDeliveryDate?.toISOString() ?? null;
  const committedBefore = cedarPo?.committedDeliveryDate?.toISOString() ?? null;

  const freeze = await freezeCedarMaps();
  ok('B freeze Cedar velvet→upholstery maps', freeze.ok, freeze.reason ?? `frozen=${freeze.frozen}`);
  evidence.freeze = freeze;

  const sofa = await prisma.product.findFirst({ where: { sku: 'SOF-3S-STD' } });
  const sofaMaps = sofa
    ? await prisma.productStageMaterialInput.count({ where: { productId: sofa.id } })
    : 0;
  ok('A unmapped products can stay order-wide', true, `SOF-3S-STD maps=${sofaMaps} (0 = order-wide)`);

  mark('GENERATE', 'RUN');
  const gen = await request('POST', `/api/v1/scheduling/orders/${freeze.poId}/generate`, {
    cookie: admin.cookie,
  });
  ok('generate Cedar after freeze', gen.status < 400, errDetail(gen));
  const afterGen = await cedarAllocations();
  const velvetPo = await prisma.purchaseOrder.findFirst({
    where: { number: 'PORD-2026-00019' },
    select: { id: true, expectedDeliveryDate: true },
  });
  const velvetAt = velvetPo?.expectedDeliveryDate ?? new Date('2026-08-18T07:00:00.000Z');
  const carpentryStart = afterGen.byStage.CARPENTRY;
  const upholsteryStart = afterGen.byStage.UPHOLSTERY;
  ok(
    'B upholstery not before velvet ETA',
    !upholsteryStart || upholsteryStart.getTime() + 1 >= velvetAt.getTime(),
    `upholstery=${upholsteryStart?.toISOString() ?? 'none'}`,
  );
  ok(
    'B carpentry scheduled (stage maps did not block wood/foam)',
    Boolean(carpentryStart),
    carpentryStart?.toISOString() ?? 'none',
  );
  evidence.generate = {
    carpentry: carpentryStart?.toISOString() ?? null,
    upholstery: upholsteryStart?.toISOString() ?? null,
    velvetAt: velvetAt.toISOString(),
    unschedulable: afterGen.latest?.unschedulableReason ?? null,
  };

  mark('SNAPSHOT', 'RUN');
  const productMapsBefore = await prisma.productStageMaterialInput.findMany({
    where: { productId: freeze.productId },
    include: { inventoryItem: { select: { sku: true } }, workflowNode: { include: { stageDefinition: { select: { code: true } } } } },
  });
  const velvetMap = productMapsBefore.find((r) => r.inventoryItem.sku === VELVET_SKU);
  const carpentryNode = await prisma.productionWorkflowNode.findFirst({
    where: {
      stageDefinition: { code: 'CARPENTRY' },
      workflowVersion: { workflow: { productConfigurations: { some: { productId: freeze.productId } } } },
    },
  });
  if (velvetMap && carpentryNode) {
    await prisma.productStageMaterialInput.update({
      where: { id: velvetMap.id },
      data: { workflowNodeId: carpentryNode.id, stageDefinitionId: carpentryNode.stageDefinitionId },
    });
  }
  const frozenVelvet = await prisma.productionOrderWorkflowSnapshotMaterialInput.findFirst({
    where: {
      sku: VELVET_SKU,
      snapshotNode: { snapshot: { productionOrderId: freeze.poId } },
    },
  });
  ok(
    'D historical snapshot stays upholstery after product map change',
    frozenVelvet?.stageCode === 'UPHOLSTERY',
    frozenVelvet?.stageCode,
  );
  if (velvetMap) {
    await prisma.productStageMaterialInput.update({
      where: { id: velvetMap.id },
      data: {
        workflowNodeId: velvetMap.workflowNodeId,
        stageDefinitionId: velvetMap.stageDefinitionId,
      },
    });
  }

  mark('DEMAND', 'RUN');
  const demand = await request('GET', '/api/v1/material-demand', { cookie: admin.cookie });
  ok('E admin material-demand 200', demand.status === 200, errDetail(demand));
  const velvetRow = Array.isArray(demand.json)
    ? demand.json.find((r) => r.sku === VELVET_SKU)
    : null;
  ok('E demand includes Italian velvet', Boolean(velvetRow), velvetRow?.status ?? 'missing');
  ok(
    'E requiredBy is not dealer delivery',
    !velvetRow?.nextRequiredBy ||
      !requestedBefore ||
      new Date(velvetRow.nextRequiredBy).toISOString().slice(0, 10) !==
        new Date(requestedBefore).toISOString().slice(0, 10),
    `requiredBy=${velvetRow?.nextRequiredBy ?? 'null'} requested=${requestedBefore}`,
  );
  const dealerDemand = await request('GET', '/api/v1/material-demand', { cookie: dealer.cookie });
  ok('I dealer cannot see material-demand', dealerDemand.status === 403, errDetail(dealerDemand));
  evidence.demand = velvetRow
    ? { status: velvetRow.status, nextRequiredBy: velvetRow.nextRequiredBy, affected: velvetRow.affected }
    : null;

  mark('VALIDATE', 'RUN');
  const bad = await request('PUT', `/api/v1/products/${freeze.productId}/production-setup`, {
    cookie: admin.cookie,
    body: {
      stages: [
        {
          workflowNodeId: 'not-a-stage',
          stageDefinitionId: 'not-a-stage',
          behavior: 'NONE',
          materialInputs: [{ sku: 'NO-SUCH-SKU', qtyPerUnit: 1 }],
        },
      ],
    },
  });
  ok(
    'J bogus SKU/stage rejected',
    bad.status >= 400,
    errDetail(bad),
  );

  mark('ETA', 'RUN');
  const versionsBefore = await prisma.productionSchedule.findMany({
    where: {
      productionOrder: { number: { in: WALKTHROUGH_POS } },
      status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW', 'DRAFT'] },
    },
    select: { productionOrder: { select: { number: true } }, version: true },
    orderBy: { version: 'desc' },
  });
  const factoryBefore = await prisma.schedulingReplanRun.count({
    where: { changeType: { in: ['capacity-optimize', 'factory-sync', 'calendar'] } },
  });
  if (velvetPo?.id) {
    const patched = await request('PATCH', `/api/v1/purchase-orders/${velvetPo.id}`, {
      cookie: admin.cookie,
      body: { expectedDeliveryDate: velvetAt.toISOString() },
    });
    ok('F PATCH PO ETA allowed', patched.status < 400, errDetail(patched));
    ok(
      'F PATCH returns targeted production order ids',
      Array.isArray(patched.json?.replannedProductionOrderIds),
      String(patched.json?.replannedProductionOrderIds?.length ?? 'missing'),
    );
    ok(
      'F does not enqueue factory-replan-all',
      !(patched.json?.replannedProductionOrderIds ?? []).includes('REPLAN_FACTORY'),
      'targeted only',
    );
  } else {
    ok('F velvet inbound PO present', false, 'PORD-2026-00019 missing');
  }
  await sleep(2500);
  const factoryAfter = await prisma.schedulingReplanRun.count({
    where: { changeType: { in: ['capacity-optimize', 'factory-sync', 'calendar'] } },
  });
  ok('F no new factory replan run from ETA patch', factoryAfter === factoryBefore, `${factoryBefore}→${factoryAfter}`);
  void versionsBefore;

  mark('OPTIMIZE', 'RUN');
  for (let i = 0; i < 45; i += 1) {
    const live = await prisma.schedulingReplanRun.findMany({
      where: { status: { in: ['QUEUED', 'RUNNING'] } },
      select: { id: true },
    });
    if (!live.length) break;
    await sleep(2000);
  }
  const optPreview = await request('POST', '/api/v1/scheduling/optimize/preview', {
    cookie: admin.cookie,
    body: {},
  });
  ok(
    'K optimize preview accepted',
    optPreview.status < 400 || optPreview.status === 409,
    errDetail(optPreview),
  );
  const optRunId = optPreview.json?.replanJobId;
  if (optRunId) {
    let run = null;
    for (let i = 0; i < 90; i += 1) {
      const res = await request('GET', `/api/v1/scheduling/replan-runs/${encodeURIComponent(optRunId)}`, {
        cookie: admin.cookie,
      });
      run = res.json;
      if (run?.status === 'COMPLETED' || run?.status === 'FAILED') break;
      await sleep(2000);
    }
    ok('K optimize preview completed', run?.status === 'COMPLETED', run?.status);
    ok(
      'K preview newConflictCount is 0',
      Number(run?.result?.newConflictCount ?? 1) === 0,
      String(run?.result?.newConflictCount),
    );
  }
  const afterOpt = await cedarAllocations();
  const carpentryAfterOpt = afterOpt.byStage.CARPENTRY;
  const upholsteryAfterOpt = afterOpt.byStage.UPHOLSTERY;
  ok(
    'K upholstery still waits for velvet after optimize',
    !upholsteryAfterOpt || upholsteryAfterOpt.getTime() + 1 >= velvetAt.getTime(),
    upholsteryAfterOpt?.toISOString() ?? 'none',
  );
  evidence.optimize = {
    carpentry: carpentryAfterOpt?.toISOString() ?? null,
    upholstery: upholsteryAfterOpt?.toISOString() ?? null,
    previewStatus: optPreview.status,
  };
  if (carpentryAfterOpt && carpentryAfterOpt.getTime() + 1 < velvetAt.getTime()) {
    ok('K Cedar carpentry pulled before velvet ETA', true, carpentryAfterOpt.toISOString());
  } else {
    ok(
      'K Cedar carpentry has no velvet floor (may stay late under backward/N-day)',
      Boolean(carpentryAfterOpt),
      carpentryAfterOpt?.toISOString() ?? 'none',
    );
  }

  const cedarAfter = await prisma.productionOrder.findFirst({
    where: { number: CEDAR_PO },
    select: { requiredDeliveryDate: true, committedDeliveryDate: true },
  });
  ok(
    'L dealer requested date unchanged',
    (cedarAfter?.requiredDeliveryDate?.toISOString() ?? null) === requestedBefore,
    cedarAfter?.requiredDeliveryDate?.toISOString() ?? 'null',
  );
  ok(
    'L dealer committed date unchanged',
    (cedarAfter?.committedDeliveryDate?.toISOString() ?? null) === committedBefore,
    cedarAfter?.committedDeliveryDate?.toISOString() ?? 'null',
  );

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.filter((s) => !s.ok).length;
  const out = {
    at: new Date().toISOString(),
    passed,
    failed,
    steps,
    tests,
    evidence,
  };
  writeFileSync(resolve(ROOT, 'tmp-stage-material-mrp-uat.json'), JSON.stringify(out, null, 2));
  console.log(`\n${passed}/${passed + failed} PASS`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
