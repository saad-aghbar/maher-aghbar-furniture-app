'use client';

import { apiFetch } from '@/lib/api-client';
import { addDaysYmd, calendarShiftForYmd, formatDuration, localIso, todayYmd, ymdOf, type CalendarMeta } from '@/lib/assign-window';
import { useKitCopy } from '@/lib/kit-copy';
import { buildDayPickTimeline, buildWorkerDayPlan, formatHm, localDayBounds, type WorkerDayTimelineBlock } from '@/lib/worker-day-plan';
import { localizedName } from '@maher/i18n';
import { Button, DateField, Meter, NumberField, SegmentedControl, Sheet, Stamp, cn, type BoardTone, type DayMeta } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

export interface AssignSheetTask {
  id: string;
  name?: string | null;
  status: string;
  priority?: string | null;
  plannedStart?: string | null;
  plannedCompletion?: string | null;
  estimatedMinutes?: number | null;
  assignedEmployee?: { id: string; firstName?: string; lastName?: string; name?: string } | null;
}

export interface AssignSheetStage {
  id?: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  /** Quality gates carry no stage time. */
  gate?: boolean;
}

export interface AssignPayload {
  taskId: string;
  employeeId: string;
  priority: string;
  plannedStart: string;
  plannedCompletion: string;
  estimatedMinutes?: number;
}

interface AssignableWorkerRow {
  id: string;
  firstName: string;
  lastName: string;
  activeTaskCount?: number;
  recommendBand?: string;
  recommendReason?: string | null;
  recommendReasonCode?: string | null;
  overlapWindows?: Array<{ start: string; end: string; label: string }>;
  dayWindows?: Array<{ start: string; end: string; label: string; salesOrderNumber?: string | null; stage?: string | null; kind?: 'work' | 'stopped' }>;
  suggestedWindow?: { plannedStart: string; plannedCompletion: string };
}

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

function bandTone(b?: string): BoardTone {
  if (b === 'best' || b === 'good' || b === 'recommended' || b === 'available') return 'success';
  if (b === 'busy' || b === 'overloaded') return 'warning';
  if (b === 'conflict') return 'error';
  return 'neutral';
}

/**
 * StageAssignSheet — port of mobile ProductionTaskSheet + WorkerDayBoard.
 * Pick a worker, pick a day, tap a free slot sized to the stage estimate.
 * Used from the orders-side "Prepare for production" board and the factory hub.
 */
