import { isPrereqLockedForWorker } from '../production/worker-task-visibility';
import {
  buildWorkerOrderLane,
  classifyWorkerTaskLock,
  joinWaitOnNames,
  orderMatchesSegment,
  remainingTasksForSegment,
  summarizeAssignedOrderTasks,
  summarizeLane,
  taskDueToday,
  taskVisibleOnProductionDay,
  workerOrderMatchesSearch,
  type SnapshotLaneInput,
} from './worker-order-workflow';

function baseNode(partial: Partial<SnapshotLaneInput> & Pick<SnapshotLaneInput, 'id' | 'sortOrder' | 'stageCode' | 'stageName'>): SnapshotLaneInput {
  return {
    nameEn: partial.stageName,
    nameAr: null,
    nameHe: null,
    stageStatus: 'PENDING',
    assignedToWorker: false,
    task: null,
    predecessorIds: [],
    predecessorCodes: [],
    predecessorNames: [],
    unfinishedPredecessorNames: [],
    predecessorComplete: true,
    needsReceive: false,
    receiveFromStageName: null,
    ...partial,
  };
}

describe('classifyWorkerTaskLock', () => {
  it('locks NOT_STARTED tasks whose stage is still pending', () => {
    expect(
      classifyWorkerTaskLock({
        taskStatus: 'NOT_STARTED',
        stageInstanceStatus: 'PENDING',
        waitingOnStageName: 'Painting',
        needsReceive: false,
        receiveFromStageName: null,
      }),
    ).toEqual({
      kind: 'locked',
      reason: 'PREDECESSOR_NOT_COMPLETE',
      waitingOnStageName: 'Painting',
    });
  });

  it('marks receive-needed after the stage is unlocked', () => {
    expect(
      classifyWorkerTaskLock({
        taskStatus: 'READY',
        stageInstanceStatus: 'READY',
        waitingOnStageName: 'Carpentry',
        needsReceive: true,
        receiveFromStageName: 'Carpentry',
      }),
    ).toEqual({ kind: 'needs_receive', fromStageName: 'Carpentry' });
  });

  it('marks completed work as done, not open', () => {
    expect(
      classifyWorkerTaskLock({
        taskStatus: 'COMPLETED',
        stageInstanceStatus: 'COMPLETED',
        waitingOnStageName: null,
        needsReceive: false,
        receiveFromStageName: null,
      }),
    ).toEqual({ kind: 'done' });
  });

  it('is open when unlocked and kit received', () => {
    expect(
      classifyWorkerTaskLock({
        taskStatus: 'READY',
        stageInstanceStatus: 'READY',
        waitingOnStageName: null,
        needsReceive: false,
        receiveFromStageName: null,
      }),
    ).toEqual({ kind: 'open' });
  });
});

