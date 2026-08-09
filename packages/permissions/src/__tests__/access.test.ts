import type { AuthUser } from '@maher/types';
import { can, canAny, canAll } from '../access';

const user = (permissions: string[], extra: Partial<AuthUser> = {}): AuthUser => ({
  id: '1',
  username: 'u',
  email: 'e',
  name: 'N',
  roles: [],
  permissions,
  preferredLanguage: 'en',
  ...extra,
});

describe('can / canAny / canAll', () => {
  it('can checks a single permission', () => {
    const u = user(['catalog.read']);
    expect(can(u, 'catalog.read')).toBe(true);
    expect(can(u, 'sales-order.read')).toBe(false);
    expect(can(null, 'catalog.read')).toBe(false);
  });

  it('canAny is OR', () => {
    const u = user(['quotation.read']);
    expect(canAny(u, ['sales-order.read', 'quotation.read'])).toBe(true);
    expect(canAny(u, ['sales-order.read', 'request.read'])).toBe(false);
  });

  it('canAll is AND', () => {
    const u = user(['sales-order.read', 'quotation.read']);
    expect(canAll(u, ['sales-order.read', 'quotation.read'])).toBe(true);
    expect(canAll(u, ['sales-order.read', 'request.create'])).toBe(false);
  });
});
