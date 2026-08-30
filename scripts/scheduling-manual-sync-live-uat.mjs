/**
 * Live Admin Sync Schedule UAT against running API + maher_erp.
 * Isolated MSYNC-UAT throwaway rows; cleans up. Jest is not PASS.
 *
 * Usage: pnpm smoke:scheduling-sync-uat
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';
const TAG = 'MSYNC-UAT';
const NOTE = 'MSYNC-UAT manual-sync live uat';
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
const created = { poIds: [] };

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

async function approveQuotation(quoteId, cookie) {
  await request('POST', `/api/v1/quotations/${quoteId}/submit-for-approval`, { cookie });
  let approve = await request('POST', `/api/v1/quotations/${quoteId}/approve`, { cookie });
  for (let i = 0; i < 4 && approve.json?.status === 'INTERNAL_REVIEW'; i += 1) {
    approve = await request('POST', `/api/v1/quotations/${quoteId}/approve`, { cookie });
  }
  return approve;
}

async function createConfirmedOrder({ adminCookie, dealerCookie, customerId, product, qty, label }) {
  const quote = await request('POST', '/api/v1/quotations', {
    cookie: adminCookie,
    body: {
      customerId,
      paymentTerms: TAG,
      deliveryTerms: NOTE,
      internalNotes: `${TAG} ${label}`,
      lines: [
        {
          productId: product.id,
          description: `${TAG} ${label} ${product.sku}`,
          quantity: qty,
          unitPrice: 1500,
          taxRate: 0.16,
        },
      ],
    },
  });
  if (!quote.json?.id) return { error: `quote failed ${errDetail(quote)}`, label };
  await approveQuotation(quote.json.id, adminCookie);
  await request('POST', `/api/v1/quotations/${quote.json.id}/send`, { cookie: adminCookie });
  const accepted = await request('POST', `/api/v1/quotations/${quote.json.id}/accept`, {
    cookie: dealerCookie,
    body: { signatureData: 'data:image/png;base64,msync' },
  });
  const soId =
    accepted.json?.salesOrders?.[0]?.id ??
    accepted.json?.salesOrder?.id ??
    (await (async () => {
      const list = await request('GET', '/api/v1/sales-orders?pageSize=50', { cookie: adminCookie });
      return (list.json?.data ?? []).find((s) => s.quotation?.id === quote.json.id)?.id;
    })());
  if (!soId) return { error: `no SO ${errDetail(accepted)}`, label };
  const confirmed = await request('POST', `/api/v1/sales-orders/${soId}/confirm`, { cookie: adminCookie });
  const soRes = await request('GET', `/api/v1/sales-orders/${soId}`, { cookie: adminCookie });
  const so = soRes.json?.id ? soRes.json : confirmed.json;
  const po =
    (so?.productionOrders ?? []).find((p) => p.salesOrderId === soId || p.salesOrder?.id === soId) ??
    so?.productionOrders?.[0];
  let poId = po?.id;
  if (!poId) {
    const poList = await request('GET', '/api/v1/production-orders?pageSize=100', { cookie: adminCookie });
    poId = (poList.json?.data ?? []).find((p) => p.salesOrderId === soId || p.salesOrder?.id === soId)?.id;
  }
  if (poId) {
    created.poIds.push(poId);
    await request('PATCH', `/api/v1/production-orders/${poId}`, {
      cookie: adminCookie,
      body: { notes: `${TAG} ${label}` },
    });
  }
  return { quoteId: quote.json.id, soId, poId, number: po?.number, error: poId ? undefined : `no PO ${errDetail(confirmed)}` };
}

async function pollRun(adminCookie, runId, timeoutMs = 420_000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    const res = await request('GET', `/api/v1/scheduling/replan-runs/${encodeURIComponent(runId)}`, {
      cookie: adminCookie,
    });
    last = res.json;
    if (last?.status === 'COMPLETED' || last?.status === 'FAILED') return last;
    await sleep(2000);
  }
  return last;
}

async function postSync(cookie) {
  return request('POST', '/api/v1/scheduling/sync', { cookie, body: {} });
}

async function waitForIdleFactory(adminCookie) {
  for (let i = 0; i < 90; i += 1) {
    const live = await prisma.schedulingReplanRun.findMany({
      where: { status: { in: ['QUEUED', 'RUNNING'] } },
      select: { id: true, status: true, changeType: true },
    });
    if (!live.length) return true;
    await sleep(2000);
  }
  return false;
}

async function runSync(adminCookie) {
  const idle = await waitForIdleFactory(adminCookie);
  if (!idle) return { error: 'factory run still live after wait' };
  const posted = await postSync(adminCookie);
  const runId = posted.json?.replanJobId;
  if (posted.status >= 400 || !runId) {
    return { posted, error: errDetail(posted) };
  }
  const run = await pollRun(adminCookie, runId);
  return { posted, run, runId };
}

function fingerprint(po) {
  const allocs = (po.schedules ?? [])
    .filter((s) => ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'].includes(s.status))
    .flatMap((s) => s.allocations ?? []);
  return JSON.stringify(
    allocs
      .map((a) => ({
        id: a.id,
        start: a.plannedStart?.toISOString?.() ?? a.plannedStart,
        end: a.plannedEnd?.toISOString?.() ?? a.plannedEnd,
        emp: a.employeeId,
        pin: a.isPinned,
      }))
      .sort((a, b) => String(a.start).localeCompare(String(b.start))),
  );
}

async function loadWalkthrough() {
  return prisma.productionOrder.findMany({
    where: { number: { in: WALKTHROUGH_POS } },
    include: {
      schedules: {
        where: { status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW', 'SUPERSEDED'] } },
        orderBy: { version: 'desc' },
        include: { allocations: true },
      },
    },
  });
}

async function retirePrior() {
  const pos = await prisma.productionOrder.findMany({
    where: {
      OR: [{ notes: { contains: TAG } }, { salesOrder: { quotation: { paymentTerms: TAG } } }],
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
    },
    select: { id: true },
  });
  if (!pos.length) return 0;
  const ids = pos.map((p) => p.id);
  await prisma.productionSchedule.updateMany({
    where: { productionOrderId: { in: ids }, status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] } },
    data: { status: 'SUPERSEDED' },
  });
  await prisma.productionOrder.updateMany({ where: { id: { in: ids } }, data: { status: 'CANCELLED' } });
  return ids.length;
}

async function cleanup() {
  if (!created.poIds.length) return;
  await prisma.productionSchedule.updateMany({
    where: {
      productionOrderId: { in: created.poIds },
      status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] },
    },
    data: { status: 'SUPERSEDED' },
  });
  await prisma.productionOrder.updateMany({
    where: { id: { in: created.poIds } },
    data: { status: 'CANCELLED' },
  });
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

  const retired = await retirePrior();
  ok('retired prior MSYNC-UAT POs', true, String(retired));

  const admin = await login('admin');
  const nile = await login('nile');
  const warehouse = await login('warehouse');
  const carpenter = await login('carpenter');
  ok('admin login', admin.status === 200 || admin.status === 201, String(admin.status));
  ok('nile login', nile.status === 200 || nile.status === 201, String(nile.status));
  ok('warehouse login', warehouse.status === 200 || warehouse.status === 201, String(warehouse.status));

  const forbiddenWh = await postSync(warehouse.cookie);
  ok(
    'warehouse cannot sync',
    forbiddenWh.status === 403,
    errDetail(forbiddenWh),
  );
  tests.PERM_WAREHOUSE = { status: forbiddenWh.status === 403 ? 'PASS' : 'FAIL', http: forbiddenWh.status };
  const forbiddenWorker = await postSync(carpenter.cookie);
  ok('worker cannot sync', forbiddenWorker.status === 403, errDetail(forbiddenWorker));

  const cedar = await prisma.productionOrder.findFirst({
    where: { number: 'PO-2026-00056' },
    include: { schedules: { orderBy: { version: 'desc' }, take: 3 } },
  });
  const diwan = await prisma.productionOrder.findFirst({
    where: { number: 'PO-2026-00051' },
    include: { schedules: { orderBy: { version: 'desc' }, take: 3 } },
  });
  const jabal = await prisma.productionOrder.findFirst({
    where: { number: 'PO-2026-00023' },
    select: { id: true, number: true, committedDeliveryDate: true, requiredDeliveryDate: true },
  });
  ok('Cedar material PO present', Boolean(cedar?.id), cedar?.number ?? '');
  ok('Diwan WIP PO present', Boolean(diwan?.id), diwan?.number ?? '');
  evidence.cedarBefore = cedar
    ? { id: cedar.id, status: cedar.status, versions: cedar.schedules.map((s) => ({ v: s.version, status: s.status })) }
    : null;
  evidence.diwanBefore = diwan
    ? { id: diwan.id, status: diwan.status, versions: diwan.schedules.map((s) => ({ v: s.version, status: s.status })) }
    : null;
  evidence.jabalCommittedBefore = jabal?.committedDeliveryDate?.toISOString?.() ?? null;

  const beforeWalk = await loadWalkthrough();
  const beforeFp = Object.fromEntries(beforeWalk.map((p) => [p.number, fingerprint(p)]));
  const beforeVersions = Object.fromEntries(
    beforeWalk.map((p) => [p.number, Math.max(0, ...p.schedules.map((s) => s.version), 0)]),
  );

  mark('A', 'RUN', { expected: 'healthy factory mostly alreadyValid; not a mass rewrite' });
  const first = await runSync(admin.cookie);
  ok('first sync HTTP', Boolean(first.run), first.error ?? first.runId ?? '');
  const result = first.run?.result ?? {};
  evidence.firstRun = {
    runId: first.runId,
    status: first.run?.status,
    outcome: result.outcome,
    scanned: result.scannedOrders,
    alreadyValid: result.alreadyValid,
    generated: result.generated,
    replanned: result.replanned,
    moved: result.moved,
    blocked: result.blocked,
    manualAttention: result.manualAttention,
    newConflictsIntroduced: result.newConflictsIntroduced,
  };
  ok('first sync completed', first.run?.status === 'COMPLETED', first.run?.status);
  ok('newConflictsIntroduced is 0', Number(result.newConflictsIntroduced ?? 1) === 0, String(result.newConflictsIntroduced));
  ok(
    'outcome is derived (not missing)',
    ['UP_TO_DATE', 'CHANGED', 'PARTIAL'].includes(result.outcome),
    String(result.outcome),
  );

  const afterWalk = await loadWalkthrough();
  const movedWalkthrough = afterWalk.filter((p) => fingerprint(p) !== beforeFp[p.number]).map((p) => p.number);
  const versionJumps = afterWalk.filter((p) => Math.max(0, ...p.schedules.map((s) => s.version), 0) > (beforeVersions[p.number] ?? 0));
  evidence.fatherDemoDelta = { movedWalkthrough, versionJumps: versionJumps.map((p) => p.number) };
  const fatherOk = movedWalkthrough.length < 8;
  ok(
    'father-demo gate: not a mass rewrite of curated orders',
    fatherOk,
    `moved ${movedWalkthrough.length}: ${movedWalkthrough.join(', ') || 'none'}`,
  );
  if (!fatherOk) {
    mark('FATHER_DEMO', 'FAIL', {
      expected: 'mostly alreadyValid; curated POs stay put',
      actual: JSON.stringify(evidence.fatherDemoDelta),
    });
    console.error('\nSTOP: Sync moved curated father-demo orders. Investigate before accepting.\n');
  } else {
    mark('FATHER_DEMO', 'PASS', { actual: JSON.stringify(evidence.fatherDemoDelta) });
  }

  const cedarAfter = await prisma.productionOrder.findFirst({
    where: { id: cedar?.id ?? '__none__' },
    include: { schedules: { orderBy: { version: 'desc' }, take: 3 } },
  });
  const cedarVersionUnchanged =
    (cedarAfter?.schedules?.[0]?.version ?? 0) === (cedar?.schedules?.[0]?.version ?? 0);
  const cedarBlockedListed =
    Array.isArray(result.blockedItems) &&
    result.blockedItems.some((row) => row.productionOrderId === cedar?.id || row.number === 'PO-2026-00056');
  const cedarReadyAt = cedarAfter?.schedules?.[0]?.materialReadyAt ?? cedar?.schedules?.[0]?.materialReadyAt;
  const cedarMayRepair = Boolean(cedarReadyAt);
  ok(
    'E: Cedar stays put unless inbound readyAt allows a repair',
    cedarMayRepair || cedarVersionUnchanged,
    `readyAt=${cedarReadyAt ? String(cedarReadyAt) : 'none'} before v${cedar?.schedules?.[0]?.version ?? 0} after v${cedarAfter?.schedules?.[0]?.version ?? 0} blockedListed=${cedarBlockedListed}`,
  );
  tests.E_MATERIAL = {
    status: cedarMayRepair || cedarVersionUnchanged ? 'PASS' : 'FAIL',
    blockedListed: cedarBlockedListed,
    readyAt: cedarReadyAt,
    versions: { before: cedar?.schedules?.[0]?.version, after: cedarAfter?.schedules?.[0]?.version },
  };

  const diwanAfter = await prisma.productionOrder.findFirst({
    where: { id: diwan?.id ?? '__none__' },
    include: { schedules: { orderBy: { version: 'desc' }, take: 3 } },
  });
  const diwanVersionUnchanged =
    (diwanAfter?.schedules?.[0]?.version ?? 0) === (diwan?.schedules?.[0]?.version ?? 0);
  ok(
    'F: Diwan WIP PO not generated while still blocked',
    diwanVersionUnchanged,
    `before v${diwan?.schedules?.[0]?.version ?? 0} after v${diwanAfter?.schedules?.[0]?.version ?? 0}`,
  );

  const jabalAfter = await prisma.productionOrder.findFirst({
    where: { id: jabal?.id ?? '__none__' },
    select: { committedDeliveryDate: true, requiredDeliveryDate: true },
  });
  ok(
    'committed date unchanged on Jabal',
    String(jabalAfter?.committedDeliveryDate ?? '') === String(jabal?.committedDeliveryDate ?? ''),
    `${evidence.jabalCommittedBefore} → ${jabalAfter?.committedDeliveryDate?.toISOString?.() ?? jabalAfter?.committedDeliveryDate}`,
  );

  const completed = await prisma.productionOrder.findFirst({
    where: { number: 'PO-2026-00001', status: 'COMPLETED' },
    select: { id: true },
  });
  const generatedIds = result.generatedIds ?? [];
  ok(
    'terminal COMPLETED PO ignored',
    !completed?.id || !generatedIds.includes(completed.id),
    completed?.id ?? 'missing',
  );

  mark('B', 'RUN', { expected: 'unscheduled ready throwaway is generated' });
  const nileCust = await prisma.customer.findFirst({
    where: { users: { some: { username: 'nile' } } },
    select: { id: true },
  });
  const productDonor = await prisma.productionOrder.findFirst({
    where: { number: 'PO-2026-00047' },
    select: { product: { select: { id: true, sku: true } } },
  });
  const product = productDonor?.product;
  ok('nile customer + schedulable product', Boolean(nileCust?.id && product?.id), product?.sku ?? '');
  let readyPo = null;
  if (nileCust?.id && product?.id) {
    readyPo = await createConfirmedOrder({
      adminCookie: admin.cookie,
      dealerCookie: nile.cookie,
      customerId: nileCust.id,
      product,
      qty: 1,
      label: 'unscheduled-ready',
    });
    ok('created unscheduled ready PO', Boolean(readyPo.poId), readyPo.error ?? readyPo.poId);
    if (readyPo.poId) {
      await prisma.productionOrder.update({
        where: { id: readyPo.poId },
        data: {
          requiredDeliveryDate: new Date('2026-12-15T13:00:00.000Z'),
          committedDeliveryDate: new Date('2026-12-15T13:00:00.000Z'),
        },
      });
      await prisma.productionSchedule.updateMany({
        where: {
          productionOrderId: readyPo.poId,
          status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] },
        },
        data: { status: 'SUPERSEDED' },
      });
      const beforeSchedules = await prisma.productionSchedule.count({
        where: { productionOrderId: readyPo.poId, status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] } },
      });
      const second = await runSync(admin.cookie);
      const afterSchedules = await prisma.productionSchedule.findMany({
        where: { productionOrderId: readyPo.poId },
        orderBy: { version: 'desc' },
        take: 2,
      });
      evidence.unscheduledReady = {
        poId: readyPo.poId,
        beforeActive: beforeSchedules,
        after: afterSchedules.map((s) => ({ v: s.version, status: s.status })),
        generated: (second.run?.result?.generatedIds ?? []).includes(readyPo.poId),
        outcome: second.run?.result?.outcome,
      };
      const generated =
        afterSchedules.some((s) => ['APPROVED', 'PROPOSED'].includes(s.status)) ||
        (second.run?.result?.generatedIds ?? []).includes(readyPo.poId);
      ok('B: unscheduled ready PO received a schedule or was listed generated', generated, JSON.stringify(evidence.unscheduledReady));
      tests.B_UNSCHEDULED = { status: generated ? 'PASS' : 'FAIL', ...evidence.unscheduledReady };

      mark('SECOND', 'RUN', { expected: 'second sync does not churn the new plan' });
      const fp1 = await prisma.productionSchedule.findFirst({
        where: { productionOrderId: readyPo.poId, status: { in: ['APPROVED', 'PROPOSED'] } },
        orderBy: { version: 'desc' },
        include: { allocations: true },
      });
      const third = await runSync(admin.cookie);
      const fp2 = await prisma.productionSchedule.findFirst({
        where: { productionOrderId: readyPo.poId, status: { in: ['APPROVED', 'PROPOSED'] } },
        orderBy: { version: 'desc' },
        include: { allocations: true },
      });
      const noNewGenerate = !(third.run?.result?.generatedIds ?? []).includes(readyPo.poId);
      ok(
        'second sync does not generate a new schedule from scratch for the throwaway',
        noNewGenerate,
        `generatedIds includes throwaway=${!noNewGenerate} outcome=${third.run?.result?.outcome}`,
      );
      ok(
        'second sync newConflictsIntroduced is 0',
        Number(third.run?.result?.newConflictsIntroduced ?? 1) === 0,
        String(third.run?.result?.newConflictsIntroduced),
      );
      evidence.secondSync = {
        runId: third.runId,
        outcome: third.run?.result?.outcome,
        generated: third.run?.result?.generated,
        replanned: third.run?.result?.replanned,
        alreadyValid: third.run?.result?.alreadyValid,
      };
    }
  }

  const firstOutcome = result.outcome;
  if (Number(result.generated ?? 0) + Number(result.replanned ?? 0) === 0 && Number(result.blocked ?? 0) + Number(result.manualAttention ?? 0) === 0) {
    ok('A: healthy factory reports UP_TO_DATE', firstOutcome === 'UP_TO_DATE', String(firstOutcome));
    tests.A_UP_TO_DATE = { status: firstOutcome === 'UP_TO_DATE' ? 'PASS' : 'FAIL', outcome: firstOutcome };
  } else {
    ok(
      'A: demo with known blockers is PARTIAL (not a false UP_TO_DATE)',
      firstOutcome === 'PARTIAL' || firstOutcome === 'CHANGED',
      String(firstOutcome),
    );
    tests.A_UP_TO_DATE = { status: 'N/A', note: 'demo has remaining attention', outcome: firstOutcome };
  }

  await cleanup();

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.filter((s) => !s.ok).length;
  evidence.score = { passed, failed, total: steps.length };
  console.log(`\n${passed}/${steps.length} steps passed, ${failed} failed`);
  const out = {
    at: new Date().toISOString(),
    tests,
    evidence,
    steps,
  };
  writeFileSync(resolve(ROOT, 'tmp-scheduling-sync-uat.json'), JSON.stringify(out, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
