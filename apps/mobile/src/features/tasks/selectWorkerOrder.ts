import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import type { PriorityLevel } from '@/components/badges/badgeStyles';
import type { WorkerMyOrder, WorkerMySalesOrder, WorkerOrderLaneNode, WorkerTaskLock } from './api';
import { secondaryFactoryOrderNumber, toPriorityLevel, withVariantLabel } from './selectTask';

export type WorkerOrderCardModel = {
  id: string;
  number: string;
  salesOrderNumber: string | null;
  factoryOrderNumber: string | null;
  variantLabel: string | null;
  productTitle: string;
  imageUrl: string | null;
  priority: PriorityLevel;
  deadline: string | null;
  quantity: string;
  myTaskCount: number;
  actionableCount: number;
  blockedCount: number;
  assignedToMe: boolean;
};

export type WorkerSalesOrderCardModel = WorkerOrderCardModel & {
  salesOrderId: string | null;
  laneId: string;
  itemCount: number;
  items: WorkerOrderCardModel[];
};

/** Nested item glance state on My Tasks / items picker. */
export type WorkerItemWorkState = 'done' | 'locked' | 'open';

/**
 * Done = no remaining stages for me.
 * Locked = waiting on predecessors (same as Locked stamp) — cannot start yet.
 * Open = at least one actionable stage (even if other stages are still blocked).
 */
export function workerItemWorkState(
  item: Pick<
    WorkerOrderCardModel,
    'assignedToMe' | 'myTaskCount' | 'actionableCount' | 'blockedCount'
  >,
): WorkerItemWorkState {
  if (item.assignedToMe && item.myTaskCount === 0) return 'done';
  if (item.actionableCount > 0) return 'open';
  if (item.blockedCount > 0) return 'locked';
  if (item.assignedToMe && item.myTaskCount > 0) return 'locked';
  return 'open';
}

export function workerProductTitle(order: WorkerMyOrder, locale: Locale): string {
  const base =
    (order.product ? localizedName(locale, order.product) : '') ||
    order.productDescription?.trim() ||
    order.number;
  return withVariantLabel(base, order.variantLabel);
}

export function selectWorkerOrderCard(order: WorkerMyOrder, locale: Locale): WorkerOrderCardModel {
  const salesOrderNumber = order.salesOrderNumber ?? null;
  return {
    id: order.id,
    number: salesOrderNumber || order.number,
    salesOrderNumber,
    factoryOrderNumber: secondaryFactoryOrderNumber(salesOrderNumber, order.number),
    variantLabel: order.variantLabel?.trim() || null,
    productTitle: workerProductTitle(order, locale),
    imageUrl: order.productImageUrl ?? order.product?.imageUrl ?? null,
    priority: toPriorityLevel(order.priority),
    deadline: order.deadline,
    quantity: order.quantity == null ? '' : String(order.quantity),
    myTaskCount: order.myTaskCount,
    actionableCount: order.actionableCount,
    blockedCount: order.blockedCount,
    assignedToMe: order.assignedToMe !== false,
  };
}

export function workerSalesOrderProductTitle(items: WorkerMyOrder[], locale: Locale): string {
  const productNames = [
    ...new Set(
      items.map((item) => {
        const name =
          (item.product ? localizedName(locale, item.product) : '') ||
          item.productDescription?.trim() ||
          '';
        return name;
      }).filter(Boolean),
    ),
  ];
  const variants = [
    ...new Set(items.map((item) => item.variantLabel?.trim() || '').filter(Boolean)),
  ];
  if (productNames.length <= 1) {
    return withVariantLabel(productNames[0] || items[0]?.number || '', variants.join(' · '));
  }
  return items.map((item) => workerProductTitle(item, locale)).join(' · ');
}

export function selectWorkerSalesOrderCard(
  order: WorkerMySalesOrder,
  locale: Locale,
): WorkerSalesOrderCardModel {
  const items = order.items.map((item) => selectWorkerOrderCard(item, locale));
  const first = items[0];
  const salesOrderNumber = order.salesOrderNumber || first?.salesOrderNumber || null;
  const uniqueVariants = [
    ...new Set(items.map((item) => item.variantLabel).filter((value): value is string => Boolean(value))),
  ];
  return {
    id: order.salesOrderId || first?.id || 'order',
    salesOrderId: order.salesOrderId,
    laneId: first?.id || '',
    itemCount: items.length,
    number: salesOrderNumber || first?.number || '',
    salesOrderNumber,
    factoryOrderNumber: items.length === 1 ? (first?.factoryOrderNumber ?? null) : null,
    variantLabel: uniqueVariants.length ? uniqueVariants.join(' · ') : null,
    productTitle: workerSalesOrderProductTitle(order.items, locale),
    imageUrl: items.find((item) => item.imageUrl)?.imageUrl ?? first?.imageUrl ?? null,
    priority: toPriorityLevel(order.priority),
    deadline: order.deadline,
    quantity: first?.quantity ?? '',
    myTaskCount: order.myTaskCount,
    actionableCount: order.actionableCount,
    blockedCount: order.blockedCount,
    assignedToMe: items.some((item) => item.assignedToMe),
    items,
  };
}

