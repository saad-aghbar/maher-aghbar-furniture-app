import type { SpecOptionGroup, SpecOptionValue } from '@/api/modules/catalog';

export type AssignedSpecRow = {
  group: SpecOptionGroup;
  value: SpecOptionValue;
};

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

/** Two-letter stamp from the category name — factory ticket mark, not an icon. */
export function specCategoryMark(name: string, locale: string): string {
  const chars = Array.from(name.trim()).filter((ch) => ch.trim() && ch !== '/' && ch !== '·');
  const mark = chars.slice(0, 2).join('') || '•';
  return locale === 'ar' || locale === 'he' ? mark : mark.toUpperCase();
}

export function specLibraryCode(nameEn: string, prefix: string): string {
  const base = nameEn
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 28);
  return base || `${prefix}_${Date.now().toString(36).toUpperCase()}`;
}

/** Specs pinned on this variant — unused library groups stay off the ledger. */
export function selectAssignedSpecRows(
  groups: SpecOptionGroup[],
  values: SpecOptionValue[],
  selectedByGroup: Record<string, string | null>,
): AssignedSpecRow[] {
  const valueById = new Map(values.map((row) => [row.id, row]));
  const rows: AssignedSpecRow[] = [];
  for (const group of selectActiveSpecOptionGroups(groups).slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
    const valueId = selectedByGroup[group.id];
    if (!valueId) continue;
    const value = valueById.get(valueId);
    if (!value) continue;
    rows.push({ group, value });
  }
  return rows;
}

export function selectUnusedSpecGroups(
  groups: SpecOptionGroup[],
  selectedByGroup: Record<string, string | null>,
): SpecOptionGroup[] {
  return selectActiveSpecOptionGroups(groups)
    .filter((group) => !selectedByGroup[group.id])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
