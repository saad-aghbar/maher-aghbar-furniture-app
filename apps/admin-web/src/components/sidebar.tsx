'use client';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Button, cn } from '@maher/ui';
import { useTranslations } from 'next-intl';

const navItems = [
  { href: '/dashboard', key: 'dashboard' },
  { href: '/customers', key: 'customers' },
  { href: '/quotations', key: 'quotations' },
  { href: '/sales-orders', key: 'salesOrders' },
  { href: '/production', key: 'production' },
  { href: '/inventory', key: 'inventory' },
  { href: '/invoices', key: 'invoices' },
  { href: '/reports', key: 'reports' },
  { href: '/ai-intake', key: 'aiIntake' },
  { href: '/users', key: 'users' },
  { href: '/audit', key: 'audit' },
  { href: '/settings', key: 'settings' },
] as const;

export function Sidebar() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST', body: '{}' });
    } catch {
      /* ignore */
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-e border-border bg-surface">
      <div className="border-b border-border px-5 py-6">
        <p className="text-lg font-bold text-brand">{tCommon('appName')}</p>
        <p className="mt-1 text-xs text-[var(--maher-text-secondary)]">ERP Admin</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand/10 text-brand'
                  : 'text-[var(--maher-text-secondary)] hover:bg-background hover:text-text-primary',
              )}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <Button variant="secondary" className="w-full" onClick={logout}>
          {tAuth('logout')}
        </Button>
      </div>
    </aside>
  );
}
