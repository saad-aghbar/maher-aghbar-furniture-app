import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import type { PriorityLevel } from '@/components/badges/badgeStyles';
import type { WorkerMyOrder, WorkerOrderLaneNode, WorkerTaskLock } from './api';
import { toPriorityLevel } from './selectTask';

export type WorkerOrderCardModel = {
  id: string;
  number: string;
  salesOrderNumber: string | null;
  productTitle: string;
  imageUrl: string | null;
  priority: PriorityLevel;
  deadline: string | null;
  quantity: string;
  myTaskCount: number;
  actionableCount: number;
  blockedCount: number;
};

export function selectWorkerOrderCard(order: WorkerMyOrder, locale: Locale): WorkerOrderCardModel {
  const productTitle =
    (order.product ? localizedName(locale, order.product) : '') ||
    order.productDescription?.trim() ||
    order.number;
  return {
    id: order.id,
    number: order.salesOrderNumber || order.number,
    salesOrderNumber: order.salesOrderNumber,
    productTitle,
    imageUrl: order.productImageUrl ?? order.product?.imageUrl ?? null,
    priority: toPriorityLevel(order.priority),
    deadline: order.deadline,
    quantity: order.quantity == null ? '' : String(order.quantity),
    myTaskCount: order.myTaskCount,
    actionableCount: order.actionableCount,
    blockedCount: order.blockedCount,
  };
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
