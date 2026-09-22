'use client';

import { apiFetch } from '@/lib/api-client';
import { Board, BoardSkeleton, Figure, Ledger, LedgerRow, Meter, Ribbon, Stamp } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

export type CostMoneyDesk = {
  dateBasis: string;
  orderPerformance: { orderCount: number; empty: boolean; saleValue: number | null; actualProductionCost: number | null; grossMargin: number | null; marginPct: number | null; marginIncomplete: boolean; complete: boolean; coveragePct: number | null; invoiced: number | null; collected: number | null; outstanding: number | null };
  costMix: { materials: number | null; fabric: number | null; labor: number | null; waste: number | null; rework: number | null };
  factoryActivity: { productionCostIncurred: number | null; receipts: number | null; issues: number | null; unusedReturns: number | null; wipOutput: number | null; finishedOutput: number | null; scrap: number | null };
};

/** Mobile-only `reports/cost/money` — the one board that answers "did the period make money?". */
export function MoneyDeskBoard({ qs }: { qs: string }) {
  const ta = useTranslations('accounting');
  const locale = useLocale();
  const q = useQuery({ queryKey: ['reports', 'cost-money', qs], queryFn: () => apiFetch<CostMoneyDesk>(`/api/v1/reports/cost/money${qs}`), retry: false });
  const money = (v: number | null | undefined) => (v == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(v));
  if (q.isLoading) return <BoardSkeleton rows={4} />;
  if (q.isError || !q.data) return null;
  const d = q.data;
  const op = d.orderPerformance;
  const pct = op.marginPct == null ? null : Math.round(op.marginPct * (op.marginPct <= 1 ? 100 : 1));
  const tone = pct == null ? 'neutral' : pct < 0 ? 'error' : pct < 20 ? 'warning' : 'success';
  const mix = [
    { key: 'materials', label: ta('costMixMaterials'), value: d.costMix.materials ?? 0, tone: 'brand' as const },
    { key: 'fabric', label: ta('costMixFabric'), value: d.costMix.fabric ?? 0, tone: 'info' as const },
    { key: 'labor', label: ta('costMixLabor'), value: d.costMix.labor ?? 0, tone: 'success' as const },
    { key: 'waste', label: ta('costMixWaste'), value: d.costMix.waste ?? 0, tone: 'warning' as const },
    { key: 'rework', label: ta('costMixRework'), value: d.costMix.rework ?? 0, tone: 'error' as const },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <Board tone={tone} wash="top" className="xl:col-span-5">
        <Board.Header title={ta('moneyDesk')} description={ta('moneyDeskHint')} meta={op.marginIncomplete ? <Stamp tone="warning" size="sm">{ta('marginIncomplete')}</Stamp> : <Stamp tone={tone} size="sm">{`${op.orderCount}`}</Stamp>} />
        <Board.Body className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Figure value={money(op.grossMargin)} label={ta('grossMargin')} tone={tone} locale={locale} delta={pct == null ? undefined : `${pct}%`} />
            <Figure value={money(op.saleValue)} label={ta('saleValue')} size="md" locale={locale} />
          </div>
          {op.saleValue ? <Meter value={Math.min(op.actualProductionCost ?? 0, op.saleValue)} max={op.saleValue} label={ta('actualProductionCost')} valueLabel={money(op.actualProductionCost)} tone={tone} /> : null}
          <Ledger>
            <LedgerRow label={ta('invoiced')} value={money(op.invoiced)} />
            <LedgerRow label={ta('collected')} value={money(op.collected)} tone="success" stamp />
            <LedgerRow label={ta('outstanding')} value={money(op.outstanding)} tone={(op.outstanding ?? 0) > 0 ? 'warning' : 'neutral'} stamp={(op.outstanding ?? 0) > 0} />
          </Ledger>
        </Board.Body>
      </Board>
      <Board tone="neutral" className="xl:col-span-4">
        <Board.Header title={ta('costMix')} />
        <Board.Body className="space-y-4">
          <Ribbon segments={mix} legend={false} />
          <Ledger>
            {mix.map((m) => (
              <LedgerRow key={m.key} label={m.label} value={money(m.value)} tone={m.tone} stamp />
            ))}
          </Ledger>
        </Board.Body>
      </Board>
      <Board tone="info" className="xl:col-span-3">
        <Board.Header title={ta('factoryActivity')} />
        <Ledger className="px-5 pb-2">
          <LedgerRow label={ta('activityReceipts')} value={money(d.factoryActivity.receipts)} />
          <LedgerRow label={ta('activityIssues')} value={money(d.factoryActivity.issues)} />
          <LedgerRow label={ta('activityWipOutput')} value={money(d.factoryActivity.wipOutput)} />
          <LedgerRow label={ta('activityFinishedOutput')} value={money(d.factoryActivity.finishedOutput)} tone="success" stamp />
          <LedgerRow label={ta('activityScrap')} value={money(d.factoryActivity.scrap)} tone={(d.factoryActivity.scrap ?? 0) > 0 ? 'error' : undefined} stamp={(d.factoryActivity.scrap ?? 0) > 0} />
        </Ledger>
      </Board>
    </div>
  );
}
