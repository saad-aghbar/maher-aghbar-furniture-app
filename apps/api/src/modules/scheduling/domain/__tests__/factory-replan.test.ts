import {
  classifyMinutesDelta,
  classifySettingsDelta,
  compareFactoryReplanCandidates,
  factoryReplanHorizonYmd,
  findOccupancyCollisions,
  listPinnedOnUnavailableCalendar,
  occupancyFromGeneratedAllocations,
  plannedAllocationsMatch,
  operationalOverlapKey,
  selectDecreaseCandidates,
  selectIncreaseCandidates,
  selectIncreaseUrgency,
  stripOccupancyForOrder,
  unionOccupancyIntervals,
  workingMinutesOnYmd,
  type FactoryReplanOrderInput,
} from '../factory-replan';
import { amman, eightHourCalendar } from './scheduling-capacity-uat.fixtures';

function orderInput(
  overrides: Partial<FactoryReplanOrderInput> & Pick<FactoryReplanOrderInput, 'productionOrderId' | 'number'>,
): FactoryReplanOrderInput {
  return {
    classification: { primaryStatus: 'ON_TRACK', recoverableAutomatically: true },
    hasPromiseDate: true,
    planningMode: 'BACKWARD',
    priority: {
      id: overrides.productionOrderId,
      customerId: 'c1',
      isPinned: false,
      priority: 'NORMAL',
      createdAt: amman(2026, 8, 1, 8, 0),
    },
    allocations: [],
    ...overrides,
  };
}

