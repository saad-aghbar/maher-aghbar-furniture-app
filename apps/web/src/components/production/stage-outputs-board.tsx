'use client';

import type { Stage } from '@/components/production/production-hub/use-production-order';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Board, BoardSkeleton, Ledger, LedgerRow, Meter, Stamp } from '@maher/ui';
import { useQueries } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

interface WipOutput {
  producesSemiFinished: boolean;
  expectedPieceCount: number;
  expectedKitCount: number;
  completedPieceCount: number;
  qrCode: string | null;
  status: string | null;
  outputNameEn?: string | null;
  outputNameAr?: string | null;
  outputNameHe?: string | null;
  nextStages: Array<{ id: string; stageCode: string; nameEn: string; nameAr?: string | null; nameHe?: string | null }>;
}

/**
 * Stage outputs ledger: for every stage of the order, what it hands to the
 * next stage (semi-finished kits/pieces) and how far along that output is.
 * Reads each task's `wip-output`; stages without semi output are listed as such.
 */
export function StageOutputsBoard({ stages }: { stages: Stage[] }) {
  const tp = useTranslations('production');
  const locale = useLocale();
  const withTask = stages.filter((s) => s.tasks[0]);
  const outputs = useQueries({
    queries: withTask.map((s) => ({
      queryKey: ['task-wip-output', s.tasks[0]!.id],
      queryFn: () => apiFetch<WipOutput | null>(`/api/v1/tasks/${s.tasks[0]!.id}/wip-output`).catch(() => null),
      staleTime: 30_000,
    })),
  });
  const loading = outputs.some((q) => q.isLoading);
  return (
    <Board tone="neutral">
      <Board.Header title={tp('hubStageOutputs')} description={tp('hubStageOutputsHint')} />
      <Board.Body>
        {loading ? (
          <BoardSkeleton rows={4} header={false} className="border-0 shadow-none" />
        ) : (
          <Ledger>
            {withTask.map((stage, i) => {
              const out = outputs[i]?.data ?? null;
              const name = localizedName(locale, stage.stageDefinition);
              if (!out || !out.producesSemiFinished) {
                return <LedgerRow key={stage.id} label={name} value={<span className="text-[var(--maher-text-tertiary)]">{tp('hubStageOutputNone')}</span>} />;
              }
              const outputName = localizedName(locale, { nameEn: out.outputNameEn ?? '', nameAr: out.outputNameAr ?? null, nameHe: out.outputNameHe ?? null }, out.outputNameEn ?? '');
              const done = out.completedPieceCount;
              const expected = Math.max(out.expectedPieceCount, 1);
              const complete = done >= out.expectedPieceCount && out.expectedPieceCount > 0;
              return (
                <LedgerRow
                  key={stage.id}
                  label={name}
                  hint={`${outputName || '—'}${out.nextStages.length ? ` · ${tp('hubStageOutputNext', { stages: out.nextStages.map((n) => localizedName(locale, n, n.stageCode)).join(', ') })}` : ''}`}
                  value={
                    <span className="flex min-w-[160px] flex-col items-end gap-1">
                      <span className="flex items-center gap-1.5">
                        <Stamp tone={complete ? 'success' : done > 0 ? 'info' : 'neutral'} size="sm">
                          {tp('hubStageOutputPieces', { done, expected: out.expectedPieceCount })}
                        </Stamp>
                        {out.expectedKitCount > 1 ? (
                          <Stamp tone="neutral" size="sm">
                            {tp('hubStageOutputKits', { count: out.expectedKitCount })}
                          </Stamp>
                        ) : null}
                      </span>
                      <Meter value={Math.min(done, expected)} max={expected} size="sm" tone={complete ? 'success' : 'info'} showValue={false} className="w-full" />
                    </span>
                  }
                />
              );
            })}
          </Ledger>
        )}
      </Board.Body>
    </Board>
  );
}
