'use client';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { BrandMark, Button, cn } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderOpen,
  Languages,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Scroll,
  ScrollText,
  SquarePen,
  Truck,
  User,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const localeNames: Record<string, string> = { ar: 'العربية', en: 'English', he: 'עברית' };

const items = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/quotations/request', key: 'requestQuote', icon: SquarePen },
  { href: '/quotations', key: 'myQuotes', icon: FileText },
  { href: '/orders', key: 'orders', icon: Package },
  { href: '/contracts', key: 'contracts', icon: ScrollText },
  { href: '/deliveries', key: 'deliveries', icon: Truck },
  { href: '/invoices', key: 'invoices', icon: Receipt },
  { href: '/statement', key: 'statement', icon: Scroll },
  { href: '/documents', key: 'documents', icon: FolderOpen },
  { href: '/requests', key: 'rfqs', icon: ClipboardList },
] as const;

interface NotificationItem {
  id: string;
  readAt?: string | null;
}

export function PortalShell({ children }: { children: ReactNode }) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const notifications = useQuery({
    queryKey: ['notifications-inbox'],
    queryFn: () => apiFetch<NotificationItem[]>('/api/v1/notifications'),
    retry: false,
    refetchInterval: 60_000,
  });

  const unread = (notifications.data ?? []).filter((n) => !n.readAt).length;

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  async function logout() {
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST', body: '{}' });
    } catch {
      /* ignore */
    }
    router.push('/login');
    router.refresh();
  }

  const initials = (me.data?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-text-primary">
                {tCommon('appName')}
              </p>
              <p className="text-xs text-text-tertiary">{tCommon('portalCustomer')}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <label className="relative hidden items-center sm:flex" title={t('language')}>
              <Languages className="pointer-events-none absolute start-2.5 h-4 w-4 text-text-tertiary" />
              <span className="sr-only">{t('language')}</span>
              <select
                value={locale}
                onChange={(e) =>
                  router.replace(pathname, { locale: e.target.value as 'ar' | 'en' | 'he' })
                }
                className="h-9 appearance-none rounded-[var(--maher-radius-md)] border border-border bg-surface ps-8 pe-7 text-sm text-text-secondary transition-colors hover:border-border-strong focus:border-brand focus:outline-none"
              >
                {Object.entries(localeNames).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute end-2 h-3.5 w-3.5 text-text-tertiary" />
            </label>

            <Link
              href="/notifications"
              aria-label={t('notifications')}
              className="relative flex h-9 w-9 items-center justify-center rounded-[var(--maher-radius-md)] text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 ? (
                <span className="absolute -top-0.5 end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </Link>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className={cn(
                  'flex items-center gap-2 rounded-[var(--maher-radius-md)] py-1 ps-1 pe-2 transition-colors hover:bg-surface-muted',
                  menuOpen && 'bg-surface-muted',
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                  {initials || <User className="h-4 w-4" />}
                </span>
                <span className="hidden max-w-[9rem] truncate text-sm font-medium text-text-primary md:block">
                  {me.data?.name ?? ''}
                </span>
                <ChevronDown className="h-4 w-4 text-text-tertiary" />
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="maher-animate-pop absolute end-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-[var(--maher-radius-lg)] border border-border bg-surface shadow-float"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {me.data?.name}
                    </p>
                    <p className="truncate text-xs text-text-secondary">{me.data?.email}</p>
                  </div>
                  <div className="border-b border-border px-3 py-2 sm:hidden">
                    <label className="flex items-center gap-2 text-sm text-text-secondary">
                      <Languages className="h-4 w-4" />
                      <select
                        value={locale}
                        onChange={(e) =>
                          router.replace(pathname, {
                            locale: e.target.value as 'ar' | 'en' | 'he',
                          })
                        }
                        className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm"
                      >
                        {Object.entries(localeNames).map(([code, name]) => (
                          <option key={code} value={code}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-muted hover:text-[var(--maher-error)]"
                  >
                    <LogOut className="h-4 w-4" />
                    {tAuth('logout')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/quotations' &&
                item.href !== '/dashboard' &&
                pathname.startsWith(`${item.href}/`)) ||
              (item.href === '/quotations' &&
                pathname.startsWith('/quotations') &&
                !pathname.startsWith('/quotations/request'));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-[var(--maher-radius-md)] px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-soft text-brand'
                    : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
