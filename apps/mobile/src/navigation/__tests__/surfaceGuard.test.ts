import type { AuthUser } from '@maher/types';
import { correctSurfaceHref, isCorrectSurface, shouldForbidTab } from '../surfaceGuard';
import { isTabAllowed } from '../tabConfig';

const base: AuthUser = {
  id: '1',
  username: 'test',
  email: 'a@b.c',
  name: 'Test',
  roles: [],
  permissions: [],
  preferredLanguage: 'en',
};

describe('surfaceGuard', () => {
  it('wrong surface → expected home href', () => {
    const customer: AuthUser = {
      ...base,
      customerId: 'c1',
      permissions: ['request.create'],
    };
    expect(isCorrectSurface(customer, 'admin')).toBe(false);
    expect(correctSurfaceHref(customer)).toBe('/(app)/(customer)/(tabs)');

    const worker: AuthUser = {
      ...base,
      permissions: ['production-task.update-own', 'production-task.complete'],
    };
    expect(isCorrectSurface(worker, 'customer')).toBe(false);
    expect(correctSurfaceHref(worker)).toBe('/(app)/(employee)/(tabs)');

    const admin: AuthUser = {
      ...base,
      permissions: ['quotation.create', 'customer.create'],
    };
    expect(isCorrectSurface(admin, 'admin')).toBe(true);
    expect(correctSurfaceHref(admin)).toBe('/(app)/(admin)/(tabs)');
  });

  it('unauthorized deep link helper returns forbidden', () => {
    const customer: AuthUser = {
      ...base,
      customerId: 'c1',
      permissions: ['catalog.read'],
    };
    expect(shouldForbidTab(customer, 'admin', 'orders', isTabAllowed)).toBe(true);
    expect(shouldForbidTab(customer, 'customer', 'orders', isTabAllowed)).toBe(true);
    expect(shouldForbidTab(customer, 'customer', 'catalog', isTabAllowed)).toBe(false);
    expect(shouldForbidTab(customer, 'customer', 'index', isTabAllowed)).toBe(false);
  });
});
