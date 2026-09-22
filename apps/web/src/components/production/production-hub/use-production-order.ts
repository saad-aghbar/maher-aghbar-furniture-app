'use client';

import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { API_URL, ApiClientError, apiFetch, apiUpload, apiUploadFromUrl } from '@/lib/api-client';
import { productionOrderHasRunningTimer, withLiveProductionOrder } from '@/lib/live-task-progress';
import type { ProductionScheduleDetail } from '@/lib/scheduling';
import { useToast } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { AssignableWorker } from '../production-shared';

export interface ReturnWarehouseOption {
  id: string;
  code: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  type?: string;
  isActive?: boolean;
  isDefault?: boolean;
  locations?: Array<{ id: string; code: string; name?: string | null; isDefault?: boolean; isActive?: boolean }>;
}

export interface Task {
  id: string;
  number: string;
  name: string;
  status: string;
  priority: string;
  progressPercent: number;
  notes?: string | null;
  plannedStart?: string | null;
  plannedCompletion?: string | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  timing?: { status: string; actualMinutes: number; actualSeconds?: number; openStartedAt: string | null; estimatedMinutes: number | null; plannedCompletion: string | null; elapsedMinutes: number };
  assignedEmployee?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
  blockers?: Array<{ id: string; category: string; reason: string; resolvedAt?: string | null; createdAt?: string }>;
}

export interface Stage {
  id: string;
  status: string;
  progressPercent: number;
  stageDefinition: { id?: string; code: string; nameEn: string; nameAr: string; nameHe?: string | null; sortOrder: number; dependsOnCodes: string[]; responsibleDepartment?: string | null };
  tasks: Task[];
}

export interface TaskDocument {
  id: string;
  fileName: string;
  mimeType: string;
  category?: string | null;
  sizeBytes: number;
  createdAt: string;
}

export interface ProductionDetail {
  id: string;
  number: string;
  productDescription: string;
  status: string;
  progressPercent: number;
  priority?: string;
  quantity?: number | string | null;
  imageUrl?: string | null;
  plannedStartDate?: string | null;
  plannedCompletionDate?: string | null;
  requiredDeliveryDate?: string | null;
  committedDeliveryDate?: string | null;
  actualCompletionDate?: string | null;
  estimatedMinutes?: number | null;
  currentStageCode?: string | null;
  manufacturingComplexity?: string | null;
  originType?: string | null;
  customer?: { id: string; code?: string; name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null } | null;
  product?: { id: string; sku?: string; nameEn?: string | null; nameAr?: string | null; nameHe?: string | null; imageUrl?: string | null } | null;
  salesOrder?: { id: string; number: string; externalOrderNumber?: string | null } | null;
  salesOrderLineId?: string | null;
  returnRequest?: { id: string; number: string } | null;
  stages: Stage[];
  documents?: TaskDocument[];
  manufacturingCosting?: { status?: string | null; incomplete?: boolean; estimatedTotal?: number | null; actualTotal?: number | null; varianceCost?: number | null } | null;
}

export interface MaterialUsageRow {
  inventoryItemId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  unit: string;
  imageUrl?: string | null;
  itemClass?: string | null;
  assignedQty: number;
  usedQty: number;
  returnedQty: number;
  scrapQty: number;
  varianceQty: number;
  status: 'ON_TARGET' | 'OVER' | 'UNDER' | 'EXTRA' | 'UNUSED';
  isExtra?: boolean;
  tasks?: Array<{ taskId: string; taskNumber: string; stageCode?: string | null; stageNameEn?: string | null; stageNameAr?: string | null; stageNameHe?: string | null; actualQty: number; expectedQty: number; returnedQty?: number; issueWarehouse?: { id: string; code: string; nameEn: string; nameAr: string; nameHe?: string | null } | null; returnWarehouse?: { id: string; code: string; nameEn: string; nameAr: string; nameHe?: string | null } | null }>;
}

export const PRE_START = new Set(['DRAFT', 'PLANNED', 'READY', 'WAITING_FOR_MATERIALS']);
/** Mirrors the API: only running / finished stages are locked; paused and not-started stay assignable. */
export const LOCKED_STAGE = new Set(['COMPLETED', 'SKIPPED', 'IN_PROGRESS', 'READY_FOR_INSPECTION', 'BLOCKED']);
export const LOCKED_TASK = new Set(['COMPLETED', 'CANCELLED', 'IN_PROGRESS', 'READY_FOR_INSPECTION', 'BLOCKED']);