describe('buildWorkerOrderLane', () => {
  const snapshot: SnapshotLaneInput[] = [
    baseNode({
      id: 'n-prep',
      sortOrder: 1,
      stageCode: 'MATERIAL_PREP',
      stageName: 'Prep',
      stageStatus: 'COMPLETED',
    }),
    baseNode({
      id: 'n-carp',
      sortOrder: 2,
      stageCode: 'CARPENTRY',
      stageName: 'Carpentry',
      stageStatus: 'READY',
      assignedToWorker: true,
      task: {
        id: 't-carp',
        status: 'READY',
        plannedStart: null,
        plannedCompletion: null,
        stageInstanceStatus: 'READY',
      },
      predecessorIds: ['n-prep'],
      predecessorCodes: ['MATERIAL_PREP'],
      predecessorNames: ['Prep'],
    }),
    baseNode({
      id: 'n-paint',
      sortOrder: 3,
      stageCode: 'PAINTING',
      stageName: 'Painting',
      stageStatus: 'PENDING',
      predecessorIds: ['n-carp'],
      predecessorCodes: ['CARPENTRY'],
      predecessorNames: ['Carpentry'],
      unfinishedPredecessorNames: ['Carpentry'],
      predecessorComplete: false,
    }),
    baseNode({
      id: 'n-asm',
      sortOrder: 4,
      stageCode: 'ASSEMBLY',
      stageName: 'Assembly',
      stageStatus: 'PENDING',
      assignedToWorker: true,
      task: {
        id: 't-asm',
        status: 'NOT_STARTED',
        plannedStart: null,
        plannedCompletion: null,
        stageInstanceStatus: 'PENDING',
      },
      predecessorIds: ['n-paint'],
      predecessorCodes: ['PAINTING'],
      predecessorNames: ['Painting'],
      unfinishedPredecessorNames: ['Painting'],
      predecessorComplete: false,
    }),
  ];

  it('returns the full frozen DAG, not a slice between assigned tasks', () => {
    const lane = buildWorkerOrderLane(snapshot);
    expect(lane.map((n) => n.stageCode)).toEqual([
      'MATERIAL_PREP',
      'CARPENTRY',
      'PAINTING',
      'ASSEMBLY',
    ]);
    expect(lane.map((n) => n.kind)).toEqual(['context', 'task', 'context', 'task']);
    expect(lane[0]).toMatchObject({ kind: 'context', lockState: { kind: 'done' } });
    expect(lane[3]).toMatchObject({
      kind: 'task',
      lockState: { kind: 'locked', reason: 'PREDECESSOR_NOT_COMPLETE', waitingOnStageName: 'Painting' },
    });
    expect(summarizeLane(lane)).toEqual({
      myTaskCount: 2,
      actionableCount: 1,
      blockedCount: 1,
    });
  });

  it('passes timer elapsed and estimate without a progressPercent field', () => {
    const lane = buildWorkerOrderLane([
      baseNode({
        id: 'n-carp',
        sortOrder: 1,
        stageCode: 'CARPENTRY',
        stageName: 'Carpentry',
        assignedToWorker: true,
        task: {
          id: 't-carp',
          status: 'IN_PROGRESS',
          plannedStart: null,
          plannedCompletion: null,
          stageInstanceStatus: 'IN_PROGRESS',
          estimatedMinutes: 120,
          actualMinutes: 60,
          timeEntries: [
            {
              startedAt: new Date('2026-08-09T10:00:00.000Z'),
              endedAt: new Date('2026-08-09T11:00:00.000Z'),
            },
          ],
        },
      }),
    ]);
    expect(lane[0]).toMatchObject({
      estimatedMinutes: 120,
      elapsedMinutes: 60,
      actualSeconds: 3600,
      openStartedAt: null,
    });
    expect(JSON.stringify(lane)).not.toContain('progressPercent');
  });

  it('lists every unfinished predecessor on a parallel join', () => {
    const lane = buildWorkerOrderLane([
      baseNode({
        id: 'n-carp',
        sortOrder: 1,
        stageCode: 'CARPENTRY',
        stageName: 'Carpentry',
        stageStatus: 'IN_PROGRESS',
      }),
      baseNode({
        id: 'n-paint',
        sortOrder: 2,
        stageCode: 'PAINTING',
        stageName: 'Painting',
        stageStatus: 'PENDING',
      }),
      baseNode({
        id: 'n-asm',
        sortOrder: 3,
        stageCode: 'ASSEMBLY',
        stageName: 'Assembly',
        assignedToWorker: true,
        task: {
          id: 't-asm',
          status: 'NOT_STARTED',
          plannedStart: null,
          plannedCompletion: null,
          stageInstanceStatus: 'PENDING',
        },
        predecessorIds: ['n-carp', 'n-paint'],
        predecessorCodes: ['CARPENTRY', 'PAINTING'],
        predecessorNames: ['Carpentry', 'Painting'],
        unfinishedPredecessorNames: ['Carpentry', 'Painting'],
        predecessorComplete: false,
      }),
    ]);
    expect(lane[2]!.dependsOnIds).toEqual(['n-carp', 'n-paint']);
    expect(lane[2]!.dependsOnCodes).toEqual(['CARPENTRY', 'PAINTING']);
    expect(lane[2]!.lockState).toEqual({
      kind: 'locked',
      reason: 'PREDECESSOR_NOT_COMPLETE',
      waitingOnStageName: 'Carpentry · Painting',
    });
  });

  it('keeps GET /tasks/:id locked via the same prereq predicate', () => {
    const locked = {
      status: 'NOT_STARTED',
      stageInstance: { status: 'PENDING' },
    };
    expect(isPrereqLockedForWorker({ status: 'COMPLETED', stageInstance: { status: 'COMPLETED' } })).toBe(
      false,
    );
    expect(isPrereqLockedForWorker(locked)).toBe(true);
    expect(
      classifyWorkerTaskLock({
        taskStatus: locked.status,
        stageInstanceStatus: locked.stageInstance.status,
        waitingOnStageName: 'Painting',
        needsReceive: false,
        receiveFromStageName: null,
      }).kind,
    ).toBe('locked');
  });
});

