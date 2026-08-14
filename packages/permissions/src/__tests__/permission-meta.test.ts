import { PERMISSIONS } from '../catalog';
import {
  PERMISSION_META,
  expandPermissionDependencies,
  groupedPermissionCatalog,
} from '../permission-meta';
import { ROLE_PERMISSIONS } from '../catalog';
import { SYSTEM_STAFF_PRESETS } from '../staff';

describe('permission metadata', () => {
  it('covers every catalog permission in EN/AR/HE', () => {
    const missing: string[] = [];
    for (const code of PERMISSIONS) {
      const meta = PERMISSION_META[code];
      if (!meta) {
        missing.push(code);
        continue;
      }
      for (const field of [
        'nameEn',
        'nameAr',
        'nameHe',
        'descriptionEn',
        'descriptionAr',
        'descriptionHe',
      ] as const) {
        if (!meta[field]?.trim()) missing.push(`${code}.${field}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('marks admin-only permissions as not assignable to staff', () => {
    expect(PERMISSION_META['role.manage'].assignableToStaff).toBe(false);
    expect(PERMISSION_META['settings.manage'].assignableToStaff).toBe(false);
    expect(PERMISSION_META['audit.read'].assignableToStaff).toBe(false);
    expect(PERMISSION_META['inventory.read'].assignableToStaff).toBe(true);
  });

  it('expands transfer to include read dependencies', () => {
    expect(expandPermissionDependencies(['inventory.transfer'])).toEqual(
      expect.arrayContaining(['inventory.read', 'warehouse.read', 'inventory.transfer']),
    );
  });

  it('groups catalog without inventing codes', () => {
    const groups = groupedPermissionCatalog();
    const codes = groups.flatMap((g) => g.permissions.map((p) => p.code));
    expect(new Set(codes).size).toBe(PERMISSIONS.length);
    expect(groups.find((g) => g.group === 'inventory')?.nameAr).toBe('المخزون');
  });
});

describe('WAREHOUSE_MANAGEMENT preset', () => {
  const preset = SYSTEM_STAFF_PRESETS.WAREHOUSE_MANAGEMENT.permissionCodes;

  it('grants operational inventory permissions', () => {
    expect(preset).toEqual(
      expect.arrayContaining([
        'inventory.read',
        'warehouse.read',
        'inventory.receive',
        'inventory.issue',
        'inventory.transfer',
        'inventory.count',
      ]),
    );
  });

  it('does not grant admin or worker-floor permissions', () => {
    expect(preset).not.toEqual(
      expect.arrayContaining([
        'user.manage',
        'role.manage',
        'settings.manage',
        'catalog.manage',
        'inventory.adjust',
        'inventory.cost.read',
        'warehouse.manage',
        'report.financial.read',
        'production.workflow.manage',
        'production-task.update-own',
      ]),
    );
  });

  it('is not a hardcoded identity role', () => {
    expect(ROLE_PERMISSIONS).not.toHaveProperty('WAREHOUSE_MANAGEMENT');
  });
});
