import { describe, expect, it } from 'vitest';
import { canSeeNav } from '../components/nav-items';

describe('canSeeNav', () => {
  it('shows items without permission gates', () => {
    expect(canSeeNav({}, [])).toBe(true);
  });

  it('follows granted permissions, not a staff-type code', () => {
    const inventory = { anyPermissions: ['inventory.read' as const] };
    expect(canSeeNav(inventory, ['inventory.read', 'inventory.transfer'])).toBe(true);
    expect(canSeeNav(inventory, ['quotation.create'])).toBe(false);
    expect(canSeeNav({ anyPermissions: ['user.manage'] }, ['inventory.read'])).toBe(false);
  });

  it('hides Users and Settings from warehouse permissions', () => {
    const warehouse = [
      'inventory.read',
      'inventory.receive',
      'inventory.transfer',
      'inventory.count',
      'warehouse.read',
      'notification.read',
      'document.read',
    ];
    expect(canSeeNav({ anyPermissions: ['inventory.read'] }, warehouse)).toBe(true);
    expect(canSeeNav({ anyPermissions: ['user.manage'] }, warehouse)).toBe(false);
    expect(canSeeNav({ anyPermissions: ['settings.manage', 'role.manage'] }, warehouse)).toBe(false);
    expect(canSeeNav({ anyPermissions: ['notification.read'] }, warehouse)).toBe(true);
    expect(canSeeNav({}, warehouse)).toBe(true);
  });
});
