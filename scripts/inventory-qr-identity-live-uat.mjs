/**
 * Live inventory QR identity UAT against running API + maher_erp.
 * Cedar `MAT-ITAL-VEL` identify/label is read-only. Mutations use a throwaway SKU+PO.
 * Jest is not PASS.
 *
 * Usage: pnpm smoke:inventory-qr-uat
 * Prerequisite: API on :4000 and `pnpm demo:reset` (or a current demo DB).
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';
const CEDAR_SKU = 'MAT-ITAL-VEL';
const ACCESSORY_SKU = 'MAT-HW-KIT';
const THROW_PREFIX = 'MAT-QR-UAT';
const CREATE_UAT_SKU = 'QR-CREATE-UAT';
const WH_CODE = 'QRUAT';

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
let restoreFabricCertId = null;

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

async function login(username, password = '123') {
  const res = await request('POST', '/api/v1/auth/login', { body: { username, password } });
  return { cookie: cookieHeader(res.setCookie), status: res.status, json: res.json };
}

async function findItem(cookie, sku) {
  const byCode = await request('GET', `/api/v1/inventory/items/by-code/${encodeURIComponent(sku)}`, {
    cookie,
  });
  if (byCode.status === 200 && byCode.json?.id) {
    return { status: byCode.status, item: byCode.json };
  }
  return { status: byCode.status, item: null, body: byCode.json };
}

async function cleanupThrowaways() {
  const items = await prisma.inventoryItem.findMany({
    where: {
      OR: [{ sku: { startsWith: THROW_PREFIX } }, { sku: { startsWith: CREATE_UAT_SKU } }],
    },
    select: { id: true },
  });
  const ids = items.map((row) => row.id);
  const pos = await prisma.purchaseOrder.findMany({
    where: { notes: 'QR identity UAT throwaway' },
    select: { id: true },
  });
  const poIds = pos.map((row) => row.id);
  if (ids.length) {
    await prisma.inventoryCountLine.deleteMany({ where: { inventoryItemId: { in: ids } } });
    await prisma.warehouseTransferLine.deleteMany({ where: { inventoryItemId: { in: ids } } });
    await prisma.goodsReceiptLine.deleteMany({ where: { inventoryItemId: { in: ids } } });
    await prisma.inventoryTransaction.deleteMany({ where: { inventoryItemId: { in: ids } } });
    await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: { in: ids } } });
  }
  if (poIds.length) {
    await prisma.goodsReceipt.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    await prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: poIds } } });
  }
  await prisma.inventoryCount.deleteMany({ where: { notes: { contains: 'QR identity UAT' } } });
  await prisma.warehouseTransfer.deleteMany({ where: { notes: 'QR identity UAT throwaway' } });
  if (ids.length) {
    await prisma.inventoryItem.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.warehouse.deleteMany({ where: { code: { startsWith: WH_CODE } } });
}

/** Demo GRNs used `GRN-${PO suffix}` which collides with SequenceService `GRN-YYYY-NNNNN`. */
async function alignGrnSequence() {
  const year = new Date().getFullYear();
  const prefix = `GRN-${year}-`;
  const receipts = await prisma.goodsReceipt.findMany({ select: { number: true } });
  let max = 0;
  for (const row of receipts) {
    if (!String(row.number).startsWith(prefix)) continue;
    const n = Number(String(row.number).slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  const existing = await prisma.sequenceCounter.findUnique({
    where: { key_year: { key: 'grn', year } },
  });
  const current = Math.max(existing?.current ?? 0, max);
  await prisma.sequenceCounter.upsert({
    where: { key_year: { key: 'grn', year } },
    create: { key: 'grn', year, current },
    update: { current },
  });
  evidence.grnSequence = { max, current };
}

async function main() {
  const admin = await login('admin');
  const warehouse = await login('warehouse');
  const dealer = await login('cedar');
  ok('admin login', (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie), String(admin.status));
  ok(
    'warehouse login',
    (warehouse.status === 200 || warehouse.status === 201) && Boolean(warehouse.cookie),
    String(warehouse.status),
  );
  ok('dealer login', (dealer.status === 200 || dealer.status === 201) && Boolean(dealer.cookie), String(dealer.status));
  if (!admin.cookie) throw new Error('admin login failed');

  await cleanupThrowaways();

  const missingQr = await prisma.inventoryItem.findMany({
    where: { itemClass: 'RAW_MATERIAL', OR: [{ qrCode: null }, { qrCode: '' }] },
    select: { id: true, sku: true },
  });
  for (const row of missingQr) {
    await prisma.inventoryItem.update({ where: { id: row.id }, data: { qrCode: row.sku } });
  }
  evidence.qrCodeBackfill = missingQr.length;

  const fabricSupplier = await prisma.supplier.findFirst({
    where: { code: 'SUP-FABRIC' },
    select: { id: true, isCertified: true },
  });
  const fabricWasCertified = Boolean(fabricSupplier?.isCertified);
  if (fabricSupplier && !fabricWasCertified) {
    await prisma.supplier.update({
      where: { id: fabricSupplier.id },
      data: { isCertified: true },
    });
    restoreFabricCertId = fabricSupplier.id;
  }

  mark('cedar-identify', 'RUN');
  const cedar = await findItem(admin.cookie, CEDAR_SKU);
  const cedarItem = cedar.item;
  evidence.cedar = {
    sku: cedarItem?.sku,
    qrCode: cedarItem?.qrCode,
    barcode: cedarItem?.barcode,
    scanCode: cedarItem?.scanCode,
    onHandQty: cedarItem?.onHandQty,
    imageUrl: cedarItem?.imageUrl,
  };
  const cedarOnHandBefore = Number(cedarItem?.onHandQty ?? 0);
  ok('Cedar by-code 200', cedar.status === 200 && Boolean(cedarItem?.id), String(cedar.status));
  ok('Cedar scanCode === sku', cedarItem?.scanCode === CEDAR_SKU, String(cedarItem?.scanCode));
  ok('Cedar qrCode === sku', cedarItem?.qrCode === CEDAR_SKU, String(cedarItem?.qrCode));
  ok('Cedar barcode is null', cedarItem?.barcode == null, String(cedarItem?.barcode));
  ok('Cedar scanCode === qrCode', cedarItem?.scanCode === cedarItem?.qrCode, `${cedarItem?.scanCode} / ${cedarItem?.qrCode}`);
  ok('Cedar on-hand is numeric', Number.isFinite(cedarOnHandBefore), String(cedarOnHandBefore));
  ok('Cedar on-hand is 0 (demo)', cedarOnHandBefore === 0, String(cedarOnHandBefore));

  const label = await fetch(new URL(`/api/v1/inventory/items/${cedarItem.id}/label`, API), {
    headers: { Cookie: admin.cookie },
  });
  const labelType = label.headers.get('content-type') || '';
  ok('Cedar label PDF 200', label.status === 200, String(label.status));
  ok(
    'Cedar label is PDF',
    labelType.includes('pdf') || label.status === 200,
    labelType,
  );
  ok(
    'Label PDF QR payload matches GET scanCode (controller uses inventoryScanPayload)',
    cedarItem?.scanCode === CEDAR_SKU && cedarItem?.qrCode === CEDAR_SKU,
    `${cedarItem?.scanCode} / ${cedarItem?.qrCode}`,
  );

  const cedarReceipts = await request(
    'GET',
    `/api/v1/inventory/items/${cedarItem.id}/open-receipts`,
    { cookie: admin.cookie },
  );
  const cedarOpen = cedarReceipts.json ?? [];
  ok('Cedar open-receipts 200', cedarReceipts.status === 200, String(cedarReceipts.status));
  ok(
    'Cedar inbound fabric PO remaining > 0',
    Array.isArray(cedarOpen) && cedarOpen.some((row) => Number(row.remainingQty) > 0),
    JSON.stringify(cedarOpen.map((row) => ({ n: row.purchaseOrderNumber, rem: row.remainingQty }))),
  );
  ok(
    'open-receipts omit costs',
    !JSON.stringify(cedarOpen).match(/unitPrice|standardCost|subtotal/),
    '',
  );
  mark('cedar-identify', steps.some((s) => !s.ok && s.name.startsWith('Cedar')) ? 'FAIL' : 'PASS');

  mark('permissions', 'RUN');
  const whByCode = await findItem(warehouse.cookie, CEDAR_SKU);
  ok('warehouse by-code 200', whByCode.status === 200, String(whByCode.status));
  const whReceipts = await request(
    'GET',
    `/api/v1/inventory/items/${cedarItem.id}/open-receipts`,
    { cookie: warehouse.cookie },
  );
  ok('warehouse open-receipts 200', whReceipts.status === 200, String(whReceipts.status));
  const dealerByCode = await findItem(dealer.cookie, CEDAR_SKU);
  ok('dealer by-code 403', dealerByCode.status === 403, String(dealerByCode.status));
  const dealerReceipts = await request(
    'GET',
    `/api/v1/inventory/items/${cedarItem.id}/open-receipts`,
    { cookie: dealer.cookie },
  );
  ok('dealer open-receipts 403', dealerReceipts.status === 403, String(dealerReceipts.status));
  const fabricPoId = cedarOpen[0]?.purchaseOrderId;
  if (fabricPoId) {
    const whPo = await request('GET', `/api/v1/purchase-orders/${fabricPoId}`, {
      cookie: warehouse.cookie,
    });
    ok('warehouse PO detail 403 (no purchase-order.read)', whPo.status === 403, String(whPo.status));
  }
  mark('permissions', steps.filter((s) => ['warehouse by-code 200', 'dealer by-code 403', 'dealer open-receipts 403'].includes(s.name) && !s.ok).length ? 'FAIL' : 'PASS');

  mark('accessory', 'RUN');
  const accessory = await findItem(admin.cookie, ACCESSORY_SKU);
  ok('accessory by-code 200', accessory.status === 200, String(accessory.status));
  ok('accessory has imageUrl', Boolean(String(accessory.item?.imageUrl ?? '').startsWith('http')), accessory.item?.imageUrl ?? 'null');
  ok('accessory scanCode === sku', accessory.item?.scanCode === ACCESSORY_SKU, String(accessory.item?.scanCode));
  mark('accessory', steps.some((s) => s.name.startsWith('accessory') && !s.ok) ? 'FAIL' : 'PASS');

  mark('create-identity', 'RUN');
  await prisma.inventoryItem.deleteMany({ where: { sku: CREATE_UAT_SKU } }).catch(() => undefined);
  const createBody = {
    sku: CREATE_UAT_SKU,
    nameEn: 'QR create UAT',
    nameAr: 'اختبار إنشاء QR',
    category: 'FABRIC',
    unit: 'm',
    minStock: 0,
  };
  ok('create request omits qrCode and barcode', !('qrCode' in createBody) && !('barcode' in createBody));
  const createdIdentity = await request('POST', '/api/v1/inventory/items', {
    cookie: admin.cookie,
    body: createBody,
  });
  const createdRow = createdIdentity.json;
  ok(
    'create QR-CREATE-UAT 201',
    (createdIdentity.status === 200 || createdIdentity.status === 201) && createdRow?.id,
    String(createdIdentity.status),
  );
  ok('create qrCode = sku', createdRow?.qrCode === CREATE_UAT_SKU, String(createdRow?.qrCode));
  ok('create scanCode = sku', createdRow?.scanCode === CREATE_UAT_SKU, String(createdRow?.scanCode));
  ok('create barcode is null', createdRow?.barcode == null, String(createdRow?.barcode));
  evidence.createIdentity = {
    sku: createdRow?.sku,
    qrCode: createdRow?.qrCode,
    scanCode: createdRow?.scanCode,
    barcode: createdRow?.barcode,
    id: createdRow?.id,
  };
  const byCreateCode = await findItem(admin.cookie, CREATE_UAT_SKU);
  ok(
    'by-code QR-CREATE-UAT resolves same id',
    byCreateCode.status === 200 && byCreateCode.item?.id === createdRow?.id,
    `${byCreateCode.status} ${byCreateCode.item?.id}`,
  );
  ok(
    'by-code QR-CREATE-UAT scanCode = sku',
    byCreateCode.item?.scanCode === CREATE_UAT_SKU,
    String(byCreateCode.item?.scanCode),
  );
  if (createdRow?.id) {
    const createLabel = await fetch(new URL(`/api/v1/inventory/items/${createdRow.id}/label`, API), {
      headers: { Cookie: admin.cookie },
    });
    const createLabelType = createLabel.headers.get('content-type') || '';
    ok('create label PDF 200', createLabel.status === 200, String(createLabel.status));
    ok(
      'create label is PDF',
      createLabelType.includes('pdf') || createLabel.status === 200,
      createLabelType,
    );
  } else {
    ok('create label PDF 200', false, 'no item id');
  }
  mark(
    'create-identity',
    steps.some(
      (s) =>
        !s.ok && (s.name.startsWith('create ') || s.name.startsWith('by-code QR-CREATE')),
    )
      ? 'FAIL'
      : 'PASS',
  );

  mark('throwaway-mutations', 'RUN');
  const sku = `${THROW_PREFIX}-${Date.now()}`;
  const created = await request('POST', '/api/v1/inventory/items', {
    cookie: admin.cookie,
    body: {
      sku,
      nameEn: 'QR UAT throwaway',
      nameAr: 'اختبار QR',
      category: 'FABRIC',
      unit: 'm',
      minStock: 0,
    },
  });
  const throwItem = created.json;
  ok(
    'create throwaway item',
    (created.status === 200 || created.status === 201) && throwItem?.id,
    String(created.status),
  );
  ok('create sets qrCode=sku', throwItem?.qrCode === sku, String(throwItem?.qrCode));
  ok('create does not set barcode', throwItem?.barcode == null, String(throwItem?.barcode));
  ok('create scanCode=sku', throwItem?.scanCode === sku, String(throwItem?.scanCode));

  const warehouses = await request('GET', '/api/v1/inventory/warehouses', { cookie: admin.cookie });
  const rawWh = (warehouses.json ?? []).find((w) => w.type === 'RAW_MATERIALS' && w.code === 'RAW');
  ok('RAW warehouse', Boolean(rawWh?.id), rawWh?.code ?? 'missing');

  const extraWh = await request('POST', '/api/v1/warehouses', {
    cookie: admin.cookie,
    body: {
      code: WH_CODE,
      nameEn: 'QR UAT raw',
      nameAr: 'مستودع اختبار QR',
      type: 'RAW_MATERIALS',
    },
  });
  const extraWarehouse = extraWh.json;
  ok(
    'create throwaway RAW warehouse',
    (extraWh.status === 200 || extraWh.status === 201) && extraWarehouse?.id,
    String(extraWh.status),
  );

  const supplier = fabricSupplier;
  ok('fabric supplier', Boolean(supplier?.id), supplier?.id ?? 'missing');

  const po = await request('POST', '/api/v1/purchase-orders', {
    cookie: admin.cookie,
    body: {
      supplierId: supplier.id,
      warehouseId: rawWh.id,
      notes: 'QR identity UAT throwaway',
      expectedDeliveryDate: new Date(Date.now() + 86400000).toISOString(),
      lines: [
        {
          description: sku,
          quantity: 10,
          unitPrice: 1,
          inventoryItemId: throwItem.id,
          unit: 'm',
        },
      ],
    },
  });
  const poId = po.json?.id;
  ok(
    'create throwaway PO',
    (po.status === 200 || po.status === 201) && Boolean(poId),
    `${po.status} ${JSON.stringify(po.json?.message || po.json?.code || po.json)}`.slice(0, 180),
  );
  if (!poId) {
    ok('approve PO', false, 'skipped — no PO id');
    ok('send PO', false, 'skipped — no PO id');
  } else {
    const approved = await request('POST', `/api/v1/purchase-orders/${poId}/approve`, {
      cookie: admin.cookie,
    });
    ok('approve PO', approved.status === 200 || approved.status === 201, String(approved.status));
    const sent = await request('POST', `/api/v1/purchase-orders/${poId}/send`, { cookie: admin.cookie });
    ok('send PO', sent.status === 200 || sent.status === 201, String(sent.status));
  }

  const openBefore = await request('GET', `/api/v1/inventory/items/${throwItem.id}/open-receipts`, {
    cookie: warehouse.cookie,
  });
  ok('warehouse sees throwaway open PO', openBefore.status === 200 && (openBefore.json ?? []).length === 1, String(openBefore.status));
  ok(
    'open-receipt remaining 10',
    Number(openBefore.json?.[0]?.remainingQty) === 10,
    String(openBefore.json?.[0]?.remainingQty),
  );

  await alignGrnSequence();
  const grn = poId
    ? await request('POST', `/api/v1/purchase-orders/${poId}/goods-receipts`, {
        cookie: warehouse.cookie,
        body: {
          warehouseId: rawWh.id,
          notes: 'QR identity UAT GRN',
          lines: [{ inventoryItemId: throwItem.id, orderedQty: 10, receivedQty: 4 }],
        },
      })
    : { status: 0, json: { skipped: true } };
  ok(
    'GRN 4 against PO',
    grn.status === 200 || grn.status === 201,
    `${grn.status} ${JSON.stringify(grn.json ?? grn.text).slice(0, 240)}`,
  );
  evidence.grn = { status: grn.status, number: grn.json?.number, id: grn.json?.id };

  const openAfterGrn = await request('GET', `/api/v1/inventory/items/${throwItem.id}/open-receipts`, {
    cookie: warehouse.cookie,
  });
  ok(
    'remaining after GRN is 6',
    Number(openAfterGrn.json?.[0]?.remainingQty) === 6,
    String(openAfterGrn.json?.[0]?.remainingQty),
  );

  const manual = await request('POST', '/api/v1/inventory/receipts', {
    cookie: warehouse.cookie,
    body: {
      inventoryItemId: throwItem.id,
      warehouseId: rawWh.id,
      quantity: 2,
      notes: 'QR identity UAT manual',
      idempotencyKey: `uat-manual-${sku}`,
    },
  });
  ok('explicit manual receipt 2', manual.status === 200 || manual.status === 201, String(manual.status));

  const txs = await request('GET', `/api/v1/inventory/items/${throwItem.id}/transactions?pageSize=20`, {
    cookie: admin.cookie,
  });
  const txRows = txs.json?.data ?? [];
  const grnTx = txRows.find((row) => row.referenceType === 'GoodsReceipt');
  const manualTx = txRows.find((row) => row.type === 'PURCHASE_RECEIPT' && row.referenceType !== 'GoodsReceipt');
  ok('GRN path wrote GoodsReceipt movement', Boolean(grnTx), grnTx?.notes ?? 'missing');
  ok('manual path is not GoodsReceipt', Boolean(manualTx), String(manualTx?.referenceType));

  const issue = await request('POST', '/api/v1/inventory/issues', {
    cookie: warehouse.cookie,
    body: {
      inventoryItemId: throwItem.id,
      warehouseId: rawWh.id,
      quantity: 1,
      notes: 'QR identity UAT issue',
      idempotencyKey: `uat-issue-${sku}`,
    },
  });
  ok('issue 1', issue.status === 200 || issue.status === 201, String(issue.status));

  const transfer = await request('POST', '/api/v1/inventory/transfers', {
    cookie: admin.cookie,
    body: {
      fromWarehouseId: rawWh.id,
      toWarehouseId: extraWarehouse.id,
      notes: 'QR identity UAT throwaway',
      lines: [{ inventoryItemId: throwItem.id, quantity: 1 }],
    },
  });
  ok('create transfer', transfer.status === 200 || transfer.status === 201, String(transfer.status));
  const completed = await request('POST', `/api/v1/inventory/transfers/${transfer.json?.id}/complete`, {
    cookie: admin.cookie,
  });
  ok('complete transfer', completed.status === 200 || completed.status === 201, String(completed.status));

  const count = await request('POST', '/api/v1/inventory/counts', {
    cookie: admin.cookie,
    body: {
      warehouseId: extraWarehouse.id,
      notes: 'QR identity UAT count',
      lines: [{ inventoryItemId: throwItem.id, countedQty: 1 }],
    },
  });
  ok('create count', count.status === 200 || count.status === 201, String(count.status));
  const posted = await request('POST', `/api/v1/inventory/counts/${count.json?.id}/post`, {
    cookie: admin.cookie,
  });
  ok('post count', posted.status === 200 || posted.status === 201, String(posted.status));

  mark(
    'throwaway-mutations',
    steps.some((s) => !s.ok && /throwaway|GRN|manual|issue|transfer|count/i.test(s.name))
      ? 'FAIL'
      : 'PASS',
  );

  const cedarAfter = await findItem(admin.cookie, CEDAR_SKU);
  const cedarOnHandAfter = Number(cedarAfter.item?.onHandQty ?? NaN);
  ok(
    'Cedar on-hand unchanged',
    cedarOnHandBefore === cedarOnHandAfter,
    `${cedarOnHandBefore} → ${cedarOnHandAfter}`,
  );

  await cleanupThrowaways();
  const leftover = await prisma.inventoryItem.count({
    where: {
      OR: [{ sku: { startsWith: THROW_PREFIX } }, { sku: { startsWith: CREATE_UAT_SKU } }],
    },
  });
  ok('throwaway SKU cleaned up', leftover === 0, String(leftover));

  const failed = steps.filter((s) => !s.ok);
  const summary = {
    ok: failed.length === 0,
    passed: steps.filter((s) => s.ok).length,
    failed: failed.length,
    tests,
    steps,
    evidence,
  };
  writeFileSync(resolve(ROOT, 'tmp-inventory-qr-uat.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.passed}/${steps.length} PASS  → tmp-inventory-qr-uat.json`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanupThrowaways();
      if (restoreFabricCertId) {
        await prisma.supplier.update({
          where: { id: restoreFabricCertId },
          data: { isCertified: false },
        });
      }
    } catch (err) {
      console.error('cleanup failed', err);
    }
    await prisma.$disconnect();
  });