export function workerSalesOrderHref(
  order: Pick<WorkerSalesOrderCardModel, 'id'>,
  extras?: { segment?: string; q?: string },
): string {
  const qs = new URLSearchParams();
  if (extras?.segment) qs.set('segment', extras.segment);
  const needle = extras?.q?.trim();
  if (needle) qs.set('q', needle);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return `/(app)/(employee)/orders/${order.id}${suffix}`;
}

export function groupWorkerMyOrders(items: WorkerMyOrder[]): WorkerMySalesOrder[] {
  const groups: WorkerMySalesOrder[] = [];
  const indexByKey = new Map<string, number>();
  for (const item of items) {
    const key = item.salesOrderId?.trim() || `po:${item.id}`;
    const idx = indexByKey.get(key);
    if (idx == null) {
      indexByKey.set(key, groups.length);
      groups.push({
        salesOrderId: item.salesOrderId ?? null,
        salesOrderNumber: item.salesOrderNumber,
        externalOrderNumber: item.externalOrderNumber ?? null,
        dealer: item.dealer ?? null,
        deadline: item.deadline,
        priority: item.priority,
        myTaskCount: item.myTaskCount,
        actionableCount: item.actionableCount,
        blockedCount: item.blockedCount,
        items: [item],
      });
      continue;
    }
    const group = groups[idx]!;
    group.items.push(item);
    group.myTaskCount += item.myTaskCount;
    group.actionableCount += item.actionableCount;
    group.blockedCount += item.blockedCount;
  }
  return groups;
}

export function mySalesOrdersFromResponse(payload?: {
  orders?: WorkerMySalesOrder[];
  data?: Array<WorkerMySalesOrder | WorkerMyOrder>;
} | null): WorkerMySalesOrder[] {
  if (!payload) return [];
  if (Array.isArray(payload.orders)) return payload.orders;
  const rows = payload.data ?? [];
  if (!rows.length) return [];
  const first = rows[0];
  if (first && 'items' in first && Array.isArray(first.items)) {
    return rows as WorkerMySalesOrder[];
  }
  return groupWorkerMyOrders(rows as WorkerMyOrder[]);
}

export function findMySalesOrder(
  groups: WorkerMySalesOrder[],
  salesOrderId: string,
): WorkerMySalesOrder | undefined {
  return groups.find((group) => (group.salesOrderId || group.items[0]?.id) === salesOrderId);
}

export function lockReasonText(
  lock: WorkerTaskLock,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string | null {
  if (lock.kind === 'needs_receive') {
    return t('mobile.tasks.lockReceiveFirst', { stage: lock.fromStageName });
  }
  if (lock.kind === 'locked') {
    return t('mobile.tasks.lockWaitingOn', { stage: lock.waitingOnStageName });
  }
  return null;
}

export function isLaneTaskOpenable(node: WorkerOrderLaneNode): boolean {
  return (
    Boolean(node.assignedToMe && node.taskId) &&
    (node.lockState.kind === 'open' || node.lockState.kind === 'needs_receive')
  );
}

function searchTokens(needle: string): string[] {
  return needle
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function compactSearchValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff\u0590-\u05ff]+/g, '');
}

function haystackMatches(haystack: string, tokens: string[]): boolean {
  return tokens.every((token) => haystack.includes(token) || haystack.includes(compactSearchValue(token)));
}

export function workerOrderSearchHaystack(order: WorkerMyOrder): string {
  const parts = [
    order.number,
    order.salesOrderNumber,
    order.externalOrderNumber,
    order.variantLabel,
    order.variantSku,
    order.productDescription,
    order.product?.nameEn,
    order.product?.nameAr,
    order.product?.nameHe,
    order.quantity == null ? '' : String(order.quantity),
    order.dealer?.code,
    order.dealer?.name,
    order.dealer?.nameEn,
    order.dealer?.nameAr,
    order.dealer?.nameHe,
    order.dealer?.companyName,
    ...(order.assignedStages ?? []).flatMap((stage) => [
      stage.code,
      stage.nameEn,
      stage.nameAr,
      stage.nameHe,
    ]),
  ].filter((value): value is string => Boolean(value));
  const raw = parts.join(' ').toLowerCase();
  const compact = parts.map(compactSearchValue).filter(Boolean).join(' ');
  return `${raw} ${compact}`;
}

export function workerOrderMatchesQuery(order: WorkerMyOrder, needle: string): boolean {
  const tokens = searchTokens(needle);
  if (tokens.length === 0) return true;
  return haystackMatches(workerOrderSearchHaystack(order), tokens);
}

export function workerSalesOrderMatchesQuery(order: WorkerMySalesOrder, needle: string): boolean {
  const tokens = searchTokens(needle);
  if (tokens.length === 0) return true;
  const groupHaystack = [
    order.salesOrderNumber,
    order.externalOrderNumber,
    order.dealer?.code,
    order.dealer?.name,
    order.dealer?.nameEn,
    order.dealer?.nameAr,
    order.dealer?.nameHe,
    order.dealer?.companyName,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
  if (haystackMatches(groupHaystack, tokens)) return true;
  return order.items.some((item) => workerOrderMatchesQuery(item, needle));
}
