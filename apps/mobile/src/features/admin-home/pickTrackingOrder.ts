import type {
  AdminHomeFloorSpotlight,
  AdminHomePayload,
  AdminHomeRecentOrder,
  FloorSpotlightReason,
} from './api';

export type PipelineStep = 'received' | 'production' | 'nearing' | 'delivered';

const STATUS_STEP: Record<string, number> = {
  DRAFT: 0,
  CONFIRMED: 0,
  NEW: 0,
  IN_PRODUCTION: 1,
  PRODUCTION: 1,
  READY_FOR_PRODUCTION: 1,
  WAITING_FOR_MATERIALS: 1,
  READY: 2,
  NEARING_DELIVERY: 2,
  READY_FOR_DELIVERY: 2,
  OUT_FOR_DELIVERY: 2,
  DELIVERED: 3,
  COMPLETED: 3,
  CLOSED: 3,
};

/** Map order status → completed step index (0–3). */
export function pipelineStepIndex(status: string): number {
  const key = status.toUpperCase().replace(/\s+/g, '_');
  if (STATUS_STEP[key] != null) return STATUS_STEP[key]!;
  if (key.includes('DELIVER') || key.includes('COMPLETE')) return 3;
  if (key.includes('NEAR') || key.includes('READY') || key.includes('SHIP')) return 2;
  if (key.includes('PROD') || key.includes('PROGRESS') || key.includes('MATERIAL')) return 1;
  return 0;
}

export type TrackingPick = {
  order: AdminHomeRecentOrder;
  stepIndex: number;
  reason: FloorSpotlightReason;
  peerCount: number;
};

/**
 * Floor spotlight for a high-volume factory Home.
 *
 * Prefer API `floorSpotlight` (priority query across all open orders).
 * Client fallback never uses “first of 8 recent” as tracking — only a
 * late / in-production match from that window, else null.
 */
export function pickTrackingOrder(data: AdminHomePayload): TrackingPick | null {
  if (data.floorSpotlight?.order) {
    return fromSpotlight(data.floorSpotlight);
  }

  if (data.recentOrders.length === 0) return null;

  const delayed = data.recentOrders.find((o) => {
    const s = o.status.toUpperCase();
    return s.includes('DELAY') || s.includes('LATE') || s.includes('OVERDUE');
  });
  if (delayed) {
    return {
      order: delayed,
      stepIndex: pipelineStepIndex(delayed.status),
      reason: 'late',
      peerCount: Math.max(1, data.delayedOrders),
    };
  }

  const inProd = data.recentOrders.find((o) => pipelineStepIndex(o.status) === 1);
  if (inProd) {
    return {
      order: inProd,
      stepIndex: pipelineStepIndex(inProd.status),
      reason: 'in_production',
      peerCount: Math.max(1, data.ordersInProduction),
    };
  }

  return null;
}

function fromSpotlight(spotlight: AdminHomeFloorSpotlight): TrackingPick {
  return {
    order: spotlight.order,
    stepIndex: pipelineStepIndex(spotlight.order.status),
    reason: spotlight.reason,
    peerCount: Math.max(1, spotlight.peerCount),
  };
}

export const PIPELINE_STEPS: PipelineStep[] = [
  'received',
  'production',
  'nearing',
  'delivered',
];
