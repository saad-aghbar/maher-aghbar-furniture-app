import type { StageInventoryBehavior } from '../../common/helpers/inventory-stage-behavior.util';
import { behaviorProduces } from '../../common/helpers/inventory-stage-behavior.util';
import {
  isDeliveryStageCode,
  isInspectionStageCode,
  isPackagingStageCode,
} from './piece-labels';

export type ProductionSetupStatus = 'READY' | 'NEEDS_SETUP' | 'INVALID';

export type ProductionSetupIssue = {
  code: string;
  severity: 'error' | 'warning';
  nodeKey?: string | null;
  workflowNodeId?: string | null;
  message: string;
};

export type SetupStageInput = {
  workflowNodeId: string;
  nodeKey?: string;
  stageDefinitionId: string;
  stageCode?: string;
  isRequired?: boolean;
  isExcluded?: boolean;
  requiresInspection?: boolean;
  behavior: StageInventoryBehavior;
  consumesRawMaterials?: boolean;
  consumesSemiFinished?: boolean;
  outputNameEn?: string | null;
  outputNameAr?: string | null;
  outputQtyPerUnit?: number | null;
  expectedPieceCount?: number | null;
  pieceLabels?: Array<{ nameEn: string; nameAr?: string | null; nameHe?: string | null }> | null;
  consumeOutputIds?: string[];
  outputId?: string | null;
  materialInputs?: Array<{ sku: string; qtyPerUnit: number }>;
};

export type SetupValidatorInput = {
  hasPublishedWorkflow: boolean;
  dagIssues: Array<{ code: string; message: string; nodeKey?: string }>;
  bomLines: Array<{ sku: string; qty: number; exists: boolean }>;
  stages: SetupStageInput[];
  outputIds: Set<string>;
  knownNodeIds?: Set<string>;
  knownSkus?: Set<string>;
  defaultWarehouseByType: {
    RAW_MATERIALS: boolean;
    SEMI_FINISHED: boolean;
    FINISHED_GOODS: boolean;
  };
};

const INVALID_CODES = new Set([
  'WORKFLOW_CYCLE',
  'WORKFLOW_SELF_LINK',
  'WORKFLOW_DUPLICATE_EDGE',
  'WORKFLOW_NO_ROOT',
  'WORKFLOW_NO_TERMINAL',
  'WORKFLOW_UNREACHABLE_STAGE',
  'SETUP_CONSUME_OUTPUT_MISSING',
  'SETUP_CONSUME_OUTPUT_ALREADY_CLAIMED',
  'SETUP_OUTPUT_QTY_INVALID',
  'SETUP_EXCLUDED_REQUIRED_PRODUCER',
  'SETUP_MATERIAL_STAGE_UNKNOWN',
  'SETUP_MATERIAL_SKU_UNKNOWN',
  'SETUP_MATERIAL_QTY_INVALID',
  'SETUP_MATERIAL_DUPLICATE',
  'SETUP_MATERIAL_QTY_OVER_BOM',
  'SETUP_FINISHED_ONLY_PACKAGING',
  'SETUP_FINISHED_MULTIPLE',
  'SETUP_PACK_PIECES_INVALID',
  'SETUP_PACK_LABELS_REQUIRED',
  'SETUP_INSPECTION_MUST_NOT_PRODUCE',
  'SETUP_DELIVERY_MUST_NOT_PRODUCE',
  'SETUP_PACKAGING_MUST_PRODUCE_FINISHED',
  'SETUP_PACKAGING_MUST_CONSUME_SEMI',
  'SETUP_INSPECTION_MUST_CONSUME_SEMI',
]);

