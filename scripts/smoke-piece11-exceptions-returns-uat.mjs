/**
 * Piece 11 live UAT — exceptions / returns / cancel / corrections.
 *
 * Usage: pnpm smoke:piece11-exceptions-returns-uat
 * Requires API on :4000 and Piece 11 demo rows (demo:reset or reseed-piece11).
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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
  return res.json?.error?.code ?? res.json?.code ?? '';
}

async function reseedPiece11() {
  console.log('Reseeding Piece 11 demo (fresh F/G for UAT)…');
  const reseeds = spawnSync(
    'pnpm',
    [
      '--filter',
      '@maher/database',
      'exec',
      'dotenv',
      '-e',
      '../../.env',
      '--',
      'tsx',
      'prisma/demo/reseed-piece11.ts',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (reseeds.status !== 0) {
    console.error(reseeds.stdout || '');
    console.error(reseeds.stderr || '');
    throw new Error('Piece 11 reseed failed');
  }
}

async function main() {
  console.log(`Piece 11 exceptions / returns UAT → ${API}\n`);

  const admin = await login('admin');
  ok('1. admin login', (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie));
  const cookie = admin.cookie;
  if (!cookie) throw new Error('Admin login failed — is the API running?');

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  async function loadP11Rows() {
    const salesOrders = {};
    const returns = {};
    for (const L of letters) {
      salesOrders[L] = await prisma.salesOrder.findUnique({
        where: { number: `SO-P11-${L}` },
        select: {
          id: true,
          number: true,
          status: true,
          cancellationReason: true,
        },
      });
      returns[L] = await prisma.returnRequest.findUnique({
        where: { number: `RET-P11-${L}` },
        select: {
          id: true,
          number: true,
          approvalStatus: true,
          physicalStatus: true,
          salesOrderId: true,
          customerId: true,
          receivedAt: true,
        },
      });
    }
    return { salesOrders, returns };
  }

  let { salesOrders, returns } = await loadP11Rows();

  // Prior smoke runs mutate C/L (cancel) and G (receive) — reseed so cases stay honest.
  const retG = returns.G;
  const soCSeed = salesOrders.C;
  const soLSeed = salesOrders.L;
  const gMutated =
    retG &&
    (retG.physicalStatus === 'RETURNED' ||
      retG.physicalStatus === 'INSPECTING' ||
      retG.physicalStatus === 'RESOLVED' ||
      Boolean(retG.receivedAt));
  const cMutated = soCSeed && soCSeed.status === 'CANCELLED';
  const lMutated = soLSeed && soLSeed.status === 'CANCELLED';
  const missing = !letters.every((L) => Boolean(salesOrders[L]));
  if (missing || gMutated || cMutated || lMutated || (retG && retG.approvalStatus !== 'APPROVED')) {
    await reseedPiece11();
    ({ salesOrders, returns } = await loadP11Rows());
  }

  ok(
    '2. P11 demo rows present (SO A–L + RET F–J)',
    letters.every((L) => Boolean(salesOrders[L])) &&
      ['F', 'G', 'H', 'I', 'J'].every((L) => Boolean(returns[L])),
    `missingSO=${letters.filter((L) => !salesOrders[L]).join(',') || 'none'} missingRET=${['F', 'G', 'H', 'I', 'J'].filter((L) => !returns[L]).join(',') || 'none'}`,
  );

  // ── CASE1: P11-C cancel-impact + cancel ───────────────────────────────────
  const soC2 = salesOrders.C;
  const poC = soC2
    ? await prisma.productionOrder.findFirst({
        where: { number: 'PO-P11-C' },
        select: { id: true },
      })
    : null;

  const issueBefore = poC
    ? await prisma.inventoryTransaction.count({
        where: {
          type: 'PRODUCTION_ISSUE',
          referenceType: 'ProductionOrder',
          referenceId: poC.id,
        },
      })
    : 0;

  const impactC = soC2
    ? await request('GET', `/api/v1/sales-orders/${soC2.id}/cancel-impact`, { cookie })
    : { status: 0, json: null };
  const impactShowsConsumption =
    (impactC.status === 200 || impactC.status === 201) &&
    (Number(impactC.json?.impact?.materialsConsumedAmount) > 0 ||
      String(impactC.json?.impact?.materialsConsumedSummary || '').length > 0 ||
      (impactC.json?.impact?.semiLots?.length ?? 0) > 0 ||
      (impactC.json?.impact?.openTasks ?? 0) > 0);
  ok(
    '3. CASE1 P11-C cancel-impact shows consumption',
    impactShowsConsumption,
    `status=${impactC.status} materials=${impactC.json?.impact?.materialsConsumedAmount ?? '?'} openTasks=${impactC.json?.impact?.openTasks ?? '?'} semi=${impactC.json?.impact?.semiLots?.length ?? '?'}`,
  );

  const cancelC = soC2
    ? await request('POST', `/api/v1/sales-orders/${soC2.id}/cancel`, {
        cookie,
        body: {
          reasonCode: 'Unable to manufacture',
          reason: 'P11 smoke cancel — material / capacity',
        },
      })
    : { status: 0, json: null };
  const soCAfter = soC2
    ? await prisma.salesOrder.findUnique({
        where: { id: soC2.id },
        select: { status: true, cancellationReason: true },
      })
    : null;
  ok(
    '4. CASE1 P11-C cancel with reason → CANCELLED',
    (cancelC.status === 200 || cancelC.status === 201) && soCAfter?.status === 'CANCELLED',
    `status=${cancelC.status} so=${soCAfter?.status} reason=${soCAfter?.cancellationReason ?? ''} code=${errCode(cancelC)}`,
  );

  const issueAfter = poC
    ? await prisma.inventoryTransaction.count({
        where: {
          type: 'PRODUCTION_ISSUE',
          referenceType: 'ProductionOrder',
          referenceId: poC.id,
        },
      })
    : 0;
  ok(
    '5. CASE1 RAW PRODUCTION_ISSUE txs remain',
    issueAfter === issueBefore && issueAfter >= 1,
    `before=${issueBefore} after=${issueAfter}`,
  );

  const openTasksLeft = poC
    ? await prisma.productionTask.count({
        where: {
          productionOrderId: poC.id,
          status: {
            in: ['READY', 'NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'BLOCKED', 'READY_FOR_INSPECTION'],
          },
        },
      })
    : -1;
  const cancelledTasks = poC
    ? await prisma.productionTask.count({
        where: { productionOrderId: poC.id, status: 'CANCELLED' },
      })
    : 0;
  ok(
    '6. CASE1 open tasks cancelled',
    openTasksLeft === 0 && cancelledTasks >= 1,
    `openLeft=${openTasksLeft} cancelled=${cancelledTasks}`,
  );

  const semiC = poC
    ? await prisma.inventoryLot.findFirst({
        where: {
          productionOrderId: poC.id,
          inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD' },
        },
        select: { id: true, status: true },
      })
    : null;
  ok(
    '7. CASE1 SEMI still exists (REQUIRES_REVIEW or present)',
    Boolean(semiC) &&
      (semiC.status === 'REQUIRES_REVIEW' ||
        semiC.status === 'AVAILABLE' ||
        semiC.status === 'RESERVED'),
    `status=${semiC?.status ?? 'none'}`,
  );

  // ── CASE2: P11-G approve already done; receive → quarantine once ──────────
  const retG2 = returns.G;
  ok(
    '8. CASE2 P11-G already APPROVED + WAITING_RETURN',
    retG2?.approvalStatus === 'APPROVED' && retG2?.physicalStatus === 'WAITING_RETURN',
    `approval=${retG2?.approvalStatus} physical=${retG2?.physicalStatus}`,
  );

  const cretBefore = retG2
    ? await prisma.inventoryTransaction.count({
        where: {
          type: 'CUSTOMER_RETURN',
          referenceType: 'ReturnRequest',
          referenceId: retG2.id,
        },
      })
    : -1;
  ok(
    '9. CASE2 approve alone had 0 CUSTOMER_RETURN before receive',
    cretBefore === 0,
    `count=${cretBefore}`,
  );

  const receiveG = retG2
    ? await request('POST', `/api/v1/returns/${retG2.id}/receive`, { cookie })
    : { status: 0, json: null };
  const retGAfter = retG2
    ? await prisma.returnRequest.findUnique({
        where: { id: retG2.id },
        select: { physicalStatus: true, receivedAt: true },
      })
    : null;
  const cretAfter = retG2
    ? await prisma.inventoryTransaction.count({
        where: {
          type: 'CUSTOMER_RETURN',
          referenceType: 'ReturnRequest',
          referenceId: retG2.id,
        },
      })
    : -1;
  const qLot = retG2
    ? await prisma.inventoryLot.findUnique({
        where: { sourceKey: `return-quarantine:${retG2.id}` },
        select: { id: true, status: true },
      })
    : null;
  ok(
    '10. CASE2 receive → quarantine once',
    (receiveG.status === 200 || receiveG.status === 201) &&
      cretAfter === 1 &&
      qLot?.status === 'QUARANTINED' &&
      (retGAfter?.physicalStatus === 'RETURNED' || Boolean(retGAfter?.receivedAt)),
    `status=${receiveG.status} cret=${cretAfter} lot=${qLot?.status ?? 'none'} physical=${retGAfter?.physicalStatus} code=${errCode(receiveG)}`,
  );

  const receiveG2 = retG2
    ? await request('POST', `/api/v1/returns/${retG2.id}/receive`, { cookie })
    : { status: 0, json: null };
  const cretAfter2 = retG2
    ? await prisma.inventoryTransaction.count({
        where: {
          type: 'CUSTOMER_RETURN',
          referenceType: 'ReturnRequest',
          referenceId: retG2.id,
        },
      })
    : -1;
  ok(
    '11. CASE2 second receive idempotent',
    (receiveG2.status === 200 || receiveG2.status === 201) && cretAfter2 === 1,
    `status=${receiveG2.status} cret=${cretAfter2} code=${errCode(receiveG2)}`,
  );

  // ── CASE3: inventory adjustment on K ──────────────────────────────────────
  const adjK = await prisma.inventoryTransaction.findFirst({
    where: {
      number: 'ITX-P11-K-ADJ',
      type: 'INVENTORY_ADJUSTMENT',
    },
    select: { id: true, notes: true, quantity: true },
  });
  const cntK = await prisma.inventoryCount.findUnique({
    where: { number: 'CNT-P11-K' },
    select: { id: true, status: true },
  });
  ok(
    '12. CASE3 inventory adjustment/correction on K exists as ledger',
    Boolean(adjK) && Boolean(cntK),
    `tx=${adjK?.id ? 'yes' : 'no'} count=${cntK?.status ?? 'none'} notes=${adjK?.notes ?? ''}`,
  );

  // ── CASE4: nile cannot GET balqis return ───────────────────────────────────
  const nile = await login('nile');
  ok('13. nile login', Boolean(nile.cookie), `status=${nile.status}`);
  const retF = returns.F ?? (await prisma.returnRequest.findUnique({ where: { number: 'RET-P11-F' } }));
  const nileGet = retF
    ? await request('GET', `/api/v1/returns/${retF.id}`, { cookie: nile.cookie })
    : { status: 0, json: null };
  ok(
    '14. CASE4 nile cannot GET balqis return',
    nileGet.status === 404 ||
      String(errCode(nileGet)).includes('NOT_FOUND') ||
      nileGet.status === 403,
    `status=${nileGet.status} code=${errCode(nileGet)}`,
  );

  // ── CASE5: finance — cancel does not delete invoice on L ──────────────────
  const soL = salesOrders.L;
  const invLBefore = await prisma.invoice.findUnique({
    where: { number: 'INV-P11-L' },
    select: { id: true, status: true, total: true, paidAmount: true },
  });
  const impactL = soL
    ? await request('GET', `/api/v1/sales-orders/${soL.id}/cancel-impact`, { cookie })
    : { status: 0, json: null };
  const finAttention =
    impactL.json?.impact?.financialAttention === true ||
    Boolean(impactL.json?.impact?.invoice) ||
    impactL.json?.impact?.paymentsPresent === true;
  ok(
    '15. CASE5 financialAttention true on L impact before cancel',
    (impactL.status === 200 || impactL.status === 201) && finAttention && Boolean(invLBefore),
    `status=${impactL.status} attention=${impactL.json?.impact?.financialAttention} invoice=${Boolean(impactL.json?.impact?.invoice)}`,
  );

  const cancelL = soL
    ? await request('POST', `/api/v1/sales-orders/${soL.id}/cancel`, {
        cookie,
        body: {
          reasonCode: 'Commercial agreement',
          reason: 'P11 smoke cancel with invoice attention',
        },
      })
    : { status: 0, json: null };
  const invLAfter = await prisma.invoice.findUnique({
    where: { number: 'INV-P11-L' },
    select: { id: true, status: true },
  });
  const payLAfter = await prisma.payment.findUnique({
    where: { number: 'PAY-P11-L' },
    select: { id: true },
  });
  ok(
    '16. CASE5 cancel does not delete invoice on L',
    (cancelL.status === 200 || cancelL.status === 201) &&
      Boolean(invLAfter) &&
      Boolean(payLAfter),
    `cancel=${cancelL.status} inv=${invLAfter?.id ? 'kept' : 'missing'} pay=${payLAfter?.id ? 'kept' : 'missing'} code=${errCode(cancelL)}`,
  );

  // ── Phase 5: cannot cancel delivered SO-P11-F (USE_RETURN) ────────────────
  const soF = salesOrders.F;
  const cancelF = soF
    ? await request('POST', `/api/v1/sales-orders/${soF.id}/cancel`, {
        cookie,
        body: { reasonCode: 'Dealer requested', reason: 'should be blocked' },
      })
    : { status: 0, json: null };
  const impactF = soF
    ? await request('GET', `/api/v1/sales-orders/${soF.id}/cancel-impact`, { cookie })
    : { status: 0, json: null };
  ok(
    '17. Phase 5 cannot cancel delivered SO-P11-F (USE_RETURN)',
    cancelF.status >= 400 &&
      (String(errCode(cancelF)).includes('USE_RETURN') ||
        impactF.json?.canCancel === false ||
        String(impactF.json?.blockReason || '').includes('USE_RETURN')),
    `cancel=${cancelF.status} code=${errCode(cancelF)} phase=${impactF.json?.phase} canCancel=${impactF.json?.canCancel}`,
  );

  const passed = steps.filter((s) => s.ok).length;
  const total = steps.length;
  const allOk = passed === total;

  const report = `# Piece 11 Exceptions / Returns UAT Report

API: ${API}
Result: **${allOk ? 'PASS' : 'FAIL'}** (${passed}/${total})

## Story map

| Story | Numbers | Intent |
|---|---|---|
| A | SO-P11-A | Draft SO cancellable |
| B | SO/PO-P11-B | Setup / ready-for-production cancellable |
| C | SO/PO-P11-C | IN_PRODUCTION + PRODUCTION_ISSUE RAW + open tasks + SEMI |
| D | SO/PO-P11-D | Already CANCELLED + SEMI REQUIRES_REVIEW |
| E | SO/PO-P11-E | READY_FOR_DELIVERY + FIN AVAILABLE (hold disposition) |
| F | SO/PO/DLV/RET-P11-F | DELIVERED + return PENDING (balqis) — 0 quarantine |
| G | SO/PO/DLV/RET-P11-G | APPROVED + WAITING_RETURN — 0 stock until receive |
| H | SO/PO/DLV/RET-P11-H | RETURNED + QUARANTINED lot awaiting inspection |
| I | SO/PO/DLV/RET-P11-I | REWORK fate + ReworkRequest (repair) |
| J | SO/PO/DLV/RET-P11-J + PO-P11-J-REPL | REPLACEMENT + replacement PO notes |
| K | SO-P11-K + CNT/ITX-P11-K | Cycle count / INVENTORY_ADJUSTMENT on RAW |
| L | SO/PO/INV/PAY-P11-L | Partial invoice + cancel financial attention |

Dealers: **balqis** (F–J), **nile** (cross-deny). Password \`123\`.

## Smoke results

${steps.map((s) => `- ${s.ok ? 'PASS' : 'FAIL'} ${s.name}${s.detail ? ` — ${s.detail}` : ''}`).join('\n')}

HANDSET: PENDING
BROWSER: PENDING
`;

  const reportPath = resolve(ROOT, 'docs/piece11-exceptions-returns-uat-report.md');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report, 'utf8');
  console.log(`\nWrote ${reportPath}`);
  console.log(`\n${allOk ? 'PASS' : 'FAIL'} ${passed}/${total}`);

  await prisma.$disconnect();
  process.exit(allOk ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
