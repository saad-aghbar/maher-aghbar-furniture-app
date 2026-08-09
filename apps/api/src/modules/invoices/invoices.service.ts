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
import { paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import { assertCustomerOwns } from '../../common/helpers/customer-scope';
import { JOFOTARA_PROVIDER } from '../../integrations/integrations.module';
import type { ListInvoicesDto } from './dto/invoice.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    @Inject(JOFOTARA_PROVIDER) private readonly jofotara: JoFotaraProvider,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: ListInvoicesDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where: Prisma.InvoiceWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { salesOrder: { number: { contains: query.q, mode: 'insensitive' } } },
              {
                salesOrder: {
                  externalOrderNumber: { contains: query.q, mode: 'insensitive' },
                },
              },
              { customer: { name: { contains: query.q, mode: 'insensitive' } } },
              { customer: { nameAr: { contains: query.q, mode: 'insensitive' } } },
              { customer: { nameEn: { contains: query.q, mode: 'insensitive' } } },
              { customer: { nameHe: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          lines: true,
          salesOrder: {
            select: { id: true, number: true, status: true, externalOrderNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  async get(id: string, user?: AuthUser) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, archivedAt: null },
      include: {
        customer: true,
        lines: true,
        payments: true,
        salesOrder: {
          select: { id: true, number: true, status: true, externalOrderNumber: true },
        },
      },
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

    const invoice = await this.prisma.invoice.create({
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

    await this.notifications
      .notifyCustomerUsers(so.customerId, {
        templateCode: 'INVOICE_CREATED',
        vars: { number: invoice.number, total: String(invoice.total) },
        linkUrl: `/invoices/${invoice.id}`,
      })
      .catch(() => undefined);

    return invoice;
  }

  /** Idempotent — skips when a non-cancelled invoice already exists for the SO. */
  async ensureFromSalesOrder(salesOrderId: string, userId: string) {
    const existing = await this.prisma.invoice.findFirst({
      where: { salesOrderId, status: { not: InvoiceStatus.CANCELLED }, archivedAt: null },
    });
    if (existing) return existing;
    try {
      return await this.createFromSalesOrder(salesOrderId, userId);
    } catch (err) {
      if (err instanceof BadRequestException) {
        const body = err.getResponse();
        if (typeof body === 'object' && body && 'code' in body && body.code === 'INVOICE_EXISTS') {
          return this.prisma.invoice.findFirstOrThrow({
            where: { salesOrderId, status: { not: InvoiceStatus.CANCELLED }, archivedAt: null },
          });
        }
      }
      throw err;
    }
  }
}
