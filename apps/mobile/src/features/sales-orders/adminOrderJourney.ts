/**
 * Single admin Order Journey classifier — chips, counts, list filter, card CTA.
 * Attention is a soft badge on the home bucket — not its own chip/section.
 *
 * Preparing ↔ Production boundary = Release to factory (not setup RELEASED / plan-save).
 */

import type { AdminOrderLifecycle } from './adminOrderLifecycle';

export type JourneyAttentionSeverity = 'warning' | 'critical' | 'info';

export type JourneyAttentionAction =
  | 'fix_setup'
  | 'review_request'
  | 'view_shortage'
  | 'assign_workers'
  | 'view_hold'
  | 'review_overdue'
  | 'open_order'
  | 'open_returns'
  | 'review_finance'
  | 'review_semi';

export type JourneyAttention = {
  reasonCode:
    | 'ON_HOLD'
    | 'WAITING_FOR_MATERIALS'
    | 'OVERDUE'
    | 'SETUP_INCOMPLETE'
    | 'WORKERS_MISSING'
    | 'NEEDS_REVIEW'
    | 'PENDING_RETURN'
    | 'CANCEL_FINANCE'
    | 'SEMI_DISPOSITION';
  reasonLabelKey: string;
  severity: JourneyAttentionSeverity;
  action: JourneyAttentionAction;
  actionLabelKey: string;
};

export type JourneyReadiness = {
  setupReady: boolean;
  materialsReady: boolean;
  workflowReady: boolean;
  hasShortage: boolean;
};

export type JourneyPrimaryCta =
  | 'continue_setup'
  | 'review_setup'
  | 'release'
  | 'assign_workers'
  | 'open_order'
  | 'review_request'
  | 'edit_plan';

export type AdminOrderJourneyInput = {
  status: string;
  deliveryStatus?: string | null;
  requiredDeliveryDate?: string | null;
  isRfq?: boolean;
  /** True when SO is DRAFT with 0 POs / setup not complete */
  productionSetupRequired?: boolean;
  productionSetupStatus?: string | null;
  productionOrderCount?: number;
  /** Hard boundary: Release to factory crossed (plan locked; may still be Ready to start). */
  releasedToFactory?: boolean;
  releasedToFactoryAt?: string | null;
  /**
   * True when at least one executable factory task has actually started
   * (PO actualStartDate / IN_PROGRESS+). Drives Orders In Production presentation.
   */
  executionStarted?: boolean;
  productionReadinessSummary?: {
    canStart?: boolean;
    needsSetup?: boolean;
    actionHint?: string | null;
    material?: { ready?: boolean; shortCount?: number } | null;
    assignment?: { required?: number; assigned?: number; missingCount?: number };
  } | null;
  progressPercent?: number | null;
  currentStageLabel?: string | null;
  now?: Date;
  /** Piece 11 — open return needing admin action */
  hasPendingReturn?: boolean;
  /** Piece 11 — cancelled (or cancelling) with invoice/payment attention */
  cancelFinanceAttention?: boolean;
  /** Piece 11 — SEMI lots flagged REQUIRES_REVIEW after cancel */
  semiDispositionRequired?: boolean;
};

export type AdminOrderJourney = {
  journeyBucket: AdminOrderLifecycle;
  attention?: JourneyAttention;
  readiness: JourneyReadiness;
  primaryCta: JourneyPrimaryCta;
};

const DONE = new Set(['DELIVERED', 'COMPLETED', 'CANCELLED']);

function isOverdue(date: string | null | undefined, status: string, now: Date): boolean {
  if (!date || DONE.has(status.toUpperCase())) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  return t < now.getTime();
}

function isFactoryReleased(input: AdminOrderJourneyInput): boolean {
  if (input.releasedToFactory === true) return true;
  if (input.releasedToFactoryAt) return true;
  return false;
}

/** Actual floor execution underway — not merely Released / Ready to start. */
function isExecutionStarted(input: AdminOrderJourneyInput): boolean {
  if (input.executionStarted === true) return true;
  const so = String(input.status ?? '').toUpperCase();
  return so === 'IN_PRODUCTION';
}

