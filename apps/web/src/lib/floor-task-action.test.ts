import { describe, expect, it } from 'vitest';
import { classifyWorkerTaskAction } from './floor-task-action';

describe('classifyWorkerTaskAction', () => {
  it('keeps a waiting stage from starting', () => {
    expect(
      classifyWorkerTaskAction({ taskStatus: 'NOT_STARTED', waitingPrevious: true }),
    ).toEqual({ phase: 'WAITING_PREVIOUS', primaryAction: 'NONE' });
  });

  it('asks to receive before start when the kit is ready to collect', () => {
    expect(
      classifyWorkerTaskAction({
        taskStatus: 'READY',
        incomingRequired: true,
        allReceived: false,
        anyReadyToCollect: true,
      }),
    ).toEqual({ phase: 'READY_TO_RECEIVE', primaryAction: 'RECEIVE_SEMI' });
  });

  it('does not offer receive while the previous stage has not produced the kit', () => {
    expect(
      classifyWorkerTaskAction({
        taskStatus: 'READY',
        incomingRequired: true,
        allReceived: false,
        anyWaitingProduction: true,
      }).primaryAction,
    ).toBe('NONE');
  });
});