export function validateProductionSetup(input: SetupValidatorInput): {
  status: ProductionSetupStatus;
  issues: ProductionSetupIssue[];
} {
  const issues: ProductionSetupIssue[] = [];

  if (!input.hasPublishedWorkflow) {
    issues.push({
      code: 'SETUP_WORKFLOW_REQUIRED',
      severity: 'warning',
      message: 'Assign a published workflow before production can run.',
    });
  }

  for (const dag of input.dagIssues) {
    issues.push({
      code: dag.code,
      severity: 'error',
      nodeKey: dag.nodeKey ?? null,
      message: dag.message,
    });
  }

  const consumesRaw = input.stages.some(
    (s) =>
      !s.isExcluded &&
      (s.behavior === 'USES_MATERIALS' ||
        s.consumesRawMaterials ||
        s.behavior === 'PRODUCES_SEMI_FINISHED' ||
        s.behavior === 'USES_AND_PRODUCES' ||
        s.behavior === 'PRODUCES_FINISHED') &&
      Boolean(s.consumesRawMaterials || s.behavior === 'USES_MATERIALS'),
  );
  if (consumesRaw) {
    if (!input.bomLines.length) {
      issues.push({
        code: 'SETUP_BOM_REQUIRED',
        severity: 'warning',
        message: 'Add bill of materials lines for stages that use materials.',
      });
    }
    for (const line of input.bomLines) {
      if (!line.sku) {
        issues.push({
          code: 'SETUP_BOM_SKU_MISSING',
          severity: 'error',
          message: 'Every BOM line needs an inventory SKU.',
        });
      } else if (!line.exists) {
        issues.push({
          code: 'SETUP_BOM_SKU_UNKNOWN',
          severity: 'error',
          message: `BOM SKU ${line.sku} was not found.`,
        });
      }
      if (!(line.qty > 0)) {
        issues.push({
          code: 'SETUP_BOM_QTY_INVALID',
          severity: 'error',
          message: `BOM quantity for ${line.sku || 'a line'} must be greater than zero.`,
        });
      }
    }
  }

  const producers = input.stages.filter((s) => !s.isExcluded && behaviorProduces(s.behavior));
  const hasFg = producers.some((s) => s.behavior === 'PRODUCES_FINISHED');
  const hasQc = input.stages.some((s) => !s.isExcluded && s.requiresInspection);
  const fgStages = producers.filter((s) => s.behavior === 'PRODUCES_FINISHED');
  const hasUpstreamSemiKits = producers.some(
    (s) =>
      s.behavior === 'PRODUCES_SEMI_FINISHED' ||
      s.behavior === 'USES_AND_PRODUCES',
  );

  if (fgStages.length > 1) {
    issues.push({
      code: 'SETUP_FINISHED_MULTIPLE',
      severity: 'error',
      message: 'Only Packaging may produce the finished product.',
    });
  }

  for (const stage of input.stages) {
    if (stage.isExcluded && behaviorProduces(stage.behavior) && stage.isRequired) {
      issues.push({
        code: 'SETUP_EXCLUDED_REQUIRED_PRODUCER',
        severity: 'error',
        workflowNodeId: stage.workflowNodeId,
        nodeKey: stage.nodeKey ?? null,
        message: 'A required producing stage cannot be excluded.',
      });
    }
    if (stage.isExcluded) continue;

    const isPackaging = isPackagingStageCode(stage.stageCode);
    const isInspection = isInspectionStageCode(stage.stageCode);
    const isDelivery = isDeliveryStageCode(stage.stageCode);
    const consumeIds = stage.consumeOutputIds ?? [];
    const consumesSemi =
      stage.behavior === 'USES_SEMI_FINISHED' ||
      stage.behavior === 'USES_AND_PRODUCES' ||
      Boolean(stage.consumesSemiFinished) ||
      consumeIds.length > 0;

    if ((isInspection || isDelivery) && behaviorProduces(stage.behavior)) {
      issues.push({
        code: isInspection
          ? 'SETUP_INSPECTION_MUST_NOT_PRODUCE'
          : 'SETUP_DELIVERY_MUST_NOT_PRODUCE',
        severity: 'error',
        workflowNodeId: stage.workflowNodeId,
        nodeKey: stage.nodeKey ?? null,
        message: isInspection
          ? 'Inspection confirms quality only and must not create stocked inventory.'
          : 'Delivery checks packages onto the truck and must not create stocked inventory.',
      });
    }

    if (isPackaging) {
      if (stage.behavior !== 'PRODUCES_FINISHED') {
        issues.push({
          code: 'SETUP_PACKAGING_MUST_PRODUCE_FINISHED',
          severity: 'error',
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
          message: 'Packaging must produce the finished product with ship packages.',
        });
      }
      const packPieces = Number(stage.expectedPieceCount ?? 0);
      if (!(packPieces >= 1) || !Number.isFinite(packPieces)) {
        issues.push({
          code: 'SETUP_PACK_PIECES_INVALID',
          severity: 'error',
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
          message: 'Packaging needs at least one package piece per product unit.',
        });
      }
      const namedPacks = (stage.pieceLabels ?? []).filter((p) =>
        String(p.nameEn ?? '').trim(),
      );
      if (namedPacks.length < Math.max(1, Math.floor(packPieces) || 1)) {
        issues.push({
          code: 'SETUP_PACK_LABELS_REQUIRED',
          severity: 'error',
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
          message: 'Name every ship package for Packaging (for example A, legs, 3).',
        });
      }
      if (hasUpstreamSemiKits && !consumesSemi) {
        issues.push({
          code: 'SETUP_PACKAGING_MUST_CONSUME_SEMI',
          severity: 'error',
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
          message: 'Packaging must take the upstream semi-finished kit.',
        });
      }
    }

    if (isInspection && hasUpstreamSemiKits && !consumesSemi) {
      issues.push({
        code: 'SETUP_INSPECTION_MUST_CONSUME_SEMI',
        severity: 'error',
        workflowNodeId: stage.workflowNodeId,
        nodeKey: stage.nodeKey ?? null,
        message: 'Inspection must take the upstream semi-finished kit to confirm.',
      });
    }

    if (stage.behavior === 'PRODUCES_FINISHED' && !isPackaging) {
      issues.push({
        code: 'SETUP_FINISHED_ONLY_PACKAGING',
        severity: 'error',
        workflowNodeId: stage.workflowNodeId,
        nodeKey: stage.nodeKey ?? null,
        message: 'Only the Packaging stage may produce finished goods.',
      });
    }

    if (behaviorProduces(stage.behavior)) {
      if (stage.behavior !== 'PRODUCES_FINISHED') {
        const labels = stage.pieceLabels ?? [];
        const hasNamedPieces = labels.some((p) => String(p.nameEn ?? '').trim());
        if (!hasNamedPieces) {
          if (!String(stage.outputNameEn ?? '').trim() || !String(stage.outputNameAr ?? '').trim()) {
            issues.push({
              code: 'SETUP_OUTPUT_NAME_REQUIRED',
              severity: 'warning',
              workflowNodeId: stage.workflowNodeId,
              nodeKey: stage.nodeKey ?? null,
              message: 'Name the kit this stage produces, and add at least one piece.',
            });
          } else {
            issues.push({
              code: 'SETUP_PIECE_LABELS_REQUIRED',
              severity: 'warning',
              workflowNodeId: stage.workflowNodeId,
              nodeKey: stage.nodeKey ?? null,
              message: 'Add named pieces for this semi-finished kit.',
            });
          }
        }
      }
      const qty = Number(stage.outputQtyPerUnit ?? 1);
      if (!(qty > 0)) {
        issues.push({
          code: 'SETUP_OUTPUT_QTY_INVALID',
          severity: 'error',
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
          message: 'Output quantity per unit must be greater than zero.',
        });
      }
    }

    if (
      (stage.behavior === 'USES_SEMI_FINISHED' ||
        stage.behavior === 'USES_AND_PRODUCES' ||
        Boolean(stage.consumesSemiFinished)) &&
      consumeIds.length === 0
    ) {
      issues.push({
        code: 'SETUP_CONSUME_INPUTS_REQUIRED',
        severity: 'warning',
        workflowNodeId: stage.workflowNodeId,
        nodeKey: stage.nodeKey ?? null,
        message: 'Choose which semi-finished outputs this stage uses.',
      });
    }
    for (const outputId of consumeIds) {
      if (!input.outputIds.has(outputId)) {
        issues.push({
          code: 'SETUP_CONSUME_OUTPUT_MISSING',
          severity: 'error',
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
          message: 'A selected input is not a saved output on this product.',
        });
      }
    }
  }

  // Each SEMI output may be taken by at most one stage (furniture handoff chain).
  const consumeOwnerByOutput = new Map<string, { workflowNodeId: string; nodeKey?: string | null }>();
  for (const stage of input.stages) {
    if (stage.isExcluded) continue;
    for (const outputId of stage.consumeOutputIds ?? []) {
      if (!outputId || outputId.startsWith('node:')) continue;
      const prev = consumeOwnerByOutput.get(outputId);
      if (prev && prev.workflowNodeId !== stage.workflowNodeId) {
        issues.push({
          code: 'SETUP_CONSUME_OUTPUT_ALREADY_CLAIMED',
          severity: 'error',
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
          message: 'That semi-finished piece is already taken by another stage.',
        });
      } else if (!prev) {
        consumeOwnerByOutput.set(outputId, {
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
        });
      }
    }
  }

  if (producers.some((s) => s.behavior === 'PRODUCES_SEMI_FINISHED' || s.behavior === 'USES_AND_PRODUCES')) {
    if (!input.defaultWarehouseByType.SEMI_FINISHED) {
      issues.push({
        code: 'SETUP_DEFAULT_WAREHOUSE_SEMI',
        severity: 'warning',
        message: 'Set a default semi-finished warehouse.',
      });
    }
  }
  if (hasFg && !input.defaultWarehouseByType.FINISHED_GOODS) {
    issues.push({
      code: 'SETUP_DEFAULT_WAREHOUSE_FINISHED',
      severity: 'warning',
      message: 'Set a default finished-goods warehouse.',
    });
  }
  if (consumesRaw && !input.defaultWarehouseByType.RAW_MATERIALS) {
    issues.push({
      code: 'SETUP_DEFAULT_WAREHOUSE_RAW',
      severity: 'warning',
      message: 'Set a default raw-materials warehouse.',
    });
  }

  if (hasFg && !hasQc) {
    issues.push({
      code: 'SETUP_QC_FLAG_REQUIRED',
      severity: 'warning',
      message: 'Finished-product stages should run after a quality inspection.',
    });
  }

  const knownNodes = input.knownNodeIds ?? new Set(input.stages.map((s) => s.workflowNodeId));
  // Stage material maps must stay within the product BOM pool (not the whole inventory catalog).
  const bomSkuSet = new Set(input.bomLines.map((l) => l.sku).filter(Boolean));
  const knownSkus =
    bomSkuSet.size > 0
      ? bomSkuSet
      : (input.knownSkus ?? bomSkuSet);
  const seenMaterial = new Set<string>();
  const mappedQtyBySku = new Map<string, number>();
  let materialMapCount = 0;
  for (const stage of input.stages) {
    for (const row of stage.materialInputs ?? []) {
      materialMapCount += 1;
      const sku = String(row.sku ?? '').trim();
      if (!knownNodes.has(stage.workflowNodeId)) {
        issues.push({
          code: 'SETUP_MATERIAL_STAGE_UNKNOWN',
          severity: 'error',
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
          message: 'Map materials to a real workflow stage.',
        });
      }
      if (!sku || !knownSkus.has(sku)) {
        issues.push({
          code: 'SETUP_MATERIAL_SKU_UNKNOWN',
          severity: 'error',
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
          message: sku
            ? `SKU ${sku} is not on this product BOM.`
            : 'Material mapping needs an inventory SKU.',
        });
      }
      if (!(Number(row.qtyPerUnit) > 0)) {
        issues.push({
          code: 'SETUP_MATERIAL_QTY_INVALID',
          severity: 'error',
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
          message: `Quantity for ${sku || 'a material'} must be greater than zero.`,
        });
      }
      const dupKey = `${stage.workflowNodeId}::${sku}`;
      if (sku && seenMaterial.has(dupKey)) {
        issues.push({
          code: 'SETUP_MATERIAL_DUPLICATE',
          severity: 'error',
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
          message: `SKU ${sku} is mapped twice on this stage.`,
        });
      }
      if (sku) {
        seenMaterial.add(dupKey);
        const qty = Number(row.qtyPerUnit) || 0;
        mappedQtyBySku.set(sku, (mappedQtyBySku.get(sku) ?? 0) + qty);
      }
    }
  }
  if (materialMapCount > 0) {
    const underMapped: string[] = [];
    for (const line of input.bomLines) {
      if (!line.sku || !line.exists) continue;
      const mappedQty = mappedQtyBySku.get(line.sku) ?? 0;
      const bomQty = Number(line.qty) || 0;
      if (mappedQty > bomQty + 1e-9) {
        issues.push({
          code: 'SETUP_MATERIAL_QTY_OVER_BOM',
          severity: 'error',
          message: `SKU ${line.sku} is assigned ${mappedQty} across stages but BOM only has ${bomQty}.`,
        });
      } else if (mappedQty + 1e-9 < bomQty) {
        underMapped.push(
          mappedQty <= 0
            ? line.sku
            : `${line.sku} (${bomQty - mappedQty} left)`,
        );
      }
    }
    if (underMapped.length) {
      issues.push({
        code: 'SETUP_MATERIAL_SKU_UNMAPPED',
        severity: 'warning',
        message:
          underMapped.length === 1
            ? `BOM material still needs stage assignment: ${underMapped[0]}.`
            : `BOM materials still need stage assignment: ${underMapped.join(', ')}.`,
      });
    }
  }

  if (!input.hasPublishedWorkflow || !producers.length) {
    if (!issues.some((i) => i.code === 'SETUP_WORKFLOW_REQUIRED')) {
      issues.push({
        code: 'SETUP_STAGES_INCOMPLETE',
        severity: 'warning',
        message: 'Configure at least one producing stage.',
      });
    }
  }

  const hasInvalid = issues.some((i) => i.severity === 'error' || INVALID_CODES.has(i.code));
  if (hasInvalid) return { status: 'INVALID', issues };
  if (issues.length) return { status: 'NEEDS_SETUP', issues };
  return { status: 'READY', issues };
}
