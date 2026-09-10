import {
  coerceQualityGateEstimate,
  isQualityGateStage,
} from '../milestone';

describe('quality gate duration', () => {
  it('treats INSPECTION / QC / QUALITY as zero-minute gates', () => {
    expect(isQualityGateStage({ code: 'INSPECTION' })).toBe(true);
    expect(isQualityGateStage({ code: 'QC' })).toBe(true);
    expect(isQualityGateStage({ executionKind: 'QUALITY' })).toBe(true);
    expect(isQualityGateStage({ code: 'PACKAGING' })).toBe(false);
    expect(isQualityGateStage({ code: 'DELIVERY' })).toBe(false);
  });

  it('coerces inspection estimates to FIXED 0', () => {
    expect(
      coerceQualityGateEstimate({
        code: 'INSPECTION',
        setupMinutes: 10,
        minutesPerUnit: 5,
        fixedMinutes: 35,
        quantityScalingMode: 'SETUP_PLUS_LINEAR',
        batchSize: 2,
      }),
    ).toEqual({
      setupMinutes: 0,
      minutesPerUnit: 0,
      fixedMinutes: 0,
      quantityScalingMode: 'FIXED',
      batchSize: null,
      batchMinutes: null,
      maxParallelUnits: null,
    });
  });

  it('leaves producing-stage estimates unchanged', () => {
    expect(
      coerceQualityGateEstimate({
        code: 'UPHOLSTERY',
        setupMinutes: 10,
        minutesPerUnit: 20,
        fixedMinutes: 0,
        quantityScalingMode: 'SETUP_PLUS_LINEAR',
      }),
    ).toMatchObject({
      setupMinutes: 10,
      minutesPerUnit: 20,
      fixedMinutes: 0,
      quantityScalingMode: 'SETUP_PLUS_LINEAR',
    });
  });
});
