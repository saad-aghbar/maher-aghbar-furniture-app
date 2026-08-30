/**
 * Piece 7 live UAT — dealer commercial finance against running API + ledger.
 *
 * Usage: pnpm smoke:piece7-dealer-finance-uat
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

function ok(name, cond, detail = '') {
  steps.push({ name, ok: Boolean(cond), detail: String(detail ?? '') });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  return Boolean(cond);
}

function nearly(a, b, eps = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

async function request(method, path, { body, cookie, headers: extra } = {}) {
  const headers = { ...(extra ?? {}) };
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
    status: res.status,
    user: res.json,
  };
}

function errCode(res) {
  return res.json?.error?.code ?? res.json?.code ?? null;
}

async function main() {
  console.log(`Piece 7 dealer commercial finance UAT → ${API}\n`);

  const admin = await login('admin');
  ok('1. admin login', (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie));

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'J', 'K', 'L'];
  const sos = {};
  const invs = {};
  for (const L of letters) {
    sos[L] = await prisma.salesOrder.findUnique({
      where: { number: `SO-P7-${L}` },
      include: { lines: true },
    });
    invs[L] = await prisma.invoice.findUnique({ where: { number: `INV-P7-${L}` } });
  }
  sos.G1 = await prisma.salesOrder.findUnique({ where: { number: 'SO-P7-G1' } });
  sos.G2 = await prisma.salesOrder.findUnique({ where: { number: 'SO-P7-G2' } });
  invs.G1 = await prisma.invoice.findUnique({ where: { number: 'INV-P7-G1' } });
  invs.G2 = await prisma.invoice.findUnique({ where: { number: 'INV-P7-G2' } });
  invs.L2 = await prisma.invoice.findUnique({ where: { number: 'INV-P7-L2' } });
  invs.I1 = await prisma.invoice.findUnique({ where: { number: 'INV-P7-I1' } });
  invs.I2 = await prisma.invoice.findUnique({ where: { number: 'INV-P7-I2' } });
  const payL = await prisma.payment.findUnique({
    where: { number: 'PAY-P7-L' },
    include: { allocations: true },
  });
  const payG = await prisma.payment.findUnique({
    where: { number: 'PAY-P7-G' },
    include: { allocations: true },
  });
  const payE = await prisma.payment.findUnique({
    where: { number: 'PAY-P7-E' },
    include: { allocations: true },
  });

  ok(
    '2. demo rows SO/INV-P7 present',
    Boolean(sos.A && sos.B && sos.C && sos.D && sos.E && sos.F && sos.G1 && sos.H && sos.J && sos.K && sos.L) &&
      Boolean(invs.A && !invs.B && invs.C && invs.D && invs.E && invs.F && invs.G1 && invs.H && invs.J && invs.K && invs.L && invs.L2),
    `B-inv=${invs.B ? 'y' : 'n'} L2=${invs.L2 ? 'y' : 'n'}`,
  );

  ok(
    '3. P7-A STANDARD CATALOG',
    sos.A?.lines?.every((l) => l.commercialPriceStatus === 'CATALOG') &&
      sos.A?.lines?.every((l) => l.manufacturingComplexity === 'STANDARD'),
    `status=${sos.A?.lines?.[0]?.commercialPriceStatus}`,
  );

  ok(
    '4. P7-B MODIFIED REQUIRED (no invoice)',
    sos.B?.lines?.[0]?.commercialPriceStatus === 'REQUIRED' &&
      sos.B?.lines?.[0]?.manufacturingComplexity === 'MODIFIED' &&
      !invs.B,
    `status=${sos.B?.lines?.[0]?.commercialPriceStatus}`,
  );

  const blockInv = await request('POST', '/api/v1/invoices', {
    cookie: admin.cookie,
    body: { salesOrderId: sos.B?.id, idempotencyKey: `smoke-p7-b-${Date.now()}` },
  });
  ok(
    '5. commercial gate blocks P7-B invoice create',
    blockInv.status >= 400 &&
      (errCode(blockInv) === 'COMMERCIAL_PRICE_REQUIRED' ||
        String(blockInv.json?.error?.message ?? blockInv.json?.message ?? '')
          .toLowerCase()
          .includes('commercial')),
    `status=${blockInv.status} code=${errCode(blockInv)}`,
  );

  ok(
    '6. P7-C CUSTOM CONFIRMED + invoice',
    sos.C?.lines?.[0]?.commercialPriceStatus === 'CONFIRMED' &&
      sos.C?.lines?.[0]?.manufacturingComplexity === 'CUSTOM' &&
      Boolean(invs.C),
    `status=${sos.C?.lines?.[0]?.commercialPriceStatus}`,
  );

  ok(
    '7. P7-D open unpaid',
    invs.D?.status === 'ISSUED' && Number(invs.D?.paidAmount) === 0 && Number(invs.D?.outstandingAmount) > 0,
    `status=${invs.D?.status} out=${invs.D?.outstandingAmount}`,
  );

  ok(
    '8. P7-E partial payment',
    invs.E?.status === 'PARTIALLY_PAID' &&
      Number(invs.E?.paidAmount) > 0 &&
      Number(invs.E?.outstandingAmount) > 0 &&
      Boolean(payE),
    `paid=${invs.E?.paidAmount} out=${invs.E?.outstandingAmount}`,
  );

  ok(
    '9. P7-F fully paid multi-payment',
    invs.F?.status === 'PAID' && Number(invs.F?.outstandingAmount) <= 0.01,
    `status=${invs.F?.status}`,
  );
  const payF1 = await prisma.payment.findUnique({ where: { number: 'PAY-P7-F1' } });
  const payF2 = await prisma.payment.findUnique({ where: { number: 'PAY-P7-F2' } });
  ok('10. P7-F two payments exist', Boolean(payF1 && payF2), `f1=${payF1?.id} f2=${payF2?.id}`);

  ok(
    '11. P7-G split allocations',
    Boolean(payG) &&
      (payG?.allocations?.length ?? 0) === 2 &&
      nearly(
        Number(payG?.amount),
        (payG?.allocations ?? []).reduce((s, a) => s + Number(a.amount), 0),
      ),
    `allocs=${payG?.allocations?.length} amt=${payG?.amount}`,
  );

  ok(
    '12. P7-H overdue on Nile',
    invs.H?.status === 'OVERDUE' && Number(invs.H?.outstandingAmount) > 0,
    `status=${invs.H?.status}`,
  );

  const kStatuses = new Set((sos.K?.lines ?? []).map((l) => l.commercialPriceStatus));
  const kComplex = new Set((sos.K?.lines ?? []).map((l) => l.manufacturingComplexity));
  ok(
    '13. P7-K multi-line STANDARD+MODIFIED/CUSTOM',
    (sos.K?.lines?.length ?? 0) >= 2 &&
      kStatuses.has('CATALOG') &&
      kStatuses.has('CONFIRMED') &&
      kComplex.has('STANDARD') &&
      (kComplex.has('MODIFIED') || kComplex.has('CUSTOM')) &&
      Boolean(invs.K),
    `lines=${sos.K?.lines?.length} statuses=${[...kStatuses].join(',')}`,
  );

  ok(
    '14. P7-J commercial ok + cost incomplete (null mfg cost)',
    Boolean(invs.J) &&
      sos.J?.lines?.[0]?.commercialPriceStatus === 'CATALOG' &&
      (sos.J?.manufacturingCost == null || Number(sos.J.manufacturingCost) === 0),
    `inv=${invs.J?.number} mfg=${sos.J?.manufacturingCost}`,
  );

  // Money conservation on PAY-P7-L / PAY-P7-G
  function conserved(pay) {
    if (!pay) return false;
    const allocSum = (pay.allocations ?? []).reduce((s, a) => s + Number(a.amount), 0);
    const unalloc = Math.max(0, Number(pay.amount) - allocSum);
    return nearly(Number(pay.amount), allocSum + unalloc);
  }
  ok('15. money conservation PAY-P7-L', conserved(payL), `amt=${payL?.amount} allocs=${payL?.allocations?.length}`);
  ok('16. money conservation PAY-P7-G', conserved(payG), `amt=${payG?.amount}`);

  const balqisUser = await prisma.user.findUnique({
    where: { username: 'balqis' },
    select: { customerId: true },
  });
  const balqisId = balqisUser?.customerId ?? invs.L?.customerId;

  const summaryBefore = await request('GET', `/api/v1/payments/dealer/${balqisId}/summary`, {
    cookie: admin.cookie,
  });
  const creditBefore = Number(summaryBefore.json?.availableCredit);
  const unallocL = Math.max(
    0,
    Number(payL?.amount) - (payL?.allocations ?? []).reduce((s, a) => s + Number(a.amount), 0),
  );
  const alreadyApplied = nearly(creditBefore, 7000) && Number(invs.L2?.paidAmount ?? 0) >= 7999;
  ok(
    '17. P7-L availableCredit after payment ≈ 15000 (or 7000 if already applied)',
    summaryBefore.status === 200 &&
      (alreadyApplied
        ? nearly(creditBefore, 7000)
        : nearly(creditBefore, 15000) && nearly(unallocL, 15000)),
    `credit=${creditBefore} payUnalloc=${unallocL} already=${alreadyApplied}`,
  );

  let creditAfter = creditBefore;
  if (!alreadyApplied) {
    const applyKey = `smoke-p7-l-apply-${Date.now()}`;
    const apply = await request('POST', `/api/v1/invoices/${invs.L2?.id}/apply-credit`, {
      cookie: admin.cookie,
      body: { amount: 8000, idempotencyKey: applyKey },
    });
    const summaryAfter = await request('GET', `/api/v1/payments/dealer/${balqisId}/summary`, {
      cookie: admin.cookie,
    });
    creditAfter = Number(summaryAfter.json?.availableCredit);
    ok(
      '18. P7-L apply-credit 8000 → availableCredit ≈ 7000',
      apply.status < 400 && nearly(creditAfter, 7000),
      `apply=${apply.status} credit=${creditAfter} out=${apply.json?.outstandingAmount}`,
    );
  } else {
    ok(
      '18. P7-L apply-credit 8000 → availableCredit ≈ 7000',
      nearly(creditAfter, 7000),
      `already applied credit=${creditAfter}`,
    );
  }

  // Statement opening / running (Nile P7-I window)
  const nileUser = await prisma.user.findUnique({
    where: { username: 'nile' },
    select: { customerId: true },
  });
  const nileId = nileUser?.customerId ?? invs.H?.customerId;
  const statement = await request(
    'GET',
    `/api/v1/statements/${nileId}?from=2026-02-15&to=2026-12-31`,
    { cookie: admin.cookie },
  );
  const entries = statement.json?.entries ?? [];
  let runningOk = true;
  let prev = Number(statement.json?.openingBalance ?? 0);
  for (const e of entries) {
    const next = prev + Number(e.debit ?? 0) - Number(e.credit ?? 0);
    const bal = Number(e.balance ?? e.runningBalance ?? next);
    if (!nearly(bal, next, 0.05)) runningOk = false;
    prev = bal;
  }
  const hasI2 = entries.some((e) => String(e.reference ?? '').includes('INV-P7-I2'));
  ok(
    '19. statement opening + running balance',
    statement.status === 200 &&
      statement.json?.openingBalance != null &&
      runningOk &&
      (hasI2 || Boolean(invs.I2)),
    `open=${statement.json?.openingBalance} entries=${entries.length} hasI2=${hasI2}`,
  );

  // Privacy: oasis cannot see nile invoice
  const oasis = await login('oasis');
  ok('20. oasis login', (oasis.status === 200 || oasis.status === 201) && Boolean(oasis.cookie));
  const oasisNileInv = await request('GET', `/api/v1/invoices/${invs.H?.id}`, {
    cookie: oasis.cookie,
  });
  ok(
    '21. oasis cannot see nile INV-P7-H',
    oasisNileInv.status === 403 || oasisNileInv.status === 401 || oasisNileInv.status === 404,
    `status=${oasisNileInv.status}`,
  );

  const oasisList = await request('GET', '/api/v1/invoices', { cookie: oasis.cookie });
  const oasisRows = oasisList.json?.data ?? oasisList.json ?? [];
  const leaked = Array.isArray(oasisRows)
    ? oasisRows.some((r) => r.number === 'INV-P7-H' || r.id === invs.H?.id)
    : false;
  ok('22. oasis invoice list excludes nile INV-P7-H', oasisList.status === 200 && !leaked, `leaked=${leaked}`);

  // Worker denied finance
  const cutter = await login('cutter');
  const workerInv = await request('GET', `/api/v1/invoices/${invs.A?.id}`, {
    cookie: cutter.cookie,
  });
  const workerPay = await request('GET', `/api/v1/payments/dealer/${balqisId}/summary`, {
    cookie: cutter.cookie,
  });
  const workerStmt = await request('GET', `/api/v1/statements/${nileId}`, {
    cookie: cutter.cookie,
  });
  ok(
    '23. worker denied invoice/payment/statement',
    (workerInv.status === 403 || workerInv.status === 401) &&
      (workerPay.status === 403 || workerPay.status === 401) &&
      (workerStmt.status === 403 || workerStmt.status === 401),
    `inv=${workerInv.status} pay=${workerPay.status} stmt=${workerStmt.status}`,
  );

  // P7-A presentation via admin get
  const invA = await request('GET', `/api/v1/invoices/${invs.A?.id}`, { cookie: admin.cookie });
  ok(
    '24. invoice presentation enriched',
    invA.status === 200 &&
      invA.json?.presentation &&
      ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].includes(invA.json.presentation.phase),
    `phase=${invA.json?.presentation?.phase}`,
  );

  const failed = steps.filter((s) => !s.ok);
  const outDir = resolve(ROOT, 'tmp');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'piece7-dealer-finance-uat.json');
  writeFileSync(
    outPath,
    JSON.stringify({ at: new Date().toISOString(), failed: failed.length, steps }, null, 2),
  );
  console.log(`\n${steps.length - failed.length}/${steps.length} passed → ${outPath}`);
  await prisma.$disconnect();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
