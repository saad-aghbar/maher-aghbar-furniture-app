/** Map login role codes to `mobile.persona.*` keys. */
const ROLE_TO_PERSONA: Record<string, string> = {
  CUSTOMER: 'customer',
  PRODUCTION_WORKER: 'production_worker',
  PRODUCTION_SUPERVISOR: 'production_supervisor',
  SYSTEM_ADMINISTRATOR: 'admin',
  ADMIN: 'admin',
  SALES: 'sales',
  ACCOUNTING: 'accounting',
  PURCHASING: 'purchasing',
  WAREHOUSE: 'warehouse',
  QUALITY: 'quality',
  DELIVERY: 'delivery',
  MANAGEMENT: 'management',
};

export function roleLabel(t: (key: string) => string, role: string): string {
  const persona = ROLE_TO_PERSONA[role] ?? role.toLowerCase();
  const key = `mobile.persona.${persona}`;
  const value = t(key);
  if (value && value !== key) return value;
  return t('mobile.more.roleFallback');
}

export function rolesLabel(t: (key: string) => string, roles: string[], emptyKey = 'mobile.more.roleFallback'): string {
  if (!roles.length) return t(emptyKey);
  return roles.map((role) => roleLabel(t, role)).join(' · ');
}
