import { readFileSync } from 'fs';
import { join } from 'path';

describe('InvoiceBalanceBoard', () => {
  it('renders total exactly once', () => {
    const source = readFileSync(
      join(__dirname, '../components/InvoiceBalanceBoard.tsx'),
      'utf8',
    );
    const matches = source.match(/t\('accounting\.total'\)/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(source).toContain("t('accounting.subtotal')");
    expect(source).toContain("t('accounting.tax')");
  });
});
