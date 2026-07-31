import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { ListSalesOrdersDto } from './dto/sales-order.dto';

@Injectable()
export class SalesOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  async list(query: ListSalesOrdersDto) {
    const where: Prisma.SalesOrderWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { projectName: { contains: query.q, mode: 'insensitive' } },
              { customer: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, code: true } },
          quotation: { select: { id: true, number: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  async getById(id: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, archivedAt: null },
      include: {
        customer: true,
        quotation: true,
        lines: { orderBy: { sortOrder: 'asc' } },
        productionOrders: { select: { id: true, number: true, status: true } },
        invoices: { select: { id: true, number: true, status: true } },
      },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order not found.' });
    return order;
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

    const poNumber = await this.sequences.next('PO', 'PO');
    const primaryLine = productionLines[0]!;
    const totalQty = productionLines.reduce((sum, l) => sum + Number(l.quantity), 0);

    return this.prisma.$transaction(async (tx) => {
      const productionOrder = await tx.productionOrder.create({
        data: {
          number: poNumber,
          salesOrderId: order.id,
          customerId: order.customerId,
          productId: primaryLine.productId ?? undefined,
          productDescription: productionLines.map((l) => l.description).join('; '),
          quantity: totalQty,
          specifications: productionLines.map((l) => l.specifications).filter(Boolean).join('\n') || undefined,
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

      return tx.salesOrder.update({
        where: { id },
        data: { status: 'CONFIRMED' },
        include: {
          lines: true,
          productionOrders: { include: { stages: true, tasks: true } },
        },
      });
    });
  }
}