export function useProductionOrder(id: string) {
  const tp = useTranslations('production');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const qc = useQueryClient();

  const detail = useQuery({ queryKey: ['production-order', id], queryFn: () => apiFetch<ProductionDetail>(`/api/v1/production-orders/${id}`) });
  const planSetup = useQuery({ queryKey: ['production-order-plan-setup', id], queryFn: () => apiFetch<{ planDrift?: { drifted: boolean; issues: Array<{ stageCode: string; field: string }> } }>(`/api/v1/production-orders/${id}/plan-setup`), retry: false });
  const materials = useQuery({ queryKey: ['production-order-material-usage', id], queryFn: () => apiFetch<{ materials: MaterialUsageRow[] }>(`/api/v1/production-orders/${id}/material-usage`) });
  const schedule = useQuery({ queryKey: ['scheduling-order', id], queryFn: () => apiFetch<ProductionScheduleDetail>(`/api/v1/scheduling/orders/${id}`), retry: false });
  const delivery = useQuery({
    queryKey: ['production-order-delivery', detail.data?.salesOrder?.id],
    enabled: Boolean(detail.data?.salesOrder?.number),
    queryFn: async () => {
      const res = await apiFetch<{ data: Array<{ status: string; id: string; number: string }> }>(`/api/v1/deliveries?q=${encodeURIComponent(detail.data!.salesOrder!.number)}&pageSize=5`);
      return res.data[0] ?? null;
    },
  });
  const workers = useQuery({ queryKey: ['assignable-workers'], queryFn: () => apiFetch<AssignableWorker[]>('/api/v1/production-orders/assignable-workers'), staleTime: 60_000 });
  // `GET /inventory/warehouses` returns a bare array (with bins); raw-material stores only for returns.
  const warehouses = useQuery({
    queryKey: ['production-return-warehouses'],
    queryFn: async () => {
      const rows = await apiFetch<ReturnWarehouseOption[]>('/api/v1/inventory/warehouses?type=RAW_MATERIALS');
      return Array.isArray(rows) ? rows.filter((w) => w.isActive !== false) : [];
    },
    staleTime: 60_000,
  });

  // Live timer tick while any task runs.
  const [now, setNow] = useState(() => Date.now());
  const running = detail.data ? productionOrderHasRunningTimer(detail.data) : false;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const order = detail.data ? (withLiveProductionOrder(detail.data, now) as ProductionDetail) : undefined;

  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: ['production-order', id] }), qc.invalidateQueries({ queryKey: ['production-orders'] }), qc.invalidateQueries({ queryKey: ['production-order-plan-setup', id] })]);
  const onError = (err: unknown) => toast.error(mutationErrorMessage(err));

  const start = useMutation({
    mutationFn: (plannedStartDate?: string) => apiFetch(`/api/v1/production-orders/${id}/start`, { method: 'POST', body: JSON.stringify(plannedStartDate ? { plannedStartDate } : {}) }),
    onSuccess: async () => {
      toast.success(tc('productionStarted'));
      await invalidate();
    },
    onError,
  });
  const plan = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch(`/api/v1/production-orders/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: async () => {
      toast.success(tp('planningSaved'));
      await invalidate();
    },
    onError,
  });
  const resync = useMutation({
    mutationFn: () => apiFetch(`/api/v1/production-orders/${id}/plan-setup/resync`, { method: 'POST' }),
    onSuccess: async () => {
      toast.success(tp('planResynced'));
      await invalidate();
    },
    onError,
  });
  const assign = useMutation({
    mutationFn: (args: { taskId: string; employeeId: string; priority: string; plannedStart?: string; plannedCompletion?: string; estimatedMinutes?: number }) =>
      apiFetch(`/api/v1/tasks/${args.taskId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: args.employeeId,
          priority: args.priority,
          ...(args.plannedStart ? { plannedStart: args.plannedStart } : {}),
          ...(args.plannedCompletion ? { plannedCompletion: args.plannedCompletion } : {}),
          ...(args.estimatedMinutes != null ? { estimatedMinutes: args.estimatedMinutes } : {}),
        }),
      }),
    onSuccess: async () => {
      toast.success(tp('workerAssigned'));
      await Promise.all([invalidate(), qc.invalidateQueries({ queryKey: ['assignable-workers'] }), qc.invalidateQueries({ queryKey: ['production-order-workflow', id] }), qc.invalidateQueries({ queryKey: ['scheduling-order', id] })]);
    },
    onError,
  });
  const taskAction = useMutation({
    mutationFn: async (args: { taskId: string; action: 'pause' | 'block' | 'notes' | 'unblock'; reason?: string; notes?: string }) => {
      if (args.action === 'notes') return apiFetch(`/api/v1/tasks/${args.taskId}/notes`, { method: 'PATCH', body: JSON.stringify({ notes: args.notes ?? '' }) });
      if (args.action === 'block') return apiFetch(`/api/v1/tasks/${args.taskId}/block`, { method: 'POST', body: JSON.stringify({ category: 'OTHER', reason: args.reason ?? tp('holdReasonDefault') }) });
      if (args.action === 'unblock') return apiFetch(`/api/v1/tasks/${args.taskId}/unblock`, { method: 'POST' });
      return apiFetch(`/api/v1/tasks/${args.taskId}/pause`, { method: 'POST' });
    },
    onSuccess: async () => {
      toast.success(tp('taskUpdated'));
      await invalidate();
    },
    onError,
  });
  const upload = useMutation({
    mutationFn: async (args: { taskId: string; file?: File; url?: string }) => {
      const qs = new URLSearchParams({ taskId: args.taskId, productionOrderId: id, category: `TASK_PHOTO:${args.taskId}` });
      if (args.url) return apiUploadFromUrl(`/api/v1/uploads/from-url?${qs}`, { url: args.url });
      if (!args.file) throw new ApiClientError(tCommon('required'), 400);
      const form = new FormData();
      form.append('file', args.file);
      return apiUpload(`/api/v1/uploads?${qs}`, form);
    },
    onSuccess: async () => {
      toast.success(tc('documentUploaded'));
      await invalidate();
    },
    onError,
  });
  const returnMaterial = useMutation({
    mutationFn: (args: { inventoryItemId: string; quantity: number; warehouseId?: string; locationId?: string }) =>
      apiFetch(`/api/v1/production-orders/${id}/materials/return`, { method: 'POST', body: JSON.stringify({ ...args, idempotencyKey: `${id}:${args.inventoryItemId}:${Date.now()}` }) }),
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      await Promise.all([qc.invalidateQueries({ queryKey: ['production-order-material-usage', id] }), invalidate()]);
    },
    onError,
  });
  const assignWorkflow = useMutation({
    mutationFn: (workflowId: string) => apiFetch(`/api/v1/production-orders/${id}/workflow/assign`, { method: 'POST', body: JSON.stringify({ workflowId }) }),
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      // The graph and the docs live under these keys (admin flow page, hub tab, dealer tracking).
      await Promise.all([
        invalidate(),
        qc.invalidateQueries({ queryKey: ['production-order-workflow', id] }),
        qc.invalidateQueries({ queryKey: ['production-order-docs', id] }),
        qc.invalidateQueries({ queryKey: ['dealer-order-workflow', id] }),
        qc.invalidateQueries({ queryKey: ['scheduling-order', id] }),
        qc.invalidateQueries({ queryKey: ['order-production-setup'] }),
      ]);
    },
    onError,
  });
  const scheduleApprove = useMutation({
    mutationFn: () => apiFetch(`/api/v1/scheduling/orders/${id}/approve`, { method: 'POST', body: JSON.stringify({ version: schedule.data?.schedule?.version ?? 1 }) }),
    onSuccess: async () => {
      toast.success(tp('scheduleApproved'));
      await qc.invalidateQueries({ queryKey: ['scheduling-order', id] });
    },
    onError,
  });
  const scheduleRecalculate = useMutation({
    mutationFn: () => apiFetch(`/api/v1/scheduling/orders/${id}/recalculate`, { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      toast.success(tp('scheduleRecalculated'));
      await qc.invalidateQueries({ queryKey: ['scheduling-order', id] });
    },
    onError,
  });
  const schedulePin = useMutation({
    mutationFn: ({ allocationId, pin }: { allocationId: string; pin: boolean }) => apiFetch(`/api/v1/scheduling/orders/${id}/${pin ? 'pin' : 'unpin'}`, { method: 'POST', body: JSON.stringify({ allocationId, pin, version: schedule.data?.schedule?.version ?? 1 }) }),
    onSuccess: async () => {
      toast.success(tp('scheduleUpdated'));
      await qc.invalidateQueries({ queryKey: ['scheduling-order', id] });
    },
    onError,
  });

  async function openDocument(docId: string) {
    try {
      const link = await apiFetch<{ downloadPath: string }>(`/api/v1/uploads/documents/${docId}/link`);
      window.open(`${API_URL}${link.downloadPath}`, '_blank', 'noopener,noreferrer');
    } catch (err) {
      onError(err);
    }
  }

  return {
    id,
    order,
    queries: { detail, planSetup, materials, schedule, delivery, workers, warehouses },
    start,
    plan,
    resync,
    assign,
    taskAction,
    upload,
    returnMaterial,
    assignWorkflow,
    scheduleApprove,
    scheduleRecalculate,
    schedulePin,
    openDocument,
  };
}

export type ProductionOrderCtl = ReturnType<typeof useProductionOrder>;
