/**
 * Live global scheduling-floor UAT against running API + maher_erp.
 * Isolated PFLOOR-UAT throwaways; cleans up. Jest is not PASS.
 *
 * Usage: pnpm smoke:scheduling-past-floor-uat
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';
const TAG = 'PFLOOR-UAT';
const NOTE = 'PFLOOR-UAT past-floor live uat';

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
const created = { poIds: [], exceptionDates: [] };

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

function ymdAmman(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Amman',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
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
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
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
    } catch (err) {
      last = { status: 0, json: null, setCookie: [], text: String(err?.message ?? err) };
    }
    await sleep(400 * 2 ** Math.min(attempt, 5));
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
    body: { signatureData: 'data:image/png;base64,pfloor' },
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

async function waitForIdleFactory() {
  for (let i = 0; i < 90; i += 1) {
    const live = await prisma.schedulingReplanRun.findMany({
      where: { status: { in: ['QUEUED', 'RUNNING'] } },
      select: { id: true },
    });
    if (!live.length) return true;
    await sleep(2000);
  }
  return false;
}

async function postAndPoll(adminCookie, path) {
  const idle = await waitForIdleFactory();
  if (!idle) return { error: 'factory run still live after wait' };
  const posted = await request('POST', path, { cookie: adminCookie, body: {} });
  const runId = posted.json?.replanJobId;
  if (posted.status >= 400 || !runId) return { posted, error: errDetail(posted) };
  const run = await pollRun(adminCookie, runId);
  return { posted, run, runId };
}

function isLocked(status) {
  return status === 'COMPLETED' || status === 'IN_PROGRESS' || status === 'BLOCKED';
}

function incompletePastViolations(allocs, todayYmd, nowMs) {
  return allocs.filter((a) => {
    const status = a.productionTask?.status ?? null;
    if (isLocked(status) || status === 'CANCELLED') return false;
    if (a.isPinned) return false;
    const ymd = ymdAmman(a.plannedStart);
    if (ymd > todayYmd) return false;
    if (ymd < todayYmd) return true;
    return a.plannedStart.getTime() + 60_000 < nowMs;
  });
}

async function plantStaleIncomplete(poId) {
  const po = await prisma.productionOrder.findUnique({
    where: { id: poId },
    include: {
      tasks: { where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } }, take: 1 },
      schedules: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
  const task = po?.tasks?.[0];
  if (!task) return { error: 'no task' };
  const yesterday = addDaysYmd(ymdAmman(), -1);
  const start = new Date(`${yesterday}T05:00:00.000Z`);
  const end = new Date(`${yesterday}T08:00:00.000Z`);
  await prisma.productionSchedule.updateMany({
    where: { productionOrderId: poId, status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] } },
    data: { status: 'SUPERSEDED' },
  });
  const version = (po.schedules?.[0]?.version ?? 0) + 1;
  const sch = await prisma.productionSchedule.create({
    data: {
      productionOrderId: poId,
      version,
      status: 'APPROVED',
      promiseState: 'CONFIRMED',
      requestedDeliveryDate: po.requiredDeliveryDate,
      committedDeliveryDate: po.committedDeliveryDate,
      reason: `${TAG} planted stale`,
      allocations: {
        create: {
          productionTaskId: task.id,
          resourceType: 'EMPLOYEE',
          plannedStart: start,
          plannedEnd: end,
          estimatedMinutes: 180,
          isPinned: false,
        },
      },
    },
  });
  await prisma.productionTask.update({
    where: { id: task.id },
    data: { plannedStart: start, plannedCompletion: end, status: 'READY' },
  });
  return { scheduleId: sch.id, taskId: task.id, start: start.toISOString() };
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
  if (created.exceptionDates.length) {
    for (const ymd of created.exceptionDates) {
      await prisma.factoryCalendarException.deleteMany({ where: { date: new Date(`${ymd}T00:00:00.000Z`) } }).catch(() => undefined);
    }
  }
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
  ok('retired prior PFLOOR-UAT POs', true, String(retired));

  const admin = await login('admin');
  const nile = await login('nile');
  ok('admin login', admin.status === 200 || admin.status === 201, String(admin.status));
  ok('nile login', nile.status === 200 || nile.status === 201, String(nile.status));

  const todayYmd = ymdAmman();
  const nowMs = Date.now();
  evidence.todayYmd = todayYmd;

  const nileCust = await prisma.customer.findFirst({
    where: { users: { some: { username: 'nile' } } },
    select: { id: true },
  });
  const productDonor = await prisma.productionOrder.findFirst({
    where: { number: 'PO-2026-00047' },
    select: {
      product: { select: { id: true, sku: true } },
      committedDeliveryDate: true,
      requiredDeliveryDate: true,
    },
  });
  const product = productDonor?.product;
  ok('nile customer + product', Boolean(nileCust?.id && product?.id), product?.sku ?? '');

  const made = await createConfirmedOrder({
    adminCookie: admin.cookie,
    dealerCookie: nile.cookie,
    customerId: nileCust.id,
    product,
    qty: 1,
    label: 'stale-yesterday',
  });
  ok('created throwaway PO', Boolean(made.poId), made.error ?? made.poId);
  if (!made.poId) throw new Error('no throwaway PO');

  await prisma.productionOrder.update({
    where: { id: made.poId },
    data: {
      requiredDeliveryDate: new Date('2026-08-20T13:00:00.000Z'),
      committedDeliveryDate: new Date('2026-08-20T13:00:00.000Z'),
    },
  });

  const planted = await plantStaleIncomplete(made.poId);
  ok('planted stale yesterday allocation', Boolean(planted.scheduleId), planted.error ?? planted.start);
  evidence.planted = planted;

  mark('SYNC', 'RUN');
  const sync = await postAndPoll(admin.cookie, '/api/v1/scheduling/sync');
  ok('sync completed', sync.run?.status === 'COMPLETED', sync.error ?? sync.run?.status);
  ok(
    'sync newConflicts 0',
    Number(sync.run?.result?.newConflictsIntroduced ?? 1) === 0,
    String(sync.run?.result?.newConflictsIntroduced),
  );
  const afterSync = await prisma.productionOrder.findUnique({
    where: { id: made.poId },
    include: {
      schedules: {
        where: { status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] } },
        orderBy: { version: 'desc' },
        take: 1,
        include: { allocations: { include: { productionTask: { select: { status: true } } } } },
      },
    },
  });
  const syncViolations = incompletePastViolations(
    afterSync?.schedules?.[0]?.allocations ?? [],
    todayYmd,
    nowMs,
  );
  ok('SYNC PAST-SAFE: 0 new incomplete past allocs', syncViolations.length === 0, String(syncViolations.length));
  tests.SYNC = { status: syncViolations.length === 0 ? 'PASS' : 'FAIL', violations: syncViolations.length };

  mark('RECALCULATE', 'RUN');
  const recalc = await request('POST', `/api/v1/scheduling/orders/${made.poId}/recalculate`, {
    cookie: admin.cookie,
    body: { mode: 'backward', reason: `${TAG} recalc` },
  });
  ok('recalculate HTTP', recalc.status < 400, errDetail(recalc));
  const afterRecalc = await prisma.productionOrder.findUnique({
    where: { id: made.poId },
    include: {
      schedules: {
        where: { status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] } },
        orderBy: { version: 'desc' },
        take: 1,
        include: { allocations: { include: { productionTask: { select: { status: true } } } } },
      },
    },
  });
  const recalcViolations = incompletePastViolations(
    afterRecalc?.schedules?.[0]?.allocations ?? [],
    todayYmd,
    Date.now(),
  );
  ok('RECALCULATE PAST-SAFE', recalcViolations.length === 0, String(recalcViolations.length));
  const committedUnchanged =
    String(afterRecalc?.committedDeliveryDate ?? '') === String(new Date('2026-08-20T13:00:00.000Z'));
  ok('committed date unchanged', committedUnchanged, String(afterRecalc?.committedDeliveryDate));
  tests.RECALCULATE = { status: recalcViolations.length === 0 ? 'PASS' : 'FAIL' };

  mark('OPTIMIZE', 'RUN');
  const preview = await postAndPoll(admin.cookie, '/api/v1/scheduling/optimize/preview');
  ok('optimize preview completed', preview.run?.status === 'COMPLETED', preview.error ?? preview.run?.status);
  const moves = preview.run?.result?.previewMoves ?? [];
  const illegalPreview = moves.filter((m) => {
    const iso = m.proposedCompletion ?? m.proposedStart;
    if (!iso) return false;
    return ymdAmman(new Date(iso)) < todayYmd;
  });
  ok('OPTIMIZE preview not before today', illegalPreview.length === 0, String(illegalPreview.length));
  tests.OPTIMIZE = { status: illegalPreview.length === 0 ? 'PASS' : 'FAIL' };

  mark('CALENDAR', 'RUN');
  const histYmd = addDaysYmd(todayYmd, -4);
  const opened = await request('POST', '/api/v1/scheduling/calendar-settings/exceptions', {
    cookie: admin.cookie,
    body: { date: histYmd, type: 'EXTRA_SHIFT', shiftStart: '08:00', shiftEnd: '16:00', note: `${TAG} historical open` },
  });
  ok('historical extra-shift posted', opened.status < 400, errDetail(opened));
  created.exceptionDates.push(histYmd);
  if (opened.json?.replanJobId) {
    const calRun = await pollRun(admin.cookie, opened.json.replanJobId);
    ok('calendar replan completed', calRun?.status === 'COMPLETED', calRun?.status);
    evidence.calendarRun = { runId: calRun?.id, moved: calRun?.result?.moved, candidates: calRun?.result?.candidateOrders };
  }
  const afterCal = await prisma.productionOrder.findUnique({
    where: { id: made.poId },
    include: {
      schedules: {
        where: { status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] } },
        orderBy: { version: 'desc' },
        take: 1,
        include: { allocations: { include: { productionTask: { select: { status: true } } } } },
      },
    },
  });
  const pulledBackward = (afterCal?.schedules?.[0]?.allocations ?? []).filter((a) => {
    if (isLocked(a.productionTask?.status)) return false;
    return ymdAmman(a.plannedStart) === histYmd;
  });
  ok('CALENDAR PAST-SAFE: no current work on historical opened day', pulledBackward.length === 0, String(pulledBackward.length));
  tests.CALENDAR = { status: pulledBackward.length === 0 ? 'PASS' : 'FAIL' };

  const factoryScan = await prisma.scheduleAllocation.findMany({
    where: {
      schedule: {
        status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] },
        productionOrderId: { in: created.poIds },
      },
    },
    include: { productionTask: { select: { status: true } } },
  });
  const factoryViolations = incompletePastViolations(factoryScan, todayYmd, Date.now());
  ok('throwaway incomplete past allocations = 0', factoryViolations.length === 0, String(factoryViolations.length));

  evidence.sync = { runId: sync.runId, outcome: sync.run?.result?.outcome, pastDueRescheduled: sync.run?.result?.pastDueRescheduled };
  evidence.recalc = { status: recalc.status };
  evidence.preview = { runId: preview.runId, moveCount: moves.length };

  await request('DELETE', `/api/v1/scheduling/calendar-settings/exceptions/${histYmd}`, { cookie: admin.cookie }).catch(
    () => undefined,
  );

  const failed = steps.filter((s) => !s.ok);
  const out = {
    at: new Date().toISOString(),
    todayYmd,
    tests,
    evidence,
    steps,
    failed: failed.map((s) => s.name),
  };
  writeFileSync(resolve(ROOT, 'tmp-scheduling-past-floor-uat.json'), JSON.stringify(out, null, 2));
  console.log(`\n${steps.filter((s) => s.ok).length}/${steps.length} checks passed. Failed: ${failed.map((s) => s.name).join(', ') || 'none'}`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((err) => console.error('cleanup', err));
    await prisma.$disconnect();
  });
