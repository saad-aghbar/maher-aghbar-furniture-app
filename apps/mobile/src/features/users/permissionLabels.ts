import {
  getPermissionMeta,
  PERMISSION_GROUP_LABELS,
  PERMISSIONS,
  type Permission,
  type PermissionGroup,
} from '@maher/permissions';

function isPermission(code: string): code is Permission {
  return (PERMISSIONS as readonly string[]).includes(code);
}

export function localizedPermissionName(code: string, locale: string): string {
  if (!isPermission(code)) return code;
  const meta = getPermissionMeta(code);
  if (locale === 'ar') return meta.nameAr;
  if (locale === 'he') return meta.nameHe;
  return meta.nameEn;
}

export function localizedPermissionDescription(code: string, locale: string): string {
  if (!isPermission(code)) return '';
  const meta = getPermissionMeta(code);
  if (locale === 'ar') return meta.descriptionAr;
  if (locale === 'he') return meta.descriptionHe;
  return meta.descriptionEn;
}

export function localizedPermissionGroupName(group: PermissionGroup, locale: string): string {
  const labels = PERMISSION_GROUP_LABELS[group];
  if (locale === 'ar') return labels.nameAr;
  if (locale === 'he') return labels.nameHe;
  return labels.nameEn;
}

export function groupedCodes(codes: readonly string[], locale: string) {
  const groups = new Map<
    string,
    { group: PermissionGroup; label: string; items: Array<{ code: string; name: string }> }
  >();
  for (const code of codes) {
    if (!isPermission(code)) continue;
    const meta = getPermissionMeta(code);
    const label = localizedPermissionGroupName(meta.group, locale);
    const existing = groups.get(meta.group) ?? { group: meta.group, label, items: [] };
    existing.items.push({ code, name: localizedPermissionName(code, locale) });
    groups.set(meta.group, existing);
  }
  return [...groups.values()];
}
