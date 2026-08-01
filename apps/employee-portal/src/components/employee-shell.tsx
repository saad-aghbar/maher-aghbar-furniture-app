'use client';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { BrandMark, cn } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ClipboardList,
  Home,
  Languages,
  LogOut,
  User,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const localeNames: Record<string, string> = { ar: 'العربية', en: 'English', he: 'עברית' };

const navItems = [
  { href: '/dashboard', key: 'dashboard', icon: Home },
  { href: '/tasks', key: 'tasks', icon: ClipboardList },
] as const;

export function EmployeeShell({ children }: { children: ReactNode }) {
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
    <div className="mx-auto min-h-screen max-w-xl bg-background shadow-elevated sm:my-6 sm:rounded-[var(--maher-radius-xl)]">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur-md sm:rounded-t-[var(--maher-radius-xl)]">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-text-primary">
                {tCommon('appName')}
              </p>
              <p className="text-xs text-text-tertiary">{tCommon('portalEmployee')}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <label className="relative flex items-center" title={t('language')}>
              <Languages className="pointer-events-none absolute start-2 h-3.5 w-3.5 text-text-tertiary" />
              <span className="sr-only">{t('language')}</span>
              <select
                value={locale}
                onChange={(e) =>
                  router.replace(pathname, { locale: e.target.value as 'ar' | 'en' | 'he' })
                }
                className="h-9 max-w-[7.5rem] appearance-none rounded-[var(--maher-radius-md)] border border-border bg-surface ps-7 pe-6 text-xs text-text-secondary"
              >
                {Object.entries(localeNames).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className={cn(
                  'flex items-center gap-1.5 rounded-[var(--maher-radius-md)] py-1 ps-1 pe-1.5 transition-colors hover:bg-surface-muted',
                  menuOpen && 'bg-surface-muted',
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                  {initials || <User className="h-4 w-4" />}
                </span>
                <ChevronDown className="h-4 w-4 text-text-tertiary" />
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="maher-animate-pop absolute end-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-[var(--maher-radius-lg)] border border-border bg-surface shadow-float"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {me.data?.name}
                    </p>
                    <p className="truncate text-xs text-text-secondary">{me.data?.email}</p>
                    {me.data?.roles?.length ? (
                      <p className="mt-1 truncate text-[11px] uppercase tracking-wide text-text-tertiary">
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
          </div>
        </div>

        <nav className="flex gap-1 px-3 pb-2">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--maher-radius-md)] px-3 py-2.5 text-sm font-semibold transition-colors',
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
      <main className="p-4 pb-24">{children}</main>
    </div>
  );
}
