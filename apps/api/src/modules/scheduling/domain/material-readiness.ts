import type {
  BomDefaults,
  IncomingSupply,
  InventoryAvailability,
  InventoryKey,
  MaterialReadinessResult,
  PlannerStageInput,
} from './types';

const KEYS: InventoryKey[] = ['fabricMeters', 'woodUnits', 'foamBlocks'];

export function inventorySkuKey(sku: string): string {
  return `sku:${sku.trim()}`;
}

export function inventoryGroupKey(group: string | null | undefined): InventoryKey | null {
  const g = String(group ?? '').trim().toUpperCase();
  if (g === 'FABRIC') return 'fabricMeters';
  if (g === 'WOOD') return 'woodUnits';
  if (g === 'FOAM') return 'foamBlocks';
  return null;
}

export function requirementFromNeeds(
  needs: Array<{ sku?: string; qty: number; category?: string }>,
): Record<string, number> {
  const required: Record<string, number> = {};
  for (const need of needs) {
    const key = need.sku?.trim()
      ? inventorySkuKey(need.sku)
      : inventoryGroupKey(need.category);
    if (!key || !(need.qty > 0)) continue;
    required[key] = (required[key] ?? 0) + need.qty;
  }
  return required;
}

function asBom(bomDefaults: BomDefaults | Record<string, unknown> | null | undefined): BomDefaults {
  if (!bomDefaults || typeof bomDefaults !== 'object') return {};
  const raw = bomDefaults as Record<string, unknown>;
  return {
    fabricMeters: typeof raw.fabricMeters === 'number' ? raw.fabricMeters : undefined,
    woodUnits: typeof raw.woodUnits === 'number' ? raw.woodUnits : undefined,
    foamBlocks: typeof raw.foamBlocks === 'number' ? raw.foamBlocks : undefined,
  };
}

function normalizeRequired(
  input: BomDefaults | Record<string, number> | null | undefined,
): Record<string, number> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, number> = {};
  const bom = asBom(input);
  for (const key of KEYS) {
    const qty = bom[key] ?? 0;
    if (qty > 0) out[key] = qty;
  }
  for (const [key, value] of Object.entries(input)) {
    if ((KEYS as string[]).includes(key)) continue;
    if (typeof value === 'number' && value > 0) out[key] = value;
  }
  return out;
}

function datedIncoming(avail?: InventoryAvailability): IncomingSupply[] {
  const rows = (avail?.incoming ?? []).filter(
    (row) =>
      row.qty > 0 &&
      row.readyAt instanceof Date &&
      !Number.isNaN(row.readyAt.getTime()),
  );
  if (rows.length) return rows;
  if (avail?.readyAt instanceof Date && !Number.isNaN(avail.readyAt.getTime())) {
    return [{ qty: Number.POSITIVE_INFINITY, readyAt: avail.readyAt }];
  }
  return [];
}

export type CoverDeficitResult = {
  readyAt: Date | null;
  unknown: boolean;
};

/**
 * Cover `required - available` from dated incoming only.
 * Never invents dates. Undated incoming does not cover.
 */
export function coverDeficit(
  required: number,
  available: number,
  incoming: Array<{ qty: number; readyAt?: Date | null }>,
): CoverDeficitResult {
  const deficit = required - available;
  if (!(required > 0) || deficit <= 0) {
    return { readyAt: null, unknown: false };
  }
  const dated = incoming
    .filter(
      (row): row is { qty: number; readyAt: Date } =>
        row.qty > 0 && row.readyAt instanceof Date && !Number.isNaN(row.readyAt.getTime()),
    )
    .sort((a, b) => a.readyAt.getTime() - b.readyAt.getTime());
  let remaining = deficit;
  let last: Date | null = null;
  for (const lot of dated) {
    remaining -= lot.qty;
    last = lot.readyAt;
    if (remaining <= 1e-9) {
      return { readyAt: last, unknown: false };
    }
  }
  return { readyAt: last, unknown: true };
}

/**
 * Inventory-only material readiness.
 * Never invents supplier ETAs — only uses known dated incoming / `readyAt`.
 */
export function assessMaterialReadiness(
  bomDefaults: BomDefaults | Record<string, number> | Record<string, unknown> | null | undefined,
  inventory: Partial<Record<string, InventoryAvailability>>,
): MaterialReadinessResult {
  const required = normalizeRequired(bomDefaults as BomDefaults | Record<string, number> | null);
  let ready = true;
  let materialReadyAt: Date | null = null;

  for (const [key, need] of Object.entries(required)) {
    if (!(need > 0)) continue;
    const avail = inventory[key];
    const onHand = avail?.available ?? 0;
    if (onHand + 1e-9 >= need) continue;

    ready = false;
    const cover = coverDeficit(need, onHand, datedIncoming(avail));
    if (cover.unknown) {
      return { ready: false, materialReadyAt: null, risk: true };
    }
    if (cover.readyAt && (!materialReadyAt || cover.readyAt.getTime() > materialReadyAt.getTime())) {
      materialReadyAt = cover.readyAt;
    }
  }

  if (!ready && materialReadyAt) {
    return { ready: false, materialReadyAt, risk: false };
  }

  return { ready, materialReadyAt: ready ? null : materialReadyAt, risk: !ready && !materialReadyAt };
}

function later(a?: Date | null, b?: Date | null): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

/**
 * Apply known materialReadyAt as stage.notBefore on raw-consuming nodes.
 * If none are flagged, keep the order-level floor. Does not invent SKU→stage maps.
 */
export function applyMaterialNotBefore(
  stages: PlannerStageInput[],
  materialReadyAt: Date | null,
  consumingStageCodes: string[],
): { stages: PlannerStageInput[]; orderMaterialReadyAt: Date | null } {
  if (!materialReadyAt) {
    return { stages, orderMaterialReadyAt: null };
  }
  const present = new Set(stages.map((s) => s.code));
  const consume = new Set(consumingStageCodes.filter((code) => present.has(code)));
  if (consume.size === 0) {
    return { stages, orderMaterialReadyAt: materialReadyAt };
  }
  return {
    stages: stages.map((stage) =>
      consume.has(stage.code)
        ? { ...stage, notBefore: later(stage.notBefore, materialReadyAt) }
        : stage,
    ),
    orderMaterialReadyAt: null,
  };
}
