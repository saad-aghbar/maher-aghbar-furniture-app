import { rollupLaborCost, summarizeLaborEntries } from './labor-costing';
import type { LaborRateRow } from '../tasks/labor-rate';

const rates: LaborRateRow[] = [
  {
    userId: 'a',
    hourlyRate: 20,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
  },
  {
    userId: 'b',
    hourlyRate: 40,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
  },
];

describe('rollupLaborCost', () => {
  it('costs each worker at their own rate on a shared task', () => {
    const labor = rollupLaborCost({
      rates,
      tasks: [{ id: 't1', stageDefinitionId: 'uph', stageCode: 'UPHOLSTERY' }],
      entries: [
        { taskId: 't1', userId: 'a', minutes: 60 },
        { taskId: 't1', userId: 'b', minutes: 30 },
      ],
      now: new Date('2026-06-01T00:00:00.000Z'),
    });
    expect(labor?.actual).toBe(40);
    expect(labor?.byWorker).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'a', actual: 20 }),
        expect.objectContaining({ userId: 'b', actual: 20 }),
      ]),
    );
  });

  it('returns null labor, not 0, when no rate model exists', () => {
    expect(
      rollupLaborCost({
        rates: [],
        tasks: [{ id: 't1', stageDefinitionId: 'uph' }],
        entries: [{ taskId: 't1', userId: 'a', minutes: 60 }],
      }),
    ).toBeNull();
  });

  it('keeps actual null when minutes exist but no matching rate', () => {
    const labor = rollupLaborCost({
      rates: [
        {
          userId: 'other',
          hourlyRate: 20,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveTo: null,
        },
      ],
      tasks: [{ id: 't1', stageDefinitionId: 'uph' }],
      entries: [{ taskId: 't1', userId: 'a', minutes: 60 }],
      now: new Date('2026-06-01T00:00:00.000Z'),
    });
    expect(labor).not.toBeNull();
    expect(labor?.actual).toBeNull();
    expect(labor?.byWorker).toEqual([
      expect.objectContaining({ userId: 'a', minutes: 60, actual: null }),
    ]);
    expect(labor?.byStage[0]?.minutes).toBe(60);
  });

  it('does not price old hours with today rate when no historical row applies', () => {
    const summary = summarizeLaborEntries({
      rates: [
        {
          userId: 'a',
          hourlyRate: 99,
          effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
          effectiveTo: null,
        },
      ],
      tasks: [{ id: 't1', stageDefinitionId: 'uph' }],
      entries: [
        {
          id: 'e1',
          taskId: 't1',
          userId: 'a',
          minutes: 60,
          endedAt: new Date('2026-01-15T00:00:00.000Z'),
        },
      ],
      now: new Date('2026-09-14T00:00:00.000Z'),
    });
    expect(summary.timedMinutes).toBe(60);
    expect(summary.unpricedMinutes).toBe(60);
    expect(summary.actual).toBeNull();
  });

  it('dedupes time entries and never adds task.actualMinutes', () => {
    const summary = summarizeLaborEntries({
      rates: [
        {
          userId: 'a',
          hourlyRate: 20,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveTo: null,
        },
      ],
      tasks: [{ id: 't1', stageDefinitionId: 'uph', isRework: false }],
      entries: [
        { id: 'e1', taskId: 't1', userId: 'a', minutes: 60 },
        { id: 'e1', taskId: 't1', userId: 'a', minutes: 60 },
      ],
    });
    expect(summary.timedMinutes).toBe(60);
    expect(summary.actual).toBe(20);
  });

  it('estimates from variant stage minutes × a stage-or-global rate', () => {
    const labor = rollupLaborCost({
      rates: [
        {
          stageDefinitionId: 'uph',
          hourlyRate: 30,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveTo: null,
        },
      ],
      tasks: [],
      entries: [],
      estimates: [
        {
          stageDefinitionId: 'uph',
          stageCode: 'UPHOLSTERY',
          quantityScalingMode: 'SETUP_PLUS_LINEAR',
          quantity: 1,
          setupMinutes: 0,
          minutesPerUnit: 60,
        },
      ],
      now: new Date('2026-06-01T00:00:00.000Z'),
    });
    expect(labor?.estimated).toBe(30);
    expect(labor?.actual).toBeNull();
  });
});
