import { matchCatalogSku } from '../matchCatalogSku';

describe('matchCatalogSku', () => {
  it('opens a catalog product only when the SKU matches exactly', () => {
    expect(matchCatalogSku('ARM-01', [{ id: 'p1', sku: 'ARM-01' }])).toEqual({ id: 'p1' });
    expect(matchCatalogSku('ARM', [{ id: 'p1', sku: 'ARM-01' }])).toBeNull();
  });
});
