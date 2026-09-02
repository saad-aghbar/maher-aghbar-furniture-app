/**
 * Lane-specific Orders card copy — only facts useful for that lifecycle stage.
 * Attention is a soft overlay (WHAT / WHY / WHAT NEXT), not its own chip.
 */

import type { AdminOrderLifecycle } from './adminOrderLifecycle';
import type { JourneyAttention, JourneyPrimaryCta, JourneyReadiness } from './adminOrderJourney';

export type LaneCardFact = {
  key: string;
  labelKey?: string;
  /** Already-localized or raw value */
  value: string;
  tone?: 'default' | 'muted' | 'warning' | 'brand';
};

export type LaneCardPresentation = {
  lane: AdminOrderLifecycle | 'attention';
  /** Primary status line under the title */
  statusLine: string;
  facts: LaneCardFact[];
  blockers: string[];
  ctaLabelKey: string | null;
  attentionBlock?: {
    what: string;
    why: string;
    whatNext: string;
  } | null;
};

export type LaneCardInput = {
  lifecycle: AdminOrderLifecycle;
  number: string;
  dealerName?: string | null;
  deliveryDateLabel?: string | null;
  plannedStartLabel?: string | null;
  progressPercent?: number | null;
  progressLabel?: string | null;
  attention?: JourneyAttention | null;
  attentionReasonLabel?: string | null;
  attentionActionLabel?: string | null;
  actionHint?: string | null;
  readiness?: JourneyReadiness | null;
  assignment?: {
    required?: number;
    assigned?: number;
    missingCount?: number;
  } | null;
  materialsReady?: boolean | null;
  needsSetup?: boolean | null;
  sellerPriceMissing?: boolean;
  manufacturingKindLabel?: string | null;
  packageCountLabel?: string | null;
  departedLabel?: string | null;
  confirmedLabel?: string | null;
  finReadyLabel?: string | null;
  warehouseLabel?: string | null;
  loadProgressLabel?: string | null;
  deliveryNumberLabel?: string | null;
  /** Canonical DeliveryLoadPiece load status for RFD / ship CTAs. */
  loadStatus?:
    | 'not_started'
    | 'loading'
    | 'fully_loaded'
    | 'departed'
    | 'delivered'
    | 'partial'
    | 'complete'
    | null;
  /** 1-based missing package when load incomplete. */
  missingPackageIndex?: number | null;
  packagesLoaded?: number | null;
  packagesTotal?: number | null;
  primaryCta?: JourneyPrimaryCta | null;
};

const CTA_KEYS: Record<JourneyPrimaryCta, string> = {
  continue_setup: 'mobile.productionSetup.planTitle',
  review_setup: 'mobile.productionSetup.planTitle',
  release: 'mobile.productionSetup.planTitle',
  assign_workers: 'mobile.productionSetup.planTitle',
  open_order: 'mobile.orders.openOrder',
  review_request: 'mobile.orders.attentionAction.review_request',
  edit_plan: 'mobile.orders.journey.viewPlan',
};

/** Lane CTA when primaryCta is absent — locked journey CTAs. */
const LANE_CTA: Partial<Record<AdminOrderLifecycle, string | null>> = {
  preparing: 'mobile.productionSetup.planTitle',
  ready_to_start: 'mobile.orders.journey.viewPlan',
  in_production: 'mobile.orders.cta.openProduction',
  ready_to_ship: 'mobile.orders.cta.openLoad',
  shipped: 'mobile.orders.cta.openDelivery',
  delivered: 'mobile.orders.cta.viewDelivery',
};

function resolveReadyToShipCtaKey(
  loadStatus: LaneCardInput['loadStatus'],
): string {
  const s = loadStatus === 'partial' ? 'loading' : loadStatus === 'complete' ? 'fully_loaded' : loadStatus;
  if (s === 'fully_loaded') return 'mobile.orders.cta.openDelivery';
  return 'mobile.orders.cta.openLoad';
}

export function resolveLaneCtaLabelKey(
  primaryCta: JourneyPrimaryCta | null | undefined,
  lifecycle: AdminOrderLifecycle,
  loadStatus?: LaneCardInput['loadStatus'],
): string | null {
  if (primaryCta && CTA_KEYS[primaryCta]) return CTA_KEYS[primaryCta];
  if (lifecycle === 'ready_to_ship') return resolveReadyToShipCtaKey(loadStatus);
  return LANE_CTA[lifecycle] ?? null;
}

/**
 * Build presentation facts for the focused lifecycle lane.
 * When attention is present, prepend WHAT / WHY / WHAT NEXT.
 */
