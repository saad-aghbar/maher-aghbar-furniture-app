import {
  assertFabricUatWorld,
  FABRIC_UAT_EXPECTATIONS,
  type FabricUatDb,
} from './fabric-uat-world';

type Task = { id: string; stageDefinition: { code: string } | null };
type Procurement = {
  state: string;
  requirement: { requestedFabricLabel: string | null } | null;
  lots: Array<{ qrCode: string | null }>;
};

/** The world a fresh `demo:reset` plus the canonical release should produce. */
function completeWorld() {
  return {
    order: {
      id: 'so-fb1042',
      productionOrders: [
        {
          id: 'po-1',
          tasks: [
            { id: 't-carpentry', stageDefinition: { code: 'CARPENTRY' } },
            { id: 't-upholstery', stageDefinition: { code: 'UPHOLSTERY' } },
          ] as Task[],
        },
      ],
    },
    procurements: FABRIC_UAT_EXPECTATIONS.map((f) => ({
      state: f.state,
      requirement: { requestedFabricLabel: f.label },
      lots: f.qrCode ? [{ qrCode: f.qrCode }] : [],
    })) as Procurement[],
  };
}

function dbFor(world: {
  order: ReturnType<typeof completeWorld>['order'] | null;
  procurements: Procurement[];
}): FabricUatDb {
  return {
    salesOrder: { findUnique: jest.fn().mockResolvedValue(world.order) },
    fabricProcurement: { findMany: jest.fn().mockResolvedValue(world.procurements) },
  } as unknown as FabricUatDb;
}

describe('demo fabric UAT world', () => {
  it('accepts a complete SO-FB1042 world and reports the testable subject', async () => {
    const world = await assertFabricUatWorld(dbFor(completeWorld()));

    expect(world).toEqual({
      salesOrderId: 'so-fb1042',
      productionOrderId: 'po-1',
      upholsteryTaskId: 't-upholstery',
      ready: 2,
      required: 3,
      qrCodes: ['FB-SOFB1042-001', 'FB-SOFB1042-002'],
    });
  });

  it('fails when the fabric fixture did not run at all', async () => {
    const db = dbFor({ order: null, procurements: [] });
    await expect(assertFabricUatWorld(db)).rejects.toThrow(/SO-FB1042 does not exist/);
  });

  it('fails when the reset leaves the order unreleased', async () => {
    const w = completeWorld();
    w.order.productionOrders = [];
    await expect(assertFabricUatWorld(dbFor(w))).rejects.toThrow(/no production order/);
  });

  it('fails when the released order has no upholstery task', async () => {
    const w = completeWorld();
    w.order.productionOrders[0]!.tasks = [
      { id: 't-carpentry', stageDefinition: { code: 'CARPENTRY' } },
    ];
    await expect(assertFabricUatWorld(dbFor(w))).rejects.toThrow(/no UPHOLSTERY task/);
  });

  it('fails when a fabric drifts off its intended demo state', async () => {
    const w = completeWorld();
    const boucle = w.procurements.find(
      (p) => p.requirement?.requestedFabricLabel === 'Bouclé 611 · Cream',
    )!;
    boucle.state = 'READY_FOR_PICKUP';
    await expect(assertFabricUatWorld(dbFor(w))).rejects.toThrow(
      /"Bouclé 611 · Cream" is READY_FOR_PICKUP, expected WAITING/,
    );
  });

  it('fails when a holding lot QR is missing', async () => {
    const w = completeWorld();
    const velvet = w.procurements.find(
      (p) => p.requirement?.requestedFabricLabel === 'Velvet 302 · Sand',
    )!;
    velvet.lots = [];
    await expect(assertFabricUatWorld(dbFor(w))).rejects.toThrow(
      /missing holding lot FB-SOFB1042-001/,
    );
  });

  it('fails when the late fabric was given a lot it should not have', async () => {
    const w = completeWorld();
    const boucle = w.procurements.find(
      (p) => p.requirement?.requestedFabricLabel === 'Bouclé 611 · Cream',
    )!;
    boucle.lots = [{ qrCode: 'FB-SOFB1042-003' }];
    await expect(assertFabricUatWorld(dbFor(w))).rejects.toThrow(
      /should have no holding lot yet/,
    );
  });

  it('reports every problem in one run rather than only the first', async () => {
    const w = completeWorld();
    w.order.productionOrders[0]!.tasks = [];
    w.procurements = w.procurements.filter(
      (p) => p.requirement?.requestedFabricLabel !== 'Linen 180 · Natural',
    );

    const err = await assertFabricUatWorld(dbFor(w)).catch((e: Error) => e);
    const message = (err as Error).message;
    expect(message).toMatch(/no UPHOLSTERY task/);
    expect(message).toMatch(/expected 3 fabric procurements, found 2/);
    expect(message).toMatch(/missing fabric "Linen 180 · Natural"/);
  });
});
