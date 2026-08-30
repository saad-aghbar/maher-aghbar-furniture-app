import {
  classifyManualSyncOrder,
  deriveManualSyncOutcome,
  selectManualSyncCandidates,
  stillNonRecoverableBlocker,
  type ManualSyncOrderFacts,
} from '../manual-sync';
import { amman } from './scheduling-capacity-uat.fixtures';

function facts(
  overrides: Partial<ManualSyncOrderFacts> & Pick<ManualSyncOrderFacts, 'productionOrderId' | 'number'>,
): ManualSyncOrderFacts {
  return {
    poStatus: 'IN_PROGRESS',
    hasActiveSchedule: true,
    hasIncompleteFutureAllocations: true,
    hasStaleIncomplete: false,
    hasPastIncompletePin: false,
    primaryStatus: 'ON_TRACK',
    stillBlocked: false,
    blockerKind: null,
    blockerCleared: false,
    illegalUnpinned: false,
    illegalPinned: false,
    ineligibleAssignedWorker: false,
    inMovableConflict: false,
    inPinnedConflict: false,
    hasPromiseDate: true,
    planningMode: 'BACKWARD',
    priority: {
      id: overrides.productionOrderId,
      customerId: 'c1',
      isPinned: false,
      priority: 'NORMAL',
      createdAt: amman(2026, 8, 1, 8, 0),
    },
    ...overrides,
  };
}

describe('manual-sync classification', () => {
  it('skips terminal orders', () => {
    expect(classifyManualSyncOrder(facts({ productionOrderId: 'a', number: 'PO-A', poStatus: 'COMPLETED' }))).toBe(
      'SKIP_COMPLETED',
    );
    expect(classifyManualSyncOrder(facts({ productionOrderId: 'b', number: 'PO-B', poStatus: 'CANCELLED' }))).toBe(
      'SKIP_CANCELLED',
    );
  });

  it('never selects still-blocked material/WIP/worker/estimate orders for generate', () => {
    const blocked = [
      facts({
        productionOrderId: 'm',
        number: 'PO-M',
        stillBlocked: true,
        blockerKind: 'MATERIAL_NOT_READY',
        hasActiveSchedule: false,
      }),
      facts({
        productionOrderId: 'w',
        number: 'PO-W',
        stillBlocked: true,
        blockerKind: 'WIP_NOT_READY',
        hasActiveSchedule: false,
      }),
      facts({
        productionOrderId: 'e',
        number: 'PO-E',
        stillBlocked: true,
        blockerKind: 'NO_ELIGIBLE_WORKER',
      }),
      facts({
        productionOrderId: 'x',
        number: 'PO-X',
        stillBlocked: true,
        blockerKind: 'MISSING_ESTIMATE',
        hasActiveSchedule: false,
      }),
    ];
    const selected = selectManualSyncCandidates(blocked);
    expect(selected.candidates).toHaveLength(0);
    expect(selected.blocked).toHaveLength(4);
    expect(stillNonRecoverableBlocker({
      materialBlocked: true,
      wipBlocked: false,
      noEligibleWorker: false,
      missingEstimate: false,
    })).toBe(true);
  });

  it('promotes a cleared blocker into generate/replan', () => {
    const selected = selectManualSyncCandidates([
      facts({
        productionOrderId: 'c',
        number: 'PO-C',
        stillBlocked: false,
        blockerCleared: true,
        hasActiveSchedule: true,
        hasIncompleteFutureAllocations: false,
        blockerKind: null,
      }),
    ]);
    expect(selected.candidates.map((c) => c.productionOrderId)).toEqual(['c']);
    expect(selected.blocked).toHaveLength(0);
  });

  it('generates unscheduled ready work and skips healthy backward', () => {
    const selected = selectManualSyncCandidates([
      facts({
        productionOrderId: 'u',
        number: 'PO-U',
        hasActiveSchedule: false,
        hasIncompleteFutureAllocations: false,
      }),
      facts({
        productionOrderId: 'h',
        number: 'PO-H',
        primaryStatus: 'ON_TRACK',
        planningMode: 'BACKWARD',
        hasPromiseDate: true,
      }),
    ]);
    expect(selected.candidates.map((c) => c.number)).toEqual(['PO-U']);
    expect(selected.alreadyValid).toBe(1);
  });

  it('replans mixed stale+future incomplete work', () => {
    expect(
      classifyManualSyncOrder(
        facts({
          productionOrderId: 'stale',
          number: 'PO-STALE',
          hasIncompleteFutureAllocations: true,
          hasStaleIncomplete: true,
        }),
      ),
    ).toBe('NEEDS_REPLAN');
  });

  it('leaves incomplete past pins as manual attention', () => {
    expect(
      classifyManualSyncOrder(
        facts({
          productionOrderId: 'pin',
          number: 'PO-PIN',
          hasPastIncompletePin: true,
          hasIncompleteFutureAllocations: true,
        }),
      ),
    ).toBe('MANUAL_ATTENTION');
  });

  it('replans illegal unpinned work and leaves pins as manual attention', () => {
    const selected = selectManualSyncCandidates([
      facts({ productionOrderId: 'i', number: 'PO-I', illegalUnpinned: true }),
      facts({ productionOrderId: 'p', number: 'PO-P', illegalPinned: true }),
    ]);
    expect(selected.candidates.map((c) => c.number)).toEqual(['PO-I']);
    expect(selected.manualAttention.map((a) => a.number)).toEqual(['PO-P']);
  });

  it('does not move a pinned conflict automatically', () => {
    const selected = selectManualSyncCandidates([
      facts({ productionOrderId: 'pc', number: 'PO-PC', inPinnedConflict: true }),
    ]);
    expect(selected.candidates).toHaveLength(0);
    expect(selected.manualAttention).toHaveLength(1);
  });

  it('selects at-risk recovery and respects priority inside the group', () => {
    const selected = selectManualSyncCandidates([
      facts({
        productionOrderId: 'n',
        number: 'PO-N',
        primaryStatus: 'AT_RISK',
        priority: {
          id: 'n',
          customerId: 'c1',
          isPinned: false,
          priority: 'NORMAL',
          createdAt: amman(2026, 8, 1, 8, 0),
        },
      }),
      facts({
        productionOrderId: 'h',
        number: 'PO-H',
        primaryStatus: 'AT_RISK',
        priority: {
          id: 'h',
          customerId: 'c1',
          isPinned: false,
          priority: 'HIGH',
          createdAt: amman(2026, 8, 1, 8, 0),
        },
      }),
    ]);
    expect(selected.candidates.map((c) => c.number)).toEqual(['PO-H', 'PO-N']);
  });

  it('second pass of only valid orders is empty packing', () => {
    const selected = selectManualSyncCandidates([
      facts({ productionOrderId: 'h', number: 'PO-H' }),
    ]);
    expect(selected.candidates).toHaveLength(0);
    expect(deriveManualSyncOutcome({
      generated: 0,
      replanned: 0,
      failures: 0,
      blocked: 0,
      manualAttention: 0,
    })).toBe('UP_TO_DATE');
  });

  it('blocked-only factory is PARTIAL not UP_TO_DATE', () => {
    expect(
      deriveManualSyncOutcome({
        generated: 0,
        replanned: 0,
        failures: 0,
        blocked: 2,
        manualAttention: 0,
      }),
    ).toBe('PARTIAL');
  });

  it('repairs without leftover attention are CHANGED', () => {
    expect(
      deriveManualSyncOutcome({
        generated: 1,
        replanned: 2,
        failures: 0,
        blocked: 0,
        manualAttention: 0,
      }),
    ).toBe('CHANGED');
  });
});
