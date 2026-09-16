import type { PriorityLevel } from '@/components/badges/badgeStyles';
import { translate } from '@/i18n/translate';
import { localizedName } from '@maher/i18n';
import { pickLocalizedInstruction, type Locale } from '@maher/types';
import type { TaskDetail, TaskFile, TaskListItem } from './api';
import { buildLocalizedStageInstructions } from './buildLocalizedStageInstructions';
import { isScheduledToday } from './isScheduledToday';

const PROGRESS_LEAK = /progressPercent|progress_percent|percentComplete/i;

export type TaskCardModel = {
  id: string;
  title: string;
  requiredWork: string;
  orderNumber: string;
  /** Sales-order id when the API provides it — used to group completed cards. */
  salesOrderId: string | null;
  factoryOrderNumber: string | null;
  variantLabel: string | null;
  productTitle: string;
  imageUrl: string | null;
  /** Product hero + gallery URLs for detail media band. */
  imageUrls: string[];
  priority: PriorityLevel;
  priorityRaw: string;
  status: string;
  deadline: string | null;
  emphasize: boolean;
  /** Scheduler allocation start, when this task has been scheduled. */
  plannedStart: string | null;
  /** True when plannedStart (or, absent that, the deadline) falls today. */
  isScheduledToday: boolean;
};

export type CompletedSalesOrderCardModel = {
  id: string;
  salesOrderId: string | null;
  number: string;
  imageUrl: string | null;
  priority: PriorityLevel;
  deadline: string | null;
  taskCount: number;
  tasks: TaskCardModel[];
};

export type TaskProblem = {
  id: string;
  category: string;
  reason: string;
  voiceDocumentId?: string | null;
  photoDocumentIds?: string[];
  resolution: string | null;
  resolutionVoiceDocumentId?: string | null;
  resolutionPhotoDocumentIds?: string[];
  createdAt: string | null;
  answered: boolean;
};

export type TaskDetailViewModel = TaskCardModel & {
  instructions: string;
  orderInstructions: string;
  notes: string | null;
  photos: TaskFile[];
  attachments: TaskFile[];
  productionOrderId: string | null;
  requiresPhotos: boolean;
  producesSemiFinished: boolean;
  expectedPieceCount: number | null;
  problems: TaskProblem[];
  canStart: boolean;
  canStop: boolean;
  canResume: boolean;
  canFinish: boolean;
  canReportProblem: boolean;
  canUploadPhoto: boolean;
  canCarryOver: boolean;
  leftoverRemainingMinutes: number;
  carryOverAllowsOvertime: boolean;
  waitingOn: string | null;
  /** COMPLETED / CANCELLED — history only, no add/edit/scan. */
  isTerminal: boolean;
  /** Piece 9 — stage / quality routing. */
  stageCode: string | null;
  executionKind: string | null;
  isRework: boolean;
  timing: {
    status: string;
    actualMinutes: number;
    actualSeconds?: number;
    openStartedAt: string | null;
    estimatedMinutes: number | null;
    plannedCompletion: string | null;
    plannedStart: string | null;
    elapsedMinutes: number;
  };
};

const STAGE_CODE_ALIASES: Record<string, string> = {
  PACK: 'PACKAGING',
  QC: 'INSPECTION',
};

function sentenceCaseStageCode(code: string): string {
  const lowered = code.replace(/_/g, ' ').toLowerCase();
  if (!lowered) return code;
  return lowered.charAt(0).toUpperCase() + lowered.slice(1);
}

/** Human stage names for waiting-on copy. Never leak MATERIAL_PREP-style enums. */
export function formatWaitingOnStages(codes: string[], locale: Locale): string {
  return codes
    .map((raw) => {
      const code = raw.trim().toUpperCase();
      if (!code) return '';
      const canonical = STAGE_CODE_ALIASES[code] ?? code;
      const key = `production.stageLibrary.${canonical}`;
      const label = translate(locale, key);
      if (label !== key) return label;
      return sentenceCaseStageCode(canonical);
    })
    .filter(Boolean)
    .join(', ');
}

