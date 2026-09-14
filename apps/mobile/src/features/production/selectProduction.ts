import type {
  AssignableWorker,
  ProductionBasketBoard,
  ProductionOrderDetail,
  ProductionOrderListItem,
  ProductionTask,
} from './api';
import type { ProductionHubOrderHrefInput } from './productionHubOrderHref';
import type { Locale } from '@maher/types';
import { localizedName } from '@maher/i18n';
import { formatDate, formatPercent, isolateLtr } from '@/i18n/format';
import { translate } from '@/i18n/translate';
import { complexityBadgeKey } from '@/features/sales-orders/orderManufacturingKind';

function asLocale(locale: string): Locale {
  return locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
}
function customerName(
  customer: ProductionOrderListItem['customer'],
  locale: string,
): string {
  if (!customer) return '—';
  if (locale === 'ar') {
    return customer.nameAr || customer.nameEn || customer.name || customer.code || '—';
  }
  if (locale === 'he') {
    return customer.nameHe || customer.nameEn || customer.name || customer.code || '—';
  }
  return customer.nameEn || customer.name || customer.nameAr || customer.code || '—';
}

function modelName(item: ProductionOrderListItem, locale: string): string {
  const p = item.product;
  if (locale === 'ar') {
    return p?.nameAr || p?.nameEn || item.productDescription || item.number;
  }
  if (locale === 'he') {
    return p?.nameHe || p?.nameEn || item.productDescription || item.number;
  }
  return p?.nameEn || p?.nameAr || item.productDescription || item.number;
}

function productionStageLabel(
  item: ProductionOrderListItem,
  locale: string,
): string | null {
  if (!item.currentStage) return null;
  const name = localizedName(locale, item.currentStage, '');
  return name || null;
}

export type ProductionCardModel = {
  id: string;
  number: string;
  title: string;
  dealerName: string;
  imageUrl: string | null;
  priority: string;
  status: string;
  progressPercent: number;
  /** Localized current floor stage */
  progressLabel: string | null;
  isLate: boolean;
  deliveryLabel: string | null;
  /** First readiness reason (attention / blocked board). */
  readinessReason: string | null;
  boardBucket: string | null;
  /** Sales order id for Needs Planning → canonical plan route. */
  salesOrderId: string | null;
  plannedStartDate: string | null;
  actualStartDate: string | null;
  releasedToFactoryAt: string | null;
  /**
   * Presentation-only when Ready for Factory and planned day is today/past.
   * Never implies lifecycle change.
   */
  startDueHint: 'due_today' | 'planned_start_passed' | null;
  origin: ProductionOriginModel | null;
  /** Explicitly never expose a stages list on cards */
  showStages: false;
};

export type ProductionOriginKind = 'RETURN_WORK' | 'REPLACEMENT';

export type ProductionOriginModel = {
  kind: ProductionOriginKind;
  number: string;
  originalOrderNumber: string | null;
  returnNumber: string | null;
};

export type ProductionTaskRow = {
  id: string;
  /** Localized stage name (falls back to task.name). */
  name: string;
  number: string;
  status: string;
  priority: string;
  progressPercent: number;
  notes: string;
  assigneeId: string | null;
  assigneeName: string | null;
  /** Localized / humanized responsible department for the stage. */
  departmentLabel: string | null;
  responsibleDepartment: string | null;
  canAssign: boolean;
  canHold: boolean;
  canBlock: boolean;
  canEditNotes: boolean;
  isCompleted: boolean;
  openBlockerCount: number;
  /** Logged work time from timer sessions. */
  elapsedMinutes: number;
  estimatedMinutes: number | null;
  timingStatus: string | null;
  plannedStart: string | null;
  plannedCompletion: string | null;
  /** Proven timer open / actual bookends — null when unknown. */
  actualStart: string | null;
  actualEnd: string | null;
  stageCode: string | null;
  stageDefinitionId: string | null;
  dependsOnCodes: string[];
};

export type ProductionDetailModel = ProductionCardModel & {
  notes: string | null;
  requiredDeliveryDate: string | null;
  tasks: ProductionTaskRow[];
  openBlockers: Array<{
    id: string;
    taskId: string;
    taskName: string;
    category: string;
    reason: string;
  }>;
  /** Usage-based manufacturing cost (all-in). Never catalog product cost. Never fake 0. */
  estimatedManufacturingCost: number | null;
  /** Actual manufacturing cost from the costing payload. */
  actualManufacturingCost: number | null;
  /** Admin production UI never renders a Production Stages section */
  showStages: false;
  /** Product is bound on the order — setup row, not a Setup screen. */
  planSetupReady: boolean;
  assignedWorkerCount: number;
  taskCount: number;
};

