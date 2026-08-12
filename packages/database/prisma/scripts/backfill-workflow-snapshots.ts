/**
 * Idempotent legacy backfill: create workflow snapshots from existing
 * ProductionStageInstances + dependsOnCodes without duplicating tasks.
 *
 * Usage:
 *   DRY_RUN=1 pnpm --filter @maher/database exec tsx prisma/scripts/backfill-workflow-snapshots.ts
 *   pnpm --filter @maher/database exec tsx prisma/scripts/backfill-workflow-snapshots.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../../../../.env') });

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

async function main() {
  const orders = await prisma.productionOrder.findMany({
    where: { workflowSnapshot: null },
    include: {
      stages: { include: { stageDefinition: true }, orderBy: { stageDefinition: { sortOrder: 'asc' } } },
    },
  });

  console.log(`Found ${orders.length} production orders without snapshots. dryRun=${dryRun}`);

  let created = 0;
  for (const po of orders) {
    if (!po.stages.length) {
      console.log(`Skip ${po.number}: no stages`);
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] would snapshot ${po.number} with ${po.stages.length} stages`);
      created += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.productionOrderWorkflowSnapshot.findUnique({
        where: { productionOrderId: po.id },
      });
      if (existing) return;

      const snapshot = await tx.productionOrderWorkflowSnapshot.create({
        data: {
          productionOrderId: po.id,
          isLegacyBackfill: true,
          sourceVersionNumber: null,
        },
      });

      const nodeIdByCode = new Map<string, string>();
      for (const [index, stage] of po.stages.entries()) {
        const node = await tx.productionOrderWorkflowSnapshotNode.create({
          data: {
            snapshotId: snapshot.id,
            stageDefinitionId: stage.stageDefinitionId,
            stageInstanceId: stage.id,
            nodeKey: stage.stageDefinition.code,
            stageCode: stage.stageDefinition.code,
            nameArSnapshot: stage.stageDefinition.nameAr,
            nameEnSnapshot: stage.stageDefinition.nameEn,
            nameHeSnapshot: stage.stageDefinition.nameHe,
            isRequired: true,
            isSkipped: stage.status === 'SKIPPED',
            responsibleDepartmentCode: stage.stageDefinition.responsibleDepartment,
            estimatedMinutes: stage.stageDefinition.estimatedHours
              ? Math.round(Number(stage.stageDefinition.estimatedHours) * 60)
              : null,
            requiresInspection: stage.stageDefinition.requiresInspection,
            requiresPhotos: stage.stageDefinition.requiresPhotos,
            sortOrder: stage.stageDefinition.sortOrder ?? index,
          },
        });
        nodeIdByCode.set(stage.stageDefinition.code, node.id);
      }

      for (const stage of po.stages) {
        const toId = nodeIdByCode.get(stage.stageDefinition.code);
        if (!toId) continue;
        for (const fromCode of stage.stageDefinition.dependsOnCodes) {
          const fromId = nodeIdByCode.get(fromCode);
          if (!fromId) continue;
          await tx.productionOrderWorkflowSnapshotEdge.create({
            data: {
              snapshotId: snapshot.id,
              fromSnapshotNodeId: fromId,
              toSnapshotNodeId: toId,
              dependencyType: 'HARD',
            },
          });
        }
      }
    });

    created += 1;
    console.log(`Snapshotted ${po.number}`);
  }

  console.log(`Done. ${created} orders processed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
