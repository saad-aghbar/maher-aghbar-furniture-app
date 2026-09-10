import type { Prisma } from '@maher/database';

export type ProductionOriginLabel = 'RETURN WORK' | 'REPLACEMENT' | 'RETURN RECOVERY';

export const RETURN_QUARANTINE_PREFIX = 'return-quarantine:';
export const RETURN_PIECE_QUARANTINE_PREFIX = 'return-piece-quarantine:';
export const RETURN_ORIGIN_TYPES = ['RETURN_WORK', 'REPLACEMENT', 'RETURN_RECOVERY'] as const;

export const PRODUCTION_RETURN_REQUEST_SELECT = {
  id: true,
  number: true,
  lifecycleState: true,
  salesOrder: { select: { id: true, number: true } },
} as const;

const TERMINAL_RETURN_LIFECYCLES = new Set([
  'COMPLETED',
  'REJECTED',
  // Restock / scrap close the return. Leftover intermediate rows must not
  // keep hasPendingReturn true after the factory fate is posted.
  'RETURNED_TO_STOCK',
  'SCRAPPED',
]);

export function isPendingReturnLifecycle(state: string | null | undefined): boolean {
  if (!state) return false;
  return !TERMINAL_RETURN_LIFECYCLES.has(String(state).toUpperCase());
}

export function returnIdFromQuarantineSourceKey(
  sourceKey: string | null | undefined,
): string | null {
  if (!sourceKey?.startsWith(RETURN_QUARANTINE_PREFIX)) return null;
  const id = sourceKey.slice(RETURN_QUARANTINE_PREFIX.length).trim();
  return id || null;
}

export function pieceIdFromQuarantineSourceKey(
  sourceKey: string | null | undefined,
): string | null {
  if (!sourceKey?.startsWith(RETURN_PIECE_QUARANTINE_PREFIX)) return null;
  const id = sourceKey.slice(RETURN_PIECE_QUARANTINE_PREFIX.length).trim();
  return id || null;
}

export function returnQuarantineSourceKey(opts: {
  returnId?: string | null;
  pieceId?: string | null;
}): string | null {
  if (opts.pieceId) return `${RETURN_PIECE_QUARANTINE_PREFIX}${opts.pieceId}`;
  if (opts.returnId) return `${RETURN_QUARANTINE_PREFIX}${opts.returnId}`;
  return null;
}

export function productionOriginLabel(
  originType: string | null | undefined,
): ProductionOriginLabel | null {
  if (originType === 'RETURN_WORK') return 'RETURN WORK';
  if (originType === 'REPLACEMENT') return 'REPLACEMENT';
  if (originType === 'RETURN_RECOVERY') return 'RETURN RECOVERY';
  return null;
}

export function returnWorkKind(
  originType: string | null | undefined,
): 'RETURN_WORK' | 'REPLACEMENT' | 'RETURN_RECOVERY' {
  if (originType === 'REPLACEMENT') return 'REPLACEMENT';
  if (originType === 'RETURN_RECOVERY') return 'RETURN_RECOVERY';
  return 'RETURN_WORK';
}

export function isReturnOriginType(originType: string | null | undefined): boolean {
  return originType === 'RETURN_WORK' || originType === 'REPLACEMENT' || originType === 'RETURN_RECOVERY';
}

/** Return / internal POs have no sales-order line setup — plan save must not require one. */
export function planAllowsWithoutLineSetup(po: {
  originType?: string | null;
  returnRequestId?: string | null;
}): boolean {
  return (
    isReturnOriginType(po.originType) ||
    po.originType === 'INTERNAL' ||
    Boolean(po.returnRequestId)
  );
}

export type ProductionOriginFilter = 'normal' | 'returned';

export function parseProductionOrigin(
  value: string | null | undefined,
): ProductionOriginFilter | undefined {
  if (value === 'normal' || value === 'returned') return value;
  return undefined;
}

/** Prisma clause so Normal / Returned list counts stay aligned. */
export function productionOriginWhere(
  origin?: ProductionOriginFilter | null,
): { originType: { in: Array<'RETURN_WORK' | 'REPLACEMENT' | 'RETURN_RECOVERY'> } } | { originType: { notIn: Array<'RETURN_WORK' | 'REPLACEMENT' | 'RETURN_RECOVERY'> } } | undefined {
  if (origin === 'returned') {
    return { originType: { in: ['RETURN_WORK', 'REPLACEMENT', 'RETURN_RECOVERY'] } };
  }
  if (origin === 'normal') {
    return { originType: { notIn: ['RETURN_WORK', 'REPLACEMENT', 'RETURN_RECOVERY'] } };
  }
  return undefined;
}

/** Return-work POs plus customer-return quarantine lots (restock / scrap). */
export function returnedLotOr(): Prisma.InventoryLotWhereInput[] {
  return [
    { productionOrder: { originType: { in: [...RETURN_ORIGIN_TYPES] } } },
    { sourceKey: { startsWith: RETURN_QUARANTINE_PREFIX } },
    { sourceKey: { startsWith: RETURN_PIECE_QUARANTINE_PREFIX } },
  ];
}

export function inventoryLotOriginWhere(
  origin?: ProductionOriginFilter | null,
): Prisma.InventoryLotWhereInput | undefined {
  if (origin === 'returned') {
    return { OR: returnedLotOr() };
  }
  if (origin === 'normal') {
    return { NOT: { OR: returnedLotOr() } };
  }
  return undefined;
}
