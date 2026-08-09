import type { PriorityLevel } from '@/components/badges/badgeStyles';
import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import type { TaskDetail, TaskFile, TaskListItem } from './api';
import { buildLocalizedStageInstructions } from './buildLocalizedStageInstructions';

const PROGRESS_LEAK = /progressPercent|progress_percent|percentComplete/i;

export type TaskCardModel = {
  id: string;
  title: string;
  requiredWork: string;
  orderNumber: string;
  productTitle: string;
  imageUrl: string | null;
  /** Product hero + gallery URLs for detail media band. */
  imageUrls: string[];
  priority: PriorityLevel;
  priorityRaw: string;
  status: string;
  deadline: string | null;
  emphasize: boolean;
};

export type TaskDetailViewModel = TaskCardModel & {
  instructions: string;
  notes: string | null;
  photos: TaskFile[];
  attachments: TaskFile[];
  productionOrderId: string | null;
  requiresPhotos: boolean;
  openBlockers: Array<{ id: string; reason: string }>;
  canStart: boolean;
  canStop: boolean;
  canResume: boolean;
  canFinish: boolean;
  canReportProblem: boolean;
  canUploadPhoto: boolean;
  waitingOn: string | null;
  timing: {
    status: string;
    actualMinutes: number;
    actualSeconds?: number;
    openStartedAt: string | null;
    estimatedMinutes: number | null;
    plannedCompletion: string | null;
    elapsedMinutes: number;
  };
};

export function toPriorityLevel(priority: string): PriorityLevel {
  const p = priority.toLowerCase();
  if (p === 'urgent' || p === 'high' || p === 'low') return p;
  if (p === 'normal' || p === 'medium') return 'medium';
  return 'medium';
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
  return localizedName(
    locale,
    product,
    item.productionOrder?.productDescription || item.name || '—',
  );
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

  const model: TaskCardModel = {
    id: item.id,
    title: stageLabel(item, locale),
    requiredWork: stageLabel(item, locale),
    orderNumber: orderNumber(item),
    productTitle: productTitle(item, locale),
    imageUrl: imageUrl(item),
    imageUrls: collectImageUrls(item),
    priority,
    priorityRaw,
    status: String(item.status ?? 'NOT_STARTED'),
    deadline: item.plannedCompletion ?? null,
    emphasize: priority === 'urgent' || priority === 'high',
  };
  assertNoProgressLeak(model);
  return model;
}

export function selectTaskDetail(
  task: TaskDetail,
  locale: Locale = 'en',
): TaskDetailViewModel {
  const card = selectTaskCard(task, locale);
  const openBlockers = (task.blockers ?? [])
    .filter((b) => !b.resolvedAt)
    .map((b) => ({ id: b.id, reason: b.reason }));

  const status = card.status;
  const terminal = status === 'COMPLETED' || status === 'CANCELLED';
  const waitingOn =
    status === 'NOT_STARTED' && (task.stageDefinition?.dependsOnCodes?.length ?? 0) > 0
      ? task.stageDefinition!.dependsOnCodes!.join(', ')
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

  const timing = task.timing ?? {
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
  };

  const vm: TaskDetailViewModel = {
    ...card,
    instructions: instructions || '',
    notes: task.notes ?? null,
    photos: task.photos ?? [],
    attachments: task.attachments ?? [],
    productionOrderId: task.productionOrder?.id ?? null,
    requiresPhotos: Boolean(task.stageDefinition?.requiresPhotos),
    openBlockers,
    canStart: ['NOT_STARTED', 'READY'].includes(status) && !waitingOn,
    canStop: status === 'IN_PROGRESS',
    canResume: (status === 'PAUSED' || status === 'BLOCKED') && !waitingOn,
    // Soft problem reports do not lock the dock — only terminal / hard BLOCKED do.
    canFinish: !terminal && status !== 'BLOCKED',
    canReportProblem: !terminal,
    canUploadPhoto: !terminal,
    waitingOn,
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
