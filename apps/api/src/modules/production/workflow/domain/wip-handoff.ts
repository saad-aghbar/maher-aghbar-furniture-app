/**
 * Pure helpers for SEMI/WIP physical handoff (lot = ledger, kit = floor object).
 */

export type SnapshotEdgeRef = {
  fromSnapshotNodeId: string;
  toSnapshotNodeId: string;
};

/** True only when the kit is proven to feed the consuming snapshot node. */
export function kitFeedsConsumerNode(params: {
  nextSnapshotNodeIds: unknown;
  snapshotNodeId: string | null | undefined;
  consumerSnapshotNodeId: string;
  edges: SnapshotEdgeRef[];
}): boolean {
  const nextIds = Array.isArray(params.nextSnapshotNodeIds)
    ? (params.nextSnapshotNodeIds as string[]).filter(Boolean)
    : [];
  if (nextIds.length > 0) {
    return nextIds.includes(params.consumerSnapshotNodeId);
  }
  // Empty next-hops: only match when the workflow graph proves the edge.
  if (!params.snapshotNodeId) return false;
  return params.edges.some(
    (e) =>
      e.fromSnapshotNodeId === params.snapshotNodeId &&
      e.toSnapshotNodeId === params.consumerSnapshotNodeId,
  );
}

export function remainingReceivable(produced: number, alreadyReceived: number): number {
  const p = Number.isFinite(produced) ? produced : 0;
  const r = Number.isFinite(alreadyReceived) ? alreadyReceived : 0;
  return Math.max(0, p - r);
}

export function canConsumeQty(params: {
  receivedAtDestination: number;
  alreadyConsumedAtDestination: number;
  consumeQty: number;
}): boolean {
  const received = Number(params.receivedAtDestination) || 0;
  const consumed = Number(params.alreadyConsumedAtDestination) || 0;
  const take = Number(params.consumeQty) || 0;
  if (take <= 0) return true;
  return consumed + take <= received + 1e-9;
}

export type IncomingWorkStatusKey =
  | 'WAITING_PRODUCTION'
  | 'READY_TO_COLLECT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED';

export function incomingWorkStatus(params: {
  produced: number;
  received: number;
  expected: number;
}): IncomingWorkStatusKey {
  const produced = Number(params.produced) || 0;
  const received = Number(params.received) || 0;
  const expected = Math.max(Number(params.expected) || 0, produced, received);
  if (produced <= 1e-9) return 'WAITING_PRODUCTION';
  if (received + 1e-9 >= expected && expected > 0) return 'RECEIVED';
  if (received > 1e-9 && received + 1e-9 < expected) return 'PARTIALLY_RECEIVED';
  return 'READY_TO_COLLECT';
}

/** Board custody filter buckets (phase 2). */
export type WipCustodyFilter =
  | 'WAITING_PICKUP'
  | 'AT_STATION'
  | 'RECEIVED'
  | 'IN_USE';

export function custodyFilterForKit(params: {
  status: string;
  handoffCount: number;
  locationIsDestination?: boolean;
}): WipCustodyFilter | null {
  if (params.status === 'CONSUMED') return 'IN_USE';
  if (params.status === 'CLAIMED' || params.handoffCount > 0) {
    return params.locationIsDestination ? 'RECEIVED' : 'RECEIVED';
  }
  if (params.status === 'READY') return 'WAITING_PICKUP';
  if (params.status === 'OPEN') return 'AT_STATION';
  return null;
}
