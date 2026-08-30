/**
 * Live raw-material images UAT against running API + maher_erp.
 * Visual/catalog only — does not change quantities, ETA, scheduling, or at-risk.
 * Restores any PATCH replace. Jest is not PASS.
 *
 * Usage: pnpm smoke:raw-material-images-uat
 * Prerequisite: pnpm demo:reset
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';
const CEDAR_SKU = 'MAT-ITAL-VEL';
const CEDAR_PHOTO = 'photo-1576566588028-4147f3842f27';
const REPLACE_SKU = 'MAT-FOAM-HD';
const TEMP_URL =
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&h=600&q=80';
const FAMILIES = [
  { id: 'A-velvet-cedar', sku: CEDAR_SKU },
  { id: 'A-velvet-other', sku: 'MAT-VEL-NAVY' },
  { id: 'B-foam', sku: 'MAT-FOAM-HD' },
  { id: 'C-timber', sku: 'MAT-BEECH' },
  { id: 'D-springs-hardware', sku: 'MAT-SPRING' },
  { id: 'E-glue', sku: 'MAT-GLUE' },
];
const ACCESSORY_SKU = 'MAT-HW-KIT';

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

function mark(id, status) {
  tests[id] = { id, status };
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

async function login(username, password = '123') {
  const res = await request('POST', '/api/v1/auth/login', { body: { username, password } });
  return { cookie: cookieHeader(res.setCookie), status: res.status, json: res.json };
}

function isHttpUrl(value) {
  const trimmed = String(value ?? '').trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function findItem(cookie, sku) {
  const byCode = await request('GET', `/api/v1/inventory/items/by-code/${encodeURIComponent(sku)}`, {
    cookie,
  });
  if (byCode.status === 200 && byCode.json?.id) {
    return { list: byCode, item: byCode.json, detail: byCode.json };
  }
  const list = await request('GET', `/api/v1/inventory/items?q=${encodeURIComponent(sku)}&pageSize=50`, {
    cookie,
  });
  const rows = list.json?.data ?? [];
  const item = rows.find((row) => row.sku === sku) ?? null;
  if (!item?.id) return { list, item: null, detail: null };
  const detail = await request('GET', `/api/v1/inventory/items/${item.id}`, { cookie });
  return { list, item, detail: detail.json };
}

async function main() {
  const admin = await login('admin');
  ok('admin login', (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie), String(admin.status));
  const dealer = await login('cedar');
  ok('dealer login', (dealer.status === 200 || dealer.status === 201) && Boolean(dealer.cookie), String(dealer.status));
  if (!admin.cookie) {
    throw new Error('admin login failed');
  }

  const rawRows = await prisma.inventoryItem.findMany({
    where: { itemClass: 'RAW_MATERIAL', archivedAt: null },
    select: { sku: true, imageUrl: true },
  });
  const missing = rawRows.filter((row) => !isHttpUrl(row.imageUrl)).map((row) => row.sku);
  evidence.rawSkuCount = rawRows.length;
  evidence.missingImageSkus = missing;
  mark('demo-coverage', missing.length === 0 ? 'PASS' : 'FAIL');
  ok('all curated RAW SKUs have imageUrl', missing.length === 0, missing.join(',') || `${rawRows.length} SKUs`);

  const cedarDb = rawRows.find((row) => row.sku === CEDAR_SKU);
  ok(
    'Cedar velvet visual identity URL',
    Boolean(cedarDb?.imageUrl?.includes(CEDAR_PHOTO)),
    cedarDb?.imageUrl ?? 'missing',
  );

  const product = await prisma.product.findFirst({
    where: { sku: 'SOF-RECL', archivedAt: null },
    select: { id: true, sku: true, bomDefaults: true },
  });
  ok('Cedar product SOF-RECL present', Boolean(product?.id), product?.id ?? '');

  const demandRes = await request('GET', '/api/v1/material-demand', { cookie: admin.cookie });
  ok('material demand 200', demandRes.status === 200, String(demandRes.status));
  const demandRows = Array.isArray(demandRes.json) ? demandRes.json : [];
  evidence.demandCount = demandRows.length;
  if (demandRows.length) {
    const mismatched = [];
    for (const row of demandRows) {
      const item = rawRows.find((r) => r.sku === row.sku);
      if (!isHttpUrl(row.imageUrl) || (item && item.imageUrl !== row.imageUrl)) {
        mismatched.push(row.sku);
      }
    }
    ok(
      'every demand row imageUrl matches inventory SKU',
      mismatched.length === 0,
      mismatched.join(',') || `${demandRows.length} rows`,
    );
  } else {
    ok('material demand empty after reset (no open required SKUs)', true, '0 rows');
  }

  const setupRes = product?.id
    ? await request('GET', `/api/v1/products/${product.id}/production-setup`, { cookie: admin.cookie })
    : { status: 0, json: null };
  ok('production setup 200', setupRes.status === 200, String(setupRes.status));
  const productRes = product?.id
    ? await request('GET', `/api/v1/products/${product.id}`, { cookie: admin.cookie })
    : { status: 0, json: null };
  ok('product BOM 200', productRes.status === 200, String(productRes.status));

  for (const family of FAMILIES) {
    mark(family.id, 'RUN');
    const found = await findItem(admin.cookie, family.sku);
    const listUrl = found.item?.imageUrl ?? null;
    const detailUrl = found.detail?.imageUrl ?? null;
    ok(`${family.sku} list thumb URL`, isHttpUrl(listUrl), listUrl ?? 'null');
    ok(`${family.sku} detail URL matches list`, detailUrl === listUrl && isHttpUrl(detailUrl), detailUrl ?? 'null');

    const demand = demandRows.find((row) => row.sku === family.sku);
    if (demand) {
      ok(
        `${family.sku} demand URL matches inventory`,
        demand.imageUrl === listUrl,
        demand.imageUrl ?? 'null',
      );
    } else {
      ok(`${family.sku} demand optional (SKU not currently required)`, true, 'not in demand');
    }

    const bomLine = (productRes.json?.bomLines ?? []).find((line) => line.sku === family.sku);
    const setupBom = (setupRes.json?.bomLines ?? []).find((line) => line.sku === family.sku);
    const setupInput = (setupRes.json?.stages ?? [])
      .flatMap((stage) => stage.materialInputs ?? [])
      .find((row) => row.sku === family.sku);
    if (bomLine) {
      ok(`${family.sku} product BOM URL matches`, bomLine.imageUrl === listUrl, bomLine.imageUrl ?? 'null');
    }
    if (setupBom) {
      ok(`${family.sku} setup BOM URL matches`, setupBom.imageUrl === listUrl, setupBom.imageUrl ?? 'null');
    }
    if (setupInput) {
      ok(
        `${family.sku} setup materialInput URL matches`,
        setupInput.imageUrl === listUrl,
        setupInput.imageUrl ?? 'null',
      );
    }

    const poLine = await prisma.purchaseOrderLine.findFirst({
      where: { inventoryItem: { sku: family.sku } },
      include: { inventoryItem: true, purchaseOrder: { select: { id: true, number: true } } },
    });
    if (poLine?.purchaseOrder?.id) {
      const poRes = await request('GET', `/api/v1/purchase-orders/${poLine.purchaseOrder.id}`, {
        cookie: admin.cookie,
      });
      const apiLine = (poRes.json?.lines ?? []).find((line) => line.inventoryItem?.sku === family.sku);
      ok(
        `${family.sku} PO ${poLine.purchaseOrder.number} line URL matches`,
        apiLine?.inventoryItem?.imageUrl === listUrl,
        apiLine?.inventoryItem?.imageUrl ?? 'null',
      );
      ok(
        `${family.sku} PO line has no own image column`,
        apiLine != null && !Object.prototype.hasOwnProperty.call(apiLine, 'imageUrl'),
        Object.keys(apiLine ?? {}).join(','),
      );
    }

    evidence[family.sku] = {
      listUrl,
      detailUrl,
      demandUrl: demand?.imageUrl ?? null,
      bomUrl: bomLine?.imageUrl ?? setupBom?.imageUrl ?? null,
    };
    tests[family.id] = {
      id: family.id,
      status: steps.filter((s) => s.name.startsWith(family.sku) && !s.ok).length ? 'FAIL' : 'PASS',
    };
  }

  mark('patch-replace', 'RUN');
  const foam = await findItem(admin.cookie, REPLACE_SKU);
  const original = foam.detail?.imageUrl ?? null;
  const onHandBefore = Number(
    foam.detail?.onHandQty ??
      foam.detail?.balances?.reduce((s, b) => s + Number(b.availableQty ?? 0), 0) ??
      NaN,
  );
  ok('foam original URL present', isHttpUrl(original), original ?? 'null');

  const denied = await request('PATCH', `/api/v1/inventory/items/${foam.item.id}`, {
    cookie: dealer.cookie,
    body: { imageUrl: TEMP_URL },
  });
  ok('dealer PATCH imageUrl is 403', denied.status === 403, String(denied.status));

  const replaced = await request('PATCH', `/api/v1/inventory/items/${foam.item.id}`, {
    cookie: admin.cookie,
    body: { imageUrl: TEMP_URL },
  });
  ok('admin PATCH replace 200', replaced.status === 200, String(replaced.status));
  const afterReplace = await findItem(admin.cookie, REPLACE_SKU);
  ok('detail shows replaced URL', afterReplace.detail?.imageUrl === TEMP_URL, afterReplace.detail?.imageUrl ?? '');

  const restored = await request('PATCH', `/api/v1/inventory/items/${foam.item.id}`, {
    cookie: admin.cookie,
    body: { imageUrl: original },
  });
  ok('admin PATCH restore 200', restored.status === 200, String(restored.status));
  const afterRestore = await findItem(admin.cookie, REPLACE_SKU);
  ok('foam URL restored', afterRestore.detail?.imageUrl === original, afterRestore.detail?.imageUrl ?? '');
  const onHandAfter = Number(
    afterRestore.detail?.onHandQty ??
      afterRestore.detail?.balances?.reduce((s, b) => s + Number(b.availableQty ?? 0), 0) ??
      NaN,
  );
  ok(
    'PATCH replace did not change on-hand qty',
    !Number.isFinite(onHandBefore) || onHandBefore === onHandAfter,
    `${onHandBefore} → ${onHandAfter}`,
  );

  mark('accessories', 'RUN');
  const accessory = await findItem(admin.cookie, ACCESSORY_SKU);
  ok(
    'accessory pipeline still has imageUrl',
    isHttpUrl(accessory.detail?.imageUrl),
    accessory.detail?.imageUrl ?? 'null',
  );
  mark('accessories', 'PASS');
  mark('patch-replace', steps.some((s) => s.name.startsWith('foam') && !s.ok) || steps.some((s) => s.name.includes('PATCH') && !s.ok) ? 'FAIL' : 'PASS');

  const failed = steps.filter((s) => !s.ok);
  const summary = {
    ok: failed.length === 0,
    passed: steps.filter((s) => s.ok).length,
    failed: failed.length,
    tests,
    steps,
    evidence,
  };
  writeFileSync(resolve(ROOT, 'tmp-raw-material-images-uat.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.passed}/${steps.length} PASS  → tmp-raw-material-images-uat.json`);
  if (failed.length) {
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
