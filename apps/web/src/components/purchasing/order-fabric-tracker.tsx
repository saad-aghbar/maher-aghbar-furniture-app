'use client';

import { fabricTone, type FabricJob } from '@/components/purchasing/fabric-shared';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Board, BoardSkeleton, Ledger, LedgerRow, Meter, Stamp } from '@maher/ui';
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
        <Ledger>
          {data.items.map((item) => {
            const r = item.readiness ?? {};
            const expected = r.expectedQty ?? item.requiredQty ?? null;
            const arrived = r.arrivedQty ?? item.arrivedQty ?? 0;
            const state = r.derivedStatus ?? item.state ?? null;
            const label = r.label ?? item.requestedLabel ?? item.sku ?? '—';
            const hintParts = [
              item.itemLetter ? `${item.salesOrderNumber}.${item.itemLetter}` : item.salesOrderNumber,
              item.productName ?? null,
              item.supplier?.name ?? null,
              r.stageCode ? humanizeCode(r.stageCode) : null,
            ].filter(Boolean);
            return (
              <LedgerRow
                key={item.id}
                href={`/admin/purchasing/fabric/${item.id}`}
                LinkComponent={Link}
                label={label}
                hint={hintParts.join(' · ')}
                value={
                  <span className="flex min-w-[150px] flex-col items-end gap-1">
                    <Stamp tone={fabricTone(state)} size="sm">
                      {status(state)}
                    </Stamp>
                    {expected != null && expected > 0 ? (
                      <span className="flex w-full items-center gap-2">
                        <Meter value={Math.min(arrived, expected)} max={expected} size="sm" tone={arrived >= expected ? 'success' : 'info'} showValue={false} className="flex-1" />
                        <span className="text-[11px] tabular-nums text-[var(--maher-text-tertiary)]" dir="ltr">
                          {arrived}/{expected} {r.unit ?? item.unit ?? ''}
                        </span>
                      </span>
                    ) : null}
                  </span>
                }
              />
            );
          })}
        </Ledger>
      </Board.Body>
    </Board>
  );
}

function humanizeCode(code: string): string {
  const t = code.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
