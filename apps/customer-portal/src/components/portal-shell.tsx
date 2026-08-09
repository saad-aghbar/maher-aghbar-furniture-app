'use client';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { BrandMark, cn, isNavItemActive, useHeaderOverDark } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ChevronDown,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Scroll,
  ShoppingBag,
  SquarePen,
  Undo2,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LanguageSwitcher } from './language-switcher';
import { AppThemeToggle } from './theme-toggle';

const items = [
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const overDark = useHeaderOverDark(headerRef, pathname);

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

  const navHrefs = useMemo(() => items.map((item) => item.href), []);

  const initials = (me.data?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div className="min-h-screen bg-background">
      <header
        ref={headerRef}
        data-header-tone={overDark ? 'on-dark' : 'on-light'}
        className={cn(
          'sticky top-0 z-[1100] border-b',
          overDark ? 'border-white/10' : 'border-border',
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="group flex min-w-0 items-center gap-3">
            <span className="transition-transform duration-500 ease-out group-hover:rotate-6 group-hover:scale-110">
              <BrandMark animated />
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  'maher-header-fg truncate text-sm font-bold leading-tight',
                  overDark ? 'text-white' : 'text-text-primary',
                )}
              >
                {tCommon('appName')}
              </p>
              <p
                className={cn(
                  'maher-header-fg-muted text-xs',
                  overDark ? 'text-white/70' : 'text-text-tertiary',
                )}
              >
                {tCommon('portalCustomer')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <AppThemeToggle className="hidden sm:inline-flex" inverted={overDark} />
            <LanguageSwitcher className="hidden sm:block" inverted={overDark} />

            <Link
              href="/notifications"
              aria-label={t('notifications')}
              className={cn(
                'maher-header-icon-btn maher-press group relative flex h-9 w-9 items-center justify-center rounded-[var(--maher-radius-md)]',
                overDark
                  ? 'text-white hover:bg-white/10 hover:text-white'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
              )}
            >
              <Bell className="h-[18px] w-[18px] group-hover:animate-[maher-shake_600ms_ease-in-out]" />
              {unread > 0 ? (
                <span className="maher-animate-bounce-in absolute -top-0.5 end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                  <span
                    className="absolute inset-0 rounded-full bg-brand"
                    style={{ animation: 'maher-ring-pulse 2s ease-out infinite' }}
                    aria-hidden="true"
                  />
                  <span className="relative">{unread > 9 ? '9+' : unread}</span>
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
                  'maher-press group flex items-center gap-2 rounded-[var(--maher-radius-md)] py-1 ps-1 pe-2',
                  overDark
                    ? cn('hover:bg-white/10', menuOpen && 'bg-white/10')
                    : cn('hover:bg-surface-muted', menuOpen && 'bg-surface-muted'),
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand transition-transform duration-300 ease-out group-hover:scale-105">
                  {initials || <User className="h-4 w-4" />}
                </span>
                <span
                  className={cn(
                    'maher-header-fg hidden max-w-[9rem] truncate text-sm font-medium md:block',
                    overDark ? 'text-white' : 'text-text-primary',
                  )}
                >
                  {me.data?.name ?? ''}
                </span>
                <ChevronDown
                  className={cn(
                    'maher-header-fg-muted h-4 w-4 transition-transform duration-300 ease-out',
                    overDark ? 'text-white/70' : 'text-text-tertiary',
                    menuOpen && 'rotate-180 !text-brand',
                  )}
                />
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="maher-animate-pop absolute end-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-[var(--maher-radius-lg)] border border-border bg-surface text-text-primary shadow-float"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {me.data?.name}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      {me.data?.username ?? me.data?.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2 sm:hidden">
                    <AppThemeToggle />
                    <LanguageSwitcher />
                  </div>
                  <Link
                    href="/profile"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                  >
                    <FileText className="h-4 w-4" />
                    {t('profile')}
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    className="group/logout flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-muted hover:text-[var(--maher-error)]"
                  >
                    <LogOut className="h-4 w-4 transition-transform duration-300 ease-out group-hover/logout:translate-x-0.5 rtl:group-hover/logout:-translate-x-0.5" />
                    {tAuth('logout')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <nav className="maher-stagger mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {items.map((item) => {
            const active = isNavItemActive(pathname, item.href, navHrefs);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'maher-nav-item maher-press group flex items-center gap-2 whitespace-nowrap rounded-[var(--maher-radius-md)] px-3 py-2 text-sm font-medium',
                  active
                    ? 'bg-brand-soft text-brand'
                    : overDark
                      ? 'text-white hover:bg-white/10 hover:text-white'
                      : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
                )}
              >
                <Icon className="h-4 w-4 transition-transform duration-300 ease-out group-hover:scale-110" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div key={pathname} className="maher-page-enter">
          {children}
        </div>
      </main>
    </div>
  );
}
