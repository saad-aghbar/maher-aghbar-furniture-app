import { percentToStoredTaxRate, storedTaxRateToPercent } from '../invoiceTaxRate';
import {
  applyInvoiceLinePick,
  catalogProductToLinePick,
  customItemToLinePick,
  inventoryItemToLinePick,
} from '../invoiceLineDraft';

describe('invoice tax rate display', () => {
  it('shows a stored fraction as a percent', () => {
    expect(storedTaxRateToPercent(0.16)).toBe(16);
  });

  it('stores a percent as a fraction', () => {
    expect(percentToStoredTaxRate(16)).toBe(0.16);
  });
});

describe('invoice line picks', () => {
  it('fills a catalog row without inventing a zero price', () => {
    const pick = catalogProductToLinePick(
      { nameEn: 'Lounge', nameAr: 'صالة', sku: 'LG-1', price: null, dealerPrice: null },
      'en',
    );
    expect(pick.description).toBe('Lounge');
    expect(pick.unitPrice).toBe('');
  });

  it('uses dealer price when the catalog has one', () => {
    const pick = catalogProductToLinePick(
      { nameEn: 'Lounge', sku: 'LG-1', price: 200, dealerPrice: 180 },
      'en',
    );
    expect(pick.unitPrice).toBe('180');
  });

  it('falls back to basePrice when dealer and list price are missing', () => {
    const pick = catalogProductToLinePick(
      { nameEn: 'Lounge', sku: 'LG-1', basePrice: 220 },
      'en',
    );
    expect(pick.unitPrice).toBe('220');
  });

  it('fills an inventory row from standard cost when present', () => {
    const pick = inventoryItemToLinePick(
      { nameEn: 'Walnut', sku: 'WD-1', standardCost: 12.5 },
      'en',
    );
    expect(pick.description).toBe('Walnut');
    expect(pick.unitPrice).toBe('12.5');
  });

  it('leaves inventory price empty when cost is missing', () => {
    const pick = inventoryItemToLinePick({ nameEn: 'Walnut', sku: 'WD-1' }, 'en');
    expect(pick.unitPrice).toBe('');
  });

  it('builds a custom line from the typed name', () => {
    const pick = customItemToLinePick('Special foam', '40');
    expect(pick.description).toBe('Special foam');
    expect(pick.unitPrice).toBe('40');
    expect(pick.quantity).toBe('1');
  });

  it('replaces an existing line and keeps qty unless the pick sends one', () => {
    const current = [
      {
        key: 'l1',
        id: 'line-1',
        description: 'Old sofa',
        quantity: '2',
        unitPrice: '45',
        taxPercent: '16',
        origin: 'list' as const,
      },
    ];
    const catalog = applyInvoiceLinePick(
      current,
      catalogProductToLinePick({ nameEn: 'Lounge', sku: 'LG-1', dealerPrice: 180 }, 'en'),
      'l1',
    );
    expect(catalog[0]).toMatchObject({
      id: 'line-1',
      key: 'l1',
      description: 'Lounge',
      quantity: '2',
      unitPrice: '180',
    });
    const custom = applyInvoiceLinePick(current, customItemToLinePick('Foam', '40', '3'), 'l1');
    expect(custom[0]).toMatchObject({
      id: 'line-1',
      description: 'Foam',
      quantity: '3',
      origin: 'custom',
    });
  });
});
