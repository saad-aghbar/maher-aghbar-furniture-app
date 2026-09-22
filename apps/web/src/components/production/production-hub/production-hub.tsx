'use client';

import { ProductionLifecyclePanel } from '@/components/production/production-lifecycle-panel';
import { ProductionMaterialsPanel } from '@/components/production/production-materials-panel';
import { ProductionQualityPanel } from '@/components/production/production-quality-panel';
import { ProductionWipPanel } from '@/components/production/production-wip-panel';
import { OrderWorkflowSection } from '@/components/workflow/order-workflow-section';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { allocationPersonLabel, fmtTime } from '@/lib/scheduling';
import { isQualityGateStageCode } from '@/lib/workflow-terminal';
import { localizedName } from '@maher/i18n';
import {
  Alert,
  Board,
  BoardSkeleton,
  Button,
  Combobox,
  ConfirmDialog,
  DateField,
  DetailHero,
  ErrorBoard,
  Figure,
  KeyFacts,
  Ledger,
  LedgerRow,
  Ltr,
  Menu,
  Meter,
  NumberField,
  PhotoAttachField,
  SectionTabs,
  SegmentedControl,
  Sheet,
  Stamp,
  TextArea,
  Ticket,
  todayYmd,
  type BoardTone,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { Armchair, MoreHorizontal, Paperclip, Pause, Pin, PinOff, Play, RefreshCw, ShieldAlert, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PRIORITIES, complexityTone, priorityTone, productionTone, useProductionCopy } from '../production-shared';
import { LOCKED_STAGE, LOCKED_TASK, PRE_START, useProductionOrder, type ProductionOrderCtl, type Stage, type Task } from './use-production-order';

const TABS = ['lifecycle', 'tasks', 'materials', 'quality', 'wip', 'workflow', 'schedule'] as const;
type Tab = (typeof TABS)[number];

const ymd = (v?: string | null) => (v ? v.slice(0, 10) : '');

export function ProductionHub({ id }: { id: string }) {
  const ctl = useProductionOrder(id);
  const copy = useProductionCopy();
  const t = useTranslations('navigation');
  const tp = useTranslations('production');
  const tc = useTranslations('catalog');
  const tm = useTranslations('mobile.production');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const search = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(search.get('tab') ?? '') ? (search.get('tab') as Tab) : 'lifecycle';
  const setTab = (next: string) => {
    const sp = new URLSearchParams(search.toString());
    if (next === 'lifecycle') sp.delete('tab');
    else sp.set('tab', next);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };
  const [confirmStart, setConfirmStart] = useState(false);

  const { detail } = ctl.queries;
  if (detail.isLoading) return <BoardSkeleton rows={6} />;
  if (detail.isError || !ctl.order) return <ErrorBoard title={t('production')} description={mutationErrorMessage(detail.error)} onRetry={() => detail.refetch()} />;
  const order = ctl.order;
  const isCompleted = order.status === 'COMPLETED' || order.status === 'CANCELLED';
  const canStart = !isCompleted && PRE_START.has(order.status);
  const openBlockers = order.stages.flatMap((s) => s.tasks.flatMap((task) => (task.blockers ?? []).filter((b) => !b.resolvedAt).map((b) => ({ ...b, task, stage: s }))));
  const title = order.product ? localizedName(copy.locale, { nameEn: order.product.nameEn ?? '', nameAr: order.product.nameAr, nameHe: order.product.nameHe }, order.product.nameEn ?? '') || order.productDescription : order.productDescription || order.number;
  const due = order.committedDeliveryDate ?? order.plannedCompletionDate ?? order.requiredDeliveryDate;
  const days = copy.daysUntil(due);
  const late = !isCompleted && days != null && days < 0;
  const tone: BoardTone = isCompleted ? 'success' : openBlockers.length || order.status === 'ON_HOLD' ? 'error' : late ? 'error' : productionTone(order.status);
  const currentStage = order.stages.find((s) => s.stageDefinition.code === order.currentStageCode);
  const doneStages = order.stages.filter((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED').length;

  const tabs = [
    { id: 'lifecycle', label: tp('hubLifecycle') },
    { id: 'tasks', label: tp('hubTasks'), count: order.stages.length },
    { id: 'materials', label: tp('hubMaterials'), count: ctl.queries.materials.data?.materials.length ?? null },
    { id: 'quality', label: tp('hubQuality') },
    { id: 'wip', label: tp('hubWip') },
    { id: 'workflow', label: tp('workflow.title') },
    { id: 'schedule', label: tp('schedulingSection') },
  ];

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        back={{ label: t('production'), href: '/admin/production' }}
        LinkComponent={Link}
        code={order.number}
        title={title}
        subtitle={[order.customer ? localizedName(copy.locale, order.customer, order.customer.name) : null, order.salesOrder ? order.salesOrder.externalOrderNumber?.trim() || order.salesOrder.number : null, order.quantity ? `× ${order.quantity}` : null].filter(Boolean).join(' · ')}
        status={{ label: copy.status(order.status), tone: productionTone(order.status) }}
        tone={tone}
        media={
          <span className="block h-20 w-20 overflow-hidden rounded-[14px] bg-[var(--maher-surface-muted)] sm:h-24 sm:w-24">
            {order.imageUrl ?? order.product?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(order.imageUrl ?? order.product?.imageUrl) as string} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[var(--maher-text-tertiary)]">
                <Armchair className="h-8 w-8 opacity-50" />
              </span>
            )}
          </span>
        }
        facts={[
          { label: tc('current'), value: currentStage ? localizedName(copy.locale, currentStage.stageDefinition) : order.currentStageCode ?? '—' },
          { label: tm('dueDate'), value: copy.date(due), ltr: true, tone: late ? 'error' : undefined },
          { label: tSales('desk.stage'), value: days == null || isCompleted ? '—' : late ? tSales('desk.lateBy', { count: Math.abs(days) }) : tSales('desk.dueIn', { count: days }), ltr: true, tone: late ? 'error' : days != null && days <= 2 ? 'warning' : undefined },
          { label: tc('priority'), value: copy.priority(order.priority), tone: priorityTone(order.priority) },
          { label: tSales('desk.complexity'), value: copy.complexity(order.manufacturingComplexity), tone: complexityTone(order.manufacturingComplexity) },
          { label: tm('blocked'), value: String(openBlockers.length), ltr: true, tone: openBlockers.length ? 'error' : 'success' },
        ]}
        primary={
          canStart ? (
            <Button leadingIcon={<Play className="h-4 w-4" />} onClick={() => setConfirmStart(true)}>
              {tc('startProduction')}
            </Button>
          ) : order.salesOrder ? (
            <Button variant="secondary" onClick={() => router.push(`/${copy.locale}/admin/sales-orders/${order.salesOrder!.id}`)}>
              {tSales('systemOrderNumber')}
            </Button>
          ) : undefined
        }
        actions={
          <Menu
            aria-label={tCommon('more')}
            trigger={<Button variant="secondary" aria-label={tCommon('more')}><MoreHorizontal className="h-4 w-4" /></Button>}
            items={[
              ...(order.salesOrder ? [{ id: 'so', label: tSales('systemOrderNumber'), href: `/admin/sales-orders/${order.salesOrder.id}` }, { id: 'plan', label: t('productionPlan'), href: `/admin/sales-orders/${order.salesOrder.id}/plan` }] : []),
              ...(order.returnRequest ? [{ id: 'ret', label: order.returnRequest.number, href: `/admin/returns/${order.returnRequest.id}` }] : []),
              { id: 'resync', label: tp('planResync'), icon: <RefreshCw className="h-4 w-4" />, onSelect: () => ctl.resync.mutate(), separator: true },
            ]}
            LinkComponent={Link}
          />
        }
      >
        <Meter value={Math.min(100, Math.max(0, Number(order.progressPercent ?? 0)))} max={100} label={tm('overallProgress')} valueLabel={`${Math.round(Number(order.progressPercent ?? 0))}% · ${doneStages}/${order.stages.length}`} tone={isCompleted ? 'success' : late ? 'error' : 'brand'} />
        <SectionTabs items={tabs} value={tab} onChange={setTab} size="sm" aria-label={t('production')} className="mt-4" />
      </DetailHero>

      {isCompleted ? <Alert variant="info">{tp('orderCompletedReadOnly')}</Alert> : null}
      {ctl.queries.planSetup.data?.planDrift?.drifted ? (
        <Ticket tone="warning" title={tp('planDriftBody')} action={<Button size="sm" loading={ctl.resync.isPending} onClick={() => ctl.resync.mutate()}>{tp('planResync')}</Button>} />
      ) : null}

      {tab === 'lifecycle' ? <LifecycleTab ctl={ctl} blockers={openBlockers} /> : null}
      {tab === 'tasks' ? <TasksTab ctl={ctl} /> : null}
      {tab === 'materials' ? <MaterialsTab ctl={ctl} /> : null}
      {tab === 'quality' ? <ProductionQualityPanel productionOrderId={id} /> : null}
      {tab === 'wip' ? <ProductionWipPanel productionOrderId={id} /> : null}
      {tab === 'workflow' ? <WorkflowTab ctl={ctl} /> : null}
      {tab === 'schedule' ? <ScheduleTab ctl={ctl} /> : null}

      <ConfirmDialog
        open={confirmStart}
        title={tp('startConfirmTitle')}
        description={tp('startConfirmDescription')}
        confirmLabel={tc('startProduction')}
        cancelLabel={tCommon('cancel')}
        loading={ctl.start.isPending}
        onClose={() => setConfirmStart(false)}
        onConfirm={() => ctl.start.mutate(undefined, { onSuccess: () => setConfirmStart(false) })}
      />
    </div>
  );
}

