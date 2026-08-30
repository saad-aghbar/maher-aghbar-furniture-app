import {
  DEFECT_CATEGORY_STAGE_HINT,
  isInspectionStageCode,
  isPackagingStageCode,
  isQcPassResult,
  isQualityExecutionKind,
  recommendReworkStage,
  type EligibleReworkStage,
} from './quality-floor';

describe('quality-floor', () => {
  it('classifies QUALITY execution and inspection/packaging codes', () => {
    expect(isQualityExecutionKind('QUALITY')).toBe(true);
    expect(isQualityExecutionKind('PRODUCTION')).toBe(false);
    expect(isInspectionStageCode('INSPECTION')).toBe(true);
    expect(isPackagingStageCode('PACKAGING')).toBe(true);
    expect(isQcPassResult('PASSED')).toBe(true);
    expect(isQcPassResult('FAILED_REWORK_REQUIRED')).toBe(false);
  });

  it('recommends Upholstery for stitching/fabric categories', () => {
    const stages: EligibleReworkStage[] = [
      { stageInstanceId: 'c', stageCode: 'CARPENTRY', nameEn: 'Carpentry', executionKind: 'PRODUCTION' },
      { stageInstanceId: 'a', stageCode: 'ASSEMBLY', nameEn: 'Assembly', executionKind: 'PRODUCTION' },
      { stageInstanceId: 'u', stageCode: 'UPHOLSTERY', nameEn: 'Upholstery', executionKind: 'PRODUCTION' },
      { stageInstanceId: 'i', stageCode: 'INSPECTION', nameEn: 'Inspection', executionKind: 'QUALITY' },
      { stageInstanceId: 'p', stageCode: 'PACKAGING', nameEn: 'Packaging', executionKind: 'PRODUCTION' },
    ];
    const { recommended, eligible } = recommendReworkStage({ category: 'UPHOLSTERY', stages });
    expect(eligible.map((e) => e.stageCode)).toEqual(['CARPENTRY', 'ASSEMBLY', 'UPHOLSTERY']);
    expect(recommended?.stageCode).toBe('UPHOLSTERY');
  });

  it('recommends Carpentry for dimension defects', () => {
    const stages: EligibleReworkStage[] = [
      { stageInstanceId: 'c', stageCode: 'CARPENTRY', nameEn: 'Carpentry', executionKind: 'PRODUCTION' },
      { stageInstanceId: 'a', stageCode: 'ASSEMBLY', nameEn: 'Assembly', executionKind: 'PRODUCTION' },
    ];
    const { recommended } = recommendReworkStage({ category: 'DIMENSIONS', stages });
    expect(recommended?.stageCode).toBe('CARPENTRY');
  });

  it('exposes category→stage hints for furniture factory', () => {
    expect(DEFECT_CATEGORY_STAGE_HINT.FABRIC[0]).toBe('UPHOLSTERY');
  });
});