describe('summarizeAssignedOrderTasks', () => {
  it('hides completed work from remaining counts', () => {
    expect(
      summarizeAssignedOrderTasks([
        { status: 'COMPLETED', stageInstance: { status: 'COMPLETED' } },
        { status: 'READY', stageInstance: { status: 'READY' } },
        { status: 'NOT_STARTED', stageInstance: { status: 'PENDING' } },
      ]),
    ).toEqual({
      myTaskCount: 2,
      actionableCount: 1,
      blockedCount: 1,
    });
  });

  it('treats an all-completed assignment as empty remaining work', () => {
    expect(
      summarizeAssignedOrderTasks([
        { status: 'COMPLETED', stageInstance: { status: 'COMPLETED' } },
        { status: 'CANCELLED', stageInstance: { status: 'CANCELLED' } },
      ]),
    ).toEqual({
      myTaskCount: 0,
      actionableCount: 0,
      blockedCount: 0,
    });
  });
});

describe('listMyOrders segments', () => {
  const tz = 'Asia/Amman';
  const now = new Date('2026-09-08T12:00:00.000Z');
  const tasks = [
    {
      status: 'COMPLETED',
      plannedStart: new Date('2026-09-08T08:00:00.000Z'),
      plannedCompletion: new Date('2026-09-08T10:00:00.000Z'),
      stageInstance: { status: 'COMPLETED' },
    },
    {
      status: 'READY',
      plannedStart: new Date('2026-09-08T11:00:00.000Z'),
      plannedCompletion: new Date('2026-09-08T16:00:00.000Z'),
      stageInstance: { status: 'READY' },
    },
    {
      status: 'IN_PROGRESS',
      plannedStart: new Date('2026-09-07T11:00:00.000Z'),
      plannedCompletion: new Date('2026-09-07T16:00:00.000Z'),
      stageInstance: { status: 'IN_PROGRESS' },
    },
  ];

  it('open includes remaining work and hides completed-only orders', () => {
    expect(orderMatchesSegment('open', tasks, null, now, tz)).toBe(true);
    expect(orderMatchesSegment('open', [tasks[0]!], null, now, tz)).toBe(false);
    expect(
      summarizeAssignedOrderTasks(remainingTasksForSegment('open', tasks, null, now, tz)),
    ).toEqual({
      myTaskCount: 2,
      actionableCount: 2,
      blockedCount: 0,
    });
  });

  it('hides remaining work whose plannedStart is after factory today', () => {
    const future = {
      status: 'READY',
      plannedStart: new Date('2026-09-14T08:00:00.000Z'),
      plannedCompletion: new Date('2026-09-14T16:00:00.000Z'),
      stageInstance: { status: 'READY' },
    };
    expect(orderMatchesSegment('open', [future], null, now, tz)).toBe(false);
    expect(taskVisibleOnProductionDay(future, now, tz)).toBe(false);
  });

  it('keeps past unfinished work in Open when plannedStart is before today', () => {
    const overdue = {
      status: 'READY',
      plannedStart: new Date('2026-09-01T08:00:00.000Z'),
      plannedCompletion: new Date('2026-09-01T16:00:00.000Z'),
      stageInstance: { status: 'READY' },
    };
    expect(taskVisibleOnProductionDay(overdue, now, tz)).toBe(true);
    expect(orderMatchesSegment('open', [overdue], null, now, tz)).toBe(true);
  });

  it('keeps unscheduled remaining work visible', () => {
    const undated = {
      status: 'NOT_STARTED',
      plannedStart: null,
      plannedCompletion: null,
      stageInstance: { status: 'PENDING' },
    };
    expect(taskVisibleOnProductionDay(undated, now, tz)).toBe(true);
    expect(orderMatchesSegment('open', [undated], null, now, tz)).toBe(true);
  });

  it('today is delivery due / overdue, not plannedStart alone', () => {
    expect(orderMatchesSegment('today', tasks, null, now, tz)).toBe(true);
    expect(
      remainingTasksForSegment('today', tasks, null, now, tz).map((t) => t.status),
    ).toEqual(['READY', 'IN_PROGRESS']);
    const startTodayOnly = {
      status: 'READY',
      plannedStart: new Date('2026-09-08T11:00:00.000Z'),
      plannedCompletion: new Date('2026-09-12T16:00:00.000Z'),
      stageInstance: { status: 'READY' },
    };
    expect(taskDueToday(startTodayOnly, null, now, tz)).toBe(false);
    expect(orderMatchesSegment('today', [startTodayOnly], null, now, tz)).toBe(false);
    expect(
      orderMatchesSegment(
        'today',
        [startTodayOnly],
        new Date('2026-09-08T15:00:00.000Z'),
        now,
        tz,
      ),
    ).toBe(true);
  });

  it('active keeps in-progress remaining work and excludes paused', () => {
    expect(orderMatchesSegment('active', tasks, null, now, tz)).toBe(true);
    expect(
      remainingTasksForSegment('active', tasks, null, now, tz).map((t) => t.status),
    ).toEqual(['IN_PROGRESS']);
    expect(orderMatchesSegment('active', [tasks[1]!], null, now, tz)).toBe(false);
    const paused = {
      status: 'PAUSED',
      plannedStart: new Date('2026-09-08T08:00:00.000Z'),
      plannedCompletion: new Date('2026-09-08T16:00:00.000Z'),
      stageInstance: { status: 'IN_PROGRESS' },
    };
    expect(orderMatchesSegment('active', [paused], null, now, tz)).toBe(false);
    expect(orderMatchesSegment('open', [paused], null, now, tz)).toBe(true);
  });
});

