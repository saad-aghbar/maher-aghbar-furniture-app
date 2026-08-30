/**
 * Admin manual-sync candidate policy.
 * Scans the active factory; only stale/invalid/unscheduled/at-risk work is packed.
 * Non-recoverable blockers are reported and never passed to generate.
 */
import type { CanonicalScheduleStatus } from './at-risk';
import {
  compareFactoryReplanCandidates,
  type FactoryReplanCandidate,
  type FactoryReplanUrgency,
  type PinnedUnavailableIssue,
} from './factory-replan';
import type { PrioritySortItem } from './types';

export type ManualSyncClass =
  | 'SKIP_COMPLETED'
  | 'SKIP_CANCELLED'
  | 'VALID_NO_CHANGE'
  | 'NEEDS_GENERATE'
  | 'NEEDS_REPLAN'
  | 'AT_RISK_RECOVERY'
  | 'BLOCKED'
  | 'MANUAL_ATTENTION';

export type ManualSyncBlockerKind =
  | 'MATERIAL_NOT_READY'
  | 'WIP_NOT_READY'
  | 'NO_ELIGIBLE_WORKER'
  | 'MISSING_ESTIMATE'
  | 'WIP_DEPENDENCY_CYCLE';

export type ManualSyncOutcome = 'UP_TO_DATE' | 'CHANGED' | 'PARTIAL' | 'FAILED';

export type ManualSyncReadiness = {
  materialBlocked: boolean;
  wipBlocked: boolean;
  noEligibleWorker: boolean;
  missingEstimate: boolean;
};

export type ManualSyncOrderFacts = {
  productionOrderId: string;
  number: string;
  poStatus: string;
  hasActiveSchedule: boolean;
  hasIncompleteFutureAllocations: boolean;
  hasStaleIncomplete: boolean;
  hasPastIncompletePin: boolean;
  primaryStatus: CanonicalScheduleStatus | null;
  stillBlocked: boolean;
  blockerKind: ManualSyncBlockerKind | null;
  blockerCleared: boolean;
  illegalUnpinned: boolean;
  illegalPinned: boolean;
  ineligibleAssignedWorker: boolean;
  inMovableConflict: boolean;
  inPinnedConflict: boolean;
  hasPromiseDate: boolean;
  planningMode?: string | null;
  priority: PrioritySortItem;
};

export type ManualSyncAttentionItem = {
  productionOrderId: string;
  number: string;
  class: ManualSyncClass;
  blockerKind?: ManualSyncBlockerKind | null;
};

export type ManualSyncSelection = {
  scanned: number;
  candidates: FactoryReplanCandidate[];
  alreadyValid: number;
  blocked: ManualSyncAttentionItem[];
  manualAttention: ManualSyncAttentionItem[];
  skippedTerminal: number;
  byClass: Record<ManualSyncClass, string[]>;
};

export function stillNonRecoverableBlocker(readiness: ManualSyncReadiness): boolean {
  return (
    readiness.materialBlocked ||
    readiness.wipBlocked ||
    readiness.noEligibleWorker ||
    readiness.missingEstimate
  );
}

export function blockerKindFromReadiness(
  readiness: ManualSyncReadiness,
): ManualSyncBlockerKind | null {
  if (readiness.materialBlocked) return 'MATERIAL_NOT_READY';
  if (readiness.wipBlocked) return 'WIP_NOT_READY';
  if (readiness.noEligibleWorker) return 'NO_ELIGIBLE_WORKER';
  if (readiness.missingEstimate) return 'MISSING_ESTIMATE';
  return null;
}

