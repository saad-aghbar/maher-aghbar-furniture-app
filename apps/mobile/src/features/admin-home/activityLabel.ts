type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

function lastVerb(action: string): string {
  const parts = action.split(/[._]/).filter(Boolean);
  return (parts[parts.length - 1] ?? action).toLowerCase();
}

export function activityLabel(
  t: TranslateFn,
  action: string,
  entityType: string,
): string {
  const verbKey = `mobile.adminHome.activityVerb.${lastVerb(action)}`;
  const entityKey = `mobile.adminHome.activityEntity.${entityType}`;
  const verbRaw = t(verbKey);
  const entityRaw = t(entityKey);
  const verb = verbRaw === verbKey ? t('mobile.adminHome.activityVerb.fallback') : verbRaw;
  if (entityRaw === entityKey) return verb;
  return `${verb} · ${entityRaw}`;
}
