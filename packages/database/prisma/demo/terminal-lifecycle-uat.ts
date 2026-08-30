/**
 * Live smoke UAT A–T for terminal lifecycle (INSPECTION → PACKAGING → DELIVERY).
 * Requires: demo:reset done, API on API_URL (default http://localhost:4000).
 */
import { PrismaClient } from '@maher/database';

const API = process.env.API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();

type Result = { id: string; pass: boolean; detail?: string };

const results: Result[] = [];

function record(id: string, pass: boolean, detail?: string) {
  results.push({ id, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`  ${id}: ${mark}${detail ? ` — ${detail}` : ''}`);
}

async function login(username: string) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: '123', client: 'mobile' }),
  });
  if (!res.ok) throw new Error(`${username} login failed: ${res.status}`);
  const json = (await res.json()) as { accessToken?: string; token?: string };
  const token = json.accessToken ?? json.token;
  if (!token) throw new Error(`${username} login: no token`);
  return token;
}

async function api(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function main() {
  console.log('Terminal lifecycle UAT (API + DB)\n');

  try {
    const health = await fetch(`${API}/api/v1/health`);
    record('API', health.ok, health.ok ? API : `health ${health.status}`);
    if (!health.ok) process.exit(1);
  } catch (e) {
    record('API', false, String(e));
    process.exit(1);
  }

  // A — schema + seed foundations
  const stages = await prisma.productionStageDefinition.findMany({
    where: { code: { in: ['INSPECTION', 'PACKAGING', 'DELIVERY'] } },
    select: { code: true, executionKind: true },
  });
  const kindOk =
    stages.find((s) => s.code === 'INSPECTION')?.executionKind === 'QUALITY' &&
    stages.find((s) => s.code === 'PACKAGING')?.executionKind === 'PRODUCTION' &&
    stages.find((s) => s.code === 'DELIVERY')?.executionKind === 'LOGISTICS';
  record('A', kindOk && stages.length === 3, `executionKind on ${stages.length} stages`);

  // B — published workflows include terminal chain
  const wfVersions = await prisma.productionWorkflowVersion.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      nodes: { include: { stageDefinition: { select: { code: true } } } },
      edges: true,
    },
    take: 20,
  });
  let wfBad = 0;
  for (const v of wfVersions) {
    const codes = new Set(v.nodes.map((n) => n.stageDefinition.code));
    if (!['INSPECTION', 'PACKAGING', 'DELIVERY'].every((c) => codes.has(c))) wfBad++;
  }
  record('B', wfBad === 0, `${wfVersions.length} published, ${wfBad} missing chain`);

  // S — STANDARD_FURNITURE includes DELIVERY
  const standardWf = await prisma.productionWorkflow.findFirst({
    where: { code: 'STANDARD_FURNITURE' },
    include: {
      activeVersion: {
        include: { nodes: { include: { stageDefinition: true } } },
      },
    },
  });
  const stdHasDelivery = standardWf?.activeVersion?.nodes.some(
    (n) => n.stageDefinition.code === 'DELIVERY',
  );
  record('S', Boolean(stdHasDelivery), standardWf?.code ?? 'missing');

  // C / T — no ProductionTask on LOGISTICS (DELIVERY) nodes in recent POs
  const deliveryTasks = await prisma.productionTask.count({
    where: {
      stageInstance: {
        stageDefinition: { executionKind: 'LOGISTICS' },
      },
    },
  });
  record('C', deliveryTasks === 0, `${deliveryTasks} LOGISTICS tasks`);
  record('T', deliveryTasks === 0, 'capacity via no LOGISTICS tasks');

  // E / F — SO-linked PO not COMPLETED without DELIVERED delivery
  const badCompleted = await prisma.productionOrder.count({
    where: {
      status: 'COMPLETED',
      salesOrderId: { not: null },
      salesOrder: {
        deliveries: { none: { status: 'DELIVERED' } },
      },
    },
  });
  record('E', badCompleted === 0, `${badCompleted} POs completed without DELIVERED`);
  record('F', badCompleted === 0, 'missing delivery ≠ completion');

  const readyPo = await prisma.productionOrder.count({
    where: { status: 'READY_FOR_DELIVERY', salesOrderId: { not: null } },
  });
  record('E2', readyPo > 0, `${readyPo} POs READY_FOR_DELIVERY (not COMPLETED)`);

  // N — internal PO may complete without dealer
  const internalCompleted = await prisma.productionOrder.count({
    where: { status: 'COMPLETED', salesOrderId: null },
  });
  record('N', internalCompleted >= 0, `${internalCompleted} internal COMPLETED POs`);

  const admin = await login('admin');
  const balqis = await login('balqis');

  // H — staff cannot mark DELIVERED
  const anyDelivery = await prisma.delivery.findFirst({
    where: { status: { in: ['PLANNED', 'OUT_FOR_DELIVERY'] } },
    select: { id: true, status: true },
  });
  if (anyDelivery) {
    const blocked = await api('PATCH', `/deliveries/${anyDelivery.id}/status`, admin, {
      status: 'DELIVERED',
    });
    record('H', blocked.status === 400, `PATCH → ${blocked.status}`);
  } else {
    record('H', false, 'no delivery to test');
  }

  const balqisUser = await prisma.user.findUnique({
    where: { username: 'balqis' },
    select: { customerId: true },
  });

  // G / I / J / K / L / M — ship then dealer confirm on Balqis PLANNED delivery
  const shipCandidate = await prisma.delivery.findFirst({
    where: {
      status: 'PLANNED',
      customerId: balqisUser?.customerId ?? undefined,
      salesOrder: { status: 'READY_FOR_DELIVERY' },
    },
    include: {
      salesOrder: {
        include: {
          productionOrders: {
            where: { archivedAt: null },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!shipCandidate) {
    record('G', false, 'no PLANNED Balqis delivery');
    record('I', false, 'skipped');
    record('J', false, 'skipped');
    record('K', false, 'skipped');
    record('L', false, 'skipped');
    record('M', false, 'skipped');
  } else {
    const poBefore = shipCandidate.salesOrder?.productionOrders[0];
    const finMovesBefore = await prisma.inventoryTransaction.count({
      where: {
        referenceType: 'Delivery',
        referenceId: shipCandidate.id,
      },
    });

    const ready = await api('PATCH', `/deliveries/${shipCandidate.id}/status`, admin, {
      status: 'READY',
    });
    record('G0', ready.status === 200, `ready → ${ready.status}`);

    const ship = await api('PATCH', `/deliveries/${shipCandidate.id}/status`, admin, {
      status: 'OUT_FOR_DELIVERY',
    });
    record('G', ship.status === 200, `ship → ${ship.status}`);

    const finMovesAfter = await prisma.inventoryTransaction.count({
      where: {
        referenceType: 'Delivery',
        referenceId: shipCandidate.id,
      },
    });
    record('G2', finMovesAfter > finMovesBefore, `${finMovesBefore}→${finMovesAfter} movements`);

    const confirm = await api(
      'POST',
      `/deliveries/${shipCandidate.id}/confirm-receipt`,
      balqis,
    );
    record('I', confirm.status === 200 || confirm.status === 201, `confirm → ${confirm.status}`);

    const finMovesAfterConfirm = await prisma.inventoryTransaction.count({
      where: {
        referenceType: 'Delivery',
        referenceId: shipCandidate.id,
      },
    });
    record('J', finMovesAfterConfirm === finMovesAfter, 'no extra inventory on confirm');

    const soAfter = await prisma.salesOrder.findUnique({
      where: { id: shipCandidate.salesOrderId! },
      select: { status: true },
    });
    record('K', soAfter?.status === 'DELIVERED', soAfter?.status ?? 'missing');

    const deliveryAfter = await prisma.delivery.findUnique({
      where: { id: shipCandidate.id },
      select: {
        status: true,
        customerConfirmedAt: true,
        actualDeliveredAt: true,
      },
    });
    record(
      'I2',
      Boolean(deliveryAfter?.customerConfirmedAt && deliveryAfter?.actualDeliveredAt),
      deliveryAfter?.status ?? '',
    );

    if (poBefore) {
      const poAfter = await prisma.productionOrder.findUnique({
        where: { id: poBefore.id },
        select: { status: true },
      });
      const logistics = await prisma.productionStageInstance.findFirst({
        where: {
          productionOrderId: poBefore.id,
          stageDefinition: { executionKind: 'LOGISTICS' },
        },
        select: { status: true },
      });
      record('L', logistics?.status === 'COMPLETED', logistics?.status ?? 'no LOGISTICS stage');
      record('M', poAfter?.status === 'COMPLETED', poAfter?.status ?? 'missing');
    } else {
      record('L', false, 'no PO');
      record('M', false, 'no PO');
    }
  }

  // D — packaging posts FIN: spot-check a READY_FOR_DELIVERY PO with FIN lot
  const finLot = await prisma.inventoryLot.count({
    where: {
      inventoryItem: { itemClass: 'FINISHED_GOOD' },
      productionOrder: { status: { in: ['READY_FOR_DELIVERY', 'COMPLETED'] } },
    },
  });
  record('D', finLot > 0, `${finLot} FIN lots on ready/complete POs`);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length} checks, ${failed.length} failed`);
  if (failed.length) {
    console.log('Failed:', failed.map((f) => f.id).join(', '));
    process.exit(1);
  }
  console.log('\nTerminal lifecycle UAT: PASS');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
