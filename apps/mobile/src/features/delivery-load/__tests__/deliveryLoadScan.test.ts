import { nextUnloadPieceForLotQr } from '../deliveryLoadScan';
import type { DeliveryLoadSheet } from '@/api/modules/deliveries';

function sheet(overrides?: Partial<DeliveryLoadSheet['products'][number]>): DeliveryLoadSheet {
  return {
    id: 'd1',
    number: 'DL-1',
    status: 'SCHEDULED',
    deliveryAddress: 'x',
    deliveryDate: null,
    notes: null,
    driverId: null,
    customer: { id: 'c1', nameEn: 'Dealer' },
    salesOrder: null,
    loadProgress: { loaded: 0, total: 2 },
    allLoaded: false,
    canDepart: false,
    products: [
      {
        inventoryLotId: 'lot-1',
        productNameEn: 'Sofa',
        productNameAr: null,
        productNameHe: null,
        sku: 'FG-1',
        imageUrl: null,
        lotQuantity: 1,
        lotQrCode: 'FIN-PO-1-PACK',
        warehouse: { id: 'w', code: 'FIN', nameEn: 'Fin', nameAr: 'Fin' },
        location: null,
        productionOrder: null,
        pieces: [
          {
            id: 'p1',
            pieceIndex: 1,
            label: 'Package 1',
            loadedAt: null,
            loadedById: null,
          },
          {
            id: 'p2',
            pieceIndex: 2,
            label: 'Package 2',
            loadedAt: null,
            loadedById: null,
          },
        ],
        ...overrides,
      },
    ],
  };
}

describe('nextUnloadPieceForLotQr', () => {
  it('returns next unloaded piece for matching lot QR', () => {
    expect(nextUnloadPieceForLotQr(sheet(), 'fin-po-1-pack')).toEqual(
      expect.objectContaining({ pieceId: 'p1' }),
    );
  });

  it('skips already loaded pieces', () => {
    const s = sheet({
      pieces: [
        {
          id: 'p1',
          pieceIndex: 1,
          label: 'Package 1',
          loadedAt: '2026-01-01T00:00:00Z',
          loadedById: 'u1',
        },
        {
          id: 'p2',
          pieceIndex: 2,
          label: 'Package 2',
          loadedAt: null,
          loadedById: null,
        },
      ],
    });
    expect(nextUnloadPieceForLotQr(s, 'FIN-PO-1-PACK')).toEqual(
      expect.objectContaining({ pieceId: 'p2' }),
    );
  });

  it('returns already_loaded when all packages for lot are checked', () => {
    const s = sheet({
      pieces: [
        {
          id: 'p1',
          pieceIndex: 1,
          label: 'Package 1',
          loadedAt: '2026-01-01T00:00:00Z',
          loadedById: 'u1',
        },
        {
          id: 'p2',
          pieceIndex: 2,
          label: 'Package 2',
          loadedAt: '2026-01-01T00:00:00Z',
          loadedById: 'u1',
        },
      ],
    });
    expect(nextUnloadPieceForLotQr(s, 'FIN-PO-1-PACK')).toBe('already_loaded');
  });

  it('returns unknown for foreign QR', () => {
    expect(nextUnloadPieceForLotQr(sheet(), 'FIN-OTHER')).toBe('unknown');
  });
});
