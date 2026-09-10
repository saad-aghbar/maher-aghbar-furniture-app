import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@maher/database';
import { can } from '@maher/permissions';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import { assertCustomerOwns } from '../../common/helpers/customer-scope';
import { roundMoney } from '../../common/helpers/money.util';
import { ListCreatableSourcesDto, ListInvoicesDto, UpdateInvoiceDto } from './dto/invoice.dto';
import { invoiceKindWhere } from './invoice-list-kind';
import { normalizeInvoiceTaxRate, taxAmountOnNet } from './invoice-tax-rate';
import {
  orderSourceFromRow,
  paginateSources,
  purchaseSourceFromRow,
  returnSourceFromRow,
  type InvoiceCreatableSource,
} from './invoice-creatable-sources';
import { NotificationsService } from '../notifications/notifications.service';
import { ManufacturingCostService } from '../production/manufacturing-cost.service';
import {
  classifyInvoice,
  commercialLinesReady,
  money,
  summarizeDealerFinance,
} from '../payments/dealer-finance';

const RETURN_REQUEST_DETAIL = {
  select: {
    id: true,
    number: true,
    productDesc: true,
    responsibility: true,
    chargeAmount: true,
    factoryShareAmount: true,
    chargeStatus: true,
    chargeSentAt: true,
    chargeConfirmedAt: true,
    chargeRejectedAt: true,
    chargeRejectionNote: true,
    lifecycleState: true,
    resolution: true,
    salesOrder: { select: { id: true, number: true } },
    pieces: {
      select: { id: true, code: true, pieceNo: true, decision: true, state: true },
      orderBy: { pieceNo: 'asc' as const },
    },
  },
} as const;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly manufacturingCost?: ManufacturingCostService,
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
      ...invoiceKindWhere(query.kind),
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
              { returnRequest: { number: { contains: query.q, mode: 'insensitive' } } },
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
          returnRequest: {
            select: { id: true, number: true, productDesc: true, chargeStatus: true },
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
        returnRequest: RETURN_REQUEST_DETAIL,
      },
    });
    if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found.' });
    if (!assertCustomerOwns(user, invoice.customerId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your invoice.' });
    }
    const finance = await this.dealerFinance(invoice.customerId);
    const reworkCost =
      invoice.returnRequestId && this.manufacturingCost
        ? await this.manufacturingCost.summaryForReturn(invoice.returnRequestId, user)
        : null;
    return {
      ...invoice,
      reworkCost,
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

  /** Staff edit — notes, dates, header money, links, and line amounts. */
  async update(id: string, dto: UpdateInvoiceDto, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, archivedAt: null },
      include: { lines: true },
    });
    if (!invoice) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found.' });
    }
    if (
      invoice.status === InvoiceStatus.CANCELLED ||
      invoice.status === InvoiceStatus.VOID
    ) {
      throw new BadRequestException({
        code: 'INVOICE_LOCKED',
        message: 'Cancelled or void invoices cannot be edited.',
      });
    }

    const paid = Number(invoice.paidAmount) || 0;

    let subtotal = Number(invoice.subtotal);
    let discountTotal = Number(invoice.discountTotal);
    let taxTotal = Number(invoice.taxTotal);
    let total = Number(invoice.total);
    let lineCreates:
      | Array<{
          description: string;
          quantity: Prisma.Decimal | number;
          unitPrice: Prisma.Decimal | number;
          taxRate: Prisma.Decimal | number;
          lineTotal: Prisma.Decimal | number;
          sortOrder: number;
        }>
      | undefined;

    if (dto.lines) {
      if (dto.lines.length === 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invoice must keep at least one line.',
        });
      }
      lineCreates = dto.lines.map((l, i) => {
        const qty = Number(roundMoney(Number(l.quantity)));
        const unit = Number(roundMoney(Number(l.unitPrice)));
        const taxRate = normalizeInvoiceTaxRate(l.taxRate);
        const net = Number(roundMoney(qty * unit));
        const tax = Number(roundMoney(taxAmountOnNet(net, taxRate)));
        return {
          description: l.description.trim() || 'Line',
          quantity: qty,
          unitPrice: unit,
          taxRate,
          lineTotal: Number(roundMoney(net + tax)),
          sortOrder: i,
        };
      });
      subtotal = Number(
        roundMoney(
          lineCreates.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0),
        ),
      );
      taxTotal = Number(
        roundMoney(
          lineCreates.reduce((s, l) => {
            const net = Number(l.quantity) * Number(l.unitPrice);
            return s + taxAmountOnNet(net, l.taxRate);
          }, 0),
        ),
      );
      total = Number(roundMoney(subtotal - discountTotal + taxTotal));
    }

    const headerOverride =
      dto.subtotal !== undefined ||
      dto.discountTotal !== undefined ||
      dto.taxTotal !== undefined ||
      dto.total !== undefined;
    if (dto.subtotal !== undefined) subtotal = Number(roundMoney(dto.subtotal));
    if (dto.discountTotal !== undefined) discountTotal = Number(roundMoney(dto.discountTotal));
    if (dto.taxTotal !== undefined) taxTotal = Number(roundMoney(dto.taxTotal));
    if (dto.total !== undefined) total = Number(roundMoney(dto.total));
    else if (headerOverride) {
      total = Number(roundMoney(subtotal - discountTotal + taxTotal));
    }

    if (total + 1e-9 < paid) {
      throw new BadRequestException({
        code: 'INVOICE_TOTAL_BELOW_PAID',
        message: 'Invoice total cannot be less than amount already paid.',
      });
    }

    let nextSalesOrderId =
      dto.salesOrderId !== undefined ? dto.salesOrderId : invoice.salesOrderId;
    let nextReturnRequestId =
      dto.returnRequestId !== undefined ? dto.returnRequestId : invoice.returnRequestId;
    if (dto.returnRequestId) nextSalesOrderId = null;
    if (dto.salesOrderId) nextReturnRequestId = null;
    if (nextSalesOrderId && nextReturnRequestId) {
      throw new BadRequestException({
        code: 'INVOICE_LINK_CONFLICT',
        message: 'An invoice cannot link to both a sales order and a return.',
      });
    }
    if (nextSalesOrderId) {
      const so = await this.prisma.salesOrder.findFirst({
        where: { id: nextSalesOrderId, archivedAt: null },
        select: { id: true, customerId: true },
      });
      if (!so) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order not found.' });
      if (so.customerId !== invoice.customerId) {
        throw new BadRequestException({
          code: 'CUSTOMER_MISMATCH',
          message: 'Linked sales order must belong to the same dealer.',
        });
      }
    }
    if (nextReturnRequestId) {
      const ret = await this.prisma.returnRequest.findFirst({
        where: { id: nextReturnRequestId },
        select: { id: true, customerId: true },
      });
      if (!ret) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
      if (ret.customerId !== invoice.customerId) {
        throw new BadRequestException({
          code: 'CUSTOMER_MISMATCH',
          message: 'Linked return must belong to the same dealer.',
        });
      }
    }

    const nextDue =
      dto.dueDate !== undefined
        ? dto.dueDate
          ? new Date(dto.dueDate)
          : null
        : invoice.dueDate;
    const outstanding = Number(roundMoney(Math.max(0, total - paid)));
    let status: InvoiceStatus = invoice.status;
    if (dto.status === InvoiceStatus.CANCELLED || dto.status === InvoiceStatus.VOID) {
      status = dto.status;
    } else if (outstanding <= 0.001) {
      status = InvoiceStatus.PAID;
    } else if (dto.status && dto.status !== InvoiceStatus.PAID) {
      status = dto.status;
    } else if (invoice.status !== InvoiceStatus.DRAFT) {
      if (paid > 0.001) status = InvoiceStatus.PARTIALLY_PAID;
      else if (nextDue && nextDue.getTime() < Date.now() && outstanding > 0.001) {
        status = InvoiceStatus.OVERDUE;
      } else {
        status = InvoiceStatus.ISSUED;
      }
    }
    if (dto.status === InvoiceStatus.PAID && outstanding > 0.001) {
      throw new BadRequestException({
        code: 'INVOICE_NOT_SETTLED',
        message: 'Cannot mark an invoice paid while an amount is still outstanding.',
      });
    }

    const moneyChanged = Boolean(lineCreates) || headerOverride;
    await this.prisma.$transaction(async (tx) => {
      if (lineCreates) {
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLine.createMany({
          data: lineCreates.map((l) => ({ ...l, invoiceId: id })),
        });
      }
      await tx.invoice.update({
        where: { id },
        data: {
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.dueDate !== undefined ? { dueDate: nextDue } : {}),
          ...(dto.invoiceDate ? { invoiceDate: new Date(dto.invoiceDate) } : {}),
          ...(dto.currency ? { currency: dto.currency } : {}),
          ...(dto.salesOrderId !== undefined || dto.returnRequestId !== undefined
            ? { salesOrderId: nextSalesOrderId, returnRequestId: nextReturnRequestId }
            : {}),
          ...(moneyChanged
            ? {
                subtotal,
                discountTotal,
                taxTotal,
                total,
                outstandingAmount: outstanding,
                status,
              }
            : dto.status !== undefined || dto.dueDate !== undefined
              ? { status }
              : {}),
        },
      });
      await tx.auditEvent.create({
        data: {
          userId,
          action: 'invoice.update',
          entityType: 'Invoice',
          entityId: id,
          oldValues: {
            subtotal: Number(invoice.subtotal),
            taxTotal: Number(invoice.taxTotal),
            total: Number(invoice.total),
            status: invoice.status,
            salesOrderId: invoice.salesOrderId,
            returnRequestId: invoice.returnRequestId,
          },
          newValues: {
            notes: dto.notes,
            dueDate: dto.dueDate,
            lines: Boolean(lineCreates),
            subtotal,
            discountTotal,
            taxTotal,
            total,
            status,
            salesOrderId: nextSalesOrderId,
            returnRequestId: nextReturnRequestId,
          },
        },
      });
    });

    return this.get(id);
  }

  async listCreatableSources(query: ListCreatableSourcesDto, user: AuthUser) {
    const { page, pageSize } = pageSkipTake(query);
    const kind = query.kind ?? 'ALL';
    const needle = query.q?.trim();
    const includePurchasing = (kind === 'ALL' || kind === 'PURCHASING') && can(user, 'supplier-invoice.create');
    const rows: InvoiceCreatableSource[] = [];

    if (kind === 'ALL' || kind === 'ORDER') {
      const orders = await this.prisma.salesOrder.findMany({
        where: {
          archivedAt: null,
          ...(needle
            ? {
                OR: [
                  { number: { contains: needle, mode: 'insensitive' } },
                  { projectName: { contains: needle, mode: 'insensitive' } },
                  { externalOrderNumber: { contains: needle, mode: 'insensitive' } },
                  { customer: { name: { contains: needle, mode: 'insensitive' } } },
                  { customer: { nameEn: { contains: needle, mode: 'insensitive' } } },
                  { customer: { nameAr: { contains: needle, mode: 'insensitive' } } },
                  { customer: { code: { contains: needle, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
        include: {
          customer: { select: { name: true, nameEn: true, nameAr: true, nameHe: true, code: true } },
          lines: {
            select: {
              unitPrice: true,
              commercialPriceStatus: true,
              product: { select: { imageUrl: true } },
            },
          },
          invoices: {
            where: { archivedAt: null, status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.VOID] } },
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      });
      rows.push(...orders.map(orderSourceFromRow));
    }

    if (kind === 'ALL' || kind === 'RETURN') {
      const returns = await this.prisma.returnRequest.findMany({
        where: {
          ...(needle
            ? {
                OR: [
                  { number: { contains: needle, mode: 'insensitive' } },
                  { productDesc: { contains: needle, mode: 'insensitive' } },
                  { customer: { name: { contains: needle, mode: 'insensitive' } } },
                  { customer: { nameEn: { contains: needle, mode: 'insensitive' } } },
                  { customer: { code: { contains: needle, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
        include: {
          customer: { select: { name: true, nameEn: true, nameAr: true, nameHe: true, code: true } },
          chargeInvoices: {
            where: { archivedAt: null, status: { not: InvoiceStatus.CANCELLED } },
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      });
      rows.push(...returns.map(returnSourceFromRow));
    }

    if (includePurchasing) {
      const pos = await this.prisma.purchaseOrder.findMany({
        where: {
          archivedAt: null,
          ...(needle
            ? {
                OR: [
                  { number: { contains: needle, mode: 'insensitive' } },
                  { supplier: { name: { contains: needle, mode: 'insensitive' } } },
                  { supplier: { nameEn: { contains: needle, mode: 'insensitive' } } },
                  { supplier: { code: { contains: needle, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
        include: {
          supplier: { select: { name: true, nameEn: true, nameAr: true, nameHe: true, code: true } },
          supplierInvoices: {
            where: { archivedAt: null, status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.VOID] } },
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      });
      rows.push(...pos.map(purchaseSourceFromRow));
    }

    return {
      data: paginateSources(rows, page, pageSize),
      meta: paginatedMeta(page, pageSize, rows.length),
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

  /**
   * Standalone return charge — never mutates the sales-order invoice.
   * `salesOrderId` stays null; `returnRequestId` is the only commercial link.
   */
  async createFromReturn(input: {
    returnId: string;
    customerId: string;
    amount: number;
    description: string;
    userId: string;
  }) {
    const existing = await this.prisma.invoice.findFirst({
      where: {
        returnRequestId: input.returnId,
        status: { not: InvoiceStatus.CANCELLED },
        archivedAt: null,
      },
    });
    if (existing) return existing;

    const amountNum = Number(input.amount);
    if (!(amountNum > 0)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Charge amount must be greater than zero.',
      });
    }
    const amount = roundMoney(amountNum);

    const customer = await this.prisma.customer.findFirst({
      where: { id: input.customerId, archivedAt: null },
    });
    if (!customer) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Customer not found.' });
    }

    const number = await this.sequences.next('INV', 'INV');
    const invoiceDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (customer.paymentTermsDays || 30));
    const description = input.description.trim() || `Return charge ${input.returnId}`;
    const lines = [
      {
        description,
        quantity: 1,
        unitPrice: amount,
        taxRate: 0,
        lineTotal: amount,
        sortOrder: 0,
      },
    ];

    const invoice = await this.prisma.invoice.create({
      data: {
        number,
        customerId: customer.id,
        salesOrderId: null,
        returnRequestId: input.returnId,
        invoiceDate,
        dueDate,
        currency: 'ILS',
        status: InvoiceStatus.ISSUED,
        subtotal: amount,
        taxTotal: 0,
        discountTotal: roundMoney(0),
        total: amount,
        paidAmount: 0,
        outstandingAmount: amount,
        createdById: input.userId,
        notes: description,
        lines: { create: lines },
      },
      include: { lines: true, customer: true },
    });

    await this.prisma.returnRequest.update({
      where: { id: input.returnId },
      data: { chargeAmount: amount, chargeStatus: 'INVOICED' },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: input.userId,
        action: 'invoice.create',
        entityType: 'ReturnRequest',
        entityId: input.returnId,
        newValues: { invoiceId: invoice.id, salesOrderId: null },
      },
    });

    await this.notifications
      .notifyCustomerUsers(customer.id, {
        templateCode: 'INVOICE_CREATED',
        vars: { number: invoice.number, total: String(invoice.total) },
        linkUrl: `/invoices/${invoice.id}`,
      })
      .catch(() => undefined);

    return invoice;
  }

  /**
   * Idempotent return invoice at factory exit. No-ops unless the dealer
   * charge is confirmed and greater than zero.
   */
  async ensureFromReturn(returnId: string, userId: string) {
    const row = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: {
        chargeInvoices: {
          where: { status: { not: InvoiceStatus.CANCELLED }, archivedAt: null },
          take: 1,
        },
      },
    });
    if (!row) return null;
    if (row.chargeInvoices[0]) {
      if (row.chargeStatus !== 'INVOICED') {
        await this.prisma.returnRequest.update({
          where: { id: returnId },
          data: { chargeStatus: 'INVOICED' },
        });
      }
      return row.chargeInvoices[0];
    }
    if (row.chargeStatus !== 'CONFIRMED') return null;
    const amount = Number(row.chargeAmount ?? 0);
    if (!(amount > 0)) return null;
    return this.createFromReturn({
      returnId: row.id,
      customerId: row.customerId,
      amount,
      description: `Return work ${row.number} — ${row.productDesc}`,
      userId,
    });
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
