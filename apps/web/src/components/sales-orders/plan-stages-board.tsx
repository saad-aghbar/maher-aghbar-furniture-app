'use client';

import { StageAssignSheet, type AssignPayload } from '@/components/production/stage-assign-sheet';
import { isQualityGateStageCode } from '@/lib/workflow-terminal';
import type { ProductionDetail, Stage, Task } from '@/components/production/production-hub/use-production-order';
import { LOCKED_STAGE, LOCKED_TASK } from '@/components/production/production-hub/use-production-order';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch, type OrderSetupLine } from '@/lib/api-client';
import { formatDuration } from '@/lib/assign-window';
import { localizedName } from '@maher/i18n';
import { Board, BoardSkeleton, Button, Ltr, Stamp, useToast, type BoardTone } from '@maher/ui';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

interface EnsurePlanResult {
  salesOrderId: string;
  productionOrderIds: string[];
  primaryProductionOrderId: string | null;
  created: boolean;
}

function taskTone(status: string): BoardTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'BLOCKED') return 'error';
  if (status === 'PAUSED' || status === 'READY_FOR_INSPECTION') return 'warning';
  return 'neutral';
}

/**
 * Orders-side "Stages & people": one board per factory order created for this
 * sales order, every stage with its worker, and the shared day-slot assign
 * sheet. Draft factory orders are created on demand via `ensure-plan`, so the
 * team can staff the plan before release.
 */
