'use client';

import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Board, BoardSkeleton, Ledger, LedgerRow, Ltr } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

type Named = { id?: string; nameEn?: string | null; nameAr?: string | null; nameHe?: string | null };

type PlanStage = {
  stageCode: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  output?: (Named & { qtyPerUnit?: number | null; unit?: string | null }) | null;
  upstreamOutputs?: Named[];
};

type PlanSetup = { stages?: PlanStage[] };

/** Read-only. Names what this line produces for a later stage. */
export function PlanLineOutputs({ productionOrderId }: { productionOrderId: string }) {
  const t = useTranslations('sales');
  const locale = useLocale();
  const query = useQuery({
    queryKey: ['plan-setup', productionOrderId],
    queryFn: () => apiFetch<PlanSetup>(`/api/v1/production-orders/${productionOrderId}/plan-setup`),
  });

  if (query.isLoading) return <BoardSkeleton rows={3} />;
  if (query.isError || !query.data) return null;

  const stages = query.data.stages ?? [];
  const nameOf = (row: { nameEn?: string | null; nameAr?: string | null; nameHe?: string | null }) =>
    localizedName(locale, { nameEn: row.nameEn, nameAr: row.nameAr, nameHe: row.nameHe }, row.nameEn ?? '');

  const rows = stages.flatMap((stage) => {
    const output = stage.output;
    if (!output?.nameEn && !output?.nameAr && !output?.nameHe) return [];
    const usedBy = stages
      .filter((other) => other.upstreamOutputs?.some((item) => item.id && item.id === output.id))
      .map((other) => nameOf(other));
    const qty = output.qtyPerUnit != null ? `${output.qtyPerUnit}${output.unit ? ` ${output.unit}` : ''}` : null;
    return [{
      key: `${stage.stageCode}-${output.id ?? output.nameEn}`,
      label: nameOf(output),
      value: qty ?? '—',
      hint: [nameOf(stage), usedBy.length ? t('orderSetup.usedByStage', { stage: usedBy.join(', ') }) : null].filter(Boolean).join(' · '),
    }];
  });

  return (
    <Board tone="neutral">
      <Board.Header title={t('orderSetup.downstreamOutputs')} description={t('orderSetup.downstreamOutputsHint')} />
      {rows.length === 0 ? (
        <Board.Empty title={t('orderSetup.noNamedOutput')} />
      ) : (
        <Ledger className="px-5 pb-2">
          {rows.map((row) => (
            <LedgerRow key={row.key} label={row.label} value={<Ltr>{row.value}</Ltr>} hint={row.hint || undefined} />
          ))}
        </Ledger>
      )}
    </Board>
  );
}