/* ── Lifecycle: journey strip, planning, costing, blockers ───────────────── */

function LifecycleTab({ ctl, blockers }: { ctl: ProductionOrderCtl; blockers: Array<{ id: string; category: string; reason: string; task: Task; stage: Stage }> }) {
  const order = ctl.order!;
  const copy = useProductionCopy();
  const tp = useTranslations('production');
  const tc = useTranslations('catalog');
  const tm = useTranslations('mobile.production');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const kit = useKitCopy();
  const isCompleted = order.status === 'COMPLETED' || order.status === 'CANCELLED';
  const inProduction = !isCompleted && !PRE_START.has(order.status);
  const [priority, setPriority] = useState(order.priority ?? 'NORMAL');
  const [plannedStart, setPlannedStart] = useState(ymd(order.plannedStartDate));
  const [plannedEnd, setPlannedEnd] = useState(ymd(order.plannedCompletionDate));
  const [estimated, setEstimated] = useState<number | null>(order.estimatedMinutes ?? null);
  useEffect(() => {
    setPriority(order.priority ?? 'NORMAL');
    setPlannedStart(ymd(order.plannedStartDate));
    setPlannedEnd(ymd(order.plannedCompletionDate));
    setEstimated(order.estimatedMinutes ?? null);
  }, [order.priority, order.plannedStartDate, order.plannedCompletionDate, order.estimatedMinutes]);
  const dirty = priority !== (order.priority ?? 'NORMAL') || plannedStart !== ymd(order.plannedStartDate) || plannedEnd !== ymd(order.plannedCompletionDate) || (estimated ?? null) !== (order.estimatedMinutes ?? null);
  const costing = order.manufacturingCosting;
  const money = (v?: number | null) => (v == null ? '—' : new Intl.NumberFormat(copy.locale, { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(Number(v)));

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <Board tone="brand" className="xl:col-span-12">
        <Board.Header title={tp('hubLifecycle')} description={tp('hubLifecycleHint')} />
        <ProductionLifecyclePanel poStatus={order.status} currentStageCode={order.currentStageCode} stages={order.stages} deliveryStatus={ctl.queries.delivery.data?.status ?? null} />
      </Board>

      {blockers.length ? (
        <Board tone="error" wash="top" className="xl:col-span-5">
          <Board.Header title={tm('blocked')} meta={<Stamp tone="error" size="sm">{blockers.length}</Stamp>} />
          <Board.Body className="space-y-3">
            {blockers.map((b) => (
              <Ticket
                key={b.id}
                tone="error"
                title={`${localizedName(copy.locale, b.stage.stageDefinition)} · ${b.task.name}`}
                why={`${copy.status(b.category)} — ${b.reason}`}
                action={
                  <Button size="sm" variant="secondary" loading={ctl.taskAction.isPending} onClick={() => ctl.taskAction.mutate({ taskId: b.task.id, action: 'unblock' })}>
                    {tp('unblock')}
                  </Button>
                }
              />
            ))}
          </Board.Body>
        </Board>
      ) : null}

      <Board tone={inProduction ? 'info' : 'warning'} className={blockers.length ? 'xl:col-span-7' : 'xl:col-span-7'}>
        <Board.Header
          title={tc('savePlanning')}
          description={inProduction ? tp('stageAssignLocked') : undefined}
          actions={
            !isCompleted ? (
              <Button size="sm" loading={ctl.plan.isPending} disabled={!dirty} onClick={() => ctl.plan.mutate(inProduction ? { priority, plannedCompletionDate: plannedEnd || undefined } : { priority, plannedStartDate: plannedStart || undefined, plannedCompletionDate: plannedEnd || undefined, estimatedMinutes: estimated ?? undefined })}>
                {tCommon('save')}
              </Button>
            ) : null
          }
        />
        <Board.Body className="space-y-4">
          {isCompleted ? (
            <KeyFacts
              columns={4}
              facts={[
                { label: tc('priority'), value: copy.priority(order.priority) },
                { label: tc('plannedStart'), value: copy.date(order.plannedStartDate), ltr: true },
                { label: tc('plannedEnd'), value: copy.date(order.plannedCompletionDate), ltr: true },
                { label: tc('estMinutes'), value: order.estimatedMinutes != null ? `${order.estimatedMinutes} ${tc('minutesUnit')}` : '—', ltr: true },
              ]}
            />
          ) : (
            <>
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tc('priority')}</span>
                <SegmentedControl size="sm" aria-label={tc('priority')} value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p, label: copy.priority(p) }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {!inProduction ? <DateField label={tc('plannedStart')} value={plannedStart} onChange={setPlannedStart} copy={kit.date} locale={copy.locale} todayShortcut /> : null}
                <DateField label={tc('plannedEnd')} value={plannedEnd} onChange={setPlannedEnd} copy={kit.date} locale={copy.locale} minDate={plannedStart || undefined} todayShortcut />
                {!inProduction ? <NumberField label={tc('estMinutes')} unit={tc('minutesUnit')} value={estimated} onChange={setEstimated} min={0} /> : null}
              </div>
            </>
          )}
        </Board.Body>
      </Board>

      {costing ? (
        <Board tone={costing.incomplete ? 'warning' : String(costing.status).toUpperCase() === 'FINAL' ? 'success' : 'neutral'} className="xl:col-span-5">
          <Board.Header
            title={tSales('mfgCostTitle')}
            description={`${String(costing.status ?? '').toUpperCase() === 'FINAL' ? tSales('mfgCostStatusFinal') : String(costing.status ?? '').toUpperCase() === 'IN_PROGRESS' ? tSales('mfgCostStatusInProgress') : String(costing.status ?? '').toUpperCase() === 'INCOMPLETE' ? tSales('mfgCostStatusIncomplete') : tSales('mfgCostStatusEstimatedOnly')}${costing.incomplete ? ` · ${tSales('mfgCostIncomplete')}` : ''}`}
          />
          <Board.Body className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Figure size="sm" value={money(costing.estimatedTotal)} label={tSales('mfgCostEstimated')} locale={copy.locale} />
              <Figure size="sm" value={money(costing.actualTotal)} label={tSales('mfgCostActual')} tone={costing.varianceCost != null && costing.varianceCost > 0 ? 'error' : 'success'} locale={copy.locale} />
            </div>
            {costing.estimatedTotal ? <Meter value={Math.min(Number(costing.actualTotal ?? 0), Number(costing.estimatedTotal) * 1.5)} max={Number(costing.estimatedTotal)} target={Number(costing.estimatedTotal)} size="sm" label={tSales('mfgCostVariance')} valueLabel={money(costing.varianceCost)} tone={costing.varianceCost != null && costing.varianceCost > 0 ? 'error' : 'success'} /> : null}
          </Board.Body>
        </Board>
      ) : null}
    </div>
  );
}

