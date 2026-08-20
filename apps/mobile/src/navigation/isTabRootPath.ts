import type { AppSurface } from '@maher/permissions';
import { activeTabFromPath } from './activeTabFromPath';
import type { TabName } from './tabConfig';

const ALL_TAB_NAMES: TabName[] = [
  'index',
  'orders',
  'inventory',
  'production',
  'more',
  'catalog',
  'schedule',
  'new-order',
  'account',
  'tasks',
  'completed',
  'notifications',
  'profile',
];

function isTabName(value: string): value is TabName {
  return (ALL_TAB_NAMES as string[]).includes(value);
}

/**
 * True when the pathname is a bottom-tab root (not a pushed detail / module).
 * Used so L/R tab swipe doesn’t steal back-gestures on nested screens.
 */
export function isTabRootPath(pathname: string, surface: AppSurface): boolean {
  const raw = pathname.split('/').filter(Boolean);
  const segments = raw.filter((s) => !s.startsWith('('));

  if (segments.length === 0) return true;

  const tabsIdx = raw.indexOf('(tabs)');
  if (tabsIdx >= 0) {
    const after = raw.slice(tabsIdx + 1).filter((s) => !s.startsWith('('));
    return after.length <= 1;
  }

  if (segments.length === 1) {
    const only = segments[0]!;
    return only === 'index' || isTabName(only);
  }

  // Nested under a tab (e.g. /orders/id, /products, /more/…) — not a tab root.
  const tab = activeTabFromPath(surface, pathname);
  if (tab === 'index') return false;
  const tabIdx = segments.indexOf(tab);
  if (tabIdx >= 0) return tabIdx === segments.length - 1;
  return false;
}
