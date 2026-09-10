/** Quality / logistics stages consume no capacity and add no minutes. */
export function isMilestoneStageCode(code?: string | null): boolean {
  const c = String(code ?? '').toUpperCase();
  return (
    c === 'INSPECTION' ||
    c === 'QC' ||
    c === 'QUALITY' ||
    c === 'DELIVERY' ||
    c === 'LOGISTICS'
  );
}

export function isMilestoneExecutionKind(kind?: string | null): boolean {
  const k = String(kind ?? '').toUpperCase();
  return k === 'QUALITY' || k === 'LOGISTICS';
}

/** Inspection/QC gates have no scheduled minutes. Packaging is timed. Delivery is logistics. */
export function isQualityGateStage(input: {
  code?: string | null;
  executionKind?: string | null;
}): boolean {
  const k = String(input.executionKind ?? '').toUpperCase();
  if (k === 'QUALITY') return true;
  const c = String(input.code ?? '').toUpperCase();
  return c === 'INSPECTION' || c === 'QC' || c === 'QUALITY';
}

export function isMilestoneStage(input: {
  code?: string | null;
  executionKind?: string | null;
  estimatedMinutes?: number | null;
}): boolean {
  const code = String(input.code ?? '').toUpperCase();
  if (code === 'PACKAGING' || code === 'PACK') return false;
  if (isMilestoneExecutionKind(input.executionKind)) return true;
  return isMilestoneStageCode(input.code);
}

/** Persist inspection/QC estimates as a zero-minute FIXED gate. */
export function coerceQualityGateEstimate(input: {
  code?: string | null;
  executionKind?: string | null;
  setupMinutes?: number | null;
  minutesPerUnit?: number | null;
  fixedMinutes?: number | null;
  quantityScalingMode?: string | null;
  batchSize?: number | null;
  batchMinutes?: number | null;
  maxParallelUnits?: number | null;
}): {
  setupMinutes: number;
  minutesPerUnit: number;
  fixedMinutes: number;
  quantityScalingMode: string;
  batchSize: number | null | undefined;
  batchMinutes: number | null | undefined;
  maxParallelUnits: number | null | undefined;
} {
  if (isQualityGateStage(input)) {
    return {
      setupMinutes: 0,
      minutesPerUnit: 0,
      fixedMinutes: 0,
      quantityScalingMode: 'FIXED',
      batchSize: null,
      batchMinutes: null,
      maxParallelUnits: null,
    };
  }
  return {
    setupMinutes: input.setupMinutes ?? 0,
    minutesPerUnit: input.minutesPerUnit ?? 0,
    fixedMinutes: input.fixedMinutes ?? 0,
    quantityScalingMode: input.quantityScalingMode ?? 'SETUP_PLUS_LINEAR',
    batchSize: input.batchSize,
    batchMinutes: input.batchMinutes,
    maxParallelUnits: input.maxParallelUnits,
  };
}
