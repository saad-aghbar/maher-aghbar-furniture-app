import { dealerOrCatalogOptions, pickRfqItemForLine } from './rfq-item-spec';

describe('rfq item spec merge', () => {
  it('picks the matching RFQ item by index then productId', () => {
    const items = [
      { productId: 'p1', foamDensity: 'D35' },
      { productId: 'p2', foamDensity: 'D40' },
    ];
    expect(pickRfqItemForLine(items, { productId: 'p1' }, 0)?.foamDensity).toBe('D35');
    expect(pickRfqItemForLine(items, { productId: 'p2' }, 9)?.foamDensity).toBe('D40');
  });

  it('prefers dealer option codes over catalog defaults', () => {
    const merged = dealerOrCatalogOptions(
      { options: [{ specOptionValueId: 'opt-dealer', code: 'D40' }] },
      [{ specOptionValueId: 'opt-catalog', code: 'D35' }],
    );
    expect(merged[0]?.specOptionValueId).toBe('opt-dealer');
  });
});
