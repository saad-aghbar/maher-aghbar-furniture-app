import { categorizeConflictInflators } from '../conflict-categorizer';
import {
  conflictPairId,
  detectConflicts,
  intervalsOverlap,
  overlapWindow,
  selectActiveAllocations,
  type ConflictAllocationInput,
} from '../conflict-detector';
import type { Priority } from '../types';

const NOW = new Date('2026-08-15T05:00:00.000Z');

function alloc(
  partial: Partial<ConflictAllocationInput> & Pick<ConflictAllocationInput, 'id' | 'plannedStart' | 'plannedEnd'>,
): ConflictAllocationInput {
  return {
    employeeId: 'w-ahmad',
    employeeName: 'Ahmad Khalil',
    resourceSlot: null,
    isPinned: false,
    productionOrderId: `po-${partial.id}`,
    scheduleId: `sch-${partial.id}`,
    scheduleVersion: 1,
    scheduleStatus: 'APPROVED',
    productionTaskId: `task-${partial.id}`,
    taskStatus: 'READY',
    taskName: 'Upholstery',
    stageDefinitionId: 'stg-upholstery',
    stageName: 'Upholstery',
    orderNumber: `PO-${partial.id}`,
    productName: 'Sofa',
    priority: 'NORMAL' as Priority,
    requestedDeliveryDate: new Date('2026-08-22T00:00:00.000Z'),
    committedDeliveryDate: null,
    customerId: 'cust-1',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    ...partial,
  };
}

describe('overlap math', () => {
  it('does not treat adjacent 08–10 and 10–12 as overlap', () => {
    const a0 = new Date('2026-08-16T05:00:00.000Z'); // 08:00 Asia/Amman
    const a1 = new Date('2026-08-16T07:00:00.000Z'); // 10:00
    const b1 = new Date('2026-08-16T09:00:00.000Z'); // 12:00
    expect(intervalsOverlap(a0, a1, a1, b1)).toBe(false);
  });

  it('treats 08–10:01 and 10–12 as a 1-minute overlap', () => {
    const a0 = new Date('2026-08-16T05:00:00.000Z');
    const a1 = new Date('2026-08-16T07:01:00.000Z');
    const b0 = new Date('2026-08-16T07:00:00.000Z');
    const b1 = new Date('2026-08-16T09:00:00.000Z');
    expect(intervalsOverlap(a0, a1, b0, b1)).toBe(true);
    expect(overlapWindow(a0, a1, b0, b1)?.minutes).toBe(1);
  });
});

