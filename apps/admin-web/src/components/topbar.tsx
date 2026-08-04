'use client';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { Button, cn, isNavItemActive, useHeaderOverDark } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronDown, LogOut, Menu, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LanguageSwitcher } from './language-switcher';
import { allNavItems, navFooterItems, navGroups } from './nav-items';
import { AppThemeToggle } from './theme-toggle';

interface NotificationItem {
  id: string;
  readAt?: string | null;
}

interface TopbarProps {
  onOpenSidebar: () => void;
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const overDark = useHeaderOverDark(headerRef, pathname);

  const allHrefs = useMemo(() => allNavItems.map((item) => item.href), []);
  const current =
    [
      ...navGroups.flatMap((g) => g.items.map((item) => ({ ...item, group: g.key }))),
      ...navFooterItems.map((item) => ({ ...item, group: 'groupMain' as const })),
    ].find((item) => isNavItemActive(pathname, item.href, allHrefs));

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
    <header
      ref={headerRef}
      data-header-tone={overDark ? 'on-dark' : 'on-light'}
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 lg:px-8',
        overDark ? 'border-white/10' : 'border-border',
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'maher-header-icon-btn lg:hidden',
          overDark && 'text-white hover:bg-white/10 hover:text-white',
        )}
        aria-label={t('openMenu')}
        onClick={onOpenSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div key={current?.href ?? 'home'} className="maher-animate-in-start min-w-0 flex-1">
        {current ? (
          <>
            <p
              className={cn(
                'maher-header-fg-muted text-[11px] font-medium uppercase tracking-[0.08em] rtl:normal-case rtl:tracking-normal',
                overDark ? 'text-white/70' : 'text-text-tertiary',
              )}
            >
              {t(current.group)}
            </p>
            <h1
              className={cn(
                'maher-header-fg truncate text-[15px] font-semibold leading-tight',
                overDark ? 'text-white' : 'text-text-primary',
              )}
            >
              {t(current.key)}
            </h1>
          </>
        ) : (
          <h1
            className={cn(
              'maher-header-fg truncate text-[15px] font-semibold',
              overDark ? 'text-white' : 'text-text-primary',
            )}
          >
            {tCommon('appName')}
          </h1>
        )}
      </div>

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
        <Bell className="h-[18px] w-[18px] transition-transform duration-500 ease-out group-hover:animate-[maher-shake_600ms_ease-in-out]" />
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
              'maher-header-fg hidden max-w-[10rem] truncate text-sm font-medium md:block',
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
              <p className="truncate text-sm font-semibold text-text-primary">{me.data?.name}</p>
              <p className="truncate text-xs text-text-secondary">{me.data?.email}</p>
              {me.data?.roles?.length ? (
                <p className="mt-1.5 truncate text-[11px] uppercase tracking-wide text-text-tertiary">
                  {me.data.roles.join(' · ')}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 border-b border-border px-3 py-2 sm:hidden">
              <AppThemeToggle />
              <LanguageSwitcher />
            </div>
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
    </header>
  );
}
