export type ReadyHandoffTopic = 'task.ready' | 'quality.queued' | 'packaging.ready';

export function classifyReadyHandoff(input: {
  stageCode: string;
  executionKind?: string | null;
}): ReadyHandoffTopic {
  const kind = String(input.executionKind ?? '').toUpperCase();
  const code = String(input.stageCode ?? '').toUpperCase();
  if (kind === 'QUALITY' || code === 'INSPECTION' || code === 'QC' || code === 'QUALITY') {
    return 'quality.queued';
  }
  if (code === 'PACKAGING' || code === 'PACK') return 'packaging.ready';
  return 'task.ready';
}

export function isPackagingStageCode(code: string | null | undefined): boolean {
  const c = String(code ?? '').toUpperCase();
  return c === 'PACKAGING' || c === 'PACK';
}
