'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { cn, isNavItemActive } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { BrandMark } from './brand-mark';
import { allNavItems, canSeeNav, navFooterItems, navGroups, type NavItem } from './nav-items';
import { useAuthMe } from '@/hooks/use-auth-me';

interface SidebarProps {
  onNavigate?: () => void;
  compact?: boolean;
}

function NavLink({
  item,
  pathname,
  label,
  allHrefs,
  onNavigate,
  compact = false,
}: {
  item: NavItem;
  pathname: string;
  label: string;
  allHrefs: readonly string[];
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const active = isNavItemActive(pathname, item.href, allHrefs);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={compact ? label : undefined}
      className={cn(
        'maher-nav-item group relative flex items-center gap-3 rounded-[var(--maher-radius-md)] py-2 text-sm font-medium',
        compact ? 'justify-center px-0' : 'px-3',
        active
          ? 'bg-brand-soft text-brand'
          : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
        !compact && !active && 'hover:ps-4',
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
      <span className={compact ? 'sr-only' : 'truncate'}>{label}</span>
    </Link>
  );
}

export function Sidebar({ onNavigate, compact = false }: SidebarProps) {
  const t = useTranslations('navigation');
  const pathname = usePathname();
  const me = useAuthMe();
  const permissions = me.data?.permissions ?? [];
  const allHrefs = useMemo(() => allNavItems.map((item) => item.href), []);
  const groups = useMemo(
    () =>
      navGroups.map((group) => ({
        ...group,
        items: group.items.filter((item) => canSeeNav(item, permissions)),
      })),
    [permissions],
  );
  const footer = useMemo(
    () => navFooterItems.filter((item) => canSeeNav(item, permissions)),
    [permissions],
  );

  return (
    <div className="relative flex h-full flex-col bg-[var(--maher-surface)]/80 backdrop-blur-xl">
      <div className={cn('flex items-center border-b border-border py-4', compact ? 'justify-center px-2' : 'px-5')}>
        <BrandMark size={compact ? 'sm' : 'md'} variant={compact ? 'mark' : 'lockup'} />
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
        {groups.map((group, groupIndex) => (
          <div
            key={group.key}
            className="maher-animate-in-start mb-5 last:mb-0"
            style={{ animationDelay: `${groupIndex * 60}ms` }}
          >
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    pathname={pathname}
                    label={t(item.key)}
                    allHrefs={allHrefs}
                    onNavigate={onNavigate}
                    compact={compact}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}

        <ul className="mt-auto space-y-0.5 border-t border-border pt-3">
          {footer.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                pathname={pathname}
                label={t(item.key)}
                allHrefs={allHrefs}
                onNavigate={onNavigate}
                compact={compact}
              />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
