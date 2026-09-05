/**
 * Demo determinism guard for the SO-FB1042 fabric UAT world.
 *
 * The seed builds the order, its three fabric procurements and the holding
 * lots; the canonical release adds the production order and its upholstery
 * task. This asserts the whole world is present so a fresh `demo:reset`
 * either produces all seven testable fabric routes or fails loudly.
 */
import { FabricProcurementState, type Prisma } from '@maher/database';

export const FABRIC_UAT_ORDER_NUMBER = 'SO-FB1042';
export const FABRIC_UAT_STAGE_CODE = 'UPHOLSTERY';

/** Intended demo state per fabric: two settled, one late. */
export const FABRIC_UAT_EXPECTATIONS = [
  {
    label: 'Velvet 302 · Sand',
    state: FabricProcurementState.READY_FOR_PICKUP,
    qrCode: 'FB-SOFB1042-001',
    readyForProduction: true,
  },
  {
    label: 'Linen 180 · Natural',
    state: FabricProcurementState.PARTIALLY_AVAILABLE,
    qrCode: 'FB-SOFB1042-002',
    readyForProduction: true,
  },
  {
    label: 'Bouclé 611 · Cream',
    state: FabricProcurementState.WAITING,
    qrCode: null,
    readyForProduction: false,
  },
] as const;

export const FABRIC_UAT_READY_COUNT = FABRIC_UAT_EXPECTATIONS.filter(
  (f) => f.readyForProduction,
).length;
export const FABRIC_UAT_REQUIRED_COUNT = FABRIC_UAT_EXPECTATIONS.length;

export type FabricUatWorld = {
  salesOrderId: string;
  productionOrderId: string;
  upholsteryTaskId: string;
  ready: number;
  required: number;
  qrCodes: string[];
};

export type FabricUatDb = Prisma.TransactionClient;

function fail(problems: string[]): never {
  throw new Error(
    `Demo fabric UAT world for ${FABRIC_UAT_ORDER_NUMBER} is incomplete:\n` +
      problems.map((p) => `  - ${p}`).join('\n'),
  );
}

/**
 * Throws with every problem at once, so one reset run tells the whole story
 * instead of failing on the first missing row.
 */
export async function assertFabricUatWorld(db: FabricUatDb): Promise<FabricUatWorld> {
  const order = await db.salesOrder.findUnique({
    where: { number: FABRIC_UAT_ORDER_NUMBER },
    select: {
      id: true,
      productionOrders: {
        select: {
          id: true,
          tasks: { select: { id: true, stageDefinition: { select: { code: true } } } },
        },
      },
    },
  });

  if (!order) {
    fail([`${FABRIC_UAT_ORDER_NUMBER} does not exist — the fabric fixture did not run.`]);
  }

  const problems: string[] = [];

  const productionOrder = order.productionOrders[0];
  if (!productionOrder) {
    problems.push(
      'no production order — release did not run, so Production Detail and Worker Task have no subject.',
    );
  }

  const upholstery = productionOrder?.tasks.find(
    (t) => t.stageDefinition?.code === FABRIC_UAT_STAGE_CODE,
  );
  if (productionOrder && !upholstery) {
    problems.push(
      `production order ${productionOrder.id} has no ${FABRIC_UAT_STAGE_CODE} task, so the worker fabric take-in has nothing to show.`,
    );
  }

  const procurements = await db.fabricProcurement.findMany({
    where: { salesOrder: { number: FABRIC_UAT_ORDER_NUMBER } },
    select: {
      state: true,
      requirement: { select: { requestedFabricLabel: true } },
      lots: { select: { qrCode: true } },
    },
  });

  if (procurements.length !== FABRIC_UAT_REQUIRED_COUNT) {
    problems.push(
      `expected ${FABRIC_UAT_REQUIRED_COUNT} fabric procurements, found ${procurements.length}.`,
    );
  }

  const byLabel = new Map(
    procurements.map((p) => [p.requirement?.requestedFabricLabel ?? '(unlabelled)', p]),
  );

  for (const want of FABRIC_UAT_EXPECTATIONS) {
    const got = byLabel.get(want.label);
    if (!got) {
      problems.push(`missing fabric "${want.label}".`);
      continue;
    }
    if (got.state !== want.state) {
      problems.push(`"${want.label}" is ${got.state}, expected ${want.state}.`);
    }
    const codes = got.lots.map((l) => l.qrCode).filter((c): c is string => Boolean(c));
    if (want.qrCode && !codes.includes(want.qrCode)) {
      problems.push(
        `"${want.label}" is missing holding lot ${want.qrCode} (found ${codes.join(', ') || 'none'}).`,
      );
    }
    if (!want.qrCode && codes.length > 0) {
      problems.push(`"${want.label}" should have no holding lot yet, found ${codes.join(', ')}.`);
    }
  }

  if (problems.length > 0) fail(problems);

  return {
    salesOrderId: order.id,
    productionOrderId: productionOrder!.id,
    upholsteryTaskId: upholstery!.id,
    ready: FABRIC_UAT_READY_COUNT,
    required: FABRIC_UAT_REQUIRED_COUNT,
    qrCodes: FABRIC_UAT_EXPECTATIONS.flatMap((f) => (f.qrCode ? [f.qrCode as string] : [])),
  };
}
