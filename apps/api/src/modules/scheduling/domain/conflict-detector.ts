/**
 * Operational scheduling conflicts: invalid physical overlap on the same
 * worker or finite resource slot. Same-day sequential work is not a conflict.
 * Full capacity is not a conflict. Delivery risk is not a conflict.
 */
import { resourceCapacityKey } from './schedule-planner';
import type { Priority } from './types';

export type ConflictType = 'WORKER_OVERLAP' | 'RESOURCE_OVERLAP';

export type ConflictTaskStatus =
  | 'PENDING'
  | 'READY'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'CANCELLED'
  | string
  | null;

export type ConflictScheduleStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'APPROVED'
  | 'SUPERSEDED'
  | 'CANCELLED'
  | 'NEEDS_REVIEW'
  | 'PROVISIONAL'
  | string;

export interface ConflictAllocationInput {
  id: string;
  employeeId: string | null;
  employeeName?: string | null;
  employeeActive?: boolean | null;
  resourceSlot: number | null;
  plannedStart: Date;
  plannedEnd: Date;
  estimatedMinutes?: number;
  isPinned: boolean;
  manuallyAdjusted?: boolean;
  productionOrderId: string;
  scheduleId: string;
  scheduleVersion: number;
  scheduleStatus: ConflictScheduleStatus;
  productionTaskId: string | null;
  taskStatus: ConflictTaskStatus;
  taskName: string | null;
  stageDefinitionId: string | null;
  stageName: string | null;
  stageCode?: string | null;
  orderNumber: string;
  productName: string | null;
  priority: Priority;
  requestedDeliveryDate: Date | null;
  committedDeliveryDate: Date | null;
  customerId: string;
  createdAt: Date;
}

export interface ConflictSideView {
  allocationId: string;
  productionOrderId: string;
  orderNumber: string;
  productName: string | null;
  stageName: string | null;
  stageDefinitionId: string | null;
  start: Date;
  end: Date;
  priority: Priority;
  requestedDeliveryDate: Date | null;
  committedDeliveryDate: Date | null;
  isPinned: boolean;
  manuallyAdjusted?: boolean;
  taskStatus: ConflictTaskStatus;
  customerId: string;
  createdAt: Date;
}

export interface DetectedConflict {
  conflictId: string;
  type: ConflictType;
  worker: { id: string; name: string } | null;
  resource: { stageDefinitionId: string; stageName: string | null; slot: number } | null;
  overlapStart: Date;
  overlapEnd: Date;
  overlapMinutes: number;
  allocationA: ConflictSideView;
  allocationB: ConflictSideView;
}

export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function overlapWindow(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): { start: Date; end: Date; minutes: number } | null {
  if (!intervalsOverlap(aStart, aEnd, bStart, bEnd)) return null;
  const start = aStart.getTime() >= bStart.getTime() ? aStart : bStart;
  const end = aEnd.getTime() <= bEnd.getTime() ? aEnd : bEnd;
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
  return { start, end, minutes };
}

export function conflictPairId(aId: string, bId: string): string {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
}

export function parseConflictPairId(conflictId: string): { aId: string; bId: string } | null {
  const idx = conflictId.indexOf(':');
  if (idx <= 0 || idx === conflictId.length - 1) return null;
  const aId = conflictId.slice(0, idx);
  const bId = conflictId.slice(idx + 1);
  if (!aId || !bId || aId.includes(':')) return null;
  return { aId, bId };
}

const ACTIVE_SCHEDULE = new Set(['APPROVED', 'PROPOSED']);

export function isLatestActiveSchedule(alloc: ConflictAllocationInput, latestVersionByPo: Map<string, number>): boolean {
  if (!ACTIVE_SCHEDULE.has(String(alloc.scheduleStatus))) return false;
  return alloc.scheduleVersion === (latestVersionByPo.get(alloc.productionOrderId) ?? alloc.scheduleVersion);
}

export function latestVersionByProductionOrder(allocations: ConflictAllocationInput[]): Map<string, number> {
  const latest = new Map<string, number>();
  for (const a of allocations) {
    if (!ACTIVE_SCHEDULE.has(String(a.scheduleStatus))) continue;
    const prev = latest.get(a.productionOrderId) ?? -1;
    if (a.scheduleVersion > prev) latest.set(a.productionOrderId, a.scheduleVersion);
  }
  return latest;
}

/** Operational set: latest APPROVED/PROPOSED, not completed, valid window. */
export function selectActiveAllocations(
  allocations: ConflictAllocationInput[],
  now: Date,
): ConflictAllocationInput[] {
  const latest = latestVersionByProductionOrder(allocations);
  return allocations.filter((a) => {
    if (!isLatestActiveSchedule(a, latest)) return false;
    if (a.taskStatus === 'COMPLETED' || a.taskStatus === 'CANCELLED') return false;
    if (a.plannedEnd.getTime() <= a.plannedStart.getTime()) return false;
    if (a.plannedEnd.getTime() < now.getTime()) return false;
    return true;
  });
}

