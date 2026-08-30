import { translate } from '../translate';

const STAFF_TYPE_KEYS = [
  'users.employeeType',
  'users.employeeTypeWorker',
  'users.employeeTypeStaff',
  'users.staffType',
  'users.staffTypeHint',
  'users.staffTypeRequired',
  'users.noStaffTypesYet',
  'users.viewPermissions',
  'users.hidePermissions',
  'users.permissionCount',
  'users.usersAssignedCount',
  'users.segmentWorkers',
  'users.segmentStaff',
  'users.staffTypeFilterAll',
  'users.staffTypes',
  'users.staffTypesTitle',
  'users.staffTypesDescription',
  'users.staffTypesEyebrow',
  'users.staffTypesCount',
  'users.assignedShort',
  'users.newStaffType',
  'users.editStaffType',
  'users.duplicateStaffType',
  'users.optional',
  'users.systemPreset',
  'users.systemPresetReadOnly',
  'users.custom',
  'users.permissions',
  'users.searchPermissions',
  'users.permissionGroupFilter',
  'users.sensitivePermission',
  'users.restrictedPermission',
  'users.duplicate',
  'users.view',
  'users.cannotDeleteAssigned',
  'users.cannotDeleteSystemPreset',
  'users.reassignBeforeRemove',
  'users.staffTypeCreated',
  'users.staffTypeUpdated',
  'users.staffTypeDuplicated',
  'users.staffTypeDeactivated',
  'users.staffTypeDeleted',
  'users.confirmDeactivateStaffType',
  'users.confirmDeleteStaffType',
  'users.emptyStaffTypes',
  'validation.staffTypeRequired',
  'validation.employeeTypeRequired',
  'errors.STAFF_TYPE_INACTIVE',
  'errors.STAFF_FORBIDDEN_PERMISSION',
  'errors.STAFF_CODE_IMMUTABLE',
  'navigation.staffTypes',
  'mobile.opsHome.eyebrow',
  'mobile.opsHome.inventoryTitle',
  'mobile.opsHome.hint',
  'mobile.opsHome.attention',
  'mobile.opsHome.lowStock',
  'mobile.opsHome.openTransfers',
  'mobile.opsHome.openCounts',
  'mobile.opsHome.recentActivity',
  'mobile.opsHome.receive',
  'mobile.opsHome.transfer',
  'mobile.opsHome.count',
  'mobile.staffHome.restrictedTitle',
  'mobile.staffHome.restrictedBody',
  'mobile.staffHome.loading',
  'mobile.forbiddenArea',
  'mobile.forbiddenAreaHint',
] as const;

describe('staff-types i18n keys', () => {
  it.each(['en', 'ar', 'he'] as const)('resolves every checklist key in %s', (locale) => {
    const leaks = STAFF_TYPE_KEYS.filter((key) => {
      const value = translate(locale, key, { n: 3 });
      return !value.trim() || value === key;
    });
    expect(leaks).toEqual([]);
  });

<<<<<<< HEAD
  it('uses sentence-case English labels (Empty/Light family, not ALL CAPS)', () => {
    expect(translate('en', 'users.staffTypesEyebrow')).toBe('Job presets');
    expect(translate('en', 'users.systemPreset')).toBe('System preset');
    expect(translate('en', 'users.assignedShort')).toBe('Assigned');
    expect(translate('en', 'users.permissions')).toBe('Permissions');
    expect(translate('en', 'users.custom')).toBe('Custom');
  });
=======
  it.each(['en', 'ar', 'he'] as const)(
    'systemPresetReadOnly stays view-only in %s (no Duplicate instruction)',
    (locale) => {
      const value = translate(locale, 'users.systemPresetReadOnly');
      expect(value).not.toMatch(/duplicate|انسخه|שכפלו/i);
    },
  );
>>>>>>> ea4eac9 (fix(i18n): drop dishonest Duplicate line from system staff-type copy)
});
