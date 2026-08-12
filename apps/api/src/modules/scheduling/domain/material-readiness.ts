import type {
  BomDefaults,
  InventoryAvailability,
  InventoryKey,
  MaterialReadinessResult,
} from './types';

const KEYS: InventoryKey[] = ['fabricMeters', 'woodUnits', 'foamBlocks'];

function asBom(bomDefaults: BomDefaults | Record<string, unknown> | null | undefined): BomDefaults {
  if (!bomDefaults || typeof bomDefaults !== 'object') return {};
  const raw = bomDefaults as Record<string, unknown>;
  return {
    fabricMeters: typeof raw.fabricMeters === 'number' ? raw.fabricMeters : undefined,
    woodUnits: typeof raw.woodUnits === 'number' ? raw.woodUnits : undefined,
    foamBlocks: typeof raw.foamBlocks === 'number' ? raw.foamBlocks : undefined,
  };
}

/**
 * Inventory-only material readiness.
 * Never invents supplier ETAs — only uses known `readyAt` from the availability map.
 */
export function assessMaterialReadiness(
  bomDefaults: BomDefaults | Record<string, unknown> | null | undefined,
  inventory: Partial<Record<InventoryKey, InventoryAvailability>>,
): MaterialReadinessResult {
  const bom = asBom(bomDefaults);
  let ready = true;
  let risk = false;
  let materialReadyAt: Date | null = null;

  for (const key of KEYS) {
    const required = bom[key] ?? 0;
    if (required <= 0) continue;

    const avail = inventory[key];
    const onHand = avail?.available ?? 0;

    if (onHand >= required) continue;

    ready = false;
    const knownReady = avail?.readyAt ?? null;
    if (knownReady) {
      if (!materialReadyAt || knownReady.getTime() > materialReadyAt.getTime()) {
        materialReadyAt = knownReady;
      }
    } else {
      // Insufficient stock and no known replenishment date → risk, never invent a date
      risk = true;
      materialReadyAt = null;
      // Keep scanning to see if any other material also lacks a date; risk stays true.
    }
  }

  // If any shortfall lacked a readyAt, wipe invented aggregates
  if (risk) {
    return { ready: false, materialReadyAt: null, risk: true };
  }

  if (!ready && materialReadyAt) {
    return { ready: false, materialReadyAt, risk: false };
  }

  return { ready, materialReadyAt: ready ? null : materialReadyAt, risk };
}
