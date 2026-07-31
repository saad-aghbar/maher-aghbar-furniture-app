import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { calcLineTotals, roundMoney } from '../../common/helpers/money.util';
import { CreateQuotationDto, ListQuotationsDto } from './dto/quotation.dto';

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  private buildLineData(lines: CreateQuotationDto['lines'], index: number) {
    const line = lines[index];
    if (!line) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Invalid quotation line.' });
    }
    const discountType = line.discountType ?? 'NONE';
    const discountValue = line.discountValue ?? 0;
    const taxRate = line.taxRate ?? 0;
    const totals = calcLineTotals(
      line.quantity,
      line.unitPrice,
      discountType as DiscountType,
      discountValue,
      taxRate,
    );
    return {
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit ?? 'pcs',
      material: line.material,
      fabric: line.fabric,
      color: line.color,
      unitPrice: roundMoney(line.unitPrice),
      discountType,
      discountValue: roundMoney(discountValue),
      taxRate: roundMoney(taxRate),
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      lineTotal: totals.lineTotal,
      sortOrder: index,
    };
  }

  private sumQuotation(lines: ReturnType<typeof this.buildLineData>[]) {
    const subtotal = lines.reduce((sum, l) => sum + Number(l.subtotal), 0);
    const discountTotal = lines.reduce((sum, l) => {
      const gross = Number(l.quantity) * Number(l.unitPrice);
      return sum + (gross - Number(l.subtotal));
    }, 0);
    const taxTotal = lines.reduce((sum, l) => sum + Number(l.taxAmount), 0);
    const total = lines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
    return {
      subtotal: roundMoney(subtotal),
      discountTotal: roundMoney(discountTotal),
      taxTotal: roundMoney(taxTotal),
      total: roundMoney(total),
    };
  }

  async list(query: ListQuotationsDto) {
    const where: Prisma.QuotationWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { customer: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.quotation.count({ where }),
      this.prisma.quotation.findMany({
        where,
        include: { customer: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  async getById(id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, archivedAt: null },
      include: {
        customer: true,
        request: true,
        lines: { orderBy: { sortOrder: 'asc' } },
        approvals: { include: { approver: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
    if (!quotation) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Quotation not found.' });
    return quotation;
  }

  async create(dto: CreateQuotationDto, userId: string) {
    const number = await this.sequences.next('QT', 'QT');
    const lineData = dto.lines.map((_, i) => this.buildLineData(dto.lines, i));
    const totals = this.sumQuotation(lineData);

    return this.prisma.quotation.create({
      data: {
        number,
        customerId: dto.customerId,
        requestId: dto.requestId,
        expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : undefined,
        paymentTerms: dto.paymentTerms,
        deliveryTerms: dto.deliveryTerms,
        customerNotes: dto.customerNotes,
        internalNotes: dto.internalNotes,
        salesRepId: userId,
        createdById: userId,
        status: 'DRAFT',
        ...totals,
        lines: { create: lineData },
      },
      include: { lines: true, customer: true },
    });
  }

  private assertStatus(quotation: { status: string }, allowed: string[], action: string) {
    if (!allowed.includes(quotation.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot ${action} quotation in status ${quotation.status}.`,
      });
    }
  }

  async submitForApproval(id: string) {
    const quotation = await this.getById(id);
    this.assertStatus(quotation, ['DRAFT'], 'submit for approval');
    return this.prisma.quotation.update({
      where: { id },
      data: { status: 'INTERNAL_REVIEW' },
      include: { lines: true },
    });
  }

  async approve(id: string, userId: string, comment?: string) {
    const quotation = await this.getById(id);
    this.assertStatus(quotation, ['INTERNAL_REVIEW'], 'approve');

    return this.prisma.$transaction(async (tx) => {
      await tx.quotationApproval.create({
        data: { quotationId: id, approverId: userId, decision: 'APPROVED', comment },
      });
      return tx.quotation.update({
        where: { id },
        data: { status: 'APPROVED' },
        include: { lines: true, approvals: true },
      });
    });
  }

  async send(id: string) {
    const quotation = await this.getById(id);
    this.assertStatus(quotation, ['APPROVED'], 'send');
    return this.prisma.quotation.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
      include: { lines: true },
    });
  }

  async reject(id: string, userId: string, comment?: string) {
    const quotation = await this.getById(id);
    this.assertStatus(quotation, ['INTERNAL_REVIEW', 'SENT', 'APPROVED'], 'reject');

    return this.prisma.$transaction(async (tx) => {
      await tx.quotationApproval.create({
        data: { quotationId: id, approverId: userId, decision: 'REJECTED', comment },
      });
      return tx.quotation.update({
        where: { id },
        data: { status: 'REJECTED', rejectedAt: new Date() },
        include: { lines: true },
      });
    });
  }

  async accept(id: string) {
    const quotation = await this.getById(id);
    this.assertStatus(quotation, ['SENT', 'APPROVED'], 'accept');

    const soNumber = await this.sequences.next('SO', 'SO');

    return this.prisma.$transaction(async (tx) => {
      await tx.salesOrder.create({
        data: {
          number: soNumber,
          customerId: quotation.customerId,
          quotationId: quotation.id,
          currency: quotation.currency,
          paymentTerms: quotation.paymentTerms ?? undefined,
          status: 'DRAFT',
          subtotal: quotation.subtotal,
          taxTotal: quotation.taxTotal,
          total: quotation.total,
          lines: {
            create: quotation.lines.map((line, index) => ({
              productId: line.productId,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountValue: line.discountValue,
              taxRate: line.taxRate,
              lineTotal: line.lineTotal,
              sortOrder: index,
            })),
          },
        },
        include: { lines: true },
      });

      return tx.quotation.update({
        where: { id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
        include: { lines: true, salesOrders: true },
      });
    });
  }

  async revise(id: string, userId: string) {
    const quotation = await this.getById(id);
    this.assertStatus(
      quotation,
      ['APPROVED', 'SENT', 'REJECTED', 'REVISION_REQUESTED', 'VIEWED'],
      'revise',
    );

    const nextVersion = quotation.version + 1;
    const lineData = quotation.lines.map((line, index) => ({
      productId: line.productId ?? undefined,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      material: line.material ?? undefined,
      fabric: line.fabric ?? undefined,
      color: line.color ?? undefined,
      unitPrice: line.unitPrice,
      discountType: line.discountType,
      discountValue: line.discountValue,
      taxRate: line.taxRate,
      subtotal: line.subtotal,
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal,
      sortOrder: index,
    }));

    return this.prisma.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      return tx.quotation.create({
        data: {
          number: quotation.number,
          version: nextVersion,
          customerId: quotation.customerId,
          requestId: quotation.requestId ?? undefined,
          expirationDate: quotation.expirationDate ?? undefined,
          paymentTerms: quotation.paymentTerms ?? undefined,
          deliveryTerms: quotation.deliveryTerms ?? undefined,
          warrantyTerms: quotation.warrantyTerms ?? undefined,
          customerNotes: quotation.customerNotes ?? undefined,
          internalNotes: quotation.internalNotes ?? undefined,
          salesRepId: quotation.salesRepId ?? userId,
          createdById: userId,
          parentQuotationId: quotation.id,
          status: 'DRAFT',
          currency: quotation.currency,
          subtotal: quotation.subtotal,
          discountTotal: quotation.discountTotal,
          taxTotal: quotation.taxTotal,
          total: quotation.total,
          lines: { create: lineData },
        },
        include: { lines: true, customer: true, parentQuotation: true },
      });
    });
  }

  async compareVersions(id: string) {
    const quotation = await this.getById(id);
    const rootId = quotation.parentQuotationId ?? quotation.id;
    const versions = await this.prisma.quotation.findMany({
      where: {
        OR: [{ id: rootId }, { parentQuotationId: rootId }, { number: quotation.number }],
        archivedAt: null,
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { version: 'asc' },
    });
    return { number: quotation.number, versions };
  }
}
