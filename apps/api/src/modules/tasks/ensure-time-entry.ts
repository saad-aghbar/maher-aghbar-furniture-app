import type { Prisma } from '@maher/database';

type Tx = Prisma.TransactionClient;

/** Capture path for tasks that were completed without starting the timer. */
export async function ensureTaskTimeEntry(
  tx: Tx,
  params: {
    taskId: string;
    userId: string;
    actualMinutes?: number | null;
    actualStart?: Date | null;
    actualCompletion?: Date | null;
  },
) {
  const existing = await tx.taskTimeEntry.count({ where: { taskId: params.taskId } });
  if (existing > 0) return { created: false };
  const minutes = Number(params.actualMinutes) || 0;
  if (!(minutes > 0)) return { created: false };

  const endedAt = params.actualCompletion ?? new Date();
  const startedAt = params.actualStart ?? new Date(endedAt.getTime() - minutes * 60_000);
  await tx.taskTimeEntry.create({
    data: {
      taskId: params.taskId,
      userId: params.userId,
      startedAt,
      endedAt,
      minutes,
    },
  });
  return { created: true };
}
