'use client';

import { fabricTone, type FabricJob } from '@/components/purchasing/fabric-shared';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Board, BoardSkeleton, Meter, Stamp } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

interface TrackerItem extends FabricJob {
  readiness?: {
    label?: string;
    role?: string | null;
    stageCode?: string | null;
    unit?: string;
    expectedQty?: number | null;
    arrivedQty?: number;
    issuedQty?: number;
    derivedStatus?: string;
    readyForProduction?: boolean;
    overridden?: boolean;
    missing?: string[];
    attentionCode?: string | null;
    expectedAvailableAt?: string | null;
  };
}

interface Tracker {
  salesOrderId: string;
  required: number;
  ready: number;
  missing: Array<{ label: string; qty: number | null; unit: string; derivedStatus: string; stageCode?: string | null }>;
  overridden: boolean;
  items: TrackerItem[];
}

/**
 * Order-level fabric tracker (port of mobile OrderFabricGroupCard): every
 * dealer-fabric line on the sales order with its supplier state, arrived vs
 * expected, and a link into the fabric job desk. Hidden when the order has
 * no dealer fabric.
 */
export function OrderFabricTracker({ salesOrderId, compact }: { salesOrderId: string; compact?: boolean }) {
  const tp = useTranslations('purchasing');
  const tStatus = useTranslations('statuses');
  const q = useQuery({
    queryKey: ['order-fabric-tracker', salesOrderId],
    queryFn: () => apiFetch<Tracker>(`/api/v1/fabric-procurements/orders/${salesOrderId}`),
    retry: false,
    staleTime: 30_000,
  });
  if (q.isLoading) return <BoardSkeleton rows={2} />;
  if (q.isError || !q.data) return null;
  const data = q.data;
  if (!data.items.length) return null;
  const allReady = data.required > 0 && data.ready >= data.required;
  const status = (s?: string | null) => {
    if (!s) return '—';
    return tStatus.has(s as never) ? tStatus(s as never) : humanizeCode(s);
  };
  return (
    <Board tone={allReady ? 'success' : data.missing.length ? 'warning' : 'info'}>
      <Board.Header
        title={tp('fabricTracker')}
        description={compact ? undefined : tp('fabricTrackerHint')}
        meta={
          <Stamp tone={allReady ? 'success' : 'warning'} size="sm">
            {tp('fabricReady', { ready: data.ready, required: data.required })}
          </Stamp>
        }
      />
      <Board.Body padding="none">
        <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
          {data.items.map((item) => {
            const r = item.readiness ?? {};
            const expected = r.expectedQty ?? item.requiredQty ?? null;
            const arrived = r.arrivedQty ?? item.arrivedQty ?? 0;
            const state = r.derivedStatus ?? item.state ?? null;
            const label = r.label ?? item.requestedLabel ?? item.sku ?? '—';
            const orderRef = item.itemLetter ? `${item.salesOrderNumber}.${item.itemLetter}` : item.salesOrderNumber;
            const meta = [orderRef, pieceTitle(item.productName), item.supplier?.name].filter(Boolean).join(' · ');
            const unit = r.unit ?? item.unit ?? '';
            return (
              <li key={item.id} className="m-0">
                <Link
                  href={`/admin/purchasing/fabric/${item.id}`}
                  className="block px-5 py-3.5 transition-colors hover:bg-[var(--maher-surface-muted)]"
                >
                  <span className="flex items-start justify-between gap-4">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium leading-5 text-[var(--maher-text-primary)]">{label}</span>
                      {meta ? (
                        <span className="mt-0.5 block truncate text-xs leading-4 text-[var(--maher-text-tertiary)]" dir="ltr">
                          {meta}
                        </span>
                      ) : null}
                    </span>
                    <Stamp tone={fabricTone(state)} size="sm" className="mt-0.5 shrink-0">
                      {status(state)}
                    </Stamp>
                  </span>
                  {expected != null && expected > 0 ? (
                    <span className="mt-2.5 flex items-center gap-3">
                      <Meter
                        value={Math.min(arrived, expected)}
                        max={expected}
                        size="sm"
                        tone={arrived >= expected ? 'success' : 'info'}
                        showValue={false}
                        className="min-w-0 flex-1"
                      />
                      <span className="shrink-0 text-[11px] tabular-nums text-[var(--maher-text-tertiary)]" dir="ltr">
                        {arrived}/{expected} {unit}
                      </span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </Board.Body>
    </Board>
  );
}

/** Line descriptions sometimes append "— three fabrics". The row title is already the fabric. */
function pieceTitle(name: string | null | undefined): string | null {
  if (!name) return null;
  const cleaned = name.replace(/\s+[—–-]\s+.*\bfabrics?\b.*$/i, '').trim();
  return cleaned || name;
}

function humanizeCode(code: string): string {
  const t = code.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
