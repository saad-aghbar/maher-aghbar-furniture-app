/**
 * Purchasing overhaul live UAT — one order through WhatsApp, multi-warehouse
 * receive, fabric lot, supplier invoice, low-stock draft POs, and dealer deny.
 *
 * Usage: pnpm smoke:purchasing-overhaul-uat
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

async function ensureWarehouse(code, nameEn) {
  const existing = await prisma.warehouse.findFirst({
    where: { code, type: 'RAW_MATERIALS' },
  });
  if (existing) return existing;
  return prisma.warehouse.create({
    data: {
      code,
      nameEn,
      nameAr: nameEn,
      type: 'RAW_MATERIALS',
      isActive: true,
      isDefault: false,
    },
  });
}

async function ensureLocation(warehouseId, code) {
  const existing = await prisma.warehouseLocation.findFirst({
    where: { warehouseId, code },
  });
  if (existing) return existing;
  return prisma.warehouseLocation.create({
    data: { warehouseId, code, name: code },
  });
}

async function ensureItem({ sku, nameEn, category, supplierId }) {
  const existing = await prisma.inventoryItem.findFirst({ where: { sku } });
  if (existing) {
    return prisma.inventoryItem.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        isPurchasable: true,
        itemClass: 'RAW_MATERIAL',
        category,
        preferredSupplierId: supplierId,
        archivedAt: null,
      },
    });
  }
  return prisma.inventoryItem.create({
    data: {
      sku,
      nameEn,
      nameAr: nameEn,
      unit: category === 'FABRIC' ? 'm' : 'pcs',
      category,
      itemClass: 'RAW_MATERIAL',
      isActive: true,
      isPurchasable: true,
      minStock: 2,
      reorderQty: 4,
      standardCost: 10,
      preferredSupplierId: supplierId,
    },
  });
}

async function main() {
  const stamp = Date.now().toString().slice(-6);
  console.log(`Purchasing overhaul UAT → ${API}\n`);

  const admin = await login('admin');
  ok('1. admin login', (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie));

  const supplier =
    (await prisma.supplier.findFirst({
      where: { archivedAt: null, isCertified: true, status: 'ACTIVE' },
    })) ??
    (await prisma.supplier.create({
      data: {
        code: `SUP-POH-${stamp}`,
        name: 'Overhaul Supplier',
        nameEn: 'Overhaul Supplier',
        nameAr: 'مورد التحديث',
        isCertified: true,
        status: 'ACTIVE',
        phone: '+962790000001',
        whatsappPhone: '+962790000001',
      },
    }));

  const whA = await ensureWarehouse('RAW', 'Raw materials');
  const whB = await ensureWarehouse('RAW-B', 'Raw overflow');
  const hold = await ensureLocation(whA.id, `HOLD-POH-${stamp}`);
  const woodA = await ensureItem({
    sku: `POH-WOOD-A-${stamp}`,
    nameEn: 'Overhaul oak',
    category: 'WOOD',
    supplierId: supplier.id,
  });
  const woodB = await ensureItem({
    sku: `POH-WOOD-B-${stamp}`,
    nameEn: 'Overhaul pine',
    category: 'WOOD',
    supplierId: supplier.id,
  });
  const fabric = await ensureItem({
    sku: `POH-FAB-${stamp}`,
    nameEn: 'Overhaul velvet',
    category: 'FABRIC',
    supplierId: supplier.id,
  });

  const created = await request('POST', '/api/v1/purchase-orders', {
    cookie: admin.cookie,
    body: {
      supplierId: supplier.id,
      warehouseId: whA.id,
      origin: 'MANUAL',
      notes: `smoke-poh-${stamp}`,
      lines: [
        {
          description: woodA.nameEn,
          quantity: 10,
          unitPrice: 12,
          inventoryItemId: woodA.id,
          unit: woodA.unit,
          warehouseId: whA.id,
        },
        {
          description: woodB.nameEn,
          quantity: 8,
          unitPrice: 9,
          inventoryItemId: woodB.id,
          unit: woodB.unit,
          warehouseId: whB.id,
        },
        {
          description: fabric.nameEn,
          quantity: 6,
          unitPrice: 15,
          inventoryItemId: fabric.id,
          unit: fabric.unit,
          warehouseId: whA.id,
          locationId: hold.id,
        },
      ],
    },
  });
  const poId = created.json?.id;
  ok(
    '2. create multi-warehouse + fabric PO',
    created.status < 400 && Boolean(poId) && (created.json?.lines?.length ?? 0) === 3,
    `status=${created.status} id=${poId} lines=${created.json?.lines?.length}`,
  );

  const approve = await request('POST', `/api/v1/purchase-orders/${poId}/approve`, {
    cookie: admin.cookie,
  });
  ok('3. approve draft', approve.status < 400, `status=${approve.status}`);

  const draft = await request('POST', `/api/v1/purchase-orders/${poId}/whatsapp-draft`, {
    cookie: admin.cookie,
  });
  ok(
    '4. whatsapp-draft returns body',
    draft.status < 400 && Boolean(draft.json?.body),
    `status=${draft.status}`,
  );

  const editedBody = `SMOKE-POH-EDIT-${stamp}\n${draft.json?.body ?? ''}`;
  const sent = await request('POST', `/api/v1/purchase-orders/${poId}/send`, {
    cookie: admin.cookie,
    body: { body: editedBody },
  });
  const persisted = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  ok(
    '5. send persists edited WhatsApp body',
    sent.status < 400 && persisted?.whatsappLastBody === editedBody,
    `status=${sent.status} stored=${Boolean(persisted?.whatsappLastBody === editedBody)}`,
  );

  const receivable = await request('GET', '/api/v1/purchase-orders/receivable', {
    cookie: admin.cookie,
  });
  const inQueue = Array.isArray(receivable.json)
    ? receivable.json.some((row) => row.id === poId)
    : false;
  ok('6. receivable queue includes the order', receivable.status === 200 && inQueue, `status=${receivable.status}`);

  const partial = await request('POST', `/api/v1/purchase-orders/${poId}/goods-receipts`, {
    cookie: admin.cookie,
    body: {
      warehouseId: whA.id,
      idempotencyKey: `poh-partial-${stamp}`,
      lines: [
        {
          inventoryItemId: woodA.id,
          orderedQty: 10,
          receivedQty: 4,
          unitCost: 12,
          warehouseId: whA.id,
        },
        {
          inventoryItemId: woodB.id,
          orderedQty: 8,
          receivedQty: 3,
          unitCost: 9,
          warehouseId: whB.id,
        },
        {
          inventoryItemId: fabric.id,
          orderedQty: 6,
          receivedQty: 2,
          unitCost: 15,
          warehouseId: whA.id,
          locationId: hold.id,
        },
      ],
    },
  });
  const receipts = partial.json?.receipts ?? (partial.json?.id ? [partial.json] : []);
  const poAfterPartial = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { goodsReceipts: { include: { lines: true } } },
  });
  const balA = await prisma.inventoryBalance.findFirst({
    where: { inventoryItemId: woodA.id, warehouseId: whA.id },
  });
  const balB = await prisma.inventoryBalance.findFirst({
    where: { inventoryItemId: woodB.id, warehouseId: whB.id },
  });
  const txs = await prisma.inventoryTransaction.count({
    where: {
      type: 'PURCHASE_RECEIPT',
      referenceType: 'GoodsReceipt',
      referenceId: { in: (poAfterPartial?.goodsReceipts ?? []).map((g) => g.id) },
    },
  });
  const fabricLot = await prisma.inventoryLot.findFirst({
    where: {
      inventoryItemId: fabric.id,
      allocationMode: 'GENERAL_STOCK',
    },
  });
  ok(
    '7. partial receive splits two GRNs and balances',
    partial.status < 400 &&
      (receipts.length >= 2 || (poAfterPartial?.goodsReceipts?.length ?? 0) >= 2) &&
      Number(balA?.availableQty ?? 0) >= 4 &&
      Number(balB?.availableQty ?? 0) >= 3 &&
      txs >= 2 &&
      Boolean(fabricLot) &&
      poAfterPartial?.status === 'PARTIALLY_RECEIVED',
    `status=${partial.status} grns=${poAfterPartial?.goodsReceipts?.length} txs=${txs} lot=${fabricLot?.id} po=${poAfterPartial?.status}`,
  );

  const finish = await request('POST', `/api/v1/purchase-orders/${poId}/goods-receipts`, {
    cookie: admin.cookie,
    body: {
      warehouseId: whA.id,
      idempotencyKey: `poh-finish-${stamp}`,
      lines: [
        {
          inventoryItemId: woodA.id,
          orderedQty: 10,
          receivedQty: 6,
          unitCost: 12,
          warehouseId: whA.id,
        },
        {
          inventoryItemId: woodB.id,
          orderedQty: 8,
          receivedQty: 5,
          unitCost: 9,
          warehouseId: whB.id,
        },
        {
          inventoryItemId: fabric.id,
          orderedQty: 6,
          receivedQty: 4,
          unitCost: 15,
          warehouseId: whA.id,
          locationId: hold.id,
        },
      ],
    },
  });
  const poDone = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  const invoices = await prisma.supplierInvoice.count({ where: { purchaseOrderId: poId } });
  ok(
    '8. finish receive to RECEIVED with one supplier invoice',
    finish.status < 400 && poDone?.status === 'RECEIVED' && invoices === 1,
    `status=${finish.status} po=${poDone?.status} invoices=${invoices}`,
  );

  const lowItem = await ensureItem({
    sku: `POH-LOW-${stamp}`,
    nameEn: 'Overhaul low stock',
    category: 'WOOD',
    supplierId: supplier.id,
  });
  await prisma.inventoryItem.update({
    where: { id: lowItem.id },
    data: { minStock: 20, reorderQty: 7, isPurchasable: true, isActive: true },
  });
  const lowWh = await prisma.inventoryBalance.findFirst({
    where: { inventoryItemId: lowItem.id, warehouseId: whA.id },
  });
  if (lowWh) {
    await prisma.inventoryBalance.update({
      where: { id: lowWh.id },
      data: { availableQty: 0, reservedQty: 0 },
    });
  } else {
    await prisma.inventoryBalance.create({
      data: {
        inventoryItemId: lowItem.id,
        warehouseId: whA.id,
        availableQty: 0,
        reservedQty: 0,
      },
    });
  }

  const lowDraft = await request('GET', '/api/v1/purchase-orders/low-stock-draft', {
    cookie: admin.cookie,
  });
  const groups = [
    ...(lowDraft.json?.groups ?? []),
    lowDraft.json?.unassigned,
  ].filter(Boolean);
  const lowRow = groups
    .flatMap((g) => (g.items ?? []).map((item) => ({ ...item, supplierId: g.supplierId })))
    .find((item) => item.id === lowItem.id);
  ok(
    '9. low-stock-draft includes the starved item',
    lowDraft.status === 200 && Boolean(lowRow),
    `status=${lowDraft.status} found=${Boolean(lowRow)}`,
  );

  const batch = await request('POST', '/api/v1/purchase-orders/batch', {
    cookie: admin.cookie,
    body: {
      orders: [
        {
          supplierId: supplier.id,
          origin: 'LOW_STOCK',
          warehouseId: whA.id,
          lines: [
            {
              description: lowItem.nameEn,
              quantity: Number(lowRow?.suggestedQty ?? 7),
              unitPrice: 10,
              inventoryItemId: lowItem.id,
              unit: lowItem.unit,
              warehouseId: whA.id,
            },
          ],
        },
      ],
    },
  });
  const batchOrder = batch.json?.orders?.[0];
  const batchRow = batchOrder?.id
    ? await prisma.purchaseOrder.findUnique({ where: { id: batchOrder.id } })
    : null;
  ok(
    '10. batch create origin LOW_STOCK',
    batch.status < 400 && batchRow?.origin === 'LOW_STOCK',
    `status=${batch.status} origin=${batchRow?.origin}`,
  );

  const sendBatch = await request('POST', '/api/v1/purchase-orders/send-batch', {
    cookie: admin.cookie,
    body: { orders: [{ id: batchOrder?.id, body: `LOW-STOCK-${stamp}` }] },
  });
  ok(
    '11. send-batch reports the low-stock order',
    sendBatch.status < 400 &&
      (sendBatch.json?.results ?? []).some((row) => row.id === batchOrder?.id),
    `status=${sendBatch.status}`,
  );

  const supplierB =
    (await prisma.supplier.findFirst({
      where: { archivedAt: null, isCertified: true, status: 'ACTIVE', id: { not: supplier.id } },
    })) ??
    (await prisma.supplier.create({
      data: {
        code: `SUP-POH-B-${stamp}`,
        name: 'Overhaul Supplier B',
        nameEn: 'Overhaul Supplier B',
        nameAr: 'مورد التحديث ب',
        isCertified: true,
        status: 'ACTIVE',
        phone: '+962790000002',
        whatsappPhone: '+962790000002',
      },
    }));
  const woodC = await ensureItem({
    sku: `POH-WOOD-C-${stamp}`,
    nameEn: 'Overhaul teak',
    category: 'WOOD',
    supplierId: supplierB.id,
  });
  const runCreated = await request('POST', '/api/v1/purchase-runs', {
    cookie: admin.cookie,
    body: {
      origin: 'MANUAL',
      notes: `smoke-run-${stamp}`,
      orders: [
        {
          supplierId: supplier.id,
          warehouseId: whA.id,
          origin: 'MANUAL',
          lines: [
            {
              description: woodA.nameEn,
              quantity: 2,
              unitPrice: 12,
              inventoryItemId: woodA.id,
              unit: woodA.unit,
              warehouseId: whA.id,
            },
          ],
        },
        {
          supplierId: supplierB.id,
          warehouseId: whA.id,
          origin: 'MANUAL',
          lines: [
            {
              description: woodC.nameEn,
              quantity: 3,
              unitPrice: 11,
              inventoryItemId: woodC.id,
              unit: woodC.unit,
              warehouseId: whA.id,
            },
          ],
        },
      ],
    },
  });
  const runId = runCreated.json?.id;
  ok(
    '14. create two-supplier purchase run',
    runCreated.status < 400 && Boolean(runId) && (runCreated.json?.orders?.length ?? 0) === 2,
    `status=${runCreated.status} id=${runId} orders=${runCreated.json?.orders?.length}`,
  );

  const runApprove = await request('POST', `/api/v1/purchase-runs/${runId}/approve`, {
    cookie: admin.cookie,
  });
  ok('15. approve purchase run', runApprove.status < 400, `status=${runApprove.status}`);

  const runDraft = await request('POST', `/api/v1/purchase-runs/${runId}/whatsapp-drafts`, {
    cookie: admin.cookie,
  });
  ok(
    '16. run whatsapp drafts',
    runDraft.status < 400 && (runDraft.json?.messages?.length ?? 0) >= 2,
    `status=${runDraft.status} messages=${runDraft.json?.messages?.length}`,
  );

  const runSend = await request('POST', `/api/v1/purchase-runs/${runId}/send`, {
    cookie: admin.cookie,
    body: {
      orders: (runDraft.json?.messages ?? []).map((m) => ({ id: m.orderId, body: m.body })),
    },
  });
  const runAfterSend = await request('GET', `/api/v1/purchase-runs/${runId}`, {
    cookie: admin.cookie,
  });
  const runOrders = runAfterSend.json?.orders ?? [];
  ok(
    '17. send purchase run marks both POs SENT',
    runSend.status < 400 && runOrders.every((po) => po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED' || po.status === 'RECEIVED'),
    `status=${runSend.status} phases=${runOrders.map((po) => po.status).join(',')}`,
  );

  const runReceive = await request('POST', `/api/v1/purchase-orders/${runOrders[0]?.id}/goods-receipts`, {
    cookie: admin.cookie,
    body: {
      warehouseId: whA.id,
      idempotencyKey: `poh-run-${stamp}`,
      notes: `run-receive-${stamp}`,
      lines: [
        {
          inventoryItemId: runOrders[0]?.lines?.[0]?.inventoryItemId ?? woodA.id,
          orderedQty: 2,
          receivedQty: 2,
          unitCost: 12,
          warehouseId: whA.id,
        },
      ],
    },
  });
  ok(
    '18. receive first run PO after send',
    runReceive.status < 400,
    `status=${runReceive.status}`,
  );

  const buyAlert = await request('GET', '/api/v1/purchase-orders/buy-alert', {
    cookie: admin.cookie,
  });
  ok(
    '19. buy-alert returns counts',
    buyAlert.status === 200 && typeof buyAlert.json?.count === 'number',
    `status=${buyAlert.status} count=${buyAlert.json?.count}`,
  );

  const dealer = await login('oasis');
  const denied = [];
  for (const [label, method, path, body] of [
    ['low-stock-draft', 'GET', '/api/v1/purchase-orders/low-stock-draft'],
    ['receivable', 'GET', '/api/v1/purchase-orders/receivable'],
    ['batch', 'POST', '/api/v1/purchase-orders/batch', { orders: [] }],
    ['send-batch', 'POST', '/api/v1/purchase-orders/send-batch', { orders: [] }],
    ['whatsapp-draft', 'POST', `/api/v1/purchase-orders/${poId}/whatsapp-draft`],
    ['buy-alert', 'GET', '/api/v1/purchase-orders/buy-alert'],
    ['purchase-run', 'GET', `/api/v1/purchase-runs/${runId}`],
  ]) {
    const res = await request(method, path, { cookie: dealer.cookie, body });
    denied.push(res.status === 401 || res.status === 403);
    ok(`12. dealer denied ${label}`, res.status === 401 || res.status === 403, `status=${res.status}`);
  }
  ok('13. dealer denied every new endpoint', denied.every(Boolean), `denied=${denied.filter(Boolean).length}/${denied.length}`);

  const failed = steps.filter((s) => !s.ok);
  const outDir = resolve(ROOT, 'tmp');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'purchasing-overhaul-uat.json');
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
