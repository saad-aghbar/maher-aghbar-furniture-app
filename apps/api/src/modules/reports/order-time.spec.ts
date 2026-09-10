import { aggregateFactoryTime, minutesBetween } from './order-time';

describe('order-time', () => {
  it('keeps worker effort and wall clock as separate figures', () => {
    const start = new Date('2026-01-01T08:00:00Z');
    const end = new Date('2026-01-01T12:00:00Z');
    const result = aggregateFactoryTime(
      [
        { actualMinutes: 90, isRework: false, stageCode: 'CARPENTRY' },
        { actualMinutes: 90, isRework: false, stageCode: 'UPHOLSTERY' },
        { actualMinutes: 30, isRework: true, stageCode: 'UPHOLSTERY' },
      ],
      { start, end },
    );
    expect(result.workerEffortMinutes).toBe(210);
    expect(result.reworkEffortMinutes).toBe(30);
    expect(result.firstPassEffortMinutes).toBe(180);
    expect(result.wallClockMinutes).toBe(240);
    expect(result.workerEffortMinutes + result.wallClockMinutes).not.toBe(result.workerEffortMinutes);
    expect(result.byStage.find((s) => s.stageCode === 'UPHOLSTERY')).toEqual({
      stageCode: 'UPHOLSTERY',
      workerEffortMinutes: 120,
      reworkEffortMinutes: 30,
    });
  });

  it('returns null wall clock when either bound is missing', () => {
    expect(minutesBetween(new Date(), null)).toBeNull();
    expect(minutesBetween(null, new Date())).toBeNull();
  });
});
