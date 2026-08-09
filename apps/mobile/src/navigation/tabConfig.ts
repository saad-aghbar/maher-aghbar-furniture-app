import type { AuthUser } from '@maher/types';
import type { AppSurface, Permission } from '@maher/permissions';
import { can, canAny } from '@maher/permissions';

export type TabName =
  | 'index'
  | 'orders'
  | 'inventory'
  | 'production'
  | 'more'
  | 'catalog'
  | 'new-order'
  | 'account'
  | 'tasks'
  | 'completed'
  | 'notifications'
  | 'profile';

export type TabDef = {
  name: TabName;
  /** i18n key under mobile.tabs.* */
  labelKey: string;
  /** When omitted, tab is always visible for the surface. */
  visible?: (user: AuthUser) => boolean;
  /** Optional gate for deep links into this screen. */
  require?: { permissions: Permission[]; mode: 'any' | 'all' };
};

const ADMIN_ORDERS: Permission[] = ['sales-order.read', 'quotation.read', 'request.read'];
const ADMIN_INVENTORY: Permission[] = [
  'inventory.read',
  'inventory.count',
  'inventory.receive',
  'purchase-order.read',
];
const ADMIN_PRODUCTION: Permission[] = ['production-order.read', 'production-task.read'];

export const adminTabs: TabDef[] = [
  { name: 'index', labelKey: 'home' },
  {
    name: 'orders',
    labelKey: 'orders',
    visible: (u) => canAny(u, ADMIN_ORDERS),
    require: { permissions: ADMIN_ORDERS, mode: 'any' },
  },
  {
    name: 'inventory',
    labelKey: 'inventory',
    visible: (u) => canAny(u, ADMIN_INVENTORY),
    require: { permissions: ADMIN_INVENTORY, mode: 'any' },
  },
  {
    name: 'production',
    labelKey: 'production',
    visible: (u) => canAny(u, ADMIN_PRODUCTION),
    require: { permissions: ADMIN_PRODUCTION, mode: 'any' },
  },
  { name: 'more', labelKey: 'more' },
];

export const customerTabs: TabDef[] = [
  { name: 'index', labelKey: 'home' },
  {
    name: 'catalog',
    labelKey: 'catalog',
    visible: (u) => can(u, 'catalog.read'),
    require: { permissions: ['catalog.read'], mode: 'all' },
  },
  {
    name: 'new-order',
    labelKey: 'newOrder',
    visible: (u) => can(u, 'request.create'),
    require: { permissions: ['request.create'], mode: 'all' },
  },
  {
    name: 'orders',
    labelKey: 'orders',
    visible: (u) => can(u, 'sales-order.read'),
    require: { permissions: ['sales-order.read'], mode: 'all' },
  },
  { name: 'account', labelKey: 'account' },
];

export const employeeTabs: TabDef[] = [
  { name: 'index', labelKey: 'home' },
  {
    name: 'tasks',
    labelKey: 'myTasks',
    visible: (u) => can(u, 'production-task.read'),
    require: { permissions: ['production-task.read'], mode: 'all' },
  },
  {
    name: 'completed',
    labelKey: 'completed',
    visible: (u) => can(u, 'production-task.read'),
    require: { permissions: ['production-task.read'], mode: 'all' },
  },
  {
    name: 'notifications',
    labelKey: 'notifications',
    visible: (u) => can(u, 'notification.read'),
    require: { permissions: ['notification.read'], mode: 'all' },
  },
  { name: 'profile', labelKey: 'profile' },
];

export function tabsForSurface(surface: AppSurface): TabDef[] {
  if (surface === 'customer') return customerTabs;
  if (surface === 'employee') return employeeTabs;
  return adminTabs;
}

/** Visible tabs for a user on a surface — max 5, Home always if present. */
export function visibleTabsForUser(surface: AppSurface, user: AuthUser): TabDef[] {
  const tabs = tabsForSurface(surface).filter((tab) => (tab.visible ? tab.visible(user) : true));
  return tabs.slice(0, 5);
}

export function isTabAllowed(surface: AppSurface, tabName: string, user: AuthUser): boolean {
  return visibleTabsForUser(surface, user).some((t) => t.name === tabName);
}
