import { CapacityTracker } from '../capacity';
import {
  detectConflicts,
  type ConflictAllocationInput,
  type DetectedConflict,
} from '../conflict-detector';
import {
  findResolutionPlacement,
  isAllocationFixed,
  missesCommitment,
  pickMovableSides,
  sortConflictsForResolveAll,
} from '../conflict-resolve';
import { amman, eightHourCalendar, NOW, worker, STG } from './scheduling-capacity-uat.fixtures';
import type { OccupancyInterval, Priority } from '../types';

function alloc(
  partial: Partial<ConflictAllocationInput> & Pick<ConflictAllocationInput, 'id' | 'plannedStart' | 'plannedEnd'>,
): ConflictAllocationInput {
  return {
    employeeId: 'w-1',
    employeeName: 'Ahmad',
    resourceSlot: null,
    isPinned: false,
    productionOrderId: `po-${partial.id}`,
    scheduleId: `sch-${partial.id}`,
    scheduleVersion: 1,
    scheduleStatus: 'APPROVED',
    productionTaskId: `task-${partial.id}`,
    taskStatus: 'READY',
    taskName: 'Upholstery',
    stageDefinitionId: STG.upholstery,
    stageName: 'Upholstery',
    orderNumber: `PO-${partial.id}`,
    productName: 'Sofa',
    priority: 'NORMAL' as Priority,
    requestedDeliveryDate: new Date('2026-08-22T00:00:00.000Z'),
    committedDeliveryDate: null,
    customerId: 'cust-1',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    estimatedMinutes: 180,
    ...partial,
  };
}

function pairOf(a: ConflictAllocationInput, b: ConflictAllocationInput): DetectedConflict {
  const found = detectConflicts([a, b], NOW);
  if (!found[0]) throw new Error('expected a conflict pair');
  return found[0];
}

describe('pickMovableSides', () => {
  it('47: HIGH keeps the slot; NORMAL is movable', () => {
    const high = alloc({
      id: 'high',
      priority: 'HIGH',
      plannedStart: amman(2026, 8, 16, 10),
      plannedEnd: amman(2026, 8, 16, 13),
    });
    const normal = alloc({
      id: 'norm',
      priority: 'NORMAL',
      plannedStart: amman(2026, 8, 16, 11, 30),
      plannedEnd: amman(2026, 8, 16, 14, 30),
    });
    const pick = pickMovableSides(pairOf(high, normal));
    expect('bothFixed' in pick).toBe(false);
    if ('bothFixed' in pick) return;
    expect(pick.keeper.productionOrderId).toBe('po-high');
    expect(pick.movable.productionOrderId).toBe('po-norm');
  });

  it('51: planner pin keeps the slot; only admin pins on both sides lock', () => {
    const a = alloc({
      id: 'a',
      isPinned: true,
      plannedStart: amman(2026, 8, 16, 10),
      plannedEnd: amman(2026, 8, 16, 13),
    });
    const b = alloc({
      id: 'b',
      plannedStart: amman(2026, 8, 16, 11),
      plannedEnd: amman(2026, 8, 16, 14),
    });
    const pick = pickMovableSides(pairOf(a, b));
    expect('bothFixed' in pick).toBe(false);
    if ('bothFixed' in pick) return;
    expect(pick.keeper.allocationId).toBe('a');
    expect(pick.movable.allocationId).toBe('b');

    const bothPlannerPinned = pickMovableSides(
      pairOf({ ...a, isPinned: true }, { ...b, isPinned: true }),
    );
    expect('bothFixed' in bothPlannerPinned).toBe(false);

    const locked = pickMovableSides(
      pairOf(
        { ...a, isPinned: true, manuallyAdjusted: true },
        { ...b, isPinned: true, manuallyAdjusted: true },
      ),
    );
    expect(locked).toEqual({ bothFixed: true });
  });

  it('52: IN_PROGRESS stays on the clock but can be reassigned', () => {
    expect(isAllocationFixed({ isPinned: false, taskStatus: 'IN_PROGRESS' })).toBe(true);
    expect(isAllocationFixed({ isPinned: false, taskStatus: 'COMPLETED' })).toBe(true);
    expect(isAllocationFixed({ isPinned: false, taskStatus: 'READY' })).toBe(false);

    const high = alloc({
      id: 'high',
      priority: 'HIGH',
      taskStatus: 'IN_PROGRESS',
      isPinned: true,
      plannedStart: amman(2026, 8, 16, 10),
      plannedEnd: amman(2026, 8, 16, 13),
    });
    const normal = alloc({
      id: 'norm',
      priority: 'NORMAL',
      taskStatus: 'IN_PROGRESS',
      isPinned: true,
      plannedStart: amman(2026, 8, 16, 11, 30),
      plannedEnd: amman(2026, 8, 16, 14, 30),
    });
    const pick = pickMovableSides(pairOf(high, normal));
    expect('bothFixed' in pick).toBe(false);
    if ('bothFixed' in pick) return;
    expect(pick.movable.productionOrderId).toBe('po-norm');
    expect(pick.sameWindowOnly).toBe(true);
  });
});

