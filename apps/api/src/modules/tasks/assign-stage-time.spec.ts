import {
  resolveAssignStageMinutes,
  shouldWriteBackStageTime,
} from './assign-stage-time';

describe('resolveAssignStageMinutes', () => {
  it('prefers dto, then task, then snapshot', () => {
    expect(
      resolveAssignStageMinutes({
        dtoMinutes: 30,
        taskMinutes: 60,
        snapshotMinutes: 90,
      }),
    ).toBe(30);
    expect(
      resolveAssignStageMinutes({
        dtoMinutes: 0,
        taskMinutes: 45,
        snapshotMinutes: 90,
      }),
    ).toBe(45);
    expect(
      resolveAssignStageMinutes({
        dtoMinutes: null,
        taskMinutes: null,
        snapshotMinutes: 20,
      }),
    ).toBe(20);
  });

  it('returns null when no stage time exists', () => {
    expect(
      resolveAssignStageMinutes({
        dtoMinutes: 0,
        taskMinutes: null,
        snapshotMinutes: undefined,
      }),
    ).toBeNull();
  });
});

describe('shouldWriteBackStageTime', () => {
  it('writes back when the assign duration differs and the stage has not started', () => {
    expect(
      shouldWriteBackStageTime({
        dtoMinutes: 30,
        snapshotMinutes: 90,
        stageStatus: 'PENDING',
      }),
    ).toBe(true);
  });

  it('does not write back when the value matches or the stage has started', () => {
    expect(
      shouldWriteBackStageTime({
        dtoMinutes: 90,
        snapshotMinutes: 90,
        stageStatus: 'PENDING',
      }),
    ).toBe(false);
    expect(
      shouldWriteBackStageTime({
        dtoMinutes: 30,
        snapshotMinutes: 90,
        stageStatus: 'IN_PROGRESS',
      }),
    ).toBe(false);
  });
});
