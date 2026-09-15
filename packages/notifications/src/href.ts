import type { AppSurface } from '@maher/permissions';
import { hrefForSurfaceGroup, isLiveExpoHref, SURFACE_HUB_HREF } from './live-routes';
import { getTopic } from './topics';
import type {
  NotificationEntityType,
  NotificationHrefIds,
  NotificationOpenInput,
  NotificationOpenResult,
  TopicDefinition,
} from './types';

type SurfaceDest = {
  preferred: string;
  fallback: string;
};

type EntityDestinations = {
  admin: SurfaceDest;
  customer?: Partial<SurfaceDest> | null;
  employee?: Partial<SurfaceDest> | null;
};

/**
 * Preferred + authorized fallback per entity, using only live Expo routes.
 * There is no `/(admin)/quality/[id]` — QC opens the production hub or a task.
 */
const ENTITY_DESTINATIONS: Record<NotificationEntityType, EntityDestinations> = {
  request: {
    admin: { preferred: '/(app)/(admin)/requests/:id', fallback: '/(app)/(admin)/(tabs)/orders' },
    customer: { preferred: '/(app)/(customer)/requests/:id', fallback: '/(app)/(customer)/(tabs)/orders' },
  },
  quotation: {
    admin: { preferred: '/(app)/(admin)/quotations/:id', fallback: '/(app)/(admin)/(tabs)/orders' },
    customer: { preferred: '/(app)/(customer)/quotations/:id', fallback: '/(app)/(customer)/(tabs)/orders' },
  },
  salesOrder: {
    admin: { preferred: '/(app)/(admin)/orders/:id', fallback: '/(app)/(admin)/(tabs)/orders' },
    customer: { preferred: '/(app)/(customer)/orders/:id', fallback: '/(app)/(customer)/(tabs)/orders' },
    employee: { preferred: '/(app)/(employee)/orders/:salesOrderId', fallback: '/(app)/(employee)/(tabs)/tasks' },
  },
  productionOrder: {
    admin: { preferred: '/(app)/(admin)/production/:id', fallback: '/(app)/(admin)/(tabs)/production' },
    customer: { preferred: '/(app)/(customer)/orders/:id', fallback: '/(app)/(customer)/(tabs)/orders' },
    employee: { preferred: '/(app)/(employee)/orders/:salesOrderId', fallback: '/(app)/(employee)/(tabs)/tasks' },
  },
  task: {
    admin: { preferred: '/(app)/(admin)/production/tasks/:id', fallback: '/(app)/(admin)/(tabs)/production' },
    employee: { preferred: '/(app)/(employee)/tasks/:id', fallback: '/(app)/(employee)/(tabs)/tasks' },
  },
  qualityInspection: {
    admin: { preferred: '/(app)/(admin)/(tabs)/production', fallback: '/(app)/(admin)/(tabs)/production' },
    employee: { preferred: '/(app)/(employee)/(tabs)/tasks', fallback: '/(app)/(employee)/(tabs)/tasks' },
  },
  delivery: {
    admin: { preferred: '/(app)/(admin)/deliveries/:id', fallback: '/(app)/(admin)/(tabs)/orders' },
    customer: { preferred: '/(app)/(customer)/deliveries/:id', fallback: '/(app)/(customer)/(tabs)/orders' },
    employee: { preferred: '/(app)/(employee)/deliveries/:id', fallback: '/(app)/(employee)/(tabs)' },
  },
  returnRequest: {
    admin: { preferred: '/(app)/(admin)/returns/:id', fallback: '/(app)/(admin)/(tabs)/orders' },
    customer: { preferred: '/(app)/(customer)/returns/:id', fallback: '/(app)/(customer)/(tabs)/orders' },
  },
  invoice: {
    admin: { preferred: '/(app)/(admin)/invoices/:id', fallback: '/(app)/(admin)/(tabs)/orders' },
    customer: { preferred: '/(app)/(customer)/invoices/:id', fallback: '/(app)/(customer)/account/payments' },
  },
  payment: {
    admin: { preferred: '/(app)/(admin)/invoices/:id', fallback: '/(app)/(admin)/(tabs)/orders' },
    customer: { preferred: '/(app)/(customer)/account/payments', fallback: '/(app)/(customer)/(tabs)/account' },
  },
  purchaseRequest: {
    admin: { preferred: '/(app)/(admin)/purchasing', fallback: '/(app)/(admin)/purchasing' },
  },
  purchaseOrder: {
    admin: { preferred: '/(app)/(admin)/purchasing/:id', fallback: '/(app)/(admin)/purchasing' },
  },
  inventoryItem: {
    admin: { preferred: '/(app)/(admin)/inventory/items/:id', fallback: '/(app)/(admin)/(tabs)/inventory' },
  },
  fabricJob: {
    admin: { preferred: '/(app)/(admin)/purchasing/fabric/:id', fallback: '/(app)/(admin)/purchasing' },
  },
  schedule: {
    admin: { preferred: '/(app)/(admin)/scheduling', fallback: '/(app)/(admin)/(tabs)/production' },
    customer: { preferred: '/(app)/(customer)/account/calendar', fallback: '/(app)/(customer)/(tabs)/schedule' },
  },
  aiIntake: {
    admin: { preferred: '/(app)/(admin)/ai-intake/:id', fallback: '/(app)/(admin)/(tabs)' },
  },
  user: {
    admin: { preferred: '/(app)/(admin)/users', fallback: '/(app)/(admin)/more/account' },
    employee: { preferred: '/(app)/(employee)/(tabs)/profile', fallback: '/(app)/(employee)/(tabs)' },
  },
  wip: {
    admin: { preferred: '/(app)/(admin)/production/:id', fallback: '/(app)/(admin)/(tabs)/production' },
    employee: { preferred: '/(app)/(employee)/tasks/:id/take-in', fallback: '/(app)/(employee)/(tabs)/tasks' },
  },
  blocker: {
    admin: { preferred: '/(app)/(admin)/production/problems', fallback: '/(app)/(admin)/(tabs)/production' },
    employee: { preferred: '/(app)/(employee)/tasks/:id', fallback: '/(app)/(employee)/(tabs)/tasks' },
  },
  goodsReceipt: {
    admin: { preferred: '/(app)/(admin)/inventory/receive/:id', fallback: '/(app)/(admin)/(tabs)/inventory' },
  },
};

