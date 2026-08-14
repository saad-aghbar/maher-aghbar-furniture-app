export const STAGE_INVENTORY_BEHAVIORS = [
  'NONE',
  'USES_MATERIALS',
  'PRODUCES_SEMI_FINISHED',
  'USES_SEMI_FINISHED',
  'USES_AND_PRODUCES',
  'PRODUCES_FINISHED',
] as const;

export type StageInventoryBehavior = (typeof STAGE_INVENTORY_BEHAVIORS)[number];

export type InventoryTrackingValue = 'NONE' | 'PRODUCES_SEMI_FINISHED' | 'PRODUCES_FINISHED';

export type StageInventoryFlags = {
  inventoryTracking: InventoryTrackingValue;
  consumesRawMaterials: boolean;
  consumesSemiFinished: boolean;
};

export function isStageInventoryBehavior(value: unknown): value is StageInventoryBehavior {
  return (
    typeof value === 'string' &&
    (STAGE_INVENTORY_BEHAVIORS as readonly string[]).includes(value)
  );
}

/**
 * Maps Admin UI choices onto persisted tracking/consume flags.
 * Optional raw consume is an extra checkbox on produce behaviors.
 */
export function flagsFromBehavior(
  behavior: StageInventoryBehavior,
  consumesRawMaterials?: boolean,
): StageInventoryFlags {
  switch (behavior) {
    case 'USES_MATERIALS':
      return {
        inventoryTracking: 'NONE',
        consumesRawMaterials: true,
        consumesSemiFinished: false,
      };
    case 'PRODUCES_SEMI_FINISHED':
      return {
        inventoryTracking: 'PRODUCES_SEMI_FINISHED',
        consumesRawMaterials: Boolean(consumesRawMaterials),
        consumesSemiFinished: false,
      };
    case 'USES_SEMI_FINISHED':
      return {
        inventoryTracking: 'NONE',
        consumesRawMaterials: false,
        consumesSemiFinished: true,
      };
    case 'USES_AND_PRODUCES':
      return {
        inventoryTracking: 'PRODUCES_SEMI_FINISHED',
        consumesRawMaterials: Boolean(consumesRawMaterials),
        consumesSemiFinished: true,
      };
    case 'PRODUCES_FINISHED':
      return {
        inventoryTracking: 'PRODUCES_FINISHED',
        consumesRawMaterials: Boolean(consumesRawMaterials),
        consumesSemiFinished: false,
      };
    case 'NONE':
    default:
      return {
        inventoryTracking: 'NONE',
        consumesRawMaterials: false,
        consumesSemiFinished: false,
      };
  }
}

/** Finished-product behavior may also consume WIP; pass consumeSemi explicitly. */
export function flagsFromBehaviorWithConsume(
  behavior: StageInventoryBehavior,
  extras?: { consumesRawMaterials?: boolean; consumesSemiFinished?: boolean },
): StageInventoryFlags {
  const base = flagsFromBehavior(behavior, extras?.consumesRawMaterials);
  if (behavior === 'PRODUCES_FINISHED') {
    return {
      ...base,
      consumesRawMaterials: Boolean(extras?.consumesRawMaterials),
      consumesSemiFinished: Boolean(extras?.consumesSemiFinished),
    };
  }
  if (behavior === 'USES_AND_PRODUCES' || behavior === 'PRODUCES_SEMI_FINISHED') {
    return {
      ...base,
      consumesRawMaterials: Boolean(extras?.consumesRawMaterials),
    };
  }
  return base;
}

export function behaviorFromFlags(flags: StageInventoryFlags): StageInventoryBehavior {
  const tracking = flags.inventoryTracking ?? 'NONE';
  const raw = Boolean(flags.consumesRawMaterials);
  const semi = Boolean(flags.consumesSemiFinished);
  if (tracking === 'PRODUCES_FINISHED') return 'PRODUCES_FINISHED';
  if (tracking === 'PRODUCES_SEMI_FINISHED' && semi) return 'USES_AND_PRODUCES';
  if (tracking === 'PRODUCES_SEMI_FINISHED') return 'PRODUCES_SEMI_FINISHED';
  if (semi) return 'USES_SEMI_FINISHED';
  if (raw) return 'USES_MATERIALS';
  return 'NONE';
}

export function behaviorProduces(behavior: StageInventoryBehavior): boolean {
  return (
    behavior === 'PRODUCES_SEMI_FINISHED' ||
    behavior === 'USES_AND_PRODUCES' ||
    behavior === 'PRODUCES_FINISHED'
  );
}

export function itemClassForBehavior(behavior: StageInventoryBehavior) {
  if (behavior === 'PRODUCES_FINISHED') return 'FINISHED_GOOD' as const;
  if (behavior === 'PRODUCES_SEMI_FINISHED' || behavior === 'USES_AND_PRODUCES') {
    return 'SEMI_FINISHED_GOOD' as const;
  }
  return 'RAW_MATERIAL' as const;
}

export function jsonIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}