describe('findResolutionPlacement', () => {
  const calendar = eightHourCalendar();

  it('48: reassigns to a free eligible worker in the same window', () => {
    const keeper = alloc({
      id: 'keep',
      employeeId: 'w-1',
      plannedStart: amman(2026, 8, 16, 10),
      plannedEnd: amman(2026, 8, 16, 13),
    });
    const movable = alloc({
      id: 'move',
      employeeId: 'w-1',
      plannedStart: amman(2026, 8, 16, 11, 30),
      plannedEnd: amman(2026, 8, 16, 14, 30),
      estimatedMinutes: 180,
    });
    const occupancy: OccupancyInterval[] = [
      { employeeId: 'w-1', start: keeper.plannedStart, end: keeper.plannedEnd, allocationId: keeper.id },
    ];
    const result = findResolutionPlacement({
      movable,
      keeper,
      workers: [worker('w-1', [STG.upholstery]), worker('w-2', [STG.upholstery])],
      occupancy,
      calendar,
      now: NOW,
    });
    expect('fail' in result).toBe(false);
    if ('fail' in result) return;
    expect(result.action).toBe('REASSIGNED');
    expect(result.employeeId).toBe('w-2');
    expect(result.start.getTime()).toBe(movable.plannedStart.getTime());
  });

  it('49: only one worker → later slot on the same worker', () => {
    const keeper = alloc({
      id: 'keep',
      employeeId: 'w-1',
      plannedStart: amman(2026, 8, 16, 8),
      plannedEnd: amman(2026, 8, 16, 12),
    });
    const movable = alloc({
      id: 'move',
      employeeId: 'w-1',
      plannedStart: amman(2026, 8, 16, 10),
      plannedEnd: amman(2026, 8, 16, 14),
      estimatedMinutes: 240,
    });
    const result = findResolutionPlacement({
      movable,
      keeper,
      workers: [worker('w-1', [STG.upholstery])],
      occupancy: [
        { employeeId: 'w-1', start: keeper.plannedStart, end: keeper.plannedEnd, allocationId: keeper.id },
      ],
      calendar,
      now: NOW,
    });
    expect('fail' in result).toBe(false);
    if ('fail' in result) return;
    expect(result.action).toBe('RESCHEDULED');
    expect(result.employeeId).toBe('w-1');
    expect(result.start.getTime()).toBeGreaterThanOrEqual(keeper.plannedEnd.getTime());
  });

  it('50: no alternative before a hard horizon fails honestly', () => {
    const keeper = alloc({
      id: 'keep',
      employeeId: 'w-1',
      plannedStart: amman(2026, 8, 16, 8),
      plannedEnd: amman(2026, 8, 16, 16),
    });
    const movable = alloc({
      id: 'move',
      employeeId: 'w-1',
      plannedStart: amman(2026, 8, 16, 10),
      plannedEnd: amman(2026, 8, 16, 14),
      estimatedMinutes: 240,
    });
    const result = findResolutionPlacement({
      movable,
      keeper,
      workers: [worker('w-1', [STG.upholstery])],
      occupancy: [
        { employeeId: 'w-1', start: keeper.plannedStart, end: keeper.plannedEnd, allocationId: keeper.id },
      ],
      calendar,
      now: amman(2026, 8, 16, 8),
      horizon: amman(2026, 8, 16, 16),
    });
    expect(result).toEqual({ fail: 'NO_ALTERNATIVE' });
  });

  it('in-progress pair reassigns in the same window and will not move the clock', () => {
    const keeper = alloc({
      id: 'keep',
      employeeId: 'w-1',
      taskStatus: 'IN_PROGRESS',
      plannedStart: amman(2026, 8, 16, 10),
      plannedEnd: amman(2026, 8, 16, 13),
    });
    const movable = alloc({
      id: 'move',
      employeeId: 'w-1',
      taskStatus: 'IN_PROGRESS',
      plannedStart: amman(2026, 8, 16, 11, 30),
      plannedEnd: amman(2026, 8, 16, 14, 30),
      estimatedMinutes: 180,
    });
    const occupancy: OccupancyInterval[] = [
      { employeeId: 'w-1', start: keeper.plannedStart, end: keeper.plannedEnd, allocationId: keeper.id },
    ];
    const reassigned = findResolutionPlacement({
      movable,
      keeper,
      workers: [worker('w-1', [STG.upholstery]), worker('w-2', [STG.upholstery])],
      occupancy,
      calendar,
      now: NOW,
      sameWindowOnly: true,
    });
    expect('fail' in reassigned).toBe(false);
    if ('fail' in reassigned) return;
    expect(reassigned.action).toBe('REASSIGNED');
    expect(reassigned.employeeId).toBe('w-2');
    expect(reassigned.start.getTime()).toBe(movable.plannedStart.getTime());

    const stuck = findResolutionPlacement({
      movable,
      keeper,
      workers: [worker('w-1', [STG.upholstery])],
      occupancy,
      calendar,
      now: NOW,
      sameWindowOnly: true,
    });
    expect(stuck).toEqual({ fail: 'NO_ALTERNATIVE' });
  });

  it('does not silently accept a move past committed delivery', () => {
    const end = amman(2026, 8, 23, 16);
    const committed = amman(2026, 8, 20, 8);
    expect(missesCommitment(end, committed)).toBe(true);
    expect(missesCommitment(amman(2026, 8, 19, 16), committed)).toBe(false);
  });
});

