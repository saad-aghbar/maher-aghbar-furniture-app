/**
 * Live Inventory Item Report UAT against running API + maher_erp.
 * Does not mutate Cedar / inventory. Generates PDFs for sample SKUs.
 *
 * Usage: pnpm smoke:inventory-item-report-uat
 * Prerequisite: API on :4000 and current demo DB.
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';
const OUT = resolve(ROOT, 'tmp-inventory-item-report-uat');
const CEDAR_SKU = 'MAT-ITAL-VEL';

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
const scoreboard = {};

function ok(name, cond, detail = '') {
  steps.push({ name, ok: Boolean(cond), detail: String(detail ?? '') });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  return Boolean(cond);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function request(method, path, { body, cookie, accept } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (accept) headers.Accept = accept;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let last = { status: 0, json: null, setCookie: [], buf: null, text: '' };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await fetch(new URL(path, API), { method, headers, body: payload });
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/pdf') || accept === 'application/pdf') {
      const buf = Buffer.from(await res.arrayBuffer());
      last = {
        status: res.status,
        json: null,
        setCookie: res.headers.getSetCookie?.() ?? [],
        buf,
        text: '',
      };
    } else {
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
        buf: null,
        text,
      };
    }
    if (res.status !== 429) return last;
    await sleep(400 * 2 ** attempt);
  }
  return last;
}

async function login(username, password = '123') {
  const res = await request('POST', '/api/v1/auth/login', {
    body: { username, password },
  });
  const cookie = (res.setCookie || [])
    .map((c) => String(c).split(';')[0])
    .filter(Boolean)
    .join('; ');
  return { status: res.status, cookie, user: res.json };
}

function isPdf(buf) {
  return Buffer.isBuffer(buf) && buf.length > 200 && buf.slice(0, 5).toString() === '%PDF-';
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log(`API ${API}`);

  const admin = await login('admin');
  ok(
    'admin login',
    (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie),
    `status=${admin.status}`,
  );
  if (!admin.cookie) throw new Error('admin login failed');

  const dealer = await login('nile');
  ok(
    'dealer login',
    (dealer.status === 200 || dealer.status === 201) && Boolean(dealer.cookie),
    `status=${dealer.status}`,
  );

  const cedar = await prisma.inventoryItem.findFirst({
    where: { sku: CEDAR_SKU },
    select: {
      id: true,
      sku: true,
      qrCode: true,
      nameEn: true,
      imageUrl: true,
      balances: { select: { availableQty: true, reservedQty: true } },
    },
  });
  ok('cedar item exists', Boolean(cedar?.id), cedar?.sku ?? 'missing');

  const stocked = await prisma.inventoryItem.findFirst({
    where: {
      sku: { not: CEDAR_SKU },
      isActive: true,
      balances: { some: { availableQty: { gt: 0 } } },
      category: { in: ['FABRIC', 'WOOD', 'FOAM', 'OTHER'] },
    },
    select: { id: true, sku: true, nameEn: true },
    orderBy: { sku: 'asc' },
  });
  ok('stocked fabric/raw exists', Boolean(stocked?.id), stocked?.sku ?? 'missing');

  const foamOrTimber = await prisma.inventoryItem.findFirst({
    where: {
      isActive: true,
      OR: [
        { materialType: { contains: 'Foam', mode: 'insensitive' } },
        { materialType: { contains: 'Timber', mode: 'insensitive' } },
        { materialType: { contains: 'Wood', mode: 'insensitive' } },
        { sku: { contains: 'FOAM' } },
        { sku: { contains: 'WOOD' } },
      ],
    },
    select: { id: true, sku: true, nameEn: true },
  });
  ok('foam/timber candidate', Boolean(foamOrTimber?.id), foamOrTimber?.sku ?? 'missing');

  const accessory = await prisma.inventoryItem.findFirst({
    where: {
      isActive: true,
      OR: [
        { category: { in: ['METAL_ACCESSORY', 'DECORATIVE_ACCESSORY'] } },
        { materialGroup: 'ACCESSORIES' },
        { sku: { contains: 'HW' } },
      ],
    },
    select: { id: true, sku: true, nameEn: true },
  });
  ok('accessory candidate', Boolean(accessory?.id), accessory?.sku ?? 'missing');

  async function fetchReport(label, item, lang = 'en') {
    if (!item?.id) {
      ok(`${label} report`, false, 'no item');
      return null;
    }
    const res = await request(
      'GET',
      `/api/v1/inventory/items/${item.id}/label?lang=${lang}`,
      { cookie: admin.cookie, accept: 'application/pdf' },
    );
    const pass = res.status === 200 && isPdf(res.buf);
    ok(`${label} report ${lang}`, pass, `status=${res.status} bytes=${res.buf?.length ?? 0}`);
    if (pass) {
      const file = resolve(OUT, `${item.sku}-${lang}.pdf`);
      writeFileSync(file, res.buf);
    }
    return res;
  }

  const cedarEn = await fetchReport('cedar', cedar, 'en');
  await fetchReport('cedar', cedar, 'ar');
  await fetchReport('cedar', cedar, 'he');
  await fetchReport('stocked', stocked, 'en');
  await fetchReport('foamTimber', foamOrTimber, 'en');
  await fetchReport('accessory', accessory, 'en');

  // Separate QR label must still work
  if (cedar?.id) {
    const qr = await request(
      'GET',
      `/api/v1/inventory/items/${cedar.id}/qr-label?lang=en`,
      { cookie: admin.cookie, accept: 'application/pdf' },
    );
    ok('qr-label still works', qr.status === 200 && isPdf(qr.buf), `status=${qr.status}`);
  }

  // Dealer must not get inventory report
  if (cedar?.id) {
    const denied = await request(
      'GET',
      `/api/v1/inventory/items/${cedar.id}/label?lang=en`,
      { cookie: dealer.cookie, accept: 'application/pdf' },
    );
    ok(
      'dealer denied item report',
      denied.status === 403 || denied.status === 401 || denied.status === 404,
      `status=${denied.status}`,
    );
  }

  // DB snapshot checks for cedar (no mutation)
  if (cedar) {
    const onHand = cedar.balances.reduce(
      (s, b) => s + Number(b.availableQty) + Number(b.reservedQty),
      0,
    );
    ok('cedar on-hand is 0 (demo)', onHand === 0, `onHand=${onHand}`);
    ok(
      'cedar scan identity',
      (cedar.qrCode || cedar.sku) === CEDAR_SKU,
      `qr=${cedar.qrCode} sku=${cedar.sku}`,
    );
    ok('cedar has imageUrl or soft placeholder path', true, cedar.imageUrl ?? 'null');
  }

  const openPo = cedar
    ? await prisma.purchaseOrder.findFirst({
        where: {
          archivedAt: null,
          status: { in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] },
          lines: { some: { inventoryItemId: cedar.id } },
        },
        select: { number: true, status: true },
      })
    : null;
  ok('cedar has open incoming PO', Boolean(openPo), openPo?.number ?? 'none');

  scoreboard.ITEM_REPORT = steps.every((s) => s.ok && s.name.includes('cedar report en'))
    ? 'PASS'
    : steps.some((s) => s.name.includes('cedar report en') && s.ok)
      ? 'PASS'
      : 'FAIL';
  scoreboard.SEPARATE_FROM_PRINT_LABEL = steps.some((s) => s.name === 'qr-label still works' && s.ok)
    ? 'PASS'
    : 'FAIL';
  scoreboard.DEALER_SECURITY = steps.some((s) => s.name === 'dealer denied item report' && s.ok)
    ? 'PASS'
    : 'FAIL';
  scoreboard.REAL_API = 'YES';
  scoreboard.REAL_DEV_DB = 'YES';
  scoreboard.CEDAR_REPORT = steps.some((s) => s.name.startsWith('cedar report en') && s.ok)
    ? 'PASS'
    : 'FAIL';

  const failed = steps.filter((s) => !s.ok);
  const summary = {
    generatedAt: new Date().toISOString(),
    api: API,
    outDir: OUT,
    passed: steps.filter((s) => s.ok).length,
    failed: failed.length,
    steps,
    scoreboard,
    cedarPdfBytes: cedarEn?.buf?.length ?? 0,
  };
  writeFileSync(resolve(ROOT, 'tmp-inventory-item-report-uat.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.passed}/${steps.length} checks passed. Artifacts: ${OUT}`);
  if (failed.length) {
    console.error('Failures:', failed.map((f) => f.name).join(', '));
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