describe('detectConflicts', () => {
  it('42: sequential same-day A/B/C is 0 conflicts', () => {
    const rows = [
      alloc({
        id: 'a',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T07:00:00.000Z'),
      }),
      alloc({
        id: 'b',
        plannedStart: new Date('2026-08-16T07:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
      alloc({
        id: 'c',
        plannedStart: new Date('2026-08-16T09:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T13:00:00.000Z'),
      }),
    ];
    expect(detectConflicts(rows, NOW)).toHaveLength(0);
  });

  it('43: true overlap is 1 conflict of 60 minutes', () => {
    const rows = [
      alloc({
        id: 'a',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T08:00:00.000Z'),
      }),
      alloc({
        id: 'b',
        plannedStart: new Date('2026-08-16T07:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T10:00:00.000Z'),
      }),
    ];
    const found = detectConflicts(rows, NOW);
    expect(found).toHaveLength(1);
    expect(found[0]!.overlapMinutes).toBe(60);
    expect(found[0]!.overlapStart.toISOString()).toBe('2026-08-16T07:00:00.000Z');
    expect(found[0]!.overlapEnd.toISOString()).toBe('2026-08-16T08:00:00.000Z');
    expect(found[0]!.type).toBe('WORKER_OVERLAP');
  });

  it('44: A overlaps B counts 1 not 2', () => {
    const rows = [
      alloc({
        id: 'z',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T08:00:00.000Z'),
      }),
      alloc({
        id: 'a',
        plannedStart: new Date('2026-08-16T06:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
    ];
    const found = detectConflicts(rows, NOW);
    expect(found).toHaveLength(1);
    expect(found[0]!.conflictId).toBe(conflictPairId('a', 'z'));
  });

  it('45: 10 orders same day with sequential slots is 0 conflicts', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      alloc({
        id: `o${i}`,
        plannedStart: new Date(Date.UTC(2026, 7, 16, 5, i * 30)),
        plannedEnd: new Date(Date.UTC(2026, 7, 16, 5, i * 30 + 30)),
      }),
    );
    expect(detectConflicts(rows, NOW)).toHaveLength(0);
  });

  it('46: full day 08–12 + 12–16 is 0 conflicts', () => {
    const rows = [
      alloc({
        id: 'a',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
      alloc({
        id: 'b',
        plannedStart: new Date('2026-08-16T09:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T13:00:00.000Z'),
      }),
    ];
    expect(detectConflicts(rows, NOW)).toHaveLength(0);
  });

  it('different workers in the same window are not a conflict', () => {
    const rows = [
      alloc({
        id: 'a',
        employeeId: 'w-1',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
      alloc({
        id: 'b',
        employeeId: 'w-2',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
    ];
    expect(detectConflicts(rows, NOW)).toHaveLength(0);
  });

  it('different resource slots are not a conflict', () => {
    const rows = [
      alloc({
        id: 'a',
        employeeId: null,
        resourceSlot: 0,
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
      alloc({
        id: 'b',
        employeeId: null,
        resourceSlot: 1,
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
    ];
    expect(detectConflicts(rows, NOW)).toHaveLength(0);
  });

  it('same resource slot overlapping is RESOURCE_OVERLAP', () => {
    const rows = [
      alloc({
        id: 'a',
        employeeId: null,
        resourceSlot: 0,
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
      alloc({
        id: 'b',
        employeeId: null,
        resourceSlot: 0,
        plannedStart: new Date('2026-08-16T07:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T11:00:00.000Z'),
      }),
    ];
    const found = detectConflicts(rows, NOW);
    expect(found).toHaveLength(1);
    expect(found[0]!.type).toBe('RESOURCE_OVERLAP');
  });

  it('25: same PO two overlapping tasks on one worker is still a conflict', () => {
    const rows = [
      alloc({
        id: 'a',
        productionOrderId: 'po-same',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
        stageName: 'Foam',
      }),
      alloc({
        id: 'b',
        productionOrderId: 'po-same',
        plannedStart: new Date('2026-08-16T07:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T11:00:00.000Z'),
        stageName: 'Painting',
      }),
    ];
    expect(detectConflicts(rows, NOW)).toHaveLength(1);
  });

  it('26: parallel Foam + Painting on two workers may overlap', () => {
    const rows = [
      alloc({
        id: 'foam',
        employeeId: 'w-foam',
        stageName: 'Foam',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
      alloc({
        id: 'paint',
        employeeId: 'w-paint',
        stageName: 'Painting',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
    ];
    expect(detectConflicts(rows, NOW)).toHaveLength(0);
  });

  it('28: over-capacity day without a worker pair is not WORKER_OVERLAP', () => {
    const rows = [
      alloc({
        id: 'a',
        employeeId: 'w-1',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
      alloc({
        id: 'b',
        employeeId: 'w-2',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T13:00:00.000Z'),
      }),
    ];
    const found = detectConflicts(rows, NOW);
    expect(found.filter((c) => c.type === 'WORKER_OVERLAP')).toHaveLength(0);
  });

  it('53: completed historical overlap is not an active conflict', () => {
    const rows = [
      alloc({
        id: 'a',
        taskStatus: 'COMPLETED',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
      alloc({
        id: 'b',
        plannedStart: new Date('2026-08-16T07:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T11:00:00.000Z'),
      }),
    ];
    expect(detectConflicts(rows, NOW)).toHaveLength(0);
    expect(selectActiveAllocations(rows, NOW).map((a) => a.id)).toEqual(['b']);
  });

  it('ignores stale older schedule versions', () => {
    const rows = [
      alloc({
        id: 'old-a',
        productionOrderId: 'po-1',
        scheduleVersion: 1,
        scheduleStatus: 'APPROVED',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
      alloc({
        id: 'new-a',
        productionOrderId: 'po-1',
        scheduleVersion: 2,
        scheduleStatus: 'PROPOSED',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T07:00:00.000Z'),
      }),
      alloc({
        id: 'b',
        productionOrderId: 'po-2',
        plannedStart: new Date('2026-08-16T08:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T11:00:00.000Z'),
      }),
    ];
    expect(detectConflicts(rows, NOW)).toHaveLength(0);
  });

  it('55: high-count fixture categorizes inflators; active count is unique operational only', () => {
    const rows: ConflictAllocationInput[] = [];
    // 10 overlapping allocations on one worker → C(10,2)=45 naive pairs
    for (let i = 0; i < 10; i++) {
      rows.push(
        alloc({
          id: `live-${i}`,
          plannedStart: new Date('2026-08-16T05:00:00.000Z'),
          plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
        }),
      );
    }
    // completed historical overlap
    rows.push(
      alloc({
        id: 'done-a',
        taskStatus: 'COMPLETED',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
      }),
      alloc({
        id: 'done-b',
        taskStatus: 'COMPLETED',
        plannedStart: new Date('2026-08-16T06:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T10:00:00.000Z'),
      }),
    );
    // stale dual version of po-live-0
    rows.push(
      alloc({
        id: 'stale-0',
        productionOrderId: 'po-live-0',
        scheduleVersion: 0,
        scheduleStatus: 'APPROVED',
        plannedStart: new Date('2026-08-16T05:00:00.000Z'),
        plannedEnd: new Date('2026-08-16T12:00:00.000Z'),
      }),
    );

    const cats = categorizeConflictInflators(rows, NOW);
    expect(cats.rawPairCount).toBeGreaterThan(45);
    expect(cats.staleDualVersionPairs).toBeGreaterThan(0);
    expect(cats.completedHistoricalPairs).toBeGreaterThan(0);
    expect(cats.activeOperationalCount).toBe(45);
    expect(detectConflicts(rows, NOW)).toHaveLength(45);
    expect(cats.chipDoubleCountExample).toBe(45 + cats.affectedOrderCount);
    expect(cats.boundaryTouchingPairs).toBe(0);
    expect(cats.duplicateSymmetricPairs).toBe(0);
  });
});
