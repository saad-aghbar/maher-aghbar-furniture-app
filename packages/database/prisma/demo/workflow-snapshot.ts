import type { PrismaClient } from '@prisma/client';

/** Minimal snapshot so confirmed/planned POs pass `demo:validate`. */
export async function attachMinimalWorkflowSnapshot(
  prisma: PrismaClient,
  productionOrderId: string,
  nodeKey = 'prep',
): Promise<void> {
  const existing = await prisma.productionOrderWorkflowSnapshot.findUnique({
    where: { productionOrderId },
  });
  if (existing) return;

  const prep = await prisma.productionStageDefinition.findUnique({
    where: { code: 'MATERIAL_PREP' },
    select: { id: true, nameEn: true, nameAr: true, nameHe: true },
  });

  const snapshot = await prisma.productionOrderWorkflowSnapshot.create({
    data: {
      productionOrderId,
      isLegacyBackfill: true,
    },
  });
  await prisma.productionOrderWorkflowSnapshotNode.create({
    data: {
      snapshotId: snapshot.id,
      stageDefinitionId: prep?.id,
      nodeKey,
      stageCode: 'MATERIAL_PREP',
      nameEnSnapshot: prep?.nameEn || 'Material Prep',
      nameArSnapshot: prep?.nameAr || 'تحضير المواد',
      nameHeSnapshot: prep?.nameHe ?? null,
      consumesRawMaterials: true,
      executionKind: 'PRODUCTION',
    },
  });
}
