/**
 * Live physical production-inventory lifecycle UAT (A–O).
 * Requires API on :4000 and a current `pnpm demo:reset` maher_erp DB.
 * Usage: pnpm smoke:production-inventory-lifecycle-uat
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';

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

function mark(id, status, extra = {}) {
  tests[id] = { id, status, ...extra };
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

async function login(username, password = '123') {
  const res = await request('POST', '/api/v1/auth/login', { body: { username, password } });
  return { cookie: cookieHeader(res.setCookie), status: res.status, json: res.json };
}

async function soByProject(name) {
  return prisma.salesOrder.findFirst({
    where: { projectName: name },
    include: {
      deliveries: true,
      productionOrders: { select: { id: true, number: true, status: true } },
    },
  });
}

async function main() {
  console.log(`API ${API}`);
  const admin = await login('admin');
  ok('admin login', admin.status === 200 && Boolean(admin.cookie), `status=${admin.status}`);
  const carpenter = await login('carpenter');
  ok('carpenter login', carpenter.status === 200 && Boolean(carpenter.cookie));
  const nile = await login('nile');
  ok('nile login', nile.status === 200 && Boolean(nile.cookie));

  // --- A RAW→SEMI ---
  mark('A', 'RUN');
  const sweifiehSo = await soByProject('Sweifieh sectional');
  const sweifieh = sweifiehSo?.productionOrders?.[0] ?? null;
  const semiLots = await prisma.inventoryLot.findMany({
    where: {
      productionOrderId: sweifieh?.id ?? '__none__',
      inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD' },
      status: { in: ['AVAILABLE', 'PARTIALLY_CONSUMED', 'RESERVED'] },
    },
  });
  const semiReceipts = await prisma.inventoryTransaction.count({
    where: {
      type: 'SEMI_FINISHED_RECEIPT',
      referenceId: sweifieh?.id ?? '__none__',
    },
  });
  evidence.A = { po: sweifieh?.number, semiLots: semiLots.length, semiReceipts };
  mark(
    'A',
    sweifieh && semiLots.length > 0 && semiReceipts > 0 ? 'PASS' : 'FAIL',
    evidence.A,
  );
  ok('A RAW→SEMI physical', Boolean(sweifieh && semiLots.length > 0 && semiReceipts > 0), JSON.stringify(evidence.A));

  // --- B SEMI consume same-PO (Balqis packaging done → SEMI consumed) ---
  mark('B', 'RUN');
  const balqisSo = await soByProject('Abdali hotel banquettes');
  const balqis = balqisSo?.productionOrders?.[0] ?? null;
  const balqisSemiConsumed = await prisma.inventoryLot.count({
    where: {
      productionOrderId: balqis?.id ?? '__none__',
      inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD' },
      status: 'CONSUMED',
    },
  });
  const balqisSemiIssue = await prisma.inventoryTransaction.count({
    where: { type: 'SEMI_FINISHED_ISSUE', referenceId: balqis?.id ?? '__none__' },
  });
  evidence.B = { po: balqis?.number, consumed: balqisSemiConsumed, issues: balqisSemiIssue };
  mark('B', balqisSemiConsumed > 0 || balqisSemiIssue > 0 ? 'PASS' : 'FAIL', evidence.B);
  ok('B SEMI consume same-PO', balqisSemiConsumed > 0 || balqisSemiIssue > 0, JSON.stringify(evidence.B));

  // --- C Partial 4/6 ---
  mark('C', 'RUN');
  const partialSo = await soByProject('Noor banquettes 4 of 6 frames');
  const partialPo = partialSo?.productionOrders?.[0]
    ? await prisma.productionOrder.findUnique({
        where: { id: partialSo.productionOrders[0].id },
        include: {
          salesOrder: { select: { projectName: true } },
          tasks: {
            where: { stageDefinition: { code: 'CARPENTRY' } },
            select: { targetQty: true, completedQty: true },
          },
        },
      })
    : null;
  const partialLots = partialPo
    ? await prisma.inventoryLot.findMany({
        where: {
          productionOrderId: partialPo.id,
          inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD' },
        },
      })
    : [];
  const partialQty = partialLots.reduce((s, l) => s + Number(l.quantity), 0);
  const task = partialPo?.tasks?.[0];
  evidence.C = {
    project: partialPo?.salesOrder?.projectName,
    targetQty: task ? Number(task.targetQty) : null,
    completedQty: task ? Number(task.completedQty) : null,
    semiQty: partialQty,
  };
  const cOk =
    Boolean(partialPo) &&
    Number(task?.targetQty) === 6 &&
    Number(task?.completedQty) === 4 &&
    Math.abs(partialQty - 4) < 0.01;
  mark('C', cOk ? 'PASS' : 'FAIL', evidence.C);
  ok('C Partial 4/6', cOk, JSON.stringify(evidence.C));

  // --- D QC/pack → FIN ---
  mark('D', 'RUN');
  const finReceipts = await prisma.inventoryTransaction.count({
    where: { type: 'FINISHED_GOODS_RECEIPT' },
  });
  const finInFactory = await prisma.inventoryLot.count({
    where: {
      inventoryItem: { itemClass: 'FINISHED_GOOD' },
      status: { in: ['AVAILABLE', 'RESERVED'] },
    },
  });
  evidence.D = { finReceipts, finInFactory };
  mark('D', finReceipts > 0 && finInFactory > 0 ? 'PASS' : 'FAIL', evidence.D);
  ok('D QC/pack → FIN', finReceipts > 0 && finInFactory > 0, JSON.stringify(evidence.D));

  // --- E QC fail / reverse (Oasis) ---
  mark('E', 'RUN');
  const oasisSo = await soByProject('Oasis club armchair QC');
  const oasis = oasisSo?.productionOrders?.[0] ?? null;
  const oasisFin = await prisma.inventoryLot.count({
    where: {
      productionOrderId: oasis?.id ?? '__none__',
      inventoryItem: { itemClass: 'FINISHED_GOOD' },
      status: { in: ['AVAILABLE', 'RESERVED'] },
    },
  });
  evidence.E = { po: oasis?.number, status: oasis?.status, deliverableFin: oasisFin };
  mark('E', oasis && oasis.status === 'ON_HOLD' && oasisFin === 0 ? 'PASS' : 'FAIL', evidence.E);
  ok('E QC fail / no deliverable FIN', oasis?.status === 'ON_HOLD' && oasisFin === 0, JSON.stringify(evidence.E));

  // --- F Waiting truck FIN still there (Balqis) ---
  mark('F', 'RUN');
  const balqisFin = await prisma.inventoryLot.findMany({
    where: {
      productionOrderId: balqis?.id ?? '__none__',
      inventoryItem: { itemClass: 'FINISHED_GOOD' },
      status: { in: ['AVAILABLE', 'RESERVED'] },
    },
  });
  const balqisDelivery = balqisSo?.deliveries?.[0] ?? null;
  evidence.F = {
    finLots: balqisFin.length,
    finQty: balqisFin.reduce((s, l) => s + Number(l.quantity), 0),
    delivery: balqisDelivery
      ? { status: balqisDelivery.status, number: balqisDelivery.number }
      : null,
  };
  const fOk =
    balqisFin.length > 0 &&
    balqisDelivery &&
    ['PLANNED', 'READY'].includes(balqisDelivery.status);
  mark('F', fOk ? 'PASS' : 'FAIL', evidence.F);
  ok('F Waiting truck FIN', fOk, JSON.stringify(evidence.F));

  // --- G/H Nile OUT_FOR_DELIVERY issue + DELIVERED no duplicate ---
  mark('G', 'RUN');
  mark('H', 'RUN');
  const abdounSo = await soByProject('Abdoun lounge set');
  const nilePo = abdounSo?.productionOrders?.[0] ?? null;
  const nileDelivery = abdounSo?.deliveries?.find((d) => d.status === 'DELIVERED') ?? null;
  const deliveryIssues = nileDelivery
    ? await prisma.inventoryTransaction.findMany({
        where: { type: 'DELIVERY_ISSUE', referenceId: nileDelivery.id },
      })
    : [];
  const nileFinLeft = await prisma.inventoryLot.count({
    where: {
      productionOrderId: nilePo?.id ?? '__none__',
      inventoryItem: { itemClass: 'FINISHED_GOOD' },
      status: { in: ['AVAILABLE', 'RESERVED'] },
    },
  });
  evidence.G = { delivery: nileDelivery?.number, issues: deliveryIssues.length };
  evidence.H = { finLeftInFactory: nileFinLeft, issueCount: deliveryIssues.length };
  mark('G', deliveryIssues.length >= 1 ? 'PASS' : 'FAIL', evidence.G);
  mark('H', nileFinLeft === 0 && deliveryIssues.length === 1 ? 'PASS' : 'FAIL', evidence.H);
  ok('G DELIVERY_ISSUE exists', deliveryIssues.length >= 1, JSON.stringify(evidence.G));
  ok(
    'H DELIVERED no duplicate / no FIN left',
    nileFinLeft === 0 && deliveryIssues.length === 1,
    JSON.stringify(evidence.H),
  );

  // --- I/J/K usage variance / return / scrap ---
  mark('I', 'RUN');
  mark('J', 'RUN');
  mark('K', 'RUN');
  const usageRows = await prisma.productionTaskMaterialUsage.findMany({
    where: { productionOrderId: sweifieh?.id ?? '__none__' },
  });
  const hasEqual = usageRows.some(
    (r) => Number(r.actualQty) === Number(r.expectedQty) && Number(r.returnedQty) === 0 && Number(r.scrapQty) === 0,
  );
  const hasReturn = usageRows.some((r) => Number(r.returnedQty) > 0);
  const hasScrap = usageRows.some((r) => Number(r.scrapQty) > 0);
  const returnTx = await prisma.inventoryTransaction.count({
    where: {
      type: 'PRODUCTION_RETURN',
      referenceType: 'ProductionTask',
      referenceId: { in: usageRows.map((r) => r.taskId) },
    },
  });
  const scrapRestock = await prisma.inventoryTransaction.count({
    where: {
      type: 'PRODUCTION_RETURN',
      notes: { contains: 'scrap' },
      referenceId: { in: usageRows.map((r) => r.taskId) },
    },
  });
  evidence.I = { usageRows: usageRows.length, hasEqual, hasVarianceNotes: usageRows.some((r) => r.reasonNotes) };
  evidence.J = { hasReturn, returnTx };
  evidence.K = { hasScrap, scrapRestockTx: scrapRestock };
  mark('I', usageRows.length > 0 && (hasEqual || usageRows.some((r) => r.reasonNotes)) ? 'PASS' : 'FAIL', evidence.I);
  mark('J', hasReturn && returnTx > 0 ? 'PASS' : 'FAIL', evidence.J);
  mark('K', hasScrap && scrapRestock === 0 ? 'PASS' : 'FAIL', evidence.K);
  ok('I usage variance/equal posts', usageRows.length > 0, JSON.stringify(evidence.I));
  ok('J return + reservation', hasReturn && returnTx > 0, JSON.stringify(evidence.J));
  ok('K scrap not restocked', hasScrap && scrapRestock === 0, JSON.stringify(evidence.K));

  // --- L Worker cannot arbitrary issue; material-usage OK ---
  mark('L', 'RUN');
  const issueAttempt = await request('POST', '/api/v1/inventory/issues', {
    cookie: carpenter.cookie,
    body: {
      inventoryItemId: '00000000-0000-0000-0000-000000000001',
      warehouseId: '00000000-0000-0000-0000-000000000001',
      quantity: 1,
    },
  });
  const usageTaskId = usageRows[0]?.taskId;
  const assigneeId = usageTaskId
    ? (
        await prisma.productionTask.findUnique({
          where: { id: usageTaskId },
          select: { assignedEmployee: { select: { username: true } } },
        })
      )?.assignedEmployee?.username
    : null;
  const assignee = assigneeId ? await login(assigneeId) : null;
  const usageList =
    usageTaskId && assignee?.cookie
      ? await request('GET', `/api/v1/tasks/${usageTaskId}/material-usage`, {
          cookie: assignee.cookie,
        })
      : { status: 404 };
  evidence.L = {
    issueStatus: issueAttempt.status,
    usageStatus: usageList.status,
    assignee: assigneeId,
  };
  const lOk = [401, 403].includes(issueAttempt.status) && usageList.status === 200;
  mark('L', lOk ? 'PASS' : 'FAIL', evidence.L);
  ok('L worker 403 issue; usage path allowed', lOk, JSON.stringify(evidence.L));

  // --- M Dealer 403 internal inventory ---
  mark('M', 'RUN');
  const dealerInv = await request('GET', '/api/v1/inventory/items?page=1&pageSize=5', {
    cookie: nile.cookie,
  });
  const dealerSemi = await request('GET', '/api/v1/inventory/semi-finished?page=1&pageSize=5', {
    cookie: nile.cookie,
  });
  const dealerSo = await request('GET', '/api/v1/sales-orders?page=1&pageSize=5', {
    cookie: nile.cookie,
  });
  evidence.M = {
    items: dealerInv.status,
    semi: dealerSemi.status,
    salesOrders: dealerSo.status,
  };
  const mOk =
    [401, 403].includes(dealerInv.status) &&
    [401, 403].includes(dealerSemi.status) &&
    dealerSo.status === 200;
  mark('M', mOk ? 'PASS' : 'FAIL', evidence.M);
  ok('M dealer privacy', mOk, JSON.stringify(evidence.M));

  // --- N Father demo five stories ---
  mark('N', 'RUN');
  const stories = {
    nile: await soByProject('Abdoun lounge set'),
    sweifieh: await soByProject('Sweifieh sectional'),
    balqis: await soByProject('Abdali hotel banquettes'),
    cedar: await soByProject('Cedar Italian velvet recliner'),
    diwan: await soByProject('Diwan wingback frame gate'),
  };
  const diwanSemi = await prisma.inventoryLot.count({
    where: {
      productionOrder: { salesOrderId: stories.diwan?.id ?? '__none__' },
      inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD' },
    },
  });
  evidence.N = {
    present: Object.fromEntries(Object.entries(stories).map(([k, v]) => [k, Boolean(v)])),
    diwanSemiLots: diwanSemi,
  };
  const nOk = Object.values(stories).every(Boolean) && diwanSemi === 0;
  mark('N', nOk ? 'PASS' : 'FAIL', evidence.N);
  ok('N father demo five stories', nOk, JSON.stringify(evidence.N));

  // --- O Retry idempotent (re-read same delivery issue key) ---
  mark('O', 'RUN');
  const keys = deliveryIssues.map((t) => t.idempotencyKey).filter(Boolean);
  const uniqueKeys = new Set(keys);
  evidence.O = { issueKeys: keys.length, unique: uniqueKeys.size };
  mark('O', keys.length > 0 && keys.length === uniqueKeys.size ? 'PASS' : 'FAIL', evidence.O);
  ok('O retry idempotent keys', keys.length > 0 && keys.length === uniqueKeys.size, JSON.stringify(evidence.O));

  // API list endpoints for staff
  const finLotsApi = await request('GET', '/api/v1/inventory/finished-lots?page=1&pageSize=20', {
    cookie: admin.cookie,
  });
  ok('finished-lots API', finLotsApi.status === 200 && Array.isArray(finLotsApi.json?.data));
  const semiApi = await request('GET', '/api/v1/inventory/semi-finished?page=1&pageSize=20', {
    cookie: admin.cookie,
  });
  ok('semi-finished API', semiApi.status === 200 && Array.isArray(semiApi.json?.data));

  const failed = Object.values(tests).filter((t) => t.status === 'FAIL');
  const outDir = resolve(ROOT, 'tmp');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'production-inventory-lifecycle-uat.json');
  writeFileSync(
    outPath,
    JSON.stringify({ at: new Date().toISOString(), tests, steps, evidence, failed: failed.length }, null, 2),
  );
  console.log(`\nWrote ${outPath}`);
  console.log(`Score: ${Object.keys(tests).length - failed.length}/${Object.keys(tests).length} PASS`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
