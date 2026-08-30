import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, PaymentMethod, Prisma } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import { roundMoney } from '../../common/helpers/money.util';
import { customerScopeFilter } from '../../common/helpers/customer-scope';
import { NotificationsService } from '../notifications/notifications.service';
import type { ListPaymentsDto } from './dto/payment.dto';
import {
  classifyInvoice,
  money,
  paymentUnallocated,
  planFifoCreditApplication,
  recomputeInvoicePaidFromAllocations,
  summarizeDealerFinance,
} from './dealer-finance';

type AllocationInput = { invoiceId: string; amount: number };

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: ListPaymentsDto & { dateFrom?: string; dateTo?: string; method?: string }, user?: AuthUser) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const paymentDate: Prisma.DateTimeFilter = {};
    if (query.dateFrom) {
      const from = new Date(query.dateFrom);
      if (!Number.isNaN(from.getTime())) paymentDate.gte = from;
    }
    if (query.dateTo) {
      const to = new Date(query.dateTo);
      if (!Number.isNaN(to.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(query.dateTo).trim())) to.setHours(23, 59, 59, 999);
        paymentDate.lte = to;
      }
    }
    const where: Prisma.PaymentWhereInput = {
      ...customerScopeFilter(user),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.method ? { method: query.method as PaymentMethod } : {}),
      ...(Object.keys(paymentDate).length ? { paymentDate } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { referenceNumber: { contains: query.q, mode: 'insensitive' } },
              { customer: { name: { contains: query.q, mode: 'insensitive' } } },
              { customer: { nameEn: { contains: query.q, mode: 'insensitive' } } },
              { customer: { nameAr: { contains: query.q, mode: 'insensitive' } } },
              { customer: { code: { contains: query.q, mode: 'insensitive' } } },
              { invoice: { number: { contains: query.q, mode: 'insensitive' } } },
              {
                allocations: {
                  some: { invoice: { number: { contains: query.q, mode: 'insensitive' } } },
                },
              },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: {
          customer: true,
          invoice: true,
          allocations: { include: { invoice: { select: { id: true, number: true, total: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    const enriched = data.map((p) => {
      const allocSum = p.allocations.reduce((s, a) => s + money(a.amount), 0);
      return {
        ...p,
        allocatedAmount: Number(roundMoney(allocSum)),
        unallocatedAmount: paymentUnallocated(money(p.amount), p.allocations.map((a) => money(a.amount))),
      };
    });
    return { data: enriched, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  async getDealerFinanceSummary(customerId: string) {
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

  /**
   * Record payment with optional multi-invoice allocations.
   * Overpay allowed: unallocated remainder = dealer advance credit.
   */
  async record(
    dto: {
      customerId: string;
      invoiceId?: string;
      amount: number;
      method?: PaymentMethod;
      referenceNumber?: string;
      bank?: string;
      notes?: string;
      idempotencyKey?: string;
      allocations?: AllocationInput[];
    },
    userId: string,
  ) {
    if (dto.amount <= 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Amount must be positive.' });
    }

    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { allocations: true, customer: true, invoice: true },
      });
      if (existing) return this.enrichPayment(existing);
    }

    // Normalize allocations: prefer explicit list; else single invoiceId up to min(amount, outstanding).
    let allocations: AllocationInput[] = (dto.allocations ?? [])
      .map((a) => ({ invoiceId: a.invoiceId, amount: money(a.amount) }))
      .filter((a) => a.amount > 0);

    return this.prisma
      .$transaction(async (tx) => {
        if (!allocations.length && dto.invoiceId) {
          const inv = await tx.invoice.findFirst({
            where: { id: dto.invoiceId, archivedAt: null },
          });
          if (!inv) {
            throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found.' });
          }
          if (inv.customerId !== dto.customerId) {
            throw new BadRequestException({
              code: 'CUSTOMER_MISMATCH',
              message: 'Invoice does not belong to this dealer.',
            });
          }
          const open = Math.max(0, money(inv.outstandingAmount));
          const apply = Math.min(money(dto.amount), open);
          if (apply > 0) allocations = [{ invoiceId: inv.id, amount: apply }];
        }

        const allocSum = allocations.reduce((s, a) => s + a.amount, 0);
        if (allocSum - money(dto.amount) > 1e-6) {
          throw new BadRequestException({
            code: 'OVER_ALLOCATION',
            message: 'Allocated amount cannot exceed payment amount.',
          });
        }

        // Validate each invoice open remaining (within this tx, sequential).
        const openByInvoice = new Map<string, number>();
        for (const a of allocations) {
          const inv = await tx.invoice.findFirst({
            where: { id: a.invoiceId, archivedAt: null },
          });
          if (!inv) {
            throw new NotFoundException({ code: 'NOT_FOUND', message: `Invoice ${a.invoiceId} not found.` });
          }
          if (inv.customerId !== dto.customerId) {
            throw new BadRequestException({
              code: 'CUSTOMER_MISMATCH',
              message: 'Cannot allocate across dealers.',
            });
          }
          const open = openByInvoice.get(inv.id) ?? Math.max(0, money(inv.outstandingAmount));
          if (a.amount - open > 1e-6) {
            throw new BadRequestException({
              code: 'OVER_ALLOCATION',
              message: `Allocation exceeds open balance for invoice ${inv.number}.`,
            });
          }
          openByInvoice.set(inv.id, open - a.amount);
        }

        const number = await this.sequences.next('PAY', 'PAY');
        const primaryInvoiceId =
          allocations.length === 1 ? allocations[0]!.invoiceId : dto.invoiceId ?? null;

        const payment = await tx.payment.create({
          data: {
            number,
            customerId: dto.customerId,
            invoiceId: primaryInvoiceId,
            amount: roundMoney(dto.amount),
            method: dto.method ?? PaymentMethod.BANK_TRANSFER,
            referenceNumber: dto.referenceNumber,
            bank: dto.bank,
            notes: dto.notes,
            createdById: userId,
            idempotencyKey: dto.idempotencyKey,
            allocations: {
              create: allocations.map((a) => ({
                invoiceId: a.invoiceId,
                amount: roundMoney(a.amount),
                createdById: userId,
              })),
            },
          },
          include: { allocations: true, customer: true, invoice: true },
        });

        // Recompute each touched invoice from all allocations.
        const touched = [...new Set(allocations.map((a) => a.invoiceId))];
        for (const invoiceId of touched) {
          await this.recomputeInvoiceFromAllocations(tx, invoiceId);
        }

        await tx.auditEvent.create({
          data: {
            userId,
            action: 'payment.record',
            entityType: 'Payment',
            entityId: payment.id,
            newValues: {
              amount: dto.amount,
              allocations,
              unallocated: paymentUnallocated(
                money(dto.amount),
                allocations.map((a) => a.amount),
              ),
            },
          },
        });

        return payment;
      })
      .then(async (payment) => {
        const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
        await this.notifications
          .sendFromTemplate({
            templateCode: 'PAYMENT_RECEIVED',
            channel: 'WHATSAPP',
            to: { email: customer?.email, phone: customer?.phone },
            vars: { amount: String(dto.amount), number: payment.number },
          })
          .catch(() => undefined);
        await this.notifications
          .notifyCustomerUsers(dto.customerId, {
            templateCode: 'PAYMENT_RECEIVED',
            vars: { amount: String(dto.amount), number: payment.number },
            linkUrl: `/account/statement`,
          })
          .catch(() => undefined);
        return this.enrichPayment(payment);
      });
  }

  /**
   * Apply existing unallocated dealer credit to an invoice (no new Payment).
   * FIFO from oldest payments with remaining unallocated amount.
   */
  async applyCredit(
    dto: {
      invoiceId: string;
      amount?: number;
      idempotencyKey?: string;
    },
    userId: string,
  ) {
    if (dto.idempotencyKey) {
      const prior = await this.prisma.auditEvent.findFirst({
        where: {
          action: 'payment.apply-credit',
          entityType: 'Invoice',
          entityId: dto.invoiceId,
          newValues: { path: ['idempotencyKey'], equals: dto.idempotencyKey },
        },
      });
      if (prior) {
        return this.prisma.invoice.findFirstOrThrow({
          where: { id: dto.invoiceId },
          include: { allocations: true, payments: true, customer: true, lines: true },
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: dto.invoiceId, archivedAt: null },
      });
      if (!invoice) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found.' });
      }
      const outstanding = Math.max(0, money(invoice.outstandingAmount));
      if (outstanding <= 1e-6) {
        throw new BadRequestException({
          code: 'INVOICE_ALREADY_PAID',
          message: 'Invoice has no open balance.',
        });
      }

      const payments = await tx.payment.findMany({
        where: { customerId: invoice.customerId },
        include: { allocations: true },
        orderBy: { paymentDate: 'asc' },
      });

      const withCredit = payments.map((p) => {
        const u = paymentUnallocated(
          money(p.amount),
          p.allocations.map((a) => money(a.amount)),
        );
        return { payment: p, unallocated: u };
      });

      const want = dto.amount != null ? money(dto.amount) : outstanding;
      if (!(want > 0)) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Amount must be positive.' });
      }
      const plan = planFifoCreditApplication({
        paymentsOldestFirst: withCredit.map((r) => ({
          paymentId: r.payment.id,
          unallocated: r.unallocated,
        })),
        invoiceOutstanding: outstanding,
        want,
      });
      if (plan.applyAmount <= 1e-6) {
        throw new BadRequestException({
          code: 'NO_AVAILABLE_CREDIT',
          message: 'Dealer has no available account credit.',
        });
      }

      const created: Array<{ paymentId: string; amount: number }> = [];
      for (const slice of plan.slices) {
        const row = withCredit.find((r) => r.payment.id === slice.paymentId);
        if (!row) continue;
        const existingAlloc = row.payment.allocations.find((a) => a.invoiceId === invoice.id);
        if (existingAlloc) {
          await tx.paymentAllocation.update({
            where: { id: existingAlloc.id },
            data: { amount: roundMoney(money(existingAlloc.amount) + slice.amount) },
          });
        } else {
          await tx.paymentAllocation.create({
            data: {
              paymentId: row.payment.id,
              invoiceId: invoice.id,
              amount: roundMoney(slice.amount),
              createdById: userId,
            },
          });
        }
        created.push({ paymentId: row.payment.id, amount: slice.amount });
      }
      const toApply = plan.applyAmount;

      await this.recomputeInvoiceFromAllocations(tx, invoice.id);

      await tx.auditEvent.create({
        data: {
          userId,
          action: 'payment.apply-credit',
          entityType: 'Invoice',
          entityId: invoice.id,
          newValues: {
            applied: toApply,
            slices: created,
            idempotencyKey: dto.idempotencyKey ?? null,
          },
        },
      });

      return tx.invoice.findFirstOrThrow({
        where: { id: invoice.id },
        include: {
          allocations: true,
          payments: true,
          customer: true,
          lines: true,
          salesOrder: { select: { id: true, number: true } },
        },
      });
    });
  }

  async recomputeInvoiceFromAllocations(
    tx: Prisma.TransactionClient,
    invoiceId: string,
  ) {
    const invoice = await tx.invoice.findFirstOrThrow({ where: { id: invoiceId } });
    const allocs = await tx.paymentAllocation.findMany({
      where: { invoiceId },
      select: { amount: true },
    });
    const sum = allocs.reduce((s, a) => s + money(a.amount), 0);
    const next = recomputeInvoicePaidFromAllocations(money(invoice.total), sum);
    // Preserve OVERDUE presentation via derive on read; store PARTIAL/PAID/ISSUED.
    let status = next.status;
    if (
      status !== InvoiceStatus.PAID &&
      invoice.dueDate &&
      invoice.dueDate.getTime() < Date.now() &&
      next.outstandingAmount > 1e-6
    ) {
      status = InvoiceStatus.OVERDUE;
    }
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: roundMoney(next.paidAmount),
        outstandingAmount: roundMoney(next.outstandingAmount),
        status,
      },
    });
  }

  private enrichPayment(payment: {
    amount: unknown;
    allocations?: Array<{ amount: unknown }>;
    [k: string]: unknown;
  }) {
    const allocs = payment.allocations ?? [];
    const allocatedAmount = allocs.reduce((s, a) => s + money(a.amount), 0);
    return {
      ...payment,
      allocatedAmount: Number(roundMoney(allocatedAmount)),
      unallocatedAmount: paymentUnallocated(
        money(payment.amount),
        allocs.map((a) => money(a.amount)),
      ),
    };
  }

  /** Preview apply-credit without mutating. */
  async previewApplyCredit(invoiceId: string, amount?: number) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, archivedAt: null },
    });
    if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found.' });
    const summary = await this.getDealerFinanceSummary(invoice.customerId);
    const outstanding = Math.max(0, money(invoice.outstandingAmount));
    const want = amount != null ? money(amount) : outstanding;
    const apply = Math.min(want, outstanding, summary.availableCredit);
    return {
      invoiceId,
      invoiceNumber: invoice.number,
      invoiceOutstanding: outstanding,
      availableCredit: summary.availableCredit,
      applyAmount: Number(roundMoney(apply)),
      invoiceRemainingAfter: Number(roundMoney(outstanding - apply)),
      creditRemainingAfter: Number(roundMoney(summary.availableCredit - apply)),
      presentation: classifyInvoice({
        status: invoice.status,
        total: money(invoice.total),
        paidAmount: money(invoice.paidAmount),
        outstandingAmount: outstanding,
        dueDate: invoice.dueDate,
      }),
    };
  }
}
