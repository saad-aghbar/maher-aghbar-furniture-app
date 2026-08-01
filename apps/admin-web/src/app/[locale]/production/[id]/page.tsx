'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { PRIORITY_STATUSES, statusOptions } from '@/lib/status-options';
import {
  Alert,
  Button,
  ErrorState,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextArea,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { localizedName } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useRef, useState } from 'react';

interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  roles?: Array<{ role: { code: string } }>;
}

interface Task {
  id: string;
  number: string;
  name: string;
  status: string;
  priority: string;
  progressPercent: number;
  notes?: string | null;
  assignedEmployee?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
  } | null;
}

interface Stage {
  id: string;
  status: string;
  progressPercent: number;
  stageDefinition: {
    code: string;
    nameEn: string;
    nameAr: string;
    sortOrder: number;
    dependsOnCodes: string[];
    responsibleDepartment?: string | null;
  };
  tasks: Task[];
}

interface ProductionDetail {
  id: string;
  number: string;
  productDescription: string;
  status: string;
  progressPercent: number;
  priority?: string;
  plannedStartDate?: string | null;
  plannedCompletionDate?: string | null;
  currentStageCode?: string | null;
  salesOrder?: { id: string; number: string } | null;
  stages: Stage[];
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function ProductionDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tc = useTranslations('catalog');
  const tp = useTranslations('production');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const qc = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmStart, setConfirmStart] = useState(false);
  const [drafts, setDrafts] = useState<
    Record<string, { employeeId: string; priority: string }>
  >({});
  const [planPriority, setPlanPriority] = useState('NORMAL');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [holdTaskId, setHoldTaskId] = useState<string | null>(null);
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const photoRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const priorityOpts = statusOptions(tStatus, PRIORITY_STATUSES);

  const detailQuery = useQuery({
    queryKey: ['production-order', params.id],
    queryFn: async () => {
      const order = await apiFetch<ProductionDetail>(`/api/v1/production-orders/${params.id}`);
      setPlanPriority(order.priority ?? 'NORMAL');
      setPlannedStart(toDateInput(order.plannedStartDate));
      setPlannedEnd(toDateInput(order.plannedCompletionDate));
      return order;
    },
  });

  const workersQuery = useQuery({
    queryKey: ['workers-for-assign'],
    queryFn: () =>
      apiFetch<{ data: Worker[] }>('/api/v1/users?pageSize=100').then((r) => r.data),
  });

  const workers = useMemo(() => {
    const all = workersQuery.data ?? [];
    const production = all.filter((u) =>
      u.roles?.some((r) =>
        [
          'PRODUCTION_WORKER',
          'PRODUCTION_SUPERVISOR',
          'QUALITY_INSPECTOR',
          'DELIVERY_EMPLOYEE',
        ].includes(r.role.code),
      ),
    );
    return production.length ? production : all.filter((u) => !u.email?.includes('customer'));
  }, [workersQuery.data]);

  const startMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/production-orders/${params.id}/start`, { method: 'POST' }),
    onSuccess: async () => {
      setError(null);
      setConfirmStart(false);
      setBanner(tc('productionStarted'));
      await qc.invalidateQueries({ queryKey: ['production-order', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const planMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/production-orders/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          priority: planPriority,
          plannedStartDate: plannedStart || undefined,
          plannedCompletionDate: plannedEnd || undefined,
          estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
        }),
      }),
    onSuccess: async () => {
      setError(null);
      setBanner(tp('planningSaved'));
      await qc.invalidateQueries({ queryKey: ['production-order', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const assignMutation = useMutation({
    mutationFn: (args: { taskId: string; employeeId: string; priority: string }) =>
      apiFetch(`/api/v1/tasks/${args.taskId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: args.employeeId,
          priority: args.priority,
        }),
      }),
    onSuccess: async () => {
      setError(null);
      setBanner(tp('workerAssigned'));
      await qc.invalidateQueries({ queryKey: ['production-order', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const taskActionMutation = useMutation({
    mutationFn: async (args: {
      taskId: string;
      action: 'pause' | 'block' | 'notes';
      reason?: string;
      notes?: string;
    }) => {
      if (args.action === 'notes') {
        return apiFetch(`/api/v1/tasks/${args.taskId}/notes`, {
          method: 'PATCH',
          body: JSON.stringify({ notes: args.notes ?? '' }),
        });
      }
      if (args.action === 'block') {
        return apiFetch(`/api/v1/tasks/${args.taskId}/block`, {
          method: 'POST',
          body: JSON.stringify({ category: 'OTHER', reason: args.reason ?? 'On hold' }),
        });
      }
      return apiFetch(`/api/v1/tasks/${args.taskId}/pause`, { method: 'POST' });
    },
    onSuccess: async () => {
      setError(null);
      setHoldTaskId(null);
      setBanner(tp('taskUpdated'));
      await qc.invalidateQueries({ queryKey: ['production-order', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  async function uploadTaskPhoto(taskId: string, productionOrderId: string) {
    const input = photoRefs.current[taskId];
    const file = input?.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const qs = new URLSearchParams({ taskId, productionOrderId });
      const res = await fetch(`${API}/api/v1/uploads?${qs}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error(tCommon('uploadFailed'));
      setBanner(tc('documentUploaded'));
      if (input) input.value = '';
      await qc.invalidateQueries({ queryKey: ['production-order', params.id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('uploadFailed'));
    }
  }

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title={t('production')}
        onRetry={() => detailQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const order = detailQuery.data;
  const canStart = ['DRAFT', 'PLANNED', 'READY', 'WAITING_FOR_MATERIALS'].includes(order.status);

  function draftFor(task: Task) {
    return (
      drafts[task.id] ?? {
        employeeId: task.assignedEmployee?.id ?? '',
        priority: task.priority || 'NORMAL',
      }
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.number}
        description={order.productDescription}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/production">
              <Button variant="secondary">{tCommon('back')}</Button>
            </Link>
            {canStart ? (
              <Button
                onClick={() => {
                  setError(null);
                  setConfirmStart(true);
                }}
              >
                {tc('startProduction')}
              </Button>
            ) : null}
          </div>
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error && !confirmStart ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
        <StatusBadge status={order.status} />
        <span>
          {tc('progress')}{' '}
          <span dir="ltr">{order.progressPercent}%</span>
        </span>
        <span>
          {tc('current')}: {order.currentStageCode ?? '—'}
        </span>
        {order.salesOrder ? (
          <span>
            {tc('salesOrder')} {order.salesOrder.number}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-[var(--maher-radius-md)] border border-border p-4 sm:grid-cols-4">
        <Select
          label={tc('priority')}
          value={planPriority}
          onChange={(e) => setPlanPriority(e.target.value)}
          options={priorityOpts}
        />
        <Input
          label={tc('plannedStart')}
          type="date"
          value={plannedStart}
          onChange={(e) => setPlannedStart(e.target.value)}
        />
        <Input
          label={tc('plannedEnd')}
          type="date"
          value={plannedEnd}
          onChange={(e) => setPlannedEnd(e.target.value)}
        />
        <Input
          label={tc('estMinutes')}
          type="number"
          dir="ltr"
          value={estimatedMinutes}
          onChange={(e) => setEstimatedMinutes(e.target.value)}
        />
        <div className="sm:col-span-4">
          <Button size="sm" loading={planMutation.isPending} onClick={() => planMutation.mutate()}>
            {tc('savePlanning')}
          </Button>
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>{tc('stage')}</TableHeaderCell>
            <TableHeaderCell>{tc('department')}</TableHeaderCell>
            <TableHeaderCell>{tc('dependsOn')}</TableHeaderCell>
            <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
            <TableHeaderCell>%</TableHeaderCell>
            <TableHeaderCell>{tc('worker')}</TableHeaderCell>
            <TableHeaderCell>{tc('priority')}</TableHeaderCell>
            <TableHeaderCell>{tc('notes')}</TableHeaderCell>
            <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {order.stages.map((stage) => {
            const task = stage.tasks[0];
            if (!task) {
              return (
                <TableRow key={stage.id}>
                  <TableCell>{localizedName(locale, stage.stageDefinition)}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>
                    <StatusBadge status={stage.status} />
                  </TableCell>
                  <TableCell dir="ltr">{stage.progressPercent}%</TableCell>
                  <TableCell>{tc('noTask')}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                </TableRow>
              );
            }
            const draft = draftFor(task);
            return (
              <TableRow key={stage.id}>
                <TableCell>
                  <div className="font-medium">
                    {localizedName(locale, stage.stageDefinition)}
                  </div>
                  <div className="text-xs text-text-tertiary">{task.number}</div>
                </TableCell>
                <TableCell className="text-xs">
                  {stage.stageDefinition.responsibleDepartment ?? '—'}
                </TableCell>
                <TableCell className="text-xs">
                  {stage.stageDefinition.dependsOnCodes?.length
                    ? stage.stageDefinition.dependsOnCodes.join(', ')
                    : '—'}
                </TableCell>
                <TableCell>
                  <StatusBadge status={stage.status} />
                </TableCell>
                <TableCell dir="ltr">{stage.progressPercent}%</TableCell>
                <TableCell>
                  <Select
                    value={draft.employeeId}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [task.id]: { ...draft, employeeId: e.target.value },
                      }))
                    }
                  >
                    <option value="">{tc('unassigned')}</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.firstName} {w.lastName}
                      </option>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={draft.priority}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [task.id]: { ...draft, priority: e.target.value },
                      }))
                    }
                    options={priorityOpts}
                  />
                </TableCell>
                <TableCell>
                  <TextArea
                    rows={2}
                    value={taskNotes[task.id] ?? task.notes ?? ''}
                    onChange={(e) =>
                      setTaskNotes((prev) => ({ ...prev, [task.id]: e.target.value }))
                    }
                    placeholder={tc('notesOptional')}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex min-w-[12rem] flex-col gap-1.5">
                    <Button
                      size="sm"
                      disabled={!draft.employeeId}
                      loading={assignMutation.isPending}
                      onClick={() =>
                        assignMutation.mutate({
                          taskId: task.id,
                          employeeId: draft.employeeId,
                          priority: draft.priority,
                        })
                      }
                    >
                      {tc('assign')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={taskActionMutation.isPending}
                      onClick={() =>
                        taskActionMutation.mutate({
                          taskId: task.id,
                          action: 'notes',
                          notes: taskNotes[task.id] ?? task.notes ?? '',
                        })
                      }
                    >
                      {tc('saveNotes')}
                    </Button>
                    {task.status === 'IN_PROGRESS' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => taskActionMutation.mutate({ taskId: task.id, action: 'pause' })}
                      >
                        {tp('hold')}
                      </Button>
                    ) : null}
                    {!['COMPLETED', 'CANCELLED', 'BLOCKED'].includes(task.status) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setHoldTaskId(task.id);
                        }}
                      >
                        {tp('block')}
                      </Button>
                    ) : null}
                    <input
                      ref={(el) => {
                        photoRefs.current[task.id] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="text-xs"
                      onChange={() => void uploadTaskPhoto(task.id, order.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={Boolean(holdTaskId)}
        title={tp('block')}
        description={tp('blockReasonPrompt')}
        confirmLabel={tp('block')}
        withReason
        reasonLabel={tc('reason')}
        loading={taskActionMutation.isPending}
        error={error}
        onConfirm={(reason) => {
          if (holdTaskId) {
            taskActionMutation.mutate({
              taskId: holdTaskId,
              action: 'block',
              reason: reason?.trim() || tp('hold'),
            });
          }
        }}
        onClose={() => {
          setHoldTaskId(null);
          setError(null);
        }}
      />

      <ConfirmDialog
        open={confirmStart}
        title={tp('startConfirmTitle')}
        description={tp('startConfirmDescription')}
        confirmLabel={tc('startProduction')}
        loading={startMutation.isPending}
        error={error}
        onConfirm={() => startMutation.mutate()}
        onClose={() => {
          setConfirmStart(false);
          setError(null);
        }}
      />
    </div>
  );
}
