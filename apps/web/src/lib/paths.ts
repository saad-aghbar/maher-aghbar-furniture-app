export const AUTH_PATHS = [
  '/login',
  '/mfa',
  '/forgot-password',
  '/reset-password',
  '/session-expired',
  '/disabled',
] as const;

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((path) => pathname === path || pathname.endsWith(path));
}

export function surfaceFromPath(pathname: string): 'admin' | 'dealer' | 'worker' | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/dealer' || pathname.startsWith('/dealer/')) return 'dealer';
  if (pathname === '/worker' || pathname.startsWith('/worker/')) return 'worker';
  return null;
}
