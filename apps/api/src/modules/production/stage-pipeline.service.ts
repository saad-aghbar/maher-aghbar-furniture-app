import { Injectable } from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class StagePipelineService {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Tx) {
    return tx ?? this.prisma;
  }

  async arePrereqsMet(
    productionOrderId: string,
    dependsOnCodes: string[],
    tx?: Tx,
  ): Promise<boolean> {
    if (!dependsOnCodes.length) return true;
    const db = this.db(tx);
    const stages = await db.productionStageInstance.findMany({
      where: { productionOrderId },
      include: { stageDefinition: { select: { code: true } } },
    });
    const byCode = new Map(stages.map((s) => [s.stageDefinition.code, s.status]));
    return dependsOnCodes.every((code) => byCode.get(code) === 'COMPLETED');
  }

  /** Unlock stages whose prerequisites are met (PENDING → READY, NOT_STARTED → READY). */
  async unlockReadyStages(productionOrderId: string, tx?: Tx) {
    const db = this.db(tx);
    const stages = await db.productionStageInstance.findMany({
      where: { productionOrderId },
      include: {
        stageDefinition: true,
        tasks: true,
      },
    });

    for (const stage of stages) {
      if (stage.status !== 'PENDING') continue;
      const met = await this.arePrereqsMet(
        productionOrderId,
        stage.stageDefinition.dependsOnCodes,
        tx,
      );
      if (!met) continue;

      await db.productionStageInstance.update({
        where: { id: stage.id },
        data: { status: 'READY' },
      });

      for (const task of stage.tasks) {
        if (task.status === 'NOT_STARTED' || task.status === 'READY') {
          await db.productionTask.update({
            where: { id: task.id },
            data: { status: 'READY' },
          });
        }
      }
    }
  }

  /** Sync stage progress from its tasks and roll up PO progress / current stage / completion. */
  async rollupProgress(productionOrderId: string, tx?: Tx) {
    const db = this.db(tx);
    const stages = await db.productionStageInstance.findMany({
      where: { productionOrderId },
      include: {
        stageDefinition: true,
        tasks: true,
      },
      orderBy: { stageDefinition: { sortOrder: 'asc' } },
    });

    for (const stage of stages) {
      if (!stage.tasks.length) continue;
      const avg = Math.round(
        stage.tasks.reduce((sum, t) => sum + t.progressPercent, 0) / stage.tasks.length,
      );
      const allTasksDone = stage.tasks.every((t) => t.status === 'COMPLETED');
      const prereqsMet = await this.arePrereqsMet(
        productionOrderId,
        stage.stageDefinition.dependsOnCodes,
        tx,
      );
      const anyInProgress = stage.tasks.some((t) =>
        ['IN_PROGRESS', 'PAUSED', 'READY_FOR_INSPECTION'].includes(t.status),
      );

      let status = stage.status;
      if (allTasksDone && prereqsMet) {
        status = 'COMPLETED';
      } else if (stage.status === 'BLOCKED') {
        status = 'BLOCKED';
      } else if (anyInProgress && prereqsMet) {
        status = 'IN_PROGRESS';
      } else if (prereqsMet && stage.status === 'PENDING') {
        status = 'READY';
      }

      await db.productionStageInstance.update({
        where: { id: stage.id },
        data: {
          progressPercent: status === 'COMPLETED' ? 100 : avg,
          status,
          actualEnd: status === 'COMPLETED' ? (stage.actualEnd ?? new Date()) : null,
        },
      });
    }

    const refreshed = await db.productionStageInstance.findMany({
      where: { productionOrderId },
      include: { stageDefinition: true },
      orderBy: { stageDefinition: { sortOrder: 'asc' } },
    });

    const total = refreshed.length || 1;
    const completed = refreshed.filter((s) => s.status === 'COMPLETED').length;
    const progressPercent = Math.round((completed / total) * 100);
    const allComplete = completed === refreshed.length && refreshed.length > 0;

    const active =
      refreshed.find((s) => s.status === 'IN_PROGRESS') ??
      refreshed.find((s) => s.status === 'READY') ??
      refreshed.find((s) => s.status !== 'COMPLETED');

    const packagingDone = refreshed.some(
      (s) =>
        ['PACKAGING', 'PACK'].includes(s.stageDefinition.code) &&
        s.status === 'COMPLETED',
    );
    const inspectionDone = refreshed.some(
      (s) =>
        ['INSPECTION', 'QC', 'QUALITY'].includes(s.stageDefinition.code) &&
        s.status === 'COMPLETED',
    );

    await db.productionOrder.update({
      where: { id: productionOrderId },
      data: allComplete
        ? {
            status: 'COMPLETED',
            progressPercent: 100,
            actualCompletionDate: new Date(),
            currentStageCode:
              refreshed[refreshed.length - 1]?.stageDefinition.code ?? null,
          }
        : packagingDone && inspectionDone
          ? {
              progressPercent,
              currentStageCode: active?.stageDefinition.code ?? null,
              status: 'READY_FOR_DELIVERY',
            }
          : {
              progressPercent,
              currentStageCode: active?.stageDefinition.code ?? null,
              status: 'IN_PROGRESS',
            },
    });

    const po = await db.productionOrder.findUnique({
      where: { id: productionOrderId },
      select: { salesOrderId: true },
    });
    if (po?.salesOrderId && (allComplete || (packagingDone && inspectionDone))) {
      const siblings = await db.productionOrder.findMany({
        where: {
          salesOrderId: po.salesOrderId,
          archivedAt: null,
          status: { not: 'CANCELLED' },
        },
        select: { status: true },
      });
      const allReady = siblings.every((s) =>
        ['COMPLETED', 'READY_FOR_DELIVERY', 'READY_FOR_PACKAGING'].includes(s.status),
      );
      if (allReady) {
        await db.salesOrder.update({
          where: { id: po.salesOrderId },
          data: { status: 'READY_FOR_DELIVERY' },
        });
      }
    }
  }

  async onTaskProgress(
    productionOrderId: string,
    stageInstanceId: string | null,
    progressPercent: number,
    tx?: Tx,
  ) {
    const db = this.db(tx);
    if (stageInstanceId) {
      await db.productionStageInstance.update({
        where: { id: stageInstanceId },
        data: {
          progressPercent,
          ...(progressPercent < 100 ? { status: 'IN_PROGRESS' as const } : {}),
        },
      });
    }
    await this.rollupProgress(productionOrderId, tx);
  }

  async onTaskComplete(productionOrderId: string, stageInstanceId: string | null, tx?: Tx) {
    const db = this.db(tx);
    if (stageInstanceId) {
      const stage = await db.productionStageInstance.findUnique({
        where: { id: stageInstanceId },
        include: { stageDefinition: true, tasks: true },
      });
      if (stage) {
        const allDone = stage.tasks.every((t) => t.status === 'COMPLETED');
        const prereqsMet = await this.arePrereqsMet(
          productionOrderId,
          stage.stageDefinition.dependsOnCodes,
          tx,
        );
        if (allDone && prereqsMet) {
          await db.productionStageInstance.update({
            where: { id: stageInstanceId },
            data: {
              status: 'COMPLETED',
              progressPercent: 100,
              actualEnd: new Date(),
            },
          });
        }
      }
    }
    await this.unlockReadyStages(productionOrderId, tx);
    await this.rollupProgress(productionOrderId, tx);
  }

  async onTaskStart(productionOrderId: string, stageInstanceId: string | null, tx?: Tx) {
    const db = this.db(tx);
    if (stageInstanceId) {
      const stage = await db.productionStageInstance.findUnique({
        where: { id: stageInstanceId },
      });
      if (stage && stage.status !== 'COMPLETED') {
        await db.productionStageInstance.update({
          where: { id: stageInstanceId },
          data: {
            status: 'IN_PROGRESS',
            actualStart: stage.actualStart ?? new Date(),
          },
        });
      }
    }

    const po = await db.productionOrder.findUnique({ where: { id: productionOrderId } });
    if (po && po.status !== 'COMPLETED') {
      await db.productionOrder.update({
        where: { id: productionOrderId },
        data: {
          status: 'IN_PROGRESS',
          ...(po.actualStartDate ? {} : { actualStartDate: new Date() }),
        },
      });
    }

    await this.rollupProgress(productionOrderId, tx);
  }
}
