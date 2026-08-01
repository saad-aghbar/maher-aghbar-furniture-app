import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { assertCustomerOwns, customerScopeFilter } from '../../common/helpers/customer-scope';
import { ListProductionOrdersDto, UpdateProductionOrderDto } from './dto/production.dto';
import { StagePipelineService } from './stage-pipeline.service';

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: StagePipelineService,
  ) {}

  async list(query: ListProductionOrdersDto, user?: AuthUser) {
    const where: Prisma.ProductionOrderWhereInput = {
      archivedAt: null,
      ...customerScopeFilter(user),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { productDescription: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.productionOrder.count({ where }),
      this.prisma.productionOrder.findMany({
        where,
        include: {
          salesOrder: { select: { id: true, number: true } },
          stages: {
            include: { stageDefinition: true },
            orderBy: { stageDefinition: { sortOrder: 'asc' } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  async getById(id: string, user?: AuthUser) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id, archivedAt: null },
      include: {
        salesOrder: true,
        product: true,
        stages: {
          include: {
            stageDefinition: true,
            tasks: {
              include: {
                assignedEmployee: {
                  select: { id: true, firstName: true, lastName: true, email: true },
                },
              },
            },
          },
          orderBy: { stageDefinition: { sortOrder: 'asc' } },
        },
        tasks: {
          include: {
            assignedEmployee: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            stageDefinition: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
    }
    if (!assertCustomerOwns(user, order.customerId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your production order.' });
    }
    return order;
  }

  async update(id: string, dto: UpdateProductionOrderDto) {
    await this.getById(id);
    await this.prisma.productionOrder.update({
      where: { id },
      data: {
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.plannedStartDate
          ? { plannedStartDate: new Date(dto.plannedStartDate) }
          : {}),
        ...(dto.plannedCompletionDate
          ? { plannedCompletionDate: new Date(dto.plannedCompletionDate) }
          : {}),
        ...(dto.requiredDeliveryDate
          ? { requiredDeliveryDate: new Date(dto.requiredDeliveryDate) }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    if (dto.estimatedMinutes != null) {
      await this.prisma.productionTask.updateMany({
        where: { productionOrderId: id, estimatedMinutes: null },
        data: { estimatedMinutes: dto.estimatedMinutes },
      });
    }

    return this.getById(id);
  }

  async start(id: string) {
    const order = await this.getById(id);
    const allowed = ['DRAFT', 'PLANNED', 'READY', 'WAITING_FOR_MATERIALS'];
    if (!allowed.includes(order.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot start production order in status ${order.status}.`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productionOrder.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          actualStartDate: new Date(),
        },
      });
      if (order.salesOrderId) {
        await tx.salesOrder.update({
          where: { id: order.salesOrderId },
          data: { status: 'IN_PRODUCTION' },
        });
      }
      // Unlock only stages with no prerequisites (e.g. MATERIAL_PREP)
      await this.pipeline.unlockReadyStages(id, tx);
      await this.pipeline.rollupProgress(id, tx);
    });

    return this.getById(id);
  }
}
