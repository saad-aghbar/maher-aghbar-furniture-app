import type {
  AssignableWorker,
  ProductionOrderDetail,
  ProductionOrderListItem,
  ProductionTask,
} from './api';
import type { Locale } from '@maher/types';
import { localizedName } from '@maher/i18n';
import { formatDate } from '@/i18n/format';

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
  /** Explicitly never expose a stages list on cards */
  showStages: false;
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
  /** Catalog estimate only — null when the backend did not send a cost. Never fake 0. */
  estimatedManufacturingCost: number | null;
  /** Actual manufacturing cost when the backend provides one. */
  actualManufacturingCost: number | null;
  /** Admin production UI never renders a Production Stages section */
  showStages: false;
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

export function selectProductionCard(
  item: ProductionOrderListItem,
  locale: string,
): ProductionCardModel {
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

function humanizeDeptCode(code: string): string {
  return code
    .trim()
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function departmentLabel(code?: string | null): string | null {
  if (!code?.trim()) return null;
  return humanizeDeptCode(code);
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
    return localizedName(locale, fromWorker, humanizeDeptCode(code));
  }
  return humanizeDeptCode(code);
}

/** Workers whose department matches the stage’s responsible department. */
export function workersForStage(
  workers: AssignableWorker[],
  stageDept?: string | null,
): AssignableWorker[] {
  if (!stageDept) return workers;
  return workers.filter((w) => w.department?.code === stageDept);
}

export function selectProductionDetail(
  order: ProductionOrderDetail,
  locale: string,
): ProductionDetailModel {
  const card = selectProductionCard(order, locale);
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
      departmentLabel: departmentLabel(task.stageDefinition?.responsibleDepartment),
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
    estimatedManufacturingCost: toFiniteCost(order.product?.manufacturingCost),
    actualManufacturingCost: null,
    showStages: false,
  };
}
