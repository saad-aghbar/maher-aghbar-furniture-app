/**
 * Piece 10 live UAT — finished outbound / load / depart / dealer receipt.
 *
 * Usage: pnpm smoke:piece10-finished-outbound-uat
 * Requires API on :4000 and Piece 10 demo rows (demo:reset or reseed-piece10).
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

async function main() {
  console.log(`Piece 10 finished outbound UAT → ${API}\n`);

  const admin = await login('admin');
  ok('1. admin login', (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie));
  const cookie = admin.cookie;
  if (!cookie) throw new Error('Admin login failed — is the API running?');

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  async function loadP10Rows() {
    const deliveries = {};
    const salesOrders = {};
    for (const L of letters) {
      deliveries[L] = await prisma.delivery.findUnique({
        where: { number: `DLV-P10-${L}` },
        include: {
          salesOrder: { select: { id: true, number: true } },
          loadPieces: { select: { id: true, loadedAt: true, pieceIndex: true } },
        },
      });
      salesOrders[L] = await prisma.salesOrder.findUnique({
        where: { number: `SO-P10-${L}` },
        select: { id: true, number: true },
      });
    }
    return { deliveries, salesOrders };
  }

  let { deliveries, salesOrders } = await loadP10Rows();

  // Prior smoke runs mutate F (depart) and G (confirm) — reseed so +1 ISSUE and confirm stay honest.
  const needsReseed =
    deliveries.F?.status === 'OUT_FOR_DELIVERY' ||
    deliveries.F?.status === 'DELIVERED' ||
    deliveries.G?.status === 'DELIVERED' ||
    !letters.every((L) => Boolean(deliveries[L]) && Boolean(salesOrders[L]));
  if (needsReseed) {
    console.log('Reseeding Piece 10 demo (fresh F/G for UAT)…');
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
        'prisma/demo/reseed-piece10.ts',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    if (reseeds.status !== 0) {
      console.error(reseeds.stdout || '');
      console.error(reseeds.stderr || '');
      throw new Error('Piece 10 reseed failed');
    }
    ({ deliveries, salesOrders } = await loadP10Rows());
  }

  ok(
    '2. P10 demo rows present (SO/DLV)',
    letters.every((L) => Boolean(deliveries[L]) && Boolean(salesOrders[L])),
    `missing=${letters.filter((L) => !deliveries[L] || !salesOrders[L]).join(',') || 'none'}`,
  );

  // ── P10-E: incomplete load; FIN AVAILABLE; depart blocked ─────────────────
  const dlvE = deliveries.E;
  const soE = salesOrders.E;
  const ePieces = dlvE?.loadPieces ?? [];
  const eLoaded = ePieces.filter((p) => p.loadedAt).length;
  const eTotal = ePieces.length;
  const eFin = soE
    ? await prisma.inventoryLot.findFirst({
        where: {
          salesOrderId: soE.id,
          status: { in: ['AVAILABLE', 'RESERVED'] },
          inventoryItem: { itemClass: 'FINISHED_GOOD' },
        },
      })
    : null;
  ok(
    '3. P10-E load incomplete (3/6) + FIN AVAILABLE',
    Boolean(dlvE) && eTotal === 6 && eLoaded === 3 && Boolean(eFin),
    `loaded=${eLoaded}/${eTotal} fin=${eFin?.status ?? 'none'}`,
  );

  const departE = dlvE
    ? await request('POST', `/api/v1/deliveries/${dlvE.id}/depart`, { cookie })
    : { status: 0, json: null };
  ok(
    '4. P10-E depart blocked DELIVERY_LOAD_INCOMPLETE',
    departE.status >= 400 && String(errCode(departE)).includes('DELIVERY_LOAD_INCOMPLETE'),
    `status=${departE.status} code=${errCode(departE)}`,
  );

  // ── P10-F: check all if needed; depart; issue +1; second depart idempotent ─
  const dlvF = deliveries.F;
  const soF = salesOrders.F;
  let fPieces = dlvF
    ? await prisma.deliveryLoadPiece.findMany({
        where: { deliveryId: dlvF.id },
        select: { id: true, loadedAt: true },
      })
    : [];

  if (dlvF) {
    // Materialize / refresh via load-sheet
    await request('GET', `/api/v1/deliveries/${dlvF.id}/load-sheet`, { cookie });
    fPieces = await prisma.deliveryLoadPiece.findMany({
      where: { deliveryId: dlvF.id },
      select: { id: true, loadedAt: true },
    });
    for (const p of fPieces) {
      if (!p.loadedAt) {
        await request('POST', `/api/v1/deliveries/${dlvF.id}/load-pieces/${p.id}/check`, {
          cookie,
        });
      }
    }
  }

  const issueBefore = dlvF
    ? await prisma.inventoryTransaction.count({
        where: {
          type: 'DELIVERY_ISSUE',
          referenceType: 'Delivery',
          referenceId: dlvF.id,
        },
      })
    : -1;

  const departF = dlvF
    ? await request('POST', `/api/v1/deliveries/${dlvF.id}/depart`, { cookie })
    : { status: 0, json: null };
  const fStatus =
    departF.json?.status ??
    (await prisma.delivery.findUnique({ where: { id: dlvF?.id ?? '' }, select: { status: true } }))
      ?.status;
  ok(
    '5. P10-F depart → OUT_FOR_DELIVERY',
    (departF.status === 200 || departF.status === 201) && fStatus === 'OUT_FOR_DELIVERY',
    `status=${departF.status} delivery=${fStatus} code=${errCode(departF)}`,
  );

  const issueAfter = dlvF
    ? await prisma.inventoryTransaction.count({
        where: {
          type: 'DELIVERY_ISSUE',
          referenceType: 'Delivery',
          referenceId: dlvF.id,
        },
      })
    : -1;
  ok(
    '6. P10-F DELIVERY_ISSUE count +1 once',
    issueAfter === issueBefore + 1,
    `before=${issueBefore} after=${issueAfter}`,
  );

  const departF2 = dlvF
    ? await request('POST', `/api/v1/deliveries/${dlvF.id}/depart`, { cookie })
    : { status: 0, json: null };
  const issueAfter2 = dlvF
    ? await prisma.inventoryTransaction.count({
        where: {
          type: 'DELIVERY_ISSUE',
          referenceType: 'Delivery',
          referenceId: dlvF.id,
        },
      })
    : -1;
  ok(
    '7. P10-F second depart idempotent (no extra ISSUE)',
    (departF2.status === 200 || departF2.status === 201) && issueAfter2 === issueAfter,
    `status=${departF2.status} issues=${issueAfter2}`,
  );

  // ── FIN not in active inWarehouse for departed SO-F ───────────────────────
  const finActiveF = soF
    ? await prisma.inventoryLot.count({
        where: {
          salesOrderId: soF.id,
          status: { in: ['AVAILABLE', 'RESERVED'] },
          inventoryItem: { itemClass: 'FINISHED_GOOD' },
        },
      })
    : -1;
  const boardF = soF
    ? await request(
        'GET',
        `/api/v1/inventory/finished-lots?scope=inWarehouse&q=${encodeURIComponent(soF.number)}`,
        { cookie },
      )
    : { status: 0, json: null };
  const boardHits = Array.isArray(boardF.json?.data)
    ? boardF.json.data.filter((r) => r.salesOrder?.number === soF?.number)
    : [];
  ok(
    '8. FIN not in active inWarehouse for departed SO-F',
    finActiveF === 0 && boardHits.length === 0,
    `lots=${finActiveF} boardHits=${boardHits.length} api=${boardF.status}`,
  );

  // ── nile cannot confirm balqis P10-G (before balqis confirms) ─────────────
  const dlvG = deliveries.G;
  const nile = await login('nile');
  ok('9. nile login', Boolean(nile.cookie), `status=${nile.status}`);
  const nileDeny = dlvG
    ? await request('POST', `/api/v1/deliveries/${dlvG.id}/confirm-receipt`, {
        cookie: nile.cookie,
      })
    : { status: 0, json: null };
  ok(
    '10. nile cannot confirm balqis delivery P10-G',
    nileDeny.status === 404 ||
      String(errCode(nileDeny)).includes('NOT_FOUND') ||
      nileDeny.status === 403,
    `status=${nileDeny.status} code=${errCode(nileDeny)}`,
  );

  // ── balqis confirm-receipt on P10-G → DELIVERED; inv tx unchanged ─────────
  const balqis = await login('balqis');
  ok('11. balqis login', Boolean(balqis.cookie), `status=${balqis.status}`);

  const txCountAroundG = async () => {
    if (!dlvG) return -1;
    const byDelivery = await prisma.inventoryTransaction.count({
      where: { referenceType: 'Delivery', referenceId: dlvG.id },
    });
    const poIds = dlvG.salesOrderId
      ? (
          await prisma.productionOrder.findMany({
            where: { salesOrderId: dlvG.salesOrderId },
            select: { id: true },
          })
        ).map((p) => p.id)
      : [];
    const byPo = poIds.length
      ? await prisma.inventoryTransaction.count({
          where: { referenceType: 'ProductionOrder', referenceId: { in: poIds } },
        })
      : 0;
    return byDelivery + byPo;
  };

  const txBefore = await txCountAroundG();
  const confirmG = dlvG
    ? await request('POST', `/api/v1/deliveries/${dlvG.id}/confirm-receipt`, {
        cookie: balqis.cookie,
      })
    : { status: 0, json: null };
  const gAfter = dlvG
    ? await prisma.delivery.findUnique({
        where: { id: dlvG.id },
        select: {
          status: true,
          customerConfirmedAt: true,
          customerConfirmedById: true,
        },
      })
    : null;
  const txAfter = await txCountAroundG();
  ok(
    '12. balqis confirm P10-G → DELIVERED',
    (confirmG.status === 200 || confirmG.status === 201) &&
      gAfter?.status === 'DELIVERED' &&
      Boolean(gAfter?.customerConfirmedAt),
    `status=${confirmG.status} delivery=${gAfter?.status} code=${errCode(confirmG)}`,
  );
  ok(
    '13. confirm-receipt does not change inventory tx count',
    txAfter === txBefore,
    `before=${txBefore} after=${txAfter}`,
  );

  // ── staff cannot PATCH DELIVERED ──────────────────────────────────────────
  const target = deliveries.A ?? deliveries.H ?? dlvG;
  const staffPatch = target
    ? await request('PATCH', `/api/v1/deliveries/${target.id}/status`, {
        cookie,
        body: { status: 'DELIVERED' },
      })
    : { status: 0, json: null };
  ok(
    '14. staff cannot PATCH DELIVERED',
    staffPatch.status >= 400 &&
      (String(errCode(staffPatch)).includes('DELIVERY_DEALER_CONFIRM_REQUIRED') ||
        String(errCode(staffPatch)).includes('BAD_REQUEST') ||
        staffPatch.status === 400),
    `status=${staffPatch.status} code=${errCode(staffPatch)}`,
  );

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.length - passed;
  console.log(`\nPiece 10 UAT: ${passed}/${steps.length} PASS (${failed} FAIL)`);

  const reportDir = resolve(ROOT, 'docs');
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, 'piece10-finished-outbound-uat-report.md');
  writeFileSync(
    reportPath,
    [
      '# Piece 10 Finished Outbound UAT Report',
      '',
      `API: ${API}`,
      `Result: **${failed === 0 ? 'PASS' : 'FAIL'}** (${passed}/${steps.length})`,
      '',
      '## Story map',
      '',
      '| Story | Numbers | Intent |',
      '|---|---|---|',
      '| A | SO/PO/DLV-P10-A | FIN waiting for truck (READY, no load checks) |',
      '| B | SO/PO/DLV-P10-B | Pickup planned tomorrow |',
      '| C | SO/PO/DLV-P10-C | Leaving today |',
      '| D | SO/PO/DLV-P10-D | Overdue leave date |',
      '| E | SO/PO/DLV-P10-E | Load 3/6; FIN AVAILABLE; depart blocked |',
      '| F | SO/PO/DLV-P10-F | Load 6/6 ready; smoke departs → ISSUE |',
      '| G | SO/PO/DLV-P10-G | OUT_FOR_DELIVERY awaiting balqis confirm |',
      '| H | SO/PO/DLV-P10-H | DELIVERED + customerConfirmedAt/ById |',
      '| I | SO/PO/DLV-P10-I | Two FIN warehouses (FIN + FIN-P10) |',
      '| J | SO/PO/DLV-P10-J | FAILED after ship + DELIVERY_RESTORE |',
      '| K | SO/PO/DLV-P10-K | Distinct searchable package labels |',
      '| L | SO/PO/DLV-P10-L | History presence (left factory) |',
      '',
      '## Smoke results',
      '',
      ...steps.map((s) => `- ${s.ok ? 'PASS' : 'FAIL'} ${s.name}${s.detail ? ` — ${s.detail}` : ''}`),
      '',
      'HANDSET: PENDING',
      'BROWSER: PENDING',
      'Piece 11 was NOT started.',
      '',
    ].join('\n'),
  );
  console.log(`Wrote ${reportPath}`);

  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
