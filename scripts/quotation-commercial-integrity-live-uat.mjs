/**
 * Live quotation commercial-integrity UAT against running API + maher_erp.
 * Does not change scheduling/planner/inventory. Cleans throwaway race rows.
 *
 * Usage: node scripts/quotation-commercial-integrity-live-uat.mjs
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';
const TAG = 'QCI';

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

async function request(method, path, { body, token, cookie } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(new URL(path, API), { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, text, setCookie: res.headers.getSetCookie?.() ?? [] };
}

function cookieHeader(setCookie) {
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

async function login(username) {
  const res = await request('POST', '/api/v1/auth/login', {
    body: { username, password: '123' },
  });
  return {
    cookie: cookieHeader(res.setCookie),
    token: res.json?.accessToken ?? res.json?.token,
    status: res.status,
    json: res.json,
  };
}

function authOf(session) {
  return { token: session.token, cookie: session.cookie };
}

async function main() {
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
  const sales = await login('sales1');
  const nile = await login('nile');
  const oasis = await login('oasis');
  ok('admin login', admin.status === 200 || admin.status === 201, String(admin.status));
  ok('sales1 login', sales.status === 200 || sales.status === 201, String(sales.status));
  ok('nile login', nile.status === 200 || nile.status === 201, String(nile.status));
  ok('oasis login', oasis.status === 200 || oasis.status === 201, String(oasis.status));

  const idx = await prisma.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes WHERE indexname = 'quotations_one_accepted_per_request'`,
  );
  ok('partial unique index present', Array.isArray(idx) && idx.length > 0, JSON.stringify(idx));

  const noorQuote = await prisma.quotation.findFirst({
    where: { request: { projectName: 'Noor club chair hold' }, archivedAt: null },
    include: { salesOrders: true, acceptedBy: { select: { username: true } } },
  });
  evidence.noor = noorQuote
    ? {
        id: noorQuote.id,
        number: noorQuote.number,
        status: noorQuote.status,
        soCount: noorQuote.salesOrders.length,
      }
    : null;
  if (!noorQuote) {
    throw new Error('Noor club chair hold quote missing — run pnpm demo:reset first');
  }
  ok(
    'Noor quote is SENT with no SO',
    noorQuote.status === 'SENT' && noorQuote.salesOrders.length === 0,
    JSON.stringify(evidence.noor),
  );

  const nileAccepted = await prisma.quotation.findFirst({
    where: { status: 'ACCEPTED', customer: { users: { some: { username: 'nile' } } } },
    include: {
      acceptedBy: { select: { username: true, id: true } },
      salesOrders: { select: { id: true, number: true, status: true } },
    },
  });
  evidence.nileAccepted = nileAccepted
    ? {
        id: nileAccepted.id,
        number: nileAccepted.number,
        acceptedBy: nileAccepted.acceptedBy?.username,
        so: nileAccepted.salesOrders[0]?.number,
        soStatus: nileAccepted.salesOrders[0]?.status,
      }
    : null;
  ok(
    'seed ACCEPTED has dealer acceptedById',
    Boolean(nileAccepted?.acceptedBy?.username),
    JSON.stringify(evidence.nileAccepted),
  );
  const seedSoStatus = nileAccepted?.salesOrders[0]?.status;
  ok(
    'seed ACCEPTED SO progressed past DRAFT (auto-confirm path)',
    Boolean(seedSoStatus && seedSoStatus !== 'DRAFT'),
    String(seedSoStatus),
  );
  const autoConfirmSetting = await prisma.systemSetting.findUnique({
    where: { key: 'auto_confirm_so_on_accept' },
  });
  evidence.autoConfirmSetting = autoConfirmSetting?.value ?? null;
  ok(
    'auto_confirm_so_on_accept is true',
    autoConfirmSetting == null ||
      autoConfirmSetting.value === true ||
      autoConfirmSetting.value === 'true' ||
      autoConfirmSetting.value === '1',
    JSON.stringify(autoConfirmSetting?.value ?? null),
  );

  mark('ADMIN_ACCEPT_REMOVED', 'run');
  const adminAccept = await request('POST', `/api/v1/quotations/${noorQuote.id}/accept`, {
    ...authOf(admin),
    body: {},
  });
  ok(
    'admin accept 403',
    adminAccept.status === 403,
    `${adminAccept.status} ${JSON.stringify(adminAccept.json)}`,
  );
  evidence.adminAccept = { status: adminAccept.status, body: adminAccept.json };

  mark('SALES_ACCEPT_REMOVED', 'run');
  const salesAccept = await request('POST', `/api/v1/quotations/${noorQuote.id}/accept`, {
    ...authOf(sales),
    body: {},
  });
  ok(
    'sales1 accept 403',
    salesAccept.status === 403,
    `${salesAccept.status} ${JSON.stringify(salesAccept.json)}`,
  );

  mark('ADMIN_LEFTOVER_PERMISSION', 'run');
  const acceptPerm = await prisma.permission.findUnique({ where: { code: 'quotation.accept' } });
  const adminRole = await prisma.role.findUnique({ where: { code: 'SYSTEM_ADMINISTRATOR' } });
  let granted = false;
  if (acceptPerm && adminRole) {
    await prisma.rolePermission
      .create({ data: { roleId: adminRole.id, permissionId: acceptPerm.id } })
      .then(() => {
        granted = true;
      })
      .catch(() => {
        granted = true;
      });
  }
  const adminAcceptSpoof = await request('POST', `/api/v1/quotations/${noorQuote.id}/accept`, {
    ...authOf(admin),
    body: {},
  });
  ok(
    'admin accept still 403 with leftover quotation.accept grant',
    adminAcceptSpoof.status === 403,
    `${adminAcceptSpoof.status} ${JSON.stringify(adminAcceptSpoof.json)}`,
  );
  evidence.adminLeftover = { status: adminAcceptSpoof.status, body: adminAcceptSpoof.json, granted };
  if (granted && acceptPerm && adminRole) {
    await prisma.rolePermission
      .delete({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: acceptPerm.id } },
      })
      .catch(() => undefined);
  }

  mark('UNSENT_HIDDEN', 'run');
  const unsent = await prisma.quotation.findFirst({
    where: { status: { in: ['DRAFT', 'INTERNAL_REVIEW', 'APPROVED'] }, archivedAt: null },
    select: { id: true, number: true, status: true, customerId: true },
  });
  evidence.unsent = unsent;
  if (!unsent) {
    ok('unsent quote present for isolation', false, 'missing DRAFT/INTERNAL_REVIEW/APPROVED quote');
  } else {
    const oasisUnsentGet = await request('GET', `/api/v1/quotations/${unsent.id}`, authOf(oasis));
    const nileUnsentGet = await request('GET', `/api/v1/quotations/${unsent.id}`, authOf(nile));
    ok('dealer GET unsent is 404 (owner)', oasisUnsentGet.status === 404, String(oasisUnsentGet.status));
    ok('dealer GET unsent is 404 (other)', nileUnsentGet.status === 404, String(nileUnsentGet.status));
  }
  const nileList = await request('GET', '/api/v1/quotations?pageSize=100', authOf(nile));
  const nileStatuses = (nileList.json?.data ?? []).map((q) => q.status);
  ok(
    'nile list has no internal statuses',
    nileStatuses.every((s) => !['DRAFT', 'INTERNAL_REVIEW', 'APPROVED', 'CANCELLED'].includes(s)),
    nileStatuses.join(','),
  );

  mark('DEALER_ISOLATION', 'run');
  const oasisGetNoor = await request('GET', `/api/v1/quotations/${noorQuote.id}`, authOf(oasis));
  ok('oasis cannot GET noor quote', oasisGetNoor.status === 404, String(oasisGetNoor.status));
  const oasisPdfNoor = await request('GET', `/api/v1/quotations/${noorQuote.id}/pdf`, authOf(oasis));
  ok('oasis cannot GET noor PDF', oasisPdfNoor.status === 404, String(oasisPdfNoor.status));
  const noorUser = await login('noor');
  ok('noor login', noorUser.status === 200 || noorUser.status === 201, String(noorUser.status));
  const noorGet = await request('GET', `/api/v1/quotations/${noorQuote.id}`, authOf(noorUser));
  ok('noor can GET own SENT quote', noorGet.status === 200, String(noorGet.status));

  mark('APPROVE_NOT_ACCEPT', 'run');
  const oasisCustomer = await prisma.user.findFirst({
    where: { username: 'oasis' },
    select: { id: true, customerId: true },
  });
  if (!oasisCustomer?.customerId) {
    throw new Error('oasis dealer missing — run pnpm demo:reset first');
  }
  const approveQuote = await prisma.quotation.create({
    data: {
      number: `QCIRACE-APPROVE-${Date.now()}`,
      version: 1,
      customerId: oasisCustomer.customerId,
      status: 'INTERNAL_REVIEW',
      subtotal: 100,
      taxTotal: 0,
      total: 100,
      lines: {
        create: [
          {
            description: 'Approve gate',
            quantity: 1,
            unitPrice: 100,
            subtotal: 100,
            taxAmount: 0,
            lineTotal: 100,
            sortOrder: 0,
          },
        ],
      },
    },
  });
  const approve = await request('POST', `/api/v1/quotations/${approveQuote.id}/approve`, {
    ...authOf(admin),
    body: {},
  });
  ok('admin approve HTTP', approve.status === 200 || approve.status === 201, String(approve.status));
  const afterApprove = await prisma.quotation.findUnique({
    where: { id: approveQuote.id },
    include: { salesOrders: true },
  });
  ok('approve becomes APPROVED not ACCEPTED', afterApprove?.status === 'APPROVED', afterApprove?.status);
  ok('approve creates no SO', (afterApprove?.salesOrders ?? []).length === 0, String(afterApprove?.salesOrders?.length));
  evidence.approveAfter = {
    id: approveQuote.id,
    number: approveQuote.number,
    status: afterApprove?.status,
    soCount: afterApprove?.salesOrders?.length ?? 0,
  };

  mark('CONCURRENT_SAME_RFQ', 'run');
  const product = await prisma.product.findFirst({
    where: { sku: 'ARM-01', archivedAt: null },
    select: { id: true, nameEn: true, basePrice: true },
  });
  const settingBefore = await prisma.systemSetting.findUnique({
    where: { key: 'auto_confirm_so_on_accept' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'auto_confirm_so_on_accept' },
    update: { value: false },
    create: { key: 'auto_confirm_so_on_accept', value: false },
  });

  if (!oasisCustomer?.customerId || !product) {
    throw new Error('oasis dealer or ARM-01 missing — run pnpm demo:reset first');
  }
  const stamp = `QCIRACE-${Date.now()}`;
  const rfq = await prisma.requestForQuotation.create({
    data: {
      number: stamp,
      customerId: oasisCustomer.customerId,
      status: 'QUOTED',
      projectName: 'Concurrent commercial pair',
      source: 'PORTAL',
    },
  });
  const unit = Number(product.basePrice ?? 500);
  const mkQuote = (suffix) =>
    prisma.quotation.create({
      data: {
        number: `${stamp}-${suffix}`,
        version: 1,
        customerId: oasisCustomer.customerId,
        requestId: rfq.id,
        status: 'SENT',
        sentAt: new Date(),
        subtotal: unit,
        taxTotal: 0,
        total: unit,
        lines: {
          create: [
            {
              description: product.nameEn,
              productId: product.id,
              quantity: 1,
              unitPrice: unit,
              subtotal: unit,
              taxAmount: 0,
              lineTotal: unit,
              sortOrder: 0,
            },
          ],
        },
      },
    });
  const qA = await mkQuote('A');
  const qB = await mkQuote('B');
  evidence.race = { rfqId: rfq.id, quoteA: qA.id, quoteB: qB.id, numbers: [qA.number, qB.number] };

  const [resA, resB] = await Promise.all([
    request('POST', `/api/v1/quotations/${qA.id}/accept`, { ...authOf(oasis), body: {} }),
    request('POST', `/api/v1/quotations/${qB.id}/accept`, { ...authOf(oasis), body: {} }),
  ]);
  evidence.raceHttp = [
    { id: qA.id, status: resA.status, body: resA.json },
    { id: qB.id, status: resB.status, body: resB.json },
  ];
  const winners = [resA, resB].filter((r) => r.status === 200 || r.status === 201);
  const losers = [resA, resB].filter((r) => r.status >= 400);
  ok('concurrent accept: exactly one HTTP success', winners.length === 1, `wins=${winners.length} fails=${losers.length}`);
  const loserCode = losers[0]?.json?.error?.code;
  ok(
    'concurrent accept: loser is QUOTE_ALREADY_ACCEPTED or no longer awaiting',
    losers.length === 1 &&
      (loserCode === 'QUOTE_ALREADY_ACCEPTED' || loserCode === 'BAD_REQUEST') &&
      losers[0].status >= 400 &&
      losers[0].status < 500,
    JSON.stringify(losers[0]?.json),
  );

  const acceptedRows = await prisma.quotation.findMany({
    where: { requestId: rfq.id, status: 'ACCEPTED', archivedAt: null },
    include: { acceptedBy: { select: { username: true } }, salesOrders: true },
  });
  const soRows = await prisma.salesOrder.findMany({
    where: { quotation: { requestId: rfq.id }, archivedAt: null },
  });
  ok('concurrent accept: one ACCEPTED quote', acceptedRows.length === 1, String(acceptedRows.length));
  ok('concurrent accept: one SO', soRows.length === 1, soRows.map((s) => s.number).join(','));
  ok(
    'acceptedById is oasis dealer',
    acceptedRows[0]?.acceptedBy?.username === 'oasis',
    acceptedRows[0]?.acceptedBy?.username,
  );
  evidence.raceResult = {
    accepted: acceptedRows.map((q) => ({
      id: q.id,
      number: q.number,
      acceptedBy: q.acceptedBy?.username,
    })),
    salesOrders: soRows.map((s) => ({ id: s.id, number: s.number, status: s.status })),
  };

  mark('RETRY_NO_SECOND_SO', 'run');
  const winnerId = acceptedRows[0]?.id ?? qA.id;
  const retry = await request('POST', `/api/v1/quotations/${winnerId}/accept`, {
    ...authOf(oasis),
    body: {},
  });
  const soAfterRetry = await prisma.salesOrder.count({
    where: { quotation: { requestId: rfq.id }, archivedAt: null },
  });
  ok('retry accept is 4xx', retry.status >= 400 && retry.status < 500, String(retry.status));
  ok('retry did not create another SO', soAfterRetry === 1, String(soAfterRetry));

  mark('REJECT_REVISION_NO_SO', 'run');
  const rejectQuote = await prisma.quotation.create({
    data: {
      number: `${stamp}-R`,
      version: 1,
      customerId: oasisCustomer.customerId,
      status: 'SENT',
      sentAt: new Date(),
      subtotal: unit,
      taxTotal: 0,
      total: unit,
      lines: {
        create: [
          {
            description: product.nameEn,
            productId: product.id,
            quantity: 1,
            unitPrice: unit,
            subtotal: unit,
            taxAmount: 0,
            lineTotal: unit,
            sortOrder: 0,
          },
        ],
      },
    },
  });
  const revQuote = await prisma.quotation.create({
    data: {
      number: `${stamp}-V`,
      version: 1,
      customerId: oasisCustomer.customerId,
      status: 'SENT',
      sentAt: new Date(),
      subtotal: unit,
      taxTotal: 0,
      total: unit,
      lines: {
        create: [
          {
            description: product.nameEn,
            productId: product.id,
            quantity: 1,
            unitPrice: unit,
            subtotal: unit,
            taxAmount: 0,
            lineTotal: unit,
            sortOrder: 0,
          },
        ],
      },
    },
  });
  const rejectRes = await request('POST', `/api/v1/quotations/${rejectQuote.id}/reject`, {
    ...authOf(oasis),
    body: {},
  });
  const revRes = await request('POST', `/api/v1/quotations/${revQuote.id}/request-revision`, {
    ...authOf(oasis),
    body: { comment: 'Change the wood' },
  });
  ok('dealer reject SENT', rejectRes.status === 200 || rejectRes.status === 201, String(rejectRes.status));
  ok('dealer request-revision SENT', revRes.status === 200 || revRes.status === 201, String(revRes.status));
  const rejectSo = await prisma.salesOrder.count({ where: { quotationId: rejectQuote.id } });
  const revSo = await prisma.salesOrder.count({ where: { quotationId: revQuote.id } });
  ok('reject created no SO', rejectSo === 0, String(rejectSo));
  ok('revision-request created no SO', revSo === 0, String(revSo));
  evidence.rejectRevision = {
    reject: { id: rejectQuote.id, http: rejectRes.status, so: rejectSo },
    revision: { id: revQuote.id, http: revRes.status, so: revSo },
  };

  if (settingBefore) {
    await prisma.systemSetting.update({
      where: { key: 'auto_confirm_so_on_accept' },
      data: { value: settingBefore.value },
    });
  } else {
    await prisma.systemSetting.delete({ where: { key: 'auto_confirm_so_on_accept' } }).catch(() => undefined);
  }
  const settingAfter = await prisma.systemSetting.findUnique({
    where: { key: 'auto_confirm_so_on_accept' },
  });
  ok(
    'auto_confirm_so_on_accept restored after race',
    JSON.stringify(settingAfter?.value ?? null) === JSON.stringify(settingBefore?.value ?? null),
    JSON.stringify(settingAfter?.value ?? null),
  );

  for (const id of soRows.map((s) => s.id)) {
    await prisma.salesOrder.delete({ where: { id } }).catch(() => undefined);
  }
  await prisma.quotation.deleteMany({
    where: { id: { in: [qA.id, qB.id, rejectQuote.id, revQuote.id, approveQuote.id] } },
  });
  await prisma.requestForQuotation.delete({ where: { id: rfq.id } }).catch(() => undefined);

  const noorAfter = await prisma.quotation.findFirst({
    where: { id: noorQuote.id },
    include: { salesOrders: true },
  });
  ok(
    'Noor quote still SENT with no SO after UAT',
    noorAfter?.status === 'SENT' && noorAfter.salesOrders.length === 0,
    noorAfter?.status,
  );

  const failed = steps.filter((s) => !s.ok);
  const report = {
    tag: TAG,
    at: new Date().toISOString(),
    api: API,
    steps,
    tests,
    evidence,
    passed: failed.length === 0,
  };
  mkdirSync(resolve(ROOT, 'docs'), { recursive: true });
  writeFileSync(resolve(ROOT, 'tmp-quotation-commercial-uat.json'), JSON.stringify(report, null, 2));
  console.log(`\n${failed.length ? 'FAILED' : 'PASSED'}  ${steps.length - failed.length}/${steps.length} checks`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