describe('factory-replan domain', () => {
  const open = eightHourCalendar();
  const shutdownWed = eightHourCalendar({
    exceptions: [{ date: amman(2026, 8, 12, 12, 0), type: 'SHUTDOWN' }],
  });
  const overtimeThu = eightHourCalendar({
    exceptions: [
      {
        date: amman(2026, 8, 13, 12, 0),
        type: 'EXTRA_SHIFT',
        shiftStart: '08:00',
        shiftEnd: '20:00',
      },
    ],
  });
  const sameHoursExtra = eightHourCalendar({
    exceptions: [
      {
        date: amman(2026, 8, 13, 12, 0),
        type: 'EXTRA_SHIFT',
        shiftStart: '08:00',
        shiftEnd: '16:00',
      },
    ],
  });

  it('classifies shutdown as decrease, overtime as increase, same-hours EXTRA_SHIFT as none', () => {
    expect(classifyMinutesDelta(workingMinutesOnYmd(open, '2026-08-12'), workingMinutesOnYmd(shutdownWed, '2026-08-12'))).toBe(
      'decrease',
    );
    expect(classifyMinutesDelta(workingMinutesOnYmd(open, '2026-08-13'), workingMinutesOnYmd(overtimeThu, '2026-08-13'))).toBe(
      'increase',
    );
    expect(
      classifyMinutesDelta(workingMinutesOnYmd(open, '2026-08-13'), workingMinutesOnYmd(sameHoursExtra, '2026-08-13')),
    ).toBe('none');
  });

  it('settings weekday add is an increase', () => {
    const friClosed = eightHourCalendar({ workingWeekdays: [0, 1, 2, 3, 4] });
    const friOpen = eightHourCalendar({ workingWeekdays: [0, 1, 2, 3, 4, 5] });
    expect(classifySettingsDelta(friClosed, friOpen, '2026-08-14')).toBe('increase');
  });

  it('horizon is changed date through max(changed+90, latest allocation end)', () => {
    const short = factoryReplanHorizonYmd('2026-08-19', null, 'Asia/Amman');
    expect(short.fromYmd).toBe('2026-08-19');
    expect(short.toYmd).toBe('2026-11-17');
    const long = factoryReplanHorizonYmd('2026-08-19', amman(2027, 2, 1, 16, 0), 'Asia/Amman');
    expect(long.toYmd).toBe('2027-02-01');
  });

  it('increase selects LATE, AT_RISK, recoverable BLOCKED, and forward — skips healthy backward', () => {
    const candidates = selectIncreaseCandidates([
      orderInput({
        productionOrderId: 'late',
        number: 'PO-LATE',
        classification: { primaryStatus: 'LATE', recoverableAutomatically: true },
        priority: {
          id: 'late',
          customerId: 'c1',
          isPinned: false,
          priority: 'NORMAL',
          createdAt: amman(2026, 8, 1, 8, 0),
        },
      }),
      orderInput({
        productionOrderId: 'risk',
        number: 'PO-RISK',
        classification: { primaryStatus: 'AT_RISK', recoverableAutomatically: true },
      }),
      orderInput({
        productionOrderId: 'blocked',
        number: 'PO-BLK',
        classification: { primaryStatus: 'BLOCKED', recoverableAutomatically: true },
      }),
      orderInput({
        productionOrderId: 'fwd',
        number: 'PO-FWD',
        hasPromiseDate: false,
        planningMode: 'FORWARD',
      }),
      orderInput({
        productionOrderId: 'healthy',
        number: 'PO-OK',
        classification: { primaryStatus: 'ON_TRACK', recoverableAutomatically: true },
        hasPromiseDate: true,
        planningMode: 'BACKWARD',
      }),
    ]);
    expect(candidates.map((c) => c.productionOrderId)).toEqual(['late', 'risk', 'blocked', 'fwd']);
  });

  it('HIGH at-risk sorts before NORMAL at-risk', () => {
    const high = orderInput({
      productionOrderId: 'high',
      number: 'PO-H',
      classification: { primaryStatus: 'AT_RISK', recoverableAutomatically: true },
      priority: {
        id: 'high',
        customerId: 'c1',
        isPinned: false,
        priority: 'HIGH',
        createdAt: amman(2026, 8, 2, 8, 0),
      },
    });
    const normal = orderInput({
      productionOrderId: 'normal',
      number: 'PO-N',
      classification: { primaryStatus: 'AT_RISK', recoverableAutomatically: true },
      priority: {
        id: 'normal',
        customerId: 'c1',
        isPinned: false,
        priority: 'NORMAL',
        createdAt: amman(2026, 8, 1, 8, 0),
      },
    });
    const sorted = selectIncreaseCandidates([normal, high]);
    expect(sorted[0]!.productionOrderId).toBe('high');
    expect(compareFactoryReplanCandidates(sorted[0]!, sorted[1]!)).toBeLessThan(0);
  });

  it('empty increase candidate set is a pass', () => {
    expect(
      selectIncreaseCandidates([
        orderInput({
          productionOrderId: 'healthy',
          number: 'PO-OK',
          classification: { primaryStatus: 'ON_TRACK', recoverableAutomatically: true },
          hasPromiseDate: true,
        }),
      ]),
    ).toEqual([]);
  });

  it('decrease replans unpinned illegal windows and collects pinned issues', () => {
    const unpinned = orderInput({
      productionOrderId: 'move',
      number: 'PO-MOVE',
      allocations: [
        {
          id: 'a-free',
          plannedStart: amman(2026, 8, 12, 8, 0),
          plannedEnd: amman(2026, 8, 12, 12, 0),
          isPinned: false,
          taskStatus: 'READY',
        },
      ],
    });
    const pinned = orderInput({
      productionOrderId: 'pin',
      number: 'PO-PIN',
      allocations: [
        {
          id: 'a-pin',
          plannedStart: amman(2026, 8, 12, 8, 0),
          plannedEnd: amman(2026, 8, 12, 12, 0),
          isPinned: true,
          taskStatus: 'READY',
        },
      ],
    });
    const wip = orderInput({
      productionOrderId: 'wip',
      number: 'PO-WIP',
      allocations: [
        {
          id: 'a-wip',
          plannedStart: amman(2026, 8, 12, 8, 0),
          plannedEnd: amman(2026, 8, 12, 12, 0),
          isPinned: false,
          taskStatus: 'IN_PROGRESS',
        },
      ],
    });
    const selected = selectDecreaseCandidates([unpinned, pinned, wip], shutdownWed);
    expect(selected.candidates.map((c) => c.productionOrderId)).toEqual(['move']);
    expect(selected.pinnedIssues.map((i) => i.allocationId)).toEqual(['a-pin']);
    expect(selected.pinnedIssues[0]!.ymd).toBe('2026-08-12');
  });

  it('listPinnedOnUnavailableCalendar reports pinned work on a shutdown day', () => {
    const issues = listPinnedOnUnavailableCalendar(
      [
        {
          id: 'a1',
          plannedStart: amman(2026, 8, 12, 8, 0),
          plannedEnd: amman(2026, 8, 12, 16, 0),
          isPinned: true,
          taskStatus: 'READY',
          productionOrderId: 'po-1',
          orderNumber: 'PO-1',
        },
      ],
      shutdownWed,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.ymd).toBe('2026-08-12');
  });

  it('decrease moves unpinned overtime occupancy after hours shrink', () => {
    const selected = selectDecreaseCandidates(
      [
        orderInput({
          productionOrderId: 'ot',
          number: 'PO-OT',
          allocations: [
            {
              id: 'a-ot',
              plannedStart: amman(2026, 8, 13, 16, 0),
              plannedEnd: amman(2026, 8, 13, 20, 0),
              isPinned: false,
              taskStatus: 'READY',
            },
          ],
        }),
      ],
      open,
    );
    expect(selected.candidates.map((c) => c.productionOrderId)).toEqual(['ot']);
  });

  it('lunch gap alone is not an unavailable window', () => {
    const withLunch = eightHourCalendar({ breaks: [{ start: '12:00', end: '13:00' }] });
    const selected = selectDecreaseCandidates(
      [
        orderInput({
          productionOrderId: 'lunch',
          number: 'PO-L',
          allocations: [
            {
              id: 'a-l',
              plannedStart: amman(2026, 8, 12, 8, 0),
              plannedEnd: amman(2026, 8, 12, 16, 0),
              isPinned: false,
              taskStatus: 'READY',
            },
          ],
        }),
      ],
      withLunch,
    );
    expect(selected.candidates).toEqual([]);
    expect(selected.pinnedIssues).toEqual([]);
  });

  it('selectIncreaseUrgency skips awaiting-approval healthy backward plans', () => {
    expect(
      selectIncreaseUrgency({
        primaryStatus: 'AWAITING_APPROVAL',
        recoverableAutomatically: true,
        hasPromiseDate: true,
        planningMode: 'BACKWARD',
      }),
    ).toBe('skip');
  });
});

