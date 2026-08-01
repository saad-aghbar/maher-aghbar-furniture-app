import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SalesOrderStatus } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { assertCustomerOwns, customerScopeFilter } from '../../common/helpers/customer-scope';
import { ListSalesOrdersDto } from './dto/sales-order.dto';

@Injectable()
export class SalesOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  async list(query: ListSalesOrdersDto, user?: AuthUser) {
    const where: Prisma.SalesOrderWhereInput = {
      archivedAt: null,
      ...customerScopeFilter(user),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { projectName: { contains: query.q, mode: 'insensitive' } },
              { customer: { name: { contains: query.q, mode: 'insensitive' } } },
              { customer: { nameAr: { contains: query.q, mode: 'insensitive' } } },
              { customer: { nameEn: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, nameAr: true, nameEn: true, nameHe: true, code: true },
          },
          quotation: { select: { id: true, number: true } },
          productionOrders: {
            select: {
              id: true,
              number: true,
              status: true,
              currentStageCode: true,
              progressPercent: true,
            },
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
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, archivedAt: null },
      include: {
        customer: true,
        quotation: { select: { id: true, number: true, status: true } },
        contracts: { select: { id: true, number: true, status: true, contractValue: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        productionOrders: {
          include: {
            stages: {
              include: {
                stageDefinition: {
                  select: {
                    code: true,
                    nameEn: true,
                    nameAr: true,
                    sortOrder: true,
                  },
                },
              },
              orderBy: { stageDefinition: { sortOrder: 'asc' } },
            },
          },
        },
        invoices: {
          select: { id: true, number: true, status: true, total: true, outstandingAmount: true },
        },
        deliveries: {
          select: {
            id: true,
            number: true,
            status: true,
            deliveryDate: true,
            deliveryWindow: true,
            recipientName: true,
            deliveryAddress: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order not found.' });
    if (!assertCustomerOwns(user, order.customerId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your sales order.' });
    }

    const productionOrders = order.productionOrders.map((po) => ({
      id: po.id,
      number: po.number,
      status: po.status,
      currentStageCode: po.currentStageCode,
      progressPercent: po.progressPercent,
      stages: po.stages.map((s) => ({
        code: s.stageDefinition.code,
        nameEn: s.stageDefinition.nameEn,
        nameAr: s.stageDefinition.nameAr,
        sortOrder: s.stageDefinition.sortOrder,
        status: s.status,
        progressPercent: s.progressPercent,
        actualStart: s.actualStart,
        actualEnd: s.actualEnd,
      })),
    }));

    return {
      ...order,
      productionOrders,
    };
  }

  async confirm(id: string, userId: string) {
    const order = await this.getById(id);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only draft sales orders can be confirmed.',
      });
    }

    const productionLines = order.lines.filter((l) => l.productionRequired);
    if (!productionLines.length) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Sales order has no production-required lines.',
      });
    }

    const stages = await this.prisma.productionStageDefinition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    if (!stages.length) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'No active production stage definitions configured.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of productionLines) {
        const poNumber = await this.sequences.next('PO', 'PO');
        const productionOrder = await tx.productionOrder.create({
          data: {
            number: poNumber,
            salesOrderId: order.id,
            salesOrderLineId: line.id,
            customerId: order.customerId,
            productId: line.productId ?? undefined,
            productDescription: line.description,
            quantity: line.quantity,
            specifications: line.specifications ?? undefined,
            requiredDeliveryDate: order.requiredDeliveryDate ?? undefined,
            status: 'PLANNED',
            createdById: userId,
            stages: {
              create: stages.map((stage) => ({
                stageDefinitionId: stage.id,
                status: 'PENDING',
              })),
            },
          },
          include: { stages: true },
        });

        for (const stageInstance of productionOrder.stages) {
          const stageDef = stages.find((s) => s.id === stageInstance.stageDefinitionId)!;
          const taskNumber = await this.sequences.next('TASK', 'TSK');
          await tx.productionTask.create({
            data: {
              number: taskNumber,
              productionOrderId: productionOrder.id,
              stageDefinitionId: stageDef.id,
              stageInstanceId: stageInstance.id,
              name: stageDef.nameEn,
              status: 'NOT_STARTED',
            },
          });
        }
      }

      return tx.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.READY_FOR_PRODUCTION },
        include: {
          lines: true,
          productionOrders: { include: { stages: true, tasks: true } },
        },
      });
    });
  }

  async hold(id: string, userId: string, reason?: string) {
    const order = await this.getById(id);
    const holdable: SalesOrderStatus[] = [
      SalesOrderStatus.CONFIRMED,
      SalesOrderStatus.READY_FOR_PRODUCTION,
      SalesOrderStatus.IN_PRODUCTION,
      SalesOrderStatus.WAITING_FOR_MATERIALS,
      SalesOrderStatus.WAITING_FOR_PAYMENT,
    ];
    if (!holdable.includes(order.status as SalesOrderStatus)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot hold sales order in status ${order.status}.`,
      });
    }
    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        status: SalesOrderStatus.ON_HOLD,
        notes: reason
          ? [order.notes, `Hold: ${reason}`].filter(Boolean).join('\n')
          : order.notes,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'sales-order.hold',
        entityType: 'SalesOrder',
        entityId: id,
        newValues: { reason: reason ?? null },
      },
    });
    return updated;
  }

  async cancel(id: string, userId: string, reason?: string) {
    const order = await this.getById(id);
    const cancellable: SalesOrderStatus[] = [
      SalesOrderStatus.DRAFT,
      SalesOrderStatus.CONFIRMED,
      SalesOrderStatus.READY_FOR_PRODUCTION,
      SalesOrderStatus.ON_HOLD,
      SalesOrderStatus.WAITING_FOR_PAYMENT,
      SalesOrderStatus.WAITING_FOR_MATERIALS,
    ];
    if (!cancellable.includes(order.status as SalesOrderStatus)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot cancel sales order in status ${order.status}.`,
      });
    }
    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        status: SalesOrderStatus.CANCELLED,
        cancellationReason: reason ?? 'Cancelled',
      },
    });
    await this.prisma.productionOrder.updateMany({
      where: {
        salesOrderId: id,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      data: { status: 'CANCELLED' },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'sales-order.cancel',
        entityType: 'SalesOrder',
        entityId: id,
        newValues: { reason: reason ?? null },
      },
    });
    return updated;
  }

  async setStatus(id: string, status: SalesOrderStatus) {
    return this.prisma.salesOrder.update({
      where: { id },
      data: { status },
    });
  }
}
