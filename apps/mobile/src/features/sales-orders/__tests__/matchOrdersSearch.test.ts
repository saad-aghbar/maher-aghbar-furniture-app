import { matchOrdersSearch } from '../matchOrdersSearch';

describe('matchOrdersSearch', () => {
  const sample = {
    number: 'SO-VOL-0001',
    title: 'Lobby Sofa · R1',
    externalOrderNumber: 'PO-C1-001',
    requiredDeliveryDate: '2026-08-05T00:00:00.000Z',
    customer: { name: 'Nile Interiors', nameEn: 'Nile Interiors', code: 'C1' },
    productionOrderNumbers: ['FO-0001'],
  };

  it('matches order number, title, dealer, dealer PO, and factory PO', () => {
    expect(matchOrdersSearch(sample, 'SO-VOL-0001')).toBe(true);
    expect(matchOrdersSearch(sample, 'lobby')).toBe(true);
    expect(matchOrdersSearch(sample, 'Nile')).toBe(true);
    expect(matchOrdersSearch(sample, 'PO-C1')).toBe(true);
    expect(matchOrdersSearch(sample, 'FO-0001')).toBe(true);
  });

  it('matches formatted and ISO dates', () => {
    expect(matchOrdersSearch(sample, '2026-08-05')).toBe(true);
    expect(matchOrdersSearch(sample, 'Aug')).toBe(true);
    expect(matchOrdersSearch(sample, '5 Aug')).toBe(true);
  });

  it('rejects unrelated needles', () => {
    expect(matchOrdersSearch(sample, 'Balqis')).toBe(false);
  });
});
