import {
  resolveAppSurface,
  resolveHomePersona,
  resolveMobileHomeHref,
  resolveWebHomePath,
} from '../routing';
import type { AuthUser } from '@maher/types';

const base: AuthUser = {
  id: '1',
  username: 'test',
  email: 'a@b.c',
  name: 'Test',
  roles: [],
  permissions: [],
  preferredLanguage: 'en',
};

describe('post-login routing', () => {
  it('sends customers to the customer portal', () => {
    const user: AuthUser = {
      ...base,
      customerId: 'c1',
      permissions: ['request.create', 'quotation.read'],
    };
    expect(resolveAppSurface(user)).toBe('customer');
    expect(resolveWebHomePath(user)).toBe('/dashboard');
    expect(resolveHomePersona(user)).toBe('customer');
    expect(resolveMobileHomeHref(user)).toBe('/(app)/(customer)/(tabs)');
  });

  it('sends production workers to the employee portal', () => {
    const user: AuthUser = {
      ...base,
      permissions: ['production-task.update-own', 'production-task.complete', 'notification.read'],
    };
    expect(resolveAppSurface(user)).toBe('employee');
    expect(resolveWebHomePath(user)).toBe('/dashboard');
    expect(resolveHomePersona(user)).toBe('production_worker');
    expect(resolveMobileHomeHref(user)).toBe('/(app)/(employee)/(tabs)');
  });

  it('sends sales/admin to the admin portal', () => {
    const user: AuthUser = {
      ...base,
      permissions: ['quotation.create', 'customer.create', 'sales-order.create'],
    };
    expect(resolveAppSurface(user)).toBe('admin');
    expect(resolveWebHomePath(user)).toBe('/dashboard');
    expect(resolveHomePersona(user)).toBe('sales');
    expect(resolveMobileHomeHref(user)).toBe('/(app)/(admin)/(tabs)');
  });
});
