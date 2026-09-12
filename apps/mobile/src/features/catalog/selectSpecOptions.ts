import type { SpecOptionGroup, SpecOptionValue } from '@/api/modules/catalog';

export function selectActiveSpecOptionGroups(groups: SpecOptionGroup[]): SpecOptionGroup[] {
  return groups.filter((g) => g.isActive);
}

export function selectActiveSpecOptionValues(values: SpecOptionValue[]): SpecOptionValue[] {
  return values.filter((v) => v.isActive);
}

export function selectSpecOptionValuesForPicker(
  values: SpecOptionValue[],
  groupId?: string | null,
): SpecOptionValue[] {
  return selectActiveSpecOptionValues(values)
    .filter((v) => !groupId || v.groupId === groupId)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}
