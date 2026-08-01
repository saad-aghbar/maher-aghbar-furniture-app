import {
  resolveAppSurface,
  resolveWebHomePath,
  type AppSurface,
} from '@maher/permissions';
import type { AuthUser } from '@maher/types';

const DEFAULTS: Record<AppSurface, string> = {
  admin: 'http://localhost:3000',
  customer: 'http://localhost:3001',
  employee: 'http://localhost:3002',
};

function portalBase(surface: AppSurface): string {
  if (surface === 'admin') {
    return process.env.NEXT_PUBLIC_ADMIN_WEB_URL ?? DEFAULTS.admin;
  }
  if (surface === 'customer') {
    return process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL ?? DEFAULTS.customer;
  }
  return process.env.NEXT_PUBLIC_EMPLOYEE_PORTAL_URL ?? DEFAULTS.employee;
}

/** After one shared login, send the user to the portal that matches their permissions. */
export function redirectAfterLogin(user: AuthUser, locale: string): void {
  const surface = resolveAppSurface(user);
  const path = resolveWebHomePath(user);
  const base = portalBase(surface).replace(/\/$/, '');
  const targetPath = `/${locale}${path}`;
  const targetUrl = `${base}${targetPath}`;

  if (typeof window === 'undefined') return;

  const currentOrigin = window.location.origin.replace(/\/$/, '');
  if (currentOrigin === base) {
    window.location.assign(targetPath);
    return;
  }
  window.location.assign(targetUrl);
}
