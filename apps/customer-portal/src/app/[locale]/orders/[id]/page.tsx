'use client';

import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Card, Skeleton, StatusBadge, cn } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

interface Stage {
  code: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
  status: string;
  progressPercent: number;
  actualStart?: string | null;
  actualEnd?: string | null;
}

interface ProductionOrder {
  id: string;
  number: string;
  status: string;
  currentStageCode?: string | null;
  progressPercent: number;
  stages: Stage[];
}

interface Delivery {
  id: string;
  number: string;
  status: string;
  deliveryDate?: string | null;
  deliveryWindow?: string | null;
  recipientName?: string | null;
  deliveryAddress?: string | null;
}

interface OrderDetail {
  number: string;
  status: string;
  requiredDeliveryDate?: string | null;
  deliveryAddress?: string | null;
  lines?: Array<{ id: string; description: string; quantity: string | number }>;
  productionOrders?: ProductionOrder[];
  deliveries?: Delivery[];
}

function stageTone(status: string) {
  if (status === 'COMPLETED') return 'done';
  if (status === 'IN_PROGRESS' || status === 'READY') return 'active';
  if (status === 'BLOCKED') return 'blocked';
  return 'pending';
}

export default function OrderTrackingPage({ params }: { params: { id: string } }) {
  const t = useTranslations('sales');
  const locale = useLocale();

  const { data, isLoading } = useQuery({
    queryKey: ['order', params.id],
    queryFn: () => apiFetch<OrderDetail>(`/api/v1/sales-orders/${params.id}`),
  });

  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;

  const pos = data.productionOrders ?? [];

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight">{data.number}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <StatusBadge status={data.status} />
          {data.requiredDeliveryDate ? (
            <span className="text-sm text-text-secondary">
              {t('deliveryDate')}: {data.requiredDeliveryDate.slice(0, 10)}
            </span>
          ) : null}
        </div>
        {data.deliveryAddress ? (
          <p className="mt-2 text-sm text-text-secondary">{data.deliveryAddress}</p>
        ) : null}
      </div>

      {(data.lines?.length ?? 0) > 0 ? (
        <Card title={t('lines')}>
          <ul className="space-y-2 text-sm">
            {data.lines!.map((line) => (
              <li key={line.id} className="flex justify-between gap-3 border-b border-border pb-2 last:border-0">
                <span>{line.description}</span>
                <span className="tabular-nums text-text-secondary">× {String(line.quantity)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title={t('productionStages')}>
        {pos.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('noProductionYet')}</p>
        ) : (
          <div className="space-y-8">
            {pos.map((po) => (
              <div key={po.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{po.number}</p>
                    <p className="text-xs text-text-tertiary">
                      {t('progress')}: {po.progressPercent}%
                      {po.currentStageCode ? ` · ${po.currentStageCode}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={po.status} />
                </div>
                <ol className="space-y-0">
                  {(po.stages ?? []).map((stage, idx) => {
                    const tone = stageTone(stage.status);
                    const label = localizedName(locale, stage);
                    return (
                      <li key={stage.code} className="relative flex gap-4 pb-6 last:pb-0">
                        {idx < (po.stages?.length ?? 0) - 1 ? (
                          <span
                            aria-hidden
                            className={cn(
                              'absolute start-[15px] top-8 bottom-0 w-0.5',
                              tone === 'done' ? 'bg-brand' : 'bg-border',
                            )}
                          />
                        ) : null}
                        <span
                          className={cn(
                            'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                            tone === 'done' && 'border-brand bg-brand text-white',
                            tone === 'active' && 'border-brand bg-brand-soft text-brand',
                            tone === 'blocked' && 'border-[var(--maher-error)] bg-[var(--maher-error-soft)] text-[var(--maher-error)]',
                            tone === 'pending' && 'border-border bg-surface text-text-tertiary',
                          )}
                        >
                          {tone === 'done' ? <Check className="h-4 w-4" /> : idx + 1}
                        </span>
                        <div className="min-w-0 flex-1 pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-text-primary">{label}</p>
                            <StatusBadge status={stage.status} />
                          </div>
                          {stage.actualEnd || stage.actualStart ? (
                            <p className="mt-1 text-xs text-text-tertiary">
                              {stage.actualStart?.slice(0, 10) ?? '—'}
                              {stage.actualEnd ? ` → ${stage.actualEnd.slice(0, 10)}` : ''}
                            </p>
                          ) : null}
                          {tone === 'active' && stage.progressPercent > 0 ? (
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                              <div
                                className="h-full rounded-full bg-brand"
                                style={{ width: `${stage.progressPercent}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t('deliveryStatus')}>
        {(data.deliveries ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">—</p>
        ) : (
          <ul className="space-y-3">
            {data.deliveries!.map((d) => (
              <li key={d.id} className="rounded-[var(--maher-radius-md)] border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{d.number}</p>
                  <StatusBadge status={d.status} />
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {[d.deliveryDate?.slice(0, 10), d.deliveryWindow, d.recipientName]
                    .filter(Boolean)
                    .join(' · ') || d.deliveryAddress}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
