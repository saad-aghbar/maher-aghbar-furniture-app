/**
 * ONE shared server predicate source for Production board buckets.
 * Used by ProductionService.list AND ReportsService.productionSummary.
 *
 * Lane twin mapping:
 *   needs_setup          ↔ Orders Preparing (Needs Planning)
 *   ready_to_start       ↔ Orders Ready to Start (Ready for Factory)
 *   on_floor             ↔ Orders In Production
 *   blocked              ↔ Attention
 *   inspection_packaging ↔ Quality & Pack
 *
 * In Production is NEVER implied by plannedStartDate — only by floor start
 * (status / actualStartDate set when an executable task actually starts).
 */

import { ProductionOrderStatus, type Prisma } from '@maher/database';
import { releasedToFactoryWhere, unreleasedToFactoryWhere } from './factory-release';

/** Executable floor task missing an assignee (excludes logistics/delivery/rework). */
export const UNASSIGNED_EXECUTABLE: Prisma.ProductionTaskWhereInput = {
  assignedEmployeeId: null,
  status: { not: 'CANCELLED' },
  isRework: false,
  stageDefinition: {
    executionKind: { not: 'LOGISTICS' },
    code: { not: 'DELIVERY' },
  },
};

export const HAS_EXECUTABLE: Prisma.ProductionTaskWhereInput = {
  status: { not: 'CANCELLED' },
  isRework: false,
  stageDefinition: {
    executionKind: { not: 'LOGISTICS' },
    code: { not: 'DELIVERY' },
  },
};

/** Executable floor task missing planned timing (no end, or start without end). */
export const UNDATED_EXECUTABLE: Prisma.ProductionTaskWhereInput = {
  status: { not: 'CANCELLED' },
  isRework: false,
  stageDefinition: {
    executionKind: { not: 'LOGISTICS' },
    code: { not: 'DELIVERY' },
  },
  OR: [
    { plannedStart: null, plannedCompletion: null },
    { plannedStart: { not: null }, plannedCompletion: null },
  ],
};

export const OPEN_BLOCKER_ON_TASK: Prisma.ProductionTaskWhereInput = {
  blockers: { some: { resolvedAt: null } },
};

export type ProductionBoardBucketKey =
  | 'needs_setup'
  | 'ready_to_start'
  | 'on_floor'
  | 'blocked'
  | 'inspection_packaging';

/**
 * Exact Prisma where for a Production board bucket (without archivedAt / customer scope).
 * Summary COUNT and list query MUST use this same function.
 */
export function productionBoardBucketWhere(
  bucket: ProductionBoardBucketKey,
  now: Date = new Date(),
): Prisma.ProductionOrderWhereInput {
  const factoryOnly = releasedToFactoryWhere();

  switch (bucket) {
    case 'needs_setup':
      // Needs Planning = Orders Preparing (unreleased plan work).
      return unreleasedToFactoryWhere();

    case 'ready_to_start':
      // Ready for Factory = released + locked plan + no floor start yet.
      // Planned start date arriving does NOT remove a row from this bucket.
      return {
        AND: [
          factoryOnly,
          {
            status: {
              in: [
                ProductionOrderStatus.DRAFT,
                ProductionOrderStatus.PLANNED,
                ProductionOrderStatus.READY,
              ],
            },
            actualStartDate: null,
            tasks: { some: HAS_EXECUTABLE },
            NOT: {
              OR: [
                { tasks: { some: UNASSIGNED_EXECUTABLE } },
                { tasks: { some: UNDATED_EXECUTABLE } },
              ],
            },
          },
        ],
      };

    case 'on_floor':
      // In Production = first real executable work started (status IN_PROGRESS).
      return {
        AND: [
          factoryOnly,
          {
            status: ProductionOrderStatus.IN_PROGRESS,
            OR: [
              { currentStageCode: null },
              {
                currentStageCode: {
                  notIn: ['INSPECTION', 'PACKAGING', 'DELIVERY'],
                },
              },
            ],
          },
        ],
      };

    case 'blocked':
      return {
        AND: [
          factoryOnly,
          {
            OR: [
              {
                status: {
                  in: [
                    ProductionOrderStatus.ON_HOLD,
                    ProductionOrderStatus.WAITING_FOR_MATERIALS,
                  ],
                },
              },
              {
                status: {
                  notIn: [
                    ProductionOrderStatus.COMPLETED,
                    ProductionOrderStatus.CANCELLED,
                  ],
                },
                tasks: { some: OPEN_BLOCKER_ON_TASK },
              },
              {
                requiredDeliveryDate: { lt: now },
                status: {
                  notIn: [
                    ProductionOrderStatus.COMPLETED,
                    ProductionOrderStatus.CANCELLED,
                    ProductionOrderStatus.READY_FOR_DELIVERY,
                  ],
                },
              },
            ],
          },
        ],
      };

    case 'inspection_packaging':
      return {
        AND: [
          factoryOnly,
          {
            OR: [
              {
                status: {
                  in: [
                    ProductionOrderStatus.QUALITY_CHECK,
                    ProductionOrderStatus.READY_FOR_PACKAGING,
                  ],
                },
              },
              {
                status: ProductionOrderStatus.IN_PROGRESS,
                currentStageCode: { in: ['INSPECTION', 'PACKAGING'] },
              },
            ],
          },
        ],
      };

    default: {
      const _exhaustive: never = bucket;
      return _exhaustive;
    }
  }
}

/** Count/list base: archivedAt null + bucket predicate. */
export function productionBoardBucketCountWhere(
  bucket: ProductionBoardBucketKey,
  now: Date = new Date(),
): Prisma.ProductionOrderWhereInput {
  return {
    archivedAt: null,
    ...productionBoardBucketWhere(bucket, now),
  };
}
