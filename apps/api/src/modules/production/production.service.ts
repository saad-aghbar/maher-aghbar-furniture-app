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
    const q = query.q?.trim();
    const and: Prisma.ProductionOrderWhereInput[] = [];
    if (query.customerId) {
      and.push({
        OR: [
          { customerId: query.customerId },
          { salesOrder: { customerId: query.customerId } },
        ],
      });
    }
    if (q) {
      and.push({
        OR: [
          { number: { contains: q, mode: 'insensitive' } },
          { productDescription: { contains: q, mode: 'insensitive' } },
          { currentStageCode: { contains: q, mode: 'insensitive' } },
          { salesOrder: { number: { contains: q, mode: 'insensitive' } } },
          { product: { nameEn: { contains: q, mode: 'insensitive' } } },
          { product: { nameAr: { contains: q, mode: 'insensitive' } } },
          { product: { nameHe: { contains: q, mode: 'insensitive' } } },
          { product: { sku: { contains: q, mode: 'insensitive' } } },
          { salesOrder: { externalOrderNumber: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.ProductionOrderWhereInput = {
      archivedAt: null,
      ...customerScopeFilter(user),
      ...(query.status ? { status: query.status } : {}),
      ...(and.length ? { AND: and } : {}),
    };

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.productionOrder.count({ where }),
      this.prisma.productionOrder.findMany({
        where,
        include: {
          salesOrder: {
            select: {
              id: true,
              number: true,
              externalOrderNumber: true,
              customerId: true,
              customer: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  nameAr: true,
                  nameEn: true,
                  nameHe: true,
                },
              },
            },
          },
          product: {
            select: {
              id: true,
              sku: true,
              nameEn: true,
              nameAr: true,
              nameHe: true,
              imageUrl: true,
            },
          },
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

    const orphanCustomerIds = [
      ...new Set(
        data
          .filter((row) => row.customerId && !row.salesOrder?.customer)
          .map((row) => row.customerId as string),
      ),
    ];
    const orphanCustomers =
      orphanCustomerIds.length > 0
        ? await this.prisma.customer.findMany({
            where: { id: { in: orphanCustomerIds } },
            select: {
              id: true,
              code: true,
              name: true,
              nameAr: true,
              nameEn: true,
              nameHe: true,
            },
          })
        : [];
    const orphanById = new Map(orphanCustomers.map((c) => [c.id, c]));

    const enriched = data.map((row) => {
      const byCode = row.currentStageCode
        ? row.stages.find((s) => s.stageDefinition.code === row.currentStageCode)
        : null;
      const inProgress = row.stages.find((s) => s.status === 'IN_PROGRESS');
      const stage = byCode ?? inProgress ?? null;
      const def = stage?.stageDefinition;
      const customer =
        row.salesOrder?.customer ??
        (row.customerId ? orphanById.get(row.customerId) ?? null : null);
      return {
        ...row,
        customer,
        imageUrl: row.product?.imageUrl ?? null,
        currentStage: def
          ? {
              code: def.code,
              nameEn: def.nameEn,
              nameAr: def.nameAr,
              nameHe: def.nameHe,
            }
          : row.currentStageCode
            ? { code: row.currentStageCode, nameEn: row.currentStageCode, nameAr: row.currentStageCode, nameHe: null }
            : null,
      };
    });

    return { data: enriched, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  async getById(id: string, user?: AuthUser) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id, archivedAt: null },
      include: {
        salesOrder: {
          select: {
            id: true,
            number: true,
            status: true,
            externalOrderNumber: true,
            requiredDeliveryDate: true,
          },
        },
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
        documents: {
          where: { archivedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            category: true,
            sizeBytes: true,
            createdAt: true,
          },
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
