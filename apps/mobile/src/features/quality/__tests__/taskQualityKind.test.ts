import {
  isLastStageQualityFloor,
  resolveTaskQualityKind,
} from '../taskQualityKind';

describe('resolveTaskQualityKind', () => {
  it('treats QUALITY execution and INSPECTION stage as inspection', () => {
    expect(resolveTaskQualityKind({ executionKind: 'QUALITY' })).toBe('inspection');
    expect(resolveTaskQualityKind({ stageCode: 'INSPECTION' })).toBe('inspection');
    expect(
      resolveTaskQualityKind({ stageDefinition: { code: 'inspection' } }),
    ).toBe('inspection');
  });

  it('marks reinspection when the reinspection flag is set', () => {
    expect(
      resolveTaskQualityKind({ executionKind: 'QUALITY', isReinspection: true }),
    ).toBe('reinspection');
  });

  it('treats PACKAGING / PACK as packaging', () => {
    expect(resolveTaskQualityKind({ executionKind: 'PACKAGING' })).toBe('packaging');
    expect(resolveTaskQualityKind({ stageCode: 'PACKAGING' })).toBe('packaging');
    expect(resolveTaskQualityKind({ stageCode: 'PACK' })).toBe('packaging');
  });

  it('leaves middle-stage production unset', () => {
    expect(resolveTaskQualityKind({ stageCode: 'CARPENTRY' })).toBeNull();
    expect(resolveTaskQualityKind({ stageCode: 'FOAM' })).toBeNull();
    expect(resolveTaskQualityKind({})).toBeNull();
  });
});

describe('isLastStageQualityFloor', () => {
  it('is true only for inspection, reinspection, and packaging', () => {
    expect(isLastStageQualityFloor('inspection')).toBe(true);
    expect(isLastStageQualityFloor('reinspection')).toBe(true);
    expect(isLastStageQualityFloor('packaging')).toBe(true);
    expect(isLastStageQualityFloor(null)).toBe(false);
  });
});
