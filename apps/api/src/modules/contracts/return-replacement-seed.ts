import type { Prisma } from '@maher/database';
import { ensureFabricProcurementsForProductionOrder } from '../production/ensure-fabric-procurements';
import { roundMoney } from '../../common/helpers/money.util';

type Db = Prisma.TransactionClient;

export type ReplacementSeedSnapshot = {
  productId?: string | null;
  variantId?: string | null;
  variantSku?: string | null;
  variantLabel?: string | null;
  description?: string | null;
  specifications?: string | null;
  orderSpec?: unknown;
  manufacturingComplexity?: string | null;
  catalogDimensions?: unknown;
  orderDimensions?: unknown;
  measurements?: unknown;
  workflowId?: string | null;
  factoryNotes?: string | null;
  packagingExpectation?: unknown;
  materials?: Array<{
    inventoryItemId?: string | null;
    sku?: string | null;
    displayName?: string | null;
    category?: string | null;
    expectedQty?: number | string | { toString(): string } | null;
    unit?: string | null;
    requestedFabricLabel?: string | null;
    stageCode?: string | null;
    fabricRole?: string | null;
    fabricSelectionKey?: string | null;
    notes?: string | null;
  }>;
};

export function specSnapshotFromLine(line: {
  productId?: string | null;
  variantId?: string | null;
  variantSku?: string | null;
  variantLabel?: string | null;
  description?: string | null;
  specifications?: string | null;
  orderSpec?: unknown;
  manufacturingComplexity?: string | null;
  productionSetup?: {
    catalogDimensions?: unknown;
    orderDimensions?: unknown;
    measurements?: unknown;
    workflowId?: string | null;
    factoryNotes?: string | null;
    packagingExpectation?: unknown;
    materialRequirements?: Array<Record<string, unknown>>;
  } | null;
}): ReplacementSeedSnapshot {
  const setup = line.productionSetup ?? null;
  return {
    productId: line.productId ?? null,
    variantId: line.variantId ?? null,
    variantSku: line.variantSku ?? null,
    variantLabel: line.variantLabel ?? null,
    description: line.description ?? null,
    specifications: line.specifications ?? null,
    orderSpec: line.orderSpec ?? null,
    manufacturingComplexity: line.manufacturingComplexity ?? null,
    catalogDimensions: setup?.catalogDimensions ?? null,
    orderDimensions: setup?.orderDimensions ?? null,
    measurements: setup?.measurements ?? null,
    workflowId: setup?.workflowId ?? null,
    factoryNotes: setup?.factoryNotes ?? null,
    packagingExpectation: setup?.packagingExpectation ?? null,
    materials: (setup?.materialRequirements ?? []).map((row) => ({
      inventoryItemId: (row.inventoryItemId as string | null | undefined) ?? null,
      sku: (row.sku as string | null | undefined) ?? null,
      displayName: (row.displayName as string | null | undefined) ?? null,
      category: (row.category as string | null | undefined) ?? null,
      expectedQty: row.expectedQty != null ? Number(row.expectedQty) : null,
      unit: (row.unit as string | null | undefined) ?? null,
      requestedFabricLabel: (row.requestedFabricLabel as string | null | undefined) ?? null,
      stageCode: (row.stageCode as string | null | undefined) ?? null,
      fabricRole: (row.fabricRole as string | null | undefined) ?? null,
      fabricSelectionKey: (row.fabricSelectionKey as string | null | undefined) ?? null,
      notes: (row.notes as string | null | undefined) ?? null,
    })),
  };
}

export function specificationsFromSnapshot(snapshot: ReplacementSeedSnapshot | null | undefined): string | null {
  if (!snapshot) return null;
  if (snapshot.specifications?.trim()) return snapshot.specifications;
  if (snapshot.orderSpec && typeof snapshot.orderSpec === 'object') {
    try {
      return JSON.stringify(snapshot.orderSpec);
    } catch {
      return null;
    }
  }
  return null;
}

export async function seedReplacementProductionOrder(
  db: Db,
  productionOrderId: string,
  snapshot: ReplacementSeedSnapshot | null | undefined,
): Promise<{ materialCount: number; fabricCount: number }> {
  const materials = snapshot?.materials ?? [];
  let materialCount = 0;
  for (const [index, material] of materials.entries()) {
    await db.salesOrderLineMaterialRequirement.create({
      data: {
        productionOrderId,
        inventoryItemId: material.inventoryItemId ?? undefined,
        sku: material.sku ?? undefined,
        displayName: material.displayName ?? undefined,
        category: material.category as never,
        expectedQty:
          material.expectedQty != null && Number(material.expectedQty) > 0
            ? roundMoney(Number(material.expectedQty))
            : undefined,
        unit: material.unit || 'pcs',
        requestedFabricLabel: material.requestedFabricLabel ?? undefined,
        stageCode: material.stageCode ?? undefined,
        fabricRole: material.fabricRole ?? undefined,
        fabricSelectionKey: material.fabricSelectionKey ?? undefined,
        notes: material.notes ?? undefined,
        sortOrder: index,
        source: 'CATALOG',
      },
    });
    materialCount += 1;
  }
  const created = await ensureFabricProcurementsForProductionOrder(db, productionOrderId);
  return { materialCount, fabricCount: created.length };
}

export const LINE_SEED_INCLUDE = {
  productionSetup: {
    select: {
      catalogDimensions: true,
      orderDimensions: true,
      measurements: true,
      workflowId: true,
      factoryNotes: true,
      packagingExpectation: true,
      materialRequirements: { orderBy: { sortOrder: 'asc' as const } },
    },
  },
} as const;
