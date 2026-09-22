'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { useAuthMe } from '@/hooks/use-auth-me';
import { SectionTabs } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { useSectionCounts } from './nested-nav-counts';
import { canSeeNav, nestedNavGroups } from './nav-items';

/**
 * Section strip under the topbar: paper SectionTabs with live counts.
 * Groups and permission gates come from `nav-items.ts`.
 */
export function NestedNav() {
  const pathname = usePathname();
  const t = useTranslations('navigation');
  const me = useAuthMe();
  const permissions = me.data?.permissions ?? [];

  const group = nestedNavGroups.find((g) => g.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)));
  const items = group ? group.items.filter((item) => canSeeNav(item, permissions)) : [];
  const counts = useSectionCounts(group?.key ?? null, items.length >= 2);

  if (!group || items.length < 2) return null;

  const active =
    items.find((item) => item.href !== group.parentHref && (pathname === item.href || pathname.startsWith(`${item.href}/`)))?.href ??
    items.find((item) => pathname === item.href)?.href ??
    group.parentHref;

  return (
    <div className="mb-6">
      <SectionTabs
        aria-label={t('groupOperations')}
        LinkComponent={Link}
        value={active}
        items={items.map((item) => ({
          id: item.href,
          href: item.href,
          label: t(item.key),
          count: counts[item.href]?.count ?? null,
          tone: counts[item.href]?.tone,
        }))}
      />
    </div>
  );
}