/* ── Tasks: one row per stage, assignment via sheet ──────────────────────── */

function TasksTab({ ctl }: { ctl: ProductionOrderCtl }) {
  const order = ctl.order!;
  const copy = useProductionCopy();
  const tp = useTranslations('production');
  const tc = useTranslations('catalog');
  const tm = useTranslations('mobile.production');
  const tCommon = useTranslations('common');
  const isCompleted = order.status === 'COMPLETED' || order.status === 'CANCELLED';
  const [assignFor, setAssignFor] = useState<{ stage: Stage; task: Task } | null>(null);
  const [blockFor, setBlockFor] = useState<Task | null>(null);
  const [notesFor, setNotesFor] = useState<Task | null>(null);
  const [notes, setNotes] = useState('');
  const [attachFor, setAttachFor] = useState<Task | null>(null);
  const docsFor = (taskId: string) => (order.documents ?? []).filter((d) => d.category === `TASK_PHOTO:${taskId}` || d.category?.endsWith(`:${taskId}`));
  const assignable = (stage: Stage, task: Task) => !isCompleted && !LOCKED_STAGE.has(stage.status) && !LOCKED_TASK.has(task.status);

  return (
    <>
      <Board tone="brand">
        <Board.Header title={tp('hubTasks')} description={tp('tasksHint')} meta={<Stamp tone="neutral" size="sm">{`${order.stages.filter((s) => s.status === 'COMPLETED').length}/${order.stages.length}`}</Stamp>} />
        <ol className="divide-y divide-[var(--maher-border)]">
          {order.stages.map((stage, index) => {
            const task = stage.tasks[0];
            const stageTone = productionTone(stage.status === 'BLOCKED' ? 'ON_HOLD' : stage.status === 'COMPLETED' ? 'COMPLETED' : stage.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : stage.status === 'READY_FOR_INSPECTION' ? 'QUALITY_CHECK' : 'PLANNED');
            const gate = isQualityGateStageCode(stage.stageDefinition.code);
            const docs = task ? docsFor(task.id) : [];
            const running = task?.timing?.status === 'running';
            return (
              <li key={stage.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[28px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--maher-border)] text-[12px] font-semibold text-[var(--maher-text-secondary)]" dir="ltr">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[14px] font-semibold text-[var(--maher-text-primary)]">{localizedName(copy.locale, stage.stageDefinition)}</span>
                    <Stamp tone={stageTone} size="sm">
                      {copy.status(stage.status)}
                    </Stamp>
                    {gate ? <Stamp tone="info" size="sm">{tp('hubQuality')}</Stamp> : null}
                  </span>
                  <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">
                    {stage.stageDefinition.responsibleDepartment ?? '—'}
                    {task?.number ? ` · ${task.number}` : ''}
                    {task?.notes?.trim() ? ` · ${task.notes.trim()}` : ''}
                  </span>
                </span>
                <span className="min-w-0">
                  <Meter value={Math.min(100, Math.max(0, Number(stage.progressPercent ?? 0)))} max={100} size="sm" valueLabel={`${Math.round(Number(stage.progressPercent ?? 0))}%`} tone={stageTone} />
                  {task ? (
                    <span className="mt-1 block text-[12px] text-[var(--maher-text-tertiary)]" dir="ltr">
                      {running ? '● ' : ''}
                      {Math.round(task.timing?.elapsedMinutes ?? task.actualMinutes ?? 0)}m{task.estimatedMinutes ? ` / ${task.estimatedMinutes}m` : ''}
                      {task.plannedCompletion ? ` · ${copy.date(task.plannedCompletion, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0">
                  {task ? (
                    <>
                      <span className="block truncate text-[13px] text-[var(--maher-text-primary)]">{task.assignedEmployee ? copy.worker(task.assignedEmployee) : tp('unassignedWorker')}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Stamp tone={priorityTone(task.priority)} size="sm">
                          {copy.priority(task.priority)}
                        </Stamp>
                        {docs.length ? (
                          <button type="button" className="text-[12px] font-medium text-[var(--maher-brand)] hover:underline" onClick={() => setAttachFor(task)}>
                            {tp('photosCount', { count: docs.length })}
                          </button>
                        ) : null}
                      </span>
                    </>
                  ) : (
                    <span className="text-[13px] text-[var(--maher-text-tertiary)]">{tc('noTask')}</span>
                  )}
                </span>
                <span className="flex items-center justify-end gap-1.5">
                  {task && assignable(stage, task) ? (
                    <Button size="sm" variant={task.assignedEmployee ? 'secondary' : 'primary'} leadingIcon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setAssignFor({ stage, task })}>
                      {task.assignedEmployee ? tm('reassignWorker') : tc('assign')}
                    </Button>
                  ) : null}
                  {task && !isCompleted ? (
                    <Menu
                      aria-label={tCommon('actions')}
                      trigger={<Button size="sm" variant="ghost" aria-label={tCommon('actions')}><MoreHorizontal className="h-4 w-4" /></Button>}
                      items={[
                        { id: 'notes', label: tc('saveNotes'), onSelect: () => (setNotes(task.notes ?? ''), setNotesFor(task)) },
                        { id: 'attach', label: tp('attachFile'), icon: <Paperclip className="h-4 w-4" />, onSelect: () => setAttachFor(task) },
                        { id: 'open', label: tCommon('open'), href: `/admin/production/tasks/${task.id}` },
                        ...(task.status === 'IN_PROGRESS' ? [{ id: 'pause', label: tp('hold'), icon: <Pause className="h-4 w-4" />, onSelect: () => ctl.taskAction.mutate({ taskId: task.id, action: 'pause' }) }] : []),
                        ...(task.status === 'BLOCKED' ? [{ id: 'unblock', label: tp('unblock'), onSelect: () => ctl.taskAction.mutate({ taskId: task.id, action: 'unblock' }) }] : []),
                        ...(!['COMPLETED', 'CANCELLED', 'BLOCKED'].includes(task.status) ? [{ id: 'block', label: tp('block'), icon: <ShieldAlert className="h-4 w-4" />, tone: 'error' as const, separator: true, onSelect: () => setBlockFor(task) }] : []),
                      ]}
                      LinkComponent={Link}
                    />
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </Board>

      {assignFor ? <AssignSheet ctl={ctl} stage={assignFor.stage} task={assignFor.task} onClose={() => setAssignFor(null)} /> : null}

      <ConfirmDialog
        open={Boolean(blockFor)}
        title={tp('block')}
        description={tp('blockReasonPrompt')}
        confirmLabel={tp('block')}
        cancelLabel={tCommon('cancel')}
        withReason
        reasonRequired
        reasonLabel={tc('reason')}
        danger
        loading={ctl.taskAction.isPending}
        onClose={() => setBlockFor(null)}
        onConfirm={(reason) => blockFor && ctl.taskAction.mutate({ taskId: blockFor.id, action: 'block', reason: reason?.trim() || tp('hold') }, { onSuccess: () => setBlockFor(null) })}
      />

      <Sheet open={Boolean(attachFor)} onClose={() => setAttachFor(null)} title={tp('attachFile')} description={attachFor?.name}>
        {attachFor ? (
          <div className="space-y-4">
            <PhotoAttachField
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
              uploadLabel={tp('attachFile')}
              uploadingLabel={tCommon('uploading')}
              attachUrlLabel={tCommon('attachFromUrl')}
              onUploadFile={(file) => ctl.upload.mutateAsync({ taskId: attachFor.id, file }).then(() => undefined)}
              onAttachUrl={(url) => ctl.upload.mutateAsync({ taskId: attachFor.id, url }).then(() => undefined)}
            />
            {docsFor(attachFor.id).length ? (
              <ul className="divide-y divide-[var(--maher-border)] rounded-[12px] border border-[var(--maher-border)]">
                {docsFor(attachFor.id).map((d) => (
                  <li key={d.id}>
                    <button type="button" className="maher-press flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-[13px] text-[var(--maher-text-primary)]" onClick={() => void ctl.openDocument(d.id)}>
                      <span className="truncate">{d.fileName}</span>
                      <span className="shrink-0 text-[12px] text-[var(--maher-text-tertiary)]" dir="ltr">{Math.round(d.sizeBytes / 1024)} KB</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-[var(--maher-text-tertiary)]">{tp('noAttachmentsYet')}</p>
            )}
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={Boolean(notesFor)}
        onClose={() => setNotesFor(null)}
        title={tc('saveNotes')}
        description={notesFor?.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNotesFor(null)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={ctl.taskAction.isPending} onClick={() => notesFor && ctl.taskAction.mutate({ taskId: notesFor.id, action: 'notes', notes }, { onSuccess: () => setNotesFor(null) })}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} placeholder={tc('notesOptional')} />
      </Sheet>
    </>
  );
}

function AssignSheet({ ctl, stage, task, onClose }: { ctl: ProductionOrderCtl; stage: Stage; task: Task; onClose: () => void }) {
  const copy = useProductionCopy();
  const tp = useTranslations('production');
  const tc = useTranslations('catalog');
  const tm = useTranslations('mobile.production');
  const tCommon = useTranslations('common');
  const kit = useKitCopy();
  const gate = isQualityGateStageCode(stage.stageDefinition.code);
  const [employeeId, setEmployeeId] = useState<string | null>(task.assignedEmployee?.id ?? null);
  const [priority, setPriority] = useState(task.priority || 'NORMAL');
  const [dueDate, setDueDate] = useState(ymd(task.plannedCompletion) || todayYmd());
  const [dueTime, setDueTime] = useState(task.plannedCompletion ? new Date(task.plannedCompletion).toTimeString().slice(0, 5) : '17:00');
  const [estimate, setEstimate] = useState<number | null>(task.estimatedMinutes ?? null);
  const workers = useQuery({
    queryKey: ['assignable-workers', stage.stageDefinition.id ?? stage.stageDefinition.code, task.id, dueDate],
    queryFn: () => apiFetch<Array<{ id: string; firstName: string; lastName: string; activeTaskCount?: number; recommendBand?: string; recommendReason?: string | null }>>(`/api/v1/production-orders/assignable-workers?${new URLSearchParams({ ...(stage.stageDefinition.id ? { stageDefinitionId: stage.stageDefinition.id } : {}), taskId: task.id, plannedCompletion: `${dueDate}T${dueTime}:00` }).toString()}`),
  });
  const plannedCompletion = (() => {
    const d = new Date(`${dueDate}T${dueTime}:00`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  })();
  const bandTone = (b?: string): BoardTone => (b === 'best' || b === 'good' || b === 'recommended' ? 'success' : b === 'busy' || b === 'overloaded' ? 'warning' : b === 'conflict' ? 'error' : 'neutral');

  return (
    <Sheet
      open
      onClose={onClose}
      title={task.assignedEmployee ? tm('reassignWorker') : tm('assignWorker')}
      description={`${localizedName(copy.locale, stage.stageDefinition)} · ${task.name}`}
      widthClassName="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button loading={ctl.assign.isPending} disabled={!employeeId} onClick={() => employeeId && ctl.assign.mutate({ taskId: task.id, employeeId, priority, plannedCompletion, estimatedMinutes: gate ? 0 : (estimate ?? undefined) }, { onSuccess: onClose })}>
            {tm('confirmAssign')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField label={tm('dueDate')} value={dueDate} onChange={setDueDate} copy={kit.date} locale={copy.locale} minDate={todayYmd()} todayShortcut />
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tm('dueTime')}</span>
            <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="maher-input w-full" dir="ltr" />
          </label>
          {!gate ? <NumberField label={tc('estMinutes')} unit={tc('minutesUnit')} value={estimate} onChange={setEstimate} min={0} /> : null}
          <div className={gate ? 'sm:col-span-2' : ''}>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tc('priority')}</span>
            <SegmentedControl size="sm" aria-label={tc('priority')} value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p, label: copy.priority(p) }))} />
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tc('worker')}</span>
          {workers.isLoading ? (
            <p className="text-[13px] text-[var(--maher-text-tertiary)]">{tm('loadingWorkers')}</p>
          ) : (workers.data ?? []).length === 0 ? (
            <p className="text-[13px] text-[var(--maher-text-tertiary)]">{tm('noWorkers')}</p>
          ) : (
            <ul className="space-y-2">
              {(workers.data ?? []).map((w) => (
                <li key={w.id}>
                  <button type="button" onClick={() => setEmployeeId(w.id)} className={`maher-press flex w-full items-center justify-between gap-3 rounded-[12px] border px-4 py-3 text-start ${employeeId === w.id ? 'border-[var(--maher-brand)] bg-[var(--maher-brand-soft)]' : 'border-[var(--maher-border)]'}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-[var(--maher-text-primary)]">{copy.worker(w)}</span>
                      {w.recommendReason ? <span className="block truncate text-[12px] text-[var(--maher-text-secondary)]">{w.recommendReason}</span> : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {w.recommendBand ? <Stamp tone={bandTone(w.recommendBand)} size="sm">{w.recommendBand}</Stamp> : null}
                      <Stamp tone="neutral" size="sm">{tm('activeTasks', { count: w.activeTaskCount ?? 0 })}</Stamp>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {task.assignedEmployee ? <p className="text-[12px] text-[var(--maher-text-tertiary)]">{tp('stageAssignLocked')}</p> : null}
      </div>
    </Sheet>
  );
}

/* ── Materials: usage ledger + return unused (mobile-only) ───────────────── */

function MaterialsTab({ ctl }: { ctl: ProductionOrderCtl }) {
  const copy = useProductionCopy();
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const kit = useKitCopy();
  const rows = ctl.queries.materials.data?.materials ?? [];
  const [returning, setReturning] = useState<(typeof rows)[number] | null>(null);
  const [qty, setQty] = useState<number | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const assigned = rows.reduce((s, r) => s + Number(r.assignedQty ?? 0), 0);
  const used = rows.reduce((s, r) => s + Number(r.usedQty ?? 0), 0);
  const over = rows.filter((r) => r.status === 'OVER' || r.status === 'EXTRA').length;
  const unused = rows.filter((r) => Number(r.assignedQty ?? 0) - Number(r.usedQty ?? 0) - Number(r.returnedQty ?? 0) > 0 && r.status !== 'ON_TARGET');

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Board tone={over ? 'warning' : 'success'} wash="top">
          <Board.Header title={tp('hubMaterials')} />
          <Board.Body className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Figure size="sm" value={rows.length} label={tp('hubMaterials')} />
              <Figure size="sm" value={over} label={tp('usageOver')} tone={over ? 'warning' : 'success'} />
            </div>
            {assigned > 0 ? <Meter value={Math.min(used, assigned)} max={assigned} label={tp('usageUsed')} valueLabel={`${Math.round((used / assigned) * 100)}%`} tone={used > assigned ? 'error' : 'brand'} /> : null}
            {unused.length ? (
              <Ledger>
                {unused.slice(0, 5).map((r) => (
                  <LedgerRow
                    key={r.inventoryItemId}
                    label={localizedName(copy.locale, r, r.sku)}
                    value={
                      <Button size="sm" variant="secondary" onClick={() => (setReturning(r), setQty(Math.max(0, Number(r.assignedQty) - Number(r.usedQty) - Number(r.returnedQty))), setWarehouseId(r.tasks?.[0]?.returnWarehouse?.id ?? r.tasks?.[0]?.issueWarehouse?.id ?? null))}>
                        {tp('returnUnused')}
                      </Button>
                    }
                    hint={`${Math.max(0, Number(r.assignedQty) - Number(r.usedQty) - Number(r.returnedQty))} ${r.unit}`}
                    tone="warning"
                    stamp
                  />
                ))}
              </Ledger>
            ) : null}
          </Board.Body>
        </Board>
        <ProductionMaterialsPanel materials={rows} />
      </div>

      <Sheet
        open={Boolean(returning)}
        onClose={() => setReturning(null)}
        title={tp('returnUnused')}
        description={returning ? localizedName(copy.locale, returning, returning.sku) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReturning(null)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={ctl.returnMaterial.isPending} disabled={!qty || qty <= 0} onClick={() => returning && qty && ctl.returnMaterial.mutate({ inventoryItemId: returning.inventoryItemId, quantity: qty, warehouseId: warehouseId ?? undefined }, { onSuccess: () => setReturning(null) })}>
              {tCommon('confirm')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <NumberField label={tCommon('quantity')} unit={returning?.unit} value={qty} onChange={setQty} min={0} decimals={3} />
          <Combobox label={tCommon('warehouse')} value={warehouseId} onChange={setWarehouseId} options={(ctl.queries.warehouses.data ?? []).map((w) => ({ value: w.id, label: localizedName(copy.locale, w, w.code), description: w.code }))} placeholder={tCommon('select')} emptyText={kit.combobox.empty} clearLabel={kit.combobox.clear} />
        </div>
      </Sheet>
    </div>
  );
}

/* ── Workflow: assign (mobile-only) + graph ──────────────────────────────── */

function WorkflowTab({ ctl }: { ctl: ProductionOrderCtl }) {
  const copy = useProductionCopy();
  const tp = useTranslations('production');
  const tc = useTranslations('catalog');
  const kit = useKitCopy();
  const order = ctl.order!;
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const workflows = useQuery({ queryKey: ['production-workflows'], queryFn: () => apiFetch<Array<{ id: string; code: string; nameEn: string; nameAr: string; nameHe?: string | null }>>('/api/v1/production-workflows') });
  const canAssign = PRE_START.has(order.status);
  return (
    <div className="space-y-5">
      {canAssign ? (
        <Board tone="info">
          <Board.Header title={tp('workflow.title')} description={tp('workflow.subtitle')} actions={<Button size="sm" disabled={!workflowId} loading={ctl.assignWorkflow.isPending} onClick={() => workflowId && ctl.assignWorkflow.mutate(workflowId)}>{tc('assign')}</Button>} />
          <Board.Body>
            <Combobox label={tp('workflow.title')} value={workflowId} onChange={setWorkflowId} options={(workflows.data ?? []).map((w) => ({ value: w.id, label: localizedName(copy.locale, w, w.code), description: w.code }))} placeholder={tc('select')} emptyText={kit.combobox.empty} clearLabel={kit.combobox.clear} />
          </Board.Body>
        </Board>
      ) : null}
      <OrderWorkflowSection productionOrderId={ctl.id} />
    </div>
  );
}

/* ── Schedule ────────────────────────────────────────────────────────────── */

function ScheduleTab({ ctl }: { ctl: ProductionOrderCtl }) {
  const copy = useProductionCopy();
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const q = ctl.queries.schedule;
  const s = q.data?.schedule;
  if (q.isLoading) return <BoardSkeleton rows={4} />;
  if (q.isError || !s) {
    return (
      <Board tone="neutral">
        <Board.Empty title={tp('schedulingUnavailable')} description={tp('schedulingNotAvailableForOrder')} action={<Button variant="secondary" size="sm" onClick={() => q.refetch()}>{tCommon('retry')}</Button>} />
      </Board>
    );
  }
  const tone: BoardTone = s.status === 'APPROVED' || s.status === 'COMMITTED' ? 'success' : s.status === 'NEEDS_REVIEW' ? 'warning' : 'info';
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <Board tone={tone} wash="top">
        <Board.Header
          title={tp('schedulingSection')}
          description={tp('schedulingSectionHint')}
          meta={
            <span className="flex flex-wrap gap-1.5">
              <Stamp tone={tone} size="sm">{copy.status(s.status)}</Stamp>
              <Stamp tone="neutral" size="sm">{copy.status(s.promiseState)}</Stamp>
              {s.materialRisk ? <Stamp tone="warning" size="sm">{tp('materialRisk')}</Stamp> : null}
            </span>
          }
        />
        <Board.Body className="space-y-4">
          <KeyFacts
            columns={2}
            facts={[
              { label: tp('requestedDate'), value: copy.date(s.requestedDeliveryDate), ltr: true },
              { label: tp('suggestedDate'), value: copy.date(s.suggestedDeliveryDate), ltr: true },
              { label: tp('committedDate'), value: copy.date(s.committedDeliveryDate ?? s.committedCompletionDate), ltr: true },
              { label: tp('earliestDate'), value: copy.date(s.earliestAvailableDate), ltr: true },
              { label: tp('version'), value: String(s.version), ltr: true },
            ]}
          />
        </Board.Body>
        <Board.Footer>
          <span className="text-[12px] text-[var(--maher-text-tertiary)]">{s.reason ?? ''}</span>
          <span className="flex gap-2">
            <Button size="sm" variant="secondary" leadingIcon={<RefreshCw className="h-3.5 w-3.5" />} loading={ctl.scheduleRecalculate.isPending} onClick={() => ctl.scheduleRecalculate.mutate()}>
              {tp('recalculate')}
            </Button>
            {s.status === 'PROPOSED' || s.status === 'NEEDS_REVIEW' ? (
              <Button size="sm" loading={ctl.scheduleApprove.isPending} onClick={() => ctl.scheduleApprove.mutate()}>
                {tp('approve')}
              </Button>
            ) : null}
          </span>
        </Board.Footer>
      </Board>
      <Board tone="neutral">
        <Board.Header title={tp('allocationsTimeline')} meta={s.allocations?.length ? <Stamp tone="neutral" size="sm">{s.allocations.length}</Stamp> : null} />
        {!s.allocations?.length ? (
          <Board.Empty title={tp('noAllocations')} />
        ) : (
          <ul className="divide-y divide-[var(--maher-border)]">
            {s.allocations.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-[var(--maher-text-primary)]">{a.task?.name || '—'}</span>
                  <span className="block truncate text-[12px] text-[var(--maher-text-secondary)]">{allocationPersonLabel(copy.locale, a)}</span>
                </span>
                <span className="flex items-center gap-3 text-[12px] text-[var(--maher-text-secondary)]" dir="ltr">
                  <span>
                    {fmtTime(a.plannedStart, copy.locale)} – {fmtTime(a.plannedEnd, copy.locale)}
                  </span>
                  <Stamp tone="neutral" size="sm">{`${a.estimatedMinutes}m`}</Stamp>
                  <Button size="sm" variant="ghost" aria-label={a.isPinned ? tp('unpin') : tp('pin')} disabled={ctl.schedulePin.isPending && ctl.schedulePin.variables?.allocationId === a.id} onClick={() => ctl.schedulePin.mutate({ allocationId: a.id, pin: !a.isPinned })} className={a.isPinned ? 'text-[var(--maher-brand)]' : ''}>
                    {a.isPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Board>
      <Ltr className="hidden">{s.id}</Ltr>
    </div>
  );
}
