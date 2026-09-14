'use client';

import { VoiceNotePlayer } from '@/components/production/voice-note-player';
import { apiFetch } from '@/lib/api-client';
import { useMgmtCopy } from '@/lib/mgmtCopy';
import { EmptyState, ErrorState, PageHero, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type ProblemRow = {
  id: string;
  category: string;
  reason: string;
  resolution: string | null;
  voiceDocumentId: string | null;
  resolutionVoiceDocumentId?: string | null;
  createdAt: string;
  elapsedMinutes: number;
  worker: { name: string } | null;
  order: { number: string } | null;
  task: { name: string };
};

export default function ProductionProblemsPage() {
  const t = useTranslations('production');
  const tMobile = useTranslations('mobile');
  const copy = useMgmtCopy();
  const query = useQuery({
    queryKey: ['production-problems'],
    queryFn: () => apiFetch<{ data: ProblemRow[] }>('/production/problems?status=all'),
  });

  return (
    <div className="space-y-6">
      <PageHero title={t('problemsTitle')} />
      {query.isPending ? <Skeleton className="h-40" /> : null}
      {query.isError ? <ErrorState title={t('problemsLoadError')} /> : null}
      {!query.isPending && !query.data?.data.length ? (
        <EmptyState title={t('problemsTitle')} />
      ) : (
        <div className="space-y-3">
          {(query.data?.data ?? []).map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{row.order?.number ?? row.task.name}</p>
                <StatusBadge
                  status={row.resolution ? 'COMPLETED' : 'BLOCKED'}
                  label={row.resolution ? t('problemsAnswered') : t('problemsOpen')}
                />
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                {(() => {
                  const key = `tasks.blocker.${row.category}`;
                  try {
                    const labeled = tMobile(key as never);
                    return typeof labeled === 'string' && labeled !== key ? labeled : row.category;
                  } catch {
                    return row.category;
                  }
                })()}
              </p>
              <p>{copy.floorNote(row.reason)}</p>
              <VoiceNotePlayer documentId={row.voiceDocumentId} label={t('problemsVoice')} />
              {row.resolution ? <p className="text-sm">{row.resolution}</p> : null}
              <VoiceNotePlayer
                documentId={row.resolutionVoiceDocumentId}
                label={t('problemsAnswerVoice')}
              />
              <p className="text-xs text-[var(--text-muted)]" dir="ltr">
                {row.elapsedMinutes}m · {row.worker?.name ?? ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
