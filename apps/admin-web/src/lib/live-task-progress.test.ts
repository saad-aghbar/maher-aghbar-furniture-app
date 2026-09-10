import { describe, expect, it } from 'vitest';
import {
  liveTaskProgressPercent,
  withLiveProductionOrder,
  withLiveWorkflowGraph,
} from './live-task-progress';

describe('liveTaskProgressPercent', () => {
  it('follows elapsed / estimate and caps at 100', () => {
    expect(liveTaskProgressPercent({ status: 'READY', elapsedMinutes: 0, estimatedMinutes: 120 })).toBe(0);
    expect(
      liveTaskProgressPercent({ status: 'IN_PROGRESS', elapsedMinutes: 60, estimatedMinutes: 120 }),
    ).toBe(50);
    expect(
      liveTaskProgressPercent({ status: 'IN_PROGRESS', elapsedMinutes: 180, estimatedMinutes: 120 }),
    ).toBe(100);
    expect(
      liveTaskProgressPercent({ status: 'COMPLETED', elapsedMinutes: 10, estimatedMinutes: 120 }),
    ).toBe(100);
  });
});

describe('withLiveProductionOrder', () => {
  it('ticks running percent from the open timer', () => {
    const order = {
      progressPercent: 0,
      tasks: [
        {
          status: 'IN_PROGRESS',
          progressPercent: 0,
          estimatedMinutes: 120,
          timing: {
            status: 'running',
            actualMinutes: 0,
            actualSeconds: 0,
            openStartedAt: '2026-08-09T11:00:00.000Z',
            estimatedMinutes: 120,
            elapsedMinutes: 0,
          },
        },
      ],
    };
    const atHour = withLiveProductionOrder(order, new Date('2026-08-09T12:00:00.000Z'));
    const later = withLiveProductionOrder(order, new Date('2026-08-09T12:12:00.000Z'));
    expect(atHour.tasks?.[0]?.progressPercent).toBe(50);
    expect(later.tasks?.[0]?.progressPercent).toBe(60);
  });
});

describe('withLiveWorkflowGraph', () => {
  it('ticks graph node percent while a stage timer is running', () => {
    const graph = {
      progressPercent: 0,
      stages: [
        {
          status: 'IN_PROGRESS',
          progressPercent: 0,
          estimatedMinutes: 120,
          running: true,
          openStartedAt: '2026-08-09T11:00:00.000Z',
          elapsedMinutes: 0,
          actualSeconds: 0,
        },
      ],
    };
    const atHour = withLiveWorkflowGraph(graph, new Date('2026-08-09T12:00:00.000Z'));
    expect(atHour.stages[0]?.progressPercent).toBe(50);
    expect(atHour.progressPercent).toBe(50);
  });
});
