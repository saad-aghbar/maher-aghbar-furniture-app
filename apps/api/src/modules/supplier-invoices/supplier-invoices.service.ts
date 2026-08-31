import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  PurchaseOrderStatus,
} from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import { roundMoney } from '../../common/helpers/money.util';
import type { ListSupplierInvoicesDto, UpdateSupplierInvoiceDto } from './dto/supplier-invoice.dto';

const INVOICEABLE_PO: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
  PurchaseOrderStatus.RECEIVED,
  PurchaseOrderStatus.CLOSED,
];

@Injectable()
export class SupplierInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  async list(query: ListSupplierInvoicesDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where: Prisma.SupplierInvoiceWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { purchaseOrder: { number: { contains: query.q, mode: 'insensitive' } } },
              { supplier: { name: { contains: query.q, mode: 'insensitive' } } },
              { supplier: { nameAr: { contains: query.q, mode: 'insensitive' } } },
              { supplier: { nameEn: { contains: query.q, mode: 'insensitive' } } },
              { supplier: { nameHe: { contains: query.q, mode: 'insensitive' } } },
              { supplier: { code: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.supplierInvoice.count({ where }),
      this.prisma.supplierInvoice.findMany({
        where,
        include: {
          supplier: true,
          purchaseOrder: { select: { id: true, number: true, status: true } },
          lines: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  async get(id: string) {
    const key = id.trim();
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: {
        archivedAt: null,
        OR: [{ id: key }, { number: { equals: key, mode: 'insensitive' } }],
      },
      include: {
        supplier: true,
        purchaseOrder: true,
        goodsReceipt: true,
        lines: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!invoice) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Supplier invoice not found.' });
    }
    return invoice;
  }

  async createFromPurchaseOrder(
    dto: { purchaseOrderId: string; goodsReceiptId?: string; notes?: string },
    userId: string,
  ) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: dto.purchaseOrderId, archivedAt: null },
      include: { lines: true },
    });
    if (!po) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Purchase order not found.' });
    }
    if (!INVOICEABLE_PO.includes(po.status)) {
      throw new BadRequestException({
        code: 'SUPPLIER_INVOICE_NOT_READY',
        message:
          'Supplier invoice is created only after goods are received into a warehouse.',
      });
    }

    const existing = await this.prisma.supplierInvoice.findFirst({
      where: {
        purchaseOrderId: po.id,
        status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.VOID] },
        archivedAt: null,
      },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'SUPPLIER_INVOICE_EXISTS',
        message: 'A supplier invoice already exists for this purchase order.',
      });
    }

    let goodsReceiptId = dto.goodsReceiptId?.trim() || undefined;
    if (goodsReceiptId) {
      const grn = await this.prisma.goodsReceipt.findFirst({
        where: { id: goodsReceiptId, purchaseOrderId: po.id },
      });
      if (!grn) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Goods receipt does not belong to this purchase order.',
        });
      }
    } else {
      const latestGrn = await this.prisma.goodsReceipt.findFirst({
        where: { purchaseOrderId: po.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!latestGrn) {
        throw new BadRequestException({
          code: 'SUPPLIER_INVOICE_NOT_READY',
          message:
            'Confirm a goods receipt into a warehouse before creating a supplier invoice.',
        });
      }
      goodsReceiptId = latestGrn.id;
    }

    const number = await this.sequences.next('SINV', 'SINV');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (po.paymentTermsDays || 30));

    const lines = po.lines.map((l, idx) => ({
      description: l.description,
      quantity: roundMoney(Number(l.quantity)),
      unitPrice: roundMoney(Number(l.unitPrice)),
      taxRate: roundMoney(Number(l.taxRate)),
      lineTotal: roundMoney(Number(l.lineTotal)),
      sortOrder: idx,
    }));
    const subtotal = roundMoney(Number(po.subtotal));
    const taxTotal = roundMoney(Number(po.taxAmount));
    const total = roundMoney(Number(po.total));

    const invoice = await this.prisma.supplierInvoice.create({
      data: {
        number,
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        goodsReceiptId,
        dueDate,
        currency: po.currency,
        status: InvoiceStatus.ISSUED,
        subtotal,
        taxTotal,
        total,
        paidAmount: roundMoney(0),
        outstandingAmount: total,
        notes: dto.notes,
        createdById: userId,
        lines: { create: lines },
      },
      include: { lines: true, supplier: true, purchaseOrder: true },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'supplier-invoice.create',
        entityType: 'SupplierInvoice',
        entityId: invoice.id,
        newValues: { purchaseOrderId: po.id, number: invoice.number },
      },
    });

    return invoice;
  }

  /** Staff edit — notes, due date, and line amounts (recalculates totals). */
  async update(id: string, dto: UpdateSupplierInvoiceDto, userId: string) {
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id, archivedAt: null },
      include: { lines: true },
    });
    if (!invoice) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Supplier invoice not found.',
      });
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
        const taxRate = Number(roundMoney(Number(l.taxRate ?? 0)));
        const net = Number(roundMoney(qty * unit));
        const tax = Number(roundMoney(net * (taxRate / 100)));
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
            return s + net * (Number(l.taxRate) / 100);
          }, 0),
        ),
      );
      total = Number(roundMoney(subtotal + taxTotal));
    }

    if (total + 1e-9 < paid) {
      throw new BadRequestException({
        code: 'INVOICE_TOTAL_BELOW_PAID',
        message: 'Invoice total cannot be less than amount already paid.',
      });
    }

    const outstanding = Number(roundMoney(Math.max(0, total - paid)));
    const nextDue =
      dto.dueDate !== undefined
        ? dto.dueDate
          ? new Date(dto.dueDate)
          : null
        : invoice.dueDate;
    let status = invoice.status;
    if (invoice.status !== InvoiceStatus.DRAFT) {
      if (outstanding <= 0.001) status = InvoiceStatus.PAID;
      else if (paid > 0.001) status = InvoiceStatus.PARTIALLY_PAID;
      else if (nextDue && nextDue.getTime() < Date.now() && outstanding > 0.001) {
        status = InvoiceStatus.OVERDUE;
      } else {
        status = InvoiceStatus.ISSUED;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (lineCreates) {
        await tx.supplierInvoiceLine.deleteMany({ where: { supplierInvoiceId: id } });
        await tx.supplierInvoiceLine.createMany({
          data: lineCreates.map((l) => ({ ...l, supplierInvoiceId: id })),
        });
      }
      await tx.supplierInvoice.update({
        where: { id },
        data: {
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.dueDate !== undefined
            ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
            : {}),
          ...(lineCreates
            ? {
                subtotal,
                taxTotal,
                total,
                outstandingAmount: outstanding,
                status,
              }
            : dto.dueDate !== undefined
              ? { status }
              : {}),
        },
      });
      await tx.auditEvent.create({
        data: {
          userId,
          action: 'supplier-invoice.update',
          entityType: 'SupplierInvoice',
          entityId: id,
          newValues: {
            notes: dto.notes,
            dueDate: dto.dueDate,
            lines: Boolean(lineCreates),
            total,
          },
        },
      });
    });

    return this.get(id);
  }

  /** Idempotent — creates after first warehouse receipt when none exists yet. */
  async ensureFromPurchaseOrder(
    purchaseOrderId: string,
    userId: string,
    goodsReceiptId?: string,
  ) {
    const existing = await this.prisma.supplierInvoice.findFirst({
      where: {
        purchaseOrderId,
        status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.VOID] },
        archivedAt: null,
      },
    });
    if (existing) return existing;
    try {
      return await this.createFromPurchaseOrder(
        { purchaseOrderId, goodsReceiptId },
        userId,
      );
    } catch (err) {
      if (err instanceof BadRequestException) {
        const body = err.getResponse();
        if (
          typeof body === 'object' &&
          body &&
          'code' in body &&
          body.code === 'SUPPLIER_INVOICE_EXISTS'
        ) {
          return this.prisma.supplierInvoice.findFirstOrThrow({
            where: {
              purchaseOrderId,
              status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.VOID] },
              archivedAt: null,
            },
          });
        }
      }
      throw err;
    }
  }

  async recordPayment(
    dto: {
      supplierId: string;
      supplierInvoiceId?: string;
      amount: number;
      method?: PaymentMethod;
      referenceNumber?: string;
      notes?: string;
    },
    userId: string,
  ) {
    if (dto.amount <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Amount must be positive.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      let invoice = null as Awaited<ReturnType<typeof tx.supplierInvoice.findFirst>>;
      if (dto.supplierInvoiceId) {
        invoice = await tx.supplierInvoice.findFirst({
          where: { id: dto.supplierInvoiceId, archivedAt: null },
        });
        if (!invoice) {
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: 'Supplier invoice not found.',
          });
        }
        if (invoice.supplierId !== dto.supplierId) {
          throw new BadRequestException({
            code: 'BAD_REQUEST',
            message: 'Supplier does not match invoice.',
          });
        }
        if (Number(invoice.outstandingAmount) < dto.amount) {
          throw new BadRequestException({
            code: 'PAYMENT_EXCEEDS_OUTSTANDING',
            message: 'Payment exceeds outstanding amount.',
          });
        }
      }

      const number = await this.sequences.next('SPAY', 'SPAY');
      const payment = await tx.supplierPayment.create({
        data: {
          number,
          supplierId: dto.supplierId,
          supplierInvoiceId: dto.supplierInvoiceId,
          amount: roundMoney(dto.amount),
          method: dto.method ?? PaymentMethod.BANK_TRANSFER,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          createdById: userId,
        },
      });

      if (invoice) {
        const paid = Number(invoice.paidAmount) + dto.amount;
        const outstanding = Number(invoice.total) - paid;
        let status: InvoiceStatus = InvoiceStatus.PARTIALLY_PAID;
        if (outstanding <= 0) status = InvoiceStatus.PAID;
        else if (paid <= 0) status = InvoiceStatus.ISSUED;

        await tx.supplierInvoice.update({
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
          action: 'supplier-payment.record',
          entityType: 'SupplierPayment',
          entityId: payment.id,
          newValues: {
            supplierInvoiceId: dto.supplierInvoiceId,
            amount: dto.amount,
          },
        },
      });

      return payment;
    });
  }
}
