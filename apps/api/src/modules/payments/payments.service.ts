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

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: ListPaymentsDto, user?: AuthUser) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where: Prisma.PaymentWhereInput = {
      ...customerScopeFilter(user),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.q
        ? { OR: [{ number: { contains: query.q, mode: 'insensitive' } }] }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: { customer: true, invoice: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

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
    },
    userId: string,
  ) {
    if (dto.amount <= 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Amount must be positive.' });
    }

    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      let invoice = null as Awaited<ReturnType<typeof tx.invoice.findFirst>>;
      if (dto.invoiceId) {
        invoice = await tx.invoice.findFirst({
          where: { id: dto.invoiceId, archivedAt: null },
        });
        if (!invoice) {
          throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found.' });
        }
        if (Number(invoice.outstandingAmount) < dto.amount) {
          throw new BadRequestException({
            code: 'PAYMENT_EXCEEDS_OUTSTANDING',
            message: 'Payment exceeds outstanding amount.',
          });
        }
      }

      const number = await this.sequences.next('PAY', 'PAY');
      const payment = await tx.payment.create({
        data: {
          number,
          customerId: dto.customerId,
          invoiceId: dto.invoiceId,
          amount: roundMoney(dto.amount),
          method: dto.method ?? PaymentMethod.BANK_TRANSFER,
          referenceNumber: dto.referenceNumber,
          bank: dto.bank,
          notes: dto.notes,
          createdById: userId,
          idempotencyKey: dto.idempotencyKey,
        },
      });

      if (invoice) {
        const paid = Number(invoice.paidAmount) + dto.amount;
        const outstanding = Number(invoice.total) - paid;
        let status: InvoiceStatus = InvoiceStatus.PARTIALLY_PAID;
        if (outstanding <= 0) status = InvoiceStatus.PAID;
        else if (paid <= 0) status = InvoiceStatus.ISSUED;

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: roundMoney(paid),
            outstandingAmount: roundMoney(Math.max(outstanding, 0)),
            status,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          userId,
          action: 'payment.record',
          entityType: 'Payment',
          entityId: payment.id,
          newValues: { amount: dto.amount, invoiceId: dto.invoiceId },
        },
      });

      return payment;
    }).then(async (payment) => {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      await this.notifications.sendFromTemplate({
        templateCode: 'PAYMENT_RECEIVED',
        channel: 'WHATSAPP',
        to: { email: customer?.email, phone: customer?.phone },
        vars: { amount: String(dto.amount), number: payment.number },
      });
      await this.notifications.notifyCustomerUsers(dto.customerId, {
        templateCode: 'PAYMENT_RECEIVED',
        vars: { amount: String(dto.amount), number: payment.number },
        linkUrl: `/account/statement`,
      });
      return payment;
    });
  }
}
