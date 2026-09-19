import {
  dealerVisibleCaption,
  filterNamedPickRows,
  namedPickerCatalogListMinHeight,
  namedPickerSheetHeight,
  shouldOfferCustomName,
} from '../components/NamedPickerSheet';

describe('dealer typed fabric name', () => {
  it('offers a custom name as soon as anything is typed', () => {
    expect(shouldOfferCustomName('Italian Velvet')).toBe(true);
    expect(shouldOfferCustomName('velvet 302')).toBe(true);
    expect(shouldOfferCustomName('  linen beige  ')).toBe(true);
  });

  it('does not offer a custom name on an empty field', () => {
    expect(shouldOfferCustomName('   ')).toBe(false);
    expect(shouldOfferCustomName('')).toBe(false);
  });

  it('hides all-caps sku captions from the dealer list', () => {
    expect(dealerVisibleCaption('FAB-VEL-SAND')).toBeNull();
    expect(dealerVisibleCaption('FAB-BOU-CRM')).toBeNull();
    expect(dealerVisibleCaption('linen beige')).toBe('linen beige');
    expect(dealerVisibleCaption('')).toBeNull();
  });

  it('filters the catalog list independently of a typed custom name', () => {
    const rows = [
      { id: '1', name: 'Linen Beige', caption: 'FAB-LIN' },
      { id: '2', name: 'Velvet 302' },
    ];
    expect(filterNamedPickRows('nope', rows)).toEqual([]);
    expect(filterNamedPickRows('vel', rows).map((row) => row.id)).toEqual(['2']);
    expect(filterNamedPickRows('', rows)).toHaveLength(2);
  });

  it('gives the catalog list a taller scroll area on phone and iPad', () => {
    expect(namedPickerCatalogListMinHeight(844, false)).toBeGreaterThanOrEqual(300);
    expect(namedPickerCatalogListMinHeight(1024, true)).toBeGreaterThanOrEqual(400);
    expect(namedPickerCatalogListMinHeight(1024, true)).toBeGreaterThan(
      namedPickerCatalogListMinHeight(844, false),
    );
    expect(namedPickerSheetHeight(844, { allowCustom: false, isDesk: false })).toBeLessThanOrEqual(560);
    expect(namedPickerSheetHeight(844, { allowCustom: true, isDesk: false })).toBeGreaterThan(600);
    expect(namedPickerSheetHeight(1024, { allowCustom: true, isDesk: true })).toBeGreaterThan(800);
  });
});
