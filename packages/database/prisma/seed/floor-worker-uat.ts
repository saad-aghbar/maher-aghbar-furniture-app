/**
 * Floor-worker UAT fixtures. Enable with SEED_FLOOR_UAT=1.
 * Assigns `floor` to CARPENTRY + ASSEMBLY on three released orders so
 * intervening stages stay locked, and one carpentry task is mid-shift overrun.
 */
import { PrismaClient, StageInstanceStatus, TaskStatus } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { ensureFloorWorker } from './people';

const FLOOR_STAGE_CODES = ['CARPENTRY', 'ASSEMBLY'] as const;
const INTERVENING = new Set(['PAINTING', 'FOAM', 'UPHOLSTERY']);

function todayWindow(hoursFromNow: number, durationHours: number) {
  const start = new Date();
  start.setHours(8, 0, 0, 0);
  start.setHours(start.getHours() + hoursFromNow);
  const end = new Date(start);
  end.setHours(end.getHours() + durationHours);
  return { start, end };
}

export async function seedFloorWorkerUat(prisma: PrismaClient, passwordHash?: string) {
  const hash = passwordHash ?? hashSync('123', 12);
  const floor = await ensureFloorWorker(prisma, hash);
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });

  const candidates = await prisma.productionOrder.findMany({
    where: {
      archivedAt: null,
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
      tasks: {
        some: { stageDefinition: { code: 'CARPENTRY' } },
      },
      AND: {
        tasks: { some: { stageDefinition: { code: 'ASSEMBLY' } } },
      },
    },
    include: {
      tasks: {
        include: {
          stageDefinition: { select: { id: true, code: true, nameEn: true } },
          stageInstance: true,
        },
      },
      schedules: {
        orderBy: { version: 'desc' },
        take: 1,
        include: { allocations: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });

  if (candidates.length === 0) {
    console.log(
      '  floor UAT: no CARPENTRY+ASSEMBLY production orders found — run with SEED_FULL_DEMO=1',
    );
    return { assigned: 0, floorUserId: floor.id };
  }

  const picked = candidates.slice(0, 3);
  const now = new Date();
  let assigned = 0;

  for (let i = 0; i < picked.length; i += 1) {
    const po = picked[i]!;
    const overrun = i === 0;

    await prisma.productionOrder.update({
      where: { id: po.id },
      data: {
        releasedToFactoryAt: po.releasedToFactoryAt ?? now,
        releasedToFactoryById: admin?.id ?? floor.id,
        actualStartDate: po.actualStartDate ?? now,
        status: po.status === 'DRAFT' || po.status === 'PLANNED' ? 'IN_PROGRESS' : po.status,
      },
    });

    for (const task of po.tasks) {
      const code = task.stageDefinition?.code ?? '';
      const mine = (FLOOR_STAGE_CODES as readonly string[]).includes(code);
      const intervening = INTERVENING.has(code);

      if (mine) {
        const carpentryReady = code === 'CARPENTRY';
        const window = carpentryReady
          ? overrun
            ? todayWindow(-3, 2)
            : todayWindow(0, 2)
          : todayWindow(6, 2);
        const status: TaskStatus = carpentryReady
          ? overrun
            ? TaskStatus.IN_PROGRESS
            : TaskStatus.READY
          : TaskStatus.NOT_STARTED;
        const stageStatus: StageInstanceStatus = carpentryReady
          ? overrun
            ? StageInstanceStatus.IN_PROGRESS
            : StageInstanceStatus.READY
          : StageInstanceStatus.PENDING;

        await prisma.productionTask.update({
          where: { id: task.id },
          data: {
            assignedEmployeeId: floor.id,
            plannedStart: window.start,
            plannedCompletion: window.end,
            status,
            actualStart: overrun && carpentryReady ? window.start : null,
            actualMinutes: overrun && carpentryReady ? 180 : null,
            notes: 'Floor UAT — follow the drawing and confirm grain direction.',
          },
        });
        if (task.stageInstanceId) {
          await prisma.productionStageInstance.update({
            where: { id: task.stageInstanceId },
            data: { status: stageStatus, plannedStart: window.start, plannedEnd: window.end },
          });
        }

        const schedule = po.schedules[0];
        if (schedule) {
          const existing = schedule.allocations.find((a) => a.productionTaskId === task.id);
          if (existing) {
            await prisma.scheduleAllocation.update({
              where: { id: existing.id },
              data: {
                employeeId: floor.id,
                plannedStart: window.start,
                plannedEnd: window.end,
                estimatedMinutes: task.estimatedMinutes ?? 120,
              },
            });
          } else {
            await prisma.scheduleAllocation.create({
              data: {
                scheduleId: schedule.id,
                productionTaskId: task.id,
                stageInstanceId: task.stageInstanceId,
                employeeId: floor.id,
                plannedStart: window.start,
                plannedEnd: window.end,
                estimatedMinutes: task.estimatedMinutes ?? 120,
              },
            });
          }
        }
      } else if (intervening) {
        await prisma.productionTask.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.NOT_STARTED,
            assignedEmployeeId:
              task.assignedEmployeeId === floor.id ? null : task.assignedEmployeeId,
          },
        });
        if (task.stageInstanceId) {
          await prisma.productionStageInstance.update({
            where: { id: task.stageInstanceId },
            data: { status: StageInstanceStatus.PENDING },
          });
        }
      }
    }
    assigned += 1;
  }

  console.log(
    `  floor UAT: assigned ${assigned} orders to floor (${floor.id}) — carpentry + assembly`,
  );
  return { assigned, floorUserId: floor.id };
}
