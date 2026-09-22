'use client';

import { VoiceNote } from '@/components/voice-note';
import { useRouter } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { Board, BoardSkeleton, Button, DetailHero, ErrorBoard, Ltr, Meter, StageStrip, Stamp, Timeline, type BoardTone, type StageStripStage, type TimelineItem } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { Armchair, Lock, PackageOpen, Play } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

type LaneNode = {
  id: string;
  taskId?: string | null;
  status: string;
  stageCode?: string;
  nameEn?: string;
  nameAr?: string | null;
  nameHe?: string | null;
  assigneeName?: string | null;
  lockState?: { kind?: string; reason?: string | null };
};

type Workflow = {
  number: string;
  productDescription?: string | null;
  productImageUrl?: string | null;
  salesOrderNumber?: string | null;
  quantity?: string | number | null;
  lane: LaneNode[];
};

function nodeTone(status: string): BoardTone {
  const key = status.toUpperCase();
  if (key === 'COMPLETED') return 'success';
  if (key === 'IN_PROGRESS') return 'brand';
  if (key === 'PAUSED') return 'warning';
  if (key === 'BLOCKED' || key === 'CANCELLED') return 'error';
  if (key === 'READY') return 'info';
  return 'neutral';
}

function nodeState(status: string, locked: boolean): StageStripStage['state'] {
  const key = status.toUpperCase();
  if (key === 'COMPLETED') return 'done';
  if (key === 'IN_PROGRESS' || key === 'PAUSED' || key === 'READY') return 'current';
  if (key === 'BLOCKED' || locked) return 'blocked';
  if (key === 'CANCELLED') return 'skipped';
  return 'todo';
}

export default function WorkerLanePage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const t = useTranslations('production');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const router = useRouter();
  const query = useQuery({ queryKey: ['my-order-workflow', params.id], queryFn: () => apiFetch<Workflow>(`/api/v1/tasks/my-orders/${params.id}/workflow`) });

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <BoardSkeleton rows={6} />
      </div>
    );
  }
  if (query.isError || !query.data) return <ErrorBoard title={tNav('myLane')} description={tCommon('loadFailed')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;

  const wf = query.data;
  const lane = wf.lane;
  const done = lane.filter((n) => n.status.toUpperCase() === 'COMPLETED').length;
  const current = lane.find((n) => ['IN_PROGRESS', 'PAUSED', 'READY'].includes(n.status.toUpperCase())) ?? lane.find((n) => n.status.toUpperCase() !== 'COMPLETED');
  const label = (code: string) => {
    try {
      return tStatus(code as 'PENDING');
    } catch {
      return code.replaceAll('_', ' ').toLowerCase();
    }
  };
  const name = (n: LaneNode) => localizedName(locale, { nameEn: n.nameEn ?? n.stageCode ?? '', nameAr: n.nameAr, nameHe: n.nameHe }, n.nameEn ?? n.stageCode ?? '');
  const img = wf.productImageUrl ? (/^https?:\/\//i.test(wf.productImageUrl) ? wf.productImageUrl : `${API_URL}${wf.productImageUrl}`) : null;
  const stages: StageStripStage[] = lane.map((n) => ({ key: n.id, label: name(n), state: nodeState(n.status, n.lockState?.kind === 'needs_receive'), meta: n.assigneeName ?? undefined }));
  const timeline: TimelineItem[] = lane.map((n) => {
    const needsReceive = n.lockState?.kind === 'needs_receive';
    const href = n.taskId ? (needsReceive ? `/worker/tasks/${n.taskId}/take-in` : `/worker/tasks/${n.taskId}`) : null;
    return {
      id: n.id,
      title: name(n),
      description: n.lockState?.reason ?? (n.assigneeName ?? undefined),
      tone: nodeTone(n.status),
      actor: <Stamp tone={nodeTone(n.status)} size="sm">{label(n.status)}</Stamp>,
      children: href ? (
        <Button size="sm" variant={needsReceive ? 'secondary' : 'primary'} leadingIcon={needsReceive ? <PackageOpen className="h-3.5 w-3.5" /> : n.lockState?.kind && !needsReceive ? <Lock className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} onClick={() => router.push(href)} className="mt-2">
          {needsReceive ? tNav('takeIn') : n.status.toUpperCase() === 'COMPLETED' ? tCommon('open') : t('startTask')}
        </Button>
      ) : undefined,
    };
  });

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        tone={current ? nodeTone(current.status) : 'success'}
        back={{ label: tNav('tasks'), onClick: () => router.push('/worker/tasks') }}
        code={wf.number}
        title={wf.productDescription ?? wf.number}
        subtitle={wf.salesOrderNumber ? <Ltr>{wf.salesOrderNumber}</Ltr> : undefined}
        status={current ? { label: label(current.status), tone: nodeTone(current.status) } : { label: label('COMPLETED'), tone: 'success' }}
        media={
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[14px] bg-[var(--maher-surface-muted)] sm:h-20 sm:w-20">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="h-full w-full object-cover" />
            ) : (
              <Armchair className="h-7 w-7 text-[var(--maher-text-tertiary)] opacity-60" />
            )}
          </span>
        }
        facts={[
          { label: tNav('myLane'), value: `${done}/${lane.length}`, ltr: true },
          ...(wf.quantity ? [{ label: tCommon('total'), value: `× ${wf.quantity}`, ltr: true }] : []),
          ...(current ? [{ label: t('taskNumber'), value: name(current) }] : []),
        ]}
        primary={current?.taskId ? <Button leadingIcon={current.lockState?.kind === 'needs_receive' ? <PackageOpen className="h-4 w-4" /> : <Play className="h-4 w-4" />} onClick={() => router.push(current.lockState?.kind === 'needs_receive' ? `/worker/tasks/${current.taskId}/take-in` : `/worker/tasks/${current.taskId}`)}>{current.lockState?.kind === 'needs_receive' ? tNav('takeIn') : t('startTask')}</Button> : undefined}
      >
        <div className="space-y-3">
          <Meter value={done} max={Math.max(1, lane.length)} tone="success" label={tNav('myLane')} valueLabel={`${Math.round((done / Math.max(1, lane.length)) * 100)}%`} />
          <StageStrip stages={stages} compact />
        </div>
      </DetailHero>

      <div className="grid gap-5 xl:grid-cols-12">
        <Board tone="neutral" className="xl:col-span-8">
          <Board.Header title={tNav('myLane')} meta={<Stamp tone="neutral" size="sm">{lane.length}</Stamp>} />
          <Board.Body>
            <Timeline items={timeline} />
          </Board.Body>
        </Board>
        <Board tone="neutral" className="xl:col-span-4">
          <Board.Header title={t('reportProblem')} description={t('problemHint')} />
          <Board.Body>
            <VoiceNote />
          </Board.Body>
        </Board>
      </div>
    </div>
  );
}
