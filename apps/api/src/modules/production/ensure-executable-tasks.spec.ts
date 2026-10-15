import {
  isLogisticsOrDeliveryStage,
  listMissingExecutableTaskSpecs,
} from './ensure-executable-tasks';

describe('ensure-executable-tasks', () => {
  it('does not recreate open work on completed or skipped stages', () => {
    const specs = listMissingExecutableTaskSpecs(
      ['COMPLETED', 'SKIPPED', 'PENDING'].map((status) => ({
        id: status, status, stageDefinitionId: 'carpentry',
        stageDefinition: { code: 'CARPENTRY', executionKind: 'PRODUCTION' }, tasks: [],
      })), 'Sofa', 1,
    );
    expect(specs.map((spec) => spec.stageInstanceId)).toEqual(['PENDING']);
  });
  it('excludes LOGISTICS/DELIVERY and stages that already have tasks', () => {
    const specs = listMissingExecutableTaskSpecs(
      [
        {
          id: 'si1',
          stageDefinitionId: 'sd1',
          stageDefinition: {
            code: 'CARPENTRY',
            nameEn: 'Carpentry',
            executionKind: 'PRODUCTION',
          },
          tasks: [],
        },
        {
          id: 'si2',
          stageDefinitionId: 'sd2',
          stageDefinition: {
            code: 'ASSEMBLY',
            nameEn: 'Assembly',
            executionKind: 'PRODUCTION',
          },
          tasks: [{ id: 't2' }],
        },
        {
          id: 'si3',
          stageDefinitionId: 'sd3',
          stageDefinition: {
            code: 'DELIVERY',
            nameEn: 'Delivery',
            executionKind: 'LOGISTICS',
          },
          tasks: [],
        },
      ],
      'Sofa',
      2,
    );
    expect(specs).toHaveLength(1);
    expect(specs[0]?.stageInstanceId).toBe('si1');
    expect(specs[0]?.name).toBe('Carpentry');
  });

  it('detects logistics stages', () => {
    expect(isLogisticsOrDeliveryStage({ code: 'DELIVERY', executionKind: 'PRODUCTION' })).toBe(
      true,
    );
    expect(isLogisticsOrDeliveryStage({ code: 'PACKAGING', executionKind: 'LOGISTICS' })).toBe(
      true,
    );
    expect(isLogisticsOrDeliveryStage({ code: 'CARPENTRY', executionKind: 'PRODUCTION' })).toBe(
      false,
    );
  });
});
