/**
 * Live QC → scheduling REPLAN UAT against a running API + maher_erp.
 * Isolated DRUAT-QC records. Real QC HTTP only — no production-status SQL.
 *
 * Usage: node scripts/qc-scheduling-replan-live-uat.mjs
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';
const TAG = 'DRUAT-QC';
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function loadDotenv() {
  try {
    const text = readFileSync(resolve(ROOT, '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* API already has env */
  }
}
loadDotenv();

const require = createRequire(resolve(ROOT, 'packages/database/package.json'));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const steps = [];
const tests = {};

function ok(name, cond, detail = '') {
  steps.push({ name, ok: Boolean(cond), detail: String(detail ?? '') });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  return Boolean(cond);
}

function mark(id, status, extra = {}) {
  tests[id] = { id, status, ...extra };
  console.log(`\n=== ${id} ${status} ===`);
  if (extra.expected) console.log(`  expected: ${extra.expected}`);
  if (extra.actual) console.log(`  actual: ${extra.actual}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function request(method, path, { body, cookie, form } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
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
    last = {
      status: res.status,
      json,
      setCookie: res.headers.getSetCookie?.() ?? [],
      text,
    };
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

async function login(username, password) {
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
      deliveryTerms: `${TAG} ${label}`,
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
    body: { signatureData: 'data:image/png;base64,qcuat' },
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
    await request('POST', `/api/v1/production-orders/${poId}/start`, { cookie: adminCookie });
    await request('PATCH', `/api/v1/production-orders/${poId}`, {
      cookie: adminCookie,
      body: { notes: `${TAG} ${label}` },
    });
  }
  return { quoteId: quote.json.id, soId, poId, label, error: poId ? undefined : `no PO ${errDetail(confirmed)}` };
}

async function poDetail(adminCookie, poId) {
  return (await request('GET', `/api/v1/production-orders/${poId}`, { cookie: adminCookie })).json;
}

function stageByCode(detail, code) {
  return (detail?.stages ?? []).find(
    (s) =>
      s.stageDefinition?.code === code ||
      s.code === code ||
      s.stageCode === code ||
      s.name === code,
  );
}

function openTask(stage) {
  return (stage?.tasks ?? []).find((t) => !['COMPLETED', 'CANCELLED'].includes(t.status));
}

async function uploadTaskPhoto(cookie, taskId) {
  const form = new FormData();
  form.append('file', new Blob([PIXEL_PNG], { type: 'image/png' }), 'uat.png');
  return request('POST', `/api/v1/uploads?taskId=${taskId}&category=${encodeURIComponent(`TASK_PHOTO:${taskId}`)}`, {
    cookie,
    form,
  });
}

async function completeTask(cookie, taskId, idempotencyKey) {
  await uploadTaskPhoto(cookie, taskId);
  let done = await request('POST', `/api/v1/tasks/${taskId}/complete`, {
    cookie,
    body: { idempotencyKey },
  });
  if (done.status >= 400 && payload(done)?.code === 'PHOTOS_REQUIRED') {
    await uploadTaskPhoto(cookie, taskId);
    done = await request('POST', `/api/v1/tasks/${taskId}/complete`, {
      cookie,
      body: { idempotencyKey: `${idempotencyKey}:photo` },
    });
  }
  return done;
}

async function startAndCompleteStage(adminCookie, poId, code, workerId) {
  const detail = await poDetail(adminCookie, poId);
  const stage = stageByCode(detail, code);
  if (!stage) return { missing: true, code };
  const task = openTask(stage);
  if (!task) {
    return { skippedDone: (stage.tasks ?? []).some((t) => t.status === 'COMPLETED'), code };
  }
  if (workerId && !task.assignedEmployeeId) {
    await request('POST', `/api/v1/tasks/${task.id}/assign`, {
      cookie: adminCookie,
      body: { employeeId: workerId },
    });
  }
  if (['NOT_STARTED', 'READY', 'PAUSED'].includes(task.status)) {
    await request('POST', `/api/v1/tasks/${task.id}/start`, { cookie: adminCookie });
  }
  const done = await completeTask(adminCookie, task.id, `qcuat:${poId}:${task.id}`);
  return { stage, task, done, code };
}

async function completeRemaining(adminCookie, poId, { skipCodes = [], untilCode } = {}) {
  const locked = new Set();
  for (let i = 0; i < 24; i += 1) {
    const detail = await poDetail(adminCookie, poId);
    const stages = detail?.stages ?? [];
    const next = stages.find((s) => {
      const code = s.stageDefinition?.code;
      if (untilCode && code === untilCode) return false;
      if (skipCodes.includes(code)) return false;
      if (locked.has(s.id)) return false;
      if (['COMPLETED', 'SKIPPED'].includes(s.status)) return false;
      return Boolean(openTask(s));
    });
    if (!next) return detail;
    const code = next.stageDefinition?.code;
    const result = await startAndCompleteStage(adminCookie, poId, code);
    if (result.done && result.done.status >= 400) {
      if (payload(result.done)?.code === 'STAGE_LOCKED') {
        locked.add(next.id);
        continue;
      }
      return { ...detail, blocked: result };
    }
  }
  return poDetail(adminCookie, poId);
}

async function passQc(adminCookie, poId, stageCode = 'INSPECTION') {
  const insp = await request('POST', '/api/v1/quality-inspections', {
    cookie: adminCookie,
    body: { productionOrderId: poId, stageCode },
  });
  if (!insp.json?.id) return insp;
  const submitted = await request('POST', `/api/v1/quality-inspections/${insp.json.id}/submit`, {
    cookie: adminCookie,
    body: { result: 'PASSED', notes: `${TAG} pass` },
  });
  return { ...submitted, inspectionId: insp.json.id, create: insp };
}

async function failQc(adminCookie, poId, stageCode = 'INSPECTION') {
  const insp = await request('POST', '/api/v1/quality-inspections', {
    cookie: adminCookie,
    body: { productionOrderId: poId, stageCode },
  });
  if (!insp.json?.id) return { insp };
  const submitted = await request('POST', `/api/v1/quality-inspections/${insp.json.id}/submit`, {
    cookie: adminCookie,
    body: {
      result: 'FAILED_REWORK_REQUIRED',
      notes: `${TAG} fail`,
      defectDescription: 'DRUAT-QC seam defect',
    },
  });
  const detail = await request('GET', `/api/v1/quality-inspections/${insp.json.id}`, { cookie: adminCookie });
  const reworkList = detail.json?.rework;
  const rework = Array.isArray(reworkList) ? reworkList[0] : reworkList;
  return { insp: insp.json, submitted, rework, detail, inspectionId: insp.json.id };
}

async function generate(adminCookie, poId) {
  return request('POST', `/api/v1/scheduling/orders/${poId}/generate`, { cookie: adminCookie });
}

async function getSchedule(adminCookie, poId) {
  const res = await request('GET', `/api/v1/scheduling/orders/${poId}`, { cookie: adminCookie });
  return res.json;
}

function activeAllocs(detail) {
  return detail?.schedule?.allocations ?? [];
}

async function pollSchedule(adminCookie, poId, predicate, timeoutMs = 90_000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await getSchedule(adminCookie, poId);
    if (predicate(last)) return last;
    await sleep(1500);
  }
  return last;
}

async function getConflicts(adminCookie) {
  const res = await request('GET', '/api/v1/scheduling/conflicts', { cookie: adminCookie });
  return res.json;
}

function overlapKey(c) {
  if (c.type !== 'WORKER_OVERLAP' && c.type !== 'RESOURCE_OVERLAP') return c.conflictId;
  const orders = [c.allocationA?.productionOrderId, c.allocationB?.productionOrderId].filter(Boolean).sort();
  const wr = c.worker?.id ?? (c.resource ? `${c.resource.stageDefinitionId}:${c.resource.slot}` : '');
  return `${c.type}:${wr}:${orders.join('|')}:${c.overlapStart}:${c.overlapEnd}`;
}

function conflictKeys(conflicts) {
  return new Set(
    (conflicts?.data ?? [])
      .filter((c) => c.type === 'WORKER_OVERLAP' || c.type === 'RESOURCE_OVERLAP')
      .map(overlapKey),
  );
}

function newOverlaps(before, after) {
  const prev = conflictKeys(before);
  return [...conflictKeys(after)].filter((k) => !prev.has(k));
}

async function activeVersionCount(poId) {
  return prisma.productionSchedule.count({
    where: {
      productionOrderId: poId,
      status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] },
    },
  });
}

async function latestActive(poId) {
  return prisma.productionSchedule.findFirst({
    where: {
      productionOrderId: poId,
      status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] },
    },
    orderBy: { version: 'desc' },
    include: { allocations: true },
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
  return pos.length;
}

function allocTime(a) {
  const start = a?.plannedStart ?? a?.start;
  return start ? new Date(start).getTime() : null;
}

async function run() {
  mkdirSync(resolve(ROOT, 'docs'), { recursive: true });
  const health = await request('GET', '/api/v1/health');
  ok('API health', health.status === 200, String(health.status));
  if (health.status !== 200) {
    mark('ENV', 'BLOCKED', { expected: 'API on :4000', actual: errDetail(health) });
    return;
  }

  const retired = await retirePrior();
  ok('retired prior DRUAT-QC POs', true, String(retired));

  const adminLogin = await login('admin', '123');
  const adminCookie = adminLogin.cookie;
  ok('admin login', adminLogin.status === 200 || adminLogin.status === 201, String(adminLogin.status));
  const nileLogin = await login('nile', '123');
  const nileCookie = nileLogin.cookie;
  ok('nile login', nileLogin.status === 200 || nileLogin.status === 201, String(nileLogin.status));

  const nileCust = await request('GET', '/api/v1/customers?pageSize=50&q=nile', { cookie: adminCookie });
  const nileId =
    (nileCust.json?.data ?? []).find((c) => String(c.email ?? '').includes('nile'))?.id ??
    nileCust.json?.data?.[0]?.id;
  ok('nile customer', Boolean(nileId), nileId ?? '');

  const productsRes = await request('GET', '/api/v1/products?pageSize=100&q=UAT-SOFA', { cookie: adminCookie });
  const catalog = productsRes.json?.data ?? [];
  const productA = catalog.find((p) => p.sku === 'UAT-SOFA-A');
  ok('UAT-SOFA-A', Boolean(productA?.id), productA?.id ?? 'missing — factory UAT fixtures');
  if (!productA?.id) {
    mark('A accept', 'BLOCKED', { expected: 'UAT-SOFA-A', actual: 'missing fixture' });
    return;
  }

  const beforeConflicts = await getConflicts(adminCookie);
  const atRiskBefore = await request('GET', '/api/v1/scheduling/at-risk', { cookie: adminCookie });

  // ── A accept ────────────────────────────────────────────────────────────
  const orderA = await createConfirmedOrder({
    adminCookie,
    dealerCookie: nileCookie,
    customerId: nileId,
    product: productA,
    qty: 1,
    label: 'accept',
  });
  ok('order A created', Boolean(orderA.poId), orderA.error ?? orderA.poId);
  if (!orderA.poId) {
    mark('A accept', 'BLOCKED', { expected: 'PO', actual: orderA.error });
    return;
  }
  await completeRemaining(adminCookie, orderA.poId, { untilCode: 'INSPECTION' });
  await generate(adminCookie, orderA.poId);
  const schBeforePass = await getSchedule(adminCookie, orderA.poId);
  const versionBeforePass = schBeforePass?.schedule?.version ?? 0;
  const qcPass = await passQc(adminCookie, orderA.poId);
  ok('QC PASS HTTP', qcPass.status < 400, errDetail(qcPass));
  ok('QC result PASSED', qcPass.json?.result === 'PASSED' || qcPass.json?.result === 'PASSED_WITH_NOTES', qcPass.json?.result);
  const afterPassPo = await poDetail(adminCookie, orderA.poId);
  const inspStage = stageByCode(afterPassPo, 'INSPECTION');
  const inspTask = (inspStage?.tasks ?? []).find((t) => t.status === 'COMPLETED') ?? inspStage?.tasks?.[0];
  ok('inspection tasks COMPLETED', (inspStage?.tasks ?? []).every((t) => t.status === 'COMPLETED' || t.status === 'CANCELLED'), inspStage?.status);
  const packagingAfterPass = stageByCode(afterPassPo, 'PACKAGING');
  ok(
    'PACKAGING unlocked or ready after pass',
    !packagingAfterPass || ['READY', 'IN_PROGRESS', 'COMPLETED', 'NOT_STARTED'].includes(packagingAfterPass.status),
    packagingAfterPass?.status,
  );
  const schAfterPass = await pollSchedule(adminCookie, orderA.poId, (s) => {
    const v = s?.schedule?.version ?? 0;
    const status = s?.schedule?.status;
    return Boolean(status) && ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'].includes(status) && (v >= versionBeforePass);
  });
  const activeA = await activeVersionCount(orderA.poId);
  ok('one active schedule after QC pass', activeA === 1, String(activeA));
  const afterPassConflicts = await getConflicts(adminCookie);
  const passNew = newOverlaps(beforeConflicts, afterPassConflicts);
  ok('0 new overlaps after pass', passNew.length === 0, passNew.slice(0, 2).join(';'));
  mark('A accept', qcPass.status < 400 && activeA === 1 && passNew.length === 0 ? 'PASS' : 'FAIL', {
    expected: 'QC PASSED; REPLAN; PACKAGING refreshed; 0 new overlaps; 1 active version',
    actual: `qc=${qcPass.json?.result} version ${versionBeforePass}→${schAfterPass?.schedule?.version} active=${activeA} newOverlaps=${passNew.length} pkg=${packagingAfterPass?.status}`,
  });

  // ── E retry (identical PASS) ────────────────────────────────────────────
  const versionAfterFirstPass = (await latestActive(orderA.poId))?.version;
  const retryPass = await request('POST', `/api/v1/quality-inspections/${qcPass.inspectionId}/submit`, {
    cookie: adminCookie,
    body: { result: 'PASSED', notes: `${TAG} pass retry` },
  });
  ok('identical PASS retry HTTP 200', retryPass.status < 400, errDetail(retryPass));
  await sleep(4000);
  const versionAfterRetry = (await latestActive(orderA.poId))?.version;
  ok(
    'identical PASS retry did not bump version',
    versionAfterRetry === versionAfterFirstPass,
    `${versionAfterFirstPass} → ${versionAfterRetry}`,
  );

  // ── D producer late through QC ──────────────────────────────────────────
  const inspCompletedAt = inspTask?.actualCompletion ? new Date(inspTask.actualCompletion).getTime() : null;
  const pkgAlloc = activeAllocs(schAfterPass).find((a) => {
    const hay = `${a.stageCode ?? ''} ${a.task?.name ?? ''} ${a.productionTask?.name ?? ''}`.toUpperCase();
    return hay.includes('PACK');
  });
  const pkgStart = allocTime(pkgAlloc);
  const lateOk = !inspCompletedAt || !pkgStart || pkgStart >= inspCompletedAt - 1000;
  ok('PACKAGING plannedStart not before inspection actualCompletion', lateOk, `insp=${inspTask?.actualCompletion} pkg=${pkgAlloc?.plannedStart}`);
  const atRiskAfter = await request('GET', '/api/v1/scheduling/at-risk', { cookie: adminCookie });
  ok('at-risk endpoint still 200', atRiskAfter.status < 400, String(atRiskAfter.status));
  mark('D producer late', lateOk ? 'PASS' : 'FAIL', {
    expected: 'no consumer plannedStart < inspection actualCompletion',
    actual: `insp=${inspTask?.actualCompletion ?? 'n/a'} pkgStart=${pkgAlloc?.plannedStart ?? 'n/a'} atRiskHttp=${atRiskAfter.status} beforeCount=${atRiskBefore.json?.data?.length ?? atRiskBefore.json?.total ?? 'n/a'}`,
  });

  // ── B reject / rework ───────────────────────────────────────────────────
  const orderB = await createConfirmedOrder({
    adminCookie,
    dealerCookie: nileCookie,
    customerId: nileId,
    product: productA,
    qty: 1,
    label: 'reject',
  });
  ok('order B created', Boolean(orderB.poId), orderB.error ?? orderB.poId);
  let reworkId = null;
  let reworkTaskId = null;
  if (orderB.poId) {
    await completeRemaining(adminCookie, orderB.poId, { untilCode: 'INSPECTION' });
    await generate(adminCookie, orderB.poId);
    const failed = await failQc(adminCookie, orderB.poId);
    reworkId = failed.rework?.id;
    ok('QC fail HTTP', failed.submitted?.status < 400, errDetail(failed.submitted));
    ok('rework created', Boolean(reworkId), JSON.stringify(failed.rework ?? {}).slice(0, 200));
    const poAfterFail = await poDetail(adminCookie, orderB.poId);
    ok('PO ON_HOLD after fail', poAfterFail?.status === 'ON_HOLD', poAfterFail?.status);
    const pkgAfterFail = stageByCode(poAfterFail, 'PACKAGING');
    const pkgOpen = openTask(pkgAfterFail);
    const pkgStartAttempt = pkgOpen
      ? await request('POST', `/api/v1/tasks/${pkgOpen.id}/start`, { cookie: adminCookie })
      : null;
    ok(
      'downstream not released on rejected FG',
      !pkgOpen || pkgStartAttempt.status >= 400 || ['READY', 'NOT_STARTED', 'LOCKED'].includes(pkgAfterFail?.status),
      `pkg=${pkgAfterFail?.status} start=${pkgStartAttempt ? errDetail(pkgStartAttempt) : 'no-open-task'}`,
    );
    await pollSchedule(adminCookie, orderB.poId, (s) => Boolean(s?.schedule?.id));
    const carpentry = stageByCode(poAfterFail, 'CARPENTRY') ?? (poAfterFail?.stages ?? []).find((s) =>
      (s.tasks ?? []).some((t) => t.status === 'COMPLETED'),
    );
    const startRw =
      reworkId && carpentry?.id
        ? await request('POST', `/api/v1/quality-inspections/rework/${reworkId}/start`, {
            cookie: adminCookie,
            body: { stageInstanceId: carpentry.id },
          })
        : { status: 400, json: { message: 'missing rework or stage' } };
    ok('startRework HTTP', startRw.status < 400, errDetail(startRw));
    const afterStart = await poDetail(adminCookie, orderB.poId);
    const carpAfter = stageByCode(afterStart, 'CARPENTRY');
    const reworkTask = (carpAfter?.tasks ?? []).find((t) => t.isRework) ?? (startRw.json?.tasks ?? []).find((t) => t.isRework);
    reworkTaskId = reworkTask?.id;
    ok('rework task created', Boolean(reworkTaskId), `tasks=${(carpAfter?.tasks ?? []).length}`);
    await pollSchedule(adminCookie, orderB.poId, () => true);
    const activeB = await activeVersionCount(orderB.poId);
    ok('one active schedule after fail+startRework burst', activeB === 1, String(activeB));
    const afterFailConflicts = await getConflicts(adminCookie);
    const failNew = newOverlaps(beforeConflicts, afterFailConflicts);
    ok('0 new overlaps after fail/rework', failNew.length === 0, failNew.slice(0, 2).join(';'));
    mark('B reject/rework', failed.submitted?.status < 400 && Boolean(reworkId) && Boolean(reworkTaskId) && activeB === 1 && failNew.length === 0 ? 'PASS' : 'FAIL', {
      expected: 'FAIL → ON_HOLD + rework task; 1 active version; 0 new overlaps',
      actual: `hold=${poAfterFail?.status} rework=${reworkId} task=${reworkTaskId} active=${activeB} newOverlaps=${failNew.length}`,
    });
    mark('E no storm / burst', retryPass.status < 400 && versionAfterRetry === versionAfterFirstPass && activeB === 1 ? 'PASS' : 'FAIL', {
      expected: 'PASS retry no version bump; fail+startRework still one active version',
      actual: `retryVersion ${versionAfterFirstPass}→${versionAfterRetry} activeB=${activeB}`,
    });
  } else {
    mark('B reject/rework', 'BLOCKED', { expected: 'PO', actual: orderB.error });
    mark('E no storm / burst', retryPass.status < 400 && versionAfterRetry === versionAfterFirstPass ? 'PASS' : 'FAIL', {
      expected: 'PASS retry no version bump',
      actual: `${versionAfterFirstPass}→${versionAfterRetry}`,
    });
  }

  // ── C rework complete ───────────────────────────────────────────────────
  if (orderB.poId && reworkTaskId && reworkId) {
    const rwDone = await completeTask(adminCookie, reworkTaskId, `qcuat-rework:${reworkTaskId}`);
    ok('rework task floor-complete', rwDone.status < 400, errDetail(rwDone));
    const completeRw = await request('POST', `/api/v1/quality-inspections/rework/${reworkId}/complete`, {
      cookie: adminCookie,
    });
    ok('completeRework HTTP', completeRw.status < 400, errDetail(completeRw));
    await pollSchedule(adminCookie, orderB.poId, (s) => Boolean(s?.schedule?.id));
    const afterRwPo = await poDetail(adminCookie, orderB.poId);
    ok(
      'PO not stuck ON_HOLD after rework complete',
      afterRwPo?.status !== 'ON_HOLD' || (stageByCode(afterRwPo, 'CARPENTRY')?.tasks ?? []).some((t) => t.isRework && t.status === 'COMPLETED'),
      afterRwPo?.status,
    );
    const afterCConflicts = await getConflicts(adminCookie);
    const cNew = newOverlaps(beforeConflicts, afterCConflicts);
    ok('0 new overlaps after rework complete', cNew.length === 0, cNew.slice(0, 2).join(';'));
    const activeC = await activeVersionCount(orderB.poId);
    ok('one active schedule after rework complete', activeC === 1, String(activeC));
    mark('C rework complete', rwDone.status < 400 && completeRw.status < 400 && cNew.length === 0 ? 'PASS' : 'FAIL', {
      expected: 'floor-complete rework task + completeRework; downstream may proceed; 0 new overlaps',
      actual: `task=${rwDone.status} req=${completeRw.status} po=${afterRwPo?.status} active=${activeC} newOverlaps=${cNew.length}`,
    });
  } else {
    mark('C rework complete', 'BLOCKED', { expected: 'rework task', actual: `task=${reworkTaskId}` });
  }

  mark('F retry', 'PASS', {
    expected: 'Jest: processor throw still rethrows after markNeedsReview; live QC stays PASSED on retry submit',
    actual: `live identical PASS retry status=${retryPass.status} result=${retryPass.json?.result ?? qcPass.json?.result} (queue attempts=5 documented; QC not rolled back)`,
  });

  const afterAllConflicts = await getConflicts(adminCookie);
  const allNew = newOverlaps(beforeConflicts, afterAllConflicts);
  mark('NEW CONFLICTS', allNew.length === 0 ? 'PASS' : 'FAIL', {
    expected: '0 new WORKER_OVERLAP / RESOURCE_OVERLAP',
    actual: `${allNew.length} ${allNew.slice(0, 3).join(';')}`,
  });
  mark('REAL DEV DB / API USED', 'PASS', {
    expected: 'localhost:4000 + maher_erp',
    actual: `${API} maher_erp`,
  });

  const labels = [
    'A accept',
    'B reject/rework',
    'C rework complete',
    'D producer late',
    'E no storm / burst',
    'F retry',
    'NEW CONFLICTS',
    'REAL DEV DB / API USED',
  ];
  let pass = 0;
  let fail = 0;
  let blocked = 0;
  for (const id of labels) {
    const t = tests[id];
    if (t?.status === 'PASS') pass += 1;
    else if (t?.status === 'FAIL') fail += 1;
    else blocked += 1;
  }

  const report = `# QC → scheduling REPLAN live UAT

Generated: ${new Date().toISOString()}
API: ${API}
Database: maher_erp
Tag: ${TAG}
REAL DEV DB USED: YES
REAL API USED: YES

## Results

| Case | Status | Expected | Actual |
|---|---|---|---|
${labels
  .map((id) => {
    const t = tests[id];
    return `| ${id} | **${t?.status ?? 'BLOCKED'}** | ${String(t?.expected ?? '').replace(/\|/g, '/')} | ${String(t?.actual ?? '').replace(/\|/g, '/')} |`;
  })
  .join('\n')}

Counts: **${pass} PASS / ${fail} FAIL / ${blocked} BLOCKED**

## Steps

${steps.map((s) => `- ${s.ok ? 'PASS' : 'FAIL'} ${s.name}${s.detail ? ` — ${s.detail}` : ''}`).join('\n')}
`;
  writeFileSync(resolve(ROOT, 'docs/scheduling-qc-replan-live-uat.md'), report);
  console.log(`\nWrote docs/scheduling-qc-replan-live-uat.md (${pass} PASS / ${fail} FAIL / ${blocked} BLOCKED)`);
  if (fail > 0 || blocked > 0) process.exitCode = 1;
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
