/**
 * Returned piece live UAT.
 *
 * Usage: pnpm smoke:returned-pieces
 * Requires API on :4000 and a seeded local DB.
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';

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
  return { status: res.status, json };
}

function errCode(res) {
  return res.json?.error?.code ?? res.json?.code ?? '';
}

function cookieHeader(setCookie) {
  return (setCookie ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function login(username) {
  const res = await fetch(new URL('/api/v1/auth/login', API), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: '123' }),
  });
  return {
    cookie: cookieHeader(res.headers.getSetCookie?.() ?? []),
    status: res.status,
  };
}

function writeReport() {
  const failed = steps.filter((s) => !s.ok).length;
  const dir = resolve(ROOT, 'artifacts');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, 'returned-piece-live-uat.json'),
    JSON.stringify({ failed, steps }, null, 2),
  );
  return failed;
}

async function main() {
  const admin = await login('admin');
  ok('admin login', admin.status === 201 || admin.status === 200, `status=${admin.status}`);

  const candidates = await prisma.salesOrder.findMany({
    where: { status: { in: ['DELIVERED', 'COMPLETED'] } },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      returns: {
        where: { approvalStatus: { not: 'REJECTED' } },
        select: { quantity: true, salesOrderLineId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });
  let so = candidates.find((row) => {
    const usedByLine = new Map();
    for (const ret of row.returns) {
      const key = ret.salesOrderLineId ?? '__order__';
      usedByLine.set(key, (usedByLine.get(key) ?? 0) + Number(ret.quantity));
    }
    const orderUsed = usedByLine.get('__order__') ?? 0;
    const ordered = row.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
    if (ordered - orderUsed < 2) return false;
    return row.lines.some((line) => Number(line.quantity) - (usedByLine.get(line.id) ?? 0) >= 2);
  });
  if (!so) {
    const dealer = await prisma.customer.findFirst({
      where: { archivedAt: null },
      select: { id: true },
    });
    const product = await prisma.product.findFirst({
      where: { isActive: true, archivedAt: null },
      select: { id: true, nameEn: true, basePrice: true },
    });
    const adminUser = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { id: true },
    });
    if (dealer && product && adminUser) {
      const stamp = Date.now().toString(36);
      const createdSo = await prisma.salesOrder.create({
        data: {
          number: `SO-RP-${stamp}`.slice(0, 40),
          customerId: dealer.id,
          status: 'DELIVERED',
          notes: 'returned-piece-live-uat',
          createdById: adminUser.id,
          lines: {
            create: {
              description: product.nameEn ?? 'Piece UAT',
              quantity: 2,
              unitPrice: Number(product.basePrice ?? 100) || 100,
              lineTotal: (Number(product.basePrice ?? 100) || 100) * 2,
              manufacturingComplexity: 'STANDARD',
              productId: product.id,
            },
          },
        },
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
          returns: {
            where: { approvalStatus: { not: 'REJECTED' } },
            select: { quantity: true, salesOrderLineId: true },
          },
        },
      });
      so = createdSo;
    }
  }
  ok('seed sales order', Boolean(so?.id), so?.number ?? 'none');
  if (!so) {
    process.exitCode = writeReport() ? 1 : 0;
    await prisma.$disconnect();
    return;
  }

  const created = await request('POST', '/api/v1/returns', {
    cookie: admin.cookie,
    body: {
      customerId: so.customerId,
      salesOrderId: so.id,
      reason: 'MANUFACTURING_DEFECT',
      quantity: 2,
      items: so.lines
        .filter((line) => Number(line.quantity) >= 2)
        .slice(0, 1)
        .map((line) => ({
          salesOrderLineId: line.id,
          quantity: 2,
        })),
      productDesc: so.lines.find((line) => Number(line.quantity) >= 2)?.description ?? 'Piece UAT',
    },
  });
  ok(
    'create return with items[]',
    (created.status === 200 || created.status === 201) && created.json?.id,
    `status=${created.status} id=${created.json?.id ?? 'none'} code=${errCode(created)} body=${JSON.stringify(created.json)?.slice(0, 400)}`,
  );
  const returnId = created.json?.id;
  if (!returnId) {
    process.exitCode = 1;
    writeReport();
    await prisma.$disconnect();
    return;
  }

  const approved = await request('PATCH', `/api/v1/returns/${returnId}/resolve`, {
    cookie: admin.cookie,
    body: { approvalStatus: 'APPROVED' },
  });
  ok(
    'approve return',
    approved.status === 200 || approved.status === 201,
    `status=${approved.status}`,
  );

  const firstReceive = await request('POST', `/api/v1/returns/${returnId}/receive`, {
    cookie: admin.cookie,
    body: {},
  });
  ok(
    'receive pieces',
    firstReceive.status === 200 || firstReceive.status === 201,
    `status=${firstReceive.status}`,
  );
  const pieces = firstReceive.json?.pieces ?? [];
  ok('materialized two pieces', pieces.length === 2, `count=${pieces.length}`);

  const secondReceive = await request('POST', `/api/v1/returns/${returnId}/receive`, {
    cookie: admin.cookie,
    body: {},
  });
  const lotCount = await prisma.inventoryLot.count({
    where: { sourceKey: { startsWith: `return-piece-quarantine:` }, returnRequestId: undefined },
  });
  const pieceLots = await prisma.returnPiece.findMany({
    where: { returnRequestId: returnId },
    select: { inventoryLotId: true },
  });
  ok(
    're-receive does not duplicate custody',
    (secondReceive.status === 200 || secondReceive.status === 201) &&
      new Set(pieceLots.map((p) => p.inventoryLotId).filter(Boolean)).size === pieceLots.length,
    `lots=${pieceLots.map((p) => p.inventoryLotId).join(',') || lotCount}`,
  );

  const restock = await request('POST', `/api/v1/returns/${returnId}/decision`, {
    cookie: admin.cookie,
    body: { fate: 'RESTOCK' },
  });
  ok(
    'legacy RESTOCK route is gone',
    restock.status === 404,
    `status=${restock.status} code=${errCode(restock)}`,
  );

  const [first, second] = pieces;
  const decide = await request('POST', `/api/v1/returns/${returnId}/decisions`, {
    cookie: admin.cookie,
    body: {
      items: [
        { pieceId: first.id, decision: 'REPAIR' },
        { pieceId: second.id, decision: 'SCRAP_RECOVERY' },
      ],
    },
  });
  ok(
    'piece decisions create factory work',
    decide.status === 200 || decide.status === 201,
    `status=${decide.status}`,
  );
  const decided = await prisma.returnPiece.findMany({
    where: { returnRequestId: returnId },
    select: { decision: true, productionOrderId: true, recoveryOrderId: true },
  });
  ok(
    'repair has RW and scrap has recovery',
    decided.some((p) => p.decision === 'REPAIR' && p.productionOrderId) &&
      decided.some((p) => p.decision === 'SCRAP_RECOVERY' && p.recoveryOrderId),
    JSON.stringify(decided),
  );

  const decideAgain = await request('POST', `/api/v1/returns/${returnId}/decisions`, {
    cookie: admin.cookie,
    body: {
      items: [{ pieceId: first.id, decision: 'REPLACEMENT' }],
    },
  });
  ok(
    'second different decision rejected',
    decideAgain.status === 400 && errCode(decideAgain) === 'RETURN_PIECE_ALREADY_DECIDED',
    `status=${decideAgain.status} code=${errCode(decideAgain)}`,
  );

  const scrapPiece = decided.find((p) => p.decision === 'SCRAP_RECOVERY');
  const scrapId = (await prisma.returnPiece.findFirst({
    where: { returnRequestId: returnId, decision: 'SCRAP_RECOVERY' },
    select: { id: true },
  }))?.id;
  const item = await prisma.inventoryItem.findFirst({
    where: { archivedAt: null, itemClass: 'RAW_MATERIAL' },
    select: { id: true },
  });
  const warehouse = await prisma.warehouse.findFirst({
    where: { isActive: true, type: 'RAW_MATERIALS' },
    select: { id: true },
  });
  if (scrapId && item && warehouse) {
    const record = await request('POST', `/api/v1/returns/${returnId}/pieces/${scrapId}/recovery-lines`, {
      cookie: admin.cookie,
      body: {
        label: 'UAT foam',
        quantity: 1,
        outcome: 'RECOVER_TO_INVENTORY',
        inventoryItemId: item.id,
        destinationWarehouseId: warehouse.id,
      },
    });
    ok(
      'record recovery line',
      record.status === 200 || record.status === 201,
      `status=${record.status}`,
    );
    const lineId = record.json?.id;
    const firstPost = await request(
      'POST',
      `/api/v1/returns/${returnId}/recovery-lines/${lineId}/post`,
      { cookie: admin.cookie },
    );
    const secondPost = await request(
      'POST',
      `/api/v1/returns/${returnId}/recovery-lines/${lineId}/post`,
      { cookie: admin.cookie },
    );
    const moves = await prisma.inventoryTransaction.count({
      where: { idempotencyKey: record.json?.idempotencyKey ?? `return-recovery:${lineId}` },
    });
    ok(
      'recovery post is idempotent',
      (firstPost.status === 200 || firstPost.status === 201) &&
        (secondPost.status === 200 || secondPost.status === 201) &&
        moves <= 1,
      `first=${firstPost.status} second=${secondPost.status} moves=${moves} code=${errCode(firstPost)}`,
    );
  } else {
    ok('record recovery line', false, `scrap=${scrapId} item=${item?.id} wh=${warehouse?.id} extra=${scrapPiece?.recoveryOrderId}`);
  }

  const cases = await request('GET', '/api/v1/sales-orders/returned-cases?page=1&pageSize=50', {
    cookie: admin.cookie,
  });
  ok(
    'returned-cases lists the case',
    (cases.status === 200) &&
      Array.isArray(cases.json?.data) &&
      cases.json.data.some((row) => row.id === returnId),
    `status=${cases.status} rows=${cases.json?.data?.length ?? 0}`,
  );

  const failed = writeReport();
  process.exitCode = failed ? 1 : 0;
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await prisma.$disconnect();
});
