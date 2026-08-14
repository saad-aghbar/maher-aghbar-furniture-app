import type { StageInventoryBehavior } from '../../common/helpers/inventory-stage-behavior.util';
import { behaviorProduces } from '../../common/helpers/inventory-stage-behavior.util';

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
  consumeOutputIds?: string[];
  outputId?: string | null;
};

export type SetupValidatorInput = {
  hasPublishedWorkflow: boolean;
  dagIssues: Array<{ code: string; message: string; nodeKey?: string }>;
  bomLines: Array<{ sku: string; qty: number; exists: boolean }>;
  stages: SetupStageInput[];
  outputIds: Set<string>;
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
  'SETUP_OUTPUT_QTY_INVALID',
  'SETUP_EXCLUDED_REQUIRED_PRODUCER',
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

    if (behaviorProduces(stage.behavior)) {
      if (!String(stage.outputNameEn ?? '').trim() || !String(stage.outputNameAr ?? '').trim()) {
        issues.push({
          code: 'SETUP_OUTPUT_NAME_REQUIRED',
          severity: 'warning',
          workflowNodeId: stage.workflowNodeId,
          nodeKey: stage.nodeKey ?? null,
          message: 'Name the component or finished product this stage produces.',
        });
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

    const consumeIds = stage.consumeOutputIds ?? [];
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
