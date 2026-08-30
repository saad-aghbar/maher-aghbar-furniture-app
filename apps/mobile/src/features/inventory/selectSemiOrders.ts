import type { WipKitBoardSection, WipKitCard } from '@/api/modules/inventory';

export type SemiOrderFilter = 'active' | 'history';

/** Plain-language floor status for a WIP kit (replaces custody chips). */
export type SemiKitFloorStatus =
  | 'at_station'
  | 'in_warehouse'
  | 'received'
  | 'used'
  | 'cancelled';

export type SemiOrderGroup = {
  productionOrderId: string;
  number: string;
  productDescription: string;
  product: NonNullable<WipKitCard['productionOrder']['product']> | null;
  kits: WipKitCard[];
  counts: {
    total: number;
    active: number;
    atStation: number;
    inWarehouse: number;
    received: number;
    used: number;
    cancelled: number;
  };
};

export function isSemiKitActive(status: string): boolean {
  const s = String(status ?? '').toUpperCase();
  return s !== 'CONSUMED' && s !== 'CANCELLED';
}

export function semiKitFloorStatus(kit: { status: string }): SemiKitFloorStatus {
  const s = String(kit.status ?? '').toUpperCase();
  if (s === 'OPEN') return 'at_station';
  if (s === 'READY') return 'in_warehouse';
  if (s === 'CLAIMED') return 'received';
  if (s === 'CONSUMED') return 'used';
  if (s === 'CANCELLED') return 'cancelled';
  return 'at_station';
}

/** Query params for Active vs History SEMI board (API presence + warehouse + q). */
export function boardParamsForSemiFilter(
  filter: SemiOrderFilter,
  extras: {
    from?: string;
    to?: string;
    warehouseId?: string;
    q?: string;
  } = {},
): {
  scope?: 'active' | 'history';
  from?: string;
  to?: string;
  warehouseId?: string;
  q?: string;
} {
  if (filter === 'history') {
    return {
      scope: 'history',
      from: extras.from,
      to: extras.to,
      warehouseId: extras.warehouseId,
      q: extras.q,
    };
  }
  return {
    scope: 'active',
    warehouseId: extras.warehouseId,
    q: extras.q,
  };
}

function kitSearchHay(kit: WipKitCard): string {
  return [
    kit.productionOrder.number,
    kit.qrCode,
    kit.productionOrder.productDescription,
    kit.productionOrder.product?.nameEn,
    kit.productionOrder.product?.nameAr,
    kit.productionOrder.product?.nameHe,
    kit.stageInstance.stageDefinition.code,
    kit.stageInstance.stageDefinition.nameEn,
    kit.stageInstance.stageDefinition.nameAr,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function emptyCounts(): SemiOrderGroup['counts'] {
  return {
    total: 0,
    active: 0,
    atStation: 0,
    inWarehouse: 0,
    received: 0,
    used: 0,
    cancelled: 0,
  };
}

function bumpCounts(counts: SemiOrderGroup['counts'], status: SemiKitFloorStatus) {
  counts.total += 1;
  if (status === 'at_station') counts.atStation += 1;
  else if (status === 'in_warehouse') counts.inWarehouse += 1;
  else if (status === 'received') counts.received += 1;
  else if (status === 'used') counts.used += 1;
  else if (status === 'cancelled') counts.cancelled += 1;
  if (status !== 'used' && status !== 'cancelled') counts.active += 1;
}

/**
 * Flatten board sections → one card per production order with progress counts.
 * Active = kits that are not CONSUMED/CANCELLED (and drops empty orders after filter).
 * History = include all kits returned by the presence-scoped API.
 */
export function selectSemiOrdersFromBoard(
  sections: WipKitBoardSection[],
  opts: { filter?: SemiOrderFilter; q?: string } = {},
): SemiOrderGroup[] {
  const filter = opts.filter ?? 'active';
  const needle = String(opts.q ?? '')
    .trim()
    .toLowerCase();

  const byOrder = new Map<string, SemiOrderGroup>();
  const orderSeq: string[] = [];

  for (const section of sections) {
    for (const kit of section.kits) {
      const orderId = kit.productionOrder.id;
      if (!orderId) continue;
      if (filter === 'active' && !isSemiKitActive(kit.status)) continue;
      if (needle && !kitSearchHay(kit).includes(needle)) continue;

      let group = byOrder.get(orderId);
      if (!group) {
        group = {
          productionOrderId: orderId,
          number: kit.productionOrder.number,
          productDescription: kit.productionOrder.productDescription,
          product: kit.productionOrder.product ?? null,
          kits: [],
          counts: emptyCounts(),
        };
        byOrder.set(orderId, group);
        orderSeq.push(orderId);
      }
      group.kits.push(kit);
      bumpCounts(group.counts, semiKitFloorStatus(kit));
      if (!group.product && kit.productionOrder.product) {
        group.product = kit.productionOrder.product;
      }
    }
  }

  return orderSeq
    .map((id) => byOrder.get(id)!)
    .filter((g) => g.counts.total > 0);
}

export type SemiOrderStageSection = {
  stageCode: string;
  stageNameEn: string;
  stageNameAr: string;
  stageNameHe: string | null;
  kits: WipKitCard[];
};

/** Board sections for one order, dropping empty stages after Active filter. */
export function selectSemiOrderStageSections(
  sections: WipKitBoardSection[],
  opts: { filter?: SemiOrderFilter; q?: string } = {},
): SemiOrderStageSection[] {
  const filter = opts.filter ?? 'active';
  const needle = String(opts.q ?? '')
    .trim()
    .toLowerCase();

  return sections
    .map((section) => ({
      stageCode: section.stageCode,
      stageNameEn: section.stageNameEn,
      stageNameAr: section.stageNameAr,
      stageNameHe: section.stageNameHe,
      kits: section.kits.filter((kit) => {
        if (filter === 'active' && !isSemiKitActive(kit.status)) return false;
        if (needle && !kitSearchHay(kit).includes(needle)) return false;
        return true;
      }),
    }))
    .filter((s) => s.kits.length > 0);
}
