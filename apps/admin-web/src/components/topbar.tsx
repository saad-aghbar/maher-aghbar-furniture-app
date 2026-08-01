'use client';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { Button, cn } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronDown, Languages, LogOut, Menu, User } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { navGroups } from './nav-items';

const localeNames: Record<string, string> = { ar: 'العربية', en: 'English', he: 'עברית' };

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
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const current = navGroups
    .flatMap((g) => g.items.map((item) => ({ ...item, group: g.key })))
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur-md lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label={t('openMenu')}
        onClick={onOpenSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0 flex-1">
        {current ? (
          <>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
              {t(current.group)}
            </p>
            <h1 className="truncate text-[15px] font-semibold leading-tight text-text-primary">
              {t(current.key)}
            </h1>
          </>
        ) : (
          <h1 className="truncate text-[15px] font-semibold text-text-primary">
            {tCommon('appName')}
          </h1>
        )}
      </div>

      <label className="relative hidden items-center sm:flex" title={t('language')}>
        <Languages className="pointer-events-none absolute start-2.5 h-4 w-4 text-text-tertiary" />
        <span className="sr-only">{t('language')}</span>
        <select
          value={locale}
          onChange={(e) => router.replace(pathname, { locale: e.target.value as 'ar' | 'en' | 'he' })}
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
          <span className="hidden max-w-[10rem] truncate text-sm font-medium text-text-primary md:block">
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
              <p className="truncate text-sm font-semibold text-text-primary">{me.data?.name}</p>
              <p className="truncate text-xs text-text-secondary">{me.data?.email}</p>
              {me.data?.roles?.length ? (
                <p className="mt-1.5 truncate text-[11px] uppercase tracking-wide text-text-tertiary">
                  {me.data.roles.join(' · ')}
                </p>
              ) : null}
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
    </header>
  );
}
