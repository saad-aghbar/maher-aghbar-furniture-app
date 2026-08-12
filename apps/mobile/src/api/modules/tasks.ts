import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPost, apiPatch } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type TaskStatus =
  | 'NOT_STARTED'
  | 'READY'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'BLOCKED'
  | 'READY_FOR_INSPECTION'
  | 'COMPLETED'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type TaskBlockerCategory =
  | 'MATERIAL_MISSING'
  | 'MATERIAL_DEFECT'
  | 'MACHINE_PROBLEM'
  | 'MEASUREMENT_ISSUE'
  | 'DESIGN_ISSUE'
  | 'PREVIOUS_STAGE_DEFECT'
  | 'STAFFING'
  | 'SAFETY'
  | 'OTHER';

export type TaskFile = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  category?: string | null;
  createdAt: string;
  downloadPath?: string;
};

export type TaskTimingSummary = {
  status: 'running' | 'stopped' | 'idle' | 'done';
  actualMinutes: number;
  /** Closed sessions in whole seconds when the API can compute them. */
  actualSeconds?: number;
  openStartedAt: string | null;
  estimatedMinutes: number | null;
  plannedCompletion: string | null;
  /** Scheduler allocation start, when this task has been scheduled. */
  plannedStart?: string | null;
  elapsedMinutes: number;
};

export type TaskListItem = {
  id: string;
  number: string;
  name: string;
  description?: string | null;
  status: TaskStatus | string;
  priority: TaskPriority | string;
  plannedCompletion?: string | null;
  /** Scheduler allocation start, when this task has been scheduled. */
  plannedStart?: string | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  timing?: TaskTimingSummary;
  productImageUrl?: string | null;
  /** Product hero + gallery (task detail). */
  productImageUrls?: string[] | null;
  factoryOrderNumber?: string | null;
  salesOrderNumber?: string | null;
  productionOrder?: {
    id: string;
    number: string;
    productDescription?: string | null;
      product?: {
      id?: string;
      imageUrl?: string | null;
      galleryUrls?: string[] | null;
      nameEn?: string | null;
      nameAr?: string | null;
      nameHe?: string | null;
    } | null;
    salesOrder?: { id: string; number: string } | null;
  };
  stageDefinition?: {
    id?: string;
    code?: string;
    nameEn?: string;
    nameAr?: string | null;
    nameHe?: string | null;
    requiresPhotos?: boolean;
  } | null;
  blockers?: Array<{ id: string; reason: string; resolvedAt?: string | null }>;
};

export type TaskDetail = TaskListItem & {
  notes?: string | null;
  photos?: TaskFile[];
  attachments?: TaskFile[];
  productionOrder?: TaskListItem['productionOrder'] & {
    id: string;
    quantity?: string | number | null;
    specifications?: string | null;
  };
  stageDefinition?: TaskListItem['stageDefinition'] & {
    dependsOnCodes?: string[];
    requiresPhotos?: boolean;
  };
};

export type TaskListFilters = PageParams & {
  status?: TaskStatus | string;
  scope?: 'open' | 'completed' | 'all';
  dueToday?: boolean;
  mine?: boolean;
  q?: string;
  customerId?: string;
  completedFrom?: string;
  completedTo?: string;
};

export type CompletedDealerOption = {
  id: string;
  code: string;
  name: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
};

export async function listTasks(filters: TaskListFilters = {}) {
  const qs = toSearchParams(filters);
  return apiGet<PaginatedResponse<TaskListItem>>(`/tasks${qs}`);
}

export async function listCompletedDealers() {
  return apiGet<{ data: CompletedDealerOption[] }>('/tasks/completed-dealers');
}

export async function getTask(id: string) {
  return apiGet<TaskDetail>(`/tasks/${encodeURIComponent(id)}`);
}

export async function startTask(id: string) {
  return apiPost<TaskDetail>(`/tasks/${encodeURIComponent(id)}/start`);
}

export async function pauseTask(id: string) {
  return apiPost<TaskDetail>(`/tasks/${encodeURIComponent(id)}/pause`);
}

export async function resumeTask(id: string) {
  return apiPost<TaskDetail>(`/tasks/${encodeURIComponent(id)}/resume`);
}

export async function completeTask(
  id: string,
  body: { notes?: string; photoDocumentIds?: string[]; idempotencyKey?: string } = {},
) {
  return apiPost<TaskDetail>(`/tasks/${encodeURIComponent(id)}/complete`, body);
}

export async function blockTask(
  id: string,
  body: { category: TaskBlockerCategory; reason: string; idempotencyKey?: string },
) {
  return apiPost<TaskDetail>(`/tasks/${encodeURIComponent(id)}/block`, body);
}

export async function updateTaskNotes(
  id: string,
  notes: string,
  idempotencyKey?: string,
) {
  return apiPatch<TaskDetail>(`/tasks/${encodeURIComponent(id)}/notes`, {
    notes,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
}
