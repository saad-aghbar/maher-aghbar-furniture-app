import {
  resolveAppSurface,
  resolveHomePersona,
  resolveMobileHomeHref,
} from '../can';
import type { AuthUser } from '@maher/types';

const base: AuthUser = {
  id: '1',
  email: 'a@b.c',
  name: 'Test',
  roles: [],
  permissions: [],
  preferredLanguage: 'en',
};

describe('permission helpers', () => {
  it('can / canAny / canAll', () => {
    const user: AuthUser = {
      ...base,
      permissions: ['inventory.read', 'inventory.receive'],
    };
    expect(user.permissions.includes('inventory.read')).toBe(true);
    expect(resolveHomePersona(user)).toBe('warehouse');
  });

  it('resolves customer persona when customerId present', () => {
    const user: AuthUser = {
      ...base,
      customerId: 'c1',
      permissions: ['request.create', 'quotation.read'],
    };
    expect(resolveHomePersona(user)).toBe('customer');
    expect(resolveMobileHomeHref(user)).toBe('/(app)');
    expect(resolveAppSurface(user)).toBe('customer');
  });

  it('resolves warehouse from inventory permissions', () => {
    const user: AuthUser = {
      ...base,
      permissions: ['inventory.receive', 'inventory.issue'],
    };
    expect(resolveHomePersona(user)).toBe('warehouse');
  });
});
