import type { WipKitBoardSection, WipKitCard } from '@/api/modules/inventory';
import {
  boardParamsForSemiFilter,
  isSemiKitActive,
  selectSemiOrderStageSections,
  selectSemiOrdersFromBoard,
  semiKitFloorStatus,
} from '../selectSemiOrders';

function kit(
  overrides: Partial<WipKitCard> & {
    orderId: string;
    orderNumber: string;
    status: string;
    stageCode?: string;
  },
): WipKitCard {
  const {
    orderId,
    orderNumber,
    status,
    stageCode = 'CARPENTRY',
    ...rest
  } = overrides;
  return {
    id: rest.id ?? `${orderId}-${stageCode}-${status}`,
    status,
    qrCode: rest.qrCode ?? `QR-${orderNumber}`,
    expectedPieceCount: 1,
    productionOrder: {
      id: orderId,
      number: orderNumber,
      productDescription: rest.productionOrder?.productDescription ?? 'Sofa',
      product: rest.productionOrder?.product ?? {
        nameEn: 'Sofa',
        nameAr: 'كنبة',
        imageUrl: null,
      },
    },
    stageInstance: {
      stageDefinition: {
        code: stageCode,
        nameEn: stageCode === 'ASSEMBLY' ? 'Assembly' : 'Carpentry',
        nameAr: stageCode === 'ASSEMBLY' ? 'تجميع' : 'نجارة',
        nameHe: null,
      },
    },
    pieces: [],
    ...rest,
  };
}

const board: WipKitBoardSection[] = [
  {
    stageCode: 'CARPENTRY',
    stageNameEn: 'Carpentry',
    stageNameAr: 'نجارة',
    stageNameHe: null,
    kits: [
      kit({ orderId: 'po-1', orderNumber: 'PO-100', status: 'READY', stageCode: 'CARPENTRY' }),
      kit({ orderId: 'po-2', orderNumber: 'PO-200', status: 'OPEN', stageCode: 'CARPENTRY' }),
      kit({
        orderId: 'po-1',
        orderNumber: 'PO-100',
        status: 'CONSUMED',
        stageCode: 'CARPENTRY',
        id: 'po-1-old',
      }),
    ],
  },
  {
    stageCode: 'ASSEMBLY',
    stageNameEn: 'Assembly',
    stageNameAr: 'تجميع',
    stageNameHe: null,
    kits: [
      kit({ orderId: 'po-1', orderNumber: 'PO-100', status: 'CLAIMED', stageCode: 'ASSEMBLY' }),
      kit({ orderId: 'po-3', orderNumber: 'PO-300', status: 'CANCELLED', stageCode: 'ASSEMBLY' }),
    ],
  },
];

describe('semiKitFloorStatus', () => {
  it('maps kit statuses to floor language', () => {
    expect(semiKitFloorStatus({ status: 'OPEN' })).toBe('at_station');
    expect(semiKitFloorStatus({ status: 'READY' })).toBe('in_warehouse');
    expect(semiKitFloorStatus({ status: 'CLAIMED' })).toBe('received');
    expect(semiKitFloorStatus({ status: 'CONSUMED' })).toBe('used');
    expect(semiKitFloorStatus({ status: 'CANCELLED' })).toBe('cancelled');
  });
});

describe('isSemiKitActive / boardParamsForSemiFilter', () => {
  it('treats consumed and cancelled as inactive', () => {
    expect(isSemiKitActive('READY')).toBe(true);
    expect(isSemiKitActive('CONSUMED')).toBe(false);
    expect(isSemiKitActive('CANCELLED')).toBe(false);
  });

  it('requests history scope with optional warehouse and dates', () => {
    expect(boardParamsForSemiFilter('active')).toEqual({ scope: 'active' });
    expect(
      boardParamsForSemiFilter('history', {
        from: '2026-01-01',
        to: '2026-01-31',
        warehouseId: 'wh-1',
        q: 'sofa',
      }),
    ).toEqual({
      scope: 'history',
      from: '2026-01-01',
      to: '2026-01-31',
      warehouseId: 'wh-1',
      q: 'sofa',
    });
  });
});

describe('selectSemiOrdersFromBoard', () => {
  it('groups kits by production order and drops inactive on Active filter', () => {
    const groups = selectSemiOrdersFromBoard(board, { filter: 'active' });
    expect(groups.map((g) => g.number)).toEqual(['PO-100', 'PO-200']);
    const po1 = groups.find((g) => g.productionOrderId === 'po-1')!;
    expect(po1.counts.total).toBe(2);
    expect(po1.counts.inWarehouse).toBe(1);
    expect(po1.counts.received).toBe(1);
    expect(po1.counts.used).toBe(0);
    expect(po1.kits).toHaveLength(2);
  });

  it('includes used and cancelled kits on History filter', () => {
    const groups = selectSemiOrdersFromBoard(board, { filter: 'history' });
    expect(groups.map((g) => g.number)).toEqual(['PO-100', 'PO-200', 'PO-300']);
    const po1 = groups.find((g) => g.productionOrderId === 'po-1')!;
    expect(po1.counts.used).toBe(1);
    expect(po1.counts.total).toBe(3);
    const po3 = groups.find((g) => g.productionOrderId === 'po-3')!;
    expect(po3.counts.cancelled).toBe(1);
  });

  it('filters by search across order number and product', () => {
    const groups = selectSemiOrdersFromBoard(board, { filter: 'history', q: 'PO-200' });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.number).toBe('PO-200');
  });
});

describe('selectSemiOrderStageSections', () => {
  it('keeps stage sections with only active kits', () => {
    const sections = selectSemiOrderStageSections(board, { filter: 'active' });
    expect(sections.map((s) => s.stageCode)).toEqual(['CARPENTRY', 'ASSEMBLY']);
    expect(sections[0]!.kits.every((k) => isSemiKitActive(k.status))).toBe(true);
  });
});
