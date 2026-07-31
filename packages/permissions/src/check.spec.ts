import { hasPermission } from '../src/check';

describe('hasPermission', () => {
  it('requires all listed permissions', () => {
    expect(hasPermission(['customer.read', 'customer.create'], ['customer.read'])).toBe(true);
    expect(hasPermission(['customer.read'], ['customer.read', 'customer.create'])).toBe(false);
  });
});
