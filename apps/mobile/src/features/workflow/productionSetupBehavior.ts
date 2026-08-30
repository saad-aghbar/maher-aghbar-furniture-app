import type { ProductionSetupBehavior } from '@/api/modules/workflow';

export type StageProduceKind = 'none' | 'semi' | 'finished';

export type TerminalSetupMode = 'inspection' | 'packaging' | 'delivery' | 'production';

/** Independent I/O toggles → persisted setup behavior enum. */
export function deriveSetupBehavior(opts: {
  consumeRaw: boolean;
  consumeSemi: boolean;
  produce: StageProduceKind;
}): ProductionSetupBehavior {
  if (opts.produce === 'finished') return 'PRODUCES_FINISHED';
  if (opts.produce === 'semi' && opts.consumeSemi) return 'USES_AND_PRODUCES';
  if (opts.produce === 'semi') return 'PRODUCES_SEMI_FINISHED';
  if (opts.consumeSemi) return 'USES_SEMI_FINISHED';
  if (opts.consumeRaw) return 'USES_MATERIALS';
  return 'NONE';
}

export function produceKindFromBehavior(behavior: ProductionSetupBehavior): StageProduceKind {
  if (behavior === 'PRODUCES_FINISHED') return 'finished';
  if (behavior === 'PRODUCES_SEMI_FINISHED' || behavior === 'USES_AND_PRODUCES') return 'semi';
  return 'none';
}

export function setupProduces(behavior: ProductionSetupBehavior): boolean {
  return (
    behavior === 'PRODUCES_SEMI_FINISHED' ||
    behavior === 'USES_AND_PRODUCES' ||
    behavior === 'PRODUCES_FINISHED'
  );
}

export function setupUsesSemi(behavior: ProductionSetupBehavior): boolean {
  return behavior === 'USES_SEMI_FINISHED' || behavior === 'USES_AND_PRODUCES';
}

export function isPackagingSetupStage(stageCode?: string | null): boolean {
  const c = String(stageCode ?? '').toUpperCase();
  return c === 'PACKAGING' || c === 'PACK';
}

export function isInspectionSetupStage(stageCode?: string | null): boolean {
  return String(stageCode ?? '').toUpperCase() === 'INSPECTION';
}

export function isDeliverySetupStage(stageCode?: string | null): boolean {
  return String(stageCode ?? '').toUpperCase() === 'DELIVERY';
}

/** Terminal trio vs middle production stages — drives setup sheet boards. */
export function terminalSetupMode(stageCode?: string | null): TerminalSetupMode {
  if (isInspectionSetupStage(stageCode)) return 'inspection';
  if (isPackagingSetupStage(stageCode)) return 'packaging';
  if (isDeliverySetupStage(stageCode)) return 'delivery';
  return 'production';
}

/**
 * Coerce produce kind for stage role:
 * - Packaging → finished only (never SEMI)
 * - Inspection / Delivery → never produce stocked output
 * - Other stages → SEMI only (never finished)
 */
export function coerceSetupProduceKind(
  kind: StageProduceKind,
  stageCode?: string | null,
): StageProduceKind {
  const mode = terminalSetupMode(stageCode);
  if (mode === 'inspection' || mode === 'delivery') return 'none';
  if (mode === 'packaging') {
    return 'finished';
  }
  return kind === 'finished' ? 'semi' : kind;
}
