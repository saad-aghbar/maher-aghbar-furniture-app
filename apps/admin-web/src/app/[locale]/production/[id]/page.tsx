'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { API_URL, apiFetch, apiUpload, apiUploadFromUrl, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { PRIORITY_STATUSES, statusOptions } from '@/lib/status-options';
import {
  Alert,
  Button,
  ErrorState,
  Input,
  PhotoAttachField,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableNumericCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextArea,
  MotionSection,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { localizedName } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  departmentId?: string | null;
  department?: {
    id: string;
    code: string;
    nameAr: string;
    nameEn: string;
  } | null;
  roles?: Array<{ role: { code: string } }>;
}

interface DepartmentRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

interface Task {
  id: string;
  number: string;
  name: string;
  status: string;
  priority: string;
  progressPercent: number;
  notes?: string | null;
  plannedCompletion?: string | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  timing?: {
    status: string;
    actualMinutes: number;
    openStartedAt: string | null;
    estimatedMinutes: number | null;
    plannedCompletion: string | null;
    elapsedMinutes: number;
  };
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

interface TaskDocument {
  id: string;
  fileName: string;
  mimeType: string;
  category?: string | null;
  sizeBytes: number;
  createdAt: string;
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
  salesOrder?: { id: string; number: string; externalOrderNumber?: string | null } | null;
  stages: Stage[];
  documents?: TaskDocument[];
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildAssignDueIso(dateYmd: string, hour: string, minute: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return undefined;
  const h = Math.min(23, Math.max(0, Number(hour) || 0));
  const m = Math.min(59, Math.max(0, Number(minute) || 0));
  const d = new Date(`${dateYmd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function draftEstimateMinutes(estHours: string, estMinutes: string): number | undefined {
  const h = Number(estHours);
  const m = Number(estMinutes);
  if (!Number.isFinite(h) && !Number.isFinite(m)) return undefined;
  const total = Math.max(0, Math.round((Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)));
  return total > 0 ? total : undefined;
}

export default function ProductionDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tc = useTranslations('catalog');
  const tp = useTranslations('production');
  const tSales = useTranslations('sales');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const qc = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmStart, setConfirmStart] = useState(false);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        employeeId: string;
        priority: string;
        dueDate: string;
        dueHour: string;
        dueMinute: string;
        estHours: string;
        estMinutes: string;
      }
    >
  >({});
  const [planPriority, setPlanPriority] = useState('NORMAL');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [holdTaskId, setHoldTaskId] = useState<string | null>(null);
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

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
      apiFetch<{ data: Worker[] }>(
        '/api/v1/users?pageSize=100&roleCodes=PRODUCTION_WORKER',
      ).then((r) => r.data),
  });

  const departmentsQuery = useQuery({
    queryKey: ['departments-for-assign'],
    queryFn: () =>
      apiFetch<{ data: DepartmentRow[] }>('/api/v1/departments?pageSize=100')
        .then((r) => r.data)
        .catch(() => [] as DepartmentRow[]),
  });

  const workers = useMemo(() => {
    const all = workersQuery.data ?? [];
    const production = all.filter((u) =>
      u.roles?.some((r) =>
        [
          'PRODUCTION_WORKER',
        ].includes(r.role.code),
      ),
    );
    return production.length ? production : all.filter((u) => !u.email?.includes('customer'));
  }, [workersQuery.data]);

  const departmentByCode = useMemo(() => {
    const map = new Map<string, DepartmentRow>();
    for (const d of departmentsQuery.data ?? []) map.set(d.code, d);
    for (const w of workers) {
      if (w.department && !map.has(w.department.code)) {
        map.set(w.department.code, w.department);
      }
    }
    return map;
  }, [departmentsQuery.data, workers]);

  const workersForStage = (stageDept?: string | null) => {
    if (!stageDept) return workers;
    return workers.filter((w) => w.department?.code === stageDept);
  };

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
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/v1/production-orders/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      setError(null);
      setBanner(tp('planningSaved'));
      await qc.invalidateQueries({ queryKey: ['production-order', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const assignMutation = useMutation({
    mutationFn: (args: {
      taskId: string;
      employeeId: string;
      priority: string;
      plannedCompletion?: string;
      estimatedMinutes?: number;
    }) =>
      apiFetch(`/api/v1/tasks/${args.taskId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: args.employeeId,
          priority: args.priority,
          ...(args.plannedCompletion ? { plannedCompletion: args.plannedCompletion } : {}),
          ...(args.estimatedMinutes != null ? { estimatedMinutes: args.estimatedMinutes } : {}),
        }),
      }),
    onSuccess: async () => {
      setError(null);
      setBanner(tp('workerAssigned'));
      await qc.invalidateQueries({ queryKey: ['production-order', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const assignAllMutation = useMutation({
    mutationFn: async (
      items: Array<{
        taskId: string;
        employeeId: string;
        priority: string;
        plannedCompletion?: string;
        estimatedMinutes?: number;
      }>,
    ) => {
      const results = await Promise.allSettled(
        items.map((args) =>
          apiFetch(`/api/v1/tasks/${args.taskId}/assign`, {
            method: 'POST',
            body: JSON.stringify({
              employeeId: args.employeeId,
              priority: args.priority,
              ...(args.plannedCompletion ? { plannedCompletion: args.plannedCompletion } : {}),
              ...(args.estimatedMinutes != null
                ? { estimatedMinutes: args.estimatedMinutes }
                : {}),
            }),
          }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      return { total: items.length, failed };
    },
    onSuccess: async ({ failed }) => {
      setError(null);
      setBanner(failed > 0 ? tp('workersAssignedPartial') : tp('workersAssignedAll'));
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

  const uploadMutation = useMutation({
    mutationFn: async (args: {
      taskId: string;
      productionOrderId: string;
      file?: File;
      url?: string;
    }) => {
      const qs = new URLSearchParams({
        taskId: args.taskId,
        productionOrderId: args.productionOrderId,
        category: `TASK_PHOTO:${args.taskId}`,
      });
      if (args.url) {
        return apiUploadFromUrl(`/api/v1/uploads/from-url?${qs}`, { url: args.url });
      }
      if (!args.file) throw new ApiClientError(tCommon('required'), 400);
      const form = new FormData();
      form.append('file', args.file);
      return apiUpload(`/api/v1/uploads?${qs}`, form);
    },
    onSuccess: async () => {
      setError(null);
      setBanner(tc('documentUploaded'));
      await qc.invalidateQueries({ queryKey: ['production-order', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
    onSettled: () => setUploadingTaskId(null),
  });

  async function openDocument(id: string) {
    try {
      const link = await apiFetch<{ downloadPath: string }>(`/api/v1/uploads/documents/${id}/link`);
      window.open(`${API_URL}${link.downloadPath}`, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(mutationErrorMessage(err));
    }
  }

  function documentsForTask(taskId: string) {
    const docs = detailQuery.data?.documents ?? [];
    return docs.filter(
      (d) => d.category === `TASK_PHOTO:${taskId}` || d.category?.endsWith(`:${taskId}`),
    );
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
  const PRE_START_STATUSES = ['DRAFT', 'PLANNED', 'READY', 'WAITING_FOR_MATERIALS'];
  const LOCKED_STAGE_STATUSES = [
    'COMPLETED',
    'SKIPPED',
    'IN_PROGRESS',
    'PAUSED',
    'READY_FOR_INSPECTION',
    'BLOCKED',
  ];
  const LOCKED_TASK_STATUSES = [
    'COMPLETED',
    'CANCELLED',
    'IN_PROGRESS',
    'PAUSED',
    'READY_FOR_INSPECTION',
    'BLOCKED',
  ];
  const isCompleted =
    order.status === 'COMPLETED' ||
    order.status === 'CANCELLED' ||
    Number(order.progressPercent) >= 100;
  const canStart = !isCompleted && PRE_START_STATUSES.includes(order.status);
  const isInProduction = !isCompleted && !PRE_START_STATUSES.includes(order.status);

  function draftFor(task: Task) {
    return (
      drafts[task.id] ?? {
        employeeId: task.assignedEmployee?.id ?? '',
        priority: task.priority || 'NORMAL',
        dueDate: toDateInput(task.plannedCompletion) || todayYmd(),
        dueHour: '17',
        dueMinute: '0',
        estHours:
          task.estimatedMinutes != null
            ? String(Math.floor(task.estimatedMinutes / 60))
            : '',
        estMinutes:
          task.estimatedMinutes != null ? String(task.estimatedMinutes % 60) : '',
      }
    );
  }

  function stageAssignable(stage: Stage, task: Task) {
    if (isCompleted) return false;
    if (LOCKED_STAGE_STATUSES.includes(stage.status)) return false;
    if (LOCKED_TASK_STATUSES.includes(task.status)) return false;
    return true;
  }

  const assignAllItems = order.stages.flatMap((stage) => {
    const task = stage.tasks[0];
    if (!task || !stageAssignable(stage, task)) return [];
    const draft = draftFor(task);
    if (!draft.employeeId) return [];
    return [
      {
        taskId: task.id,
        employeeId: draft.employeeId,
        priority: draft.priority,
        plannedCompletion: buildAssignDueIso(draft.dueDate, draft.dueHour, draft.dueMinute),
        estimatedMinutes: draftEstimateMinutes(draft.estHours, draft.estMinutes),
      },
    ];
  });

  function departmentLabel(code?: string | null) {
    if (!code) return '—';
    const dept = departmentByCode.get(code);
    if (!dept) return code;
    return localizedName(locale, dept, code);
  }

  function savePlanning() {
    if (isInProduction) {
      planMutation.mutate({
        priority: planPriority,
        plannedCompletionDate: plannedEnd || undefined,
      });
      return;
    }
    planMutation.mutate({
      priority: planPriority,
      plannedStartDate: plannedStart || undefined,
      plannedCompletionDate: plannedEnd || undefined,
      estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/production"
        title={order.number}
        description={order.productDescription}
        actions={
          <div className="flex flex-wrap gap-2">
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
      {isCompleted ? <Alert variant="info">{tp('orderCompletedReadOnly')}</Alert> : null}

      <div className="maher-stagger space-y-6">
      <MotionSection className="maher-form-section space-y-4" as="div">
      <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
        <StatusBadge status={order.status} />
        <span>
          {tc('progress')}{' '}
          <span dir="ltr">{order.progressPercent}%</span>
        </span>
        <span>
          {tc('current')}: {order.currentStageCode ?? '—'}
        </span>
        {order.salesOrder?.number ? (
          <span dir="ltr">
            {tSales('systemOrderNumber')}: {order.salesOrder.number}
          </span>
        ) : null}
        {order.salesOrder?.externalOrderNumber ? (
          <span dir="ltr">
            {tSales('dealerOrderNumber')}: {order.salesOrder.externalOrderNumber}
          </span>
        ) : null}
      </div>

      <div
        className={`maher-form-section grid gap-3 rounded-[var(--maher-radius-md)] border border-border p-4 ${
          isInProduction ? 'sm:grid-cols-2' : 'sm:grid-cols-4'
        }`}
      >
        {isCompleted ? (
          <>
            <div>
              <div className="mb-1 text-xs text-text-tertiary">{tc('priority')}</div>
              <StatusBadge status={planPriority || order.priority || 'NORMAL'} />
            </div>
            <div>
              <div className="mb-1 text-xs text-text-tertiary">{tc('plannedStart')}</div>
              <div dir="ltr" className="text-sm">
                {plannedStart || '—'}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs text-text-tertiary">{tc('plannedEnd')}</div>
              <div dir="ltr" className="text-sm">
                {plannedEnd || '—'}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs text-text-tertiary">{tc('estMinutes')}</div>
              <div dir="ltr" className="text-sm">
                {estimatedMinutes || '—'}
              </div>
            </div>
          </>
        ) : isInProduction ? (
          <>
            <Select
              label={tc('priority')}
              value={planPriority}
              onChange={(e) => setPlanPriority(e.target.value)}
              options={priorityOpts}
            />
            <Input
              label={tc('plannedEnd')}
              type="date"
              value={plannedEnd}
              onChange={(e) => setPlannedEnd(e.target.value)}
            />
            <div className="maher-detail-sticky-actions sm:col-span-2">
              <Button size="sm" loading={planMutation.isPending} onClick={savePlanning}>
                {tc('savePlanning')}
              </Button>
            </div>
          </>
        ) : (
          <>
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
            <div className="maher-detail-sticky-actions sm:col-span-4">
              <Button size="sm" loading={planMutation.isPending} onClick={savePlanning}>
                {tc('savePlanning')}
              </Button>
            </div>
          </>
        )}
      </div>
      </MotionSection>

      {!isCompleted && assignAllItems.length > 0 ? (
        <div className="maher-detail-sticky-actions flex justify-end">
          <Button
            size="sm"
            loading={assignAllMutation.isPending}
            onClick={() => assignAllMutation.mutate(assignAllItems)}
          >
            {tp('assignAll')}
          </Button>
        </div>
      ) : null}

      <MotionSection className="maher-form-section maher-table-shell" as="div">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>{tc('stage')}</TableHeaderCell>
            <TableHeaderCell>{tc('department')}</TableHeaderCell>
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
            const stageDept = stage.stageDefinition.responsibleDepartment;
            if (!task) {
              return (
                <TableRow key={stage.id}>
                  <TableCell>{localizedName(locale, stage.stageDefinition)}</TableCell>
                  <TableCell className="text-xs">{departmentLabel(stageDept)}</TableCell>
                  <TableCell>
                    <StatusBadge status={stage.status} />
                  </TableCell>
                  <TableNumericCell>{stage.progressPercent}%</TableNumericCell>
                  <TableCell>{tc('noTask')}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                </TableRow>
              );
            }
            const draft = draftFor(task);
            const stageWorkers = workersForStage(stageDept);
            const assignedMissing =
              draft.employeeId && !stageWorkers.some((w) => w.id === draft.employeeId)
                ? workers.find((w) => w.id === draft.employeeId) ??
                  (task.assignedEmployee
                    ? {
                        id: task.assignedEmployee.id,
                        firstName: task.assignedEmployee.firstName,
                        lastName: task.assignedEmployee.lastName,
                        email: task.assignedEmployee.email ?? null,
                      }
                    : null)
                : null;
            const workerOptions = assignedMissing
              ? [assignedMissing, ...stageWorkers]
              : stageWorkers;
            const workerName = task.assignedEmployee
              ? `${task.assignedEmployee.firstName} ${task.assignedEmployee.lastName}`.trim()
              : null;
            const docs = documentsForTask(task.id);
            const canAssign = stageAssignable(stage, task);
            const showWorkerReadOnly = !canAssign;
            return (
              <TableRow key={stage.id}>
                <TableCell className="font-medium">
                  {localizedName(locale, stage.stageDefinition)}
                </TableCell>
                <TableCell className="text-xs">{departmentLabel(stageDept)}</TableCell>
                <TableCell>
                  <StatusBadge status={stage.status} />
                </TableCell>
                <TableNumericCell>{stage.progressPercent}%</TableNumericCell>
                <TableCell>
                  {showWorkerReadOnly ? (
                    <div>
                      <span className="text-sm">{workerName || tp('unassignedWorker')}</span>
                      {task.timing || task.actualMinutes != null ? (
                        <p className="mt-0.5 text-[11px] text-text-tertiary" dir="ltr">
                          {task.timing?.status === 'running' ? '● ' : ''}
                          {Math.round(task.timing?.elapsedMinutes ?? task.actualMinutes ?? 0)}m
                        </p>
                      ) : null}
                      {!isCompleted ? (
                        <p className="mt-0.5 text-[11px] text-text-tertiary">
                          {tp('stageAssignLocked')}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
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
                      {workerOptions.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.firstName} {w.lastName}
                        </option>
                      ))}
                    </Select>
                    <div className="grid grid-cols-3 gap-1">
                      <input
                        type="date"
                        className="maher-input text-xs"
                        value={draft.dueDate}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [task.id]: { ...draft, dueDate: e.target.value },
                          }))
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        max={23}
                        className="maher-input text-xs"
                        placeholder="HH"
                        value={draft.dueHour}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [task.id]: { ...draft, dueHour: e.target.value },
                          }))
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        max={59}
                        className="maher-input text-xs"
                        placeholder="MM"
                        value={draft.dueMinute}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [task.id]: { ...draft, dueMinute: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="number"
                        min={0}
                        className="maher-input text-xs"
                        placeholder="Est h"
                        value={draft.estHours}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [task.id]: { ...draft, estHours: e.target.value },
                          }))
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        max={59}
                        className="maher-input text-xs"
                        placeholder="Est m"
                        value={draft.estMinutes}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [task.id]: { ...draft, estMinutes: e.target.value },
                          }))
                        }
                      />
                    </div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {showWorkerReadOnly ? (
                    <StatusBadge status={task.priority || 'NORMAL'} />
                  ) : (
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
                  )}
                </TableCell>
                <TableCell>
                  {isCompleted ? (
                    <p className="whitespace-pre-wrap text-sm text-text-secondary">
                      {(taskNotes[task.id] ?? task.notes)?.trim() || '—'}
                    </p>
                  ) : (
                    <TextArea
                      rows={2}
                      value={taskNotes[task.id] ?? task.notes ?? ''}
                      onChange={(e) =>
                        setTaskNotes((prev) => ({ ...prev, [task.id]: e.target.value }))
                      }
                      placeholder={tc('notesOptional')}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex min-w-[12rem] flex-col gap-1.5">
                    {!isCompleted ? (
                      <>
                        {canAssign ? (
                          <Button
                            size="sm"
                            disabled={!draft.employeeId}
                            loading={assignMutation.isPending}
                            onClick={() =>
                              assignMutation.mutate({
                                taskId: task.id,
                                employeeId: draft.employeeId,
                                priority: draft.priority,
                                plannedCompletion: buildAssignDueIso(
                                  draft.dueDate,
                                  draft.dueHour,
                                  draft.dueMinute,
                                ),
                                estimatedMinutes: draftEstimateMinutes(
                                  draft.estHours,
                                  draft.estMinutes,
                                ),
                              })
                            }
                          >
                            {tc('assign')}
                          </Button>
                        ) : null}
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
                            onClick={() =>
                              taskActionMutation.mutate({ taskId: task.id, action: 'pause' })
                            }
                          >
                            {tp('hold')}
                          </Button>
                        ) : null}
                        <PhotoAttachField
                          className="max-w-xs"
                          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
                          uploadLabel={tp('attachFile')}
                          uploadingLabel={tCommon('uploading')}
                          attachUrlLabel={tCommon('attachFromUrl')}
                          disabled={uploadingTaskId === task.id && uploadMutation.isPending}
                          onUploadFile={async (file) => {
                            setUploadingTaskId(task.id);
                            await uploadMutation.mutateAsync({
                              taskId: task.id,
                              productionOrderId: order.id,
                              file,
                            });
                          }}
                          onAttachUrl={async (url) => {
                            setUploadingTaskId(task.id);
                            await uploadMutation.mutateAsync({
                              taskId: task.id,
                              productionOrderId: order.id,
                              url,
                            });
                          }}
                        />
                      </>
                    ) : null}
                    {docs.length ? (
                      <ul className="space-y-1">
                        {docs.map((d) => (
                          <li key={d.id}>
                            <button
                              type="button"
                              className="max-w-[11rem] truncate text-left text-xs font-medium text-brand hover:underline"
                              title={d.fileName}
                              onClick={() => void openDocument(d.id)}
                            >
                              {d.fileName}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-text-tertiary">{tp('noAttachmentsYet')}</p>
                    )}
                    {!isCompleted &&
                    !['COMPLETED', 'CANCELLED', 'BLOCKED'].includes(task.status) ? (
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
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </MotionSection>
      </div>

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
