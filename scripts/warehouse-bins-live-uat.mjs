/**
 * Live warehouse bin / shelf UAT against running API + maher_erp.
 *
 * Usage: pnpm smoke:warehouse-bins-uat
 * Prerequisite: API on :4000 and `pnpm demo:reset` (or a current demo DB).
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';
const THROW_PREFIX = 'MAT-BIN-UAT';
const BIN_CODE = 'UATA1';
const NOTES = 'Warehouse bins UAT throwaway';

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

async function requestPdf(path, cookie) {
  const res = await fetch(new URL(path, API), { headers: { Cookie: cookie } });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    isPdf: buf.slice(0, 5).toString() === '%PDF-',
    bytes: buf.length,
  };
}

function cookieHeader(setCookie) {
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

async function login(username, password = '123') {
  const res = await request('POST', '/api/v1/auth/login', { body: { username, password } });
  return { cookie: cookieHeader(res.setCookie), status: res.status, json: res.json };
}

function qtyOn(balances, locationId) {
  const row = (balances ?? []).find((b) => b.locationId === locationId);
  return Number(row?.availableQty ?? row?.onHandQty ?? 0);
}

async function itemDetail(cookie, id) {
  return request('GET', `/api/v1/inventory/items/${id}`, { cookie });
}

async function cleanupThrowaways() {
  const items = await prisma.inventoryItem.findMany({
    where: { sku: { startsWith: THROW_PREFIX } },
    select: { id: true },
  });
  const ids = items.map((row) => row.id);
  if (ids.length) {
    await prisma.inventoryCountLine.deleteMany({ where: { inventoryItemId: { in: ids } } });
    await prisma.warehouseTransferLine.deleteMany({ where: { inventoryItemId: { in: ids } } });
    await prisma.goodsReceiptLine.deleteMany({ where: { inventoryItemId: { in: ids } } });
    await prisma.inventoryTransaction.deleteMany({ where: { inventoryItemId: { in: ids } } });
    await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: { in: ids } } });
  }
  await prisma.inventoryCount.deleteMany({ where: { notes: { contains: NOTES } } });
  await prisma.warehouseTransfer.deleteMany({ where: { notes: NOTES } });
  if (ids.length) {
    await prisma.inventoryItem.deleteMany({ where: { id: { in: ids } } });
  }
  const extraBins = await prisma.warehouseLocation.findMany({
    where: { code: BIN_CODE },
    select: { id: true },
  });
  if (extraBins.length) {
    const binIds = extraBins.map((row) => row.id);
    await prisma.inventoryBalance.deleteMany({ where: { locationId: { in: binIds } } });
    await prisma.warehouseLocation.deleteMany({ where: { id: { in: binIds } } });
  }
}

function writeReport() {
  const failed = steps.filter((s) => !s.ok);
  const lines = [
    '# Warehouse bins live UAT',
    '',
    `Generated: ${new Date().toISOString()}`,
    `API: ${API}`,
    '',
    `**${steps.filter((s) => s.ok).length}/${steps.length} PASS**`,
    '',
    '| Step | Result | Detail |',
    '| --- | --- | --- |',
    ...steps.map((s) => `| ${s.name} | ${s.ok ? 'PASS' : 'FAIL'} | ${String(s.detail).replace(/\|/g, '/')} |`),
    '',
    '## Evidence',
    '',
    '```json',
    JSON.stringify(evidence, null, 2),
    '```',
    '',
  ];
  mkdirSync(resolve(ROOT, 'docs'), { recursive: true });
  writeFileSync(resolve(ROOT, 'docs/warehouse-bins-live-uat.md'), lines.join('\n'));
  writeFileSync(resolve(ROOT, 'tmp-warehouse-bins-uat.json'), JSON.stringify({
    ok: failed.length === 0,
    passed: steps.filter((s) => s.ok).length,
    failed: failed.length,
    tests,
    steps,
    evidence,
  }, null, 2));
  return failed;
}

async function main() {
  const admin = await login('admin');
  const warehouseUser = await login('warehouse');
  const sales = await login('sales1');
  const dealer = await login('nile');
  ok('admin login', (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie), String(admin.status));
  ok(
    'warehouse login',
    (warehouseUser.status === 200 || warehouseUser.status === 201) && Boolean(warehouseUser.cookie),
    String(warehouseUser.status),
  );
  ok('sales1 login', (sales.status === 200 || sales.status === 201) && Boolean(sales.cookie), String(sales.status));
  ok('dealer nile login', (dealer.status === 200 || dealer.status === 201) && Boolean(dealer.cookie), String(dealer.status));
  if (!admin.cookie) throw new Error('admin login failed');

  await cleanupThrowaways();

  mark('invariant', 'RUN');
  const nullBalances = await prisma.inventoryBalance.count({ where: { locationId: null } });
  const nullLots = await prisma.inventoryLot.count({ where: { locationId: null } });
  const nullTxs = await prisma.inventoryTransaction.count({ where: { locationId: null } });
  ok('zero null-location balances', nullBalances === 0, String(nullBalances));
  ok('zero null-location lots', nullLots === 0, String(nullLots));
  ok('zero null-location transactions', nullTxs === 0, String(nullTxs));

  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    include: { locations: true },
  });
  const missingDefault = warehouses.filter(
    (w) => w.locations.filter((l) => l.isDefault).length !== 1,
  );
  ok(
    'one default bin per warehouse',
    missingDefault.length === 0,
    missingDefault.map((w) => w.code).join(',') || 'ok',
  );
  const reservedNull = await prisma.inventoryBalance.count({
    where: { reservedQty: { gt: 0 }, locationId: null },
  });
  ok('reserved qty lives on bins', reservedNull === 0, String(reservedNull));

  mark('permissions', 'RUN');
  const dealerBins = await request('GET', '/api/v1/warehouses?pageSize=5', { cookie: dealer.cookie });
  ok('dealer cannot list warehouses', dealerBins.status === 403, String(dealerBins.status));
  const salesManage = await request('POST', '/api/v1/warehouses', {
    cookie: sales.cookie,
    body: { code: 'NOPE', nameEn: 'Nope', nameAr: 'لا', type: 'RAW_MATERIALS' },
  });
  ok('sales1 cannot create warehouses', salesManage.status === 403, String(salesManage.status));

  mark('receive-issue-transfer-count', 'RUN');
  const rawWh = warehouses.find((w) => w.type === 'RAW_MATERIALS' && w.code === 'RAW') ??
    warehouses.find((w) => w.type === 'RAW_MATERIALS');
  ok('RAW warehouse', Boolean(rawWh?.id), rawWh?.code ?? 'missing');
  const defaultBin = rawWh?.locations.find((l) => l.isDefault) ?? rawWh?.locations[0];
  ok('RAW default bin', Boolean(defaultBin?.id), defaultBin?.code ?? 'missing');

  const extra = await request('POST', `/api/v1/warehouses/${rawWh.id}/locations`, {
    cookie: admin.cookie,
    body: { code: BIN_CODE, name: 'UAT aisle' },
  });
  const extraBin = extra.json;
  ok(
    'create extra bin',
    (extra.status === 200 || extra.status === 201) && extraBin?.id,
    `${extra.status} ${JSON.stringify(extra.json?.message || extra.json?.code || extra.json).slice(0, 160)}`,
  );
  ok('extra bin has qrCode', Boolean(extraBin?.qrCode), String(extraBin?.qrCode));
  evidence.extraBin = { id: extraBin?.id, code: extraBin?.code, qrCode: extraBin?.qrCode };

  const sku = `${THROW_PREFIX}-${Date.now()}`;
  const created = await request('POST', '/api/v1/inventory/items', {
    cookie: admin.cookie,
    body: {
      sku,
      nameEn: 'Bin UAT throwaway',
      nameAr: 'اختبار رف',
      category: 'WOOD',
      unit: 'pcs',
      minStock: 0,
    },
  });
  const item = created.json;
  ok(
    'create throwaway item',
    (created.status === 200 || created.status === 201) && item?.id,
    String(created.status),
  );

  const receiveA = await request('POST', '/api/v1/inventory/receipts', {
    cookie: warehouseUser.cookie,
    body: {
      inventoryItemId: item.id,
      warehouseId: rawWh.id,
      locationId: extraBin.id,
      quantity: 8,
      notes: NOTES,
      idempotencyKey: `bin-uat-recv-a-${sku}`,
    },
  });
  ok('receive 8 into extra bin', receiveA.status === 200 || receiveA.status === 201, String(receiveA.status));

  const receiveB = await request('POST', '/api/v1/inventory/receipts', {
    cookie: warehouseUser.cookie,
    body: {
      inventoryItemId: item.id,
      warehouseId: rawWh.id,
      locationId: defaultBin.id,
      quantity: 5,
      notes: NOTES,
      idempotencyKey: `bin-uat-recv-b-${sku}`,
    },
  });
  ok('receive 5 into default bin', receiveB.status === 200 || receiveB.status === 201, String(receiveB.status));

  const afterRecv = await itemDetail(admin.cookie, item.id);
  const balancesAfterRecv = afterRecv.json?.balances ?? [];
  ok(
    'item detail shows both bins',
    qtyOn(balancesAfterRecv, extraBin.id) === 8 && qtyOn(balancesAfterRecv, defaultBin.id) === 5,
    JSON.stringify(balancesAfterRecv.map((b) => ({ loc: b.locationId, qty: b.availableQty ?? b.onHandQty }))),
  );

  const issue = await request('POST', '/api/v1/inventory/issues', {
    cookie: warehouseUser.cookie,
    body: {
      inventoryItemId: item.id,
      warehouseId: rawWh.id,
      locationId: extraBin.id,
      quantity: 2,
      notes: NOTES,
      idempotencyKey: `bin-uat-issue-${sku}`,
    },
  });
  ok('issue 2 from extra bin', issue.status === 200 || issue.status === 201, String(issue.status));
  const afterIssue = await itemDetail(admin.cookie, item.id);
  ok(
    'extra bin is 6 after named issue',
    qtyOn(afterIssue.json?.balances, extraBin.id) === 6,
    String(qtyOn(afterIssue.json?.balances, extraBin.id)),
  );
  ok(
    'default bin unchanged after named issue',
    qtyOn(afterIssue.json?.balances, defaultBin.id) === 5,
    String(qtyOn(afterIssue.json?.balances, defaultBin.id)),
  );

  const transfer = await request('POST', '/api/v1/inventory/transfers', {
    cookie: admin.cookie,
    body: {
      fromWarehouseId: rawWh.id,
      toWarehouseId: rawWh.id,
      notes: NOTES,
      lines: [
        {
          inventoryItemId: item.id,
          quantity: 1,
          fromLocationId: extraBin.id,
          toLocationId: defaultBin.id,
        },
      ],
    },
  });
  ok('create bin-to-bin transfer', transfer.status === 200 || transfer.status === 201, String(transfer.status));
  const completed = await request('POST', `/api/v1/inventory/transfers/${transfer.json?.id}/complete`, {
    cookie: admin.cookie,
  });
  ok('complete bin-to-bin transfer', completed.status === 200 || completed.status === 201, String(completed.status));
  const afterXfer = await itemDetail(admin.cookie, item.id);
  ok(
    'transfer moved 1 extra → default',
    qtyOn(afterXfer.json?.balances, extraBin.id) === 5 && qtyOn(afterXfer.json?.balances, defaultBin.id) === 6,
    JSON.stringify({
      extra: qtyOn(afterXfer.json?.balances, extraBin.id),
      main: qtyOn(afterXfer.json?.balances, defaultBin.id),
    }),
  );

  const count = await request('POST', '/api/v1/inventory/counts', {
    cookie: admin.cookie,
    body: {
      warehouseId: rawWh.id,
      notes: NOTES,
      lines: [{ inventoryItemId: item.id, countedQty: 5, locationId: extraBin.id }],
    },
  });
  ok('create per-bin count', count.status === 200 || count.status === 201, String(count.status));
  const countLine = count.json?.lines?.[0];
  ok(
    'count snapshots extra bin system qty',
    Number(countLine?.systemQty) === 5 && countLine?.locationId === extraBin.id,
    JSON.stringify({ systemQty: countLine?.systemQty, locationId: countLine?.locationId }),
  );
  const posted = await request('POST', `/api/v1/inventory/counts/${count.json?.id}/post`, {
    cookie: admin.cookie,
  });
  ok('post per-bin count', posted.status === 200 || posted.status === 201, String(posted.status));

  mark('pooled-pick-and-reserve', 'RUN');
  const pooled = await request('POST', '/api/v1/inventory/issues', {
    cookie: warehouseUser.cookie,
    body: {
      inventoryItemId: item.id,
      warehouseId: rawWh.id,
      quantity: 8,
      notes: NOTES,
      idempotencyKey: `bin-uat-pool-${sku}`,
    },
  });
  ok('unnamed issue draws across bins', pooled.status === 200 || pooled.status === 201, String(pooled.status));
  const afterPool = await itemDetail(admin.cookie, item.id);
  const extraAfterPool = qtyOn(afterPool.json?.balances, extraBin.id);
  const mainAfterPool = qtyOn(afterPool.json?.balances, defaultBin.id);
  ok(
    'pooled issue left 3 across both bins',
    extraAfterPool + mainAfterPool === 3,
    JSON.stringify({ extra: extraAfterPool, main: mainAfterPool }),
  );

  const reservedRows = await prisma.inventoryBalance.findMany({
    where: { reservedQty: { gt: 0 } },
    select: { locationId: true, warehouseId: true, reservedQty: true },
    take: 20,
  });
  ok(
    'demo reserved rows have bins',
    reservedRows.length === 0 || reservedRows.every((row) => Boolean(row.locationId)),
    `n=${reservedRows.length}`,
  );

  mark('qr-and-labels', 'RUN');
  const byQr = await request(
    'GET',
    `/api/v1/warehouses/locations/by-code/${encodeURIComponent(extraBin.qrCode)}`,
    { cookie: warehouseUser.cookie },
  );
  ok(
    'resolve bin by printed QR',
    (byQr.status === 200 || byQr.status === 201) && byQr.json?.id === extraBin.id,
    String(byQr.status),
  );
  const byPrefix = await request(
    'GET',
    `/api/v1/warehouses/locations/by-code/${encodeURIComponent(`BIN:${extraBin.id}`)}`,
    { cookie: warehouseUser.cookie },
  );
  ok(
    'resolve bin by BIN:uuid fallback',
    (byPrefix.status === 200 || byPrefix.status === 201) && byPrefix.json?.id === extraBin.id,
    String(byPrefix.status),
  );

  const label = await requestPdf(
    `/api/v1/warehouses/${rawWh.id}/locations/${extraBin.id}/qr-label?lang=en`,
    admin.cookie,
  );
  ok('single bin label is PDF', label.status === 200 && label.isPdf, `${label.status} ${label.bytes}b`);
  const sheet = await requestPdf(
    `/api/v1/warehouses/${rawWh.id}/locations/label-sheet?lang=en`,
    admin.cookie,
  );
  ok('bin label sheet is PDF', sheet.status === 200 && sheet.isPdf, `${sheet.status} ${sheet.bytes}b`);

  mark('recovery', 'RUN');
  const returnRow = await prisma.returnRequest.findFirst({
    where: {
      physicalStatus: 'RETURNED',
      pieces: { some: { decision: 'SCRAP_RECOVERY' } },
    },
    include: {
      pieces: { where: { decision: 'SCRAP_RECOVERY' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });
  const scrapPiece = returnRow?.pieces?.[0];
  if (returnRow && scrapPiece) {
    const record = await request(
      'POST',
      `/api/v1/returns/${returnRow.id}/pieces/${scrapPiece.id}/recovery-lines`,
      {
        cookie: admin.cookie,
        body: {
          label: 'Bin UAT recovery',
          quantity: 1,
          outcome: 'RECOVER_TO_INVENTORY',
          inventoryItemId: item.id,
          destinationWarehouseId: rawWh.id,
          destinationLocationId: extraBin.id,
        },
      },
    );
    ok(
      'record recovery into extra bin',
      record.status === 200 || record.status === 201,
      String(record.status),
    );
    const lineId = record.json?.id;
    const postedRecovery = lineId
      ? await request('POST', `/api/v1/returns/${returnRow.id}/recovery-lines/${lineId}/post`, {
          cookie: admin.cookie,
        })
      : { status: 0 };
    ok(
      'post recovery into extra bin',
      postedRecovery.status === 200 || postedRecovery.status === 201,
      String(postedRecovery.status),
    );
    if (postedRecovery.status === 200 || postedRecovery.status === 201) {
      const recoveryTx = await prisma.inventoryTransaction.findFirst({
        where: {
          inventoryItemId: item.id,
          locationId: extraBin.id,
          referenceType: 'ReturnRecoveryLine',
        },
        orderBy: { createdAt: 'desc' },
      });
      ok('recovery movement landed on extra bin', Boolean(recoveryTx), recoveryTx?.id ?? 'missing');
    }
  } else {
    const receiveReturn = await prisma.returnRequest.findFirst({
      where: { physicalStatus: 'WAITING_RETURN' },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (receiveReturn) {
      const recv = await request('POST', `/api/v1/returns/${receiveReturn.id}/receive`, {
        cookie: warehouseUser.cookie,
        body: { warehouseId: rawWh.id, receivedLocationId: extraBin.id },
      });
      ok(
        'returns receive accepts receivedLocationId',
        recv.status === 200 || recv.status === 201 || recv.status === 409,
        String(recv.status),
      );
    } else {
      ok('recovery path available in demo', false, 'no return rows to exercise');
    }
  }

  await cleanupThrowaways();
  const leftover = await prisma.inventoryItem.count({ where: { sku: { startsWith: THROW_PREFIX } } });
  ok('throwaway SKU cleaned up', leftover === 0, String(leftover));

  mark(
    'summary',
    steps.some((s) => !s.ok) ? 'FAIL' : 'PASS',
  );
  const failed = writeReport();
  console.log(`\n${steps.filter((s) => s.ok).length}/${steps.length} PASS  → docs/warehouse-bins-live-uat.md`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
    try {
      writeReport();
    } catch {
      /* ignore */
    }
  })
  .finally(async () => {
    try {
      await cleanupThrowaways();
    } catch (err) {
      console.error('cleanup failed', err);
    }
    await prisma.$disconnect();
  });
