import { readFileSync } from 'fs';
import { join } from 'path';

const hero = readFileSync(join(__dirname, '../components/PurchasingHeroActions.tsx'), 'utf8');
const tabs = readFileSync(join(__dirname, '../components/PurchasingTabBar.tsx'), 'utf8');

describe('purchasing hub chrome', () => {
  it('fires each hero tile', () => {
    expect(hero).toContain('onNewOrder');
    expect(hero).toContain('onLowStock');
    expect(hero).toContain('onSuppliers');
    expect(hero).toContain('catalog.newPurchaseOrder');
    expect(hero).toContain('catalog.fromLowStock');
    expect(hero).toContain('mobile.purchasing.suppliers');
  });

  it('fires each tab without throwing', () => {
    expect(tabs).toContain('onChange(item.key)');
    expect(tabs).toContain('orders:');
    expect(tabs).toContain('invoices:');
    expect(tabs).toContain('fabric:');
    expect(tabs).not.toContain('requests:');
  });
});
