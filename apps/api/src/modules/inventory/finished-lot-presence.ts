/** Presence window for finished-lot history (entered … left). */

export type LotLeftAtInput = {
  status: string;
  inventoryItemId: string;
  productionOrderId?: string | null;
  salesOrder?: { deliveries?: Array<{ id: string }> | null } | null;
};

export function indexDeliveryIssueLeftAt(
  txs: Array<{ referenceId?: string | null; inventoryItemId: string; createdAt: Date }>,
): {
  leftAtByDelivery: Map<string, Date>;
  leftAtByItemPo: Map<string, Date>;
} {
  const leftAtByItemPo = new Map<string, Date>();
  const leftAtByDelivery = new Map<string, Date>();
  for (const tx of txs) {
    if (!tx.referenceId) continue;
    const itemPoKey = `${tx.inventoryItemId}:${tx.referenceId}`;
    if (!leftAtByItemPo.has(itemPoKey)) leftAtByItemPo.set(itemPoKey, tx.createdAt);
    const prev = leftAtByDelivery.get(tx.referenceId);
    if (!prev || tx.createdAt > prev) leftAtByDelivery.set(tx.referenceId, tx.createdAt);
  }
  return { leftAtByDelivery, leftAtByItemPo };
}

export function resolveLotLeftAt(
  lot: LotLeftAtInput,
  leftAtByDelivery: Map<string, Date>,
  leftAtByItemPo: Map<string, Date>,
): Date | null {
  if (lot.status !== 'DELIVERED') return null;
  let leftAt: Date | null = null;
  for (const d of lot.salesOrder?.deliveries ?? []) {
    const t = leftAtByDelivery.get(d.id);
    if (t && (!leftAt || t > leftAt)) leftAt = t;
  }
  if (!leftAt && lot.productionOrderId) {
    leftAt = leftAtByItemPo.get(`${lot.inventoryItemId}:${lot.productionOrderId}`) ?? null;
  }
  return leftAt;
}

/** Keep lots whose warehouse presence overlaps [fromStart, toEnd]. */
export function lotOverlapsHistoryWindow(
  enteredAt: Date,
  leftAt: Date | null,
  fromStart: Date,
  toEnd: Date,
): boolean {
  if (enteredAt > toEnd) return false;
  if (leftAt && leftAt < fromStart) return false;
  return true;
}
