/**
 * Place order-level material overrides onto the correct workflow snapshot nodes
 * using the product's per-stage catalog map.
 *
 * Catalog seed used to dump every override onto the first raw-consuming node,
 * which destroyed per-stage fabric/wood attribution needed for task-start gates.
 */

export type QuantityMode = 'LINEAR' | 'FIXED' | 'SETUP_PLUS_LINEAR' | 'BATCH' | 'PARALLEL_CAPACITY';

export type MaterialOverrideRow = {
  inventoryItemId: string;
  sku: string;
  qtyPerUnit: number;
  unit?: string | null;
  required?: boolean;
  quantityMode?: QuantityMode | null;
};

export type CatalogStageMaterialRow = {
  inventoryItemId: string;
  workflowNodeId?: string | null;
  stageDefinitionId?: string | null;
  qtyPerUnit?: unknown;
  unit?: string | null;
  quantityMode?: string | null;
  sku?: string | null;
};

export type SnapshotNodeRef = {
  id: string;
  stageCode: string;
  sourceWorkflowNodeId?: string | null;
  stageDefinitionId?: string | null;
  consumesRawMaterials?: boolean;
  sortOrder?: number;
};

export type DistributedSnapshotMaterial = {
  snapshotNodeId: string;
  stageCode: string;
  inventoryItemId: string;
  sku: string;
  qtyPerUnit: number;
  unit: string;
  required: boolean;
  quantityMode: QuantityMode;
};

function catalogQty(row: CatalogStageMaterialRow): number {
  const n = Number(row.qtyPerUnit);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function nodeMatchesCatalog(node: SnapshotNodeRef, row: CatalogStageMaterialRow): boolean {
  if (row.workflowNodeId && node.sourceWorkflowNodeId) {
    return row.workflowNodeId === node.sourceWorkflowNodeId;
  }
  if (row.stageDefinitionId && node.stageDefinitionId) {
    return row.stageDefinitionId === node.stageDefinitionId;
  }
  return false;
}

function firstRawConsumer(nodes: SnapshotNodeRef[]): SnapshotNodeRef | null {
  return (
    nodes.find((n) => n.consumesRawMaterials) ??
    [...nodes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0] ??
    null
  );
}

function asQuantityMode(value: string | null | undefined): QuantityMode {
  if (
    value === 'LINEAR' ||
    value === 'FIXED' ||
    value === 'SETUP_PLUS_LINEAR' ||
    value === 'BATCH' ||
    value === 'PARALLEL_CAPACITY'
  ) {
    return value;
  }
  return 'LINEAR';
}

/**
 * Distribute order material overrides across snapshot nodes.
 * - Items that appear in catalog stage inputs land on those nodes (qty split by catalog ratio).
 * - Items with no catalog mapping land on the first raw-consuming node (factory-added).
 * - Catalog items absent from overrides are omitted (factory-removed).
 */
export function distributeMaterialsToSnapshotNodes(
  nodes: SnapshotNodeRef[],
  catalogInputs: CatalogStageMaterialRow[],
  overrides: MaterialOverrideRow[],
): DistributedSnapshotMaterial[] {
  if (!nodes.length || !overrides.length) return [];

  const fallback = firstRawConsumer(nodes);
  const byItemCatalog = new Map<string, CatalogStageMaterialRow[]>();
  for (const row of catalogInputs) {
    const list = byItemCatalog.get(row.inventoryItemId) ?? [];
    list.push(row);
    byItemCatalog.set(row.inventoryItemId, list);
  }

  const out: DistributedSnapshotMaterial[] = [];
  const usedFallbackKeys = new Set<string>();

  for (const override of overrides) {
    const catalogRows = byItemCatalog.get(override.inventoryItemId) ?? [];
    const matched: Array<{ node: SnapshotNodeRef; catalogQty: number; row: CatalogStageMaterialRow }> = [];
    for (const row of catalogRows) {
      const node = nodes.find((n) => nodeMatchesCatalog(n, row));
      if (!node) continue;
      matched.push({ node, catalogQty: catalogQty(row) || 1, row });
    }

    if (!matched.length) {
      if (!fallback) continue;
      const key = `${fallback.id}:${override.inventoryItemId}`;
      if (usedFallbackKeys.has(key)) continue;
      usedFallbackKeys.add(key);
      out.push({
        snapshotNodeId: fallback.id,
        stageCode: fallback.stageCode,
        inventoryItemId: override.inventoryItemId,
        sku: override.sku,
        qtyPerUnit: Number(override.qtyPerUnit) || 0,
        unit: override.unit || 'pcs',
        required: override.required !== false,
        quantityMode: asQuantityMode(override.quantityMode),
      });
      continue;
    }

    const totalCatalog = matched.reduce((s, m) => s + m.catalogQty, 0) || matched.length;
    for (const m of matched) {
      const share = m.catalogQty / totalCatalog;
      const qty = Number(override.qtyPerUnit) * share;
      out.push({
        snapshotNodeId: m.node.id,
        stageCode: m.node.stageCode,
        inventoryItemId: override.inventoryItemId,
        sku: override.sku,
        qtyPerUnit: qty,
        unit: override.unit || m.row.unit || 'pcs',
        required: override.required !== false,
        quantityMode: asQuantityMode(override.quantityMode ?? m.row.quantityMode),
      });
    }
  }

  return out;
}
