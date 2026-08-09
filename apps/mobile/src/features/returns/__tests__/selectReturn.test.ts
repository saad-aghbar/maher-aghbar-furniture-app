import {
  filterDealersByQuery,
  isReturnStatusFilterActive,
} from '../returnFilters';
import { returnReasonLabelKey, selectReturnCard } from '../selectReturn';
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

describe('selectReturnCard', () => {
  const row: ReturnRequest = {
    id: 'r1',
    number: 'RET-11004',
    productDesc: 'Outdoor Sofa Set',
    quantity: 1,
    reason: 'MANUFACTURING_DEFECT',
    description: 'Edge scuff',
    approvalStatus: 'APPROVED',
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
    expect(card.reasonLabelKey).toContain('MANUFACTURING_DEFECT');
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
