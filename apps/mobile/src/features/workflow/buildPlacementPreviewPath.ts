import { OPENING_STAGE_CODE } from '@maher/types';
import { predecessorsOf, type EdgeLike } from './rewireWorkflowEdges';
import { buildWorkflowLayoutLevels, type WorkflowLayoutNode } from './workflowLayout';

export type PreviewChipKind = 'prep' | 'stage' | 'you' | 'sibling' | 'finishing';

export type PlacementPreviewChip = {
  id: string;
  kind: PreviewChipKind;
  nodeId?: string;
  code?: string;
  locked: boolean;
  highlight?: boolean;
};

export type PlacementPreviewSegment = {
  id: string;
  together: boolean;
  chips: PlacementPreviewChip[];
};

type NodeLike = WorkflowLayoutNode;

function isAnchorCode(code?: string): boolean {
  return (
    code === OPENING_STAGE_CODE ||
    code === 'INSPECTION' ||
    code === 'PACKAGING' ||
    code === 'DELIVERY'
  );
}

/**
 * Full-workflow placement preview from real DAG levels + proposed You wiring.
 * Uses edges (longest-path levels) so chips match the bubble map.
 */
export function buildPlacementPreviewPath(args: {
  nodes: NodeLike[];
  edges: EdgeLike[];
  runsAfterIds: string[];
  leadsIntoIds: string[];
  parallelSiblingIds?: string[];
  startBesidePrep?: boolean;
  lockedIds?: ReadonlySet<string>;
  /** Edit: existing node replaced by You. Add: omit. */
  targetId?: string | null;
}): {
  segments: PlacementPreviewSegment[];
} {
  const {
    nodes,
    edges,
    runsAfterIds,
    leadsIntoIds,
    parallelSiblingIds = [],
    startBesidePrep = false,
    lockedIds,
    targetId = null,
  } = args;

  const youId = targetId ?? '__you__';

  const isLocked = (n: NodeLike) => {
    if (lockedIds?.has(n.id)) return true;
    return isAnchorCode(n.stageDefinition?.code);
  };

  const chipForNode = (n: NodeLike, kind?: PreviewChipKind): PlacementPreviewChip => {
    const code = n.stageDefinition?.code;
    return {
      id: `n-${n.id}`,
      kind: kind ?? (isAnchorCode(code) ? (code === OPENING_STAGE_CODE ? 'prep' : 'finishing') : 'stage'),
      nodeId: n.id,
      code,
      locked: isLocked(n),
    };
  };

  const youChip: PlacementPreviewChip = {
    id: 'you',
    kind: 'you',
    locked: false,
    highlight: true,
  };

  // Nodes without the edited target; You is synthetic for Add.
  const baseNodes = nodes.filter((n) => n.id !== targetId);
  const youPlaceholder: NodeLike = {
    id: youId,
    sortOrder: Number.MAX_SAFE_INTEGER - 10,
    stageDefinition: {
      id: 'you',
      code: 'YOU',
      nameAr: 'You',
      nameEn: 'You',
      nameHe: 'You',
      sortOrder: 0,
      isActive: true,
    },
  };

  const layoutNodes: NodeLike[] = [...baseNodes, youPlaceholder];

  // Edges without target; add proposed You wiring + gap-close former preds on Start.
  let layoutEdges: EdgeLike[] = [];
  for (const e of edges) {
    if (e.fromNodeId === targetId) {
      // Outbound from target → handled via leadsIntoIds onto You
      continue;
    }
    if (e.toNodeId === targetId) {
      if (runsAfterIds.includes(e.fromNodeId)) {
        layoutEdges.push({ fromNodeId: e.fromNodeId, toNodeId: youId });
      } else if (runsAfterIds.length === 0 && leadsIntoIds[0] && leadsIntoIds[0] !== e.fromNodeId) {
        // Start: former preds gap-close onto the first preserved successor (not Inspection dump).
        layoutEdges.push({ fromNodeId: e.fromNodeId, toNodeId: leadsIntoIds[0]! });
      }
      // After/Parallel: drop edge into target; do not invent Inspection shortcuts.
      continue;
    }
    layoutEdges.push(e);
  }
  for (const from of runsAfterIds) {
    if (!layoutEdges.some((e) => e.fromNodeId === from && e.toNodeId === youId)) {
      layoutEdges.push({ fromNodeId: from, toNodeId: youId });
    }
  }
  for (const into of leadsIntoIds) {
    if (into === youId) continue;
    if (!layoutEdges.some((e) => e.fromNodeId === youId && e.toNodeId === into)) {
      layoutEdges.push({ fromNodeId: youId, toNodeId: into });
    }
  }
  // Start beside Prep: You is a root (no preds) — already true when runsAfter empty.

  const levels = buildWorkflowLayoutLevels(layoutNodes, layoutEdges);
  const siblingSet = new Set(parallelSiblingIds);
  const segments: PlacementPreviewSegment[] = [];
  const emitted = new Set<string>();

  for (const { level, lanes } of levels) {
    for (const lane of lanes) {
      const chips: PlacementPreviewChip[] = [];
      let hasYou = false;
      // Together hub only for parallel-band → parallel-band (lane.kind === 'together').
      let together = lane.kind === 'together';

      for (const n of lane.nodes) {
        if (emitted.has(n.id)) continue;
        if (n.id === youId) {
          chips.push(youChip);
          hasYou = true;
          emitted.add(n.id);
          continue;
        }
        // Parallel: group You with siblings even if layout split them.
        if (siblingSet.has(n.id) && !startBesidePrep) {
          chips.push(chipForNode(n, 'sibling'));
        } else {
          chips.push(chipForNode(n));
        }
        emitted.add(n.id);
      }

      // Start: Prep ‖ You as independent roots — no Together hub.
      if (level === 0 && startBesidePrep && hasYou) {
        const prep = chips.find((c) => c.code === OPENING_STAGE_CODE);
        const rest = chips.filter((c) => c.id !== youChip.id && c.code !== OPENING_STAGE_CODE);
        const ordered: PlacementPreviewChip[] = [];
        if (prep) ordered.push(prep);
        ordered.push(youChip);
        ordered.push(...rest);
        segments.push({ id: `seg-l${level}-start`, together: false, chips: ordered });
        continue;
      }

      // Parallel: You beside siblings — inside-band, no Together hub.
      if (hasYou && siblingSet.size > 0 && !startBesidePrep) {
        const nonYou = chips.filter((c) => c.id !== youChip.id);
        const sibs = nonYou.filter((c) => c.nodeId && siblingSet.has(c.nodeId));
        const other = nonYou.filter((c) => !c.nodeId || !siblingSet.has(c.nodeId));
        if (sibs.length > 0) {
          segments.push({
            id: `seg-l${level}-par`,
            together: false,
            chips: [youChip, ...sibs],
          });
          for (const c of other) {
            segments.push({ id: `seg-${c.id}`, together: false, chips: [c] });
          }
          continue;
        }
      }

      if (chips.length === 0) continue;
      if (chips.length === 1) {
        segments.push({ id: `seg-${chips[0]!.id}-l${level}`, together: false, chips });
      } else {
        segments.push({
          id: `seg-l${level}-${chips.map((c) => c.id).join('-')}`,
          together,
          chips,
        });
      }
    }
  }

  // Ensure You appeared (orphan fallback).
  if (!emitted.has(youId)) {
    const afterMax = Math.max(
      -1,
      ...runsAfterIds.map((id) => {
        const idx = segments.findIndex((s) => s.chips.some((c) => c.nodeId === id));
        return idx;
      }),
    );
    const insertAt = afterMax + 1;
    segments.splice(insertAt, 0, { id: 'seg-you-fallback', together: false, chips: [youChip] });
  }

  return { segments };
}

/** @internal test helper — preds of a node in layout edges */
export function previewPreds(edges: EdgeLike[], nodeId: string): string[] {
  return predecessorsOf(edges, nodeId);
}
