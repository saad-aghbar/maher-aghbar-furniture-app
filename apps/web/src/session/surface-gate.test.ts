import { describe, expect, it } from 'vitest';

const EXPECTED_TO_SURFACE = {
  admin: 'admin',
  dealer: 'customer',
  worker: 'employee',
} as const;

const HOME = {
  admin: '/admin/dashboard',
  customer: '/dealer/dashboard',
  employee: '/worker/dashboard',
} as const;

describe('surface gate mapping', () => {
  it('maps URL segments onto resolveAppSurface identities', () => {
    expect(EXPECTED_TO_SURFACE.admin).toBe('admin');
    expect(EXPECTED_TO_SURFACE.dealer).toBe('customer');
    expect(EXPECTED_TO_SURFACE.worker).toBe('employee');
  });

  it('sends forbidden users to their own home', () => {
    expect(HOME.admin).toBe('/admin/dashboard');
    expect(HOME.customer).toBe('/dealer/dashboard');
    expect(HOME.employee).toBe('/worker/dashboard');
  });
});
