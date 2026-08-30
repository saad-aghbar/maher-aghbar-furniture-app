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
import { roundMoney } from '../../common/helpers/money.util';
import { JOFOTARA_PROVIDER } from '../../integrations/integrations.module';
import type { ListInvoicesDto } from './dto/invoice.dto';
import { NotificationsService } from '../notifications/notifications.service';
import {
  classifyInvoice,
  commercialLinesReady,
  money,
  summarizeDealerFinance,
} from '../payments/dealer-finance';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    @Inject(JOFOTARA_PROVIDER) private readonly jofotara: JoFotaraProvider,
    private readonly notifications: NotificationsService,
  ) {}

  private async dealerFinance(customerId: string) {
    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { customerId, archivedAt: null },
        select: { status: true, outstandingAmount: true, dueDate: true, currency: true },
      }),
      this.prisma.payment.findMany({
        where: { customerId },
        select: { amount: true, allocations: { select: { amount: true } } },
      }),
    ]);
    return summarizeDealerFinance({
      invoices,
      payments,
      currency: invoices[0]?.currency ?? 'ILS',
    });
  }

  async list(
    query: ListInvoicesDto & { dateFrom?: string; dateTo?: string; overdue?: string },
  ) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const invoiceDate: Prisma.DateTimeFilter = {};
    if (query.dateFrom) {
      const from = new Date(query.dateFrom);
      if (!Number.isNaN(from.getTime())) invoiceDate.gte = from;
    }
    if (query.dateTo) {
      const to = new Date(query.dateTo);
      if (!Number.isNaN(to.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(query.dateTo).trim())) to.setHours(23, 59, 59, 999);
        invoiceDate.lte = to;
      }
    }

    const overdueOnly = query.overdue === '1' || query.overdue === 'true';
    const now = new Date();
    // Overdue in DB so count === filtered dataset (not post-page filter).
    const overdueWhere: Prisma.InvoiceWhereInput | undefined = overdueOnly
      ? {
          AND: [
            { outstandingAmount: { gt: 0 } },
            { status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED, InvoiceStatus.VOID, InvoiceStatus.DRAFT] } },
            {
              OR: [
                { status: InvoiceStatus.OVERDUE },
                { dueDate: { lt: now } },
              ],
            },
          ],
        }
      : undefined;

    const where: Prisma.InvoiceWhereInput = {
      archivedAt: null,
      ...(query.status && !overdueOnly ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(Object.keys(invoiceDate).length ? { invoiceDate } : {}),
      ...(overdueWhere ?? {}),
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
              { customer: { code: { contains: query.q, mode: 'insensitive' } } },
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

    const rows = data.map((inv) => ({
      ...inv,
      presentation: classifyInvoice({
        status: inv.status,
        total: money(inv.total),
        paidAmount: money(inv.paidAmount),
        outstandingAmount: money(inv.outstandingAmount),
        dueDate: inv.dueDate,
      }),
    }));

    return { data: rows, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  async get(id: string, user?: AuthUser) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, archivedAt: null },
      include: {
        customer: true,
        lines: true,
        payments: { include: { allocations: true } },
        allocations: { include: { payment: true } },
        salesOrder: {
          select: { id: true, number: true, status: true, externalOrderNumber: true },
        },
      },
    });
    if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found.' });
    if (!assertCustomerOwns(user, invoice.customerId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your invoice.' });
    }
    const finance = await this.dealerFinance(invoice.customerId);
    return {
      ...invoice,
      presentation: classifyInvoice({
        status: invoice.status,
        total: money(invoice.total),
        paidAmount: money(invoice.paidAmount),
        outstandingAmount: money(invoice.outstandingAmount),
        dueDate: invoice.dueDate,
      }),
      dealerFinance: {
        amountDue: finance.amountDue,
        availableCredit: finance.availableCredit,
        openInvoiceCount: finance.openInvoiceCount,
        overdueAmount: finance.overdueAmount,
      },
    };
  }

  async createFromSalesOrder(salesOrderId: string, userId: string, idempotencyKey?: string) {
    if (idempotencyKey) {
      const prior = await this.prisma.auditEvent.findFirst({
        where: {
          action: 'invoice.create',
          entityType: 'SalesOrder',
          entityId: salesOrderId,
          newValues: { path: ['idempotencyKey'], equals: idempotencyKey },
        },
      });
      if (prior?.newValues && typeof prior.newValues === 'object' && 'invoiceId' in (prior.newValues as object)) {
        const invoiceId = (prior.newValues as { invoiceId?: string }).invoiceId;
        if (invoiceId) return this.get(invoiceId);
      }
    }

    const so = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, archivedAt: null },
      include: { lines: true, customer: true },
    });
    if (!so) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order not found.' });

    const gate = commercialLinesReady(so.lines);
    if (!gate.ok) {
      throw new BadRequestException({ code: gate.code, message: gate.message });
    }

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
    dueDate.setDate(dueDate.getDate() + (so.customer.paymentTermsDays || 30));

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
        discountTotal: roundMoney(0),
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

    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'invoice.create',
        entityType: 'SalesOrder',
        entityId: salesOrderId,
        newValues: { invoiceId: invoice.id, idempotencyKey: idempotencyKey ?? null },
      },
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
  async ensureFromSalesOrder(salesOrderId: string, userId: string, idempotencyKey?: string) {
    const existing = await this.prisma.invoice.findFirst({
      where: { salesOrderId, status: { not: InvoiceStatus.CANCELLED }, archivedAt: null },
    });
    if (existing) return existing;
    try {
      return await this.createFromSalesOrder(salesOrderId, userId, idempotencyKey);
    } catch (err) {
      if (err instanceof BadRequestException) {
        const body = err.getResponse();
        if (typeof body === 'object' && body && 'code' in body && body.code === 'INVOICE_EXISTS') {
          return this.prisma.invoice.findFirstOrThrow({
            where: { salesOrderId, status: { not: InvoiceStatus.CANCELLED }, archivedAt: null },
          });
        }
        // Auto-ensure on delivery must not fail hard on price gate — rethrow for manual create.
        throw err;
      }
      throw err;
    }
  }

  async commercialSummary(salesOrderId: string, user?: AuthUser) {
    const so = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, archivedAt: null },
      include: {
        lines: true,
        customer: true,
        invoices: {
          where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
        },
      },
    });
    if (!so) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order not found.' });
    if (!assertCustomerOwns(user, so.customerId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your order.' });
    }

    const invoiced = so.invoices.reduce((s, i) => s + money(i.total), 0);
    const paid = so.invoices.reduce((s, i) => s + money(i.paidAmount), 0);
    const remaining = so.invoices.reduce((s, i) => s + money(i.outstandingAmount), 0);
    const gate = commercialLinesReady(so.lines);
    const finance = await this.dealerFinance(so.customerId);

    return {
      salesOrderId: so.id,
      number: so.number,
      dealer: {
        id: so.customer.id,
        code: so.customer.code,
        name: so.customer.nameEn || so.customer.name,
      },
      orderTotal: money(so.total),
      invoiced: Number(roundMoney(invoiced)),
      paid: Number(roundMoney(paid)),
      remaining: Number(roundMoney(remaining)),
      commercialComplete: gate.ok,
      commercialBlock: gate.ok ? null : gate,
      lines: so.lines.map((l) => ({
        id: l.id,
        description: l.description,
        quantity: money(l.quantity),
        unitPrice: money(l.unitPrice),
        lineTotal: money(l.lineTotal),
        manufacturingComplexity: l.manufacturingComplexity,
        commercialPriceStatus: l.commercialPriceStatus,
        commercialPriceSource: l.commercialPriceSource,
        commercialPriceNote: l.commercialPriceNote,
      })),
      dealerFinance: finance,
      invoices: so.invoices.map((i) => ({
        id: i.id,
        number: i.number,
        status: i.status,
        total: money(i.total),
        paidAmount: money(i.paidAmount),
        outstandingAmount: money(i.outstandingAmount),
        presentation: classifyInvoice({
          status: i.status,
          total: money(i.total),
          paidAmount: money(i.paidAmount),
          outstandingAmount: money(i.outstandingAmount),
          dueDate: i.dueDate,
        }),
      })),
    };
  }
}