describe('sortConflictsForResolveAll', () => {
  it('54: deterministic keeper priority then conflictId', () => {
    const urgent = alloc({
      id: 'u',
      priority: 'URGENT',
      plannedStart: amman(2026, 8, 16, 10),
      plannedEnd: amman(2026, 8, 16, 13),
    });
    const low = alloc({
      id: 'l',
      priority: 'LOW',
      plannedStart: amman(2026, 8, 16, 11),
      plannedEnd: amman(2026, 8, 16, 14),
    });
    const high = alloc({
      id: 'h',
      employeeId: 'w-2',
      priority: 'HIGH',
      plannedStart: amman(2026, 8, 16, 10),
      plannedEnd: amman(2026, 8, 16, 13),
    });
    const normal = alloc({
      id: 'n',
      employeeId: 'w-2',
      priority: 'NORMAL',
      plannedStart: amman(2026, 8, 16, 11),
      plannedEnd: amman(2026, 8, 16, 14),
    });
    const sorted = sortConflictsForResolveAll([pairOf(high, normal), pairOf(urgent, low)]);
    expect(sorted[0]!.allocationA.priority === 'URGENT' || sorted[0]!.allocationB.priority === 'URGENT').toBe(
      true,
    );
  });
});

describe('CapacityTracker exclusive overlap (sanity)', () => {
  it('adjacent reservations do not overlap', () => {
    const tracker = new CapacityTracker();
    tracker.reserve({
      employeeId: 'w-1',
      start: amman(2026, 8, 16, 8),
      end: amman(2026, 8, 16, 12),
      allocationId: 'a',
    });
    expect(tracker.hasOverlap('w-1', amman(2026, 8, 16, 12), amman(2026, 8, 16, 16))).toBe(false);
  });
});