describe('joinWaitOnNames', () => {
  it('joins unfinished predecessors for wait-on copy', () => {
    expect(joinWaitOnNames(['Carpentry', 'Painting'])).toBe('Carpentry · Painting');
    expect(joinWaitOnNames([])).toBe('previous stage');
  });
});

describe('summarizeLane', () => {
  it('does not count done rows as actionable', () => {
    expect(
      summarizeLane([
        {
          id: 'n1',
          kind: 'task',
          taskId: 't1',
          assignedToMe: true,
          stageCode: 'CARPENTRY',
          stageName: 'Carpentry',
          nameEn: 'Carpentry',
          nameAr: null,
          nameHe: null,
          status: 'COMPLETED',
          sortOrder: 1,
          dependsOnIds: [],
          dependsOnCodes: [],
          dependsOnNames: [],
          plannedStart: null,
          plannedCompletion: null,
          lockState: { kind: 'done' },
        },
        {
          id: 'n2',
          kind: 'task',
          taskId: 't2',
          assignedToMe: true,
          stageCode: 'ASSEMBLY',
          stageName: 'Assembly',
          nameEn: 'Assembly',
          nameAr: null,
          nameHe: null,
          status: 'NOT_STARTED',
          sortOrder: 2,
          dependsOnIds: ['n1'],
          dependsOnCodes: ['CARPENTRY'],
          dependsOnNames: ['Carpentry'],
          plannedStart: null,
          plannedCompletion: null,
          lockState: {
            kind: 'locked',
            reason: 'PREDECESSOR_NOT_COMPLETE',
            waitingOnStageName: 'Painting',
          },
        },
      ]),
    ).toEqual({
      myTaskCount: 2,
      actionableCount: 0,
      blockedCount: 1,
    });
  });
});

describe('workerOrderMatchesSearch', () => {
  const order = {
    number: 'PO-1',
    productDescription: 'Dining table',
    product: { nameEn: 'Dining table', nameAr: 'طاولة', nameHe: null },
    salesOrder: {
      number: 'ORD-9',
      externalOrderNumber: 'EXT-441',
      customer: { code: 'D-12', nameEn: 'Al Noor', nameAr: 'النور', nameHe: null, name: 'Al Noor' },
    },
    tasks: [{ stageDefinition: { code: 'CARPENTRY', nameEn: 'Carpentry', nameAr: 'نجارة', nameHe: null } }],
  };

  it('matches factory, sales, and external order numbers', () => {
    expect(workerOrderMatchesSearch(order, 'ORD-9')).toBe(true);
    expect(workerOrderMatchesSearch(order, 'ord9')).toBe(true);
    expect(workerOrderMatchesSearch(order, 'PO-1')).toBe(true);
    expect(workerOrderMatchesSearch(order, 'EXT-441')).toBe(true);
  });

  it('rejects unrelated needles', () => {
    expect(workerOrderMatchesSearch(order, 'wardrobe')).toBe(false);
  });
});