export function PlanStagesBoard({ salesOrderId, lines, released }: { salesOrderId: string; lines: OrderSetupLine[]; released: boolean }) {
  const t = useTranslations('sales');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const toast = useToast();
  const qc = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [assignFor, setAssignFor] = useState<{ poId: string; stage: Stage; task: Task } | null>(null);

  const hasWorkflow = lines.some((l) => l.workflowId);
  const enabled = released || opened;

  const plan = useQuery({
    queryKey: ['plan-orders', salesOrderId],
    enabled,
    queryFn: () => apiFetch<EnsurePlanResult>(`/api/v1/sales-orders/${salesOrderId}/production-setup/ensure-plan`, { method: 'POST' }),
    staleTime: 30_000,
  });
  const ids = plan.data?.productionOrderIds ?? [];
  const orders = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['production-order', id],
      queryFn: () => apiFetch<ProductionDetail>(`/api/v1/production-orders/${id}`),
    })),
  });

  const assign = useMutation({
    mutationFn: (payload: AssignPayload) =>
      apiFetch(`/api/v1/tasks/${payload.taskId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: payload.employeeId,
          priority: payload.priority,
          plannedStart: payload.plannedStart,
          plannedCompletion: payload.plannedCompletion,
          ...(payload.estimatedMinutes != null ? { estimatedMinutes: payload.estimatedMinutes } : {}),
        }),
      }),
    onSuccess: async () => {
      toast.success(t('orderSetup.workerAssigned'));
      setAssignFor(null);
      await Promise.all([
        ...ids.map((id) => qc.invalidateQueries({ queryKey: ['production-order', id] })),
        qc.invalidateQueries({ queryKey: ['assignable-workers'] }),
        qc.invalidateQueries({ queryKey: ['production-orders'] }),
        qc.invalidateQueries({ queryKey: ['order-production-setup', salesOrderId] }),
      ]);
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const totals = orders.reduce(
    (acc, q) => {
      for (const s of q.data?.stages ?? []) {
        const task = s.tasks[0];
        if (!task) continue;
        acc.total += 1;
        if (task.assignedEmployee) acc.assigned += 1;
      }
      return acc;
    },
    { total: 0, assigned: 0 },
  );

  return (
    <Board tone={enabled && totals.total > 0 && totals.assigned === totals.total ? 'success' : 'info'}>
      <Board.Header
        title={t('orderSetup.stagesPeople')}
        description={t('orderSetup.stagesPeopleHint')}
        meta={enabled && totals.total ? <span className="tabular-nums">{`${totals.assigned}/${totals.total}`}</span> : undefined}
        actions={
          enabled && ids.length ? (
            <Link href={`/admin/production/${plan.data?.primaryProductionOrderId ?? ids[0]}`} className="maher-press inline-flex h-8 items-center rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3 text-[13px] font-medium text-[var(--maher-text-primary)] hover:border-[var(--maher-border-strong)]">
              {t('orderSetup.openFactoryFloor')}
            </Link>
          ) : null
        }
      />
      <Board.Body padding={enabled && ids.length ? 'none' : undefined}>
        {!enabled ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-[13px] text-[var(--maher-text-secondary)]">{hasWorkflow ? t('orderSetup.planStagesHint') : t('orderSetup.noStagesYet')}</p>
            <Button size="sm" disabled={!hasWorkflow} onClick={() => setOpened(true)} leadingIcon={<UserPlus className="h-4 w-4" />}>
              {t('orderSetup.planStages')}
            </Button>
          </div>
        ) : plan.isLoading || orders.some((q) => q.isLoading) ? (
          <BoardSkeleton rows={4} header={false} className="border-0 shadow-none" />
        ) : plan.isError ? (
          <p className="m-0 text-[13px] text-[var(--maher-error)]">{mutationErrorMessage(plan.error)}</p>
        ) : (
          <div className="divide-y divide-[var(--maher-border)]">
            {orders.map((q, idx) => {
              const po = q.data;
              if (!po) return null;
              const line = lines.find((l) => l.salesOrderLineId === po.salesOrderLineId) ?? lines[idx] ?? null;
              return (
                <section key={po.id} className="px-5 py-4">
                  <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[14px] font-semibold text-[var(--maher-text-primary)]">
                        {line?.itemNumber ? <Ltr className="me-2 text-[12px] font-medium text-[var(--maher-text-tertiary)]">{line.itemNumber}</Ltr> : null}
                        {po.productDescription}
                      </p>
                      <p className="m-0 text-[12px] text-[var(--maher-text-tertiary)]">
                        <Ltr>{po.number}</Ltr> · × {String(po.quantity ?? line?.quantity ?? 1)}
                      </p>
                    </div>
                    <Stamp tone={taskTone(po.status)} size="sm">
                      {tStatus(po.status as never)}
                    </Stamp>
                  </header>
                  {po.stages.length === 0 ? (
                    <p className="m-0 text-[13px] text-[var(--maher-text-tertiary)]">{t('orderSetup.noStagesYet')}</p>
                  ) : (
                    <ol className="m-0 list-none space-y-1.5 p-0">
                      {po.stages.map((stage, i) => {
                        const task = stage.tasks[0];
                        const gate = isQualityGateStageCode(stage.stageDefinition.code);
                        const assignable = task && !LOCKED_STAGE.has(stage.status) && !LOCKED_TASK.has(task.status) && po.status !== 'COMPLETED' && po.status !== 'CANCELLED';
                        const workerName = task?.assignedEmployee ? `${task.assignedEmployee.firstName ?? ''} ${task.assignedEmployee.lastName ?? ''}`.trim() : null;
                        return (
                          <li key={stage.id} className="flex items-center gap-3 rounded-[10px] bg-[var(--maher-surface-muted)] px-3 py-2">
                            <span className="w-5 shrink-0 text-center text-[12px] tabular-nums text-[var(--maher-text-tertiary)]">{i + 1}</span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-[13px] font-medium text-[var(--maher-text-primary)]">{localizedName(locale, stage.stageDefinition)}</span>
                                {task ? (
                                  <Stamp tone={taskTone(task.status)} size="sm">
                                    {tStatus(task.status as never)}
                                  </Stamp>
                                ) : null}
                              </span>
                              <span className="block truncate text-[12px] text-[var(--maher-text-secondary)]">
                                {workerName ?? t('orderSetup.unassigned')}
                                {task?.estimatedMinutes && !gate ? ` · ${formatDuration(task.estimatedMinutes)}` : ''}
                                {task?.plannedStart ? ` · ${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(task.plannedStart))}` : ''}
                              </span>
                            </span>
                            {assignable && task ? (
                              <Button size="sm" variant={task.assignedEmployee ? 'ghost' : 'secondary'} onClick={() => setAssignFor({ poId: po.id, stage, task })}>
                                {task.assignedEmployee ? t('orderSetup.reassign') : t('orderSetup.assign')}
                              </Button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Board.Body>

      {assignFor ? (
        <StageAssignSheet
          open
          onClose={() => setAssignFor(null)}
          stage={{ ...assignFor.stage.stageDefinition, gate: isQualityGateStageCode(assignFor.stage.stageDefinition.code) }}
          task={assignFor.task}
          busy={assign.isPending}
          onAssign={(payload) => assign.mutate(payload)}
        />
      ) : null}
    </Board>
  );
}
