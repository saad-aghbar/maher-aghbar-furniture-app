import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import type { SalesOrderDetail, SalesOrderStage } from '@/api/modules/sales-orders';
import type { ProductionOrderDetail } from '@/api/modules/production';

export type ProductionFlowRole = 'admin' | 'dealer';

export type ProductionFlowStage = {
  code: string;
  name: string;
  status: string;
  progressPercent: number;
  dependsOnCodes: string[];
  sortOrder: number;
  /** Snapshot / workflow node id when available (order customize). */
  snapshotNodeId?: string | null;
  stageDefinitionId?: string | null;
  estimatedMinutes?: number | null;
  estimateReviewRequired?: boolean;
  /** Admin-only (empty for dealer) */
  assignees: Array<{
    id: string;
    name: string;
    elapsedMinutes?: number;
    actualMinutes?: number;
    actualSeconds?: number;
    running?: boolean;
    openStartedAt?: string | null;
    estimatedMinutes?: number | null;
    plannedCompletion?: string | null;
  }>;
  actualStart: string | null;
  actualEnd: string | null;
  plannedEnd: string | null;
  isOverdue: boolean;
  blockers: { id: string; category: string; reason: string }[];
  notes: string | null;
  attachmentCount: number;
  /** Worker completion / work photos (dealers: completed stages only from API). */
  photos: { id: string; fileName: string; mimeType: string | null }[];
};

export type ProductionFlowModel = {
  id: string;
  number: string;
  title: string | null;
  status: string;
  progressPercent: number;
  estimatedDelivery: string | null;
  /** True when estimatedDelivery reflects a scheduler-committed date (vs. requested). */
  isCommittedDelivery: boolean;
  /** Dealer-safe promise state, when the scheduling module has projected one. */
  promiseState: string | null;
  stages: ProductionFlowStage[];
  role: ProductionFlowRole;
  source: 'sales-order' | 'production-order';
};

const ADMIN_ONLY_KEYS = [
  'assignees',
  'blockers',
  'notes',
  'attachmentCount',
  'isOverdue',
  'actualStart',
  'actualEnd',
  'plannedEnd',
] as const;

function asLocale(locale: string): Locale {
  return locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
}

function emptyAdminFields(): Pick<
  ProductionFlowStage,
  | 'assignees'
  | 'actualStart'
  | 'actualEnd'
  | 'plannedEnd'
  | 'isOverdue'
  | 'blockers'
  | 'notes'
  | 'attachmentCount'
> {
  return {
    assignees: [],
    actualStart: null,
    actualEnd: null,
    plannedEnd: null,
    isOverdue: false,
    blockers: [],
    notes: null,
    attachmentCount: 0,
  };
}

type LooseStage = SalesOrderStage & {
  nameHe?: string | null;
  plannedEnd?: string | null;
  notes?: string | null;
  isOverdue?: boolean;
  assignees?: Array<{
    id: string;
    name: string;
    elapsedMinutes?: number;
    actualMinutes?: number;
    actualSeconds?: number;
    running?: boolean;
    openStartedAt?: string | null;
    estimatedMinutes?: number | null;
    plannedCompletion?: string | null;
  }>;
  blockers?: { id: string; category: string; reason: string }[];
  attachmentCount?: number;
  photos?: Array<{ id: string; fileName: string; mimeType?: string | null }>;
  stageDefinition?: {
    code: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    sortOrder?: number;
    dependsOnCodes?: string[] | null;
  };
  tasks?: Array<{
    status?: string;
    actualMinutes?: number | null;
    estimatedMinutes?: number | null;
    plannedCompletion?: string | null;
    timing?: {
      status?: string;
      actualMinutes?: number;
      actualSeconds?: number;
      elapsedMinutes?: number;
      openStartedAt?: string | null;
      estimatedMinutes?: number | null;
      plannedCompletion?: string | null;
    };
    assignedEmployee?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
    blockers?: Array<{
      id: string;
      category: string;
      reason: string;
      resolvedAt?: string | null;
    }>;
    notes?: string | null;
  }>;
};

