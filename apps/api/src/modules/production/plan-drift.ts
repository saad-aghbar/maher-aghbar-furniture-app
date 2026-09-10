import { behaviorFromFlags } from '../../common/helpers/inventory-stage-behavior.util';
import { normalizePieceLabels } from './piece-labels';

export type PlanDriftNode = {
  snapshotNodeId: string;
  stageCode: string;
  stageDefinitionId: string | null;
  sourceWorkflowNodeId: string | null;
  inventoryTracking: string;
  consumesSemiFinished: boolean;
  expectedPieceCount: number;
  pieceLabels: Array<{ nameEn: string; nameAr?: string | null; nameHe?: string | null }>;
};

export type ProductSetupRow = {
  workflowNodeId: string | null;
  stageDefinitionId: string | null;
  inventoryTracking: string;
  consumesSemiFinished: boolean;
  expectedPieceCount?: number | null;
  pieceLabels?: unknown;
};

export type PlanDriftIssue = {
  snapshotNodeId: string;
  stageCode: string;
  field: 'inventoryTracking' | 'consumesSemiFinished' | 'expectedPieceCount' | 'pieceLabels';
  snapshot: string;
  catalog: string;
};

function labelsKey(
  labels: Array<{ nameEn: string; nameAr?: string | null; nameHe?: string | null }>,
): string {
  return labels
    .map((l) => `${l.nameEn.trim().toLowerCase()}|${String(l.nameAr ?? '').trim().toLowerCase()}`)
    .join(',');
}

function pickCatalogRow(node: PlanDriftNode, rows: ProductSetupRow[]): ProductSetupRow | null {
  const byNode = node.sourceWorkflowNodeId
    ? rows.find((row) => row.workflowNodeId === node.sourceWorkflowNodeId)
    : undefined;
  if (byNode) return byNode;
  const unbound = node.stageDefinitionId
    ? rows.find((row) => !row.workflowNodeId && row.stageDefinitionId === node.stageDefinitionId)
    : undefined;
  if (unbound) return unbound;
  return (
    rows.find((row) => row.stageDefinitionId && row.stageDefinitionId === node.stageDefinitionId) ??
    null
  );
}

export function detectPlanDrift(
  nodes: PlanDriftNode[],
  catalog: ProductSetupRow[],
): PlanDriftIssue[] {
  const issues: PlanDriftIssue[] = [];
  for (const node of nodes) {
    const row = pickCatalogRow(node, catalog);
    if (!row) continue;
    if (String(row.inventoryTracking) !== String(node.inventoryTracking)) {
      issues.push({
        snapshotNodeId: node.snapshotNodeId,
        stageCode: node.stageCode,
        field: 'inventoryTracking',
        snapshot: String(node.inventoryTracking),
        catalog: String(row.inventoryTracking),
      });
    }
    if (Boolean(row.consumesSemiFinished) !== Boolean(node.consumesSemiFinished)) {
      issues.push({
        snapshotNodeId: node.snapshotNodeId,
        stageCode: node.stageCode,
        field: 'consumesSemiFinished',
        snapshot: String(node.consumesSemiFinished),
        catalog: String(row.consumesSemiFinished),
      });
    }
    const catalogLabels = normalizePieceLabels(row.pieceLabels);
    const snapshotLabels = normalizePieceLabels(node.pieceLabels);
    const catalogCount = Math.max(
      1,
      catalogLabels.length,
      Math.floor(Number(row.expectedPieceCount) || 1),
    );
    if (catalogCount !== Math.max(1, node.expectedPieceCount || 1) && catalogLabels.length > 0) {
      issues.push({
        snapshotNodeId: node.snapshotNodeId,
        stageCode: node.stageCode,
        field: 'expectedPieceCount',
        snapshot: String(node.expectedPieceCount),
        catalog: String(catalogCount),
      });
    }
    if (catalogLabels.length > 0 && labelsKey(catalogLabels) !== labelsKey(snapshotLabels)) {
      issues.push({
        snapshotNodeId: node.snapshotNodeId,
        stageCode: node.stageCode,
        field: 'pieceLabels',
        snapshot: labelsKey(snapshotLabels) || '(none)',
        catalog: labelsKey(catalogLabels),
      });
    }
  }
  return issues;
}

export function catalogBehaviorForRow(row: ProductSetupRow) {
  return behaviorFromFlags({
    inventoryTracking: row.inventoryTracking as never,
    consumesRawMaterials: false,
    consumesSemiFinished: row.consumesSemiFinished,
  });
}
