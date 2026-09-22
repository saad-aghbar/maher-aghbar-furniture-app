'use client';

import { apiFetch } from '@/lib/api-client';
import type { Paginated } from '@/lib/paginated';
import type { BoardTone } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';

export type SectionCount = { count: number; tone?: BoardTone };
export type SectionCounts = Record<string, SectionCount>;

type Probe = Paginated<unknown> & { meta: Paginated<unknown>['meta'] & Record<string, unknown> };

/** One cheap `pageSize=1` probe per tab; the API meta carries facet counts. */
async function probe(path: string): Promise<Probe | null> {
  try {
    return await apiFetch<Probe>(path);
  } catch {
    return null;
  }
}

const LOADERS: Record<string, () => Promise<SectionCounts>> = {
  orders: async () => {
    const [requests, quotations, orders, deliveries] = await Promise.all([
      probe('/api/v1/requests?pageSize=1&statusGroup=open_inbox'),
      probe('/api/v1/quotations?pageSize=1&status=INTERNAL_REVIEW'),
      probe('/api/v1/sales-orders?pageSize=1&statusGroup=production'),
      probe('/api/v1/deliveries?pageSize=1&status=PLANNED'),
    ]);
    const inbox = (requests?.meta?.inboxCounts ?? null) as { waiting?: number; needs_info?: number } | null;
    const waiting = (inbox?.waiting ?? 0) + (inbox?.needs_info ?? 0);
    const out: SectionCounts = {};
    if (requests) out['/admin/requests'] = { count: requests.meta.totalItems ?? waiting, tone: waiting > 0 ? 'warning' : 'neutral' };
    if (quotations) out['/admin/quotations'] = { count: quotations.meta.totalItems, tone: quotations.meta.totalItems > 0 ? 'warning' : 'neutral' };
    if (orders) out['/admin/sales-orders'] = { count: orders.meta.totalItems, tone: 'brand' };
    if (deliveries) out['/admin/deliveries'] = { count: deliveries.meta.totalItems, tone: 'brand' };
    return out;
  },
};

/**
 * Live counts for a nested section's tabs. Only sections with a loader show
 * counts; others render plain tabs. Refreshes every minute while visible.
 */
export function useSectionCounts(groupKey: string | null, enabled: boolean): SectionCounts {
  const loader = groupKey ? LOADERS[groupKey] : undefined;
  const query = useQuery({
    queryKey: ['section-counts', groupKey],
    queryFn: () => loader!(),
    enabled: enabled && Boolean(loader),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
  return query.data ?? {};
}
