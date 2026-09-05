/**
 * Production Attention — WHAT / WHY / WHAT NEXT.
 * Never surface raw readiness codes to the UI.
 */

import type { Href } from 'expo-router';
import type { ProductionReadinessReason } from '@/api/modules/production';

export type ProductionAttentionCode =
  | 'MISSING_ASSIGNMENT'
  | 'MISSING_DATE'
  | 'MISSING_PRODUCTION_START'
  | 'NO_EXECUTABLE_TASKS'
  | 'MATERIALS_HOLD'
  | 'STATUS_NOT_STARTABLE'
  | 'OPEN_BLOCKER'
  | 'QUALITY_FAILED'
  | 'SEMI_ISSUE'
  | 'TASK_LATE'
  | 'SCHEDULE_CONFLICT'
  | 'WORKER_ISSUE'
  | 'FABRIC_NOT_ORDERED'
  | 'FABRIC_AWAITING_SUPPLIER'
  | 'FABRIC_UNAVAILABLE'
  | 'FABRIC_PARTIAL'
  | 'FABRIC_LATE'
  | 'FABRIC_LOCATION_MISSING'
  | 'FABRIC_READY_NOT_TAKEN'
  | 'FABRIC_WRONG_RECEIVED'
  | 'FABRIC_HOLD_OVERRIDDEN'
  | 'GENERIC';

export type ProductionAttentionCtaKind =
  | 'purchasing'
  | 'scheduling'
  | 'wip'
  | 'quality'
  | 'manage_task'
  | 'production'
  | 'none';

export type ProductionAttentionBlock = {
  code: ProductionAttentionCode;
  /** i18n key under mobile.production.attention.what.* */
  whatKey: string;
  /** i18n key under mobile.production.attention.why.* */
  whyKey: string;
  whyParams?: Record<string, string | number>;
  /** Optional proven human detail (never a raw code). */
  whyDetail?: string | null;
  /** i18n key under mobile.production.attention.next.* */
  nextKey: string;
  ctaKind: ProductionAttentionCtaKind;
  taskId?: string | null;
  stageName?: string | null;
};

const CODE_SET = new Set<string>([
  'MISSING_ASSIGNMENT',
  'MISSING_DATE',
  'MISSING_PRODUCTION_START',
  'NO_EXECUTABLE_TASKS',
  'MATERIALS_HOLD',
  'STATUS_NOT_STARTABLE',
  'OPEN_BLOCKER',
  'QUALITY_FAILED',
  'SEMI_ISSUE',
  'SEMI_HANDOFF_MISMATCH',
  'WAITING_FOR_MATERIALS',
  'TASK_LATE',
  'SCHEDULE_CONFLICT',
  'WORKER_ISSUE',
  'FABRIC_NOT_ORDERED',
  'FABRIC_AWAITING_SUPPLIER',
  'FABRIC_UNAVAILABLE',
  'FABRIC_PARTIAL',
  'FABRIC_LATE',
  'FABRIC_LOCATION_MISSING',
  'FABRIC_READY_NOT_TAKEN',
  'FABRIC_WRONG_RECEIVED',
  'FABRIC_HOLD_OVERRIDDEN',
]);

/** True when a string is a raw backend token we must not render. */
export function isRawAttentionToken(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const t = value.trim();
  if (CODE_SET.has(t)) return true;
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(t)) return true;
  return false;
}

function normalizeCode(raw: string | null | undefined): ProductionAttentionCode {
  const c = String(raw ?? '').trim().toUpperCase();
  if (c === 'WAITING_FOR_MATERIALS' || c === 'MATERIALS_HOLD') return 'MATERIALS_HOLD';
  if (c === 'SEMI_HANDOFF_MISMATCH' || c === 'SEMI_MISSING') return 'SEMI_ISSUE';
  if (c === 'QUALITY_FAILED' || c === 'QC_FAILED' || c === 'INSPECTION_FAILED') {
    return 'QUALITY_FAILED';
  }
  if (
    c === 'MISSING_ASSIGNMENT' ||
    c === 'MISSING_DATE' ||
    c === 'MISSING_PRODUCTION_START' ||
    c === 'NO_EXECUTABLE_TASKS' ||
    c === 'STATUS_NOT_STARTABLE' ||
    c === 'OPEN_BLOCKER' ||
    c === 'TASK_LATE' ||
    c === 'SCHEDULE_CONFLICT' ||
    c === 'WORKER_ISSUE' ||
    c === 'SEMI_ISSUE' ||
    c === 'FABRIC_NOT_ORDERED' ||
    c === 'FABRIC_AWAITING_SUPPLIER' ||
    c === 'FABRIC_UNAVAILABLE' ||
    c === 'FABRIC_PARTIAL' ||
    c === 'FABRIC_LATE' ||
    c === 'FABRIC_LOCATION_MISSING' ||
    c === 'FABRIC_READY_NOT_TAKEN' ||
    c === 'FABRIC_WRONG_RECEIVED' ||
    c === 'FABRIC_HOLD_OVERRIDDEN'
  ) {
    return c;
  }
  return 'GENERIC';
}

