/**
 * Admin production order lifecycle — maps domain enums to a human stepper.
 * Frontend-only; does not change backend semantics.
 */

export type ProductionLifecycleStep =
  | 'production'
  | 'inspection'
  | 'packaging'
  | 'ready'
  | 'shipped'
  | 'delivered';

const STEPS: ProductionLifecycleStep[] = [
  'production',
  'inspection',
  'packaging',
  'ready',
  'shipped',
  'delivered',
];

export function productionLifecycleSteps(): ProductionLifecycleStep[] {
  return STEPS;
}

type StageRow = {
  status: string;
  stageDefinition: { code: string; sortOrder?: number };
  tasks?: Array<{ status: string }>;
};

const DONE_WORK = new Set(['COMPLETED', 'SKIPPED', 'DONE', 'CANCELLED']);

/** Quality / rework holds that belong on the inspection lane. */
export function isInspectionLaneStatus(poStatus: string): boolean {
  const po = poStatus.toUpperCase();
  return po === 'QUALITY_CHECK' || po === 'ON_HOLD';
}

export function deriveProductionLifecycle(input: {
  poStatus: string;
  currentStageCode?: string | null;
  stages?: StageRow[];
  deliveryStatus?: string | null;
}): ProductionLifecycleStep {
  const po = input.poStatus.toUpperCase();
  const delivery = input.deliveryStatus?.toUpperCase() ?? null;

  if (delivery === 'DELIVERED') return 'delivered';
  if (delivery === 'OUT_FOR_DELIVERY') return 'shipped';
  if (po === 'COMPLETED' || po === 'READY_FOR_DELIVERY') return 'ready';

  const stages = input.stages ?? [];
  const byCode = (code: string) =>
    stages.find((s) => s.stageDefinition.code.toUpperCase() === code);

  const insp = byCode('INSPECTION');
  const pack = byCode('PACKAGING');
  const del = byCode('DELIVERY');

  const code = input.currentStageCode?.toUpperCase() ?? null;

  // PO-level QC / rework hold → inspection lane (before packaging stage heuristics).
  if (isInspectionLaneStatus(po)) return 'inspection';

  if (po === 'READY_FOR_PACKAGING' || code === 'PACKAGING' || pack?.status === 'IN_PROGRESS') {
    return 'packaging';
  }
  if (code === 'INSPECTION' || insp?.status === 'IN_PROGRESS') return 'inspection';

  if (
    pack?.status === 'COMPLETED' &&
    (del?.status === 'IN_PROGRESS' || del?.status === 'COMPLETED' || po === 'READY_FOR_DELIVERY')
  ) {
    return 'ready';
  }

  if (insp?.status === 'COMPLETED' && pack?.status !== 'COMPLETED') return 'packaging';

  // Manufacturing stages are done and inspection is still ahead. Do not call this delivered.
  if (
    (po === 'IN_PROGRESS' || po === 'READY') &&
    manufacturingStagesFinished(stages)
  ) {
    return 'inspection';
  }

  return 'production';
}

const AFTER_MANUFACTURING = new Set([
  'INSPECTION',
  'QC',
  'QUALITY',
  'PACKAGING',
  'PACK',
  'DELIVERY',
]);

function isManufacturingStage(stage: StageRow): boolean {
  return !AFTER_MANUFACTURING.has(stage.stageDefinition.code.toUpperCase());
}

/** Task status wins when a stage has tasks. A Completed stage row must not hide a Not started task. */
export function effectiveManufacturingStatus(stage: StageRow): string {
  const tasks = stage.tasks ?? [];
  if (tasks.length === 0) return stage.status;
  const open = tasks.find((task) => !DONE_WORK.has(String(task.status).toUpperCase()));
  return open ? open.status : 'COMPLETED';
}

/** True when every manufacturing task is completed. Stage rows are used only when a stage has no tasks. */
export function manufacturingStagesFinished(stages: StageRow[] | undefined): boolean {
  const rows = (stages ?? []).filter(isManufacturingStage);
  return (
    rows.length > 0 &&
    rows.every((stage) => DONE_WORK.has(effectiveManufacturingStatus(stage).toUpperCase()))
  );
}

/** Earliest manufacturing stage whose task is not completed. */
export function openManufacturingWork<T extends StageRow>(
  stages: T[] | undefined,
): { stage: T; status: string } | null {
  const rows = [...(stages ?? [])]
    .filter(isManufacturingStage)
    .sort((a, b) => (a.stageDefinition.sortOrder ?? 0) - (b.stageDefinition.sortOrder ?? 0));
  for (const stage of rows) {
    const status = effectiveManufacturingStatus(stage);
    if (!DONE_WORK.has(status.toUpperCase())) return { stage, status };
  }
  return null;
}

export type ProductionLifecycleFilter =
  | 'all'
  | 'active'
  | 'inspection'
  | 'packaging'
  | 'ready'
  | 'completed';

export function matchesProductionLifecycleFilter(
  row: {
    status: string;
    currentStageCode?: string | null;
    currentStage?: { code: string } | null;
  },
  filter: ProductionLifecycleFilter,
): boolean {
  if (filter === 'all') return true;

  const code = (row.currentStageCode ?? row.currentStage?.code ?? '').toUpperCase();
  const status = row.status.toUpperCase();

  if (filter === 'completed') {
    return status === 'COMPLETED' || status === 'CANCELLED';
  }
  if (filter === 'ready') {
    return status === 'READY_FOR_DELIVERY';
  }
  if (filter === 'inspection') {
    return (
      isInspectionLaneStatus(status) ||
      (code === 'INSPECTION' && status !== 'COMPLETED' && status !== 'READY_FOR_DELIVERY')
    );
  }
  if (filter === 'packaging') {
    return (
      status === 'READY_FOR_PACKAGING' ||
      (code === 'PACKAGING' &&
        status !== 'COMPLETED' &&
        status !== 'READY_FOR_DELIVERY' &&
        !isInspectionLaneStatus(status))
    );
  }
  if (filter === 'active') {
    return (
      !['COMPLETED', 'CANCELLED', 'READY_FOR_DELIVERY', 'QUALITY_CHECK', 'ON_HOLD', 'READY_FOR_PACKAGING'].includes(
        status,
      ) &&
      code !== 'INSPECTION' &&
      code !== 'PACKAGING'
    );
  }
  return true;
}

/** Human lane label for board chips (inspection / packaging / ready / rework). */
export function productionLifecycleBoardLabel(
  row: {
    status: string;
    currentStageCode?: string | null;
    currentStage?: { code: string; nameEn?: string; nameAr?: string | null; nameHe?: string | null } | null;
  },
  labels: {
    inspection: string;
    packaging: string;
    ready: string;
    rework: string;
    stageFallback: (name: string) => string;
  },
  localizedStageName?: string | null,
): string {
  const status = row.status.toUpperCase();
  const code = (row.currentStageCode ?? row.currentStage?.code ?? '').toUpperCase();

  if (status === 'ON_HOLD') return labels.rework;
  if (status === 'QUALITY_CHECK' || code === 'INSPECTION') return labels.inspection;
  if (status === 'READY_FOR_PACKAGING' || code === 'PACKAGING') return labels.packaging;
  if (status === 'READY_FOR_DELIVERY') return labels.ready;

  if (localizedStageName) return labels.stageFallback(localizedStageName);
  if (code) return labels.stageFallback(code);
  return labels.stageFallback('—');
}
