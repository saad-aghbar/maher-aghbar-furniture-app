import type { AuthUser } from '@maher/types';
import type { HomePersona, Permission } from '@maher/permissions';
import { canAny } from './can';

/** A destination available in the app's "Work" and "More" navigation. */
export type WorkspaceLink = {
  key: string;
  /** Route under app/(app)/ */
  href: string;
  /** i18n key for the label. */
  labelKey: string;
  /** Any of these permissions grants access. */
  permissions: readonly Permission[];
  /** Personas that should see this link promoted on their home screen. */
  primaryFor?: readonly HomePersona[];
};

export const WORKSPACE_LINKS: readonly WorkspaceLink[] = [
  {
    key: 'tasks',
    href: '/tasks',
    labelKey: 'navigation.tasks',
    permissions: ['production-task.read', 'production-task.update-own'],
    primaryFor: ['production_worker', 'production_supervisor'],
  },
  {
    key: 'production',
    href: '/production',
    labelKey: 'navigation.production',
    permissions: ['production-order.read'],
    primaryFor: ['production_supervisor'],
  },
  {
    key: 'quality',
    href: '/quality',
    labelKey: 'navigation.quality',
    permissions: ['quality-inspection.read'],
    primaryFor: ['quality'],
  },
  {
    key: 'deliveries',
    href: '/deliveries',
    labelKey: 'navigation.deliveries',
    permissions: ['delivery.read'],
    primaryFor: ['delivery'],
  },
  {
    key: 'inventory',
    href: '/inventory',
    labelKey: 'navigation.inventory',
    permissions: ['inventory.read'],
    primaryFor: ['warehouse'],
  },
  {
    key: 'requests',
    href: '/requests',
    labelKey: 'navigation.rfqRequests',
    permissions: ['request.read'],
    primaryFor: ['customer', 'sales'],
  },
  {
    key: 'quotations',
    href: '/quotations',
    labelKey: 'navigation.quotations',
    permissions: ['quotation.read'],
    primaryFor: ['customer', 'sales'],
  },
  {
    key: 'sales-orders',
    href: '/sales-orders',
    labelKey: 'navigation.salesOrders',
    permissions: ['sales-order.read'],
    primaryFor: ['customer', 'sales'],
  },
  {
    key: 'purchasing',
    href: '/purchasing',
    labelKey: 'navigation.purchasing',
    permissions: ['purchase-order.read', 'purchase-request.read'],
    primaryFor: ['purchasing'],
  },
  {
    key: 'invoices',
    href: '/invoices',
    labelKey: 'navigation.invoices',
    permissions: ['invoice.read'],
    primaryFor: ['accounting', 'customer'],
  },
  {
    key: 'customers',
    href: '/customers',
    labelKey: 'navigation.customers',
    permissions: ['customer.read'],
    primaryFor: ['sales'],
  },
  {
    key: 'reports',
    href: '/reports',
    labelKey: 'navigation.reports',
    permissions: ['report.sales.read', 'report.financial.read', 'report.production.read'],
    primaryFor: ['management', 'admin', 'accounting'],
  },
];

export function visibleLinks(user: AuthUser | null | undefined): WorkspaceLink[] {
  if (!user) return [];
  return WORKSPACE_LINKS.filter((link) => canAny(user, link.permissions));
}

/** Links promoted as quick actions on the home screen for this persona. */
export function primaryLinks(
  user: AuthUser | null | undefined,
  persona: HomePersona,
): WorkspaceLink[] {
  const available = visibleLinks(user);
  const promoted = available.filter((l) => l.primaryFor?.includes(persona));
  return promoted.length > 0 ? promoted : available.slice(0, 4);
}

