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
    pieceLabels: [{ nameEn: 'Left rail', nameAr: 'عارضة يسار' }],
    consumeOutputIds: [],
    outputId: 'out-1',
  };

  const fg = {
    workflowNodeId: 'n2',
    nodeKey: 'pack',
    stageDefinitionId: 's2',
    stageCode: 'PACKAGING',
    isRequired: true,
    requiresInspection: true,
    behavior: 'PRODUCES_FINISHED' as const,
    outputNameEn: 'Sofa',
    outputNameAr: 'كنبة',
    outputQtyPerUnit: 1,
    expectedPieceCount: 1,
    pieceLabels: [{ nameEn: 'A', nameAr: 'أ' }],
    consumeOutputIds: ['out-1'],
    consumesSemiFinished: true,
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
          stageCode: 'ASSEMBLY',
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

  it('returns INVALID when two stages consume the same SEMI output', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [],
      stages: [
        readyStage,
        {
          ...fg,
          workflowNodeId: 'n2',
          stageCode: 'ASSEMBLY',
          behavior: 'USES_AND_PRODUCES',
          consumesSemiFinished: true,
          consumeOutputIds: ['out-1'],
          outputId: 'out-2',
        },
        {
          workflowNodeId: 'n3',
          nodeKey: 'paint',
          stageDefinitionId: 's3',
          isRequired: true,
          behavior: 'USES_SEMI_FINISHED' as const,
          consumesSemiFinished: true,
          consumeOutputIds: ['out-1'],
          outputId: null,
        },
      ],
      outputIds: new Set(['out-1', 'out-2']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.code === 'SETUP_CONSUME_OUTPUT_ALREADY_CLAIMED')).toBe(
      true,
    );
  });

  it('rejects duplicate SKU on the same stage', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [{ sku: 'MAT-BEECH', qty: 2, exists: true }],
      stages: [
        {
          ...readyStage,
          materialInputs: [
            { sku: 'MAT-BEECH', qtyPerUnit: 2 },
            { sku: 'MAT-BEECH', qtyPerUnit: 1 },
          ],
        },
        fg,
      ],
      outputIds: new Set(['out-1', 'out-2']),
      knownNodeIds: new Set(['n1', 'n2']),
      knownSkus: new Set(['MAT-BEECH']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.code === 'SETUP_MATERIAL_DUPLICATE')).toBe(true);
  });

  it('rejects stage material qty that exceeds BOM', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [{ sku: 'MAT-BEECH', qty: 2, exists: true }],
      stages: [
        {
          ...readyStage,
          materialInputs: [{ sku: 'MAT-BEECH', qtyPerUnit: 1.5 }],
        },
        {
          ...fg,
          materialInputs: [{ sku: 'MAT-BEECH', qtyPerUnit: 1 }],
        },
      ],
      outputIds: new Set(['out-1', 'out-2']),
      knownNodeIds: new Set(['n1', 'n2']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.code === 'SETUP_MATERIAL_QTY_OVER_BOM')).toBe(true);
  });

  it('warns when BOM qty is only partially mapped', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [
        { sku: 'MAT-BEECH', qty: 4, exists: true },
        { sku: 'MAT-FOAM', qty: 2, exists: true },
      ],
      stages: [
        {
          ...readyStage,
          materialInputs: [{ sku: 'MAT-BEECH', qtyPerUnit: 2 }],
        },
        fg,
      ],
      outputIds: new Set(['out-1', 'out-2']),
      knownNodeIds: new Set(['n1', 'n2']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('NEEDS_SETUP');
    const unmapped = result.issues.filter((i) => i.code === 'SETUP_MATERIAL_SKU_UNMAPPED');
    expect(unmapped).toHaveLength(1);
  });

  it('rejects non-BOM SKUs on stage maps', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [{ sku: 'MAT-BEECH', qty: 2, exists: true }],
      stages: [
        {
          ...readyStage,
          materialInputs: [{ sku: 'MAT-OTHER', qtyPerUnit: 1 }],
        },
        fg,
      ],
      outputIds: new Set(['out-1', 'out-2']),
      knownNodeIds: new Set(['n1', 'n2']),
      knownSkus: new Set(['MAT-BEECH', 'MAT-OTHER']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.code === 'SETUP_MATERIAL_SKU_UNKNOWN')).toBe(true);
  });

  it('rejects finished goods on a non-packaging stage', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [],
      stages: [
        readyStage,
        {
          ...fg,
          workflowNodeId: 'n3',
          nodeKey: 'assembly',
          stageCode: 'ASSEMBLY',
          behavior: 'PRODUCES_FINISHED',
        },
      ],
      outputIds: new Set(['out-1', 'out-2']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.code === 'SETUP_FINISHED_ONLY_PACKAGING')).toBe(true);
  });

  it('warns when a SEMI kit has no named pieces', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [],
      stages: [{ ...readyStage, pieceLabels: [] }, fg],
      outputIds: new Set(['out-1', 'out-2']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('NEEDS_SETUP');
    expect(result.issues.some((i) => i.code === 'SETUP_PIECE_LABELS_REQUIRED')).toBe(true);
  });

  it('rejects Inspection that produces stocked output', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [],
      stages: [
        readyStage,
        {
          workflowNodeId: 'n-insp',
          nodeKey: 'inspection',
          stageDefinitionId: 's-insp',
          stageCode: 'INSPECTION',
          behavior: 'PRODUCES_SEMI_FINISHED' as const,
          outputNameEn: 'QC kit',
          outputNameAr: 'فحص',
          outputQtyPerUnit: 1,
          pieceLabels: [{ nameEn: 'Unit', nameAr: 'وحدة' }],
          consumeOutputIds: ['out-1'],
          consumesSemiFinished: true,
        },
        fg,
      ],
      outputIds: new Set(['out-1', 'out-2']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.code === 'SETUP_INSPECTION_MUST_NOT_PRODUCE')).toBe(true);
  });

  it('rejects Delivery that produces stocked output', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [],
      stages: [
        readyStage,
        fg,
        {
          workflowNodeId: 'n-del',
          nodeKey: 'delivery',
          stageDefinitionId: 's-del',
          stageCode: 'DELIVERY',
          behavior: 'PRODUCES_SEMI_FINISHED' as const,
          outputNameEn: 'Truck kit',
          outputNameAr: 'شحن',
          outputQtyPerUnit: 1,
          pieceLabels: [{ nameEn: 'Box', nameAr: 'صندوق' }],
        },
      ],
      outputIds: new Set(['out-1', 'out-2']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.code === 'SETUP_DELIVERY_MUST_NOT_PRODUCE')).toBe(true);
  });

  it('rejects Packaging that does not produce finished goods', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [],
      stages: [
        readyStage,
        {
          ...fg,
          behavior: 'NONE' as const,
          consumeOutputIds: ['out-1'],
          consumesSemiFinished: true,
          expectedPieceCount: 1,
        },
      ],
      outputIds: new Set(['out-1', 'out-2']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.code === 'SETUP_PACKAGING_MUST_PRODUCE_FINISHED')).toBe(
      true,
    );
  });

  it('rejects Packaging without package count', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [],
      stages: [readyStage, { ...fg, expectedPieceCount: 0 }],
      outputIds: new Set(['out-1', 'out-2']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.code === 'SETUP_PACK_PIECES_INVALID')).toBe(true);
  });

  it('rejects Packaging without named package labels', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [],
      stages: [
        readyStage,
        { ...fg, expectedPieceCount: 2, pieceLabels: [{ nameEn: 'A', nameAr: 'أ' }] },
      ],
      outputIds: new Set(['out-1', 'out-2']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.code === 'SETUP_PACK_LABELS_REQUIRED')).toBe(true);
  });

  it('rejects Packaging that skips upstream SEMI when kits exist', () => {
    const result = validateProductionSetup({
      hasPublishedWorkflow: true,
      dagIssues: [],
      bomLines: [],
      stages: [
        readyStage,
        {
          ...fg,
          consumeOutputIds: [],
          consumesSemiFinished: false,
        },
      ],
      outputIds: new Set(['out-1', 'out-2']),
      defaultWarehouseByType: {
        RAW_MATERIALS: true,
        SEMI_FINISHED: true,
        FINISHED_GOODS: true,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.code === 'SETUP_PACKAGING_MUST_CONSUME_SEMI')).toBe(true);
  });
});
