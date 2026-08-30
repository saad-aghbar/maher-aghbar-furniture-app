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
    // Layout identity is node id so edges wire correctly in the bubble map.
    expect(stages[0]?.code).toBe('n2');
    expect(stages[0]?.name).toBe('Paint');
  });

  it('maps dependsOn by node id for the bubble path preview', () => {
    const version = {
      id: 'v1',
      versionNumber: 1,
      status: 'DRAFT',
      revision: 1,
      nodes: [
        {
          id: 'prep',
          nodeKey: 'MATERIAL_PREP',
          sortOrder: 0,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-prep',
            code: 'MATERIAL_PREP',
            nameAr: 'تحضير',
            nameEn: 'Prep',
            nameHe: 'הכנה',
            sortOrder: 0,
            isActive: true,
          },
        },
        {
          id: 'foam',
          nodeKey: 'FOAM',
          sortOrder: 1,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-foam',
            code: 'FOAM',
            nameAr: 'رغوة',
            nameEn: 'Foam',
            nameHe: 'קצף',
            sortOrder: 1,
            isActive: true,
          },
        },
      ],
      edges: [{ id: 'e1', fromNodeId: 'prep', toNodeId: 'foam', dependencyType: 'HARD' }],
    } as WorkflowVersion;

    const stages = selectProductionFlowFromWorkflowVersion(version, 'en');
    expect(stages.find((s) => s.code === 'foam')?.dependsOnCodes).toEqual(['prep']);
  });

  it('virtually heals orphan Foam into Inspection for the bubble preview', () => {
    const version = {
      id: 'v1',
      versionNumber: 1,
      status: 'DRAFT',
      revision: 1,
      nodes: [
        {
          id: 'prep',
          nodeKey: 'MATERIAL_PREP',
          sortOrder: 0,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-prep',
            code: 'MATERIAL_PREP',
            nameAr: 'تحضير',
            nameEn: 'Prep',
            nameHe: 'הכנה',
            sortOrder: 0,
            isActive: true,
          },
        },
        {
          id: 'foam',
          nodeKey: 'FOAM',
          sortOrder: 1,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-foam',
            code: 'FOAM',
            nameAr: 'رغوة',
            nameEn: 'Foam',
            nameHe: 'קצף',
            sortOrder: 1,
            isActive: true,
          },
        },
        {
          id: 'insp',
          nodeKey: 'INSPECTION',
          sortOrder: 2,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-insp',
            code: 'INSPECTION',
            nameAr: 'فحص',
            nameEn: 'Inspection',
            nameHe: 'בדיקה',
            sortOrder: 2,
            isActive: true,
          },
        },
      ],
      // Foam has no edges — floating in the real graph.
      edges: [{ id: 'e1', fromNodeId: 'prep', toNodeId: 'insp' }],
    } as WorkflowVersion;

    const stages = selectProductionFlowFromWorkflowVersion(version, 'en');
    // Canonicalizer does NOT invent Prep→Foam; Foam is frontier alongside Prep.
    expect(stages.find((s) => s.code === 'foam')?.dependsOnCodes).toEqual([]);
    const inspDeps = stages.find((s) => s.code === 'insp')?.dependsOnCodes ?? [];
    expect(inspDeps.sort()).toEqual(['foam', 'prep']);
  });

  it('spider-web Prep‖Carp → Assy → Paint → Insp reduces redundant dependsOn', () => {
    const def = (code: string, sortOrder: number) => ({
      id: `sd-${code}`,
      code,
      nameAr: code,
      nameEn: code,
      nameHe: code,
      sortOrder,
      isActive: true,
    });
    const version = {
      id: 'v1',
      versionNumber: 1,
      status: 'DRAFT',
      revision: 1,
      nodes: [
        {
          id: 'prep',
          nodeKey: 'MATERIAL_PREP',
          sortOrder: 0,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: def('MATERIAL_PREP', 0),
        },
        {
          id: 'carp',
          nodeKey: 'CARPENTRY',
          sortOrder: 1,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: def('CARPENTRY', 1),
        },
        {
          id: 'assy',
          nodeKey: 'ASSEMBLY',
          sortOrder: 2,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: def('ASSEMBLY', 2),
        },
        {
          id: 'paint',
          nodeKey: 'PAINTING',
          sortOrder: 3,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: def('PAINTING', 3),
        },
        {
          id: 'insp',
          nodeKey: 'INSPECTION',
          sortOrder: 4,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: def('INSPECTION', 4),
        },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'prep', toNodeId: 'assy' },
        { id: 'e2', fromNodeId: 'carp', toNodeId: 'assy' },
        { id: 'e3', fromNodeId: 'assy', toNodeId: 'paint' },
        { id: 'e4', fromNodeId: 'paint', toNodeId: 'insp' },
        { id: 'e5', fromNodeId: 'prep', toNodeId: 'paint' },
        { id: 'e6', fromNodeId: 'prep', toNodeId: 'insp' },
        { id: 'e7', fromNodeId: 'carp', toNodeId: 'insp' },
        { id: 'e8', fromNodeId: 'assy', toNodeId: 'insp' },
      ],
    } as WorkflowVersion;

    const stages = selectProductionFlowFromWorkflowVersion(version, 'en');
    expect(stages.find((s) => s.code === 'paint')?.dependsOnCodes).toEqual(['assy']);
    expect(stages.find((s) => s.code === 'insp')?.dependsOnCodes).toEqual(['paint']);
    expect(stages.find((s) => s.code === 'assy')?.dependsOnCodes?.sort()).toEqual([
      'carp',
      'prep',
    ]);
  });
});
