import type { AuthUser } from '@maher/types';
import { describe, expect, it } from 'vitest';
import { loginDestination, portalMatches } from './post-login';

function user(overrides: Partial<AuthUser> & Pick<AuthUser, 'permissions' | 'roles'>): AuthUser {
  return {
    id: '1',
    username: 'u',
    email: 'u@example.com',
    name: 'U',
    preferredLanguage: 'en',
    ...overrides,
  };
}

describe('loginDestination', () => {
  it('lands on the chosen portal home', () => {
    expect(loginDestination('admin', 'ar', null)).toBe('/admin/dashboard');
    expect(loginDestination('dealer', 'en')).toBe('/dealer/dashboard');
    expect(loginDestination('worker', 'he', '/admin/orders')).toBe('/worker/dashboard');
  });

  it('keeps next only when it stays inside the chosen portal', () => {
    expect(loginDestination('admin', 'ar', '/admin/orders')).toBe('/admin/orders');
    expect(loginDestination('dealer', 'en', '/en/dealer/catalog')).toBe('/dealer/catalog');
    expect(loginDestination('admin', 'ar', '//evil.example')).toBe('/admin/dashboard');
  });
});

describe('portalMatches', () => {
  it('matches the account surface to the selected portal', () => {
    const admin = user({ permissions: ['user.manage'], roles: ['ADMIN'] });
    const dealer = user({ permissions: ['request.create'], roles: ['CUSTOMER'], customerId: 'c1' });
    const worker = user({ permissions: ['production-task.complete'], roles: ['WORKER'] });

    expect(portalMatches('admin', admin)).toBe(true);
    expect(portalMatches('dealer', admin)).toBe(false);
    expect(portalMatches('dealer', dealer)).toBe(true);
    expect(portalMatches('worker', worker)).toBe(true);
    expect(portalMatches('admin', worker)).toBe(false);
  });
});
