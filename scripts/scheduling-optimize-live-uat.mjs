/**
 * Live Admin Optimize Capacity UAT against running API + maher_erp.
 * Isolated OPTCAP-UAT throwaways; cleans up. Jest is not PASS.
 * Hard stop: new conflicts, dealer date changes, or excessive churn.
 *
 * Usage: pnpm smoke:scheduling-optimize-uat
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';
const TAG = 'OPTCAP-UAT';
const NOTE = 'OPTCAP-UAT capacity-optimize live uat';
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
      select: { id: true, status: true, changeType: true },
    });
    if (!live.length) return true;
    await sleep(2000);
  }
  return false;
}

async function postOptimize(cookie, mode) {
  return request('POST', `/api/v1/scheduling/optimize/${mode}`, { cookie, body: {} });
}

async function runOptimize(adminCookie, mode) {
  const idle = await waitForIdleFactory();
  if (!idle) return { error: 'factory run still live after wait' };
  const posted = await postOptimize(adminCookie, mode);
  const runId = posted.json?.replanJobId;
  if (posted.status >= 400 || !runId) {
    return { posted, error: errDetail(posted) };
  }
  const run = await pollRun(adminCookie, runId);
  return { posted, run, runId };
}

function dateKey(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

async function snapshotWalkthrough() {
  const rows = await prisma.productionOrder.findMany({
    where: { number: { in: WALKTHROUGH_POS } },
    select: {
      id: true,
      number: true,
      requiredDeliveryDate: true,
      committedDeliveryDate: true,
      schedules: {
        where: { status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] } },
        orderBy: { version: 'desc' },
        take: 1,
        select: {
          id: true,
          version: true,
          committedDeliveryDate: true,
          requestedDeliveryDate: true,
          earliestAvailableDate: true,
        },
      },
    },
  });
  return Object.fromEntries(
    rows.map((r) => [
      r.number,
      {
        id: r.id,
        requiredDeliveryDate: dateKey(r.requiredDeliveryDate),
        committedDeliveryDate: dateKey(r.committedDeliveryDate),
        scheduleCommitted: dateKey(r.schedules[0]?.committedDeliveryDate),
        scheduleRequested: dateKey(r.schedules[0]?.requestedDeliveryDate),
        earliest: dateKey(r.schedules[0]?.earliestAvailableDate),
        version: r.schedules[0]?.version ?? null,
      },
    ]),
  );
}

function datesUnchanged(before, after) {
  const keys = Object.keys(before);
  const changed = [];
  for (const number of keys) {
    const a = before[number];
    const b = after[number];
    if (!b) {
      changed.push(`${number} missing`);
      continue;
    }
    if (a.requiredDeliveryDate !== b.requiredDeliveryDate) changed.push(`${number} required`);
    if (a.committedDeliveryDate !== b.committedDeliveryDate) changed.push(`${number} committed`);
    if (a.scheduleRequested !== b.scheduleRequested) changed.push(`${number} schedule.requested`);
    if (a.scheduleCommitted !== b.scheduleCommitted) changed.push(`${number} schedule.committed`);
  }
  return changed;
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
  ok('retired prior OPTCAP-UAT POs', true, String(retired));

  const admin = await login('admin');
  const warehouse = await login('warehouse');
  const carpenter = await login('carpenter');
  ok('admin login', admin.status === 200 || admin.status === 201, String(admin.status));

  mark('PERM', 'RUN');
  const forbiddenWh = await postOptimize(warehouse.cookie, 'preview');
  ok('warehouse cannot optimize', forbiddenWh.status === 403, errDetail(forbiddenWh));
  const forbiddenWorker = await postOptimize(carpenter.cookie, 'apply');
  ok('worker cannot apply optimize', forbiddenWorker.status === 403, errDetail(forbiddenWorker));

  const calendar = await prisma.factoryCalendar.findFirst({ where: { isDefault: true } });
  ok(
    'calendar has maxProductionEarlyWorkingDays',
    calendar?.maxProductionEarlyWorkingDays != null,
    String(calendar?.maxProductionEarlyWorkingDays),
  );
  ok(
    'calendar has targetFactoryUtilizationPercent',
    calendar?.targetFactoryUtilizationPercent != null,
    String(calendar?.targetFactoryUtilizationPercent),
  );
  evidence.calendar = {
    maxProductionEarlyWorkingDays: calendar?.maxProductionEarlyWorkingDays,
    targetFactoryUtilizationPercent: calendar?.targetFactoryUtilizationPercent,
  };

  const before = await snapshotWalkthrough();
  const conflictsBefore = await request('GET', '/api/v1/scheduling/conflicts', { cookie: admin.cookie });
  const conflictCountBefore = Array.isArray(conflictsBefore.json?.data)
    ? conflictsBefore.json.data.length
    : Array.isArray(conflictsBefore.json)
      ? conflictsBefore.json.length
      : 0;
  evidence.before = { walkthrough: before, conflictCountBefore };

  mark('PREVIEW', 'RUN');
  const preview = await runOptimize(admin.cookie, 'preview');
  ok('preview enqueued', Boolean(preview.runId) && !preview.error, preview.error ?? preview.runId);
  ok('preview completed', preview.run?.status === 'COMPLETED', preview.run?.status ?? preview.error);
  const previewResult = preview.run?.result ?? {};
  ok('preview is read-only mode', previewResult.mode === 'preview', String(previewResult.mode));
  ok(
    'preview newConflictCount is 0',
    Number(previewResult.newConflictCount ?? 1) === 0,
    String(previewResult.newConflictCount),
  );
  const afterPreview = await snapshotWalkthrough();
  const previewDateDrift = datesUnchanged(before, afterPreview);
  ok('preview did not change dealer dates', previewDateDrift.length === 0, previewDateDrift.join(', '));
  evidence.preview = {
    runId: preview.runId,
    outcome: previewResult.outcome,
    wouldMove: previewResult.wouldMove,
    scanned: previewResult.scannedOrders,
    blocked: previewResult.blocked,
    emptyDays: (previewResult.emptyDays ?? []).slice(0, 8),
  };

  mark('APPLY', 'RUN');
  const apply = await runOptimize(admin.cookie, 'apply');
  ok('apply enqueued', Boolean(apply.runId) && !apply.error, apply.error ?? apply.runId);
  ok('apply completed', apply.run?.status === 'COMPLETED', apply.run?.status ?? apply.error);
  const applyResult = apply.run?.result ?? {};
  ok('apply mode is apply', applyResult.mode === 'apply', String(applyResult.mode));
  const newConflicts = Number(applyResult.newConflictCount ?? 1);
  const newWorker = Number(applyResult.newWorkerConflicts ?? 1);
  const newResource = Number(applyResult.newResourceConflicts ?? 1);
  ok('apply newConflictCount is 0', newConflicts === 0, String(newConflicts));
  ok('apply newWorkerConflicts is 0', newWorker === 0, String(newWorker));
  ok('apply newResourceConflicts is 0', newResource === 0, String(newResource));
  ok(
    'apply outcome is not FAILED unless hard invariant broke',
    applyResult.outcome !== 'FAILED' || newConflicts > 0,
    String(applyResult.outcome),
  );

  const afterApply = await snapshotWalkthrough();
  const applyDateDrift = datesUnchanged(before, afterApply);
  ok('apply did not change dealer requested/committed dates', applyDateDrift.length === 0, applyDateDrift.join(', '));

  const moved = Number(applyResult.moved ?? 0);
  const wouldMove = Number(previewResult.wouldMove ?? 0);
  ok(
    'apply moved is not wildly above preview wouldMove',
    moved <= wouldMove + 2,
    `moved=${moved} wouldMove=${wouldMove}`,
  );
  evidence.apply = {
    runId: apply.runId,
    outcome: applyResult.outcome,
    moved,
    wouldMove,
    collisionsSkipped: applyResult.collisionsSkipped?.length ?? 0,
    failures: applyResult.failures?.length ?? 0,
    newConflictCount: newConflicts,
  };

  if (newConflicts > 0 || applyDateDrift.length > 0) {
    tests.HARD_INVARIANT = { status: 'FAIL', newConflicts, applyDateDrift };
    throw new Error('HARD INVARIANT FAILED — stop before Phase B');
  }

  mark('SECOND', 'RUN');
  const second = await runOptimize(admin.cookie, 'apply');
  const secondMoved = Number(second.run?.result?.moved ?? 99);
  ok('second apply completed', second.run?.status === 'COMPLETED', second.run?.status ?? second.error);
  ok(
    'second apply is idempotent or minimal churn',
    secondMoved <= 1,
    `moved=${secondMoved} outcome=${second.run?.result?.outcome}`,
  );
  ok(
    'second apply newConflictCount is 0',
    Number(second.run?.result?.newConflictCount ?? 1) === 0,
    String(second.run?.result?.newConflictCount),
  );
  evidence.second = {
    runId: second.runId,
    outcome: second.run?.result?.outcome,
    moved: secondMoved,
  };

  const cedar = await prisma.productionOrder.findFirst({
    where: { number: 'PO-2026-00056' },
    include: {
      schedules: {
        where: { status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] } },
        orderBy: { version: 'desc' },
        take: 1,
        include: { allocations: { include: { productionTask: { include: { stageDefinition: true } } } } },
      },
    },
  });
  const velvetReady = cedar?.schedules?.[0]?.materialReadyAt;
  if (velvetReady && cedar?.schedules?.[0]?.allocations?.length) {
    const tooEarly = cedar.schedules[0].allocations.filter(
      (a) => a.plannedStart.getTime() + 1 < velvetReady.getTime(),
    );
    ok(
      'Cedar allocations do not start before stored materialReadyAt (order-wide floor still in force)',
      tooEarly.length === 0,
      `${tooEarly.length} allocs before ${velvetReady.toISOString()}`,
    );
  } else {
    ok('Cedar material PO still present', Boolean(cedar?.id), cedar?.number ?? 'missing');
  }

  mark('SYNC_AFTER', 'RUN');
  const idle = await waitForIdleFactory();
  ok('factory idle before post-optimize Sync', idle);
  const syncPosted = await request('POST', '/api/v1/scheduling/sync', { cookie: admin.cookie, body: {} });
  ok('Sync still enqueues after optimize', Boolean(syncPosted.json?.replanJobId), errDetail(syncPosted));
  if (syncPosted.json?.replanJobId) {
    const syncRun = await pollRun(admin.cookie, syncPosted.json.replanJobId);
    ok('Sync after optimize completed', syncRun?.status === 'COMPLETED', syncRun?.status);
    ok(
      'Sync after optimize introduced 0 new conflicts',
      Number(syncRun?.result?.newConflictsIntroduced ?? 1) === 0,
      String(syncRun?.result?.newConflictsIntroduced),
    );
    evidence.syncAfter = {
      runId: syncRun?.id,
      outcome: syncRun?.result?.outcome,
      generated: syncRun?.result?.generated,
      replanned: syncRun?.result?.replanned,
    };
  }

  const afterAll = await snapshotWalkthrough();
  const finalDrift = datesUnchanged(before, afterAll);
  ok('walkthrough dealer dates unchanged after optimize+sync', finalDrift.length === 0, finalDrift.join(', '));

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
  writeFileSync(resolve(ROOT, 'tmp-scheduling-optimize-uat.json'), JSON.stringify(out, null, 2));
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
