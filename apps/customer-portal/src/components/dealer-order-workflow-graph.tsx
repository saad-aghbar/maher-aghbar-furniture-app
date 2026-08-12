'use client';

import { apiFetch } from '@/lib/api-client';
import { StatusBadge, cn, Ltr } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useLocale } from 'next-intl';

type WorkflowStage = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  status: string;
  progressPercent: number;
  isSkipped?: boolean;
};

type WorkflowGraph = {
  productionOrderId: string;
  progressPercent: number;
  stages: WorkflowStage[];
  edges: Array<{ from: string; to: string }>;
};

function stageTone(status: string): 'done' | 'active' | 'pending' | 'blocked' | 'skipped' {
  if (status === 'COMPLETED') return 'done';
  if (status === 'SKIPPED') return 'skipped';
  if (['IN_PROGRESS', 'READY'].includes(status)) return 'active';
  if (status === 'BLOCKED') return 'blocked';
  return 'pending';
}

/** Dealer-safe dynamic workflow from GET /production-orders/:id/workflow */
export function DealerOrderWorkflowGraph({
  productionOrderId,
  fallbackStages,
}: {
  productionOrderId: string;
  fallbackStages?: Array<{
    code: string;
    nameEn: string;
    nameAr: string;
    status: string;
    progressPercent: number;
  }>;
}) {
  const locale = useLocale();
  const query = useQuery({
    queryKey: ['dealer-order-workflow', productionOrderId],
    queryFn: () =>
      apiFetch<WorkflowGraph>(`/api/v1/production-orders/${productionOrderId}/workflow`),
  });

  const stages =
    query.data?.stages?.filter((s) => !s.isSkipped) ??
    fallbackStages?.map((s) => ({ ...s, id: s.code, nameHe: null })) ??
    [];

  if (query.isLoading && !fallbackStages?.length) {
    return <div className="h-24 animate-pulse rounded-xl bg-[var(--maher-surface-muted)]" />;
  }

  return (
    <ol className="space-y-0" aria-label="Production progress">
      {stages.map((stage, idx) => {
        const tone = stageTone(stage.status);
        const label = locale.startsWith('ar')
          ? stage.nameAr || stage.nameEn || stage.code
          : locale.startsWith('he')
            ? stage.nameHe || stage.nameEn || stage.code
            : stage.nameEn || stage.nameAr || stage.code;
        return (
          <li key={stage.id || stage.code} className="relative flex gap-4 pb-5 last:pb-0">
            {idx < stages.length - 1 ? (
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
                tone === 'pending' && 'border-border bg-surface text-text-tertiary',
                tone === 'skipped' && 'border-dashed border-border bg-surface text-text-tertiary',
                tone === 'blocked' &&
                  'border-[var(--maher-error)] bg-[var(--maher-error-soft)] text-[var(--maher-error)]',
              )}
            >
              {tone === 'done' ? <Check className="h-4 w-4" /> : idx + 1}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{label}</p>
                <Ltr className="text-xs text-text-tertiary">{stage.progressPercent}%</Ltr>
              </div>
              <StatusBadge status={stage.status} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
