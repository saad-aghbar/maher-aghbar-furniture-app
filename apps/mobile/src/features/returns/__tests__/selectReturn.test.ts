import {
  filterDealersByQuery,
  isReturnStatusFilterActive,
} from '../returnFilters';
import {
  mapReturnLifecyclePhase,
  returnMatchesStatusChip,
  returnReasonLabelKey,
  selectReturnCard,
} from '../selectReturn';
import type { ReturnRequest } from '../api';

describe('returnFilters', () => {
  it('filters dealers by query', () => {
    const dealers = [
      { id: '1', name: 'Nile Interiors', code: 'NIL', searchText: 'Nile' },
      { id: '2', name: 'Zarqa Timber', code: 'ZAR', searchText: 'Zarqa' },
    ];
    expect(filterDealersByQuery(dealers, 'nil')).toHaveLength(1);
    expect(filterDealersByQuery(dealers, '')).toHaveLength(2);
  });

  it('detects active status filter', () => {
    expect(isReturnStatusFilterActive('ALL')).toBe(false);
    expect(isReturnStatusFilterActive('PENDING')).toBe(true);
  });
});

describe('mapReturnLifecyclePhase', () => {
  it('maps approval + physical to dealer human phases', () => {
    expect(mapReturnLifecyclePhase({ approvalStatus: 'PENDING' })).toBe('REPORTED');
    expect(mapReturnLifecyclePhase({ approvalStatus: 'NEED_INFO' })).toBe('UNDER_REVIEW');
    expect(
      mapReturnLifecyclePhase({
        approvalStatus: 'APPROVED',
        physicalStatus: 'NONE',
      }),
    ).toBe('APPROVED');
    expect(
      mapReturnLifecyclePhase({
        approvalStatus: 'APPROVED',
        physicalStatus: 'WAITING_RETURN',
      }),
    ).toBe('WAITING_RETURN');
    expect(
      mapReturnLifecyclePhase({
        approvalStatus: 'APPROVED',
        physicalStatus: 'RETURNED',
      }),
    ).toBe('BEING_RESOLVED');
    expect(
      mapReturnLifecyclePhase({
        approvalStatus: 'APPROVED',
        physicalStatus: 'RETURNED',
        inventoryFate: 'RETURN_TO_STOCK',
      }),
    ).toBe('RESOLVED');
    expect(mapReturnLifecyclePhase({ approvalStatus: 'REJECTED' })).toBe('RESOLVED');
  });
});

describe('returnMatchesStatusChip', () => {
  it('groups NEED_INFO with open / PENDING chip', () => {
    expect(
      returnMatchesStatusChip({ approvalStatus: 'NEED_INFO' }, 'PENDING'),
    ).toBe(true);
    expect(
      returnMatchesStatusChip(
        { approvalStatus: 'APPROVED', physicalStatus: 'WAITING_RETURN' },
        'APPROVED',
      ),
    ).toBe(true);
    expect(
      returnMatchesStatusChip({ approvalStatus: 'REJECTED' }, 'REJECTED'),
    ).toBe(true);
  });
});

describe('selectReturnCard', () => {
  const row: ReturnRequest = {
    id: 'r1',
    number: 'RET-11004',
    productDesc: 'Outdoor Sofa Set',
    quantity: 1,
    reason: 'MANUFACTURING_DEFECT',
    description: 'Edge scuff',
    approvalStatus: 'APPROVED',
    physicalStatus: 'WAITING_RETURN',
    needInfoNote: null,
    reasonPhotoUrl: '/uploads/r.jpg',
    issuePhotoUrl: null,
    productImageUrl: null,
    customer: {
      id: 'c1',
      name: 'Nile',
      nameEn: 'Nile Interiors',
      nameAr: 'نايل',
    },
    salesOrder: {
      id: 'so1',
      number: 'SO-01072',
      externalOrderNumber: 'EXT-4390',
    },
  };

  it('maps card fields and reason key', () => {
    expect(returnReasonLabelKey('MANUFACTURING_DEFECT')).toBe(
      'catalog.returnReason.MANUFACTURING_DEFECT',
    );
    const card = selectReturnCard(row, 'en');
    expect(card.number).toBe('RET-11004');
    expect(card.dealerName).toBe('Nile Interiors');
    expect(card.salesOrderNumber).toBe('SO-01072');
    expect(card.dealerOrderNumber).toBe('EXT-4390');
    expect(card.quantityLabel).toBe('1');
    expect(card.isPending).toBe(false);
    expect(card.lifecyclePhase).toBe('WAITING_RETURN');
    expect(card.lifecycleLabelKey).toBe('mobile.returns.lifecycle.WAITING_RETURN');
    expect(card.reasonLabelKey).toContain('MANUFACTURING_DEFECT');
  });

  it('exposes needInfoNote when NEED_INFO', () => {
    const card = selectReturnCard(
      {
        ...row,
        approvalStatus: 'NEED_INFO',
        physicalStatus: 'NONE',
        needInfoNote: 'Please add damage photos',
      },
      'en',
    );
    expect(card.lifecyclePhase).toBe('UNDER_REVIEW');
    expect(card.needsInfo).toBe(true);
    expect(card.needInfoNote).toBe('Please add damage photos');
    expect(card.isPending).toBe(true);
  });

  it('uses Arabic dealer name', () => {
    expect(selectReturnCard(row, 'ar').dealerName).toBe('نايل');
  });

  it('maps multi-photo galleries and falls back to singular urls', () => {
    const multi = selectReturnCard(
      {
        ...row,
        reasonPhotoUrls: ['/a.jpg', '/b.jpg'],
        issuePhotoUrls: ['/c.jpg'],
      },
      'en',
    );
    expect(multi.reasonPhotoUrls).toEqual(['/a.jpg', '/b.jpg']);
    expect(multi.issuePhotoUrls).toEqual(['/c.jpg']);
    expect(multi.reasonPhotoUrl).toBe('/a.jpg');

    const legacy = selectReturnCard(row, 'en');
    expect(legacy.reasonPhotoUrls).toEqual(['/uploads/r.jpg']);
    expect(legacy.issuePhotoUrls).toEqual([]);
  });
});
