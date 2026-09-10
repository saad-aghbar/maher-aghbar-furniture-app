import type { WorkerOrderLaneNode } from '../api';
import {
  findLaneNodeByGraphKey,
  selectNextStationHint,
  workerLaneToFlowStages,
  workerStageAccess,
} from '../selectWorkerLane';
import { isLaneTaskOpenable } from '../selectWorkerOrder';

function node(
  partial: Partial<WorkerOrderLaneNode> & Pick<WorkerOrderLaneNode, 'id' | 'stageCode' | 'stageName'>,
): WorkerOrderLaneNode {
  return {
    kind: 'context',
    taskId: null,
    assignedToMe: false,
    nameEn: partial.stageName,
    nameAr: null,
    nameHe: null,
    status: 'PENDING',
    sortOrder: 0,
    dependsOnIds: [],
    dependsOnCodes: [],
    dependsOnNames: [],
    lockState: { kind: 'open' },
    plannedStart: null,
    plannedCompletion: null,
    ...partial,
  };
}

describe('workerLaneToFlowStages', () => {
  it('maps parallel predecessors to dependsOnCodes the flow map can draw', () => {
    const lane = [
      node({ id: 'n-carp', stageCode: 'CARPENTRY', stageName: 'Carpentry', status: 'COMPLETED', lockState: { kind: 'done' } }),
      node({ id: 'n-paint', stageCode: 'PAINTING', stageName: 'Painting', status: 'PENDING' }),
      node({
        id: 'n-asm',
        kind: 'task',
        assignedToMe: true,
        taskId: 't-asm',
        stageCode: 'ASSEMBLY',
        stageName: 'Assembly',
        dependsOnIds: ['n-carp', 'n-paint'],
        dependsOnCodes: ['CARPENTRY', 'PAINTING'],
        dependsOnNames: ['Carpentry', 'Painting'],
        lockState: {
          kind: 'locked',
          reason: 'PREDECESSOR_NOT_COMPLETE',
          waitingOnStageName: 'Carpentry · Painting',
        },
      }),
    ];
    const stages = workerLaneToFlowStages(lane, 'en');
    expect(stages[2]!.graphKey).toBe('n-asm');
    expect(stages[2]!.dependsOnCodes).toEqual(['n-carp', 'n-paint']);
    expect(stages[2]!.status).toBe('PENDING');
    expect(stages[2]!.workerAccess).toBe('assigned');
    expect(stages[0]!.workerAccess).toBe('done');
    expect(stages[1]!.workerAccess).toBe('foreign');
    expect(isLaneTaskOpenable(lane[2]!)).toBe(false);
    expect(selectNextStationHint(lane)?.id).toBe('n-asm');
    expect(findLaneNodeByGraphKey(lane, stages[2]!.graphKey)?.taskId).toBe('t-asm');
  });

  it('does not treat a foreign station as openable work', () => {
    const foreign = node({
      id: 'n-paint',
      stageCode: 'PAINTING',
      stageName: 'Painting',
      lockState: { kind: 'open' },
    });
    expect(isLaneTaskOpenable(foreign)).toBe(false);
    expect(workerStageAccess(foreign)).toBe('foreign');
  });

  it('marks assigned open and in-progress work as available, not foreign', () => {
    const open = node({
      id: 'n-carp',
      kind: 'task',
      assignedToMe: true,
      taskId: 't-carp',
      stageCode: 'CARPENTRY',
      stageName: 'Carpentry',
      status: 'IN_PROGRESS',
      lockState: { kind: 'open' },
    });
    const later = node({
      id: 'n-asm',
      kind: 'task',
      assignedToMe: true,
      taskId: 't-asm',
      stageCode: 'ASSEMBLY',
      stageName: 'Assembly',
      lockState: {
        kind: 'locked',
        reason: 'PREDECESSOR_NOT_COMPLETE',
        waitingOnStageName: 'Carpentry',
      },
    });
    const [ready, waiting] = workerLaneToFlowStages([open, later], 'en');
    expect(ready!.workerAccess).toBe('available');
    expect(ready!.status).toBe('IN_PROGRESS');
    expect(waiting!.workerAccess).toBe('assigned');
    expect(waiting!.status).toBe('PENDING');
    expect(waiting!.blockers).toEqual([]);
  });

  it('uses timer percent instead of a fake 28 for started work', () => {
    const open = node({
      id: 'n-carp',
      kind: 'task',
      assignedToMe: true,
      taskId: 't-carp',
      stageCode: 'CARPENTRY',
      stageName: 'Carpentry',
      status: 'IN_PROGRESS',
      estimatedMinutes: 120,
      elapsedMinutes: 60,
      actualSeconds: 60 * 60,
      openStartedAt: null,
      lockState: { kind: 'open' },
    });
    const [ready] = workerLaneToFlowStages([open], 'en');
    expect(ready!.progressPercent).toBe(50);
    expect(ready!.progressPercent).not.toBe(28);
  });

  it('climbs map percent when the live clock ticks', () => {
    const open = node({
      id: 'n-carp',
      kind: 'task',
      assignedToMe: true,
      taskId: 't-carp',
      stageCode: 'CARPENTRY',
      stageName: 'Carpentry',
      status: 'IN_PROGRESS',
      estimatedMinutes: 120,
      elapsedMinutes: 0,
      actualSeconds: 0,
      openStartedAt: '2026-08-09T11:00:00.000Z',
      lockState: { kind: 'open' },
    });
    const [atHour] = workerLaneToFlowStages([open], 'en', new Date('2026-08-09T12:00:00.000Z'));
    const [later] = workerLaneToFlowStages([open], 'en', new Date('2026-08-09T12:12:00.000Z'));
    expect(atHour!.progressPercent).toBe(50);
    expect(later!.progressPercent).toBe(60);
  });
});
