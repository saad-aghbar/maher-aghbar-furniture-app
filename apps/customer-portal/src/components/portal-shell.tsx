'use client';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { BrandMark, cn, isNavItemActive } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Scroll,
  ShoppingBag,
  SquarePen,
  Undo2,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LanguageSwitcher } from './language-switcher';
import { AppThemeToggle } from './theme-toggle';

const items: Array<{ href: string; key: string; icon: LucideIcon }> = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/catalog', key: 'catalog', icon: ShoppingBag },
  { href: '/orders/new', key: 'createOrder', icon: SquarePen },
  { href: '/orders', key: 'myOrders', icon: Package },
  { href: '/invoices', key: 'invoices', icon: Receipt },
  { href: '/statement', key: 'statement', icon: Scroll },
  { href: '/contracts', key: 'contracts', icon: FileText },
  { href: '/documents', key: 'documents', icon: FolderOpen },
  { href: '/returns', key: 'returns', icon: Undo2 },
  { href: '/profile', key: 'profile', icon: User },
];

interface NotificationItem {
  id: string;
  readAt?: string | null;
}

function useEmbedded() {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('embedded') === '1';
    const fromClass = document.documentElement.classList.contains('maher-embedded');
    setEmbedded(fromQuery || fromClass);
    if (fromQuery) document.documentElement.classList.add('maher-embedded');
  }, []);
  return embedded;
}

function CustomerSidebar({
  onNavigate,
  unread,
  onLogout,
  userName,
  userHandle,
}: {
  onNavigate?: () => void;
  unread: number;
  onLogout: () => void;
  userName?: string;
  userHandle?: string;
}) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const pathname = usePathname();
  const navHrefs = useMemo(() => items.map((item) => item.href), []);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="group flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="transition-transform duration-500 ease-out group-hover:rotate-6 group-hover:scale-110">
          <BrandMark animated />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-snug text-text-primary">{tCommon('appName')}</p>
          <p className="text-[11px] text-text-tertiary">{tCommon('portalCustomer')}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
        <ul className="maher-stagger space-y-0.5">
          {items.map((item) => {
            const active = isNavItemActive(pathname, item.href, navHrefs);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'maher-nav-item group relative flex items-center gap-3 rounded-[var(--maher-radius-md)] px-3 py-2 text-sm font-medium',
                    active
                      ? 'bg-brand-soft text-brand'
                      : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary hover:ps-4',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-y-1.5 start-0 w-0.5 origin-center rounded-full bg-brand transition-transform duration-300 ease-out',
                      active ? 'scale-y-100' : 'scale-y-0',
                    )}
                  />
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 transition-[color,transform] duration-300 ease-out group-hover:scale-110',
                      active ? 'text-brand' : 'text-text-tertiary group-hover:text-text-secondary',
                    )}
                  />
                  <span className="truncate">{t(item.key)}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto space-y-2 border-t border-border pt-3">
          <Link
            href="/notifications"
            onClick={onNavigate}
            className="maher-nav-item relative flex items-center gap-3 rounded-[var(--maher-radius-md)] px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="flex-1">{t('notifications')}</span>
            {unread > 0 ? (
              <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </Link>
          <div className="flex items-center gap-2 px-2 py-1">
            <AppThemeToggle />
            <LanguageSwitcher />
          </div>
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-text-primary">{userName}</p>
            <p className="truncate text-xs text-text-secondary">{userHandle}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="group/logout flex w-full items-center gap-3 rounded-[var(--maher-radius-md)] px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted hover:text-[var(--maher-error)]"
          >
            <LogOut className="h-[18px] w-[18px] transition-transform duration-300 ease-out group-hover/logout:translate-x-0.5 rtl:group-hover/logout:-translate-x-0.5" />
            {tAuth('logout')}
          </button>
        </div>
      </nav>
    </div>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const embedded = useEmbedded();
  const [mobileOpen, setMobileOpen] = useState(false);

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
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  async function logout() {
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST', body: '{}' });
    } catch {
      /* ignore */
    }
    router.push('/login');
    router.refresh();
  }

  const sidebarProps = {
    unread,
    onLogout: logout,
    userName: me.data?.name,
    userHandle: me.data?.username ?? me.data?.email,
  };

  return (
    <div className={cn('flex min-h-screen bg-background', embedded && 'maher-embedded-shell')}>
      {/* Desktop / wide: persistent side nav */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen w-[264px] shrink-0 border-e border-border bg-surface',
          embedded ? 'md:block' : 'lg:block',
        )}
      >
        <CustomerSidebar {...sidebarProps} />
      </aside>

      {/* Narrow: slide-in side drawer */}
      {mobileOpen ? (
        <div className={cn('fixed inset-0 z-50', embedded ? 'md:hidden' : 'lg:hidden')}>
          <button
            type="button"
            aria-label={t('closeMenu')}
            className="maher-animate-fade absolute inset-0 bg-[#1c1917]/45 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="maher-animate-in-start absolute inset-y-0 start-0 w-[264px] shadow-float">
            <CustomerSidebar {...sidebarProps} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-md">
          <button
            type="button"
            aria-label={t('openMenu')}
            className={cn(
              'maher-header-icon-btn maher-press flex h-9 w-9 items-center justify-center rounded-[var(--maher-radius-md)] text-text-secondary hover:bg-surface-muted hover:text-text-primary',
              embedded ? 'md:hidden' : 'lg:hidden',
            )}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-primary">{tCommon('portalCustomer')}</p>
          </div>
          <Link
            href="/notifications"
            aria-label={t('notifications')}
            className="maher-header-icon-btn maher-press relative flex h-9 w-9 items-center justify-center rounded-[var(--maher-radius-md)] text-text-secondary hover:bg-surface-muted hover:text-text-primary"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 ? (
              <span className="absolute -top-0.5 end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </Link>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div key={pathname} className="maher-page-enter mx-auto w-full max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
