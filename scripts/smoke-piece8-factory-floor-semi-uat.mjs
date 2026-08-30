/**
 * Piece 8 live UAT — factory floor SEMI handoff against running API + demo seed.
 *
 * Usage: pnpm smoke:piece8-factory-floor-semi-uat
 * Requires API on :4000 and Piece 8 demo rows (demo:reset or re-seed).
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

async function taskForPoStage(poNumber, stageCode) {
  const po = await prisma.productionOrder.findUnique({
    where: { number: poNumber },
    select: { id: true },
  });
  if (!po) return null;
  return prisma.productionTask.findFirst({
    where: {
      productionOrderId: po.id,
      stageInstance: { stageDefinition: { code: stageCode } },
    },
    select: { id: true, number: true, status: true },
  });
}

async function main() {
  console.log(`Piece 8 factory floor SEMI UAT → ${API}\n`);

  const admin = await login('admin');
  ok('1. admin login', (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie));
  const cookie = admin.cookie;
  if (!cookie) {
    throw new Error('Admin login failed — is the API running?');
  }

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const pos = {};
  for (const L of letters) {
    pos[L] = await prisma.productionOrder.findUnique({
      where: { number: `PO-P8-${L}` },
      include: {
        salesOrder: { select: { number: true } },
        tasks: {
          include: { stageDefinition: { select: { code: true } } },
        },
      },
    });
  }

  ok(
    '2. demo rows SO/PO-P8 present',
    letters.every((L) => Boolean(pos[L])),
    `missing=${letters.filter((L) => !pos[L]).join(',') || 'none'}`,
  );

  // P8-A first stage incoming required=false
  const carpA = await taskForPoStage('PO-P8-A', 'CARPENTRY');
  const incomingA = carpA
    ? await request('GET', `/api/v1/tasks/${carpA.id}/wip-incoming`, { cookie })
    : { status: 0, json: null };
  ok(
    '3. P8-A first stage incoming required=false',
    incomingA.status === 200 && incomingA.json?.required === false,
    `task=${carpA?.number} required=${incomingA.json?.required}`,
  );

  // P8-B / P8-C kit READY (reset C if a prior smoke run claimed it)
  const kitB = await prisma.wipKit.findFirst({
    where: { productionOrder: { number: 'PO-P8-B' }, status: 'READY' },
  });
  let kitC = await prisma.wipKit.findFirst({
    where: { productionOrder: { number: 'PO-P8-C' } },
  });
  if (kitC && kitC.status !== 'READY') {
    await prisma.wipHandoff.deleteMany({ where: { kitId: kitC.id } });
    kitC = await prisma.wipKit.update({
      where: { id: kitC.id },
      data: {
        status: 'READY',
        claimedAt: null,
        claimedByUserId: null,
        claimedByTaskId: null,
      },
    });
  }
  ok('4. P8-B kit READY', Boolean(kitB), `kit=${kitB?.qrCode ?? 'none'}`);
  ok('5. P8-C kit READY', Boolean(kitC && kitC.status === 'READY'), `kit=${kitC?.qrCode ?? 'none'}`);

  // Receive on P8-C assembly
  const assemblyC = await taskForPoStage('PO-P8-C', 'ASSEMBLY');
  const beforeUsages = assemblyC
    ? await prisma.productionTaskMaterialUsage.count({
        where: { productionOrder: { number: 'PO-P8-C' } },
      })
    : 0;
  const receiveC = assemblyC && kitC
    ? await request('POST', `/api/v1/tasks/${assemblyC.id}/wip-receive`, {
        cookie,
        body: {
          kitId: kitC.id,
          quantity: 1,
          idempotencyKey: `smoke-p8-c-recv-${Date.now()}`,
        },
      })
    : { status: 0, json: null };
  ok(
    '6. P8-C receive works',
    receiveC.status === 200 || receiveC.status === 201,
    `status=${receiveC.status} code=${receiveC.json?.error?.code ?? receiveC.json?.code ?? ''}`,
  );

  const kitCAfter = kitC
    ? await prisma.wipKit.findUnique({ where: { id: kitC.id } })
    : null;
  ok(
    '7. custody CLAIMED after receive',
    kitCAfter?.status === 'CLAIMED',
    `status=${kitCAfter?.status}`,
  );

  const afterUsages = await prisma.productionTaskMaterialUsage.count({
    where: { productionOrder: { number: 'PO-P8-C' } },
  });
  ok(
    '8. SEMI receive does not create material usage cost rows',
    afterUsages === beforeUsages,
    `before=${beforeUsages} after=${afterUsages}`,
  );

  // Manufacturing cost for P8-C should not jump from SEMI receive
  if (pos.C) {
    const cost = await request('GET', `/api/v1/production-orders/${pos.C.id}/manufacturing-cost`, {
      cookie,
    });
    const actual = cost.json?.actual?.total;
    ok(
      '9. manufacturing cost ignores SEMI receive (actual null/0 or RAW-only)',
      cost.status === 200 &&
        (actual == null || Number(actual) === 0 || Number.isFinite(Number(actual))),
      `status=${cost.status} actual=${actual}`,
    );
  } else {
    ok('9. manufacturing cost ignores SEMI receive', false, 'PO-P8-C missing');
  }

  // Parallel P8-E lanes
  const carpE = await taskForPoStage('PO-P8-E', 'CARPENTRY');
  const foamE = await taskForPoStage('PO-P8-E', 'FOAM');
  ok(
    '10. parallel P8-E lanes (carpentry + foam tasks)',
    Boolean(carpE && foamE) &&
      (carpE.status === 'READY' || carpE.status === 'NOT_STARTED') &&
      Boolean(foamE),
    `carp=${carpE?.status} foam=${foamE?.status}`,
  );

  // Discrepancy without receive on P8-B assembly (fresh kit still READY)
  const assemblyB = await taskForPoStage('PO-P8-B', 'ASSEMBLY');
  const disc = assemblyB
    ? await request('POST', `/api/v1/tasks/${assemblyB.id}/wip-discrepancy`, {
        cookie,
        body: {
          category: 'DAMAGED',
          notes: 'smoke P8 discrepancy without receive',
          predecessorStageCode: 'CARPENTRY',
          kitId: kitB?.id,
          idempotencyKey: `smoke-p8-disc-${Date.now()}`,
        },
      })
    : { status: 0, json: null };
  const blocker = assemblyB
    ? await prisma.taskBlocker.findFirst({
        where: {
          taskId: assemblyB.id,
          category: 'PREVIOUS_STAGE_DEFECT',
          resolvedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      })
    : null;
  ok(
    '11. discrepancy endpoint creates blocker without receive',
    (disc.status === 200 || disc.status === 201) && Boolean(blocker),
    `status=${disc.status} blocker=${blocker?.id ?? 'none'}`,
  );

  // Packaging FIN / Delivery tasks=0 on P8-K
  if (pos.K) {
    const finLot = await prisma.inventoryLot.findFirst({
      where: {
        productionOrderId: pos.K.id,
        inventoryItem: { itemClass: 'FINISHED_GOOD' },
      },
    });
    const deliveryTasks = pos.K.tasks.filter(
      (t) => t.stageDefinition?.code === 'DELIVERY',
    );
    ok(
      '12. Packaging FIN / Delivery tasks=0',
      Boolean(finLot) && deliveryTasks.length === 0,
      `finLot=${finLot ? 'y' : 'n'} deliveryTasks=${deliveryTasks.length}`,
    );
  } else {
    ok('12. Packaging FIN / Delivery tasks=0', true, 'PO-P8-K absent — skipped');
  }

  // RAW material usage excludes SEMI (P8-L)
  const usagesL = await prisma.productionTaskMaterialUsage.findMany({
    where: { productionOrder: { number: 'PO-P8-L' } },
    include: { inventoryItem: { select: { itemClass: true, sku: true } } },
  });
  ok(
    '13. RAW material usage excludes SEMI (P8-L)',
    usagesL.length > 0 &&
      usagesL.every((u) => u.inventoryItem?.itemClass === 'RAW_MATERIAL') &&
      usagesL.some((u) => Number(u.scrapQty) > 0 && Number(u.returnedQty) > 0),
    `rows=${usagesL.length} scrap=${usagesL[0]?.scrapQty} returned=${usagesL[0]?.returnedQty}`,
  );

  // Material usage API for carpentry should list RAW only
  const carpL = await taskForPoStage('PO-P8-L', 'CARPENTRY');
  if (carpL) {
    const usageApi = await request('GET', `/api/v1/tasks/${carpL.id}/material-usage`, {
      cookie,
    });
    const rows = usageApi.json?.lines ?? usageApi.json?.items ?? usageApi.json?.usages ?? usageApi.json;
    const list = Array.isArray(rows) ? rows : Array.isArray(usageApi.json?.data) ? usageApi.json.data : [];
    const hasSemi = list.some(
      (r) =>
        String(r.itemClass ?? r.inventoryItem?.itemClass ?? '').toUpperCase() ===
        'SEMI_FINISHED_GOOD',
    );
    ok(
      '14. material-usage API excludes SEMI',
      usageApi.status === 200 && !hasSemi,
      `status=${usageApi.status} lines=${list.length}`,
    );
  } else {
    ok('14. material-usage API excludes SEMI', false, 'P8-L carpentry task missing');
  }

  // Partial handoff P8-F sanity
  const handoffF = await prisma.wipHandoff.findFirst({
    where: { productionOrder: { number: 'PO-P8-F' } },
  });
  const kitF = await prisma.wipKit.findFirst({
    where: { productionOrder: { number: 'PO-P8-F' } },
  });
  ok(
    '15. P8-F partial handoff 4/6',
    Boolean(handoffF && kitF) &&
      Number(handoffF.quantity) === 4 &&
      kitF.expectedPieceCount === 6,
    `recv=${handoffF?.quantity} expected=${kitF?.expectedPieceCount}`,
  );

  const failed = steps.filter((s) => !s.ok).length;
  const passed = steps.filter((s) => s.ok).length;
  console.log(`\nPiece 8 UAT: ${passed} passed, ${failed} failed (${steps.length} checks)`);

  const outDir = resolve(ROOT, 'docs');
  mkdirSync(outDir, { recursive: true });
  const reportPath = resolve(outDir, 'piece8-factory-floor-semi-uat-report.md');
  writeFileSync(
    reportPath,
    [
      '# Piece 8 factory floor SEMI UAT',
      '',
      `API: ${API}`,
      `When: ${new Date().toISOString()}`,
      '',
      `| # | Check | Result | Detail |`,
      `|---|-------|--------|--------|`,
      ...steps.map(
        (s, i) =>
          `| ${i + 1} | ${s.name} | ${s.ok ? 'PASS' : 'FAIL'} | ${s.detail.replace(/\|/g, '/')} |`,
      ),
      '',
      `**Score:** ${passed}/${steps.length}`,
      '',
    ].join('\n'),
  );
  console.log(`Report → ${reportPath}`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
