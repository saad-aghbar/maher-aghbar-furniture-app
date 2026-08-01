import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { StagePipelineService } from '../production/stage-pipeline.service';
import {
  AssignTaskDto,
  ListTasksDto,
  TaskBlockDto,
  TaskProgressDto,
} from './dto/task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: StagePipelineService,
  ) {}

  async list(query: ListTasksDto, userId: string, permissions: string[]) {
    const canSeeAll = permissions.includes('production-task.update-any');
    // Floor workers share the same role but must only ever see their assigned tasks.
    const forceMine = query.mine === true || !canSeeAll;

    const where: Prisma.ProductionTaskWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(forceMine ? { assignedEmployeeId: userId } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { name: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.productionTask.count({ where }),
      this.prisma.productionTask.findMany({
        where,
        include: {
          productionOrder: {
            select: { id: true, number: true, status: true, productDescription: true },
          },
          stageDefinition: {
            select: {
              id: true,
              code: true,
              nameEn: true,
              nameAr: true,
              dependsOnCodes: true,
              sortOrder: true,
            },
          },
          stageInstance: { select: { id: true, status: true, progressPercent: true } },
          assignedEmployee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          blockers: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  private async getTask(id: string) {
    const task = await this.prisma.productionTask.findUnique({
      where: { id },
      include: {
        blockers: true,
        stageDefinition: true,
        stageInstance: true,
        productionOrder: true,
      },
    });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found.' });
    return task;
  }

  async getById(id: string, userId?: string, permissions: string[] = []) {
    const task = await this.prisma.productionTask.findUniqueOrThrow({
      where: { id },
      include: {
        productionOrder: {
          select: {
            id: true,
            number: true,
            status: true,
            productDescription: true,
            currentStageCode: true,
            progressPercent: true,
          },
        },
        stageDefinition: true,
        stageInstance: true,
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        blockers: true,
        timeEntries: { orderBy: { startedAt: 'desc' } },
      },
    });

    if (userId) {
      const canSeeAll = permissions.includes('production-task.update-any');
      if (!canSeeAll && task.assignedEmployeeId !== userId) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'You can only view tasks assigned to you.',
        });
      }
    }

    const photos = await this.prisma.document.findMany({
      where: {
        productionOrderId: task.productionOrderId,
        category: `TASK_PHOTO:${task.id}`,
        archivedAt: null,
      },
      select: { id: true, fileName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return { ...task, photos };
  }

  private async closeOpenTimeEntries(
    tx: Prisma.TransactionClient,
    taskId: string,
    userId: string,
  ) {
    const open = await tx.taskTimeEntry.findMany({
      where: { taskId, endedAt: null },
    });
    const now = new Date();
    let added = 0;
    for (const entry of open) {
      const minutes = Math.max(1, Math.round((now.getTime() - entry.startedAt.getTime()) / 60000));
      added += minutes;
      await tx.taskTimeEntry.update({
        where: { id: entry.id },
        data: { endedAt: now, minutes, userId: entry.userId || userId },
      });
    }
    if (added > 0) {
      const task = await tx.productionTask.findUnique({ where: { id: taskId } });
      await tx.productionTask.update({
        where: { id: taskId },
        data: { actualMinutes: (task?.actualMinutes ?? 0) + added },
      });
    }
  }

  private assertCanModify(
    task: { assignedEmployeeId: string | null },
    userId: string,
    permissions: string[],
  ) {
    const canAny = permissions.includes('production-task.update-any');
    const canOwn =
      permissions.includes('production-task.update-own') && task.assignedEmployeeId === userId;
    if (!canAny && !canOwn) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You can only modify tasks assigned to you.',
      });
    }
  }

  private async assertPrereqsMet(task: {
    productionOrderId: string;
    stageDefinition: { dependsOnCodes: string[]; code: string } | null;
    stageInstance: { status: string } | null;
  }) {
    const depends = task.stageDefinition?.dependsOnCodes ?? [];
    const met = await this.pipeline.arePrereqsMet(task.productionOrderId, depends);
    if (!met) {
      throw new BadRequestException({
        code: 'STAGE_LOCKED',
        message: `Stage ${task.stageDefinition?.code ?? 'unknown'} is locked until prerequisites are completed: ${depends.join(', ')}`,
      });
    }
  }

  async assign(id: string, dto: AssignTaskDto) {
    await this.getTask(id);
    const employee = await this.prisma.user.findFirst({
      where: { id: dto.employeeId, isActive: true, archivedAt: null },
    });
    if (!employee) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Employee not found.' });
    }

    return this.prisma.productionTask.update({
      where: { id },
      data: {
        assignedEmployeeId: dto.employeeId,
        ...(dto.priority ? { priority: dto.priority } : {}),
      },
      include: {
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        stageDefinition: true,
        productionOrder: { select: { id: true, number: true } },
      },
    });
  }

  async start(id: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    await this.assertPrereqsMet(task);

    const stageStatus = task.stageInstance?.status;
    const allowedTask = ['NOT_STARTED', 'READY', 'PAUSED'].includes(task.status);
    const stageOk =
      !stageStatus || ['READY', 'IN_PROGRESS', 'PENDING'].includes(stageStatus);

    if (!allowedTask) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Task cannot be started.' });
    }
    if (task.status === 'NOT_STARTED' && stageStatus && stageStatus === 'PENDING') {
      throw new BadRequestException({
        code: 'STAGE_LOCKED',
        message: 'Task is not READY yet — waiting for previous stages.',
      });
    }
    if (!stageOk && stageStatus === 'COMPLETED') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Stage already completed.' });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.taskTimeEntry.create({
        data: {
          taskId: id,
          userId,
          startedAt: new Date(),
        },
      });
      const updated = await tx.productionTask.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          actualStart: task.actualStart ?? new Date(),
          assignedEmployeeId: task.assignedEmployeeId ?? userId,
        },
      });
      await this.pipeline.onTaskStart(task.productionOrderId, task.stageInstanceId, tx);
      return updated;
    });
  }

  async pause(id: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (task.status !== 'IN_PROGRESS') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only in-progress tasks can be paused.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await this.closeOpenTimeEntries(tx, id, userId);
      return tx.productionTask.update({
        where: { id },
        data: { status: 'PAUSED' },
      });
    });
  }

  async resume(id: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (task.status !== 'PAUSED') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only paused tasks can be resumed.',
      });
    }
    await this.assertPrereqsMet(task);

    return this.prisma.$transaction(async (tx) => {
      await tx.taskTimeEntry.create({
        data: { taskId: id, userId, startedAt: new Date() },
      });
      const updated = await tx.productionTask.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      });
      await this.pipeline.onTaskStart(task.productionOrderId, task.stageInstanceId, tx);
      return updated;
    });
  }

  async progress(id: string, dto: TaskProgressDto, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Task is closed.' });
    }
    await this.assertPrereqsMet(task);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productionTask.update({
        where: { id },
        data: {
          progressPercent: dto.percent,
          status: dto.percent >= 100 ? 'READY_FOR_INSPECTION' : 'IN_PROGRESS',
        },
      });
      await this.pipeline.onTaskProgress(
        task.productionOrderId,
        task.stageInstanceId,
        dto.percent,
        tx,
      );
      return updated;
    });
  }

  async block(id: string, dto: TaskBlockDto, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);

    return this.prisma.$transaction(async (tx) => {
      await tx.taskBlocker.create({
        data: {
          taskId: id,
          category: dto.category,
          reason: dto.reason,
          reportedById: userId,
        },
      });
      if (task.stageInstanceId) {
        await tx.productionStageInstance.update({
          where: { id: task.stageInstanceId },
          data: { status: 'BLOCKED' },
        });
      }
      return tx.productionTask.update({
        where: { id },
        data: { status: 'BLOCKED' },
        include: { blockers: true },
      });
    });
  }

  async unblock(id: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (task.status !== 'BLOCKED') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only blocked tasks can be unblocked.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.taskBlocker.updateMany({
        where: { taskId: id, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });

      const updated = await tx.productionTask.update({
        where: { id },
        data: { status: 'PAUSED' },
        include: { blockers: true },
      });

      if (task.stageInstanceId) {
        await tx.productionStageInstance.update({
          where: { id: task.stageInstanceId },
          data: { status: 'IN_PROGRESS' },
        });
      }

      return updated;
    });
  }

  async updateNotes(id: string, notes: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    return this.prisma.productionTask.update({
      where: { id },
      data: { notes },
    });
  }

  async complete(
    id: string,
    userId: string,
    permissions: string[],
    dto?: { notes?: string; photoDocumentIds?: string[] },
  ) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);

    const unresolved = task.blockers.filter((b) => !b.resolvedAt);
    if (unresolved.length) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Cannot complete task with unresolved blockers.',
      });
    }

    if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Task already completed.',
      });
    }

    await this.assertPrereqsMet(task);

    if (task.stageDefinition?.requiresPhotos) {
      const linked = dto?.photoDocumentIds?.length
        ? dto.photoDocumentIds.length
        : await this.prisma.document.count({
            where: {
              productionOrderId: task.productionOrderId,
              category: `TASK_PHOTO:${id}`,
              archivedAt: null,
            },
          });
      if (!linked) {
        throw new BadRequestException({
          code: 'PHOTOS_REQUIRED',
          message: 'This stage requires at least one photo before completion.',
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await this.closeOpenTimeEntries(tx, id, userId);

      if (dto?.photoDocumentIds?.length) {
        await tx.document.updateMany({
          where: { id: { in: dto.photoDocumentIds } },
          data: {
            productionOrderId: task.productionOrderId,
            category: `TASK_PHOTO:${id}`,
          },
        });
      }

      const updated = await tx.productionTask.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          progressPercent: 100,
          actualCompletion: new Date(),
          ...(dto?.notes ? { notes: dto.notes } : {}),
        },
        include: {
          stageDefinition: true,
          productionOrder: { select: { id: true, number: true, progressPercent: true } },
        },
      });
      await this.pipeline.onTaskComplete(task.productionOrderId, task.stageInstanceId, tx);
      return updated;
    });
  }
}
