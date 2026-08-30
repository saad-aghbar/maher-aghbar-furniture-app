/**
 * Presentation-only delivery phases for Piece 13 — no domain status changes.
 */

export type DeliveryHumanPhase =
  | 'planned'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'attention';

export type DeliveryPhasePresentation = {
  phase: DeliveryHumanPhase;
  labelKey: string;
  /** WHY copy when phase is attention */
  whyKey?: string;
};

/**
 * Map delivery API status (+ optional load progress) → human admin/dealer phase.
 */
export function selectDeliveryHumanPhase(input: {
  status?: string | null;
  loaded?: number | null;
  total?: number | null;
  canDepart?: boolean | null;
}): DeliveryPhasePresentation {
  const status = String(input.status ?? '').trim().toUpperCase();
  const loaded = Number(input.loaded ?? 0);
  const total = Number(input.total ?? 0);
  const loadIncomplete = total > 0 && loaded < total;

  if (status === 'DELIVERED') {
    return { phase: 'delivered', labelKey: 'mobile.deliveryLoad.statusDelivered' };
  }
  if (status === 'OUT_FOR_DELIVERY' || status === 'SHIPPED') {
    return { phase: 'shipped', labelKey: 'mobile.deliveryLoad.statusShipped' };
  }
  if (status === 'PLANNED') {
    return { phase: 'planned', labelKey: 'mobile.deliveryLoad.statusPlanned' };
  }
  if (status === 'READY' || status === 'READY_FOR_DELIVERY') {
    if (loadIncomplete) {
      return {
        phase: 'attention',
        labelKey: 'mobile.deliveryLoad.statusAttention',
        whyKey: 'mobile.deliveryLoad.attentionLoadIncomplete',
      };
    }
    if (input.canDepart) {
      return {
        phase: 'attention',
        labelKey: 'mobile.deliveryLoad.statusAttention',
        whyKey: 'mobile.deliveryLoad.attentionAwaitingDepart',
      };
    }
    return { phase: 'ready', labelKey: 'mobile.deliveryLoad.statusReady' };
  }
  if (loadIncomplete && (status === 'READY' || !status)) {
    return {
      phase: 'attention',
      labelKey: 'mobile.deliveryLoad.statusAttention',
      whyKey: 'mobile.deliveryLoad.attentionLoadIncomplete',
    };
  }
  return { phase: 'ready', labelKey: 'mobile.deliveryLoad.statusReady' };
}

/** Dealer-facing: only Shipped / Delivered (no Planned/Ready/Attention factory phases). */
export function selectDealerDeliveryPhase(status?: string | null): DeliveryPhasePresentation {
  const s = String(status ?? '').trim().toUpperCase();
  if (s === 'DELIVERED') {
    return { phase: 'delivered', labelKey: 'mobile.deliveryLoad.statusDelivered' };
  }
  return { phase: 'shipped', labelKey: 'mobile.deliveryLoad.statusShipped' };
}
