import type { Permission } from '@maher/permissions';
import {
  Armchair,
  Banknote,
  Bell,
  Boxes,
  CalendarDays,
  Factory,
  FileBarChart2,
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
  { href: '/admin/dashboard', key: 'dashboard', icon: LayoutDashboard },
  {
    href: '/admin/orders',
    key: 'orders',
    icon: ShoppingCart,
    anyPermissions: ['request.read', 'quotation.read', 'sales-order.read'],
  },
  {
    href: '/admin/products',
    key: 'products',
    icon: Armchair,
    anyPermissions: ['catalog.read'],
  },
  {
    href: '/admin/customers',
    key: 'dealers',
    icon: Users,
    anyPermissions: ['customer.read'],
  },
  {
    href: '/admin/production',
    key: 'production',
    icon: Factory,
    anyPermissions: ['production-order.read'],
  },
  {
    href: '/admin/production/scheduling',
    key: 'scheduling',
    icon: CalendarDays,
    anyPermissions: ['schedule.read'],
  },
  {
    href: '/admin/production/workflow',
    key: 'workflow',
    icon: GitBranch,
    anyPermissions: ['production.workflow.read'],
  },
  {
    href: '/admin/inventory',
    key: 'inventory',
    icon: Boxes,
    anyPermissions: ['inventory.read'],
  },
  {
    href: '/admin/purchasing',
    key: 'purchasing',
    icon: Receipt,
    anyPermissions: ['purchase-order.read', 'supplier.read'],
  },
  {
    href: '/admin/invoices',
    key: 'invoices',
    icon: Banknote,
    anyPermissions: ['invoice.read'],
  },
  {
    href: '/admin/reports',
    key: 'reports',
    icon: FileBarChart2,
    anyPermissions: [
      'inventory.cost.read',
      'report.sales.read',
      'report.production.read',
      'report.inventory.read',
      'report.financial.read',
    ],
  },
  {
    href: '/admin/employees',
    key: 'users',
    icon: UserCog,
    anyPermissions: ['user.manage'],
  },
  {
    href: '/admin/returns',
    key: 'returns',
    icon: RotateCcw,
    anyPermissions: ['return.read'],
  },
];

/** Pinned to the bottom of the sidebar. */
export const navFooterItems: NavItem[] = [
  {
    href: '/admin/ai-chat',
    key: 'aiChat',
    icon: MessageSquare,
    anyPermissions: ['ai-chat.read'],
  },
  {
    href: '/admin/settings',
    key: 'settings',
    icon: Settings,
    anyPermissions: ['settings.manage', 'role.manage'],
  },
  {
    href: '/admin/notifications',
    key: 'notifications',
    icon: Bell,
    anyPermissions: ['notification.read'],
  },
];

export const navGroups: NavGroup[] = [{ key: 'groupMain', items: navItems }];

export const allNavItems: NavItem[] = [...navItems, ...navFooterItems];

export const nestedNavGroups: NestedNavGroup[] = [
  {
    parentHref: '/admin/orders',
    matchPrefixes: ['/admin/orders', '/admin/requests', '/admin/quotations', '/admin/sales-orders', '/admin/deliveries', '/admin/ai-intake'],
    items: [
      { href: '/admin/orders', key: 'ordersOverview', anyPermissions: ['request.read', 'sales-order.read'] },
      { href: '/admin/requests', key: 'ordersDrafts', anyPermissions: ['request.read'] },
      { href: '/admin/quotations', key: 'ordersReview', anyPermissions: ['quotation.read'] },
      { href: '/admin/sales-orders', key: 'ordersActive', anyPermissions: ['sales-order.read'] },
      { href: '/admin/deliveries', key: 'deliveries', anyPermissions: ['delivery.read'] },
    ],
  },
  {
    parentHref: '/admin/products',
    matchPrefixes: ['/admin/products', '/admin/categories', '/admin/materials', '/admin/fabrics', '/admin/spec-options', '/admin/spec-option-values'],
    items: [
      { href: '/admin/products', key: 'products', anyPermissions: ['catalog.read'] },
      { href: '/admin/categories', key: 'categories', anyPermissions: ['catalog.manage'] },
      { href: '/admin/materials', key: 'materials', anyPermissions: ['catalog.manage'] },
      { href: '/admin/fabrics', key: 'fabrics', anyPermissions: ['catalog.manage'] },
      { href: '/admin/spec-options', key: 'specOptionGroups', anyPermissions: ['catalog.manage'] },
      { href: '/admin/spec-option-values', key: 'specOptionValues', anyPermissions: ['catalog.manage'] },
    ],
  },
  {
    parentHref: '/admin/inventory',
    matchPrefixes: ['/admin/inventory', '/admin/warehouses'],
    items: [
      { href: '/admin/inventory', key: 'inventory', anyPermissions: ['inventory.read'] },
      { href: '/admin/inventory/receive', key: 'receive', anyPermissions: ['inventory.receive'] },
      { href: '/admin/inventory/low-stock', key: 'lowStock', anyPermissions: ['inventory.read'] },
      {
        href: '/admin/warehouses',
        key: 'warehouses',
        anyPermissions: ['warehouse.manage', 'warehouse.read'],
      },
    ],
  },
  {
    parentHref: '/admin/purchasing',
    matchPrefixes: ['/admin/purchasing', '/admin/suppliers'],
    items: [
      { href: '/admin/purchasing', key: 'purchasing', anyPermissions: ['purchase-order.read'] },
      { href: '/admin/purchasing/fabric', key: 'fabricJobs', anyPermissions: ['fabric.procurement.read'] },
      { href: '/admin/suppliers', key: 'suppliers', anyPermissions: ['supplier.read'] },
    ],
  },
  {
    parentHref: '/admin/production',
    matchPrefixes: ['/admin/production', '/admin/production-stages', '/admin/quality'],
    items: [
      {
        href: '/admin/production',
        key: 'production',
        anyPermissions: ['production-order.read'],
      },
      {
        href: '/admin/production/scheduling',
        key: 'scheduling',
        anyPermissions: ['schedule.read'],
      },
      {
        href: '/admin/production/workflow',
        key: 'workflow',
        anyPermissions: ['production.workflow.read'],
      },
      {
        href: '/admin/production/problems',
        key: 'productionProblems',
        anyPermissions: ['production-task.update-any'],
      },
      {
        href: '/admin/quality',
        key: 'quality',
        anyPermissions: ['quality-inspection.read'],
      },
    ],
  },
  {
    parentHref: '/admin/invoices',
    matchPrefixes: ['/admin/invoices', '/admin/payments'],
    items: [
      { href: '/admin/invoices', key: 'invoices', anyPermissions: ['invoice.read'] },
      { href: '/admin/payments', key: 'payments', anyPermissions: ['payment.read'] },
    ],
  },
  {
    parentHref: '/admin/employees',
    matchPrefixes: ['/admin/employees'],
    items: [
      { href: '/admin/employees', key: 'users', anyPermissions: ['user.manage'] },
      { href: '/admin/employees/staff-types', key: 'staffTypes', anyPermissions: ['role.manage'] },
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
