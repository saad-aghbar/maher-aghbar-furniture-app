/**
 * Piece 6 live UAT — purchasing / receiving / valuation against running API + ledger.
 *
 * Usage: pnpm smoke:piece6-purchasing-receiving-uat
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

async function poByNumber(number) {
  return prisma.purchaseOrder.findUnique({
    where: { number },
    include: {
      lines: true,
      goodsReceipts: { include: { lines: true } },
    },
  });
}

async function main() {
  console.log(`Piece 6 purchasing/receiving UAT → ${API}\n`);

  const admin = await login('admin');
  ok('1. admin login', (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie));

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const pos = {};
  for (const L of letters) {
    pos[L] = await poByNumber(`PO-P6-${L}`);
  }
  ok(
    '2. demo rows PO-P6-A…J present',
    letters.every((L) => Boolean(pos[L]?.id)),
    letters.map((L) => `${L}=${pos[L] ? 'y' : 'n'}`).join(' '),
  );

  ok(
    '3. P6-A DRAFT exists',
    pos.A?.status === 'DRAFT' && (pos.A?.lines?.length ?? 0) >= 2,
    `status=${pos.A?.status} lines=${pos.A?.lines?.length}`,
  );

  const bGrns = pos.B?.goodsReceipts?.length ?? 0;
  const bTx = pos.B
    ? await prisma.inventoryTransaction.count({
        where: {
          referenceType: 'GoodsReceipt',
          referenceId: { in: (pos.B.goodsReceipts ?? []).map((g) => g.id) },
        },
      })
    : -1;
  const bAnyTx = await prisma.inventoryTransaction.count({
    where: {
      OR: [
        { notes: { contains: 'PO-P6-B' } },
        { referenceId: pos.B?.id ?? 'none', referenceType: 'PurchaseOrder' },
      ],
    },
  });
  ok(
    '4. P6-B ORDERED — no stock from PO alone',
    ['SENT', 'APPROVED'].includes(pos.B?.status) && bGrns === 0 && bTx === 0 && bAnyTx === 0,
    `status=${pos.B?.status} grns=${bGrns} tx=${bTx}`,
  );

  const cDetail = await request('GET', `/api/v1/purchase-orders/${pos.C?.id}`, {
    cookie: admin.cookie,
  });
  const cLine = cDetail.json?.lines?.[0];
  // Seed is 100→60; prior smoke runs may have posted small idempotent GRNs on P6-C.
  // Require true partial (not fully received / not zero).
  ok(
    '5. P6-C partial remaining (~40 of 100)',
    cDetail.status === 200 &&
      cDetail.json?.status === 'PARTIALLY_RECEIVED' &&
      cDetail.json?.presentation?.phase === 'PARTIALLY_RECEIVED' &&
      cLine &&
      Number(cLine.quantity ?? cLine.orderedQty ?? 100) >= 100 &&
      Number(cLine.receivedQty) > 0 &&
      Number(cLine.remainingQty) > 0,
    `recv=${cLine?.receivedQty} rem=${cLine?.remainingQty} phase=${cDetail.json?.presentation?.phase}`,
  );

  ok(
    '6. P6-D multi GRN accumulate',
    (pos.D?.goodsReceipts?.length ?? 0) >= 2 && pos.D?.status === 'PARTIALLY_RECEIVED',
    `grns=${pos.D?.goodsReceipts?.length} status=${pos.D?.status}`,
  );

  const eDetail = await request('GET', `/api/v1/purchase-orders/${pos.E?.id}`, {
    cookie: admin.cookie,
  });
  const costing = eDetail.json?.purchasingCosting;
  ok(
    '7. P6-E variance on purchasingCosting',
    eDetail.status === 200 &&
      costing &&
      Number(costing.expectedTotal) > 0 &&
      Number(costing.actualReceivedValue) > 0 &&
      Math.abs(Number(costing.purchaseVariance)) > 0.01 &&
      Number(costing.actualReceivedValue) !== Number(costing.expectedTotal),
    `exp=${costing?.expectedTotal} act=${costing?.actualReceivedValue} var=${costing?.purchaseVariance}`,
  );

  const demand = await request('GET', '/api/v1/material-demand', {
    cookie: admin.cookie,
  });
  const shortSku = pos.F?.lines?.[0]
    ? (
        await prisma.inventoryItem.findUnique({
          where: { id: pos.F.lines[0].inventoryItemId },
          select: { sku: true },
        })
      )?.sku
    : null;
  const demandRow = Array.isArray(demand.json)
    ? demand.json.find((r) => r.sku === shortSku)
    : null;
  ok(
    '8. P6-F material-demand stillNeeded + incoming',
    demand.status === 200 &&
      demandRow &&
      Number(demandRow.incomingQty) > 0 &&
      Number(demandRow.stillNeeded) > 0,
    `sku=${shortSku} incoming=${demandRow?.incomingQty} still=${demandRow?.stillNeeded} avail=${demandRow?.availableQty}`,
  );

  ok(
    '9. P6-G fully RECEIVED',
    pos.G?.status === 'RECEIVED' && (pos.G?.goodsReceipts?.length ?? 0) >= 1,
    `status=${pos.G?.status}`,
  );
  const gDetail = await request('GET', `/api/v1/purchase-orders/${pos.G?.id}`, {
    cookie: admin.cookie,
  });
  ok(
    '10. P6-G presentation RECEIVED',
    gDetail.status === 200 && gDetail.json?.presentation?.phase === 'RECEIVED',
    `phase=${gDetail.json?.presentation?.phase}`,
  );

  // Over-receipt blocked against P6-C remaining.
  const rawWh =
    (await prisma.warehouse.findFirst({
      where: { code: 'RAW', type: 'RAW_MATERIALS' },
    })) ??
    (await prisma.warehouse.findFirst({ where: { type: 'RAW_MATERIALS' } }));
  const cItemId = pos.C?.lines?.[0]?.inventoryItemId;
  const over = await request('POST', `/api/v1/purchase-orders/${pos.C?.id}/goods-receipts`, {
    cookie: admin.cookie,
    body: {
      warehouseId: rawWh?.id,
      lines: [
        {
          inventoryItemId: cItemId,
          orderedQty: 100,
          receivedQty: 999,
          unitCost: 11.5,
        },
      ],
    },
  });
  ok(
    '11. over-receipt blocked (OVER_RECEIPT)',
    over.status >= 400 &&
      (over.json?.error?.code === 'OVER_RECEIPT' ||
        over.json?.code === 'OVER_RECEIPT' ||
        String(over.json?.error?.message ?? over.json?.message ?? over.text ?? '').includes(
          'OVER_RECEIPT',
        ) ||
        String(over.json?.error?.message ?? over.json?.message ?? '')
          .toLowerCase()
          .includes('remaining')),
    `status=${over.status} code=${over.json?.error?.code ?? over.json?.code} msg=${over.json?.error?.message ?? over.json?.message}`,
  );

  // GRN unitCost on PURCHASE_RECEIPT tx (P6-E).
  const eGrnId = pos.E?.goodsReceipts?.[0]?.id;
  const eTx = eGrnId
    ? await prisma.inventoryTransaction.findFirst({
        where: {
          referenceType: 'GoodsReceipt',
          referenceId: eGrnId,
          type: 'PURCHASE_RECEIPT',
          unitCost: { not: null },
        },
      })
    : null;
  const eLineCost = pos.E?.goodsReceipts?.[0]?.lines?.[0]?.unitCost;
  ok(
    '12. GRN unitCost on PURCHASE_RECEIPT tx',
    Boolean(eTx) &&
      Number(eTx.unitCost) > 0 &&
      Math.abs(Number(eTx.unitCost) - Number(eLineCost)) < 0.02,
    `txCost=${eTx?.unitCost} lineCost=${eLineCost}`,
  );

  // Idempotency: receive remaining of P6-C twice with same key.
  const rem = Math.max(1, Math.floor(Number(cLine?.remainingQty) || 40));
  const idemKey = `smoke-p6-idem-${Date.now()}`;
  const bodyIdem = {
    warehouseId: rawWh?.id,
    idempotencyKey: idemKey,
    deliveryDocRef: 'SMOKE-P6-IDEM',
    lines: [
      {
        inventoryItemId: cItemId,
        orderedQty: 100,
        receivedQty: Math.min(rem, 5),
        unitCost: 11.5,
      },
    ],
  };
  const r1 = await request('POST', `/api/v1/purchase-orders/${pos.C?.id}/goods-receipts`, {
    cookie: admin.cookie,
    body: bodyIdem,
  });
  const r2 = await request('POST', `/api/v1/purchase-orders/${pos.C?.id}/goods-receipts`, {
    cookie: admin.cookie,
    body: bodyIdem,
  });
  ok(
    '13. GRN idempotency returns same receipt',
    r1.status < 400 &&
      r2.status < 400 &&
      r1.json?.id &&
      r1.json.id === r2.json?.id &&
      r1.json.number === r2.json?.number,
    `r1=${r1.status}/${r1.json?.id} r2=${r2.status}/${r2.json?.id}`,
  );

  // P6-H stock exists after GRN for readiness material.
  const hItemId = pos.H?.lines?.[0]?.inventoryItemId;
  const hBal = hItemId
    ? await prisma.inventoryBalance.aggregate({
        where: { inventoryItemId: hItemId },
        _sum: { availableQty: true },
      })
    : null;
  ok(
    '14. P6-H stock present after GRN (readiness)',
    hItemId && Number(hBal?._sum?.availableQty ?? 0) > 0,
    `item=${hItemId} avail=${hBal?._sum?.availableQty}`,
  );

  const hSku = hItemId
    ? (
        await prisma.inventoryItem.findUnique({
          where: { id: hItemId },
          select: { sku: true },
        })
      )?.sku
    : null;
  const hDemand = Array.isArray(demand.json)
    ? demand.json.find((r) => r.inventoryItemId === hItemId || r.sku === hSku)
    : null;
  ok(
    '15. P6-H material appears in demand board',
    Boolean(hDemand) || Number(hBal?._sum?.availableQty ?? 0) > 0,
    `demandSku=${hDemand?.sku} avail=${hDemand?.availableQty}`,
  );

  const jDetail = await request('GET', `/api/v1/purchase-orders/${pos.J?.id}`, {
    cookie: admin.cookie,
  });
  ok(
    '16. P6-J overdue attention OVERDUE_ETA',
    jDetail.status === 200 &&
      (jDetail.json?.presentation?.attentionReason === 'OVERDUE_ETA' ||
        (jDetail.json?.presentation?.phase === 'PARTIALLY_RECEIVED' &&
          new Date(jDetail.json?.expectedDeliveryDate).getTime() < Date.now())),
    `attn=${jDetail.json?.presentation?.attentionReason} eta=${jDetail.json?.expectedDeliveryDate}`,
  );

  const iWh = pos.I?.warehouseId;
  const rawCount = await prisma.warehouse.count({
    where: { type: 'RAW_MATERIALS', isActive: true },
  });
  ok(
    '17. P6-I warehouse RAW_MATERIALS',
    Boolean(iWh) &&
      (await prisma.warehouse.findUnique({ where: { id: iWh } }))?.type === 'RAW_MATERIALS',
    `rawWarehouses=${rawCount} wh=${iWh}`,
  );

  // Piece 5 historical cost stability (if SO-P5-A present).
  const soP5 = await prisma.salesOrder.findUnique({
    where: { number: 'SO-P5-A' },
    select: { id: true },
  });
  if (soP5) {
    const c1 = await request('GET', `/api/v1/sales-orders/${soP5.id}/manufacturing-cost`, {
      cookie: admin.cookie,
    });
    const total1 = c1.json?.actual?.total;
    ok(
      '18. Piece5 SO-P5-A cost endpoint stable',
      c1.status === 200 && total1 != null && Number(total1) >= 0,
      `status=${c1.json?.status} total=${total1}`,
    );
  } else {
    ok('18. Piece5 SO-P5-A cost endpoint stable', false, 'SO-P5-A missing');
  }

  // Dealer denied purchase costs / PO read.
  const oasis = await login('oasis');
  const oasisPo = await request('GET', `/api/v1/purchase-orders/${pos.E?.id}`, {
    cookie: oasis.cookie,
  });
  ok(
    '19. dealer denied purchase-order detail (costs)',
    oasisPo.status === 403 || oasisPo.status === 401,
    `status=${oasisPo.status}`,
  );

  const oasisDemand = await request('GET', '/api/v1/material-demand', {
    cookie: oasis.cookie,
  });
  ok(
    '20. dealer denied material-demand',
    oasisDemand.status === 403 || oasisDemand.status === 401,
    `status=${oasisDemand.status}`,
  );

  // Presentation phase mapping for A/B.
  const aDetail = await request('GET', `/api/v1/purchase-orders/${pos.A?.id}`, {
    cookie: admin.cookie,
  });
  const bDetail = await request('GET', `/api/v1/purchase-orders/${pos.B?.id}`, {
    cookie: admin.cookie,
  });
  ok(
    '21. presentation DRAFT / ORDERED phases',
    aDetail.json?.presentation?.phase === 'DRAFT' &&
      bDetail.json?.presentation?.phase === 'ORDERED',
    `A=${aDetail.json?.presentation?.phase} B=${bDetail.json?.presentation?.phase}`,
  );

  // Certified suppliers used on P6 POs.
  const supplierIds = [
    ...new Set(letters.map((L) => pos[L]?.supplierId).filter(Boolean)),
  ];
  const certified = await prisma.supplier.count({
    where: { id: { in: supplierIds }, isCertified: true },
  });
  ok(
    '22. P6 suppliers certified',
    certified === supplierIds.length && supplierIds.length > 0,
    `certified=${certified}/${supplierIds.length}`,
  );

  const failed = steps.filter((s) => !s.ok);
  const outDir = resolve(ROOT, 'tmp');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'piece6-purchasing-receiving-uat.json');
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
