import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { ListProductionOrdersDto } from './dto/production.dto';

@Injectable()
export class ProductionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListProductionOrdersDto) {
    const where: Prisma.ProductionOrderWhereInput = {
      archivedAt: null,
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
          stages: { include: { stageDefinition: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  async getById(id: string) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id, archivedAt: null },
      include: {
        salesOrder: true,
        product: true,
        stages: { include: { stageDefinition: true, tasks: true } },
        tasks: { include: { assignedEmployee: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
    return order;
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

    return this.prisma.productionOrder.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        actualStartDate: new Date(),
        currentStageCode: order.stages[0]?.stageDefinition?.code,
      },
      include: { stages: true, tasks: true },
    });
  }
}
