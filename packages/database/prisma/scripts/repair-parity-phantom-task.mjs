import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const taskId = '878607c8-1247-4fa7-9651-6d5fa536c616';
const apply = process.argv.includes('--apply');

try {
  const result = await db.$transaction(async (tx) => {
    const task = await tx.productionTask.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        productionOrder: { select: { number: true } },
        stageInstance: { include: { wipKit: { include: { claimedByTask: true } } } },
        _count: { select: { timeEntries: true, materialUsages: true, inventoryTransactions: true,
          producedWipKits: true, claimedWipKits: true, wipHandoffsReceived: true, allocations: true } },
      },
    });
    const prior = await tx.auditEvent.findFirst({ where: {
      action: 'parity.repair-unused-terminal-stage-task', entityId: taskId,
    } });
    if (task.status === 'CANCELLED' && prior) return { changed: false, alreadyRepaired: true, taskId };

    const kit = task.stageInstance?.wipKit;
    if (task.productionOrder.number !== 'SO-PARITY-UAT-20261012.A' || task.status !== 'NOT_STARTED' ||
        task.isRework || task.assignedEmployeeId || task.actualStart || task.actualCompletion ||
        Number(task.completedQty) !== 0 || Number(task.actualMinutes ?? 0) !== 0 ||
        Object.values(task._count).some((count) => count !== 0) ||
        task.stageInstance?.status !== 'COMPLETED' || kit?.status !== 'CONSUMED' ||
        !kit.claimedByTask?.actualCompletion || kit.claimedByTask.actualCompletion >= task.createdAt) {
      throw new Error('Repair preconditions changed; no records were modified.');
    }
    const before = { status: task.status, notes: task.notes, updatedAt: task.updatedAt.toISOString() };
    const after = { status: 'CANCELLED', notes: [task.notes,
      '[PARITY-REPAIR-20261013] Cancelled unused task created after this completed stage output was consumed. Execution and stock history preserved.',
    ].filter(Boolean).join('\n') };
    const evidence = { stageId: task.stageInstanceId, consumedKitId: kit.id,
      consumingTaskId: kit.claimedByTaskId, consumedBeforeTaskCreated: true };
    if (!apply) return { dryRun: true, taskId, before, after, evidence };
    await tx.productionTask.update({ where: { id: taskId, updatedAt: task.updatedAt }, data: after });
    const actor = await tx.user.findUniqueOrThrow({ where: { username: 'admin' }, select: { id: true } });
    await tx.auditEvent.create({ data: { userId: actor.id,
      action: 'parity.repair-unused-terminal-stage-task', entityType: 'ProductionTask', entityId: taskId,
      oldValues: before, newValues: { ...after, evidence },
    } });
    return { changed: true, taskId, before, after, evidence };
  }, { isolationLevel: 'Serializable' });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
