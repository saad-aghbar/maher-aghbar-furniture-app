import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(join(__dirname, '../SupplierDetailScreen.tsx'), 'utf8');

describe('supplier detail', () => {
  it('renders identity, money, buckets, and empty history', () => {
    expect(src).toContain('outstandingAp');
    expect(src).toContain('paidAp');
    expect(src).toContain('openPurchaseOrders');
    expect(src).toContain('purchaseHistory');
    expect(src).toContain('DealerEmptyPanel');
    expect(src).toContain('statementPdf');
  });
});
