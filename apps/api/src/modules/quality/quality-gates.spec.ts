import { isQcPassResult, recommendReworkStage } from '../quality/quality-floor';

describe('Piece 9 quality gates (unit)', () => {
  it('PASS results unlock packaging conceptually', () => {
    expect(isQcPassResult('PASSED')).toBe(true);
    expect(isQcPassResult('FAILED_REWORK_REQUIRED')).toBe(false);
  });

  it('never recommends Inspection/Packaging as rework target', () => {
    const { eligible, recommended } = recommendReworkStage({
      category: 'UPHOLSTERY',
      stages: [
        {
          stageInstanceId: '1',
          stageCode: 'UPHOLSTERY',
          nameEn: 'Upholstery',
          executionKind: 'PRODUCTION',
        },
        {
          stageInstanceId: '2',
          stageCode: 'INSPECTION',
          nameEn: 'Inspection',
          executionKind: 'QUALITY',
        },
        {
          stageInstanceId: '3',
          stageCode: 'PACKAGING',
          nameEn: 'Packaging',
          executionKind: 'PRODUCTION',
        },
      ],
    });
    expect(eligible.every((e) => e.stageCode !== 'INSPECTION')).toBe(true);
    expect(eligible.every((e) => e.stageCode !== 'PACKAGING')).toBe(true);
    expect(recommended?.stageCode).toBe('UPHOLSTERY');
  });
});
