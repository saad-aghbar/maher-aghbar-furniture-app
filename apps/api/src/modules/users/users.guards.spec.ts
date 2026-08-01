import {
  assertCannotDeactivateSelf,
  assertCannotRemoveOwnAdmin,
  assertNotLastActiveAdmin,
} from './users.guards';

describe('users.guards', () => {
  it('blocks self-deactivation', () => {
    expect(() => assertCannotDeactivateSelf('a', 'a')).toThrow(/own account/);
  });

  it('allows deactivating another user', () => {
    expect(() => assertCannotDeactivateSelf('a', 'b')).not.toThrow();
  });

  it('blocks removing own admin role', () => {
    expect(() => assertCannotRemoveOwnAdmin('a', 'a', true, false)).toThrow(/administrator role/);
  });

  it('blocks deactivating last admin', () => {
    expect(() => assertNotLastActiveAdmin(0)).toThrow(/last active/);
  });

  it('allows deactivating admin when others remain', () => {
    expect(() => assertNotLastActiveAdmin(1)).not.toThrow();
  });
});