export function classifyManualSyncOrder(facts: ManualSyncOrderFacts): ManualSyncClass {
  const status = String(facts.poStatus ?? '').toUpperCase();
  if (status === 'COMPLETED' || status === 'DELIVERED') return 'SKIP_COMPLETED';
  if (status === 'CANCELLED') return 'SKIP_CANCELLED';

  if (facts.stillBlocked) return 'BLOCKED';

  if (facts.illegalPinned || facts.inPinnedConflict || facts.hasPastIncompletePin) {
    return 'MANUAL_ATTENTION';
  }

  const noPlan =
    !facts.hasActiveSchedule ||
    (!facts.hasIncompleteFutureAllocations && facts.blockerCleared);

  if (noPlan && !facts.stillBlocked) return 'NEEDS_GENERATE';

  if (
    facts.hasStaleIncomplete ||
    facts.illegalUnpinned ||
    facts.ineligibleAssignedWorker ||
    (facts.hasActiveSchedule && !facts.hasIncompleteFutureAllocations)
  ) {
    return 'NEEDS_REPLAN';
  }

  if (facts.inMovableConflict) return 'NEEDS_REPLAN';

  if (facts.primaryStatus === 'LATE' || facts.primaryStatus === 'AT_RISK') {
    return 'AT_RISK_RECOVERY';
  }

  return 'VALID_NO_CHANGE';
}

function urgencyForClass(
  cls: ManualSyncClass,
  facts: ManualSyncOrderFacts,
): FactoryReplanUrgency {
  if (cls === 'AT_RISK_RECOVERY' && facts.primaryStatus === 'LATE') return 'late';
  if (cls === 'AT_RISK_RECOVERY') return 'atRisk';
  if (cls === 'NEEDS_GENERATE') {
    return facts.blockerCleared ? 'clearedBlocker' : 'unscheduledReady';
  }
  if (facts.blockerCleared) return 'clearedBlocker';
  return 'invalidSchedule';
}

export function selectManualSyncCandidates(orders: ManualSyncOrderFacts[]): ManualSyncSelection {
  const byClass: Record<ManualSyncClass, string[]> = {
    SKIP_COMPLETED: [],
    SKIP_CANCELLED: [],
    VALID_NO_CHANGE: [],
    NEEDS_GENERATE: [],
    NEEDS_REPLAN: [],
    AT_RISK_RECOVERY: [],
    BLOCKED: [],
    MANUAL_ATTENTION: [],
  };
  const candidates: FactoryReplanCandidate[] = [];
  const blocked: ManualSyncAttentionItem[] = [];
  const manualAttention: ManualSyncAttentionItem[] = [];
  let alreadyValid = 0;
  let skippedTerminal = 0;

  for (const order of orders) {
    const cls = classifyManualSyncOrder(order);
    byClass[cls].push(order.productionOrderId);

    if (cls === 'SKIP_COMPLETED' || cls === 'SKIP_CANCELLED') {
      skippedTerminal += 1;
      continue;
    }
    if (cls === 'VALID_NO_CHANGE') {
      alreadyValid += 1;
      continue;
    }
    if (cls === 'BLOCKED') {
      blocked.push({
        productionOrderId: order.productionOrderId,
        number: order.number,
        class: cls,
        blockerKind: order.blockerKind,
      });
      continue;
    }
    if (cls === 'MANUAL_ATTENTION') {
      manualAttention.push({
        productionOrderId: order.productionOrderId,
        number: order.number,
        class: cls,
        blockerKind: order.blockerKind,
      });
      continue;
    }

    candidates.push({
      productionOrderId: order.productionOrderId,
      number: order.number,
      urgency: urgencyForClass(cls, order),
      priority: order.priority,
    });
  }

  return {
    scanned: orders.length,
    candidates: candidates.sort(compareFactoryReplanCandidates),
    alreadyValid,
    blocked,
    manualAttention,
    skippedTerminal,
    byClass,
  };
}

export function deriveManualSyncOutcome(input: {
  generated: number;
  replanned: number;
  failures: number;
  blocked: number;
  manualAttention: number;
}): ManualSyncOutcome {
  const changed = input.generated + input.replanned;
  const attention = input.blocked + input.manualAttention + input.failures;
  if (changed === 0 && attention === 0) return 'UP_TO_DATE';
  if (attention > 0) return 'PARTIAL';
  return 'CHANGED';
}

export function pinnedIssuesFromAttention(
  items: ManualSyncAttentionItem[],
): PinnedUnavailableIssue[] {
  return items.map((item) => ({
    productionOrderId: item.productionOrderId,
    allocationId: item.productionOrderId,
    orderNumber: item.number,
    ymd: '',
  }));
}