export function StageAssignSheet({
  open,
  onClose,
  stage,
  task,
  onAssign,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  stage: AssignSheetStage;
  task: AssignSheetTask;
  onAssign: (payload: AssignPayload) => void;
  busy?: boolean;
}) {
  const locale = useLocale();
  const tm = useTranslations('mobile.production');
  const tp = useTranslations('production');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const kit = useKitCopy();
  const gate = Boolean(stage.gate);

  const [employeeId, setEmployeeId] = useState<string | null>(task.assignedEmployee?.id ?? null);
  const [priority, setPriority] = useState<string>(task.priority || 'NORMAL');
  const [day, setDay] = useState<string>(ymdOf(task.plannedStart) ?? todayYmd());
  const [estimate, setEstimate] = useState<number | null>(task.estimatedMinutes ?? null);
  const [window, setWindow] = useState<{ startMs: number; endMs: number } | null>(() =>
    task.plannedStart && task.plannedCompletion ? { startMs: new Date(task.plannedStart).getTime(), endMs: new Date(task.plannedCompletion).getTime() } : null,
  );

  useEffect(() => {
    if (!open) return;
    setEmployeeId(task.assignedEmployee?.id ?? null);
    setPriority(task.priority || 'NORMAL');
    setDay(ymdOf(task.plannedStart) ?? todayYmd());
    setEstimate(task.estimatedMinutes ?? null);
    setWindow(task.plannedStart && task.plannedCompletion ? { startMs: new Date(task.plannedStart).getTime(), endMs: new Date(task.plannedCompletion).getTime() } : null);
  }, [open, task]);

  const durationMinutes = gate ? 0 : (estimate ?? task.estimatedMinutes ?? 0);

  // Factory calendar → shift hours + working days for the picker.
  const calendar = useQuery({
    queryKey: ['scheduling-calendar-window', day],
    enabled: open,
    staleTime: 60_000,
    queryFn: () => apiFetch<{ calendar?: CalendarMeta; days?: Array<{ date: string; isWorking: boolean; loadPercent?: number | null }> }>(`/api/v1/scheduling/calendar?${new URLSearchParams({ from: addDaysYmd(day, -7), to: addDaysYmd(day, 21), view: 'week' })}`),
  });
  const shift = calendarShiftForYmd(day, calendar.data?.calendar ?? null);
  const bounds = localDayBounds(day, shift.startHour, shift.endHour, shift.startMinute, shift.endMinute);
  const dayMeta = useMemo(() => {
    const out: Record<string, DayMeta> = {};
    for (const d of calendar.data?.days ?? []) {
      const key = d.date.slice(0, 10);
      const load = d.loadPercent ?? 0;
      out[key] = d.isWorking ? { loadPercent: d.loadPercent ?? null, tone: load >= 90 ? 'busy' : load >= 50 ? 'half' : load > 0 ? 'light' : 'available' } : { disabled: true, tone: 'closed' };
    }
    return out;
  }, [calendar.data?.days]);

  // Workers: the API scores each against the chosen day window and returns their busy blocks that day.
  const dayStartIso = bounds ? new Date(bounds.dayStartMs).toISOString() : null;
  const dayEndIso = bounds ? new Date(bounds.dayEndMs).toISOString() : null;
  const workers = useQuery({
    queryKey: ['assignable-workers', stage.id ?? stage.code, task.id, day, dayStartIso],
    enabled: open && Boolean(dayStartIso && dayEndIso),
    queryFn: () =>
      apiFetch<AssignableWorkerRow[]>(
        `/api/v1/production-orders/assignable-workers?${new URLSearchParams({
          ...(stage.id ? { stageDefinitionId: stage.id } : {}),
          taskId: task.id,
          plannedStart: window ? new Date(window.startMs).toISOString() : dayStartIso!,
          plannedCompletion: window ? new Date(window.endMs).toISOString() : dayEndIso!,
        })}`,
      ),
  });
  const worker = (workers.data ?? []).find((w) => w.id === employeeId) ?? null;

  const plan = useMemo(() => {
    if (!bounds) return null;
    const source = worker?.dayWindows ?? worker?.overlapWindows ?? [];
    return buildWorkerDayPlan({
      dayStartMs: bounds.dayStartMs,
      dayEndMs: bounds.dayEndMs,
      busy: source.map((w) => ({
        startMs: new Date(w.start).getTime(),
        endMs: new Date(w.end).getTime(),
        label: w.label,
        salesOrderNumber: (w as { salesOrderNumber?: string | null }).salesOrderNumber ?? null,
        stage: (w as { stage?: string | null }).stage ?? null,
        kind: (w as { kind?: 'work' | 'stopped' }).kind === 'stopped' ? 'stopped' : 'work',
      })),
      proposed: window,
    });
  }, [bounds, worker, window]);
  // Tap targets are at least 30 min wide; the picked window is then trimmed to the stage estimate.
  const slotMinutes = Math.max(30, durationMinutes || 0);
  const timeline = useMemo(() => (plan ? buildDayPickTimeline(plan, slotMinutes) : []), [plan, slotMinutes]);
  const proposedBlock = plan?.blocks.find((b): b is Extract<WorkerDayTimelineBlock, { kind: 'proposed' }> => b.kind === 'proposed') ?? null;
  const conflicts = Boolean(proposedBlock?.conflicts);
  const windowOnDay = window ? ymdOf(new Date(window.startMs).toISOString()) === day : false;

  const changeDay = (next: string) => {
    setDay(next);
    setWindow(null);
  };
  const pickSlot = (startMs: number, endMs: number) => {
    const need = Math.max(1, durationMinutes || slotMinutes) * 60_000;
    const span = endMs - startMs;
    setWindow({ startMs, endMs: span >= need ? startMs + need : endMs });
  };

  const canConfirm = Boolean(employeeId && window && (gate || durationMinutes > 0) && !conflicts);
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00`));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={task.assignedEmployee ? tm('reassignWorker') : tm('assignWorker')}
      description={`${localizedName(locale, stage, stage.code)}${task.name ? ` · ${task.name}` : ''}`}
      widthClassName="max-w-2xl"
      closeLabel={tCommon('close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {tCommon('cancel')}
          </Button>
          <Button
            loading={busy}
            disabled={!canConfirm}
            onClick={() => {
              if (!employeeId || !window) return;
              onAssign({
                taskId: task.id,
                employeeId,
                priority,
                plannedStart: new Date(window.startMs).toISOString(),
                plannedCompletion: new Date(window.endMs).toISOString(),
                estimatedMinutes: gate ? 0 : (estimate ?? undefined),
              });
            }}
          >
            {conflicts ? tm('fixWindowThenAssign') : tm('confirmAssign')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Stage time + priority */}
        <div className="grid gap-4 sm:grid-cols-2">
          {!gate ? (
            <NumberField label={tc('estMinutes')} unit={tc('minutesUnit')} value={estimate} onChange={setEstimate} min={0} hint={estimate == null || estimate <= 0 ? tp('stageTimeRequiredHint') : formatDuration(estimate)} />
          ) : null}
          <div className={gate ? 'sm:col-span-2' : ''}>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tc('priority')}</span>
            <SegmentedControl size="sm" aria-label={tc('priority')} value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p, label: tm(`priority.${p}` as never) }))} />
          </div>
        </div>

        {/* Worker */}
        <section>
          <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tc('worker')}</span>
          {workers.isLoading ? (
            <p className="text-[13px] text-[var(--maher-text-tertiary)]">{tm('loadingWorkers')}</p>
          ) : (workers.data ?? []).length === 0 ? (
            <p className="text-[13px] text-[var(--maher-text-tertiary)]">{tm('noWorkers')}</p>
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
              {(workers.data ?? []).map((w) => {
                const selected = employeeId === w.id;
                const busyMin = (w.dayWindows ?? []).filter((b) => b.kind !== 'stopped').reduce((s, b) => s + Math.max(0, (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000), 0);
                const cap = plan?.capacityMinutes ?? 480;
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => setEmployeeId(w.id)}
                      aria-pressed={selected}
                      className={cn('maher-press flex w-full flex-col gap-1.5 rounded-[12px] border px-3.5 py-3 text-start transition-colors', selected ? 'border-[var(--maher-brand)] bg-[var(--maher-brand-soft)]' : 'border-[var(--maher-border)] hover:border-[var(--maher-border-strong)]')}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-[14px] font-semibold text-[var(--maher-text-primary)]">{`${w.firstName} ${w.lastName}`.trim()}</span>
                        {w.recommendBand ? (
                          <Stamp tone={bandTone(w.recommendBand)} size="sm">
                            {w.recommendBand}
                          </Stamp>
                        ) : null}
                      </span>
                      <Meter value={Math.min(busyMin, cap)} max={cap} size="sm" tone={busyMin >= cap ? 'error' : busyMin > cap * 0.75 ? 'warning' : 'success'} showValue={false} />
                      <span className="flex w-full items-center justify-between text-[11px] text-[var(--maher-text-tertiary)]">
                        <span className="truncate">{w.recommendReason ?? tm('activeTasks', { count: w.activeTaskCount ?? 0 })}</span>
                        <span className="tabular-nums" dir="ltr">
                          {formatDuration(busyMin)} / {formatDuration(cap)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Day + slots */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <DateField label={tp('assignDay')} value={day} onChange={changeDay} copy={kit.date} locale={locale} minDate={todayYmd()} dayMeta={dayMeta} variant="admin" todayShortcut className="min-w-[220px] flex-1" />
            <div className="flex gap-1.5 pb-0.5">
              <Button size="sm" variant="secondary" aria-label={tm('workerDayPrevDay')} onClick={() => changeDay(addDaysYmd(day, -1))} disabled={day <= todayYmd()}>
                <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
              </Button>
              <Button size="sm" variant="secondary" aria-label={tm('workerDayNextDay')} onClick={() => changeDay(addDaysYmd(day, 1))}>
                <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
              </Button>
            </div>
          </div>

          {worker && plan ? (
            <div className="rounded-[14px] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] p-3.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="m-0 truncate text-[13px] font-semibold text-[var(--maher-text-primary)]">
                    {`${worker.firstName} ${worker.lastName}`.trim()} · {dayLabel}
                  </p>
                  <p className="m-0 text-[12px] text-[var(--maher-text-tertiary)]">
                    {tm('workerDaySummary', { capacity: formatDuration(plan.capacityMinutes), planned: formatDuration(plan.plannedMinutes), available: formatDuration(plan.availableMinutes), tasks: plan.taskCount })}
                  </p>
                </div>
                <Stamp tone={plan.overCapacity ? 'error' : plan.loadPercent > 75 ? 'warning' : 'success'} size="sm">
                  {plan.overCapacity ? tm('workerDayOverload', { pct: Math.round(plan.loadPercent - 100) }) : `${Math.round(plan.loadPercent)}%`}
                </Stamp>
              </div>
              <Meter value={Math.min(plan.plannedMinutes, plan.capacityMinutes)} max={plan.capacityMinutes} size="sm" tone={plan.overCapacity ? 'error' : 'info'} showValue={false} />

              <p className="mb-1.5 mt-3 text-[12px] text-[var(--maher-text-secondary)]">{tm('workerDayTapHint')}</p>
              <ol className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
                {timeline.map((b, i) => {
                  const range = `${formatHm(b.startMs)}–${formatHm(b.endMs)}`;
                  if (b.kind === 'busy') {
                    return (
                      <li key={`b-${i}`} className="flex items-center justify-between gap-2 rounded-[10px] bg-[var(--maher-surface)] px-3 py-2 text-[12px]">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-[var(--maher-text-primary)]">{b.label}</span>
                          <span className="block text-[var(--maher-text-tertiary)]">{tm('conflictBusyWork')}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-[var(--maher-text-secondary)]" dir="ltr">
                          {range}
                        </span>
                      </li>
                    );
                  }
                  if (b.kind === 'stopped') {
                    return (
                      <li key={`s-${i}`} className="flex items-center justify-between gap-2 rounded-[10px] border border-dashed border-[var(--maher-border)] px-3 py-2 text-[12px] text-[var(--maher-text-tertiary)]">
                        <span>{tm('workerDayStopped', { start: formatHm(b.startMs), end: formatHm(b.endMs) })}</span>
                      </li>
                    );
                  }
                  const selected = window && windowOnDay && window.startMs === b.startMs;
                  const tooShort = durationMinutes > 0 && b.durationMinutes < durationMinutes;
                  return (
                    <li key={`a-${i}`}>
                      <button
                        type="button"
                        onClick={() => pickSlot(b.startMs, b.endMs)}
                        aria-pressed={Boolean(selected)}
                        className={cn(
                          'maher-press flex w-full items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-start text-[12px] transition-colors',
                          selected ? 'border-[var(--maher-brand)] bg-[var(--maher-brand-soft)] text-[var(--maher-text-primary)]' : 'border-[var(--maher-success)]/40 bg-[var(--maher-success-soft)] text-[var(--maher-text-primary)] hover:border-[var(--maher-success)]',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block font-medium">{selected ? tm('workerDayProposed') : tm('workerDayAvailable')}</span>
                          {tooShort ? <span className="block text-[var(--maher-warning)]">{tm('workerDaySlotTooShort')}</span> : null}
                        </span>
                        <span className="shrink-0 tabular-nums" dir="ltr">
                          {range}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              {conflicts && proposedBlock ? (
                <p className="m-0 mt-2 text-[12px] text-[var(--maher-error)]">
                  {tm('workerDayProposedConflict')} · {formatHm(proposedBlock.startMs)}–{formatHm(proposedBlock.endMs)}
                </p>
              ) : window && windowOnDay ? (
                <p className="m-0 mt-2 text-[12px] text-[var(--maher-text-secondary)]">
                  {tm('plannedWindowLabel')}: <span className="tabular-nums" dir="ltr">{formatHm(window.startMs)}–{formatHm(window.endMs)}</span> · {formatDuration((window.endMs - window.startMs) / 60_000)}
                </p>
              ) : null}
              {worker.suggestedWindow && !window ? (
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => setWindow({ startMs: new Date(worker.suggestedWindow!.plannedStart).getTime(), endMs: new Date(worker.suggestedWindow!.plannedCompletion).getTime() })}>
                  {tm('suggestedWindow')}
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-[12px] text-[var(--maher-text-tertiary)]">{tm('viewWorkerDay')}</p>
          )}
        </section>
      </div>
    </Sheet>
  );
}
