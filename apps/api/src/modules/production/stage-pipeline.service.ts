import { Injectable } from '@nestjs/common';
import { InventoryTracking, Prisma, QualityResult } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { calculateWorkflowProgress } from './workflow/domain';

type Tx = Prisma.TransactionClient;

const SATISFIED = new Set(['COMPLETED', 'SKIPPED']);

@Injectable()
export class StagePipelineService {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Tx) {
    return tx ?? this.prisma;
  }

  /**
   * Resolve prerequisite stage codes for an instance.
   * Prefer order workflow snapshot edges; fall back to live dependsOnCodes.
   */
  async resolveDependsOnCodes(
    productionOrderId: string,
    stageInstanceId: string,
    fallbackCodes: string[],
    tx?: Tx,
  ): Promise<string[]> {
    const db = this.db(tx);
    const snapshot = await db.productionOrderWorkflowSnapshot.findUnique({
      where: { productionOrderId },
      include: { nodes: true, edges: true },
    });
    if (!snapshot) return fallbackCodes;

    const node = snapshot.nodes.find((n) => n.stageInstanceId === stageInstanceId);
    if (!node) return fallbackCodes;

    const predIds = snapshot.edges
      .filter((e) => e.toSnapshotNodeId === node.id)
      .map((e) => e.fromSnapshotNodeId);

    return snapshot.nodes
      .filter((n) => predIds.includes(n.id) && !n.isSkipped)
      .map((n) => n.stageCode);
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

    // Also treat snapshot-skipped nodes without instance as satisfied
    const snapshot = await db.productionOrderWorkflowSnapshot.findUnique({
      where: { productionOrderId },
      include: { nodes: true },
    });
    if (snapshot) {
      for (const n of snapshot.nodes) {
        if (n.isSkipped) byCode.set(n.stageCode, 'SKIPPED');
      }
    }

    return dependsOnCodes.every((code) => SATISFIED.has(byCode.get(code) ?? ''));
  }

  async arePrereqsMetForInstance(
    productionOrderId: string,
    stageInstanceId: string,
    fallbackCodes: string[],
    tx?: Tx,
  ): Promise<boolean> {
    const codes = await this.resolveDependsOnCodes(
      productionOrderId,
      stageInstanceId,
      fallbackCodes,
      tx,
    );
    return this.arePrereqsMet(productionOrderId, codes, tx);
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
      const met = await this.arePrereqsMetForInstance(
        productionOrderId,
        stage.id,
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

    const snapshot = await db.productionOrderWorkflowSnapshot.findUnique({
      where: { productionOrderId },
      include: { nodes: true },
    });
    const snapByInstance = new Map(
      (snapshot?.nodes ?? [])
        .filter((n) => n.stageInstanceId)
        .map((n) => [n.stageInstanceId!, n]),
    );

    for (const stage of stages) {
      if (stage.status === 'SKIPPED') continue;
      if (!stage.tasks.length) continue;
      const avg = Math.round(
        stage.tasks.reduce((sum, t) => sum + t.progressPercent, 0) / stage.tasks.length,
      );
      const allTasksDone = stage.tasks.every((t) => t.status === 'COMPLETED');
      const prereqsMet = await this.arePrereqsMetForInstance(
        productionOrderId,
        stage.id,
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

    const progressNodes = refreshed
      .filter((s) => s.status !== 'SKIPPED')
      .map((s) => {
        const snap = snapByInstance.get(s.id);
        return {
          nodeKey: s.stageDefinition.code,
          status: s.status,
          estimatedMinutes: snap?.estimatedMinutes ?? null,
          progressPercent: s.progressPercent,
          isSkipped: false,
        };
      });

    const progressPercent = calculateWorkflowProgress(progressNodes);
    const activeStages = refreshed.filter((s) => s.status !== 'SKIPPED');
    const completed = activeStages.filter((s) => s.status === 'COMPLETED').length;
    const allComplete = completed === activeStages.length && activeStages.length > 0;

    const active =
      refreshed.find((s) => s.status === 'IN_PROGRESS') ??
      refreshed.find((s) => s.status === 'READY') ??
      refreshed.find((s) => s.status !== 'COMPLETED' && s.status !== 'SKIPPED');

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
    const fgNodes = (snapshot?.nodes ?? []).filter(
      (n) => !n.isSkipped && n.inventoryTracking === InventoryTracking.PRODUCES_FINISHED,
    );
    const fgStagesComplete =
      fgNodes.length === 0
        ? false
        : fgNodes.every((n) => {
            const stage = n.stageInstanceId
              ? refreshed.find((s) => s.id === n.stageInstanceId)
              : refreshed.find((s) => s.stageDefinition.code === n.stageCode);
            return stage?.status === 'COMPLETED';
          });
    let qcPassed = true;
    if (fgNodes.some((n) => n.requiresInspection)) {
      const passed = await db.qualityInspection.findFirst({
        where: {
          productionOrderId,
          result: { in: [QualityResult.PASSED, QualityResult.PASSED_WITH_NOTES] },
        },
      });
      qcPassed = Boolean(passed);
    }
    const readyForDelivery =
      fgNodes.length > 0 ? fgStagesComplete && qcPassed : packagingDone && inspectionDone;

    await db.productionOrder.update({
      where: { id: productionOrderId },
      data: allComplete
        ? {
            status: 'COMPLETED',
            progressPercent: 100,
            actualCompletionDate: new Date(),
            currentStageCode:
              refreshed.filter((s) => s.status !== 'SKIPPED').at(-1)?.stageDefinition.code ??
              null,
          }
        : readyForDelivery
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
    if (po?.salesOrderId && (allComplete || readyForDelivery)) {
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
        const prereqsMet = await this.arePrereqsMetForInstance(
          productionOrderId,
          stage.id,
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
      if (stage && stage.status !== 'COMPLETED' && stage.status !== 'SKIPPED') {
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
      if (po.salesOrderId) {
        await db.salesOrder.updateMany({
          where: {
            id: po.salesOrderId,
            status: {
              in: [
                'CONFIRMED',
                'READY_FOR_PRODUCTION',
                'WAITING_FOR_PAYMENT',
              ],
            },
          },
          data: { status: 'IN_PRODUCTION' },
        });
      }
    }

    await this.rollupProgress(productionOrderId, tx);
  }
}
