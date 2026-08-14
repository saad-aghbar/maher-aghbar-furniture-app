import { displayRolesLabel, roleLabel } from '../roleLabel';
import type { AuthUser } from '@maher/types';

const t = (key: string) => {
  const map: Record<string, string> = {
    'mobile.persona.warehouse': 'Warehouse',
    'mobile.persona.admin': 'Administration',
    'mobile.more.roleFallback': 'Team member',
  };
  return map[key] ?? key;
};

const base: AuthUser = {
  id: '1',
  username: 'wh',
  email: 'w@x.y',
  name: 'Sam',
  roles: ['WAREHOUSE_MANAGEMENT'],
  permissions: ['inventory.read'],
  preferredLanguage: 'en',
};

describe('roleLabel', () => {
  it('does not show the raw WAREHOUSE_MANAGEMENT code', () => {
    expect(roleLabel(t, 'WAREHOUSE_MANAGEMENT')).toBe('Warehouse');
    expect(roleLabel(t, 'WAREHOUSE_MANAGEMENT')).not.toContain('WAREHOUSE_MANAGEMENT');
  });

  it('prefers staff-type display names from /auth/me', () => {
    const user: AuthUser = {
      ...base,
      rolesDetailed: [
        {
          code: 'INVENTORY_ASSISTANT',
          kind: 'STAFF',
          nameEn: 'Inventory Assistant',
          nameAr: 'مساعد مخزون',
          nameHe: 'עוזר מלאי',
        },
      ],
    };
    expect(displayRolesLabel(t, user, 'en')).toBe('Inventory Assistant');
    expect(displayRolesLabel(t, user, 'ar')).toBe('مساعد مخزون');
    expect(displayRolesLabel(t, user, 'he')).toBe('עוזר מלאי');
  });
});
