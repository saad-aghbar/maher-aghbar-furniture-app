import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

const LEGACY_ADMIN_ROOTS = new Set([
  'dashboard',
  'orders',
  'requests',
  'quotations',
  'sales-orders',
  'deliveries',
  'products',
  'categories',
  'materials',
  'fabrics',
  'spec-options',
  'spec-option-values',
  'customers',
  'production',
  'inventory',
  'purchasing',
  'invoices',
  'reports',
  'employees',
  'users',
  'returns',
  'ai-chat',
  'settings',
  'notifications',
  'warehouses',
  'suppliers',
  'payments',
  'quality',
  'contracts',
  'documents',
  'ai-intake',
  'departments',
  'roles',
  'audit',
  'units',
  'colors',
  'raw-materials',
  'production-stages',
]);

const AUTH_ROOTS = new Set([
  'login',
  'mfa',
  'forgot-password',
  'reset-password',
  'session-expired',
  'disabled',
]);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/(ar|en|he)\/([^/]+)(\/.*)?$/);
  if (match) {
    const locale = match[1] ?? 'ar';
    const root = match[2] ?? '';
    const rest = match[3] ?? '';
    if (root && LEGACY_ADMIN_ROOTS.has(root)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/admin/${root}${rest}`;
      return NextResponse.redirect(url, 308);
    }
    const isAuth = !root || AUTH_ROOTS.has(root);
    const hasSession =
      request.cookies.has('access_token') || request.cookies.has('refresh_token');
    if (!isAuth && !hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.search = '';
      url.searchParams.set('next', `/${root}${rest}`);
      return NextResponse.redirect(url);
    }
  }
  return intl(request);
}

export const config = {
  matcher: ['/', '/(ar|en|he)/:path*'],
};
