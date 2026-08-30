/**
 * Piece 5 live UAT — actual manufacturing cost against running API + ledger.
 * Asserts 16 checks from plan §35 (API/ledger, not seed hardcodes alone).
 *
 * Usage: pnpm smoke:piece5-manufacturing-cost-uat
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

async function request(method, path, { body, cookie } = {}) {
  const headers = {};
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

async function soId(number) {
  const row = await prisma.salesOrder.findUnique({
    where: { number },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function main() {
  console.log(`Piece 5 manufacturing-cost UAT → ${API}\n`);

  const admin = await login('admin');
  ok('1. admin login', (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie));

  const idA = await soId('SO-P5-A');
  const idB = await soId('SO-P5-B');
  const idC = await soId('SO-P5-C');
  const idD = await soId('SO-P5-D');
  const idE = await soId('SO-P5-E');
  const idF = await soId('SO-P5-F');
  const idG = await soId('SO-P5-G');
  const idH = await soId('SO-P5-H');
  const idI = await soId('SO-P5-I');
  ok('2. demo rows SO-P5-A…I present', Boolean(idA && idB && idC && idD && idE && idF && idG && idH && idI), `A=${idA}`);

  async function cost(id) {
    return request('GET', `/api/v1/sales-orders/${id}/manufacturing-cost`, {
      cookie: admin.cookie,
    });
  }

  const a = await cost(idA);
  ok(
    '3. P5-A EST≈ACT (on budget)',
    a.status === 200 &&
      a.json?.status === 'FINAL' &&
      a.json?.estimated?.total != null &&
      a.json?.actual?.total != null &&
      Math.abs(a.json.actual.total - a.json.estimated.total) < 0.02,
    `est=${a.json?.estimated?.total} act=${a.json?.actual?.total} st=${a.json?.status}`,
  );

  const b = await cost(idB);
  const fabB = (b.json?.bySku ?? []).find(
    (r) => String(r.category ?? '').toUpperCase().includes('FABRIC') || Number(r.varianceQty) > 0,
  );
  ok(
    '4. P5-B fabric overrun variance > 0',
    b.status === 200 &&
      b.json?.variance?.cost != null &&
      b.json.variance.cost > 0 &&
      (fabB?.varianceQty ?? 0) > 0,
    `var=${b.json?.variance?.cost} fabVarQty=${fabB?.varianceQty} cat=${fabB?.category}`,
  );

  const c = await cost(idC);
  const fabC = (c.json?.bySku ?? [])[0];
  ok(
    '5. P5-C returns reduce costedQty',
    c.status === 200 &&
      fabC &&
      Number(fabC.returnedQty) > 0 &&
      Math.abs(
        Number(fabC.costedQty) - (Number(fabC.issuedQty) - 2 * Number(fabC.returnedQty)),
      ) < 0.02 &&
      Number(c.json.actual.returnCredit) > 0,
    `costed=${fabC?.costedQty} issued=${fabC?.issuedQty} ret=${fabC?.returnedQty} credit=${c.json?.actual?.returnCredit}`,
  );

  const d = await cost(idD);
  ok(
    '6. P5-D scrap charged',
    d.status === 200 && d.json?.actual?.scrapCost > 0 && (d.json?.bySku?.[0]?.scrapQty ?? 0) > 0,
    `scrapCost=${d.json?.actual?.scrapCost}`,
  );

  const e = await cost(idE);
  ok(
    '7. P5-E rework cost included once',
    e.status === 200 && e.json?.actual?.reworkCost > 0,
    `rework=${e.json?.actual?.reworkCost} total=${e.json?.actual?.total}`,
  );

  const f = await cost(idF);
  ok(
    '8. P5-F INCOMPLETE — never invents 0',
    f.status === 200 &&
      f.json?.status === 'INCOMPLETE' &&
      f.json?.incomplete === true &&
      (f.json?.bySku ?? []).some((r) => r.costedQty > 0 && r.actualCost == null),
    `status=${f.json?.status}`,
  );

  const g = await cost(idG);
  ok(
    '9. P5-G multi-line SO aggregates lines',
    g.status === 200 &&
      Array.isArray(g.json?.lines) &&
      g.json.lines.length >= 2 &&
      g.json?.actual?.total != null &&
      g.json.actual.total > 0,
    `lines=${g.json?.lines?.length} total=${g.json?.actual?.total}`,
  );

  const h = await cost(idH);
  ok(
    '10. P5-H FINAL status',
    h.status === 200 && h.json?.status === 'FINAL' && h.json?.actual?.total != null,
    `status=${h.json?.status}`,
  );

  // Historical stability: bump live standardCost; FINAL actual must stay stored.
  const hSku = h.json?.bySku?.[0]?.sku;
  const storedAct = h.json?.actual?.total;
  let bumped = false;
  if (hSku) {
    const item = await prisma.inventoryItem.findUnique({ where: { sku: hSku } });
    if (item) {
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { standardCost: Number(item.standardCost || 1) + 500 },
      });
      bumped = true;
      const h2 = await cost(idH);
      ok(
        '11. P5-H stable after map change',
        h2.json?.actual?.total === storedAct,
        `before=${storedAct} after=${h2.json?.actual?.total}`,
      );
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { standardCost: item.standardCost },
      });
    }
  }
  if (!bumped) ok('11. P5-H stable after map change', false, 'no sku');

  const i = await cost(idI);
  ok(
    '12. P5-I IN_PROGRESS cost-to-date',
    i.status === 200 && i.json?.status === 'IN_PROGRESS' && i.json?.actual?.toDate != null,
    `status=${i.json?.status} toDate=${i.json?.actual?.toDate}`,
  );

  const detail = await request('GET', `/api/v1/sales-orders/${idB}`, { cookie: admin.cookie });
  ok(
    '13. SO detail embeds manufacturingCosting summary',
    detail.status === 200 &&
      detail.json?.manufacturingCosting?.status != null &&
      detail.json.manufacturingCosting.actualTotal != null,
    `mc=${JSON.stringify(detail.json?.manufacturingCosting)}`,
  );

  const oasis = await login('oasis');
  const oasisCost = await request('GET', `/api/v1/sales-orders/${idB}/manufacturing-cost`, {
    cookie: oasis.cookie,
  });
  const oasisDetail = await request('GET', `/api/v1/sales-orders/${idB}`, {
    cookie: oasis.cookie,
  });
  ok(
    '14. dealer denied cost API + stripped detail',
    oasisCost.status === 403 &&
      (oasisDetail.json?.manufacturingCosting == null ||
        !('manufacturingCosting' in (oasisDetail.json ?? {})) ||
        oasisDetail.json?.manufacturingCosting === null),
    `cost=${oasisCost.status} embed=${oasisDetail.json?.manufacturingCosting}`,
  );

  const worker = await login('carpenter');
  const workerCost = await request('GET', `/api/v1/sales-orders/${idB}/manufacturing-cost`, {
    cookie: worker.cookie,
  });
  ok('15. worker denied manufacturing-cost (403)', workerCost.status === 403, `status=${workerCost.status}`);

  const usageLedger = await prisma.productionTaskMaterialUsage.findFirst({
    where: {
      productionOrder: { number: 'PO-P5-B' },
      finalizedAt: { not: null },
      unitCost: { not: null },
      extendedCost: { not: null },
    },
  });
  ok(
    '16. ledger stores unitCost/extendedCost on finalized usage',
    Boolean(usageLedger),
    usageLedger ? `sku=${usageLedger.sku} ext=${usageLedger.extendedCost}` : 'missing',
  );

  const failed = steps.filter((s) => !s.ok);
  const outDir = resolve(ROOT, 'tmp');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'piece5-manufacturing-cost-uat.json');
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