describe('factory replan occupancy helpers', () => {
  it('unionOccupancyIntervals fills overlapping seed holes', () => {
    const a = amman(2026, 8, 16, 8, 0);
    const b = amman(2026, 8, 16, 9, 0);
    const c = amman(2026, 8, 16, 10, 0);
    const d = amman(2026, 8, 16, 11, 0);
    const merged = unionOccupancyIntervals([
      { employeeId: 'w1', start: a, end: c, allocationId: '1', productionOrderId: 'po-a' },
      { employeeId: 'w1', start: b, end: d, allocationId: '2', productionOrderId: 'po-b' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.start.getTime()).toBe(a.getTime());
    expect(merged[0]!.end.getTime()).toBe(d.getTime());
  });

  it('unionOccupancyIntervals does not merge adjacent (end === start) intervals', () => {
    const a = amman(2026, 8, 16, 8, 0);
    const b = amman(2026, 8, 16, 10, 0);
    const c = amman(2026, 8, 16, 12, 0);
    const merged = unionOccupancyIntervals([
      { employeeId: 'w1', start: a, end: b, allocationId: '1' },
      { employeeId: 'w1', start: b, end: c, allocationId: '2' },
    ]);
    expect(merged).toHaveLength(2);
  });

  it('findOccupancyCollisions reports overlap against force-reserved occupancy', () => {
    const start = amman(2026, 8, 16, 8, 0);
    const mid = amman(2026, 8, 16, 9, 0);
    const end = amman(2026, 8, 16, 10, 0);
    const hits = findOccupancyCollisions(
      [{ employeeId: 'w1', start, end, allocationId: 'seed' }],
      [{ employeeId: 'w1', start: mid, end, allocationId: 'new', productionOrderId: 'po-x' }],
    );
    expect(hits).toHaveLength(1);
  });

  it('stripOccupancyForOrder drops only that PO', () => {
    const start = amman(2026, 8, 16, 8, 0);
    const end = amman(2026, 8, 16, 9, 0);
    const kept = stripOccupancyForOrder(
      [
        { employeeId: 'w1', start, end, allocationId: 'a', productionOrderId: 'po-1' },
        { employeeId: 'w1', start, end, allocationId: 'b', productionOrderId: 'po-2' },
      ],
      'po-1',
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]!.productionOrderId).toBe('po-2');
  });

  it('occupancyFromGeneratedAllocations emits employee and resource keys', () => {
    const start = amman(2026, 8, 16, 8, 0);
    const end = amman(2026, 8, 16, 9, 0);
    const rows = occupancyFromGeneratedAllocations('po-1', [
      {
        id: 'alloc-1',
        employee: { id: 'w1' },
        resourceSlot: 0,
        task: { stageDefinitionId: 'stg-cnc' },
        plannedStart: start,
        plannedEnd: end,
      },
    ]);
    expect(rows.map((r) => r.employeeId).sort()).toEqual(['resource:stg-cnc:0', 'w1']);
  });

  it('plannedAllocationsMatch ignores allocation id churn', () => {
    const start = amman(2026, 8, 16, 8, 0);
    const end = amman(2026, 8, 16, 9, 0);
    expect(
      plannedAllocationsMatch(
        [{ productionTaskId: 't1', plannedStart: start, plannedEnd: end, employeeId: 'w1', resourceSlot: 0 }],
        [{ productionTaskId: 't1', plannedStart: start, plannedEnd: end, employeeId: 'w1', resourceSlot: 0 }],
      ),
    ).toBe(true);
  });

  it('operationalOverlapKey is stable across allocation ids', () => {
    const start = amman(2026, 8, 16, 8, 0);
    const end = amman(2026, 8, 16, 8, 5);
    const a = operationalOverlapKey({
      type: 'WORKER_OVERLAP',
      overlapStart: start,
      overlapEnd: end,
      worker: { id: 'w1' },
      allocationA: { productionOrderId: 'po-b' },
      allocationB: { productionOrderId: 'po-a' },
    });
    const b = operationalOverlapKey({
      type: 'WORKER_OVERLAP',
      overlapStart: start.toISOString(),
      overlapEnd: end.toISOString(),
      worker: { id: 'w1' },
      allocationA: { productionOrderId: 'po-a' },
      allocationB: { productionOrderId: 'po-b' },
    });
    expect(a).toBe(b);
  });
});
