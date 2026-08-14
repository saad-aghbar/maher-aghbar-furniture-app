import {
  canChangeOwnPassword,
  canEditOwnProfile,
  canManageOwnMfa,
} from './account-self-serve.util';

describe('account self-serve', () => {
  it('lets a system administrator edit profile, password, and MFA', () => {
    const roles = ['SYSTEM_ADMINISTRATOR'];
    expect(canEditOwnProfile(roles)).toBe(true);
    expect(canChangeOwnPassword(roles)).toBe(true);
    expect(canManageOwnMfa(roles)).toBe(true);
  });

  it('locks staff the same as workers', () => {
    const roles = ['PRODUCTION_WORKER', 'WAREHOUSE_MANAGEMENT'];
    expect(canEditOwnProfile(roles)).toBe(false);
    expect(canChangeOwnPassword(roles)).toBe(false);
    expect(canManageOwnMfa(roles)).toBe(false);
  });

  it('lets dealers edit profile and MFA but not password', () => {
    const roles = ['CUSTOMER'];
    expect(canEditOwnProfile(roles, 'cus-1')).toBe(true);
    expect(canChangeOwnPassword(roles)).toBe(false);
    expect(canManageOwnMfa(roles, 'cus-1')).toBe(true);
  });
});
