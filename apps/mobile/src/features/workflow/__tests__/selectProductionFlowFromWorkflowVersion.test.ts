import { selectProductionFlowFromWorkflowVersion } from '../selectProductionFlowFromWorkflowVersion';
import type { WorkflowVersion } from '@/api/modules/workflow';

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