function toSide(a: ConflictAllocationInput): ConflictSideView {
  return {
    allocationId: a.id,
    productionOrderId: a.productionOrderId,
    orderNumber: a.orderNumber,
    productName: a.productName,
    stageName: a.stageName ?? a.taskName,
    stageDefinitionId: a.stageDefinitionId,
    start: a.plannedStart,
    end: a.plannedEnd,
    priority: a.priority,
    requestedDeliveryDate: a.requestedDeliveryDate,
    committedDeliveryDate: a.committedDeliveryDate,
    isPinned: a.isPinned,
    manuallyAdjusted: Boolean(a.manuallyAdjusted),
    taskStatus: a.taskStatus,
    customerId: a.customerId,
    createdAt: a.createdAt,
  };
}

function pairKeyResource(a: ConflictAllocationInput): string | null {
  if (a.employeeId) return null;
  if (a.resourceSlot == null || !a.stageDefinitionId) return null;
  return resourceCapacityKey(a.stageDefinitionId, a.resourceSlot);
}

function emitPair(
  type: ConflictType,
  a: ConflictAllocationInput,
  b: ConflictAllocationInput,
  seen: Set<string>,
): DetectedConflict | null {
  const window = overlapWindow(a.plannedStart, a.plannedEnd, b.plannedStart, b.plannedEnd);
  if (!window) return null;
  const conflictId = conflictPairId(a.id, b.id);
  if (seen.has(conflictId)) return null;
  seen.add(conflictId);
  const first = a.id <= b.id ? a : b;
  const second = first === a ? b : a;
  return {
    conflictId,
    type,
    worker:
      type === 'WORKER_OVERLAP' && first.employeeId
        ? { id: first.employeeId, name: first.employeeName?.trim() || '' }
        : null,
    resource:
      type === 'RESOURCE_OVERLAP' && first.stageDefinitionId != null && first.resourceSlot != null
        ? {
            stageDefinitionId: first.stageDefinitionId,
            stageName: first.stageName ?? first.taskName,
            slot: first.resourceSlot,
          }
        : null,
    overlapStart: window.start,
    overlapEnd: window.end,
    overlapMinutes: window.minutes,
    allocationA: toSide(first),
    allocationB: toSide(second),
  };
}

export function detectConflicts(
  allocations: ConflictAllocationInput[],
  now: Date,
): DetectedConflict[] {
  const active = selectActiveAllocations(allocations, now);
  const seen = new Set<string>();
  const out: DetectedConflict[] = [];

  const byWorker = new Map<string, ConflictAllocationInput[]>();
  const byResource = new Map<string, ConflictAllocationInput[]>();
  for (const a of active) {
    if (a.employeeId) {
      const list = byWorker.get(a.employeeId) ?? [];
      list.push(a);
      byWorker.set(a.employeeId, list);
    } else {
      const key = pairKeyResource(a);
      if (!key) continue;
      const list = byResource.get(key) ?? [];
      list.push(a);
      byResource.set(key, list);
    }
  }

  const scan = (groups: Map<string, ConflictAllocationInput[]>, type: ConflictType) => {
    for (const list of groups.values()) {
      const sorted = [...list].sort((x, y) => {
        const t = x.plannedStart.getTime() - y.plannedStart.getTime();
        return t !== 0 ? t : x.id.localeCompare(y.id);
      });
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const pair = emitPair(type, sorted[i]!, sorted[j]!, seen);
          if (pair) out.push(pair);
        }
      }
    }
  };

  scan(byWorker, 'WORKER_OVERLAP');
  scan(byResource, 'RESOURCE_OVERLAP');

  out.sort((a, b) => {
    const t = a.overlapStart.getTime() - b.overlapStart.getTime();
    return t !== 0 ? t : a.conflictId.localeCompare(b.conflictId);
  });
  return out;
}

export function affectedOrderIds(conflicts: DetectedConflict[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const c of conflicts) {
    for (const id of [c.allocationA.productionOrderId, c.allocationB.productionOrderId]) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function serializeConflict(c: DetectedConflict) {
  const side = (s: ConflictSideView) => ({
    allocationId: s.allocationId,
    productionOrderId: s.productionOrderId,
    orderNumber: s.orderNumber,
    productName: s.productName,
    stageName: s.stageName,
    stageDefinitionId: s.stageDefinitionId,
    start: s.start.toISOString(),
    end: s.end.toISOString(),
    priority: s.priority,
    requestedDeliveryDate: s.requestedDeliveryDate?.toISOString() ?? null,
    committedDeliveryDate: s.committedDeliveryDate?.toISOString() ?? null,
    isPinned: s.isPinned,
    manuallyAdjusted: Boolean(s.manuallyAdjusted),
    taskStatus: s.taskStatus,
  });
  return {
    conflictId: c.conflictId,
    type: c.type,
    worker: c.worker,
    resource: c.resource,
    overlapStart: c.overlapStart.toISOString(),
    overlapEnd: c.overlapEnd.toISOString(),
    overlapMinutes: c.overlapMinutes,
    allocationA: side(c.allocationA),
    allocationB: side(c.allocationB),
  };
}