const TOPIC_OVERRIDES: Partial<Record<string, Partial<Record<AppSurface, Partial<SurfaceDest>>>>> = {
  'order.setupRequired': {
    admin: { preferred: '/(app)/(admin)/orders/:id/production-setup' },
  },
  'order.setupReleased': {
    admin: { preferred: '/(app)/(admin)/orders/:id/production-setup' },
  },
  'wip.readyToTakeIn': {
    employee: { preferred: '/(app)/(employee)/tasks/:id/take-in' },
  },
  'inventory.lowStock': {
    admin: { preferred: '/(app)/(admin)/inventory/low-stock', fallback: '/(app)/(admin)/(tabs)/inventory' },
  },
  'inventory.finishedPosted': {
    admin: { preferred: '/(app)/(admin)/inventory/finished/:salesOrderId' },
  },
};

function lastSegment(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

export function parseNotificationLink(linkUrl: string | null | undefined): {
  entityType: NotificationEntityType | null;
  id: string;
  extras: NotificationHrefIds;
  takeIn: boolean;
  productionSetup: boolean;
} {
  const empty = { entityType: null, id: '', extras: {}, takeIn: false, productionSetup: false };
  if (!linkUrl) return empty;
  const path = linkUrl.replace(/^https?:\/\/[^/]+/, '').split('?')[0] ?? '';
  const id = lastSegment(path);
  const extras: NotificationHrefIds = { id };

  if (path.includes('/take-in')) {
    return { entityType: 'wip', id, extras: { ...extras, taskId: id }, takeIn: true, productionSetup: false };
  }
  if (path.includes('production-setup')) {
    return { entityType: 'salesOrder', id: lastIdBefore(path, 'production-setup') || id, extras, takeIn: false, productionSetup: true };
  }
  if (path.startsWith('/sales-orders/') || path.startsWith('/orders/')) {
    extras.salesOrderId = id;
    return { entityType: 'salesOrder', id, extras, takeIn: false, productionSetup: false };
  }
  if (path.startsWith('/invoices/')) return { entityType: 'invoice', id, extras, takeIn: false, productionSetup: false };
  if (path.startsWith('/returns/')) return { entityType: 'returnRequest', id, extras, takeIn: false, productionSetup: false };
  if (path.startsWith('/quotations/')) return { entityType: 'quotation', id, extras, takeIn: false, productionSetup: false };
  if (path.startsWith('/requests/')) return { entityType: 'request', id, extras, takeIn: false, productionSetup: false };
  if (path.startsWith('/ai-intake/')) return { entityType: 'aiIntake', id, extras, takeIn: false, productionSetup: false };
  if (path.startsWith('/tasks/')) {
    extras.taskId = id;
    return { entityType: 'task', id, extras, takeIn: false, productionSetup: false };
  }
  if (path.startsWith('/production/tasks/')) {
    extras.taskId = id;
    return { entityType: 'task', id, extras, takeIn: false, productionSetup: false };
  }
  if (path.startsWith('/production/')) {
    extras.productionOrderId = id;
    return { entityType: 'productionOrder', id, extras, takeIn: false, productionSetup: false };
  }
  if (path.startsWith('/quality') || path.startsWith('/quality-inspections/')) {
    extras.taskId = id;
    return { entityType: 'qualityInspection', id, extras, takeIn: false, productionSetup: false };
  }
  if (path.startsWith('/deliveries/')) return { entityType: 'delivery', id, extras, takeIn: false, productionSetup: false };
  if (path.startsWith('/purchase-orders/') || path.startsWith('/purchasing/')) {
    if (path.includes('/fabric/')) return { entityType: 'fabricJob', id, extras, takeIn: false, productionSetup: false };
    return { entityType: 'purchaseOrder', id, extras, takeIn: false, productionSetup: false };
  }
  if (path.startsWith('/purchase-requests/')) return { entityType: 'purchaseRequest', id, extras, takeIn: false, productionSetup: false };
  if (path.startsWith('/inventory/low-stock')) return { entityType: 'inventoryItem', id: '', extras, takeIn: false, productionSetup: false };
  if (path.startsWith('/inventory/receive/')) return { entityType: 'goodsReceipt', id, extras, takeIn: false, productionSetup: false };
  if (path.startsWith('/inventory/finished/')) {
    extras.salesOrderId = id;
    return { entityType: 'salesOrder', id, extras, takeIn: false, productionSetup: false };
  }
  if (path.startsWith('/inventory/items/') || path.startsWith('/inventory/')) {
    return { entityType: 'inventoryItem', id, extras, takeIn: false, productionSetup: false };
  }
  if (path.startsWith('/scheduling') || path.includes('/schedule')) {
    return { entityType: 'schedule', id, extras, takeIn: false, productionSetup: false };
  }
  if (path.includes('account/statement')) return { entityType: 'invoice', id: '', extras, takeIn: false, productionSetup: false };
  if (path.includes('account/payments') || path.startsWith('/payments/')) {
    return { entityType: 'payment', id, extras, takeIn: false, productionSetup: false };
  }
  if (path.startsWith('/users') || path.startsWith('/employees')) {
    return { entityType: 'user', id, extras, takeIn: false, productionSetup: false };
  }
  if (path.startsWith('/lane/')) return { entityType: 'task', id, extras, takeIn: false, productionSetup: false };
  if (path.startsWith('/dealers/')) return { entityType: 'salesOrder', id, extras, takeIn: false, productionSetup: false };
  return empty;
}

function lastIdBefore(path: string, marker: string): string {
  const idx = path.indexOf(marker);
  const before = idx >= 0 ? path.slice(0, idx) : path;
  return lastSegment(before);
}

function fillTemplate(template: string, ids: NotificationHrefIds): string {
  return template.replace(/:(\w+)/g, (_, key: string) => {
    if (key === 'salesOrderId') return ids.salesOrderId || ids.id || '';
    if (key === 'id') return ids.taskId || ids.productionOrderId || ids.salesOrderId || ids.id || '';
    return (ids as Record<string, string | undefined>)[key] || ids.id || '';
  });
}

/** Empty dynamic segments (`/orders/`) or leftover `:id` tokens — not Expo `/(group)/` paths. */
function filledHrefIsUsable(href: string): boolean {
  if (!href) return false;
  if (/:[A-Za-z_][A-Za-z0-9_]*/.test(href)) return false;
  return !href.split('/').slice(1).some((segment) => segment.length === 0);
}

function destFor(
  topic: TopicDefinition | undefined,
  entityType: NotificationEntityType,
  surface: AppSurface,
): SurfaceDest | null {
  const base = ENTITY_DESTINATIONS[entityType][surface === 'admin' ? 'admin' : surface];
  if (!base || (!base.preferred && !base.fallback)) return null;
  const override = topic ? TOPIC_OVERRIDES[topic.code]?.[surface] : undefined;
  return {
    preferred: override?.preferred ?? base.preferred ?? '',
    fallback: override?.fallback ?? base.fallback ?? SURFACE_HUB_HREF[surface],
  };
}

function finalize(href: string, surface: AppSurface, usedFallback: boolean): NotificationOpenResult | null {
  if (!href) return null;
  if (surface !== 'admin' && hrefForSurfaceGroup(href) === 'admin') {
    return { href: SURFACE_HUB_HREF[surface], usedFallback: true };
  }
  if (!isLiveExpoHref(href)) {
    return { href: SURFACE_HUB_HREF[surface], usedFallback: true };
  }
  return { href, usedFallback };
}

export function resolveNotificationOpen(input: NotificationOpenInput): NotificationOpenResult | null {
  const surface = input.surface;
  const topic = getTopic(input.topic ?? undefined);
  const parsed = parseNotificationLink(input.linkUrl);
  if ((input.linkUrl ?? '').includes('account/statement') || (input.linkUrl ?? '').includes('/statements/')) {
    if (surface === 'customer') {
      return finalize('/(app)/(customer)/account/statement', surface, false);
    }
    return { href: SURFACE_HUB_HREF.admin, usedFallback: true };
  }
  const entityType = (input.entityType as NotificationEntityType | undefined) ?? parsed.entityType ?? topic?.entity;
  const extras: NotificationHrefIds = {
    ...parsed.extras,
    ...input.extras,
    id: input.entityId || input.extras?.id || parsed.id || parsed.extras.id,
  };

  if (topic?.code === 'inventory.lowStock') {
    return finalize('/(app)/(admin)/inventory/low-stock', surface, surface !== 'admin') ?? {
      href: SURFACE_HUB_HREF[surface],
      usedFallback: true,
    };
  }

  if (!entityType) {
    return { href: SURFACE_HUB_HREF[surface], usedFallback: true };
  }

  let dest = destFor(topic, entityType, surface);
  if (!dest) {
    dest = destFor(topic, entityType, 'admin');
    if (surface !== 'admin') {
      return { href: SURFACE_HUB_HREF[surface], usedFallback: true };
    }
  }
  if (!dest) return { href: SURFACE_HUB_HREF[surface], usedFallback: true };

  const preferred = fillTemplate(dest.preferred, extras);
  if (filledHrefIsUsable(preferred) && isLiveExpoHref(preferred)) {
    const needsId = /:[A-Za-z_][A-Za-z0-9_]*/.test(dest.preferred);
    const hasId = Boolean(extras.id || extras.salesOrderId || extras.taskId || extras.productionOrderId);
    if (!needsId || hasId) {
      const opened = finalize(preferred, surface, false);
      if (opened && !opened.usedFallback) return opened;
    }
  }

  const fallback = fillTemplate(dest.fallback, extras);
  const openedFallback = finalize(fallback, surface, true);
  if (openedFallback) return openedFallback;
  return { href: SURFACE_HUB_HREF[surface], usedFallback: true };
}

export function mapNotificationLinkToHref(
  linkUrl: string | null | undefined,
  surface: AppSurface = 'admin',
  topic?: string | null,
): string {
  const opened = resolveNotificationOpen({ linkUrl, surface, topic });
  return opened?.href ?? SURFACE_HUB_HREF[surface];
}

export function eligibleSurfacesForTopic(topic: TopicDefinition): AppSurface[] {
  const surfaces = new Set<AppSurface>(['admin']);
  if (topic.audiences.includes('dealer')) surfaces.add('customer');
  if (topic.audiences.includes('worker')) surfaces.add('employee');
  return [...surfaces];
}
