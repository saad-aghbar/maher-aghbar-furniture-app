import { validateProductionSetup } from './production-setup.validator';

describe('validateProductionSetup', () => {
  const readyStage = {
    workflowNodeId: 'n1',
    nodeKey: 'carpentry',
    stageDefinitionId: 's1',
    isRequired: true,
    behavior: 'PRODUCES_SEMI_FINISHED' as const,
    outputNameEn: 'Frame',
    outputNameAr: 'هيكل',
    outputQtyPerUnit: 1,
    consumeOutputIds: [],
    outputId: 'out-1',
  };

  const fg = {
    workflowNodeId: 'n2',
    nodeKey: 'pack',
    stageDefinitionId: 's2',
    isRequired: true,
    requiresInspection: true,
    behavior: 'PRODUCES_FINISHED' as const,
    outputNameEn: 'Sofa',
    outputNameAr: 'كنبة',
    outputQtyPerUnit: 1,
    consumeOutputIds: [],
    outputId: 'out-2',
  };

  it('returns READY when workflow, outputs, and warehouses are complete', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [],
      stages: [readyStage, fg],
      outputIds: new Set(['out-1', 'out-2']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('READY');
    expect(result.issues).toEqual([]);
  });

  it('returns NEEDS_SETUP without a published workflow', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: false,
      dagIssues: [],
      bomLines: [],
      stages: [],
      outputIds: new Set(),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('NEEDS_SETUP');
    expect(result.issues.some((i) => i.code === 'SETUP_WORKFLOW_REQUIRED')).toBe(true);
  });

  it('returns INVALID when consume refs are missing', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [],
      stages: [
        readyStage,
        {
          ...fg,
          behavior: 'USES_SEMI_FINISHED',
          consumeOutputIds: ['missing'],
          requiresInspection: false,
        },
      ],
      outputIds: new Set(['out-1']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.code === 'SETUP_CONSUME_OUTPUT_MISSING')).toBe(true);
  });
});
