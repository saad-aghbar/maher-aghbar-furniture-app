'use client';

import { VoiceNotePlayer } from '@/components/production/voice-note-player';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useMgmtCopy } from '@/lib/mgmtCopy';
import { Alert, Board, BoardSkeleton, Button, ErrorBoard, Figure, Ribbon, SegmentedControl, Sheet, Stamp, TextArea, Ticket, useToast } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareReply } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type ProblemRow = {
  id: string;
  taskId: string;
  category: string;
  reason: string;
  resolution: string | null;
  voiceDocumentId: string | null;
  resolutionVoiceDocumentId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  elapsedMinutes: number;
  worker: { id?: string; name: string } | null;
  order: { id?: string; number: string; productDescription?: string | null } | null;
  task: { id?: string; name: string; number?: string; stageDefinition?: { code: string; nameEn: string; nameAr: string; nameHe?: string | null } | null };
};

export default function ProductionProblemsPage() {
  const t = useTranslations('production');
  const tMobile = useTranslations('mobile');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const copy = useMgmtCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'open' | 'answered' | 'all'>('open');
  const [answering, setAnswering] = useState<ProblemRow | null>(null);
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['production-problems', 'all'], queryFn: () => apiFetch<{ data: ProblemRow[] }>('/api/v1/production/problems?status=all').then((r) => r.data), refetchInterval: 60_000 });
  const rows = query.data ?? [];
  const open = rows.filter((r) => !r.resolution && !r.resolvedAt);
  const answered = rows.filter((r) => r.resolution || r.resolvedAt);
  const visible = filter === 'open' ? open : filter === 'answered' ? answered : rows;
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of open) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [open]);
  const oldest = open.reduce((max, r) => Math.max(max, r.elapsedMinutes), 0);

  const categoryLabel = (category: string) => {
    const key = `tasks.blocker.${category}`;
    try {
      const labeled = tMobile(key as never);
      return typeof labeled === 'string' && labeled !== key ? labeled : category.replace(/_/g, ' ');
    } catch {
      return category.replace(/_/g, ' ');
    }
  };
  const elapsed = (m: number) => (m >= 60 * 24 ? `${Math.floor(m / (60 * 24))}d ${Math.floor((m % (60 * 24)) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
  const urgency = (m: number) => (m >= 240 ? 'error' : m >= 60 ? 'warning' : 'info');

  const answer = useMutation({
    mutationFn: async () => {
      if (!answering) return;
      if (!resolution.trim()) throw new Error(t('problemsAnswerRequired'));
      return apiFetch(`/api/v1/tasks/${answering.taskId}/blockers/${answering.id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution: resolution.trim() }) });
    },
    onSuccess: async () => {
      setAnswering(null);
      setResolution('');
      toast.success(t('problemsAnswered'));
      await Promise.all([qc.invalidateQueries({ queryKey: ['production-problems'] }), qc.invalidateQueries({ queryKey: ['production-orders'] })]);
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={open.length ? (oldest >= 240 ? 'error' : 'warning') : 'success'} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('problemsTitle')}</h1>
            <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{t('problemsHint')}</p>
            <div className="mt-4">
              <SegmentedControl
                size="sm"
                aria-label={t('problemsTitle')}
                value={filter}
                onChange={(v) => setFilter(v as typeof filter)}
                options={[
                  { value: 'open', label: `${t('problemsOpen')} · ${open.length}` },
                  { value: 'answered', label: `${t('problemsAnswered')} · ${answered.length}` },
                  { value: 'all', label: tCommon('all') },
                ]}
              />
            </div>
          </div>
          <div className="min-w-0">
            {byCategory.length ? <Ribbon size="sm" segments={byCategory.map(([c, v], i) => ({ key: c, label: categoryLabel(c), value: v, tone: (['error', 'warning', 'info', 'neutral', 'brand'] as const)[i % 5] }))} /> : null}
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Figure size="sm" value={open.length} label={t('problemsOpen')} tone={open.length ? 'error' : 'success'} />
              <Figure size="sm" value={oldest ? elapsed(oldest) : '—'} label={t('problemsOldest')} tone={urgency(oldest)} locale={locale} />
              <Figure size="sm" value={answered.length} label={t('problemsAnswered')} tone="success" />
            </div>
          </div>
        </div>
      </Board>

      {query.isPending ? (
        <BoardSkeleton rows={4} />
      ) : query.isError ? (
        <ErrorBoard title={t('problemsLoadError')} description={mutationErrorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : visible.length === 0 ? (
        <Board tone="success">
          <Board.Empty title={filter === 'open' ? t('problemsNoneOpen') : t('problemsTitle')} description={filter === 'open' ? t('problemsNoneOpenBody') : undefined} />
        </Board>
      ) : (
        <div className="maher-stagger grid gap-4 lg:grid-cols-2">
          {visible.map((row) => {
            const isOpen = !row.resolution && !row.resolvedAt;
            const tone = isOpen ? urgency(row.elapsedMinutes) : 'success';
            return (
              <Board key={row.id} tone={tone} wash={isOpen ? 'top' : 'none'} as="article">
                <Board.Header
                  title={<span dir="ltr">{row.order?.number ?? row.task.name}</span>}
                  description={[row.task.stageDefinition ? (locale === 'ar' ? row.task.stageDefinition.nameAr : locale === 'he' ? (row.task.stageDefinition.nameHe ?? row.task.stageDefinition.nameEn) : row.task.stageDefinition.nameEn) : null, row.task.name, row.order?.productDescription].filter(Boolean).join(' · ')}
                  meta={
                    <span className="flex items-center gap-1.5">
                      <Stamp tone={tone} size="sm">
                        {isOpen ? t('problemsOpen') : t('problemsAnswered')}
                      </Stamp>
                      <Stamp tone="neutral" size="sm">
                        {elapsed(row.elapsedMinutes)}
                      </Stamp>
                    </span>
                  }
                />
                <Board.Body className="space-y-3">
                  <Ticket tone={tone} title={categoryLabel(row.category)} why={copy.floorNote(row.reason)} trailing={row.voiceDocumentId ? <VoiceNotePlayer documentId={row.voiceDocumentId} label={t('problemsVoice')} /> : undefined} />
                  {row.resolution ? (
                    <div className="rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-success-soft)]/40 px-4 py-3">
                      <p className="text-[12px] font-medium text-[var(--maher-text-tertiary)]">{t('problemsAnswered')}</p>
                      <p className="mt-0.5 text-[14px] text-[var(--maher-text-primary)]">{row.resolution}</p>
                      {row.resolutionVoiceDocumentId ? (
                        <div className="mt-2">
                          <VoiceNotePlayer documentId={row.resolutionVoiceDocumentId} label={t('problemsAnswerVoice')} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </Board.Body>
                <Board.Footer>
                  <span className="text-[12px] text-[var(--maher-text-secondary)]">
                    {row.worker?.name ?? t('unassignedWorker')}
                    {' · '}
                    <span dir="ltr">{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(row.createdAt))}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {row.order?.id ? (
                      <Link href={`/admin/production/${row.order.id}?tab=tasks`} className="text-[13px] font-medium text-[var(--maher-brand)] hover:underline">
                        {tCommon('open')}
                      </Link>
                    ) : null}
                    {isOpen ? (
                      <Button size="sm" leadingIcon={<MessageSquareReply className="h-3.5 w-3.5" />} onClick={() => (setAnswering(row), setResolution(''), setError(null))}>
                        {t('problemsAnswer')}
                      </Button>
                    ) : null}
                  </span>
                </Board.Footer>
              </Board>
            );
          })}
        </div>
      )}

      <Sheet
        open={Boolean(answering)}
        onClose={() => !answer.isPending && setAnswering(null)}
        title={t('problemsAnswer')}
        description={answering ? `${answering.order?.number ?? ''} · ${categoryLabel(answering.category)} — ${answering.reason}` : undefined}
        tone="warning"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAnswering(null)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={answer.isPending} disabled={!resolution.trim()} onClick={() => answer.mutate()}>
              {t('problemsAnswer')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {answering?.voiceDocumentId ? <VoiceNotePlayer documentId={answering.voiceDocumentId} label={t('problemsVoice')} /> : null}
          <TextArea label={t('problemsAnswer')} value={resolution} onChange={(e) => setResolution(e.target.value)} rows={5} placeholder={t('problemsAnswerPlaceholder')} />
        </div>
      </Sheet>
    </div>
  );
}
