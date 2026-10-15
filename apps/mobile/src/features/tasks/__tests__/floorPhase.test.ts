import {
  bucketOpenTaskForToday,
  classifyFloorTaskPhase,
  classifyTodayQualityStamp,
  floorHintFromIncoming,
  todayQualityStampLabelKey,
} from '../floorPhase';
import { selectTodayFloorBuckets } from '@/features/worker-home/selectWorkerHome';
import type { WorkerHomeTaskWithFloor } from '@/features/worker-home/selectWorkerHome';

describe('floorPhase', () => {
  it('does not offer start while a predecessor is still waiting', () => {
    const hint = classifyFloorTaskPhase({
      taskStatus: 'NOT_STARTED',
      waitingPrevious: true,
    });
    expect(hint.phase).toBe('WAITING_PREVIOUS');
    expect(hint.primaryAction).toBe('NONE');
  });

  it('classifies receive before start when SEMI outstanding', () => {
    const hint = classifyFloorTaskPhase({
      taskStatus: 'READY',
      incomingRequired: true,
      allReceived: false,
      anyReadyToCollect: true,
    });
    expect(hint.phase).toBe('READY_TO_RECEIVE');
    expect(hint.primaryAction).toBe('RECEIVE_SEMI');
  });

  it('labels a paused task as paused and does not offer start', () => {
    const hint = classifyFloorTaskPhase({ taskStatus: 'PAUSED' });
    expect(hint.labelKey).toBe('mobile.tasks.phasePaused');
    expect(hint.primaryAction).toBe('COMPLETE');
  });

  it('prefers in-progress over receive gate', () => {
    const hint = floorHintFromIncoming({
      taskStatus: 'IN_PROGRESS',
      required: true,
      allReceived: false,
      lines: [{ statusKey: 'READY_TO_COLLECT' }],
    });
    expect(hint.phase).toBe('IN_PROGRESS');
    expect(hint.primaryAction).toBe('COMPLETE');
  });

  it('buckets Today open tasks', () => {
    const base = {
      id: '1',
      number: 'PT-1',
      name: 'Foam',
      priority: 'NORMAL',
      orderNumber: 'SO-1',
      productTitle: 'Chair',
      imageUrl: null,
      deadline: null,
      estimatedMinutes: 30,
    };
    const open: WorkerHomeTaskWithFloor[] = [
      { ...base, id: 'a', status: 'IN_PROGRESS' },
      { ...base, id: 'b', status: 'READY', needsReceive: true },
      { ...base, id: 'c', status: 'NOT_STARTED', waitingPrevious: true },
      { ...base, id: 'd', status: 'READY', phase: 'READY_TO_START' },
    ];
    const buckets = selectTodayFloorBuckets(open);
    expect(buckets.doNow.map((t) => t.id).sort()).toEqual(['a', 'd']);
    expect(buckets.readyAfterReceiving.map((t) => t.id)).toEqual(['b']);
    expect(buckets.waiting.map((t) => t.id)).toEqual(['c']);
  });

  it('uses heuristics when phase missing', () => {
    expect(
      bucketOpenTaskForToday({ status: 'IN_PROGRESS' }),
    ).toBe('DO_NOW');
    expect(
      bucketOpenTaskForToday({ status: 'READY', needsReceive: true }),
    ).toBe('READY_AFTER_RECEIVING');
    expect(
      bucketOpenTaskForToday({ status: 'BLOCKED', waitingPrevious: true }),
    ).toBe('WAITING');
    expect(bucketOpenTaskForToday({ status: 'NOT_STARTED' })).toBe('WAITING');
    expect(bucketOpenTaskForToday({ status: 'READY' })).toBe('DO_NOW');
  });

  it('stamps Inspection / Rework / Packaging for Today', () => {
    expect(
      classifyTodayQualityStamp({
        stageCode: 'INSPECTION',
        executionKind: 'QUALITY',
      }),
    ).toBe('INSPECTION');
    expect(
      classifyTodayQualityStamp({ stageCode: 'UPHOLSTERY', isRework: true }),
    ).toBe('REWORK');
    expect(classifyTodayQualityStamp({ stageCode: 'PACKAGING' })).toBe('PACKAGING');
    expect(todayQualityStampLabelKey('INSPECTION')).toBe(
      'mobile.quality.stampInspection',
    );
  });
});