/**
 * Orders → Preparing until Release to factory.
 * Setup may be RELEASED and POs may exist as PLANNED — still Preparing.
 * READY_FOR_PRODUCTION without releasedToFactory is still Preparing (post-setup, pre-release).
 * ON_HOLD stays in Preparing when not yet released (soft badge).
 */
function isPreparing(input: AdminOrderJourneyInput): boolean {
  if (isFactoryReleased(input) || isExecutionStarted(input)) return false;
  const so = String(input.status ?? '').toUpperCase();
  if (DONE.has(so)) return false;
  if (so === 'READY_FOR_DELIVERY') return false;
  if (so === 'IN_PRODUCTION') return false;
  return (
    so === 'DRAFT' ||
    so === 'CONFIRMED' ||
    so === 'WAITING_FOR_PAYMENT' ||
    so === 'WAITING_FOR_MATERIALS' ||
    so === 'READY_FOR_PRODUCTION' ||
    so === 'ON_HOLD'
  );
}

function resolveAttention(input: AdminOrderJourneyInput, now: Date): JourneyAttention | undefined {
  const so = String(input.status ?? '').toUpperCase();
  const readiness = input.productionReadinessSummary;

  if (input.hasPendingReturn) {
    return {
      reasonCode: 'PENDING_RETURN',
      reasonLabelKey: 'lifecycle.attention.PENDING_RETURN',
      severity: 'warning',
      action: 'open_returns',
      actionLabelKey: 'lifecycle.attention.action_open_returns',
    };
  }
  if (input.cancelFinanceAttention) {
    return {
      reasonCode: 'CANCEL_FINANCE',
      reasonLabelKey: 'lifecycle.attention.CANCEL_FINANCE',
      severity: 'critical',
      action: 'review_finance',
      actionLabelKey: 'lifecycle.attention.action_review_finance',
    };
  }
  if (input.semiDispositionRequired) {
    return {
      reasonCode: 'SEMI_DISPOSITION',
      reasonLabelKey: 'lifecycle.attention.SEMI_DISPOSITION',
      severity: 'warning',
      action: 'review_semi',
      actionLabelKey: 'lifecycle.attention.action_review_semi',
    };
  }

  if (so === 'ON_HOLD') {
    return {
      reasonCode: 'ON_HOLD',
      reasonLabelKey: 'mobile.orders.attention.ON_HOLD',
      severity: 'critical',
      action: 'view_hold',
      actionLabelKey: 'mobile.orders.attentionAction.view_hold',
    };
  }
  // Materials hold after factory release → soft badge on Ready to start / In production.
  if (so === 'WAITING_FOR_MATERIALS' && isFactoryReleased(input)) {
    return {
      reasonCode: 'WAITING_FOR_MATERIALS',
      reasonLabelKey: 'mobile.orders.attention.WAITING_FOR_MATERIALS',
      severity: 'warning',
      action: 'view_shortage',
      actionLabelKey: 'mobile.orders.attentionAction.view_shortage',
    };
  }
  if (isOverdue(input.requiredDeliveryDate, so, now)) {
    return {
      reasonCode: 'OVERDUE',
      reasonLabelKey: 'mobile.orders.attention.OVERDUE',
      severity: 'critical',
      action: 'review_overdue',
      actionLabelKey: 'mobile.orders.attentionAction.review_overdue',
    };
  }
  if (readiness?.needsSetup && !isPreparing(input)) {
    return {
      reasonCode: 'SETUP_INCOMPLETE',
      reasonLabelKey: 'mobile.orders.attention.SETUP_INCOMPLETE',
      severity: 'warning',
      action: 'fix_setup',
      actionLabelKey: 'mobile.orders.attentionAction.fix_setup',
    };
  }
  if ((readiness?.assignment?.missingCount ?? 0) > 0 && isFactoryReleased(input)) {
    return {
      reasonCode: 'WORKERS_MISSING',
      reasonLabelKey: 'mobile.orders.attention.WORKERS_MISSING',
      severity: 'info',
      action: 'assign_workers',
      actionLabelKey: 'mobile.orders.attentionAction.assign_workers',
    };
  }
  return undefined;
}

