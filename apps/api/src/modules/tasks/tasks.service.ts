import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { ListTasksDto, TaskBlockDto, TaskProgressDto } from './dto/task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListTasksDto, userId: string, permissions: string[]) {
    const where: Prisma.ProductionTaskWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.mine ? { assignedEmployeeId: userId } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { name: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (query.mine && !permissions.includes('production-task.update-any')) {
      where.assignedEmployeeId = userId;
    }

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.productionTask.count({ where }),
      this.prisma.productionTask.findMany({
        where,
        include: {
          productionOrder: { select: { id: true, number: true, status: true } },
          stageDefinition: { select: { id: true, code: true, nameEn: true } },
          blockers: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  private async getTask(id: string) {
    const task = await this.prisma.productionTask.findUnique({
      where: { id },
      include: { blockers: true },
    });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found.' });
    return task;
  }

  getById(id: string) {
    return this.prisma.productionTask.findUniqueOrThrow({
      where: { id },
      include: {
        productionOrder: true,
        stageDefinition: true,
        blockers: true,
        timeEntries: true,
      },
    });
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
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Cannot modify this task.' });
    }
  }

  async start(id: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (!['NOT_STARTED', 'READY', 'PAUSED'].includes(task.status)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Task cannot be started.' });
    }

    return this.prisma.productionTask.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        actualStart: task.actualStart ?? new Date(),
        assignedEmployeeId: task.assignedEmployeeId ?? userId,
      },
    });
  }

  async pause(id: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (task.status !== 'IN_PROGRESS') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Only in-progress tasks can be paused.' });
    }

    return this.prisma.productionTask.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
  }

  async resume(id: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (task.status !== 'PAUSED') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Only paused tasks can be resumed.' });
    }

    return this.prisma.productionTask.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });
  }

  async progress(id: string, dto: TaskProgressDto, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Task is closed.' });
    }

    return this.prisma.productionTask.update({
      where: { id },
      data: { progressPercent: dto.percent, status: dto.percent >= 100 ? 'READY_FOR_INSPECTION' : 'IN_PROGRESS' },
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
      return tx.productionTask.update({
        where: { id },
        data: { status: 'BLOCKED' },
        include: { blockers: true },
      });
    });
  }

  async complete(id: string, userId: string, permissions: string[]) {
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
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Task already completed.' });
    }

    return this.prisma.productionTask.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        progressPercent: 100,
        actualCompletion: new Date(),
      },
    });
  }
}