export function buildLaneCardPresentation(
  input: LaneCardInput,
  t: (key: string, params?: Record<string, string | number>) => string,
): LaneCardPresentation {
  const attentionBlock =
    input.attention && input.attentionReasonLabel
      ? {
          what: input.attentionReasonLabel,
          why:
            input.actionHint?.trim() ||
            input.attentionReasonLabel,
          whatNext:
            input.attentionActionLabel?.trim() ||
            t(input.attention.actionLabelKey),
        }
      : null;

  if (attentionBlock && input.attention) {
    const base = buildForLane(input, t);
    return {
      ...base,
      lane: 'attention',
      attentionBlock,
      ctaLabelKey:
        resolveLaneCtaLabelKey(input.primaryCta, input.lifecycle, input.loadStatus) ??
        input.attention.actionLabelKey,
    };
  }

  return buildForLane(input, t);
}

function buildForLane(
  input: LaneCardInput,
  t: (key: string, params?: Record<string, string | number>) => string,
): LaneCardPresentation {
  const ctaLabelKey = resolveLaneCtaLabelKey(
    input.primaryCta,
    input.lifecycle,
    input.loadStatus,
  );
  const blockers: string[] = [];
  const facts: LaneCardFact[] = [];

  switch (input.lifecycle) {
    case 'preparing': {
      const req = input.assignment?.required ?? 0;
      const assigned = input.assignment?.assigned ?? 0;
      const missing = input.assignment?.missingCount ?? Math.max(0, req - assigned);
      const materialsOk = input.materialsReady !== false && input.readiness?.materialsReady !== false;
      const setupOk = input.needsSetup !== true && input.readiness?.setupReady !== false;

      if (!setupOk) blockers.push(t('mobile.orders.journey.setupRemaining.spec'));
      if (!materialsOk) blockers.push(t('mobile.orders.journey.setupRemaining.materials'));
      if (missing > 0) {
        blockers.push(
          t('mobile.orders.workersAssigned', { assigned, required: req || missing }),
        );
      }
      if (input.sellerPriceMissing) {
        blockers.push(t('mobile.orders.journey.setupRemaining.price'));
      }

      if (input.dealerName) {
        facts.push({ key: 'dealer', value: input.dealerName, tone: 'muted' });
      }
      if (input.deliveryDateLabel) {
        facts.push({
          key: 'committed',
          labelKey: 'mobile.orders.committedDelivery',
          value: input.deliveryDateLabel,
        });
      }
      const readyBits = [
        setupOk ? null : t('mobile.orders.journey.planSectionSpec'),
        materialsOk ? null : t('mobile.orders.journey.planSectionMaterials'),
        missing === 0 ? null : t('mobile.orders.journey.planSectionWorkers'),
      ].filter(Boolean);
      facts.push({
        key: 'readiness',
        value:
          blockers.length === 0
            ? t('mobile.orders.journey.planNoBlockers')
            : t('mobile.orders.journey.planReadyOf', {
                ready: 5 - Math.min(5, blockers.length),
                total: 5,
              }),
        tone: blockers.length ? 'warning' : 'brand',
      });
      if (readyBits.length && blockers.length === 0) {
        /* noop */
      }
      return {
        lane: 'preparing',
        statusLine: t('mobile.orders.lifecycle.preparing'),
        facts,
        blockers,
        ctaLabelKey,
        attentionBlock: null,
      };
    }

    case 'ready_to_start': {
      if (input.plannedStartLabel) {
        facts.push({
          key: 'plannedStart',
          labelKey: 'mobile.orders.plannedFactoryStart',
          value: input.plannedStartLabel,
        });
      }
      const req = input.assignment?.required ?? 0;
      const assigned = input.assignment?.assigned ?? 0;
      if (req > 0) {
        facts.push({
          key: 'workers',
          value: t('mobile.orders.workersAssigned', { assigned, required: req }),
          tone: assigned < req ? 'warning' : 'default',
        });
      }
      if (input.deliveryDateLabel) {
        facts.push({
          key: 'committed',
          labelKey: 'mobile.orders.committedDelivery',
          value: input.deliveryDateLabel,
        });
      }
      if (input.actionHint) {
        blockers.push(input.actionHint);
      }
      return {
        lane: 'ready_to_start',
        statusLine: t('mobile.orders.lifecycle.ready_to_start'),
        facts,
        blockers,
        ctaLabelKey,
        attentionBlock: null,
      };
    }

    case 'in_production': {
      if (input.progressLabel) {
        facts.push({
          key: 'stage',
          labelKey: 'mobile.orders.currentStage',
          value: input.progressLabel,
          tone: 'brand',
        });
      }
      if (input.progressPercent != null) {
        facts.push({
          key: 'progress',
          value: `${Math.round(input.progressPercent)}%`,
          tone: 'brand',
        });
      }
      if (input.deliveryDateLabel) {
        facts.push({
          key: 'committed',
          labelKey: 'mobile.orders.committedDelivery',
          value: input.deliveryDateLabel,
        });
      }
      if (input.attentionReasonLabel) {
        blockers.push(input.attentionReasonLabel);
      }
      return {
        lane: 'in_production',
        statusLine: t('mobile.orders.lifecycle.in_production'),
        facts,
        blockers,
        ctaLabelKey,
        attentionBlock: null,
      };
    }

    case 'ready_to_ship': {
      const loadNorm =
        input.loadStatus === 'partial'
          ? 'loading'
          : input.loadStatus === 'complete'
            ? 'fully_loaded'
            : input.loadStatus;

      if (input.packagesLoaded != null && input.packagesTotal != null) {
        facts.push({
          key: 'truckLoad',
          labelKey: 'mobile.orders.truckLoad',
          value:
            loadNorm === 'fully_loaded'
              ? t('mobile.orders.packagesOfTotal', {
                  loaded: input.packagesLoaded,
                  total: input.packagesTotal,
                })
              : t('mobile.orders.packagesLoadedOf', {
                  loaded: input.packagesLoaded,
                  total: input.packagesTotal,
                }),
          tone: loadNorm === 'fully_loaded' ? 'brand' : 'default',
        });
      } else if (input.packageCountLabel) {
        facts.push({ key: 'packages', value: input.packageCountLabel });
      }

      if (loadNorm === 'fully_loaded') {
        facts.push({
          key: 'readyDepart',
          value: t('mobile.orders.readyToDepart'),
          tone: 'brand',
        });
      } else if (input.loadProgressLabel) {
        facts.push({
          key: 'load',
          value: input.loadProgressLabel,
          tone: loadNorm === 'loading' ? 'warning' : 'muted',
        });
      }

      if (
        loadNorm === 'loading' &&
        input.missingPackageIndex != null &&
        input.packagesTotal != null
      ) {
        blockers.push(
          t('mobile.orders.packageMissingOf', {
            index: input.missingPackageIndex,
            total: input.packagesTotal,
          }),
        );
      }

      if (input.finReadyLabel && loadNorm === 'not_started') {
        facts.push({ key: 'fin', value: input.finReadyLabel, tone: 'brand' });
      }
      if (input.warehouseLabel && loadNorm !== 'fully_loaded') {
        facts.push({
          key: 'warehouse',
          labelKey: 'mobile.orders.finishedWarehouse',
          value: input.warehouseLabel,
        });
      }
      if (input.deliveryDateLabel) {
        facts.push({
          key: 'leaveBy',
          labelKey: 'mobile.orders.leaveBy',
          value: input.deliveryDateLabel,
        });
      }
      return {
        lane: 'ready_to_ship',
        statusLine: t('mobile.orders.lifecycle.ready_to_ship'),
        facts,
        blockers,
        ctaLabelKey,
        attentionBlock: null,
      };
    }

    case 'shipped': {
      if (input.departedLabel) {
        facts.push({
          key: 'departed',
          labelKey: 'mobile.orders.truckDeparted',
          value: input.departedLabel,
        });
      }
      if (input.packagesLoaded != null && input.packagesTotal != null) {
        facts.push({
          key: 'packages',
          value: t('mobile.orders.packagesOfTotal', {
            loaded: input.packagesLoaded,
            total: input.packagesTotal,
          }),
        });
      } else if (input.packageCountLabel) {
        facts.push({ key: 'packages', value: input.packageCountLabel });
      }
      if (input.deliveryNumberLabel) {
        facts.push({
          key: 'delivery',
          labelKey: 'mobile.orders.deliveryLoad',
          value: input.deliveryNumberLabel,
        });
      }
      facts.push({
        key: 'pending',
        value: t('mobile.orders.dealerConfirmPending'),
        tone: 'muted',
      });
      return {
        lane: 'shipped',
        statusLine: t('mobile.orders.lifecycle.shipped'),
        facts,
        blockers,
        ctaLabelKey,
        attentionBlock: null,
      };
    }

    case 'delivered': {
      if (input.confirmedLabel) {
        facts.push({
          key: 'confirmed',
          labelKey: 'mobile.orders.dealerConfirmed',
          value: input.confirmedLabel,
        });
      }
      if (input.packagesTotal != null) {
        facts.push({
          key: 'packagesDelivered',
          value: t('mobile.orders.packagesDeliveredCount', {
            count: input.packagesTotal,
          }),
          tone: 'brand',
        });
      } else {
        facts.push({
          key: 'final',
          value: t('mobile.orders.deliveryComplete'),
          tone: 'brand',
        });
      }
      return {
        lane: 'delivered',
        statusLine: t('mobile.orders.lifecycle.delivered'),
        facts,
        blockers: [],
        ctaLabelKey,
        attentionBlock: null,
      };
    }

    default:
      return {
        lane: input.lifecycle,
        statusLine: t(`mobile.orders.lifecycle.${input.lifecycle}`),
        facts,
        blockers,
        ctaLabelKey,
        attentionBlock: null,
      };
  }
}
