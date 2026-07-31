import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import { roundMoney } from '../../common/helpers/money.util';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  async list(query: PaginationDto & { status?: string; customerId?: string }) {
    const where: Prisma.InvoiceWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status as InvoiceStatus } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.q
        ? { OR: [{ number: { contains: query.q, mode: 'insensitive' } }] }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: { customer: true, lines: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  async get(id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, archivedAt: null },
      include: { customer: true, lines: true, payments: true, salesOrder: true },
    });
    if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found.' });
    return invoice;
  }

  async createFromSalesOrder(salesOrderId: string, userId: string) {
    const so = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, archivedAt: null },
      include: { lines: true },
    });
    if (!so) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order not found.' });

    const existing = await this.prisma.invoice.findFirst({
      where: { salesOrderId, status: { not: InvoiceStatus.CANCELLED }, archivedAt: null },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'INVOICE_EXISTS',
        message: 'An invoice already exists for this sales order.',
      });
    }

    const number = await this.sequences.next('INV', 'INV');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    return this.prisma.invoice.create({
      data: {
        number,
        customerId: so.customerId,
        salesOrderId: so.id,
        dueDate,
        currency: so.currency,
        status: InvoiceStatus.ISSUED,
        subtotal: so.subtotal,
        taxTotal: so.taxTotal,
        total: so.total,
        paidAmount: 0,
        outstandingAmount: so.total,
        createdById: userId,
        lines: {
          create: so.lines.map((l, i) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
            lineTotal: l.lineTotal,
            sortOrder: i,
          })),
        },
      },
      include: { lines: true, customer: true },
    });
  }
}