function ctaFor(code: ProductionAttentionCode): ProductionAttentionCtaKind {
  switch (code) {
    case 'MATERIALS_HOLD':
    case 'FABRIC_NOT_ORDERED':
    case 'FABRIC_AWAITING_SUPPLIER':
    case 'FABRIC_UNAVAILABLE':
    case 'FABRIC_PARTIAL':
    case 'FABRIC_LATE':
    case 'FABRIC_LOCATION_MISSING':
    case 'FABRIC_READY_NOT_TAKEN':
    case 'FABRIC_WRONG_RECEIVED':
    case 'FABRIC_HOLD_OVERRIDDEN':
      return 'purchasing';
    case 'MISSING_DATE':
    case 'MISSING_PRODUCTION_START':
    case 'SCHEDULE_CONFLICT':
    case 'TASK_LATE':
      return 'scheduling';
    case 'SEMI_ISSUE':
      return 'wip';
    case 'QUALITY_FAILED':
      return 'quality';
    case 'MISSING_ASSIGNMENT':
    case 'WORKER_ISSUE':
    case 'OPEN_BLOCKER':
      return 'manage_task';
    case 'NO_EXECUTABLE_TASKS':
    case 'STATUS_NOT_STARTABLE':
      return 'production';
    default:
      return 'production';
  }
}

/**
 * Map a readiness reason to a human Attention block.
 * Prefers structured i18n; uses message only when it is not a raw code.
 */
export function mapReadinessReasonToAttention(
  reason: ProductionReadinessReason,
): ProductionAttentionBlock {
  const code = normalizeCode(reason.code);
  const stageName = reason.stageName?.trim() || null;
  const message = reason.message?.trim() || null;
  const whyDetail =
    message && !isRawAttentionToken(message) ? message : null;

  return {
    code,
    whatKey: `mobile.production.attention.what.${code}`,
    whyKey: `mobile.production.attention.why.${code}`,
    whyParams: stageName ? { stage: stageName } : undefined,
    whyDetail,
    nextKey: `mobile.production.attention.next.${code}`,
    ctaKind: ctaFor(code),
    taskId: reason.taskId ?? null,
    stageName,
  };
}

export function mapBlockerToAttention(blocker: {
  id: string;
  category?: string | null;
  reason?: string | null;
  taskId?: string | null;
  taskName?: string | null;
}): ProductionAttentionBlock {
  const cat = String(blocker.category ?? '').toUpperCase();
  let code: ProductionAttentionCode = 'OPEN_BLOCKER';
  if (cat.includes('QUALITY') || cat.includes('QC') || cat.includes('INSPECT')) {
    code = 'QUALITY_FAILED';
  } else if (cat.includes('MATERIAL') || cat.includes('STOCK')) {
    code = 'MATERIALS_HOLD';
  } else if (cat.includes('SEMI') || cat.includes('WIP') || cat.includes('HANDOFF')) {
    code = 'SEMI_ISSUE';
  } else if (cat.includes('SCHEDULE') || cat.includes('LATE')) {
    code = 'TASK_LATE';
  } else if (cat.includes('WORKER') || cat.includes('ASSIGN')) {
    code = 'WORKER_ISSUE';
  }

  const detail = blocker.reason?.trim() || null;
  const whyDetail =
    detail && !isRawAttentionToken(detail) ? detail : null;

  return {
    code,
    whatKey: `mobile.production.attention.what.${code}`,
    whyKey: `mobile.production.attention.why.${code}`,
    whyParams: blocker.taskName ? { stage: blocker.taskName } : undefined,
    whyDetail,
    nextKey: `mobile.production.attention.next.${code}`,
    ctaKind: ctaFor(code),
    taskId: blocker.taskId ?? null,
    stageName: blocker.taskName ?? null,
  };
}

/** Collect Attention blocks for Production Detail (reasons + open blockers). */
export function collectProductionAttention(input: {
  reasons?: ProductionReadinessReason[] | null;
  blockers?: Array<{
    id: string;
    category?: string | null;
    reason?: string | null;
    taskId?: string | null;
    taskName?: string | null;
  }> | null;
  isLate?: boolean;
}): ProductionAttentionBlock[] {
  const out: ProductionAttentionBlock[] = [];
  const seen = new Set<string>();

  for (const reason of input.reasons ?? []) {
    const block = mapReadinessReasonToAttention(reason);
    const key = `${block.code}:${block.taskId ?? ''}:${block.stageName ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(block);
  }

  for (const blocker of input.blockers ?? []) {
    const block = mapBlockerToAttention(blocker);
    const key = `blocker:${blocker.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(block);
  }

  if (input.isLate && !out.some((b) => b.code === 'TASK_LATE')) {
    out.push({
      code: 'TASK_LATE',
      whatKey: 'mobile.production.attention.what.TASK_LATE',
      whyKey: 'mobile.production.attention.why.TASK_LATE',
      nextKey: 'mobile.production.attention.next.TASK_LATE',
      ctaKind: 'scheduling',
    });
  }

  return out;
}

export function attentionCtaHref(
  block: ProductionAttentionBlock,
  ctx: { productionOrderId: string; salesOrderId?: string | null },
): Href | null {
  switch (block.ctaKind) {
    case 'purchasing':
      return '/(app)/(admin)/purchasing?tab=fabric' as Href;
    case 'scheduling':
      return '/(app)/(admin)/scheduling' as Href;
    case 'wip':
      return `/(app)/(admin)/production/${ctx.productionOrderId}?hub=wip` as Href;
    case 'quality':
      return `/(app)/(admin)/production/${ctx.productionOrderId}?hub=tasks` as Href;
    case 'manage_task':
      if (block.taskId) {
        return `/(app)/(admin)/production/tasks/${block.taskId}?orderId=${ctx.productionOrderId}&manage=1` as Href;
      }
      return `/(app)/(admin)/production/${ctx.productionOrderId}?hub=tasks` as Href;
    case 'production':
      return `/(app)/(admin)/production/${ctx.productionOrderId}` as Href;
    default:
      return null;
  }
}
