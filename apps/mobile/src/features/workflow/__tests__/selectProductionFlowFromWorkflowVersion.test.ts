import type { ProductStageEstimate } from '@/api/modules/scheduling';
import type { WorkflowVersion } from '@/api/modules/workflow';
import {
  formatProductIdentity,
  selectProductionFlowFromStageEstimates,
  selectProductionFlowFromWorkflowVersion,
} from '../selectProductionFlowFromWorkflowVersion';

describe('selectProductionFlowFromWorkflowVersion', () => {
  it('skips nodes missing stageDefinition instead of crashing', () => {
    const version = {
      id: 'v1',
      versionNumber: 1,
      status: 'PUBLISHED',
      revision: 1,
      nodes: [
        {
          id: 'n1',
          nodeKey: 'CUT',
          sortOrder: 0,
          isRequiredByDefault: true,
          canBeSkipped: false,
          // lean payload — no stageDefinition
        },
        {
          id: 'n2',
          nodeKey: 'PAINT',
          sortOrder: 1,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-paint',
            code: 'PAINT',
            nameAr: 'طلاء',
            nameEn: 'Paint',
            nameHe: 'צביעה',
            sortOrder: 1,
            isActive: true,
          },
        },
      ],
      edges: [],
    } as WorkflowVersion;

    const stages = selectProductionFlowFromWorkflowVersion(version, 'en');
    expect(stages).toHaveLength(1);
    expect(stages[0]?.code).toBe('PAINT');
  });
});

describe('selectProductionFlowFromStageEstimates', () => {
  const paint: ProductStageEstimate = {
    stageDefinitionId: 'sd-paint',
    setupMinutes: 0,
    minutesPerUnit: 0,
    fixedMinutes: 55,
    quantityScalingMode: 'FIXED',
    stageDefinition: {
      id: 'sd-paint',
      code: 'PAINT',
      nameEn: 'Paint',
      nameAr: 'طلاء',
      nameHe: 'צביעה',
      sortOrder: 2,
    },
  };

  it('uses API stage names and times and skips rows without a definition', () => {
    const nameless: ProductStageEstimate = {
      stageDefinitionId: 'sd-ghost',
      setupMinutes: 0,
      minutesPerUnit: 0,
      fixedMinutes: 99,
      quantityScalingMode: 'FIXED',
    };
    const stages = selectProductionFlowFromStageEstimates([nameless, paint], 'en');
    expect(stages).toHaveLength(1);
    expect(stages[0]?.code).toBe('PAINT');
    expect(stages[0]?.name).toBe('Paint');
    expect(stages[0]?.estimatedMinutes).toBe(55);
    expect(stages[0]?.estimateReviewRequired).toBe(false);
  });

  it('does not invent names when the definition has no localized labels', () => {
    const stages = selectProductionFlowFromStageEstimates(
      [
        {
          ...paint,
          stageDefinition: {
            id: 'sd-paint',
            code: 'PAINT',
            nameEn: '',
            nameAr: '',
            nameHe: null,
            sortOrder: 0,
          },
        },
      ],
      'en',
    );
    expect(stages[0]?.name).toBe('PAINT');
  });
});

describe('formatProductIdentity', () => {
  it('shows sku / name without inventing either side', () => {
    expect(formatProductIdentity('SOF-3S-STD', '3-Seater Sofa Standard')).toBe(
      'SOF-3S-STD / 3-Seater Sofa Standard',
    );
    expect(formatProductIdentity('SOF-3S-STD', 'SOF-3S-STD')).toBe('SOF-3S-STD');
    expect(formatProductIdentity('SOF-3S-STD', '')).toBe('SOF-3S-STD');
    expect(formatProductIdentity('', '3-Seater Sofa Standard')).toBe('3-Seater Sofa Standard');
    expect(formatProductIdentity(null, null)).toBe('');
  });
});
