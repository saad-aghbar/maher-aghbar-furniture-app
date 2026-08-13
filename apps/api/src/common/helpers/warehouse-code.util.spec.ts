import { nextWarehouseCode, slugFromWarehouseName } from './warehouse-code.util';

describe('warehouse-code.util', () => {
  it('slugs English names', () => {
    expect(slugFromWarehouseName('Showroom')).toBe('SHOWROOM');
    expect(slugFromWarehouseName('Raw materials')).toBe('RAW-MATERIALS');
  });

  it('falls back when the name has no latin letters', () => {
    expect(slugFromWarehouseName('المستودع')).toBe('WH');
  });

  it('appends -2, -3 on clash', () => {
    expect(nextWarehouseCode('SHOWROOM', [])).toBe('SHOWROOM');
    expect(nextWarehouseCode('SHOWROOM', ['SHOWROOM'])).toBe('SHOWROOM-2');
    expect(nextWarehouseCode('SHOWROOM', ['SHOWROOM', 'SHOWROOM-2'])).toBe(
      'SHOWROOM-3',
    );
  });
});
