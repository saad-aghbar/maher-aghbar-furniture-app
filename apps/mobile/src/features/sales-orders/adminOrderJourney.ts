/**
 * Single admin Order Journey classifier — chips, counts, list filter, card CTA.
 * Attention is a cross-cut queue with reasons, not a domain status.
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
  | 'review_request';

export type AdminOrderJourneyInput = {
  status: string;
  deliveryStatus?: string | null;
  requiredDeliveryDate?: string | null;
  isRfq?: boolean;
  /** True when SO is DRAFT with 0 POs / setup not RELEASED */
  productionSetupRequired?: boolean;
  productionSetupStatus?: string | null;
  productionOrderCount?: number;
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

function isPreparing(input: AdminOrderJourneyInput): boolean {
  const so = String(input.status ?? '').toUpperCase();
  if (so !== 'DRAFT') return false;
  if (input.productionSetupStatus === 'RELEASED') return false;
  if ((input.productionOrderCount ?? 0) > 0) return false;
  if (input.productionSetupRequired === false) return false;
  return true;
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
  if (so === 'WAITING_FOR_MATERIALS') {
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
  if (readiness?.needsSetup || isPreparing(input)) {
    // Only attention when setup is incomplete AND not just sitting in Preparing bucket
    if (readiness?.needsSetup && !isPreparing(input)) {
      return {
        reasonCode: 'SETUP_INCOMPLETE',
        reasonLabelKey: 'mobile.orders.attention.SETUP_INCOMPLETE',
        severity: 'warning',
        action: 'fix_setup',
        actionLabelKey: 'mobile.orders.attentionAction.fix_setup',
      };
    }
  }
  if ((readiness?.assignment?.missingCount ?? 0) > 0) {
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
  if (bucket === 'preparing') {
    if (input.productionSetupStatus === 'READY_FOR_RELEASE') return 'release';
    return 'continue_setup';
  }
  if (bucket === 'ready_to_start') return 'assign_workers';
  return 'open_order';
}

/**
 * Authoritative journey classification for admin Orders desk.
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
    return { journeyBucket: 'delivered', readiness, primaryCta: 'open_order' };
  }
  if (del === 'OUT_FOR_DELIVERY') {
    return { journeyBucket: 'shipped', readiness, primaryCta: 'open_order' };
  }
  if (so === 'READY_FOR_DELIVERY' || del === 'PLANNED' || del === 'READY') {
    return { journeyBucket: 'ready_to_ship', readiness, primaryCta: 'open_order' };
  }
  if (so === 'IN_PRODUCTION') {
    const attention = resolveAttention(input, now);
    return {
      journeyBucket: attention ? 'needs_attention' : 'in_production',
      attention,
      readiness,
      primaryCta: primaryCtaFor(attention ? 'needs_attention' : 'in_production', attention, input),
    };
  }

  // Attention before Preparing so hold/materials/overdue/workers surface
  const attentionEarly = resolveAttention(input, now);
  if (
    attentionEarly &&
    (so === 'ON_HOLD' ||
      so === 'WAITING_FOR_MATERIALS' ||
      attentionEarly.reasonCode === 'OVERDUE' ||
      attentionEarly.reasonCode === 'WORKERS_MISSING' ||
      attentionEarly.reasonCode === 'SETUP_INCOMPLETE')
  ) {
    // Preparing orders stay in Preparing (not Attention) unless overdue/hold/materials
    if (isPreparing(input) && attentionEarly.reasonCode === 'SETUP_INCOMPLETE') {
      // fall through to preparing
    } else if (isPreparing(input) && attentionEarly.reasonCode === 'WORKERS_MISSING') {
      // no workers yet pre-release — stay preparing
    } else if (
      isPreparing(input) &&
      attentionEarly.reasonCode !== 'OVERDUE' &&
      so !== 'ON_HOLD' &&
      so !== 'WAITING_FOR_MATERIALS'
    ) {
      // fall through
    } else {
      return {
        journeyBucket: 'needs_attention',
        attention: attentionEarly,
        readiness,
        primaryCta: primaryCtaFor('needs_attention', attentionEarly, input),
      };
    }
  }

  if (isPreparing(input)) {
    return {
      journeyBucket: 'preparing',
      readiness,
      primaryCta: primaryCtaFor('preparing', undefined, input),
    };
  }

  // Released setup / open POs leave Preparing for worker assignment or floor
  if (
    input.productionSetupStatus === 'RELEASED' ||
    (input.productionOrderCount ?? 0) > 0
  ) {
    const attention = resolveAttention(input, now);
    if (attention) {
      return {
        journeyBucket: 'needs_attention',
        attention,
        readiness,
        primaryCta: primaryCtaFor('needs_attention', attention, input),
      };
    }
    return {
      journeyBucket: 'ready_to_start',
      readiness,
      primaryCta: 'assign_workers',
    };
  }

  if (
    readinessSummary?.canStart &&
    (so === 'CONFIRMED' || so === 'READY_FOR_PRODUCTION')
  ) {
    const attention = resolveAttention(input, now);
    if (attention) {
      return {
        journeyBucket: 'needs_attention',
        attention,
        readiness,
        primaryCta: primaryCtaFor('needs_attention', attention, input),
      };
    }
    return {
      journeyBucket: 'ready_to_start',
      readiness,
      primaryCta: 'assign_workers',
    };
  }

  if (so === 'CONFIRMED' || so === 'READY_FOR_PRODUCTION' || so === 'WAITING_FOR_PAYMENT') {
    const attention = resolveAttention(input, now);
    if (attention) {
      return {
        journeyBucket: 'needs_attention',
        attention,
        readiness,
        primaryCta: primaryCtaFor('needs_attention', attention, input),
      };
    }
    return {
      journeyBucket: 'ready_to_start',
      readiness,
      primaryCta: 'assign_workers',
    };
  }

  const attention = resolveAttention(input, now);
  if (attention) {
    return {
      journeyBucket: 'needs_attention',
      attention,
      readiness,
      primaryCta: primaryCtaFor('needs_attention', attention, input),
    };
  }

  return {
    journeyBucket: 'preparing',
    readiness,
    primaryCta: 'continue_setup',
  };
}

/** Back-compat wrapper — bucket only. Prefer classifyAdminOrderJourney. */
export function journeyBucketOf(input: AdminOrderJourneyInput): AdminOrderLifecycle {
  return classifyAdminOrderJourney(input).journeyBucket;
}