/**
 * Production-order floor badge. Backend status stays IN_PROGRESS;
 * the board bucket is in_production — one human name for both.
 */
export function productionFloorStatusLabel(
  status: string,
  inProductionLabel: string,
): string | undefined {
  const key = status.trim().toUpperCase().replace(/\s+/g, '_');
  if (key === 'IN_PROGRESS' || key === 'IN_PRODUCTION') return inProductionLabel;
  return undefined;
}

function toFiniteCost(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function utcDayMs(value: Date | string): number {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return NaN;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Presentation only — never used to mutate lifecycle. */
export function productionStartDueHint(
  item: {
    plannedStartDate?: string | null;
    actualStartDate?: string | null;
    releasedToFactoryAt?: string | null;
    status?: string | null;
  },
  now: Date = new Date(),
): 'due_today' | 'planned_start_passed' | null {
  if (item.actualStartDate) return null;
  if (!item.releasedToFactoryAt) return null;
  const status = String(item.status ?? '').toUpperCase();
  if (!['DRAFT', 'PLANNED', 'READY'].includes(status)) return null;
  if (!item.plannedStartDate) return null;
  const planned = utcDayMs(item.plannedStartDate);
  const today = utcDayMs(now);
  if (!Number.isFinite(planned) || !Number.isFinite(today)) return null;
  if (planned > today) return null;
  if (planned === today) return 'due_today';
  return 'planned_start_passed';
}

export function selectProductionOrigin(
  item: Pick<
    ProductionOrderListItem,
    'number' | 'originType' | 'returnRequest'
  >,
): ProductionOriginModel | null {
  const kind =
    item.originType === 'REPLACEMENT'
      ? 'REPLACEMENT'
      : item.originType === 'RETURN_WORK'
        ? 'RETURN_WORK'
        : null;
  if (!kind) return null;
  return {
    kind,
    number: item.number,
    originalOrderNumber: item.returnRequest?.salesOrder?.number?.trim() || null,
    returnNumber: item.returnRequest?.number?.trim() || null,
  };
}

export function selectProductionCard(
  item: ProductionOrderListItem,
  locale: string,
): ProductionCardModel {
  const firstReason = item.readiness?.reasons?.[0];
  return {
    id: item.id,
    number: item.number,
    title: modelName(item, locale),
    dealerName: customerName(item.customer, locale),
    imageUrl: item.imageUrl ?? item.product?.imageUrl ?? null,
    priority: String(item.priority || 'NORMAL'),
    status: item.status,
    progressPercent: Number(item.progressPercent ?? 0),
    progressLabel: productionStageLabel(item, locale),
    isLate: Boolean(item.isLate),
    deliveryLabel: item.requiredDeliveryDate
      ? formatDate(asLocale(locale), item.requiredDeliveryDate)
      : null,
    readinessReason:
      firstReason?.message ||
      firstReason?.stageName ||
      firstReason?.code ||
      null,
    boardBucket: item.readiness?.boardBucket
      ? String(item.readiness.boardBucket)
      : null,
    salesOrderId: item.salesOrder?.id ?? null,
    plannedStartDate: item.plannedStartDate ?? null,
    actualStartDate: item.actualStartDate ?? null,
    releasedToFactoryAt: item.releasedToFactoryAt ?? null,
    startDueHint: productionStartDueHint(item),
    origin: selectProductionOrigin(item),
    showStages: false,
  };
}

const ASSIGN_LOCKED = [
  'COMPLETED',
  'CANCELLED',
  'IN_PROGRESS',
  'PAUSED',
  'READY_FOR_INSPECTION',
  'BLOCKED',
];

function taskCanAssign(task: ProductionTask): boolean {
  return !ASSIGN_LOCKED.includes(task.status);
}

/** Stage title like admin: localized stage definition, else task.name. */
function taskDisplayName(task: ProductionTask, locale: string): string {
  if (task.stageDefinition) {
    const name = localizedName(locale, task.stageDefinition, '');
    if (name) return name;
  }
  return task.name;
}

function humanizeDeptCode(locale: string, code: string): string {
  const key = `production.deptCodes.${code.trim().toUpperCase()}`;
  const translated = translate(asLocale(locale), key);
  if (translated !== key) return translated;
  return code
    .trim()
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function departmentLabel(locale: string, code?: string | null): string | null {
  if (!code?.trim()) return null;
  return humanizeDeptCode(locale, code);
}

/** Prefer localized department name from a worker in that dept; else humanize the code. */
export function resolveDepartmentLabel(
  code: string | null | undefined,
  workers: AssignableWorker[],
  locale: string,
): string | null {
  if (!code?.trim()) return null;
  const fromWorker = workers.find((w) => w.department?.code === code)?.department;
  if (fromWorker) {
    return localizedName(locale, fromWorker, humanizeDeptCode(locale, code));
  }
  return humanizeDeptCode(locale, code);
}

/** Prefer workers in the stage department; if none match, keep the full list (skill-filtered by API). */
export function workersForStage(
  workers: AssignableWorker[],
  stageDept?: string | null,
): AssignableWorker[] {
  if (!stageDept) return workers;
  const matched = workers.filter((w) => w.department?.code === stageDept);
  return matched.length > 0 ? matched : workers;
}

export function selectProductionDetail(
  order: ProductionOrderDetail,
  locale: string,
): ProductionDetailModel {
  const card = selectProductionCard(order, locale);
  const dependsByCode = new Map<string, string[]>();
  for (const stage of order.stages ?? []) {
    const code = stage.code ?? stage.stageDefinition?.code;
    if (!code) continue;
    const deps =
      stage.dependsOnCodes ??
      stage.stageDefinition?.dependsOnCodes ??
      [];
    dependsByCode.set(code, deps.filter(Boolean));
  }
  const tasks = (order.tasks ?? []).map((task) => {
    const openBlockers = (task.blockers ?? []).filter((b) => !b.resolvedAt);
    const assignee = task.assignedEmployee
      ? `${task.assignedEmployee.firstName} ${task.assignedEmployee.lastName}`.trim()
      : null;
    const isCompleted = task.status === 'COMPLETED' || task.status === 'CANCELLED';
    const elapsedMinutes = Math.max(
      0,
      Math.round(
        task.timing?.elapsedMinutes ??
          task.actualMinutes ??
          0,
      ),
    );
    const stageCode = task.stageDefinition?.code ?? null;
    return {
      id: task.id,
      name: taskDisplayName(task, locale),
      number: task.number,
      status: task.status,
      priority: String(task.priority || 'NORMAL'),
      progressPercent: Number(task.progressPercent ?? 0),
      notes: task.notes ?? '',
      assigneeId: task.assignedEmployeeId ?? task.assignedEmployee?.id ?? null,
      assigneeName: assignee || null,
      departmentLabel: departmentLabel(locale, task.stageDefinition?.responsibleDepartment),
      responsibleDepartment: task.stageDefinition?.responsibleDepartment ?? null,
      canAssign: taskCanAssign(task),
      canHold: task.status === 'IN_PROGRESS',
      canBlock: !isCompleted && task.status !== 'BLOCKED',
      canEditNotes: !isCompleted,
      isCompleted: task.status === 'COMPLETED',
      openBlockerCount: openBlockers.length,
      elapsedMinutes,
      estimatedMinutes: task.timing?.estimatedMinutes ?? task.estimatedMinutes ?? null,
      timingStatus: task.timing?.status ?? null,
      plannedStart: task.plannedStart ?? null,
      plannedCompletion:
        task.plannedCompletion ?? task.timing?.plannedCompletion ?? null,
      actualStart: task.timing?.openStartedAt ?? null,
      actualEnd: task.actualCompletion ?? null,
      stageCode,
      stageDefinitionId: task.stageDefinition?.id ?? null,
      dependsOnCodes: stageCode ? dependsByCode.get(stageCode) ?? [] : [],
    };
  });

  const openBlockers = (order.openBlockers ?? []).map((b) => ({
    id: b.id,
    taskId: b.taskId ?? '',
    taskName: b.taskName ?? b.taskNumber ?? '—',
    category: b.category,
    reason: b.reason,
  }));

  return {
    ...card,
    notes: order.notes ?? null,
    requiredDeliveryDate: order.requiredDeliveryDate ?? null,
    tasks,
    openBlockers,
    estimatedManufacturingCost: toFiniteCost(order.manufacturingCosting?.estimatedTotal),
    actualManufacturingCost: toFiniteCost(order.manufacturingCosting?.actualTotal),
    showStages: false,
    planSetupReady: Boolean(order.product?.id),
    assignedWorkerCount: tasks.filter((task) => Boolean(task.assigneeId || task.assigneeName))
      .length,
    taskCount: tasks.length,
  };
}

export type ProductionBasketItemFact = {
  kind: 'stage' | 'planned' | 'actual' | 'idle';
  text: string;
};

export type ProductionBasketItemModel = {
  id: string;
  title: string;
  imageUrl: string | null;
  complexity: 'standard' | 'modified' | 'custom';
  status: string;
  progressPercent: number;
  isLate: boolean;
  blocked: boolean;
  matched: boolean;
  fact: ProductionBasketItemFact;
  href: ProductionHubOrderHrefInput;
  showStages: false;
};

export type ProductionBasketBoardModel = {
  id: string;
  salesOrderId: string | null;
  number: string;
  dealerName: string;
  status: string;
  isLate: boolean;
  blocked: boolean;
  readinessReason: string | null;
  deliveryLabel: string | null;
  origin: ProductionOriginModel | null;
  progressPercent: number;
  doneCount: number;
  itemCount: number;
  items: ProductionBasketItemModel[];
  href: ProductionHubOrderHrefInput;
  showStages: false;
};

function formatClock(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function dayLensStageName(
  row: {
    stageNameEn?: string | null;
    stageNameAr?: string | null;
    stageNameHe?: string | null;
    stage?: string | null;
  },
  locale: string,
): string | null {
  const named =
    locale === 'ar'
      ? row.stageNameAr || row.stageNameEn || row.stage
      : locale === 'he'
        ? row.stageNameHe || row.stageNameEn || row.stage
        : row.stageNameEn || row.stage;
  const trimmed = named?.trim() || '';
  if (!trimmed || /^[A-Z][A-Z0-9_]{2,}$/.test(trimmed)) return null;
  return trimmed;
}

function eventKindLabel(kind: string, t?: (key: string) => string): string {
  if (!t) return kind;
  const key = `mobile.production.dayLens.event.${kind}`;
  const label = t(key);
  return label === key ? t('mobile.production.dayLens.event.unknown') : label;
}

export function selectProductionBasketItemFact(
  item: ProductionOrderListItem,
  locale: string,
  opts?: { dateScope?: 'day' | 'all'; t?: (key: string) => string },
): ProductionBasketItemFact {
  const dateScope = opts?.dateScope ?? 'all';
  if (dateScope === 'day') {
    const lens = item.dayLens;
    if (lens?.mode === 'planned') {
      const task = [...(lens.plannedTasks ?? [])].sort((a, b) => {
        const as = a.plannedStart ? new Date(a.plannedStart).getTime() : 0;
        const bs = b.plannedStart ? new Date(b.plannedStart).getTime() : 0;
        return as - bs;
      })[0];
      if (task) {
        const stage =
          locale === 'ar'
            ? task.stageNameAr || task.stageNameEn
            : locale === 'he'
              ? task.stageNameHe || task.stageNameEn
              : task.stageNameEn;
        const start = formatClock(task.plannedStart, locale);
        const end = formatClock(task.plannedCompletion, locale);
        const window = start && end ? isolateLtr(`${start}–${end}`) : start || end;
        const text = [stage, task.workerName, window].filter(Boolean).join(' · ');
        return { kind: 'planned', text: text || '—' };
      }
    }
    if (lens?.mode === 'actual') {
      const ev = [...(lens.events ?? [])].sort((a, b) => {
        const at = a.at ? new Date(a.at).getTime() : 0;
        const bt = b.at ? new Date(b.at).getTime() : 0;
        return at - bt;
      })[0];
      if (ev) {
        const stage = dayLensStageName(ev, locale);
        const text = [eventKindLabel(ev.kind, opts?.t), stage].filter(Boolean).join(' · ');
        return { kind: 'actual', text: text || '—' };
      }
    }
    return { kind: 'idle', text: '—' };
  }

  const pct = Math.max(0, Math.min(100, Math.round(Number(item.progressPercent ?? 0))));
  const stage = productionStageLabel(item, locale);
  const text = stage
    ? `${stage} · ${formatPercent(asLocale(locale), pct)}`
    : formatPercent(asLocale(locale), pct);
  return { kind: 'stage', text };
}

function hrefFromItem(item: ProductionOrderListItem): ProductionHubOrderHrefInput {
  return {
    id: item.id,
    salesOrderId: item.salesOrder?.id ?? item.salesOrderId ?? null,
    releasedToFactoryAt: item.releasedToFactoryAt ?? null,
    originType: item.originType,
  };
}

function rollupBoardStatus(items: ProductionOrderListItem[]): string {
  if (items.length === 0) return 'PLANNED';
  const blocked = items.find(
    (item) =>
      item.readiness?.boardBucket === 'blocked' ||
      item.status === 'BLOCKED' ||
      item.status === 'ON_HOLD',
  );
  if (blocked) return blocked.status;
  if (items.every((item) => item.status === 'COMPLETED')) return 'COMPLETED';
  if (items.some((item) => item.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
  return items[0]?.status ?? 'PLANNED';
}

function itemDone(item: ProductionOrderListItem): boolean {
  if (item.status === 'COMPLETED') return true;
  return Math.round(Number(item.progressPercent ?? 0)) >= 100;
}

export function selectProductionBasketItem(
  item: ProductionOrderListItem,
  locale: string,
  opts?: { dateScope?: 'day' | 'all'; t?: (key: string) => string },
): ProductionBasketItemModel {
  const card = selectProductionCard(item, locale);
  return {
    id: item.id,
    title: card.title,
    imageUrl: card.imageUrl,
    complexity: complexityBadgeKey(
      item.manufacturingComplexity ?? item.salesOrderLine?.manufacturingComplexity,
    ),
    status: item.status,
    progressPercent: card.progressPercent,
    isLate: card.isLate,
    blocked: card.boardBucket === 'blocked',
    matched: item.matched !== false,
    fact: selectProductionBasketItemFact(item, locale, opts),
    href: hrefFromItem(item),
    showStages: false,
  };
}

export function selectProductionBasketBoard(
  board: ProductionBasketBoard,
  locale: string,
  opts?: { dateScope?: 'day' | 'all'; t?: (key: string) => string },
): ProductionBasketBoardModel {
  const items = board.items ?? [];
  const mapped = items.map((item) => selectProductionBasketItem(item, locale, opts));
  const highlightMatches = mapped.some((item) => !item.matched);
  const itemsForBoard = highlightMatches
    ? mapped
    : mapped.map((item) => ({ ...item, matched: false }));
  const first = items[0];
  const card = first ? selectProductionCard(first, locale) : null;
  const progressValues = mapped.map((item) => item.progressPercent);
  const progressPercent =
    progressValues.length === 0
      ? 0
      : Math.round(
          progressValues.reduce((sum, n) => sum + n, 0) / progressValues.length,
        );
  const deliveryMs = items
    .map((item) =>
      item.requiredDeliveryDate ? new Date(item.requiredDeliveryDate).getTime() : NaN,
    )
    .filter((n) => Number.isFinite(n));
  const earliestDelivery = deliveryMs.length
    ? new Date(Math.min(...deliveryMs)).toISOString()
    : null;
  const blockedItem = mapped.find((item) => item.blocked);
  const firstReason = items.find((item) => item.readiness?.reasons?.[0])?.readiness?.reasons?.[0];

  return {
    id: board.id,
    salesOrderId: board.salesOrderId ?? first?.salesOrder?.id ?? null,
    number: first?.salesOrder?.number ?? first?.number ?? board.id,
    dealerName: card?.dealerName ?? '—',
    status: rollupBoardStatus(items),
    isLate: mapped.some((item) => item.isLate),
    blocked: Boolean(blockedItem),
    readinessReason:
      firstReason?.message || firstReason?.stageName || firstReason?.code || null,
    deliveryLabel: earliestDelivery ? formatDate(asLocale(locale), earliestDelivery) : null,
    origin: first ? selectProductionOrigin(first) : null,
    progressPercent,
    doneCount: items.filter(itemDone).length,
    itemCount: mapped.length,
    items: itemsForBoard,
    href: mapped[0]?.href ?? { id: board.id, salesOrderId: board.salesOrderId },
    showStages: false,
  };
}
