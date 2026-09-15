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

  it('does not treat app-level inbox or search as a tab root', () => {
    expect(isTabRootPath('/notifications', 'admin')).toBe(false);
    expect(isTabRootPath('/(app)/notifications', 'admin')).toBe(false);
    expect(isTabRootPath('/search', 'admin')).toBe(false);
    expect(isTabRootPath('/(app)/search', 'customer')).toBe(false);
  });

  it('keeps the worker notifications tab as a root', () => {
    expect(isTabRootPath('/(app)/(employee)/(tabs)/notifications', 'employee')).toBe(true);
  });
});
