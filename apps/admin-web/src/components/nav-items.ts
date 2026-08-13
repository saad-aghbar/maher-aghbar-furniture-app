import type { Permission } from '@maher/permissions';
import {
  Armchair,
  Banknote,
  Bell,
  Boxes,
  CalendarDays,
  Factory,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  key: string;
  icon: LucideIcon;
  anyPermissions?: readonly Permission[];
}

export interface NavGroup {
  key: string;
  items: NavItem[];
}

export interface NestedNavItem {
  href: string;
  key: string;
  anyPermissions?: readonly Permission[];
}

export interface NestedNavGroup {
  parentHref: string;
  matchPrefixes: string[];
  items: NestedNavItem[];
}

/** Father-friendly factory sidebar — Orders / Products / Inventory / Production first. */
export const navItems: NavItem[] = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  {
    href: '/orders',
    key: 'orders',
    icon: ShoppingCart,
    anyPermissions: ['request.read', 'quotation.read', 'sales-order.read'],
  },
  {
    href: '/products',
    key: 'products',
    icon: Armchair,
    anyPermissions: ['catalog.manage'],
  },
  {
    href: '/customers',
    key: 'dealers',
    icon: Users,
    anyPermissions: ['customer.read'],
  },
  {
    href: '/production',
    key: 'production',
    icon: Factory,
    anyPermissions: ['production-order.read'],
  },
  {
    href: '/production/scheduling',
    key: 'scheduling',
    icon: CalendarDays,
    anyPermissions: ['schedule.read'],
  },
  {
    href: '/production/workflow',
    key: 'workflow',
    icon: GitBranch,
    anyPermissions: ['production.workflow.read'],
  },
  {
    href: '/ai-chat',
    key: 'aiChat',
    icon: MessageSquare,
    anyPermissions: ['ai-chat.read'],
  },
  {
    href: '/inventory',
    key: 'inventory',
    icon: Boxes,
    anyPermissions: ['inventory.read'],
  },
  {
    href: '/purchasing',
    key: 'purchasing',
    icon: Receipt,
    anyPermissions: ['purchase-order.read', 'supplier.read'],
  },
  {
    href: '/invoices',
    key: 'invoices',
    icon: Banknote,
    anyPermissions: ['invoice.read'],
  },
  {
    href: '/employees',
    key: 'users',
    icon: UserCog,
    anyPermissions: ['user.manage'],
  },
  {
    href: '/returns',
    key: 'returns',
    icon: RotateCcw,
    anyPermissions: ['sales-order.read', 'customer.read'],
  },
];

/** Pinned to the bottom of the sidebar. */
export const navFooterItems: NavItem[] = [
  {
    href: '/settings',
    key: 'settings',
    icon: Settings,
    anyPermissions: ['settings.manage', 'role.manage'],
  },
  {
    href: '/notifications',
    key: 'notifications',
    icon: Bell,
    anyPermissions: ['notification.read'],
  },
];

export const navGroups: NavGroup[] = [{ key: 'groupMain', items: navItems }];

export const allNavItems: NavItem[] = [...navItems, ...navFooterItems];

export const nestedNavGroups: NestedNavGroup[] = [
  {
    parentHref: '/orders',
    matchPrefixes: ['/orders', '/requests', '/quotations', '/sales-orders', '/deliveries', '/ai-intake'],
    items: [
      { href: '/orders', key: 'ordersOverview', anyPermissions: ['request.read', 'sales-order.read'] },
      { href: '/requests', key: 'ordersDrafts', anyPermissions: ['request.read'] },
      { href: '/quotations', key: 'ordersReview', anyPermissions: ['quotation.read'] },
      { href: '/sales-orders', key: 'ordersActive', anyPermissions: ['sales-order.read'] },
      { href: '/deliveries', key: 'deliveries', anyPermissions: ['delivery.read'] },
      { href: '/ai-intake', key: 'aiIntake', anyPermissions: ['ai-intake.read', 'ai-intake.manage'] },
    ],
  },
  {
    parentHref: '/products',
    matchPrefixes: ['/products', '/categories', '/materials', '/fabrics'],
    items: [
      { href: '/products', key: 'products', anyPermissions: ['catalog.manage'] },
      { href: '/categories', key: 'categories', anyPermissions: ['catalog.manage'] },
      { href: '/materials', key: 'materials', anyPermissions: ['catalog.manage'] },
      { href: '/fabrics', key: 'fabrics', anyPermissions: ['catalog.manage'] },
    ],
  },
  {
    parentHref: '/inventory',
    matchPrefixes: ['/inventory', '/warehouses'],
    items: [
      { href: '/inventory', key: 'inventory', anyPermissions: ['inventory.read'] },
      {
        href: '/warehouses',
        key: 'warehouses',
        anyPermissions: ['warehouse.manage', 'inventory.read'],
      },
    ],
  },
  {
    parentHref: '/purchasing',
    matchPrefixes: ['/purchasing', '/suppliers'],
    items: [
      { href: '/purchasing', key: 'purchasing', anyPermissions: ['purchase-order.read'] },
      { href: '/suppliers', key: 'suppliers', anyPermissions: ['supplier.read'] },
    ],
  },
  {
    parentHref: '/production',
    matchPrefixes: ['/production', '/production-stages', '/quality'],
    items: [
      {
        href: '/production',
        key: 'production',
        anyPermissions: ['production-order.read'],
      },
      {
        href: '/production/scheduling',
        key: 'scheduling',
        anyPermissions: ['schedule.read'],
      },
      {
        href: '/production/workflow',
        key: 'workflow',
        anyPermissions: ['production.workflow.read'],
      },
      {
        href: '/quality',
        key: 'quality',
        anyPermissions: ['quality-inspection.read'],
      },
    ],
  },
];

export function canSeeNav(item: { anyPermissions?: readonly Permission[] }, permissions: string[]) {
  if (!item.anyPermissions?.length) return true;
  return item.anyPermissions.some((p) => permissions.includes(p));
}

export function visibleNavItems(permissions: string[]) {
  return allNavItems.filter((item) => canSeeNav(item, permissions));
}
