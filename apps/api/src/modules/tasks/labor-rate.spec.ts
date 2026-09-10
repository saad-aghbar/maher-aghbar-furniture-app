import { laborMoneyFromMinutes, resolveHourlyRate } from './labor-rate';

const day = (iso: string) => new Date(iso);

describe('labor-rate', () => {
  const rates = [
    {
      stageDefinitionId: 'uph',
      userId: null,
      hourlyRate: 12,
      effectiveFrom: day('2026-01-01'),
      effectiveTo: null,
    },
    {
      stageDefinitionId: 'uph',
      userId: 'w1',
      hourlyRate: 18,
      effectiveFrom: day('2026-02-01'),
      effectiveTo: null,
    },
    {
      stageDefinitionId: null,
      userId: 'w1',
      hourlyRate: 15,
      effectiveFrom: day('2026-01-01'),
      effectiveTo: null,
    },
  ];

  it('prefers worker+stage over worker over stage', () => {
    expect(
      resolveHourlyRate(rates, day('2026-03-01'), { stageDefinitionId: 'uph', userId: 'w1' }),
    ).toBe(18);
    expect(
      resolveHourlyRate(rates, day('2026-01-15'), { stageDefinitionId: 'uph', userId: 'w1' }),
    ).toBe(15);
    expect(
      resolveHourlyRate(rates, day('2026-03-01'), { stageDefinitionId: 'uph', userId: 'other' }),
    ).toBe(12);
  });

  it('returns null when no rate model exists', () => {
    expect(resolveHourlyRate([], day('2026-03-01'), { stageDefinitionId: 'uph' })).toBeNull();
    expect(laborMoneyFromMinutes(90, null)).toBeNull();
    expect(laborMoneyFromMinutes(90, 10)).toBe(15);
  });
});
