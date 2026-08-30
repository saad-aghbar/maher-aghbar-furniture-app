import {
  allocationViolatesSchedulingFloor,
  assertNoPastIncompleteAllocations,
  classifyAllocationForFloor,
  findPastIncompleteViolations,
  isHistoricalCapacityIncrease,
  PastFloorViolationError,
  resolvePlannerNow,
  resolveSchedulingFloor,
} from '../scheduling-floor';
import { amman, sevenHourCalendar } from './scheduling-capacity-uat.fixtures';

describe('resolveSchedulingFloor', () => {
  const cal = sevenHourCalendar();

  it('keeps the current instant during a working interval (remaining today)', () => {
    const now = amman(2026, 8, 22, 14, 0);
    expect(resolveSchedulingFloor(cal, now).toISOString()).toBe(now.toISOString());
  });

  it('jumps to after lunch when now is inside the break', () => {
    const now = amman(2026, 8, 22, 12, 30);
    expect(resolveSchedulingFloor(cal, now).toISOString()).toBe(amman(2026, 8, 22, 13, 0).toISOString());
  });

  it('jumps to next working interval after shift end', () => {
    const now = amman(2026, 8, 22, 17, 0); // Saturday after 16:00
    expect(resolveSchedulingFloor(cal, now).toISOString()).toBe(amman(2026, 8, 23, 8, 0).toISOString());
  });

  it('jumps Friday closed to Saturday open', () => {
    const now = amman(2026, 8, 21, 10, 0); // Friday
    expect(resolveSchedulingFloor(cal, now).toISOString()).toBe(amman(2026, 8, 22, 8, 0).toISOString());
  });
});

describe('resolvePlannerNow', () => {
  const cal = sevenHourCalendar();
  const wall = amman(2026, 8, 22, 14, 0);

  it('uses the floor when fromDate is omitted', () => {
    expect(resolvePlannerNow(cal, wall).toISOString()).toBe(wall.toISOString());
  });

  it('never lets fromDate pull below the floor', () => {
    const past = amman(2026, 8, 18, 8, 0);
    expect(resolvePlannerNow(cal, wall, past).toISOString()).toBe(wall.toISOString());
  });

  it('allows a later fromDate (admin move-to-day)', () => {
    const future = amman(2026, 8, 30, 8, 0);
    expect(resolvePlannerNow(cal, wall, future).toISOString()).toBe(future.toISOString());
  });
});

describe('classifyAllocationForFloor', () => {
  const floor = amman(2026, 8, 22, 14, 0);

  it('COMPLETED is historical', () => {
    expect(
      classifyAllocationForFloor({
        plannedStart: amman(2026, 8, 18, 8, 0),
        taskStatus: 'COMPLETED',
        floor,
      }),
    ).toBe('PAST_COMPLETED');
  });

  it('IN_PROGRESS is preserved even when started before the floor', () => {
    expect(
      classifyAllocationForFloor({
        plannedStart: amman(2026, 8, 22, 8, 0),
        taskStatus: 'IN_PROGRESS',
        floor,
      }),
    ).toBe('IN_PROGRESS');
  });

  it('unpinned incomplete before the floor is STALE (including crossing not-started)', () => {
    expect(
      classifyAllocationForFloor({
        plannedStart: amman(2026, 8, 22, 8, 0),
        taskStatus: 'READY',
        floor,
      }),
    ).toBe('STALE');
    expect(
      classifyAllocationForFloor({
        plannedStart: amman(2026, 8, 21, 8, 0),
        taskStatus: 'READY',
        isPinned: false,
        floor,
      }),
    ).toBe('STALE');
  });

  it('incomplete pinned in the past is MANUAL_ATTENTION', () => {
    expect(
      classifyAllocationForFloor({
        plannedStart: amman(2026, 8, 18, 8, 0),
        taskStatus: 'READY',
        isPinned: true,
        floor,
      }),
    ).toBe('MANUAL_ATTENTION');
  });

  it('incomplete on or after the floor is FUTURE', () => {
    expect(
      classifyAllocationForFloor({
        plannedStart: amman(2026, 8, 22, 14, 0),
        taskStatus: 'READY',
        floor,
      }),
    ).toBe('FUTURE');
  });
});

describe('assertNoPastIncompleteAllocations', () => {
  const floor = amman(2026, 8, 22, 14, 0);

  it('allows IN_PROGRESS, COMPLETED, preserved pins, and future work', () => {
    expect(() =>
      assertNoPastIncompleteAllocations(
        [
          { plannedStart: amman(2026, 8, 18, 8, 0), taskStatus: 'COMPLETED' },
          { plannedStart: amman(2026, 8, 22, 8, 0), taskStatus: 'IN_PROGRESS' },
          { plannedStart: amman(2026, 8, 18, 8, 0), taskStatus: 'READY', isPinned: true },
          { plannedStart: amman(2026, 8, 22, 14, 0), taskStatus: 'READY' },
        ],
        floor,
      ),
    ).not.toThrow();
  });

  it('fails on new movable incomplete work before the floor', () => {
    expect(
      allocationViolatesSchedulingFloor({
        plannedStart: amman(2026, 8, 21, 8, 0),
        taskStatus: 'READY',
        floor,
      }),
    ).toBe(true);
    const violations = findPastIncompleteViolations(
      [{ plannedStart: amman(2026, 8, 21, 8, 0), taskStatus: 'READY', stageCode: 'FOAM' }],
      floor,
    );
    expect(violations).toHaveLength(1);
    expect(() =>
      assertNoPastIncompleteAllocations(
        [{ plannedStart: amman(2026, 8, 21, 8, 0), taskStatus: 'READY' }],
        floor,
      ),
    ).toThrow(PastFloorViolationError);
  });
});

describe('isHistoricalCapacityIncrease', () => {
  it('treats a day before the floor YMD as historical', () => {
    expect(isHistoricalCapacityIncrease('2026-08-18', '2026-08-22')).toBe(true);
    expect(isHistoricalCapacityIncrease('2026-08-22', '2026-08-22')).toBe(false);
    expect(isHistoricalCapacityIncrease('2026-08-25', '2026-08-22')).toBe(false);
    expect(isHistoricalCapacityIncrease(null, '2026-08-22')).toBe(false);
  });
});
