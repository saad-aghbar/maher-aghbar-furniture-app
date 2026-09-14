/**
 * Admin Orders commercial lifecycle — human labels, not raw enum soup.
 * Bucket classification delegates to adminOrderJourney (single source of truth).
 */

import { classifyAdminOrderJourney } from './adminOrderJourney';

export type AdminOrderLifecycle =
  | 'needs_attention'
  | 'preparing'
  | 'ready_to_start'
  | 'in_production'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'rfq';

/** Piece 13 EN fallbacks — prefer `mobile.orders.journey.*.label` via i18n. */
export const ADMIN_LIFECYCLE_LABEL_FALLBACK: Record<AdminOrderLifecycle, string> = {
  rfq: 'Customer Requests',
  preparing: 'Preparing',
  ready_to_start: 'Ready to start',
  in_production: 'In production',
  ready_to_ship: 'Ready for delivery',
  shipped: 'Shipped',
  delivered: 'Delivered',
  /** @deprecated Attention is no longer a chip — soft badge only. */
  needs_attention: 'Attention',
};

export const ADMIN_LIFECYCLE_HINT_FALLBACK: Record<AdminOrderLifecycle, string> = {
  rfq: 'Requests waiting for factory action',
  preparing: 'Accepted orders being prepared for production',
  ready_to_start: 'Plan released — waiting for factory work to start',
  in_production: 'At least one factory task has started',
  ready_to_ship: 'Packaging complete — waiting to leave',
  shipped: 'Left the factory',
  delivered: 'Dealer confirmed receipt',
  needs_attention: 'Orders requiring action',
};

export function adminLifecycleLabelKey(life: AdminOrderLifecycle): string {
  return `mobile.orders.journey.${life}.label`;
}

export function adminLifecycleHintKey(life: AdminOrderLifecycle): string {
  return `mobile.orders.journey.${life}.hint`;
}

/** Resolve journey bucket label — i18n first, then Piece 13 fallback. */
export function adminLifecycleHumanLabel(
  life: AdminOrderLifecycle,
  t?: (key: string) => string,
): string {
  if (t) {
    const journeyKey = adminLifecycleLabelKey(life);
    const journey = t(journeyKey);
    if (journey !== journeyKey) return journey;
    const legacyKey = `mobile.orders.lifecycle.${life}`;
    const legacy = t(legacyKey);
    if (legacy !== legacyKey) return legacy;
  }
  return ADMIN_LIFECYCLE_LABEL_FALLBACK[life];
}

/** Short phase explanation for chips / trays. */
export function adminLifecyclePhaseHint(
  life: AdminOrderLifecycle,
  t?: (key: string) => string,
): string {
  if (t) {
    const key = adminLifecycleHintKey(life);
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return ADMIN_LIFECYCLE_HINT_FALLBACK[life];
}

export type AdminLifecycleInput = {
  status: string;
  deliveryStatus?: string | null;
  requiredDeliveryDate?: string | null;
  isRfq?: boolean;
  productionSetupRequired?: boolean;
  productionSetupStatus?: string | null;
  productionOrderCount?: number;
  releasedToFactory?: boolean;
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
};

export function classifyAdminOrderLifecycle(input: AdminLifecycleInput): AdminOrderLifecycle {
  return classifyAdminOrderJourney({
    status: input.status,
    deliveryStatus: input.deliveryStatus,
    requiredDeliveryDate: input.requiredDeliveryDate,
    isRfq: input.isRfq,
    productionSetupRequired: input.productionSetupRequired,
    productionSetupStatus: input.productionSetupStatus,
    productionOrderCount: input.productionOrderCount,
    releasedToFactory: input.releasedToFactory,
    executionStarted: input.executionStarted,
    productionReadinessSummary: input.productionReadinessSummary,
    progressPercent: input.progressPercent,
    currentStageLabel: input.currentStageLabel,
    now: input.now,
  }).journeyBucket;
}

export function adminLifecycleActionHint(
  input: AdminLifecycleInput,
  t?: (key: string, vars?: Record<string, string | number>) => string,
): string | null {
  if (input.productionReadinessSummary?.actionHint) {
    return input.productionReadinessSummary.actionHint;
  }
  const journey = classifyAdminOrderJourney({
    status: input.status,
    deliveryStatus: input.deliveryStatus,
    requiredDeliveryDate: input.requiredDeliveryDate,
    isRfq: input.isRfq,
    productionSetupRequired: input.productionSetupRequired,
    productionSetupStatus: input.productionSetupStatus,
    productionOrderCount: input.productionOrderCount,
    releasedToFactory: input.releasedToFactory,
    executionStarted: input.executionStarted,
    productionReadinessSummary: input.productionReadinessSummary,
    progressPercent: input.progressPercent,
    currentStageLabel: input.currentStageLabel,
    now: input.now,
  });
  if (journey.attention) {
    return journey.attention.reasonLabelKey;
  }
  const label = (life: AdminOrderLifecycle) => {
    if (t) {
      const key = `mobile.orders.actionHint.${life}`;
      const translated = t(key);
      if (translated !== key) return translated;
    }
    return ADMIN_LIFECYCLE_LABEL_FALLBACK[life];
  };
  switch (journey.journeyBucket) {
    case 'needs_attention':
      return label('needs_attention');
    case 'ready_to_start':
      return label('ready_to_start');
    case 'in_production':
      if (input.currentStageLabel) {
        if (t) {
          const key = 'mobile.orders.actionHint.inStage';
          const translated = t(key, { stage: input.currentStageLabel });
          if (translated !== key) return translated;
        }
        return `In ${input.currentStageLabel}`;
      }
      return label('in_production');
    case 'ready_to_ship':
      return label('ready_to_ship');
    case 'shipped':
      return label('shipped');
    case 'delivered':
      return label('delivered');
    case 'rfq':
      return label('rfq');
    default:
      return label('preparing');
  }
}

export function adminLifecycleAccentKey(
  life: AdminOrderLifecycle,
): 'warning' | 'success' | 'info' | 'brand' | 'muted' {
  switch (life) {
    case 'needs_attention':
      return 'warning';
    case 'ready_to_start':
      return 'success';
    case 'in_production':
      return 'info';
    case 'ready_to_ship':
    case 'shipped':
      return 'brand';
    case 'delivered':
    case 'rfq':
    default:
      return 'muted';
  }
}
