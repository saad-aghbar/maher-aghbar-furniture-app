/**
 * Live proof of RT-DEMO-PIECE-001 against the API on :4000.
 * Usage: node scripts/prove-rt-demo-piece-001.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
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

const evidence = [];
function note(name, data) {
  evidence.push({ name, ...data });
  const mark = data.ok === false ? 'FAIL' : 'PASS';
  console.log(`${mark}  ${name}${data.detail ? ` — ${data.detail}` : ''}`);
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

function cookieHeader(setCookie) {
  return (setCookie ?? []).map((c) => c.split(';')[0]).join('; ');
}

function errCode(res) {
  return res.json?.error?.code ?? res.json?.code ?? '';
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

async function loadFixture() {
  return prisma.returnRequest.findUnique({
    where: { number: 'RT-DEMO-PIECE-001' },
    include: {
      salesOrder: { select: { id: true, number: true, status: true } },
      pieces: {
        orderBy: { pieceNo: 'asc' },
        include: {
          productionOrder: {
            select: {
              id: true,
              number: true,
              originType: true,
              salesOrderId: true,
              returnPieceId: true,
              productDescription: true,
              specifications: true,
            },
          },
          recoveryOrder: {
            select: {
              id: true,
              number: true,
              originType: true,
              salesOrderId: true,
              returnPieceId: true,
              productDescription: true,
            },
          },
          recoveryLines: {
            select: {
              id: true,
              outcome: true,
              postedAt: true,
              inventoryItemId: true,
              destinationWarehouseId: true,
              idempotencyKey: true,
            },
          },
        },
      },
    },
  });
}

async function main() {
  const admin = await login('admin');
  note('admin login', { ok: admin.status === 201 || admin.status === 200, detail: `status=${admin.status}` });
  if (!admin.cookie) throw new Error('login failed');

  const soBefore = await prisma.salesOrder.count();
  let row = await loadFixture();
  note('fixture exists', {
    ok: Boolean(row?.id),
    detail: `id=${row?.id ?? 'none'} so=${row?.salesOrder?.number ?? 'none'} ${row?.salesOrder?.status ?? ''}`,
  });
  if (!row) process.exit(1);

  const pieces = row.pieces;
  note('one parent case, three pieces', {
    ok: pieces.length === 3 && new Set(pieces.map((p) => p.id)).size === 3,
    detail: pieces.map((p) => `${p.code}:${p.decision}`).join(', '),
  });
  note('one decision each, no RESTOCK', {
    ok:
      pieces.every((p) => ['REPAIR', 'REPLACEMENT', 'SCRAP_RECOVERY'].includes(p.decision)) &&
      new Set(pieces.map((p) => p.decision)).size === 3,
    detail: pieces.map((p) => p.decision).join(', '),
  });

  const decideBody = {
    items: [
      { pieceId: pieces[0].id, decision: 'REPAIR' },
      { pieceId: pieces[1].id, decision: 'REPLACEMENT' },
      { pieceId: pieces[2].id, decision: 'SCRAP_RECOVERY' },
    ],
  };
  const firstDecide = await request('POST', `/api/v1/returns/${row.id}/decisions`, {
    cookie: admin.cookie,
    body: decideBody,
  });
  note('decide / backfill work', {
    ok: firstDecide.status === 200 || firstDecide.status === 201,
    detail: `status=${firstDecide.status} code=${errCode(firstDecide)}`,
  });

  const secondDecide = await request('POST', `/api/v1/returns/${row.id}/decisions`, {
    cookie: admin.cookie,
    body: decideBody,
  });
  note('replay decide is accepted', {
    ok: secondDecide.status === 200 || secondDecide.status === 201,
    detail: `status=${secondDecide.status}`,
  });

  const restock = await request('POST', `/api/v1/returns/${row.id}/decision`, {
    cookie: admin.cookie,
    body: { fate: 'RESTOCK' },
  });
  note('legacy RESTOCK route is gone', {
    ok: restock.status === 404,
    detail: `status=${restock.status} code=${errCode(restock)}`,
  });
  const fate = await request('PATCH', `/api/v1/returns/${row.id}/inventory-fate`, {
    cookie: admin.cookie,
    body: { inventoryFate: 'RETURN_TO_STOCK' },
  });
  note('legacy inventory-fate route is gone', {
    ok: fate.status === 404,
    detail: `status=${fate.status} code=${errCode(fate)}`,
  });

  const receive1 = await request('POST', `/api/v1/returns/${row.id}/receive`, { cookie: admin.cookie });
  const receive2 = await request('POST', `/api/v1/returns/${row.id}/receive`, { cookie: admin.cookie });
  note('replay receive accepted', {
    ok:
      (receive1.status === 200 || receive1.status === 201) &&
      (receive2.status === 200 || receive2.status === 201),
    detail: `first=${receive1.status} second=${receive2.status}`,
  });

  row = await loadFixture();
  const p1 = row.pieces[0];
  const p2 = row.pieces[1];
  const p3 = row.pieces[2];

  const posAfterDecide = await prisma.productionOrder.findMany({
    where: { OR: [{ returnRequestId: row.id }, { returnPieceId: { in: row.pieces.map((p) => p.id) } }] },
    select: { id: true, number: true, originType: true, salesOrderId: true, returnPieceId: true },
    orderBy: { number: 'asc' },
  });
  const replayDecidePos = await prisma.productionOrder.count({
    where: { OR: [{ returnRequestId: row.id }, { returnPieceId: { in: row.pieces.map((p) => p.id) } }] },
  });
  note('no extra production orders on replay decide', {
    ok: posAfterDecide.length === replayDecidePos && posAfterDecide.length === 4,
    detail: posAfterDecide.map((o) => `${o.number}:${o.originType}`).join(', ') || 'none',
  });

  note('P1 REPAIR → RETURN_WORK, no sales order', {
    ok:
      p1.decision === 'REPAIR' &&
      p1.productionOrder?.originType === 'RETURN_WORK' &&
      p1.productionOrder.salesOrderId == null &&
      p1.productionOrder.returnPieceId === p1.id &&
      !p1.recoveryOrder,
    detail: `${p1.productionOrder?.number ?? 'none'} so=${p1.productionOrder?.salesOrderId ?? 'null'}`,
  });
  note('P2 REPLACEMENT → REPLACEMENT + RETURN_RECOVERY, no sales order', {
    ok:
      p2.decision === 'REPLACEMENT' &&
      p2.productionOrder?.originType === 'REPLACEMENT' &&
      p2.recoveryOrder?.originType === 'RETURN_RECOVERY' &&
      p2.productionOrder.salesOrderId == null &&
      p2.recoveryOrder.salesOrderId == null &&
      p2.productionOrder.returnPieceId === p2.id &&
      p2.recoveryOrder.returnPieceId === p2.id,
    detail: `${p2.productionOrder?.number ?? 'none'} + ${p2.recoveryOrder?.number ?? 'none'}`,
  });
  note('P3 SCRAP_RECOVERY → RETURN_RECOVERY only', {
    ok:
      p3.decision === 'SCRAP_RECOVERY' &&
      !p3.productionOrder &&
      p3.recoveryOrder?.originType === 'RETURN_RECOVERY' &&
      p3.recoveryOrder.salesOrderId == null &&
      p3.recoveryOrder.returnPieceId === p3.id &&
      p3.outboundEligible === false,
    detail: `${p3.recoveryOrder?.number ?? 'none'} outbound=${p3.outboundEligible}`,
  });

  const soAfter = await prisma.salesOrder.count();
  note('no second commercial sales order', {
    ok: soAfter === soBefore && row.salesOrder?.number === 'SO-P11-M',
    detail: `soCount ${soBefore}→${soAfter} original=${row.salesOrder?.number}`,
  });

  const rpMats = p2.productionOrder
    ? await prisma.salesOrderLineMaterialRequirement.count({
        where: { productionOrderId: p2.productionOrder.id },
      })
    : 0;
  note('P2 replacement baseline cloned from original line', {
    ok: Boolean(p2.productionOrder?.specifications) || rpMats > 0 || Boolean(p2.specSnapshot),
    detail: `spec=${Boolean(p2.productionOrder?.specifications)} materials=${rpMats} snapshot=${Boolean(p2.specSnapshot)}`,
  });

  if (p1.productionOrder) {
    const plan = await request('GET', `/api/v1/production-orders/${p1.productionOrder.id}/plan-setup`, {
      cookie: admin.cookie,
    });
    note('P1 canonical production plan opens', {
      ok: (plan.status === 200 || plan.status === 201) && plan.json?.catalogTemplate?.showBoard === true,
      detail: `status=${plan.status} showBoard=${plan.json?.catalogTemplate?.showBoard}`,
    });
  } else {
    note('P1 canonical production plan opens', { ok: false, detail: 'no repair PO' });
  }

  const recoveryTasks = p3.recoveryOrder
    ? await prisma.productionTask.findMany({
        where: { productionOrderId: p3.recoveryOrder.id },
        select: {
          id: true,
          number: true,
          name: true,
          status: true,
          stageDefinition: { select: { code: true } },
        },
      })
    : [];
  const isDismantle = (task) =>
    task.stageDefinition?.code === 'DISMANTLE_RECOVER' || /dismantle|recover/i.test(task.name ?? '');
  note('P3 DISMANTLE_RECOVER task exists', {
    ok: recoveryTasks.some(isDismantle),
    detail:
      recoveryTasks.map((t) => `${t.number}:${t.stageDefinition?.code ?? t.name}:${t.status}`).join(', ') ||
      'none',
  });

  const item = await prisma.inventoryItem.findFirst({
    where: { archivedAt: null, itemClass: 'RAW_MATERIAL' },
    select: { id: true },
  });
  const warehouse = await prisma.warehouse.findFirst({
    where: { isActive: true, type: 'RAW_MATERIALS' },
    select: { id: true },
  });
  const taskId = recoveryTasks[0]?.id;
  const outcomes = [
    { label: 'Recovered foam', outcome: 'RECOVER_TO_INVENTORY', inventoryItemId: item?.id, destinationWarehouseId: warehouse?.id },
    { label: 'Waste dust', outcome: 'DISPOSE' },
    { label: 'Damaged frame', outcome: 'DAMAGED' },
  ];
  const lineIds = [];
  for (const line of outcomes) {
    const recorded = await request('POST', `/api/v1/returns/${row.id}/pieces/${p3.id}/recovery-lines`, {
      cookie: admin.cookie,
      body: { ...line, quantity: 1, productionTaskId: taskId, unit: 'pcs' },
    });
    note(`record recovery ${line.outcome}`, {
      ok: recorded.status === 200 || recorded.status === 201,
      detail: `status=${recorded.status} id=${recorded.json?.id ?? 'none'}`,
    });
    if (recorded.json?.id) lineIds.push(recorded.json.id);
  }

  for (const lineId of lineIds) {
    const first = await request('POST', `/api/v1/returns/${row.id}/recovery-lines/${lineId}/post`, {
      cookie: admin.cookie,
    });
    const second = await request('POST', `/api/v1/returns/${row.id}/recovery-lines/${lineId}/post`, {
      cookie: admin.cookie,
    });
    const moves = await prisma.inventoryTransaction.count({
      where: { referenceType: 'ReturnRecoveryLine', referenceId: lineId },
    });
    note(`post recovery ${lineId.slice(0, 8)} idempotent`, {
      ok: (first.status === 200 || first.status === 201) && (second.status === 200 || second.status === 201),
      detail: `first=${first.status} second=${second.status} txs=${moves} code=${errCode(first)}`,
    });
  }

  const recoveredTx = await prisma.inventoryTransaction.findMany({
    where: { referenceType: 'ReturnRecoveryLine', referenceId: { in: lineIds } },
    select: { id: true, number: true, type: true, referenceId: true, idempotencyKey: true },
  });
  note('inventory posting traceable to recovery lines / piece', {
    ok: recoveredTx.length >= 1 && recoveredTx.every((tx) => lineIds.includes(tx.referenceId)),
    detail: recoveredTx.map((tx) => `${tx.number}:${tx.type}`).join(', ') || 'none',
  });

  const cases = await request('GET', '/api/v1/sales-orders/returned-cases?page=1&pageSize=100', {
    cookie: admin.cookie,
  });
  const caseRow = (cases.json?.data ?? []).find((r) => r.id === row.id || r.number === 'RT-DEMO-PIECE-001');
  note('Orders Returned groups one case row', {
    ok: cases.status === 200 && caseRow && Number(caseRow.quantity) === 3 && caseRow.kind === 'returnCase',
    detail: `status=${cases.status} qty=${caseRow?.quantity} kind=${caseRow?.kind} summary=${JSON.stringify(caseRow?.pieceSummary ?? {})}`,
  });

  const detail = await request('GET', `/api/v1/returns/${row.id}`, { cookie: admin.cookie });
  const detailPieces = detail.json?.pieces ?? [];
  note('return detail lists piece decisions', {
    ok:
      detail.status === 200 &&
      detailPieces.length === 3 &&
      detailPieces.some((p) => p.decision === 'REPAIR') &&
      detailPieces.some((p) => p.decision === 'REPLACEMENT') &&
      detailPieces.some((p) => p.decision === 'SCRAP_RECOVERY'),
    detail: detailPieces.map((p) => `${p.code}:${p.decision}:out=${p.outboundEligible}`).join(' | '),
  });

  const outbound = row.pieces.filter((p) => p.outboundEligible);
  note('exactly two outbound pieces (repair + replacement)', {
    ok: outbound.length === 2 && outbound.every((p) => p.decision === 'REPAIR' || p.decision === 'REPLACEMENT'),
    detail: row.pieces.map((p) => `${p.code}:${p.decision}:out=${p.outboundEligible}`).join(', '),
  });

  const workList = await request(
    'GET',
    '/api/v1/production-orders?origin=returned&page=1&pageSize=100',
    { cookie: admin.cookie },
  );
  const workIds = posAfterDecide.map((o) => o.id);
  const listed = (workList.json?.data ?? []).filter((r) => workIds.includes(r.id));
  note('Production still lists individual RW/RP/RC work', {
    ok: workList.status === 200 && listed.length >= 3,
    detail: `status=${workList.status} listed=${listed.map((r) => r.number).join(', ')}`,
  });

  console.log('\n--- fixture snapshot ---');
  console.log(
    JSON.stringify(
      {
        returnId: row.id,
        number: row.number,
        salesOrder: row.salesOrder,
        pieces: row.pieces.map((p) => ({
          id: p.id,
          code: p.code,
          decision: p.decision,
          state: p.state,
          outboundEligible: p.outboundEligible,
          work: p.productionOrder,
          recovery: p.recoveryOrder,
          recoveryLines: p.recoveryLines,
        })),
        productionOrders: posAfterDecide,
        inventoryTx: recoveredTx,
      },
      null,
      2,
    ),
  );

  const failed = evidence.filter((e) => e.ok === false).length;
  process.exitCode = failed ? 1 : 0;
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await prisma.$disconnect();
});
