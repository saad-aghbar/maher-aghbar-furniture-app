import { describe, expect, it } from 'vitest';
import { deriveOrderLifecycle } from './order-lifecycle';
import { deriveProductionLifecycle, openManufacturingWork } from './production-lifecycle';

describe('deriveOrderLifecycle', () => {
  it('does not treat a completed factory child as delivered', () => {
    expect(
      deriveOrderLifecycle({
        salesOrderStatus: 'COMPLETED',
        productionOrders: [{ status: 'COMPLETED', currentStageCode: 'PACKAGING' }],
      }),
    ).toBe('ready');
  });

  it('follows the least-advanced line, not the first production order', () => {
    expect(
      deriveOrderLifecycle({
        salesOrderStatus: 'IN_PRODUCTION',
        productionOrders: [
          { status: 'COMPLETED', currentStageCode: 'PACKAGING' },
          { status: 'IN_PROGRESS', currentStageCode: 'INSPECTION' },
        ],
      }),
    ).toBe('inspection');
  });

  it('uses a recorded delivery receipt for delivered', () => {
    expect(
      deriveOrderLifecycle({
        salesOrderStatus: 'IN_PRODUCTION',
        deliveryStatus: 'DELIVERED',
        productionOrders: [{ status: 'IN_PROGRESS', currentStageCode: 'CARPENTRY' }],
      }),
    ).toBe('delivered');
  });
});

describe('deriveProductionLifecycle', () => {
  it('keeps a completed factory order short of delivered until receipt', () => {
    expect(deriveProductionLifecycle({ poStatus: 'COMPLETED' })).toBe('ready');
  });

  it('sends finished manufacturing to inspection without calling it delivered', () => {
    expect(
      deriveProductionLifecycle({
        poStatus: 'IN_PROGRESS',
        currentStageCode: null,
        stages: [
          { status: 'COMPLETED', stageDefinition: { code: 'CARPENTRY' } },
          { status: 'COMPLETED', stageDefinition: { code: 'FOAM' } },
        ],
      }),
    ).toBe('inspection');
  });

  it('keeps production current while a manufacturing task is not started', () => {
    expect(
      deriveProductionLifecycle({
        poStatus: 'IN_PROGRESS',
        currentStageCode: null,
        stages: [
          {
            status: 'COMPLETED',
            stageDefinition: { code: 'CARPENTRY', sortOrder: 1 },
            tasks: [{ status: 'NOT_STARTED' }],
          },
          {
            status: 'COMPLETED',
            stageDefinition: { code: 'FOAM', sortOrder: 2 },
            tasks: [{ status: 'COMPLETED' }],
          },
        ],
      }),
    ).toBe('production');
  });

  it('moves to inspection only after every manufacturing task is completed', () => {
    expect(
      deriveProductionLifecycle({
        poStatus: 'IN_PROGRESS',
        currentStageCode: null,
        stages: [
          {
            status: 'COMPLETED',
            stageDefinition: { code: 'CARPENTRY' },
            tasks: [{ status: 'COMPLETED' }],
          },
          {
            status: 'COMPLETED',
            stageDefinition: { code: 'FOAM' },
            tasks: [{ status: 'COMPLETED' }],
          },
        ],
      }),
    ).toBe('inspection');
  });

  it('names the not-started task instead of the completed stage row', () => {
    const open = openManufacturingWork([
      {
        status: 'COMPLETED',
        stageDefinition: { code: 'CARPENTRY', sortOrder: 1 },
        tasks: [{ status: 'NOT_STARTED' }],
      },
      {
        status: 'COMPLETED',
        stageDefinition: { code: 'FOAM', sortOrder: 2 },
        tasks: [{ status: 'COMPLETED' }],
      },
    ]);
    expect(open?.stage.stageDefinition.code).toBe('CARPENTRY');
    expect(open?.status).toBe('NOT_STARTED');
  });

  it('marks delivered only from the delivery record', () => {
    expect(
      deriveProductionLifecycle({ poStatus: 'COMPLETED', deliveryStatus: 'DELIVERED' }),
    ).toBe('delivered');
  });
});