function mapLooseStage(
  raw: LooseStage,
  locale: string,
  role: ProductionFlowRole,
): ProductionFlowStage {
  const def = raw.stageDefinition;
  const code = raw.code || def?.code || '';
  const nameEn = raw.nameEn ?? def?.nameEn ?? code;
  const nameAr = raw.nameAr ?? def?.nameAr ?? null;
  const nameHe = raw.nameHe ?? def?.nameHe ?? null;
  const name = localizedName(
    asLocale(locale),
    { nameEn, nameAr, nameHe },
    code,
  );
  const base: ProductionFlowStage = {
    code,
    name,
    status: String(raw.status ?? 'PENDING'),
    progressPercent: Number(raw.progressPercent ?? 0),
    dependsOnCodes: raw.dependsOnCodes ?? def?.dependsOnCodes ?? [],
    sortOrder: Number(raw.sortOrder ?? def?.sortOrder ?? 0),
    photos: (raw.photos ?? []).map((p) => ({
      id: p.id,
      fileName: p.fileName,
      mimeType: p.mimeType ?? null,
    })),
    ...emptyAdminFields(),
  };

  if (role !== 'admin') {
    // Dealers keep API-filtered photos (completed stages only).
    return { ...base, ...emptyAdminFields(), photos: base.photos };
  }

  // Prefer already-projected admin fields from API.
  if (Array.isArray(raw.assignees) || Array.isArray(raw.blockers)) {
    const taskNotes = (raw.tasks ?? [])
      .map((t) => t.notes?.trim())
      .filter(Boolean) as string[];
    const notes =
      raw.notes?.trim() ||
      (taskNotes.length ? taskNotes.join('\n\n') : null);
    return {
      ...base,
      assignees: raw.assignees ?? [],
      blockers: (raw.blockers ?? []).map((b) => ({
        id: b.id,
        category: b.category,
        reason: b.reason,
      })),
      actualStart: raw.actualStart ?? null,
      actualEnd: raw.actualEnd ?? null,
      plannedEnd: raw.plannedEnd ?? null,
      isOverdue: Boolean(raw.isOverdue),
      notes,
      attachmentCount: Number(raw.attachmentCount ?? base.photos.length),
      photos: base.photos.length
        ? base.photos
        : (raw.photos ?? []).map((p) => ({
            id: p.id,
            fileName: p.fileName,
            mimeType: p.mimeType ?? null,
          })),
    };
  }

  // Nested Prisma-shaped stages (production detail before/without flat projection).
  const assigneeMap = new Map<
    string,
    ProductionFlowStage['assignees'][number]
  >();
  const blockers: ProductionFlowStage['blockers'] = [];
  const taskNotes: string[] = [];
  if (raw.notes?.trim()) taskNotes.push(raw.notes.trim());
  for (const task of raw.tasks ?? []) {
    const emp = task.assignedEmployee;
    if (emp?.id) {
      const timing = task.timing;
      const actualMinutes = Math.max(
        0,
        Math.round(timing?.actualMinutes ?? task.actualMinutes ?? 0),
      );
      const actualSeconds = Math.max(
        0,
        Math.floor(
          timing?.actualSeconds ??
            Math.max(0, Math.floor(timing?.actualMinutes ?? task.actualMinutes ?? 0)) * 60,
        ),
      );
      const elapsedMinutes = Math.max(
        0,
        Math.round(timing?.elapsedMinutes ?? actualMinutes),
      );
      const running =
        timing?.status === 'running' ||
        (String(task.status ?? '').toUpperCase() === 'IN_PROGRESS' &&
          Boolean(timing?.openStartedAt));
      const prev = assigneeMap.get(emp.id);
      if (!prev) {
        assigneeMap.set(emp.id, {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`.trim(),
          elapsedMinutes,
          actualMinutes,
          actualSeconds,
          running,
          openStartedAt: timing?.openStartedAt ?? null,
          estimatedMinutes: timing?.estimatedMinutes ?? task.estimatedMinutes ?? null,
          plannedCompletion: timing?.plannedCompletion ?? task.plannedCompletion ?? null,
        });
      } else {
        assigneeMap.set(emp.id, {
          ...prev,
          elapsedMinutes: (prev.elapsedMinutes ?? 0) + elapsedMinutes,
          actualMinutes: (prev.actualMinutes ?? 0) + actualMinutes,
          actualSeconds: (prev.actualSeconds ?? 0) + actualSeconds,
          running: Boolean(prev.running) || running,
          openStartedAt:
            running && timing?.openStartedAt
              ? !prev.openStartedAt || timing.openStartedAt < prev.openStartedAt
                ? timing.openStartedAt
                : prev.openStartedAt
              : prev.openStartedAt ?? null,
        });
      }
    }
    for (const b of task.blockers ?? []) {
      if (!b.resolvedAt) {
        blockers.push({ id: b.id, category: b.category, reason: b.reason });
      }
    }
    if (task.notes?.trim()) taskNotes.push(task.notes.trim());
  }
  const notes = taskNotes.length ? [...new Set(taskNotes)].join('\n\n') : null;
  const plannedEnd = raw.plannedEnd ?? null;
  const incomplete = !['COMPLETED', 'SKIPPED', 'DONE'].includes(base.status);
  const isOverdue =
    incomplete &&
    plannedEnd != null &&
    new Date(plannedEnd).getTime() < Date.now();

  return {
    ...base,
    assignees: [...assigneeMap.values()],
    blockers,
    actualStart: raw.actualStart ?? null,
    actualEnd: raw.actualEnd ?? null,
    plannedEnd,
    isOverdue,
    notes,
    attachmentCount: Number(raw.attachmentCount ?? base.photos.length),
    photos: base.photos,
  };
}

/** Strip admin-only fields even if the API misbehaves. Keep work photos. */
export function enforceDealerStageStrip(stage: ProductionFlowStage): ProductionFlowStage {
  const next = { ...stage, ...emptyAdminFields(), photos: stage.photos ?? [] };
  for (const key of ADMIN_ONLY_KEYS) {
    if (key === 'assignees' || key === 'blockers') {
      next[key] = [] as never;
    } else if (key === 'isOverdue') {
      next.isOverdue = false;
    } else if (key === 'attachmentCount') {
      next.attachmentCount = 0;
    } else {
      next[key] = null as never;
    }
  }
  return next;
}

function pickStagesFromSalesOrder(order: SalesOrderDetail): LooseStage[] {
  const pos = order.productionOrders ?? [];
  if (!pos.length) return [];
  const best = pos.reduce((a, b) =>
    Number(b.progressPercent ?? 0) > Number(a.progressPercent ?? 0) ? b : a,
  );
  return (best.stages ?? []) as LooseStage[];
}

export function selectProductionFlowFromSalesOrder(
  order: SalesOrderDetail,
  role: ProductionFlowRole,
  locale = 'en',
): ProductionFlowModel {
  let stages = pickStagesFromSalesOrder(order).map((s) =>
    mapLooseStage(s, locale, role),
  );
  if (role === 'dealer') {
    stages = stages.map(enforceDealerStageStrip);
  }
  const committed = order.committedDeliveryDate ?? null;
  return {
    id: order.id,
    number: order.number,
    title: order.title,
    status: order.status,
    progressPercent: Number(order.progressPercent ?? 0),
    estimatedDelivery:
      committed ??
      order.requiredDeliveryDate ??
      order.requestedDeliveryDate ??
      order.customerRequest?.requiredDeliveryDate ??
      null,
    isCommittedDelivery: Boolean(committed),
    promiseState: order.promiseState ?? null,
    stages,
    role,
    source: 'sales-order',
  };
}

export function selectProductionFlowFromProductionOrder(
  order: ProductionOrderDetail,
  role: ProductionFlowRole,
  locale = 'en',
): ProductionFlowModel {
  let stages = ((order.stages ?? []) as LooseStage[]).map((s) =>
    mapLooseStage(s, locale, role),
  );
  if (role === 'dealer') {
    stages = stages.map(enforceDealerStageStrip);
  }
  const title =
    order.product?.nameEn ||
    order.productDescription ||
    order.number;
  const committed = order.committedDeliveryDate ?? null;
  return {
    id: order.id,
    number: order.number,
    title,
    status: order.status,
    progressPercent: Number(order.progressPercent ?? 0),
    estimatedDelivery: committed ?? order.requiredDeliveryDate ?? null,
    isCommittedDelivery: Boolean(committed),
    promiseState: order.promiseState ?? null,
    stages,
    role,
    source: 'production-order',
  };
}

export function selectProductionFlow(
  input:
    | { kind: 'sales-order'; order: SalesOrderDetail }
    | { kind: 'production-order'; order: ProductionOrderDetail },
  role: ProductionFlowRole,
  locale = 'en',
): ProductionFlowModel {
  if (input.kind === 'sales-order') {
    return selectProductionFlowFromSalesOrder(input.order, role, locale);
  }
  return selectProductionFlowFromProductionOrder(input.order, role, locale);
}

/** Next incomplete stage after `code` by sort order (admin drill-down). */
export function nextStageAfter(
  stages: ProductionFlowStage[],
  code: string,
): ProductionFlowStage | null {
  const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((s) => s.code === code);
  if (idx < 0) return null;
  return (
    sorted.slice(idx + 1).find((s) => !['COMPLETED', 'SKIPPED', 'DONE'].includes(s.status)) ??
    null
  );
}
