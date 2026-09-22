'use client';

import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { useRouter } from '@/i18n/navigation';
import { ActionDock, Alert, Board, BoardSkeleton, Button, DetailHero, ErrorBoard, Ledger, LedgerRow, Ltr, Meter, Stamp, useCodeScanner } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ScanLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Incoming = {
  required: boolean;
  allReceived: boolean;
  lines?: Array<{ id: string; qrCode?: string; status?: string; label?: string | null; fromStage?: string | null }>;
};

export default function TaskTakeInPage({ params }: { params: { id: string } }) {
  const t = useTranslations('production');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const router = useRouter();
  const qc = useQueryClient();
  const { openScanner } = useCodeScanner();
  const [error, setError] = useState<string | null>(null);

  const incoming = useQuery({ queryKey: ['task-wip-incoming', params.id], queryFn: () => apiFetch<Incoming>(`/api/v1/tasks/${params.id}/wip-incoming`) });
  const receive = useMutation({
    mutationFn: (scanCode: string) => apiFetch(`/api/v1/tasks/${params.id}/wip-receive`, { method: 'POST', body: JSON.stringify({ scanCode }) }),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['task-wip-incoming', params.id] });
      await qc.invalidateQueries({ queryKey: ['task', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  if (incoming.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <BoardSkeleton rows={4} />
      </div>
    );
  }
  if (incoming.isError) return <ErrorBoard title={t('takeInTitle')} description={tCommon('loadFailed')} onRetry={() => incoming.refetch()} retryLabel={tCommon('retry')} />;

  const board = incoming.data;
  const lines = board?.lines ?? [];
  const received = lines.filter((l) => (l.status ?? '').toUpperCase() === 'RECEIVED').length;
  const ready = Boolean(board && (!board.required || board.allReceived));
  const label = (code: string) => {
    try {
      return tStatus(code as 'PENDING');
    } catch {
      return code.replaceAll('_', ' ').toLowerCase();
    }
  };
  const scan = async () => {
    const code = await openScanner({ title: tNav('takeIn') });
    if (code) receive.mutate(code);
  };

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        tone={ready ? 'success' : 'info'}
        back={{ label: t('taskDetail'), onClick: () => router.push(`/worker/tasks/${params.id}`) }}
        title={t('takeInTitle')}
        subtitle={t('takeInHint')}
        status={{ label: ready ? label('RECEIVED') : label('AWAITING_RECEIPT'), tone: ready ? 'success' : 'info' }}
        facts={[
          { label: t('kitLines'), value: `${received}/${lines.length}`, ltr: true },
          { label: tCommon('status'), value: board?.required ? label('PENDING') : label('READY'), tone: board?.required && !board.allReceived ? 'info' : 'success' },
        ]}
        primary={ready ? <Button trailingIcon={<ArrowRight className="h-4 w-4 rtl:-scale-x-100" />} onClick={() => router.push(`/worker/tasks/${params.id}`)}>{t('takeInContinue')}</Button> : <Button leadingIcon={<ScanLine className="h-4 w-4" />} onClick={scan} loading={receive.isPending}>{tCommon('scanTitle')}</Button>}
      >
        <Meter value={received} max={Math.max(1, lines.length)} tone={ready ? 'success' : 'info'} label={t('kitLines')} valueLabel={`${received}/${lines.length}`} />
      </DetailHero>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Board tone={ready ? 'success' : 'info'} wash={ready ? 'none' : 'top'}>
        <Board.Header title={t('kitLines')} meta={<Stamp tone={ready ? 'success' : 'info'} size="sm">{`${received}/${lines.length}`}</Stamp>} actions={!ready ? <Button size="sm" variant="secondary" leadingIcon={<ScanLine className="h-4 w-4" />} onClick={scan} loading={receive.isPending}>{t('scanNext')}</Button> : undefined} />
        {lines.length === 0 ? (
          <Board.Empty title={tCommon('none')} description={t('takeInHint')} />
        ) : (
          <Ledger className="px-5 pb-2">
            {lines.map((line) => {
              const done = (line.status ?? '').toUpperCase() === 'RECEIVED';
              return <LedgerRow key={line.id} label={<Ltr className="font-medium">{line.label ?? line.qrCode ?? line.id}</Ltr>} hint={line.fromStage ?? (line.qrCode && line.label ? line.qrCode : undefined)} value={<Stamp tone={done ? 'success' : 'info'} size="sm">{label(line.status ?? 'PENDING')}</Stamp>} tone={done ? 'success' : 'info'} stamp />;
            })}
          </Ledger>
        )}
      </Board>

      <ActionDock className="md:hidden" note={<Stamp tone={ready ? 'success' : 'info'} size="sm">{`${received}/${lines.length}`}</Stamp>}>
        {!ready ? <Button variant="secondary" leadingIcon={<ScanLine className="h-4 w-4" />} onClick={scan} loading={receive.isPending}>{tCommon('scanTitle')}</Button> : null}
        <Button className="flex-1" disabled={!ready} onClick={() => router.push(`/worker/tasks/${params.id}`)}>
          {t('takeInContinue')}
        </Button>
      </ActionDock>
    </div>
  );
}
