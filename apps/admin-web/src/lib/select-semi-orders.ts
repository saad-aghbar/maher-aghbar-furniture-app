/** Admin parity with mobile `selectSemiOrdersFromBoard`. */

export type SemiOrderFilter = 'active' | 'history';

export type SemiKitFloorStatus =
  | 'at_station'
  | 'in_warehouse'
  | 'received'
  | 'used'
  | 'cancelled';

export type AdminWipKitCard = {
  id: string;
  status: string;
  qrCode: string;
  expectedPieceCount: number;
  custody?: string | null;
  handoffCount?: number;
  materialOverageNotes?: string | null;
  location?: { id: string; code: string; name?: string | null } | null;
  claimedByUser?: { firstName: string; lastName: string } | null;
  productionOrder: {
    id: string;
    number: string;
    productDescription: string;
    product?: {
      nameEn: string;
      nameAr: string;
      nameHe?: string | null;
      sku?: string | null;
      imageUrl?: string | null;
    } | null;
    salesOrder?: {
      number: string;
      customer?: {
        code?: string | null;
        name?: string | null;
        nameEn?: string | null;
        nameAr?: string | null;
      } | null;
    } | null;
  };
  stageInstance: {
    stageDefinition: {
      code: string;
      nameEn: string;
      nameAr: string;
      nameHe?: string | null;
    };
  };
  pieces: Array<{ id: string; label?: string | null; qrCode?: string | null }>;
};

export type WipKitBoardSection = {
  stageCode: string;
  stageNameEn: string;
  stageNameAr: string;
  stageNameHe: string | null;
  kits: AdminWipKitCard[];
};

export type SemiOrderGroup = {
  productionOrderId: string;
  number: string;
  salesOrderNumber: string | null;
  dealerName: string | null;
  productDescription: string;
  product: NonNullable<AdminWipKitCard['productionOrder']['product']> | null;
  kits: AdminWipKitCard[];
  primaryStage: {
    code: string;
    nameEn: string;
    nameAr: string;
    nameHe: string | null;
  } | null;
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

export function boardParamsForSemiFilter(
  filter: SemiOrderFilter,
  extras: { from?: string; to?: string; warehouseId?: string; q?: string } = {},
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

function kitSearchHay(kit: AdminWipKitCard): string {
  return [
    kit.productionOrder.number,
    kit.productionOrder.salesOrder?.number,
    kit.productionOrder.salesOrder?.customer?.nameEn,
    kit.productionOrder.salesOrder?.customer?.nameAr,
    kit.productionOrder.salesOrder?.customer?.name,
    kit.productionOrder.salesOrder?.customer?.code,
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

function dealerName(kit: AdminWipKitCard): string | null {
  const c = kit.productionOrder.salesOrder?.customer;
  if (!c) return null;
  return c.nameEn || c.name || c.nameAr || c.code || null;
}

function waitingForLabel(group: SemiOrderGroup): string {
  const { counts } = group;
  if (counts.inWarehouse > 0) return 'waiting_pickup';
  if (counts.received > 0) return 'at_receiver';
  if (counts.atStation > 0) return 'at_station';
  if (counts.used > 0) return 'used';
  return 'idle';
}

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
          salesOrderNumber: kit.productionOrder.salesOrder?.number ?? null,
          dealerName: dealerName(kit),
          productDescription: kit.productionOrder.productDescription,
          product: kit.productionOrder.product ?? null,
          kits: [],
          primaryStage: {
            code: kit.stageInstance.stageDefinition.code,
            nameEn: kit.stageInstance.stageDefinition.nameEn,
            nameAr: kit.stageInstance.stageDefinition.nameAr,
            nameHe: kit.stageInstance.stageDefinition.nameHe ?? null,
          },
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
      if (!group.dealerName) group.dealerName = dealerName(kit);
      if (!group.salesOrderNumber) {
        group.salesOrderNumber = kit.productionOrder.salesOrder?.number ?? null;
      }
      // Prefer READY / CLAIMED stage as primary display stage
      const floor = semiKitFloorStatus(kit);
      if (floor === 'in_warehouse' || floor === 'received') {
        group.primaryStage = {
          code: kit.stageInstance.stageDefinition.code,
          nameEn: kit.stageInstance.stageDefinition.nameEn,
          nameAr: kit.stageInstance.stageDefinition.nameAr,
          nameHe: kit.stageInstance.stageDefinition.nameHe ?? null,
        };
      }
    }
  }

  return orderSeq
    .map((id) => byOrder.get(id)!)
    .filter((g) => g.counts.total > 0);
}

export function custodyLabelKey(status: string): string {
  const floor = semiKitFloorStatus({ status });
  if (floor === 'in_warehouse') return 'semiCustodyWaitingPickup';
  if (floor === 'received') return 'semiCustodyReceived';
  if (floor === 'at_station') return 'semiCustodyAtStation';
  if (floor === 'used') return 'semiCustodyUsed';
  if (floor === 'cancelled') return 'semiCustodyCancelled';
  return 'semiCustodyUnknown';
}

export function waitingForKey(group: SemiOrderGroup): string {
  return waitingForLabel(group);
}
