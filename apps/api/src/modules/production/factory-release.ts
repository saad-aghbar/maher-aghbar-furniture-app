/**
 * Release to factory — hard Preparing ↔ Production boundary.
 * Plan lock + Production visibility begin here; first task start moves Ready → In production.
 */

import { ProductionOrderStatus, type Prisma } from '@maher/database';

export type FactoryReleaseState = {
  releasedToFactoryAt: Date | string | null | undefined;
  status?: string | null;
  actualStartDate?: Date | string | null;
};

const LEGACY_FLOOR_STATUSES: ProductionOrderStatus[] = [
  ProductionOrderStatus.IN_PROGRESS,
  ProductionOrderStatus.ON_HOLD,
  ProductionOrderStatus.QUALITY_CHECK,
  ProductionOrderStatus.READY_FOR_PACKAGING,
  ProductionOrderStatus.READY_FOR_DELIVERY,
  ProductionOrderStatus.COMPLETED,
];

/** True once admin has Released to factory (plan locked; visible in Production). */
export function isReleasedToFactory(po: FactoryReleaseState): boolean {
  if (po.releasedToFactoryAt) return true;
  // Legacy: already on floor before the flag existed
  if (po.actualStartDate) return true;
  const status = String(po.status ?? '').toUpperCase();
  return LEGACY_FLOOR_STATUSES.some((s) => s === status);
}

/**
 * Production board bucket after release:
 * - ready_to_start = released, no executable work started yet
 * - on_floor / in_production = first real task start (IN_PROGRESS or actualStartDate)
 */
export function productionFactoryBucket(
  po: FactoryReleaseState,
): 'preparing' | 'ready_to_start' | 'in_production' {
  if (!isReleasedToFactory(po)) return 'preparing';
  const status = String(po.status ?? '').toUpperCase();
  if (
    status === 'IN_PROGRESS' ||
    status === 'ON_HOLD' ||
    status === 'QUALITY_CHECK' ||
    status === 'READY_FOR_PACKAGING' ||
    status === 'READY_FOR_DELIVERY' ||
    status === 'COMPLETED' ||
    Boolean(po.actualStartDate)
  ) {
    return 'in_production';
  }
  return 'ready_to_start';
}

/** Prisma filter: only POs that have crossed Release to factory (or legacy already on floor). */
export function releasedToFactoryWhere(): Prisma.ProductionOrderWhereInput {
  return {
    OR: [
      { releasedToFactoryAt: { not: null } },
      { actualStartDate: { not: null } },
      { status: { in: LEGACY_FLOOR_STATUSES } },
    ],
  };
}

/** Prisma filter: still in Orders Preparing (setup/plan; not factory-owned). */
export function unreleasedToFactoryWhere(): Prisma.ProductionOrderWhereInput {
  return {
    releasedToFactoryAt: null,
    actualStartDate: null,
    status: {
      in: [
        ProductionOrderStatus.DRAFT,
        ProductionOrderStatus.PLANNED,
        ProductionOrderStatus.READY,
        ProductionOrderStatus.WAITING_FOR_MATERIALS,
      ],
    },
  };
}
