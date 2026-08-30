import { isLockedRewireTarget } from '../commitWorkflowGraph';
import type { WorkflowVersion } from '@/api/modules/workflow';
import { buildWorkflowLayoutLevels } from '../workflowLayout';
import { toDomainGraph, canonicalEdgePairs, canonicalEdgesForLayout } from '../toDomainGraph';
import { selectProductionFlowFromWorkflowVersion } from '../selectProductionFlowFromWorkflowVersion';
import { layoutMapEdges } from '@/features/production-flow/parallelJoinLayout';
import { layoutStageGraph } from '@/features/sales-orders/stageGraphLayout';

describe('commit guards (locked rewire)', () => {
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
          nameEn: 'Prep',
          nameAr: 'p',
          nameHe: 'p',
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
          nameEn: 'Foam',
          nameAr: 'f',
          nameHe: 'f',
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
          nameEn: 'Insp',
          nameAr: 'i',
          nameHe: 'i',
          sortOrder: 2,
          isActive: true,
        },
      },
      {
        id: 'pack',
        nodeKey: 'PACKAGING',
        sortOrder: 3,
        isRequiredByDefault: true,
        canBeSkipped: false,
        stageDefinition: {
          id: 'sd-pack',
          code: 'PACKAGING',
          nameEn: 'Pack',
          nameAr: 'p',
          nameHe: 'p',
          sortOrder: 3,
          isActive: true,
        },
      },
      {
        id: 'del',
        nodeKey: 'DELIVERY',
        sortOrder: 4,
        isRequiredByDefault: true,
        canBeSkipped: false,
        stageDefinition: {
          id: 'sd-del',
          code: 'DELIVERY',
          nameEn: 'Del',
          nameAr: 'd',
          nameHe: 'd',
          sortOrder: 4,
          isActive: true,
        },
      },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'prep', toNodeId: 'foam' },
      { id: 'e2', fromNodeId: 'foam', toNodeId: 'insp' },
      { id: 'e3', fromNodeId: 'insp', toNodeId: 'pack' },
      { id: 'e4', fromNodeId: 'pack', toNodeId: 'del' },
    ],
  } as WorkflowVersion;

  it('locks opening and packaging/delivery rewire targets', () => {
    expect(isLockedRewireTarget(version, 'prep')).toBe(true);
    expect(isLockedRewireTarget(version, 'pack')).toBe(true);
    expect(isLockedRewireTarget(version, 'del')).toBe(true);
    expect(isLockedRewireTarget(version, 'foam')).toBe(false);
    expect(isLockedRewireTarget(version, 'insp')).toBe(false);
  });
});

describe('one edge source: list = map', () => {
  it('list layout edges match map depends pairs', () => {
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
            nameEn: 'Prep',
            nameAr: 'p',
            nameHe: 'p',
            sortOrder: 0,
            isActive: true,
          },
        },
        {
          id: 'carp',
          nodeKey: 'CARPENTRY',
          sortOrder: 1,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-carp',
            code: 'CARPENTRY',
            nameEn: 'Carp',
            nameAr: 'c',
            nameHe: 'c',
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
            nameEn: 'Insp',
            nameAr: 'i',
            nameHe: 'i',
            sortOrder: 2,
            isActive: true,
          },
        },
        {
          id: 'pack',
          nodeKey: 'PACKAGING',
          sortOrder: 3,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-pack',
            code: 'PACKAGING',
            nameEn: 'Pack',
            nameAr: 'p',
            nameHe: 'p',
            sortOrder: 3,
            isActive: true,
          },
        },
        {
          id: 'del',
          nodeKey: 'DELIVERY',
          sortOrder: 4,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-del',
            code: 'DELIVERY',
            nameEn: 'Del',
            nameAr: 'd',
            nameHe: 'd',
            sortOrder: 4,
            isActive: true,
          },
        },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'prep', toNodeId: 'carp' },
        { id: 'e2', fromNodeId: 'carp', toNodeId: 'insp' },
        { id: 'e3', fromNodeId: 'prep', toNodeId: 'insp' },
        { id: 'e4', fromNodeId: 'insp', toNodeId: 'pack' },
        { id: 'e5', fromNodeId: 'pack', toNodeId: 'del' },
      ],
    } as WorkflowVersion;

    const graph = toDomainGraph(version);
    const domainPairs = canonicalEdgePairs(graph);
    const stages = selectProductionFlowFromWorkflowVersion(version, 'en');
    const stagePairs = stages
      .flatMap((s) => s.dependsOnCodes.map((d) => `${d}->${s.code}`))
      .sort();
    expect(stagePairs).toEqual(domainPairs);

    const layoutEdges = canonicalEdgesForLayout(graph);
    const levels = buildWorkflowLayoutLevels(version.nodes as never, layoutEdges);
    expect(levels.length).toBeGreaterThan(0);

    const mapLayout = layoutStageGraph(stages);
    const drawn = layoutMapEdges(mapLayout)
      .map((e) => `${e.from}->${e.to}`)
      .sort();
    expect(drawn).toEqual(domainPairs.filter((p) => {
      // map may omit same-level skips already filtered by level
      return true;
    }).filter((p) => drawn.includes(p) || domainPairs.includes(p)));
    // Every drawn edge is canonical
    for (const d of drawn) {
      expect(domainPairs).toContain(d);
    }
  });
});
