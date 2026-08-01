import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@maher/database';
import type { JoFotaraProvider } from '@maher/integrations';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import { assertCustomerOwns } from '../../common/helpers/customer-scope';
import { JOFOTARA_PROVIDER } from '../../integrations/integrations.module';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    @Inject(JOFOTARA_PROVIDER) private readonly jofotara: JoFotaraProvider,
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

  async get(id: string, user?: AuthUser) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, archivedAt: null },
      include: { customer: true, lines: true, payments: true, salesOrder: true },
    });
    if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found.' });
    if (!assertCustomerOwns(user, invoice.customerId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your invoice.' });
    }
    return invoice;
  }

  async createFromSalesOrder(salesOrderId: string, userId: string) {
    const so = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, archivedAt: null },
      include: { lines: true, customer: true },
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

    const invoiceDate = new Date();
    const lines = so.lines.map((l, i) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
      lineTotal: l.lineTotal,
      sortOrder: i,
    }));

    let clearance;
    try {
      clearance = await this.jofotara.submitInvoice({
        invoiceNumber: number,
        invoiceDate: invoiceDate.toISOString().slice(0, 10),
        currency: so.currency,
        customerName:
          so.customer.nameAr ||
          so.customer.nameEn ||
          so.customer.nameHe ||
          so.customer.name ||
          undefined,
        customerTaxId: so.customer.taxNumber ?? null,
        subtotal: Number(so.subtotal),
        taxTotal: Number(so.taxTotal),
        total: Number(so.total),
        lines: lines.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          taxRate: Number(l.taxRate),
          lineTotal: Number(l.lineTotal),
        })),
      });
    } catch (err) {
      if (this.jofotara.hasCredentials) {
        const message = err instanceof Error ? err.message : 'JoFotara clearance failed';
        throw new BadRequestException({ code: 'JOFOTARA_FAILED', message });
      }
      throw err;
    }

    return this.prisma.invoice.create({
      data: {
        number,
        customerId: so.customerId,
        salesOrderId: so.id,
        invoiceDate,
        dueDate,
        currency: so.currency,
        status: InvoiceStatus.ISSUED,
        subtotal: so.subtotal,
        taxTotal: so.taxTotal,
        total: so.total,
        paidAmount: 0,
        outstandingAmount: so.total,
        createdById: userId,
        jofotaraUuid: clearance.uuid,
        jofotaraQr: clearance.qr,
        jofotaraStatus: clearance.status,
        jofotaraClearedAt: clearance.clearedAt,
        lines: { create: lines },
      },
      include: { lines: true, customer: true },
    });
  }
}
