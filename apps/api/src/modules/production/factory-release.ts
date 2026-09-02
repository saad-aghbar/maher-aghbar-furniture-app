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

/**
 * Next ProductionOrder.status after stage rollup.
 * Must NOT flip Confirm/release (READY, stages unlocked) into IN_PROGRESS —
 * that made every Confirm land in In production before any worker started.
 */
export function resolveProductionOrderRollupStatus(input: {
  allComplete: boolean;
  readyForDelivery: boolean;
  /** True when a stage/task has actually started (or order already has actualStartDate). */
  floorStarted: boolean;
  currentStatus: string | null | undefined;
  releasedToFactoryAt: Date | string | null | undefined;
}): ProductionOrderStatus {
  if (input.allComplete) return ProductionOrderStatus.COMPLETED;
  if (input.readyForDelivery) return ProductionOrderStatus.READY_FOR_DELIVERY;
  if (input.floorStarted) return ProductionOrderStatus.IN_PROGRESS;

  const current = String(input.currentStatus ?? '').toUpperCase();
  if (current === 'WAITING_FOR_MATERIALS') return ProductionOrderStatus.WAITING_FOR_MATERIALS;
  if (input.releasedToFactoryAt || current === 'READY') return ProductionOrderStatus.READY;
  if (current === 'DRAFT') return ProductionOrderStatus.DRAFT;
  if (current === 'PLANNED') return ProductionOrderStatus.PLANNED;
  if ((Object.values(ProductionOrderStatus) as string[]).includes(current)) {
    return current as ProductionOrderStatus;
  }
  return ProductionOrderStatus.PLANNED;
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
