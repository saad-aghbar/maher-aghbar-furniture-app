import type { AuthRoleDetail } from '@maher/types';
import { resolveHomePersona } from '@maher/permissions';
import type { AuthUser } from '@maher/types';

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
  WAREHOUSE_MANAGEMENT: 'warehouse',
  QUALITY: 'quality',
  DELIVERY: 'delivery',
  MANAGEMENT: 'management',
};

function personaLabel(t: (key: string) => string, persona: string): string {
  const key = `mobile.persona.${persona}`;
  const value = t(key);
  if (value && value !== key) return value;
  return t('mobile.more.roleFallback');
}

function localizedDetailedName(detail: AuthRoleDetail, locale: string): string | null {
  const named =
    locale === 'ar'
      ? detail.nameAr
      : locale === 'he'
        ? detail.nameHe || detail.nameEn
        : detail.nameEn;
  if (!named || named === detail.code) return null;
  return named;
}

export function roleLabel(t: (key: string) => string, role: string): string {
  const persona = ROLE_TO_PERSONA[role] ?? role.toLowerCase();
  return personaLabel(t, persona);
}

export function rolesLabel(
  t: (key: string) => string,
  roles: string[],
  emptyKey = 'mobile.more.roleFallback',
): string {
  if (!roles.length) return t(emptyKey);
  return roles.map((role) => roleLabel(t, role)).join(' · ');
}

/** Prefer staff-type display names from `/auth/me`, then persona, never a raw code. */
export function displayRolesLabel(
  t: (key: string) => string,
  user: AuthUser | null | undefined,
  locale: string,
  emptyKey = 'mobile.more.roleFallback',
): string {
  if (!user) return t(emptyKey);
  if (user.rolesDetailed?.length) {
    const names = user.rolesDetailed.map((detail) => {
      const named = localizedDetailedName(detail, locale);
      if (named) return named;
      return roleLabel(t, detail.code);
    });
    if (names.length) return names.join(' · ');
  }
  if (user.roles.length) return rolesLabel(t, user.roles, emptyKey);
  return personaLabel(t, resolveHomePersona(user));
}
