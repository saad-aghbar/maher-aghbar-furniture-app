import type { Href } from 'expo-router';
import type { AdminHomePayload } from './api';

export type HomeFocus = {
  key: string;
  count: number;
  titleKey: string;
  actionKey: string;
  href: Href;
  kind: 'blocker' | 'watch' | 'flow';
};

/**
 * Single most useful next action for Home — not a dashboard list.
 * Note: Signature management desk uses server attention cards instead.
 * These deep-links are only for living / atelier compositions.
 */
export function pickHomeFocus(data: AdminHomePayload): HomeFocus | null {
  const candidates: HomeFocus[] = [
    {
      key: 'late',
      count: data.delayedOrders,
      titleKey: 'mobile.adminHome.queue.late.title',
      actionKey: 'mobile.adminHome.queue.late.action',
      href: '/(app)/(admin)/(tabs)/orders?focus=needs_attention' as Href,
      kind: 'blocker',
    },
    {
      key: 'tasks',
      count: data.urgentTasksCount,
      titleKey: 'mobile.adminHome.queue.tasks.title',
      actionKey: 'mobile.adminHome.queue.tasks.action',
      href: '/(app)/(admin)/(tabs)/production?bucket=blocked' as Href,
      kind: 'blocker',
    },
    {
      key: 'stock',
      count: data.lowStockItems,
      titleKey: 'mobile.adminHome.queue.stock.title',
      actionKey: 'mobile.adminHome.queue.stock.action',
      href: '/(app)/(admin)/(tabs)/inventory',
      kind: 'watch',
    },
    {
      key: 'returns',
      count: data.pendingReturns,
      titleKey: 'mobile.adminHome.queue.returns.title',
      actionKey: 'mobile.adminHome.queue.returns.action',
      href: '/(app)/(admin)/returns',
      kind: 'watch',
    },
    {
      key: 'near',
      count: data.ordersNearingDelivery,
      titleKey: 'mobile.adminHome.queue.near.title',
      actionKey: 'mobile.adminHome.queue.near.action',
      href: '/(app)/(admin)/(tabs)/orders?focus=ready_to_ship' as Href,
      kind: 'flow',
    },
  ];

  const live = candidates.filter((c) => c.count > 0);
  if (live.length === 0) return null;

  const rank = (k: HomeFocus['kind']) => (k === 'blocker' ? 3 : k === 'watch' ? 2 : 1);
  live.sort((a, b) => {
    const kr = rank(b.kind) - rank(a.kind);
    if (kr !== 0) return kr;
    return b.count - a.count;
  });
  return live[0]!;
}

export function homeAttentionCount(data: AdminHomePayload): number {
  return data.delayedOrders + data.urgentTasksCount + data.lowStockItems + data.pendingReturns;
}
