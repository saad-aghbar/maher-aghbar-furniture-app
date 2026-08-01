'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { BrandMark } from './brand-mark';
import { navGroups } from './nav-items';

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="group flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="transition-transform duration-500 ease-out group-hover:rotate-6 group-hover:scale-110">
          <BrandMark />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-snug text-text-primary">
            {tCommon('appName')}
          </p>
          <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">ERP Admin</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group, groupIndex) => (
          <div
            key={group.key}
            className="maher-animate-in-start mb-5 last:mb-0"
            style={{ animationDelay: `${groupIndex * 60}ms` }}
          >
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
              {t(group.key)}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-[var(--maher-radius-md)] px-3 py-2 text-sm font-medium',
                        'transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.98]',
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
                          active
                            ? 'text-brand'
                            : 'text-text-tertiary group-hover:text-text-secondary',
                        )}
                      />
                      <span className="truncate">{t(item.key)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