function primaryCtaFor(
  bucket: AdminOrderLifecycle,
  attention: JourneyAttention | undefined,
  input: AdminOrderJourneyInput,
): JourneyPrimaryCta {
  if (input.isRfq) return 'review_request';
  if (attention?.action === 'fix_setup') return 'continue_setup';
  if (attention?.action === 'assign_workers') return 'assign_workers';
  if (bucket === 'ready_to_start') return 'edit_plan';
  if (bucket === 'preparing') {
    if (input.productionSetupRequired || input.productionSetupStatus !== 'RELEASED') {
      if (input.productionSetupStatus === 'READY_FOR_RELEASE') return 'release';
      return 'continue_setup';
    }
    if (input.productionReadinessSummary?.canStart) return 'release';
    return 'assign_workers';
  }
  if (bucket === 'in_production') return 'open_order';
  return 'open_order';
}

/**
 * Authoritative journey classification for admin Orders desk.
 * Never returns `needs_attention` as a bucket — attention rides as a soft badge.
 */
export function classifyAdminOrderJourney(input: AdminOrderJourneyInput): AdminOrderJourney {
  const so = String(input.status ?? '').toUpperCase();
  const del = String(input.deliveryStatus ?? '').toUpperCase();
  const now = input.now ?? new Date();
  const readinessSummary = input.productionReadinessSummary;

  const readiness: JourneyReadiness = {
    setupReady:
      input.productionSetupStatus === 'READY_FOR_RELEASE' ||
      input.productionSetupStatus === 'RELEASED' ||
      !isPreparing(input),
    materialsReady: readinessSummary?.material?.ready !== false,
    workflowReady: !readinessSummary?.needsSetup,
    hasShortage: (readinessSummary?.material?.shortCount ?? 0) > 0,
  };

  if (input.isRfq) {
    return {
      journeyBucket: 'rfq',
      readiness,
      primaryCta: 'review_request',
    };
  }

  if (so === 'DELIVERED' || so === 'COMPLETED' || del === 'DELIVERED') {
    return {
      journeyBucket: 'delivered',
      attention: resolveAttention(input, now),
      readiness,
      primaryCta: 'open_order',
    };
  }
  if (del === 'OUT_FOR_DELIVERY') {
    return {
      journeyBucket: 'shipped',
      attention: resolveAttention(input, now),
      readiness,
      primaryCta: 'open_order',
    };
  }
  if (so === 'READY_FOR_DELIVERY' || del === 'PLANNED' || del === 'READY') {
    return {
      journeyBucket: 'ready_to_ship',
      attention: resolveAttention(input, now),
      readiness,
      primaryCta: 'open_order',
    };
  }

  // Released to factory but no executable task started yet → Ready to start
  if (isFactoryReleased(input) && !isExecutionStarted(input)) {
    const attention = resolveAttention(input, now);
    return {
      journeyBucket: 'ready_to_start',
      attention,
      readiness,
      primaryCta: primaryCtaFor('ready_to_start', attention, input),
    };
  }

  // First real task started → Orders In Production
  if (isExecutionStarted(input)) {
    const attention = resolveAttention(input, now);
    return {
      journeyBucket: 'in_production',
      attention,
      readiness,
      primaryCta: 'open_order',
    };
  }

  if (isPreparing(input)) {
    const attention = resolveAttention(input, now);
    return {
      journeyBucket: 'preparing',
      attention,
      readiness,
      primaryCta: primaryCtaFor('preparing', attention, input),
    };
  }

  const attention = resolveAttention(input, now);
  return {
    journeyBucket: 'preparing',
    attention,
    readiness,
    primaryCta: primaryCtaFor('preparing', attention, input),
  };
}

/** Back-compat wrapper — bucket only. Prefer classifyAdminOrderJourney. */
export function journeyBucketOf(input: AdminOrderJourneyInput): AdminOrderLifecycle {
  return classifyAdminOrderJourney(input).journeyBucket;
}
