/**
 * Pure helpers for SEMI/WIP physical handoff (lot = ledger, kit = floor object).
 */

export type SnapshotEdgeRef = {
  fromSnapshotNodeId: string;
  toSnapshotNodeId: string;
};

export type SnapshotHandoffNode = {
  id: string;
  stageCode?: string | null;
  executionKind?: string | null;
};

/** Quality gates sit between mix and packaging — kits skip them. */
export function isQualityPassthroughStage(input: {
  stageCode?: string | null;
  executionKind?: string | null;
}): boolean {
  const code = String(input.stageCode ?? '').toUpperCase();
  const kind = String(input.executionKind ?? '').toUpperCase();
  return kind === 'QUALITY' || code === 'INSPECTION' || code === 'QC' || code === 'QUALITY';
}

export function passthroughSnapshotNodeIds(nodes: SnapshotHandoffNode[]): Set<string> {
  return new Set(nodes.filter((n) => isQualityPassthroughStage(n)).map((n) => n.id));
}

export function expandNextHopsPastQuality(
  nextIds: string[],
  edges: SnapshotEdgeRef[],
  passthroughNodeIds: ReadonlySet<string>,
): string[] {
  if (!nextIds.length) return [];
  if (!passthroughNodeIds.size) return [...new Set(nextIds.filter(Boolean))];
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.fromSnapshotNodeId) ?? [];
    list.push(edge.toSnapshotNodeId);
    outgoing.set(edge.fromSnapshotNodeId, list);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = [...nextIds.filter(Boolean)];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (passthroughNodeIds.has(id)) {
      queue.push(...(outgoing.get(id) ?? []));
      continue;
    }
    out.push(id);
  }
  return out;
}

export function nextHopsSkippingQuality(params: {
  fromSnapshotNodeId: string;
  edges: SnapshotEdgeRef[];
  nodes: SnapshotHandoffNode[];
}): string[] {
  const immediate = params.edges
    .filter((e) => e.fromSnapshotNodeId === params.fromSnapshotNodeId)
    .map((e) => e.toSnapshotNodeId);
  return expandNextHopsPastQuality(
    immediate,
    params.edges,
    passthroughSnapshotNodeIds(params.nodes),
  );
}

/** True only when the kit is proven to feed the consuming snapshot node. */
export function kitFeedsConsumerNode(params: {
  nextSnapshotNodeIds: unknown;
  snapshotNodeId: string | null | undefined;
  consumerSnapshotNodeId: string;
  edges: SnapshotEdgeRef[];
  passthroughNodeIds?: Iterable<string>;
}): boolean {
  const nextIds = Array.isArray(params.nextSnapshotNodeIds)
    ? (params.nextSnapshotNodeIds as string[]).filter(Boolean)
    : [];
  const passthrough = new Set(params.passthroughNodeIds ?? []);
  const expanded = expandNextHopsPastQuality(nextIds, params.edges, passthrough);
  if (nextIds.length > 0) {
    return expanded.includes(params.consumerSnapshotNodeId) || nextIds.includes(params.consumerSnapshotNodeId);
  }
  // Empty next-hops: only match when the workflow graph proves the edge (skipping quality gates).
  if (!params.snapshotNodeId) return false;
  if (
    params.edges.some(
      (e) =>
        e.fromSnapshotNodeId === params.snapshotNodeId &&
        e.toSnapshotNodeId === params.consumerSnapshotNodeId,
    )
  ) {
    return true;
  }
  if (!passthrough.size) return false;
  const walked = expandNextHopsPastQuality(
    params.edges
      .filter((e) => e.fromSnapshotNodeId === params.snapshotNodeId)
      .map((e) => e.toSnapshotNodeId),
    params.edges,
    passthrough,
  );
  return walked.includes(params.consumerSnapshotNodeId);
}

/** Walk incoming edges through quality gates to the producing stage(s) that feed `consumer`. */
export function incomingProducerSnapshotIds(
  consumerSnapshotNodeId: string,
  edges: SnapshotEdgeRef[],
  passthroughNodeIds: ReadonlySet<string>,
): string[] {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const list = incoming.get(edge.toSnapshotNodeId) ?? [];
    list.push(edge.fromSnapshotNodeId);
    incoming.set(edge.toSnapshotNodeId, list);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = [...(incoming.get(consumerSnapshotNodeId) ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (passthroughNodeIds.has(id)) {
      queue.push(...(incoming.get(id) ?? []));
      continue;
    }
    out.push(id);
  }
  return out;
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
