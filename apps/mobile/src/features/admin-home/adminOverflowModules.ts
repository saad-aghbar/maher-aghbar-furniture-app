import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { canAll, canAny, type Permission } from '@maher/permissions';
import type { AuthUser } from '@maher/types';

export type OverflowModuleTone = 'ink' | 'paper';
export type OverflowModuleSpan = 'full' | 'half';
export type OverflowSurface = 'home' | 'more';

export type AdminOverflowModule = {
  key: string;
  labelKey: string;
  hintKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
  permissions?: Permission[];
  mode?: 'any' | 'all';
  span: OverflowModuleSpan;
  tone: OverflowModuleTone;
  /** Default: both home quick-access and More atlas. */
  surfaces?: OverflowSurface[];
};

/**
 * Web-sidebar modules that are NOT bottom tabs
 * (Orders / Inventory / Production live in the tab bar).
 */
export const ADMIN_OVERFLOW_MODULES: AdminOverflowModule[] = [
  {
    key: 'products',
    labelKey: 'mobile.adminHome.navProducts',
    hintKey: 'mobile.adminHome.navProductsHint',
    icon: 'cube-outline',
    href: '/(app)/(admin)/products',
    permissions: ['catalog.read'],
    mode: 'all',
    span: 'half',
    tone: 'ink',
  },
  {
    key: 'dealers',
    labelKey: 'mobile.adminHome.navDealers',
    hintKey: 'mobile.adminHome.navDealersHint',
    icon: 'people-outline',
    href: '/(app)/(admin)/dealers',
    permissions: ['customer.read'],
    mode: 'all',
    span: 'half',
    tone: 'paper',
  },
  {
    key: 'purchasing',
    labelKey: 'mobile.adminHome.navPurchasing',
    hintKey: 'mobile.adminHome.navPurchasingHint',
    icon: 'receipt-outline',
    href: '/(app)/(admin)/purchasing',
    permissions: ['purchase-order.read', 'supplier.read'],
    mode: 'any',
    span: 'full',
    tone: 'paper',
  },
  {
    key: 'invoices',
    labelKey: 'mobile.adminHome.navInvoices',
    hintKey: 'mobile.adminHome.navInvoicesHint',
    icon: 'cash-outline',
    href: '/(app)/(admin)/invoices',
    permissions: ['invoice.read'],
    mode: 'all',
    span: 'half',
    tone: 'ink',
  },
  {
    key: 'scheduling',
    labelKey: 'mobile.adminHome.navScheduling',
    hintKey: 'mobile.adminHome.navSchedulingHint',
    icon: 'calendar-outline',
    href: '/(app)/(admin)/scheduling',
    permissions: ['schedule.read', 'schedule.capacity.read'],
    mode: 'any',
    span: 'half',
    tone: 'ink',
  },
  {
    key: 'workflow',
    labelKey: 'mobile.adminHome.navWorkflow',
    hintKey: 'mobile.adminHome.navWorkflowHint',
    icon: 'git-network-outline',
    href: '/(app)/(admin)/production/workflow',
    permissions: ['production.workflow.read', 'production-order.update'],
    mode: 'any',
    span: 'full',
    tone: 'paper',
    surfaces: ['more', 'home'],
  },
  {
    key: 'returns',
    labelKey: 'mobile.adminHome.navReturns',
    hintKey: 'mobile.adminHome.navReturnsHint',
    icon: 'return-down-back-outline',
    href: '/(app)/(admin)/returns',
    permissions: ['sales-order.read'],
    mode: 'all',
    span: 'half',
    tone: 'paper',
  },
  {
    key: 'reports',
    labelKey: 'mobile.adminHome.navReports',
    hintKey: 'mobile.adminHome.navReportsHint',
    icon: 'stats-chart-outline',
    href: '/(app)/(admin)/reports',
    permissions: [
      'report.sales.read',
      'report.production.read',
      'report.financial.read',
      'report.inventory.read',
    ],
    mode: 'any',
    span: 'full',
    tone: 'ink',
    surfaces: ['more', 'home'],
  },
  {
    key: 'users',
    labelKey: 'mobile.adminHome.navUsers',
    hintKey: 'mobile.adminHome.navUsersHint',
    icon: 'person-circle-outline',
    href: '/(app)/(admin)/users',
    permissions: ['user.manage'],
    mode: 'all',
    span: 'half',
    tone: 'ink',
  },
  {
    key: 'ai-chat',
    labelKey: 'mobile.aiChat.title',
    hintKey: 'mobile.more.aiChatHint',
    icon: 'chatbubbles-outline',
    href: '/(app)/(admin)/ai-chat',
    permissions: ['ai-chat.read'],
    mode: 'all',
    span: 'full',
    tone: 'paper',
    surfaces: ['more'],
  },
];

export function filterAdminOverflowModules(
  user: AuthUser | null | undefined,
  surface: OverflowSurface,
): AdminOverflowModule[] {
  return ADMIN_OVERFLOW_MODULES.filter((m) => {
    const surfaces = m.surfaces ?? (['home', 'more'] as OverflowSurface[]);
    if (!surfaces.includes(surface)) return false;
    if (!m.permissions?.length) return true;
    return m.mode === 'all' ? canAll(user, m.permissions) : canAny(user, m.permissions);
  });
}
