import type { Priority, PrioritySortItem } from './types';

const PRIORITY_RANK: Record<Priority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

function compareOptionalDate(
  a: Date | null | undefined,
  b: Date | null | undefined,
): number {
  const aMissing = a == null;
  const bMissing = b == null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1; // missing sorts after known dates
  if (bMissing) return -1;
  return a.getTime() - b.getTime();
}

/** Compare without fairness: pinned → priority → dates → createdAt → id. */
export function comparePriority(a: PrioritySortItem, b: PrioritySortItem): number {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

  const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (pr !== 0) return pr;

  const committed = compareOptionalDate(a.committedDeliveryDate, b.committedDeliveryDate);
  if (committed !== 0) return committed;

  const requested = compareOptionalDate(a.requestedDeliveryDate, b.requestedDeliveryDate);
  if (requested !== 0) return requested;

  const created = a.createdAt.getTime() - b.createdAt.getTime();
  if (created !== 0) return created;

  return a.id.localeCompare(b.id);
}

function priorityTierKey(item: PrioritySortItem): string {
  return `${item.isPinned ? '1' : '0'}|${item.priority}`;
}

/**
 * Stable priority sort with dealer fairness:
 * within the same pinned+priority tier, round-robin by customerId
 * while preserving each customer's internal order by remaining keys.
 */
export function sortWithFairness<T extends PrioritySortItem>(items: T[]): T[] {
  const indexed = items.map((item, index) => ({ item, index }));
  indexed.sort((a, b) => {
    const c = comparePriority(a.item, b.item);
    return c !== 0 ? c : a.index - b.index;
  });

  const result: T[] = [];
  let i = 0;
  while (i < indexed.length) {
    const tier = priorityTierKey(indexed[i]!.item);
    let j = i + 1;
    while (j < indexed.length && priorityTierKey(indexed[j]!.item) === tier) j++;

    const group = indexed.slice(i, j).map((x) => x.item);
    result.push(...interleaveByCustomer(group));
    i = j;
  }

  return result;
}

function interleaveByCustomer<T extends PrioritySortItem>(group: T[]): T[] {
  const byCustomer = new Map<string, T[]>();
  const customerOrder: string[] = [];

  for (const item of group) {
    if (!byCustomer.has(item.customerId)) {
      byCustomer.set(item.customerId, []);
      customerOrder.push(item.customerId);
    }
    byCustomer.get(item.customerId)!.push(item);
  }

  // Deterministic customer round-robin order
  customerOrder.sort((a, b) => a.localeCompare(b));

  const queues = customerOrder.map((id) => [...(byCustomer.get(id) ?? [])]);
  const out: T[] = [];
  let remaining = group.length;

  while (remaining > 0) {
    for (const q of queues) {
      if (q.length === 0) continue;
      out.push(q.shift()!);
      remaining--;
    }
  }

  return out;
}
