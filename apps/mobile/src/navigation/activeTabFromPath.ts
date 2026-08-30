import type { AppSurface } from '@maher/permissions';
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
 * Resolve which bottom-tab should look selected for the current pathname.
 * Expo Router often strips `(group)` segments, so `/more` and `/(tabs)/more`
 * must both map to the More tab — not fall through to Home.
 */
export function activeTabFromPath(surface: AppSurface, pathname: string): TabName {
  const segments = pathname.split('/').filter(Boolean);

  const tabsIdx = segments.indexOf('(tabs)');
  if (tabsIdx >= 0) {
    const next = segments[tabsIdx + 1];
    if (surface === 'customer' && next === 'schedule') return 'account';
    if (next && isTabName(next) && next !== 'index') return next;
    return 'index';
  }

  // Nested stack screens that belong under a primary tab.
  if (surface === 'admin') {
    if (
      segments.includes('orders') ||
      segments.includes('requests') ||
      segments.includes('quotations')
    ) {
      return 'orders';
    }
    if (segments.includes('inventory')) return 'inventory';
    if (segments.includes('production')) return 'production';
    if (
      segments.includes('products') ||
      segments.includes('dealers') ||
      segments.includes('users') ||
      segments.includes('purchasing') ||
      segments.includes('invoices') ||
      segments.includes('reports') ||
      segments.includes('returns') ||
      segments.includes('scheduling') ||
      segments.includes('ai-intake') ||
      segments.includes('ai-chat') ||
      segments.includes('notifications') ||
      segments.includes('search') ||
      segments.includes('more')
    ) {
      return 'more';
    }
  }

  if (surface === 'customer') {
    if (segments.includes('catalog')) return 'catalog';
    if (segments.includes('new-order') || segments.includes('requests')) return 'new-order';
    if (segments.includes('orders')) return 'orders';
    if (segments.includes('schedule') || segments.includes('calendar')) return 'account';
    if (
      segments.includes('account') ||
      segments.includes('invoices') ||
      segments.includes('returns') ||
      segments.includes('ai-chat')
    ) {
      return 'account';
    }
  }

  if (surface === 'employee') {
    if (segments.includes('tasks')) return 'tasks';
    if (segments.includes('completed')) return 'completed';
    if (segments.includes('notifications')) return 'notifications';
    if (segments.includes('profile')) return 'profile';
  }

  // Bare tab routes after groups are stripped: `/more`, `/orders`, …
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i]!;
    if (seg.startsWith('(')) continue;
    if (isTabName(seg) && seg !== 'index') return seg;
  }

  return 'index';
}
