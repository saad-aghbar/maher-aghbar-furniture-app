import {
  classifyTaskQualityKind,
  countPriorFails,
  isLastStageQualityFloor,
  isQcFailResult,
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

describe('classifyTaskQualityKind', () => {
  it('marks rework first', () => {
    expect(
      classifyTaskQualityKind({ stageCode: 'INSPECTION', isRework: true }),
    ).toBe('rework');
  });

  it('marks reinspection when prior fails exist', () => {
    expect(
      classifyTaskQualityKind({
        executionKind: 'QUALITY',
        priorFailCount: 1,
      }),
    ).toBe('reinspection');
  });

  it('falls back to production for middle stages', () => {
    expect(classifyTaskQualityKind({ stageCode: 'CARPENTRY' })).toBe('production');
  });
});

describe('countPriorFails', () => {
  it('counts failed and blocked inspections', () => {
    expect(isQcFailResult('FAILED_REWORK_REQUIRED')).toBe(true);
    expect(isQcFailResult('PASSED')).toBe(false);
    expect(
      countPriorFails([
        { result: 'PASSED' },
        { result: 'FAILED_REWORK_REQUIRED' },
        { result: 'BLOCKED' },
      ]),
    ).toBe(2);
  });
});
