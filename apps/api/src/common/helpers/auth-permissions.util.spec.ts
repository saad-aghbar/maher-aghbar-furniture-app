import { ROLE_PERMISSIONS } from '@maher/permissions';
import { actorHoldsPermission, effectivePermissionCodes } from './auth-permissions.util';

describe('effectivePermissionCodes', () => {
  it('unions the admin catalog when the user is SYSTEM_ADMINISTRATOR', () => {
    const codes = effectivePermissionCodes(['SYSTEM_ADMINISTRATOR'], ['role.manage']);
    expect(codes).toEqual(expect.arrayContaining(ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR));
    expect(codes).toContain('warehouse.read');
  });

  it('keeps database grants for non-admin users', () => {
    expect(effectivePermissionCodes(['STAFF'], ['inventory.read', 'warehouse.read'])).toEqual([
      'inventory.read',
      'warehouse.read',
    ]);
  });
});

describe('actorHoldsPermission', () => {
  it('lets a system administrator grant any catalog permission', () => {
    expect(
      actorHoldsPermission(
        { roles: ['SYSTEM_ADMINISTRATOR'], permissions: ['role.manage'] },
        'warehouse.read',
      ),
    ).toBe(true);
  });

  it('requires the code on a staff actor', () => {
    expect(
      actorHoldsPermission({ roles: ['WAREHOUSE_MANAGEMENT'], permissions: ['inventory.read'] }, 'warehouse.read'),
    ).toBe(false);
  });
});
