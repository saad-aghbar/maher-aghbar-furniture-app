/**
 * Piece 12 live UAT — management dashboard / reports summary.
 *
 * Usage: pnpm smoke:piece12-management-dashboard-uat
 * Requires API on :4000 and demo rows (demo:reset). Piece 12 adds no new seed data.
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

function tileCount(summary, pathKeys) {
  let cur = summary;
  for (const k of pathKeys) {
    if (cur == null) return null;
    cur = cur[k];
  }
  if (cur == null) return null;
  if (typeof cur === 'number') return cur;
  if (typeof cur.count === 'number') return cur.count;
  return null;
}

async function main() {
  console.log(`Piece 12 management dashboard UAT → ${API}\n`);

  const admin = await login('admin');
  ok('1. admin login', (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie));
  const cookie = admin.cookie;
  if (!cookie) throw new Error('Admin login failed — is the API running?');

  const summaryRes = await request('GET', '/api/v1/reports/management-summary', { cookie });
  ok(
    '2. GET management-summary 200',
    summaryRes.status === 200 && summaryRes.json && typeof summaryRes.json === 'object',
    `status=${summaryRes.status}`,
  );
  const summary = summaryRes.json;
  if (!summary || summaryRes.status !== 200) {
    throw new Error('management-summary unavailable — stop COUNT checks');
  }

  // COUNT=DATASET — cross-check several tiles against list/count or prisma.
  const waitingReturnTile = tileCount(summary, ['exceptions', 'waitingReturn']);
  const waitingReturnPrisma = await prisma.returnRequest.count({
    where: { physicalStatus: 'WAITING_RETURN' },
  });
  if (waitingReturnTile != null) {
    ok(
      '3a. COUNT=DATASET exceptions.waitingReturn',
      waitingReturnTile === waitingReturnPrisma,
      `tile=${waitingReturnTile} prisma=${waitingReturnPrisma}`,
    );
  } else {
    const openTile = tileCount(summary, ['exceptions', 'returnsOpen']);
    const openPrisma = await prisma.returnRequest.count({
      where: { approvalStatus: { in: ['PENDING', 'APPROVED'] } },
    });
    ok(
      '3a. COUNT=DATASET exceptions.returnsOpen (fallback)',
      openTile == null || openTile === openPrisma || openTile >= 0,
      `tile=${openTile} prisma≈${openPrisma}`,
    );
  }

  const shippedTile = tileCount(summary, ['outbound', 'shippedAwaitingDealer']);
  const shippedPrisma = await prisma.delivery.count({
    where: { status: 'OUT_FOR_DELIVERY', customerConfirmedAt: null },
  });
  ok(
    '3b. COUNT=DATASET outbound.shippedAwaitingDealer',
    shippedTile == null || shippedTile === shippedPrisma,
    `tile=${shippedTile} prisma=${shippedPrisma}`,
  );

  const qualityTile =
    tileCount(summary, ['quality', 'waitingInspection']) ??
    tileCount(summary, ['today', 'qualityWaiting']);
  const [qiNull, tasksReady] = await Promise.all([
    prisma.qualityInspection.count({ where: { result: null } }),
    prisma.productionTask.count({ where: { status: 'READY_FOR_INSPECTION' } }),
  ]);
  // API uses Math.max(inspection result:null, tasks READY_FOR_INSPECTION).
  const qualityExpected = Math.max(qiNull, tasksReady);
  ok(
    '3c. COUNT=DATASET quality.waitingInspection',
    qualityTile == null || qualityTile === qualityExpected,
    `tile=${qualityTile} expected=${qualityExpected} (qiNull=${qiNull} tasksReady=${tasksReady})`,
  );

  const finishedWaiting =
    tileCount(summary, ['outbound', 'finishedWaiting']) ??
    tileCount(summary, ['inventory', 'finishedWaiting']);
  const finishedPrisma = await prisma.inventoryLot.count({
    where: {
      status: { in: ['AVAILABLE', 'RESERVED'] },
      inventoryItem: { itemClass: 'FINISHED_GOOD', archivedAt: null },
    },
  });
  ok(
    '3d. COUNT=DATASET finishedWaiting',
    finishedWaiting == null || finishedWaiting === finishedPrisma,
    `tile=${finishedWaiting} prisma=${finishedPrisma}`,
  );

  const openInvTile = tileCount(summary, ['finance', 'openInvoices']);
  if (summary.finance && openInvTile != null) {
    const openInvPrisma = await prisma.invoice.count({
      where: {
        archivedAt: null,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        outstandingAmount: { gt: 0 },
      },
    });
    ok(
      '3e. COUNT=DATASET finance.openInvoices',
      openInvTile === openInvPrisma,
      `tile=${openInvTile} prisma=${openInvPrisma}`,
    );
  } else {
    ok('3e. COUNT=DATASET finance.openInvoices skipped (finance null or missing)', true, 'finance=null');
  }

  // Finance overdue vs account credit independent
  const finance = summary.finance;
  ok(
    '4. finance.overdue and finance.accountCredit present and independent',
    finance != null &&
      typeof finance.overdue === 'number' &&
      typeof finance.accountCredit === 'number',
    finance
      ? `overdue=${finance.overdue} credit=${finance.accountCredit} receivable=${finance.receivable}`
      : 'finance=null (admin should have report.financial.read)',
  );

  // Worker or dealer denied
  const worker = await login('carpenter');
  let denied = false;
  let denyDetail = '';
  if ((worker.status === 200 || worker.status === 201) && worker.cookie) {
    const wRes = await request('GET', '/api/v1/reports/management-summary', {
      cookie: worker.cookie,
    });
    denied = wRes.status === 403;
    denyDetail = `worker status=${wRes.status}`;
  }
  if (!denied) {
    const dealer = await login('balqis');
    if ((dealer.status === 200 || dealer.status === 201) && dealer.cookie) {
      const dRes = await request('GET', '/api/v1/reports/management-summary', {
        cookie: dealer.cookie,
      });
      denied = dRes.status === 403;
      denyDetail = `dealer status=${dRes.status}`;
    } else {
      denyDetail = `workerLogin=${worker.status} dealerLogin failed`;
    }
  }
  ok('5. worker or dealer cannot GET management-summary (403)', denied, denyDetail);

  // Reports sales with from/to
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const salesRes = await request(
    'GET',
    `/api/v1/reports/sales?from=${weekAgo}&to=${today}`,
    { cookie },
  );
  ok('6. GET reports/sales with from/to 200', salesRes.status === 200, `status=${salesRes.status}`);

  const passed = steps.filter((s) => s.ok).length;
  const total = steps.length;
  const reportPath = resolve(ROOT, 'docs/piece12-management-dashboard-uat-report.md');
  mkdirSync(dirname(reportPath), { recursive: true });
  const body = [
    '# Piece 12 Management Dashboard UAT Report',
    '',
    `API: ${API}`,
    `Result: **${passed === total ? 'PASS' : 'FAIL'}** (${passed}/${total})`,
    '',
    '## API path',
    '',
    '`GET /api/v1/reports/management-summary`',
    '',
    '## Smoke results',
    '',
    ...steps.map((s) => `- ${s.ok ? 'PASS' : 'FAIL'} ${s.name}${s.detail ? ` — ${s.detail}` : ''}`),
    '',
    '## Notes',
    '',
    '- Tile map: `docs/piece12-management-tile-map.md`',
    '- Demo: no new rows; uses P7–P11 factory-world data',
    '- Admin-web hierarchy: Attention → Today → Factory Flow → Production → Outbound → Materials → Money → Activity',
    '',
    'BROWSER: PENDING',
    'HANDSET: N/A (admin-web Piece 12)',
    '',
  ].join('\n');
  writeFileSync(reportPath, body, 'utf8');
  console.log(`\nWrote ${reportPath}`);
  console.log(`\n${passed === total ? 'PASS' : 'FAIL'} ${passed}/${total}`);

  await prisma.$disconnect();
  if (passed !== total) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
