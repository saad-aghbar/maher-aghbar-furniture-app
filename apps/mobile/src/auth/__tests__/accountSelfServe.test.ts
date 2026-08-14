import { canChangeOwnPassword, canEditOwnProfile, canManageOwnMfa } from '../accountSelfServe';

describe('accountSelfServe', () => {
  it('lets a system administrator edit profile, password, and MFA', () => {
    const user = { roles: ['SYSTEM_ADMINISTRATOR'] };
    expect(canEditOwnProfile(user)).toBe(true);
    expect(canChangeOwnPassword(user)).toBe(true);
    expect(canManageOwnMfa(user)).toBe(true);
  });

  it('locks staff the same as workers', () => {
    const user = { roles: ['PRODUCTION_WORKER', 'WAREHOUSE_MANAGEMENT'] };
    expect(canEditOwnProfile(user)).toBe(false);
    expect(canChangeOwnPassword(user)).toBe(false);
    expect(canManageOwnMfa(user)).toBe(false);
  });

  it('lets dealers edit profile and MFA but not password', () => {
    const user = { roles: ['CUSTOMER'], customerId: 'cus-1' };
    expect(canEditOwnProfile(user)).toBe(true);
    expect(canChangeOwnPassword(user)).toBe(false);
    expect(canManageOwnMfa(user)).toBe(true);
  });
});
