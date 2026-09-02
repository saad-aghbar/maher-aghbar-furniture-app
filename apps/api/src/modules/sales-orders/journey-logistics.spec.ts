import { buildJourneyLogisticsSummary } from './journey-logistics';

describe('buildJourneyLogisticsSummary — locked load model', () => {
  it('Ready for delivery: 0/N loaded → not_started (never invents 0 when unknown)', () => {
    const unknown = buildJourneyLogisticsSummary({
      delivery: {
        id: 'd1',
        number: 'DEL-1',
        status: 'READY',
        loadPieces: [],
      },
      soStatus: 'READY_FOR_DELIVERY',
      poStatuses: ['READY_FOR_DELIVERY'],
    });
    expect(unknown?.packageCount).toBeNull();
    expect(unknown?.loadStatus).toBeNull();
    expect(unknown?.finReady).toBe(true);

    const zeroLoaded = buildJourneyLogisticsSummary({
      delivery: {
        id: 'd1',
        number: 'DEL-1',
        status: 'READY',
        loadPieces: [
          { id: 'p1', pieceIndex: 1, loadedAt: null },
          { id: 'p2', pieceIndex: 2, loadedAt: null },
        ],
      },
    });
    expect(zeroLoaded?.packagesLoaded).toBe(0);
    expect(zeroLoaded?.packagesTotal).toBe(2);
    expect(zeroLoaded?.loadStatus).toBe('not_started');
    expect(zeroLoaded?.firstMissingPackageIndex).toBe(1);
  });

  it('Partial loading X/N → loading (not shipped)', () => {
    const summary = buildJourneyLogisticsSummary({
      delivery: {
        id: 'd1',
        number: 'DEL-1',
        status: 'READY',
        loadPieces: [
          { id: 'p1', pieceIndex: 1, loadedAt: '2026-09-01T08:00:00.000Z' },
          { id: 'p2', pieceIndex: 2, loadedAt: null },
          {
            id: 'p3',
            pieceIndex: 3,
            loadedAt: null,
            inventoryLot: {
              warehouse: { code: 'FG', nameEn: 'Finished Goods', nameAr: 'FG' },
            },
          },
        ],
      },
    });
    expect(summary?.packagesLoaded).toBe(1);
    expect(summary?.packagesTotal).toBe(3);
    expect(summary?.loadStatus).toBe('loading');
    expect(summary?.firstMissingPackageIndex).toBe(2);
    expect(summary?.truckDepartedAt).toBeNull();
  });

  it('Fully loaded N/N but NOT shipped → fully_loaded', () => {
    const summary = buildJourneyLogisticsSummary({
      delivery: {
        id: 'd1',
        number: 'DEL-1',
        status: 'READY',
        loadPieces: [
          { id: 'p1', pieceIndex: 1, loadedAt: '2026-09-01T08:00:00.000Z' },
          { id: 'p2', pieceIndex: 2, loadedAt: '2026-09-01T08:05:00.000Z' },
        ],
      },
    });
    expect(summary?.loadStatus).toBe('fully_loaded');
    expect(summary?.packagesLoaded).toBe(2);
    expect(summary?.packagesTotal).toBe(2);
    expect(summary?.firstMissingPackageIndex).toBeNull();
    expect(summary?.truckDepartedAt).toBeNull();
  });

  it('Last package checked does NOT imply departed — READY stays fully_loaded', () => {
    const summary = buildJourneyLogisticsSummary({
      delivery: {
        id: 'd1',
        number: 'DEL-1',
        status: 'READY',
        loadPieces: [
          { id: 'p1', pieceIndex: 1, loadedAt: '2026-09-01T08:00:00.000Z' },
          { id: 'p2', pieceIndex: 2, loadedAt: '2026-09-01T08:10:00.000Z' },
        ],
      },
      truckDepartedAt: '2026-09-01T10:00:00.000Z', // ignored unless OUT_FOR_DELIVERY
    });
    expect(summary?.loadStatus).toBe('fully_loaded');
    expect(summary?.truckDepartedAt).toBeNull();
  });

  it('Explicit OUT_FOR_DELIVERY + depart audit → departed / Shipped', () => {
    const summary = buildJourneyLogisticsSummary({
      delivery: {
        id: 'd1',
        number: 'DEL-9',
        status: 'OUT_FOR_DELIVERY',
        loadPieces: [
          { id: 'p1', pieceIndex: 1, loadedAt: '2026-09-01T08:00:00.000Z' },
        ],
      },
      truckDepartedAt: '2026-09-01T10:15:00.000Z',
    });
    expect(summary?.loadStatus).toBe('departed');
    expect(summary?.truckDepartedAt).toBe('2026-09-01T10:15:00.000Z');
  });

  it('Dealer confirm → delivered', () => {
    const summary = buildJourneyLogisticsSummary({
      delivery: {
        id: 'd1',
        number: 'DEL-2',
        status: 'DELIVERED',
        customerConfirmedAt: '2026-09-02T14:00:00.000Z',
        actualDeliveredAt: '2026-09-02T14:00:00.000Z',
        loadPieces: [{ id: 'p1', pieceIndex: 1, loadedAt: '2026-09-01T08:00:00.000Z' }],
      },
      truckDepartedAt: '2026-09-01T10:00:00.000Z',
    });
    expect(summary?.loadStatus).toBe('delivered');
    expect(summary?.dealerConfirmedAt).toBe('2026-09-02T14:00:00.000Z');
  });

  it('loading one SO fully does not complete another SO on the same truck run', () => {
    const soA = buildJourneyLogisticsSummary({
      delivery: {
        id: 'd-a',
        number: 'DEL-A',
        status: 'READY',
        loadPieces: [
          { id: 'a1', pieceIndex: 1, loadedAt: '2026-09-01T08:00:00.000Z' },
          { id: 'a2', pieceIndex: 2, loadedAt: '2026-09-01T08:01:00.000Z' },
        ],
      },
    });
    const soB = buildJourneyLogisticsSummary({
      delivery: {
        id: 'd-b',
        number: 'DEL-B',
        status: 'READY',
        loadPieces: [
          { id: 'b1', pieceIndex: 1, loadedAt: '2026-09-01T08:00:00.000Z' },
          { id: 'b2', pieceIndex: 2, loadedAt: null },
          { id: 'b3', pieceIndex: 3, loadedAt: null },
        ],
      },
    });
    expect(soA?.loadStatus).toBe('fully_loaded');
    expect(soB?.loadStatus).toBe('loading');
    expect(soB?.packagesLoaded).toBe(1);
    expect(soB?.packagesTotal).toBe(3);
    expect(soB?.firstMissingPackageIndex).toBe(2);
  });
});
