'use client';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { BrandMark, cn, isNavItemActive, useHeaderOverDark } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, ClipboardList, LogOut, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LanguageSwitcher } from './language-switcher';

const navItems = [
  { href: '/tasks', key: 'myOrders', icon: ClipboardList },
  { href: '/tasks/completed', key: 'completeTask', icon: CheckCircle2 },
] as const;

export function EmployeeShell({ children }: { children: ReactNode }) {
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

  const navHrefs = useMemo(() => navItems.map((item) => item.href), []);

  return (
    <div className="mx-auto min-h-screen max-w-xl bg-background shadow-elevated sm:my-6 sm:rounded-[var(--maher-radius-xl)]">
      <header
        ref={headerRef}
        data-header-tone={overDark ? 'on-dark' : 'on-light'}
        className={cn(
          'sticky top-0 z-20 border-b sm:rounded-t-[var(--maher-radius-xl)]',
          overDark ? 'border-white/10' : 'border-border',
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="group flex min-w-0 items-center gap-3">
            <span className="transition-transform duration-500 ease-out group-hover:rotate-6 group-hover:scale-110">
              <BrandMark size="md" animated />
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
                {tCommon('portalEmployee')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <LanguageSwitcher inverted={overDark} />

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className={cn(
                  'maher-press group flex items-center gap-1.5 rounded-[var(--maher-radius-md)] py-1 ps-1 pe-1.5',
                  overDark
                    ? cn('hover:bg-white/10', menuOpen && 'bg-white/10')
                    : cn('hover:bg-surface-muted', menuOpen && 'bg-surface-muted'),
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand transition-transform duration-300 ease-out group-hover:scale-105">
                  {initials || <User className="h-4 w-4" />}
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
                  className="maher-animate-pop absolute end-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-[var(--maher-radius-lg)] border border-border bg-surface text-text-primary shadow-float"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {me.data?.name}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      {me.data?.username ?? me.data?.email}
                    </p>
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

        <nav className="maher-stagger flex gap-1 px-3 pb-2">
          {navItems.map((item) => {
            const active = isNavItemActive(pathname, item.href, navHrefs);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'maher-nav-item maher-press group inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--maher-radius-md)] px-3 py-2.5 text-sm font-semibold',
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
      <main className="p-4 pb-24">
        <div key={pathname} className="maher-page-enter">
          {children}
        </div>
      </main>
    </div>
  );
}
