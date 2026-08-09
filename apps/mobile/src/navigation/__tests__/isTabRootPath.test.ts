import { isTabRootPath } from '../isTabRootPath';

describe('isTabRootPath', () => {
  it('treats home and bare tabs as roots', () => {
    expect(isTabRootPath('/', 'admin')).toBe(true);
    expect(isTabRootPath('/orders', 'admin')).toBe(true);
    expect(isTabRootPath('/(app)/(admin)/(tabs)/orders', 'admin')).toBe(true);
    expect(isTabRootPath('/more', 'admin')).toBe(true);
  });

  it('treats nested detail / module routes as not roots', () => {
    expect(isTabRootPath('/orders/abc-123', 'admin')).toBe(false);
    expect(isTabRootPath('/(app)/(admin)/(tabs)/orders/abc', 'admin')).toBe(false);
    expect(isTabRootPath('/products', 'admin')).toBe(false);
    expect(isTabRootPath('/inventory/items/1', 'admin')).toBe(false);
  });
});
