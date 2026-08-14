import {
  assertCannotDeactivateSelf,
  assertCannotDeleteSelf,
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

  it('blocks self-delete', () => {
    expect(() => assertCannotDeleteSelf('a', 'a')).toThrow(/own account/);
  });

  it('allows deleting another user', () => {
    expect(() => assertCannotDeleteSelf('a', 'b')).not.toThrow();
  });

  it('blocks removing own admin role', () => {
    expect(() => assertCannotRemoveOwnAdmin('a', 'a', true, false)).toThrow(/administrator role/);
  });

  it('blocks deactivating last admin', () => {
    expect(() => assertNotLastActiveAdmin(0)).toThrow(/at least one active system administrator/);
  });

  it('allows deactivating admin when others remain', () => {
    expect(() => assertNotLastActiveAdmin(1)).not.toThrow();
  });
});
