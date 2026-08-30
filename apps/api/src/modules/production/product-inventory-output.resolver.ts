import { InventoryItemClass, InventoryTracking } from '@maher/database';
import { normalizePieceLabels } from './piece-labels';

export type ProductStageOutputRow = {
  id: string;
  productId: string;
  workflowNodeId: string | null;
  stageDefinitionId: string | null;
  itemClass: InventoryItemClass;
  inventoryTracking?: InventoryTracking | 'NONE' | 'PRODUCES_SEMI_FINISHED' | 'PRODUCES_FINISHED' | null;
  consumesRawMaterials?: boolean | null;
  consumesSemiFinished?: boolean | null;
  outputNameAr: string;
  outputNameEn: string;
  outputNameHe: string | null;
  outputQtyPerUnit: { toString(): string } | number | string;
  expectedPieceCount?: number | null;
  pieceLabels?: unknown;
  unit: string;
  defaultWarehouseId: string | null;
  inventoryItemId: string | null;
};

export type CompiledInventoryNode = {
  sourceWorkflowNodeId?: string | null;
  stageDefinitionId?: string | null;
  inventoryTracking: InventoryTracking | 'NONE' | 'PRODUCES_SEMI_FINISHED' | 'PRODUCES_FINISHED';
  consumesRawMaterials: boolean;
  consumesSemiFinished: boolean;
  outputQtyPerUnit?: { toString(): string } | number | string | null;
  expectedPieceCount?: number | null;
  outputNameAr?: string | null;
  outputNameEn?: string | null;
  outputNameHe?: string | null;
  defaultWarehouseId?: string | null;
};

export type ResolvedStageOutput = {
  tracking: InventoryTracking | 'NONE' | 'PRODUCES_SEMI_FINISHED' | 'PRODUCES_FINISHED';
  consumesRawMaterials: boolean;
  consumesSemiFinished: boolean;
  produces: boolean;
  outputDefinitionId: string | null;
  inventoryItemId: string | null;
  itemClass: InventoryItemClass | null;
  qtyPerUnit: number | null;
  expectedPieceCount: number;
  pieceLabels: Array<{ nameEn: string; nameAr: string; nameHe: string | null }>;
  unit: string | null;
  nameAr: string | null;
  nameEn: string | null;
  nameHe: string | null;
  warehouseId: string | null;
};

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pickProductOutput(
  node: CompiledInventoryNode,
  rows: ProductStageOutputRow[],
): ProductStageOutputRow | null {
  const byNode = node.sourceWorkflowNodeId
    ? rows.find((row) => row.workflowNodeId === node.sourceWorkflowNodeId)
    : undefined;
  if (byNode) return byNode;
  const byStage = node.stageDefinitionId
    ? rows.find((row) => !row.workflowNodeId && row.stageDefinitionId === node.stageDefinitionId)
    : undefined;
  return byStage ?? null;
}

/**
 * Snapshot-time resolution only.
 * Precedence: product Production Setup row (when present) overrides workflow node
 * tracking/consume; compiled node names/qty still win when set; then product names.
 * Runtime must read the frozen snapshot, not call this against live product rows.
 */
export function resolveProductStageOutput(
  node: CompiledInventoryNode,
  productOutputs: ProductStageOutputRow[] = [],
): ResolvedStageOutput {
  const product = pickProductOutput(node, productOutputs);
  const tracking = (product?.inventoryTracking ?? node.inventoryTracking ?? 'NONE') as
    | InventoryTracking
    | 'NONE'
    | 'PRODUCES_SEMI_FINISHED'
    | 'PRODUCES_FINISHED';
  const consumesRawMaterials =
    product?.consumesRawMaterials != null
      ? Boolean(product.consumesRawMaterials)
      : Boolean(node.consumesRawMaterials);
  const consumesSemiFinished =
    product?.consumesSemiFinished != null
      ? Boolean(product.consumesSemiFinished)
      : Boolean(node.consumesSemiFinished);
  const produces =
    tracking === 'PRODUCES_SEMI_FINISHED' || tracking === 'PRODUCES_FINISHED';
  const itemClass =
    tracking === 'PRODUCES_FINISHED'
      ? InventoryItemClass.FINISHED_GOOD
      : tracking === 'PRODUCES_SEMI_FINISHED'
        ? InventoryItemClass.SEMI_FINISHED_GOOD
        : product?.itemClass ?? null;

  const nodeQty = num(node.outputQtyPerUnit);
  const productQty = num(product?.outputQtyPerUnit);
  const qtyPerUnit = nodeQty ?? productQty ?? (produces ? 1 : null);

  const pieceFromNode =
    node.expectedPieceCount != null && Number(node.expectedPieceCount) > 0
      ? Math.floor(Number(node.expectedPieceCount))
      : null;
  const pieceFromProduct =
    product?.expectedPieceCount != null && Number(product.expectedPieceCount) > 0
      ? Math.floor(Number(product.expectedPieceCount))
      : null;
  const pieceLabels =
    tracking === 'PRODUCES_SEMI_FINISHED' || tracking === 'PRODUCES_FINISHED'
      ? normalizePieceLabels(product?.pieceLabels)
      : [];
  const expectedPieceCount =
    pieceLabels.length > 0
      ? pieceLabels.length
      : (pieceFromNode ?? pieceFromProduct ?? 1);

  const nameEn = node.outputNameEn || product?.outputNameEn || null;
  const nameAr = node.outputNameAr || product?.outputNameAr || nameEn;
  const nameHe = node.outputNameHe || product?.outputNameHe || null;
  const warehouseId = node.defaultWarehouseId || product?.defaultWarehouseId || null;

  return {
    tracking,
    consumesRawMaterials,
    consumesSemiFinished,
    produces,
    outputDefinitionId: product?.id ?? null,
    inventoryItemId: product?.inventoryItemId ?? null,
    itemClass,
    qtyPerUnit,
    expectedPieceCount,
    pieceLabels,
    unit: product?.unit || (produces ? 'pcs' : null),
    nameAr,
    nameEn,
    nameHe,
    warehouseId,
  };
}

export function outputQtyForOrder(qtyPerUnit: number | null | undefined, orderQty: number): number {
  const per = Number(qtyPerUnit);
  const qty = Number(orderQty);
  const unit = Number.isFinite(per) && per > 0 ? per : 1;
  const orders = Number.isFinite(qty) && qty > 0 ? qty : 1;
  return unit * orders;
}
