/**
 * Labor time on completed month tasks (not SO-COST-* twins).
 * Minutes come from the task estimate; rate is the existing LaborRate row.
 */
import type { PrismaClient } from '@prisma/client';
import { money } from '../seed/util';

export async function seedMonthLabor(prisma: PrismaClient): Promise<void> {
  const tasks = await prisma.productionTask.findMany({
    where: {
      status: 'COMPLETED',
      timeEntries: { none: {} },
      productionOrder: {
        salesOrder: { number: { not: { startsWith: 'SO-COST-' } } },
      },
    },
    select: {
      id: true,
      assignedEmployeeId: true,
      estimatedMinutes: true,
      actualStart: true,
      actualCompletion: true,
      stageDefinitionId: true,
      productionOrder: {
        select: { productId: true },
      },
    },
  });

  const rates = await prisma.laborRate.findMany({
    where: { effectiveTo: null },
    select: { userId: true, stageDefinitionId: true, hourlyRate: true },
  });

  let entries = 0;
  const samples = new Map<string, { productId: string; stageDefinitionId: string; minutes: number[] }>();

  for (const task of tasks) {
    const userId = task.assignedEmployeeId;
    if (!userId) continue;
    const minutes = Math.max(15, task.estimatedMinutes ?? 45);
    const started = task.actualStart ?? task.actualCompletion ?? new Date();
    const ended = task.actualCompletion ?? new Date(started.getTime() + minutes * 60_000);
    await prisma.taskTimeEntry.create({
      data: {
        taskId: task.id,
        userId,
        startedAt: started,
        endedAt: ended,
        minutes,
      },
    });
    entries += 1;
    const productId = task.productionOrder.productId;
    const stageDefinitionId = task.stageDefinitionId;
    if (productId && stageDefinitionId) {
      const key = `${productId}:${stageDefinitionId}`;
      const bucket = samples.get(key) ?? { productId, stageDefinitionId, minutes: [] };
      bucket.minutes.push(minutes);
      samples.set(key, bucket);
    }
    void rates;
  }

  let stats = 0;
  for (const bucket of samples.values()) {
    const avg = bucket.minutes.reduce((s, n) => s + n, 0) / bucket.minutes.length;
    await prisma.stageEstimateStat.upsert({
      where: {
        productId_stageDefinitionId: {
          productId: bucket.productId,
          stageDefinitionId: bucket.stageDefinitionId,
        },
      },
      update: {
        sampleSize: bucket.minutes.length,
        avgActualMinutes: money(avg),
        suggestedMinutes: Math.round(avg),
        lastComputedAt: new Date(),
      },
      create: {
        productId: bucket.productId,
        stageDefinitionId: bucket.stageDefinitionId,
        sampleSize: bucket.minutes.length,
        avgActualMinutes: money(avg),
        avgEstimatedMinutes: money(avg),
        suggestedMinutes: Math.round(avg),
        lastComputedAt: new Date(),
      },
    });
    stats += 1;
  }

  console.log(`  labor: ${entries} time entries · ${stats} stage stats`);
}