export function toPriorityLevel(priority: string): PriorityLevel {
  const p = priority.toLowerCase();
  if (p === 'urgent' || p === 'high' || p === 'low') return p;
  if (p === 'normal' || p === 'medium') return 'medium';
  return 'medium';
}

export function withVariantLabel(title: string, variant?: string | null): string {
  const base = title.trim();
  const label = variant?.trim();
  if (!label) return base;
  if (!base) return label;
  if (base.toLowerCase().includes(label.toLowerCase())) return base;
  return `${base} · ${label}`;
}

export function secondaryFactoryOrderNumber(
  salesOrderNumber?: string | null,
  factoryOrderNumber?: string | null,
): string | null {
  const factory = factoryOrderNumber?.trim() || null;
  const sales = salesOrderNumber?.trim() || null;
  if (!factory) return null;
  if (sales && sales === factory) return null;
  return factory;
}

export function assertNoProgressLeak(value: unknown, path = 'root'): void {
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoProgressLeak(item, `${path}[${i}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PROGRESS_LEAK.test(key)) {
      throw new Error(`Progress field "${key}" must not appear in worker UI at ${path}`);
    }
    assertNoProgressLeak(child, `${path}.${key}`);
  }
}

function productTitle(item: TaskListItem, locale: Locale): string {
  const product = item.productionOrder?.product;
  const base = localizedName(
    locale,
    product,
    item.productionOrder?.productDescription || item.name || '—',
  );
  return withVariantLabel(base, taskVariantLabel(item));
}

function taskVariantLabel(item: TaskListItem): string | null {
  return item.variantLabel?.trim() || item.productionOrder?.variantLabel?.trim() || null;
}

function taskFactoryOrderNumber(item: TaskListItem): string | null {
  return item.factoryOrderNumber?.trim() || item.productionOrder?.number?.trim() || null;
}

function stageLabel(item: TaskListItem, locale: Locale): string {
  const stage = item.stageDefinition;
  return localizedName(
    locale,
    stage
      ? {
          nameEn: stage.nameEn,
          nameAr: stage.nameAr,
          nameHe: stage.nameHe,
          name: item.name,
        }
      : { name: item.name },
    item.name || '—',
  );
}

function orderNumber(item: TaskListItem): string {
  return (
    item.salesOrderNumber ||
    item.productionOrder?.salesOrder?.number ||
    item.factoryOrderNumber ||
    item.productionOrder?.number ||
    item.number
  );
}

function taskSalesOrderId(item: TaskListItem): string | null {
  return (
    item.salesOrderId?.trim() ||
    item.productionOrder?.salesOrder?.id?.trim() ||
    null
  );
}

function imageUrl(item: TaskListItem): string | null {
  return collectImageUrls(item)[0] ?? null;
}

function collectImageUrls(item: TaskListItem): string[] {
  const out: string[] = [];
  const add = (u?: string | null) => {
    const t = u?.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  if ('productImageUrls' in item && Array.isArray(item.productImageUrls)) {
    for (const u of item.productImageUrls) add(u);
  }
  add(item.productImageUrl);
  add(item.productionOrder?.product?.imageUrl);
  const gallery = item.productionOrder?.product?.galleryUrls;
  if (Array.isArray(gallery)) {
    for (const u of gallery) add(u);
  }
  return out;
}

export function selectTaskCard(
  item: TaskListItem,
  locale: Locale = 'en',
): TaskCardModel {
  const priorityRaw = String(item.priority ?? 'NORMAL');
  const priority = toPriorityLevel(priorityRaw);
  const plannedStart = item.plannedStart ?? item.timing?.plannedStart ?? null;

  const model: TaskCardModel = {
    id: item.id,
    title: stageLabel(item, locale),
    requiredWork: stageLabel(item, locale),
    orderNumber: orderNumber(item),
    salesOrderId: taskSalesOrderId(item),
    factoryOrderNumber: secondaryFactoryOrderNumber(orderNumber(item), taskFactoryOrderNumber(item)),
    variantLabel: taskVariantLabel(item),
    productTitle: productTitle(item, locale),
    imageUrl: imageUrl(item),
    imageUrls: collectImageUrls(item),
    priority,
    priorityRaw,
    status: String(item.status ?? 'NOT_STARTED'),
    deadline: item.plannedCompletion ?? null,
    emphasize: priority === 'urgent' || priority === 'high',
    plannedStart,
    isScheduledToday: isScheduledToday(plannedStart ?? item.plannedCompletion ?? null),
  };
  assertNoProgressLeak(model);
  return model;
}

export function selectTaskDetail(
  task: TaskDetail,
  locale: Locale = 'en',
): TaskDetailViewModel {
  const card = selectTaskCard(task, locale);
  const problems: TaskProblem[] = [...(task.blockers ?? [])]
    .map((b) => ({
      id: b.id,
      category: b.category?.trim() || 'OTHER',
      reason: b.reason,
      voiceDocumentId: b.voiceDocumentId,
      photoDocumentIds: b.photoDocumentIds ?? [],
      resolution: b.resolution ?? null,
      resolutionVoiceDocumentId: b.resolutionVoiceDocumentId,
      resolutionPhotoDocumentIds: b.resolutionPhotoDocumentIds ?? [],
      createdAt: b.createdAt ?? null,
      answered: Boolean(b.resolvedAt || b.resolution),
    }))
    .sort((a, b) => {
      if (a.answered !== b.answered) return a.answered ? 1 : -1;
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });

  const status = card.status;
  const terminal = status === 'COMPLETED' || status === 'CANCELLED';
  const waitingOn =
    status === 'NOT_STARTED' && (task.stageDefinition?.dependsOnCodes?.length ?? 0) > 0
      ? formatWaitingOnStages(task.stageDefinition!.dependsOnCodes!, locale) || null
      : null;

  const product = productTitle(task, locale);
  const stage = stageLabel(task, locale);
  const stageCode = task.stageDefinition?.code?.trim();
  const stored = task.description?.trim() || '';
  const instructions = stageCode
    ? buildLocalizedStageInstructions({
        locale,
        stageCode,
        stageName: stage,
        productDescription: product,
        quantity: task.productionOrder?.quantity ?? 1,
        specifications: task.productionOrder?.specifications ?? null,
      })
    : stored || task.productionOrder?.specifications?.trim() || '';
  const orderInstructions = pickLocalizedInstruction(
    locale,
    task.productionOrder?.instructionsAr,
    task.productionOrder?.instructionsEn,
    task.productionOrder?.instructionsHe,
  ) || (task.productionOrder?.notes?.trim() || '');

  const timing = {
    ...(task.timing ?? {
      status:
        status === 'IN_PROGRESS'
          ? 'running'
          : status === 'COMPLETED' || status === 'CANCELLED'
            ? 'done'
            : status === 'PAUSED' || status === 'BLOCKED'
              ? 'stopped'
              : 'idle',
      actualMinutes: task.actualMinutes ?? 0,
      actualSeconds: Math.max(0, Math.floor(task.actualMinutes ?? 0)) * 60,
      openStartedAt: null,
      estimatedMinutes: task.estimatedMinutes ?? null,
      plannedCompletion: task.plannedCompletion ?? null,
      elapsedMinutes: task.actualMinutes ?? 0,
    }),
    plannedStart: task.plannedStart ?? task.timing?.plannedStart ?? null,
  };

  const vm: TaskDetailViewModel = {
    ...card,
    instructions: instructions || '',
    orderInstructions,
    notes: task.notes ?? null,
    photos: task.photos ?? [],
    attachments: task.attachments ?? [],
    productionOrderId: task.productionOrder?.id ?? null,
    requiresPhotos: Boolean(
      task.requiresPhotos ?? task.stageDefinition?.requiresPhotos,
    ),
    producesSemiFinished: Boolean(task.producesSemiFinished),
    expectedPieceCount:
      task.expectedPieceCount != null && Number(task.expectedPieceCount) > 0
        ? Math.floor(Number(task.expectedPieceCount))
        : task.producesSemiFinished
          ? 1
          : null,
    problems,
    canStart: ['NOT_STARTED', 'READY', 'READY_FOR_INSPECTION'].includes(status) && !waitingOn,
    canStop: status === 'IN_PROGRESS',
    canResume: (status === 'PAUSED' || status === 'BLOCKED') && !waitingOn,
    // Soft problem reports do not lock the dock — only terminal / hard BLOCKED do.
    canFinish: !terminal && status !== 'BLOCKED',
    canReportProblem: !terminal,
    canUploadPhoto: !terminal,
    canCarryOver: Boolean(task.canCarryOver),
    leftoverRemainingMinutes: Math.max(1, task.leftoverRemainingMinutes ?? 30),
    carryOverAllowsOvertime: Boolean(task.carryOverAllowsOvertime),
    waitingOn,
    isTerminal: terminal,
    stageCode: stageCode || task.stageDefinition?.code?.trim() || null,
    executionKind: task.stageDefinition?.executionKind?.trim() || null,
    isRework: Boolean(task.isRework),
    timing,
  };
  assertNoProgressLeak(vm);
  return vm;
}

export function sortUrgentFirst(items: TaskCardModel[]): TaskCardModel[] {
  const rank: Record<PriorityLevel, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return [...items].sort((a, b) => rank[a.priority] - rank[b.priority]);
}

function completedGroupKey(item: TaskListItem): string {
  return (
    taskSalesOrderId(item) ||
    item.salesOrderNumber?.trim() ||
    item.productionOrder?.salesOrder?.number?.trim() ||
    `task:${item.id}`
  );
}

function maxPriority(tasks: TaskCardModel[]): PriorityLevel {
  const rank: Record<PriorityLevel, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return tasks.reduce<PriorityLevel>((best, task) => {
    return rank[task.priority] < rank[best] ? task.priority : best;
  }, 'low');
}

/**
 * Group finished tasks into sales-order boards (same shape as open My Tasks).
 */
export function selectCompletedSalesOrderCards(
  items: TaskListItem[],
  locale: Locale = 'en',
): CompletedSalesOrderCardModel[] {
  const groups: TaskListItem[][] = [];
  const indexByKey = new Map<string, number>();
  for (const item of items) {
    const key = completedGroupKey(item);
    const idx = indexByKey.get(key);
    if (idx == null) {
      indexByKey.set(key, groups.length);
      groups.push([item]);
      continue;
    }
    groups[idx]!.push(item);
  }

  return groups.map((rows) => {
    const tasks = sortUrgentFirst(rows.map((row) => selectTaskCard(row, locale)));
    const first = tasks[0]!;
    const salesOrderId = taskSalesOrderId(rows[0]!) ?? first.salesOrderId;
    return {
      id: salesOrderId || completedGroupKey(rows[0]!),
      salesOrderId,
      number: first.orderNumber,
      imageUrl: tasks.find((task) => task.imageUrl)?.imageUrl ?? first.imageUrl,
      priority: maxPriority(tasks),
      deadline: tasks.map((task) => task.deadline).find(Boolean) ?? null,
      taskCount: tasks.length,
      tasks,
    };
  });
}

export function workerCompletedSalesOrderHref(
  order: Pick<CompletedSalesOrderCardModel, 'id' | 'number'>,
  extras?: { q?: string },
): string {
  const qs = new URLSearchParams();
  if (order.number) qs.set('number', order.number);
  const needle = extras?.q?.trim();
  if (needle) qs.set('q', needle);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return `/(app)/(employee)/completed-orders/${order.id}${suffix}`;
}

export function completedTaskMatchesSalesOrder(
  task: TaskCardModel,
  salesOrderId: string,
  orderNumber?: string,
): boolean {
  if (task.salesOrderId && task.salesOrderId === salesOrderId) return true;
  if (salesOrderId.startsWith('task:')) return task.id === salesOrderId.slice(5);
  if (orderNumber && task.orderNumber === orderNumber) return true;
  return task.orderNumber === salesOrderId;
}
