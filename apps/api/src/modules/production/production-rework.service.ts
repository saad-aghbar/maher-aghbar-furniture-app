import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { SchedulingService } from '../scheduling/scheduling.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ProductionReworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    @Optional() private readonly scheduling?: SchedulingService,
  ) {}

  async startRework(params: {
    reworkId: string;
    stageInstanceId: string;
    notes?: string;
    userId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const rework = await tx.reworkRequest.findUniqueOrThrow({
        where: { id: params.reworkId },
      });
      if (rework.status === 'COMPLETED') {
        throw new BadRequestException({
          code: 'INVALID_STATUS',
          message: 'This rework request is already completed.',
        });
      }
      const stage = await tx.productionStageInstance.findFirst({
        where: {
          id: params.stageInstanceId,
          productionOrderId: rework.productionOrderId,
        },
        include: { stageDefinition: true, tasks: true },
      });
      if (!stage) {
        throw new BadRequestException({
          code: 'INVALID_REWORK_STAGE',
          message: 'Choose a stage on this production order.',
        });
      }

      const existing = await tx.productionTask.findFirst({
        where: {
          reworkRequestId: rework.id,
          stageInstanceId: stage.id,
          status: { notIn: ['CANCELLED'] },
        },
      });
      if (existing) {
        await tx.reworkRequest.update({
          where: { id: rework.id },
          data: {
            status: 'IN_PROGRESS',
            reentryStageInstanceId: stage.id,
            notes: params.notes ?? rework.notes,
          },
        });
        return tx.reworkRequest.findUniqueOrThrow({
          where: { id: rework.id },
          include: { tasks: true, reentryStageInstance: { include: { stageDefinition: true } } },
        });
      }

      const taskNumber = await this.sequences.next('TASK', 'TSK');
      await tx.productionTask.create({
        data: {
          number: taskNumber,
          productionOrderId: rework.productionOrderId,
          stageDefinitionId: stage.stageDefinitionId,
          stageInstanceId: stage.id,
          name: `${stage.stageDefinition.nameEn} rework`,
          description: params.notes || rework.description,
          status: 'READY',
          isRework: true,
          reworkRequestId: rework.id,
          estimatedMinutes: stage.tasks[0]?.estimatedMinutes ?? undefined,
        },
      });

      await tx.productionStageInstance.update({
        where: { id: stage.id },
        data: {
          status: 'READY',
          progressPercent: 0,
          actualEnd: null,
        },
      });

      await tx.reworkRequest.update({
        where: { id: rework.id },
        data: {
          status: 'IN_PROGRESS',
          reentryStageInstanceId: stage.id,
          notes: params.notes ?? rework.notes,
        },
      });

      await tx.productionOrder.update({
        where: { id: rework.productionOrderId },
        data: {
          status: 'IN_PROGRESS',
          currentStageCode: stage.stageDefinition.code,
        },
      });

      await tx.auditEvent.create({
        data: {
          userId: params.userId,
          action: 'quality.rework.start',
          entityType: 'ReworkRequest',
          entityId: rework.id,
          newValues: {
            stageInstanceId: stage.id,
            stageCode: stage.stageDefinition.code,
            notes: params.notes ?? null,
          },
        },
      });

      return tx.reworkRequest.findUniqueOrThrow({
        where: { id: rework.id },
        include: { tasks: true, reentryStageInstance: { include: { stageDefinition: true } } },
      });
    }).then(async (rework) => {
      await this.scheduling
        ?.generateForProductionOrder(rework.productionOrderId, params.userId, {
          reason: 'Rework re-entry',
        })
        .catch(() => undefined);
      return rework;
    });
  }

  async completeRework(reworkId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const rework = await tx.reworkRequest.findUniqueOrThrow({
        where: { id: reworkId },
        include: { tasks: true },
      });
      const open = rework.tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status));
      if (open.length) {
        throw new BadRequestException({
          code: 'INVALID_STATUS',
          message: 'Finish the rework task before completing this request.',
        });
      }
      await tx.reworkRequest.update({
        where: { id: reworkId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          userId,
          action: 'quality.rework.complete',
          entityType: 'ReworkRequest',
          entityId: reworkId,
        },
      });
      return tx.reworkRequest.findUniqueOrThrow({
        where: { id: reworkId },
        include: { inspection: true, tasks: true },
      });
    });
  }

  async createForReturn(params: {
    returnId: string;
    salesOrderId: string | null;
    description: string;
    stageInstanceId?: string;
    userId: string;
    tx?: Tx;
  }) {
    const run = async (tx: Tx) => {
      const existing = await tx.reworkRequest.findFirst({
        where: { returnRequestId: params.returnId },
      });
      if (existing) return existing;

      const po = params.salesOrderId
        ? await tx.productionOrder.findFirst({
            where: { salesOrderId: params.salesOrderId },
            orderBy: { createdAt: 'desc' },
          })
        : null;
      if (!po) {
        throw new BadRequestException({
          code: 'INVALID_REWORK_STAGE',
          message: 'No production order is linked to this return.',
        });
      }
      const number = await this.sequences.next('RW', 'RW');
      const created = await tx.reworkRequest.create({
        data: {
          number,
          productionOrderId: po.id,
          returnRequestId: params.returnId,
          description: params.description,
          status: params.stageInstanceId ? 'IN_PROGRESS' : 'AWAITING_STAGE',
        },
      });
      await tx.productionOrder.update({
        where: { id: po.id },
        data: { status: 'ON_HOLD' },
      });
      return created;
    };
    if (params.tx) return run(params.tx);
    return this.prisma.$transaction(run);
  }
}
