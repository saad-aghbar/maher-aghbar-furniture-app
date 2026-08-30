import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma } from '@maher/database';
import type { EmailProvider, WhatsAppProvider } from '@maher/integrations';
import type { AuthUser } from '@maher/types';
import {
  buildOrderLineSpecSnapshot,
  classifyManufacturingComplexity,
} from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import { calcLineTotals, roundMoney } from '../../common/helpers/money.util';
import { customerScopeFilter } from '../../common/helpers/customer-scope';
import { CreateQuotationDto, ListQuotationsDto, UpdateQuotationDto } from './dto/quotation.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SalesOrdersService } from '../sales-orders/sales-orders.service';
import {
  DEALER_VISIBLE_QUOTATION_STATUSES,
  SAME_RFQ_ACCEPTED_ERROR,
  isDealerVisibleQuotationStatus,
} from './quotation-visibility';
import {
  EMAIL_PROVIDER,
  WHATSAPP_PROVIDER,
} from '../../integrations/integrations.module';

const APPROVAL_STEP_RE = /\[step:([A-Z_]+)\]/;

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly notifications: NotificationsService,
    private readonly salesOrders: SalesOrdersService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
  ) {}

  /**
   * Unused setting `quotation_approval.financeThreshold` is future debt.
   * One-step internal send gate only — do not treat this as dealer acceptance.
   */
  private async getApprovalChain(_total: number): Promise<string[]> {
    return ['SYSTEM_ADMINISTRATOR'];
  }

  private assertDealerPrincipal(user?: AuthUser): asserts user is AuthUser & { customerId: string } {
    if (!user?.id || !user.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the owning dealer can perform this action.',
      });
    }
  }

  private dealerListStatusFilter(
    user: AuthUser | undefined,
    requested?: string,
  ): Prisma.QuotationWhereInput {
    if (!user?.customerId) {
      return requested ? { status: requested as never } : {};
    }
    if (requested) {
      if (!isDealerVisibleQuotationStatus(requested)) {
        return { id: { in: [] } };
      }
      return { status: requested as never };
    }
    return { status: { in: [...DEALER_VISIBLE_QUOTATION_STATUSES] } };
  }

  private assertDealerMaySee(
    user: AuthUser | undefined,
    quotation: { customerId: string; status: string },
  ) {
    if (!user?.customerId) return;
    if (quotation.customerId !== user.customerId || !isDealerVisibleQuotationStatus(quotation.status)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Quotation not found.' });
    }
  }

  private async writeAudit(
    userId: string | undefined,
    action: string,
    entityId: string,
    newValues?: Prisma.InputJsonValue,
  ) {
    await this.prisma.auditEvent.create({
      data: {
        userId: userId ?? undefined,
        action,
        entityType: 'Quotation',
        entityId,
        newValues: newValues ?? undefined,
      },
    });
  }

  private async notifyCommercialStaff(opts: {
    salesRepId?: string | null;
    templateCode: string;
    vars: Record<string, string>;
    linkUrl: string;
  }) {
    if (opts.salesRepId) {
      await this.notifications.sendFromTemplate({
        templateCode: opts.templateCode,
        channel: 'IN_APP',
        to: { userId: opts.salesRepId },
        vars: opts.vars,
        linkUrl: opts.linkUrl,
      });
      return;
    }
    await this.notifications.notifyAdminUsers({
      templateCode: opts.templateCode,
      vars: opts.vars,
      linkUrl: opts.linkUrl,
    });
  }

  private completedApprovalSteps(
    approvals: Array<{ decision: string; comment: string | null }>,
  ): string[] {
    return approvals
      .filter((a) => a.decision === 'APPROVED')
      .map((a) => a.comment?.match(APPROVAL_STEP_RE)?.[1])
      .filter((role): role is string => Boolean(role));
  }

  private lineSpecifications(line: {
    material?: string | null;
    fabric?: string | null;
    color?: string | null;
    width?: unknown;
    height?: unknown;
    depth?: unknown;
  }): string {
    const parts: string[] = [];
    if (line.material) parts.push(`Material: ${line.material}`);
    if (line.fabric) parts.push(`Fabric: ${line.fabric}`);
    if (line.color) parts.push(`Color: ${line.color}`);
    const w = line.width != null ? Number(line.width) : null;
    const h = line.height != null ? Number(line.height) : null;
    const d = line.depth != null ? Number(line.depth) : null;
    if (w || h || d) {
      parts.push(`Dims: ${w ?? '—'}×${h ?? '—'}×${d ?? '—'} cm`);
    }
    return parts.join('; ') || '';
  }

  private parseDeliveryDate(deliveryTerms?: string | null): Date | undefined {
    if (!deliveryTerms) return undefined;
    const iso = deliveryTerms.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (iso) {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return undefined;
  }

  private async isAutoConfirmEnabled(): Promise<boolean> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'auto_confirm_so_on_accept' },
    });
    // Piece 1: default off — accepted SO stays in production-setup until confirm.
    if (setting == null) return false;
    const v = setting.value as unknown;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v === 'true' || v === '1';
    if (v && typeof v === 'object' && 'enabled' in (v as object)) {
      return Boolean((v as { enabled?: boolean }).enabled);
    }
    return Boolean(v);
  }

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
      width: line.width,
      height: line.height,
      depth: line.depth,
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

  async list(query: ListQuotationsDto, user?: AuthUser) {
    const where: Prisma.QuotationWhereInput = {
      archivedAt: null,
      ...customerScopeFilter(user),
      ...this.dealerListStatusFilter(user, query.status),
      ...(query.customerId && !user?.customerId ? { customerId: query.customerId } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { customer: { name: { contains: query.q, mode: 'insensitive' } } },
              { request: { externalOrderNumber: { contains: query.q, mode: 'insensitive' } } },
              { request: { number: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const { page, pageSize, skip, take } = pageSkipTake(query);
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.quotation.count({ where }),
      this.prisma.quotation.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, code: true, nameAr: true, nameEn: true, nameHe: true },
          },
          request: {
            select: {
              id: true,
              number: true,
              externalOrderNumber: true,
              endCustomerName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  async getById(id: string, user?: AuthUser) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, archivedAt: null },
      include: {
        customer: true,
        request: { include: { items: true, documents: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        approvals: {
          include: {
            approver: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { decidedAt: 'asc' },
        },
        salesOrders: {
          select: { id: true, number: true, status: true, externalOrderNumber: true },
        },
        acceptedBy: {
          select: { id: true, firstName: true, lastName: true, email: true, username: true },
        },
      },
    });
    if (!quotation) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Quotation not found.' });
    this.assertDealerMaySee(user, quotation);

    const approvalChain = await this.getApprovalChain(Number(quotation.total));
    const completedSteps = this.completedApprovalSteps(quotation.approvals);
    const pendingApproverRole =
      quotation.status === 'INTERNAL_REVIEW'
        ? (approvalChain.find((role) => !completedSteps.includes(role)) ?? null)
        : null;

    return {
      ...quotation,
      approvalChain,
      completedApprovalSteps: completedSteps,
      pendingApproverRole,
    };
  }

  /** Resolve product + seller unit price: dealer price for this customer, else catalog basePrice. */
  private async resolveSellerLines(
    customerId: string,
    lines: CreateQuotationDto['lines'],
  ): Promise<CreateQuotationDto['lines']> {
    const [dealerPrices, products] = await Promise.all([
      this.prisma.dealerPrice.findMany({ where: { customerId } }),
      this.prisma.product.findMany({
        where: { archivedAt: null, isActive: true },
        select: {
          id: true,
          sku: true,
          nameEn: true,
          nameAr: true,
          nameHe: true,
          basePrice: true,
        },
      }),
    ]);
    const dealerMap = new Map(dealerPrices.map((d) => [d.productId, Number(d.price)]));

    const matchProduct = (line: CreateQuotationDto['lines'][number]) => {
      if (line.productId) {
        return products.find((p) => p.id === line.productId) ?? null;
      }
      const raw = (line.description ?? '').trim().toLowerCase();
      if (!raw) return null;
      return (
        products.find(
          (p) =>
            p.sku.toLowerCase() === raw ||
            p.nameEn.toLowerCase() === raw ||
            (p.nameAr && p.nameAr.toLowerCase() === raw) ||
            (p.nameHe && p.nameHe.toLowerCase() === raw),
        ) ??
        products.find(
          (p) =>
            raw.includes(p.nameEn.toLowerCase()) ||
            (p.nameAr && raw.includes(p.nameAr.toLowerCase())) ||
            raw.includes(p.sku.toLowerCase()),
        ) ??
        null
      );
    };

    return lines.map((line) => {
      const product = matchProduct(line);
      const productId = line.productId ?? product?.id;
      let unitPrice = Number(line.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        if (productId && dealerMap.has(productId)) {
          unitPrice = dealerMap.get(productId)!;
        } else if (product?.basePrice != null) {
          unitPrice = Number(product.basePrice);
        } else {
          unitPrice = 0;
        }
      }
      return { ...line, productId, unitPrice };
    });
  }

  async create(dto: CreateQuotationDto, userId: string) {
    const number = await this.sequences.next('QT', 'QT');
    const resolvedLines = await this.resolveSellerLines(dto.customerId, dto.lines);
    const lineData = resolvedLines.map((_, i) => this.buildLineData(resolvedLines, i));
    const totals = this.sumQuotation(lineData);

    const quotation = await this.prisma.quotation.create({
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

    if (dto.requestId) {
      await this.prisma.requestForQuotation.updateMany({
        where: {
          id: dto.requestId,
          status: {
            in: ['SUBMITTED', 'UNDER_REVIEW', 'READY_FOR_QUOTATION', 'NEEDS_INFORMATION'],
          },
        },
        data: { status: 'QUOTED' },
      });
    }

    return quotation;
  }

  private assertStatus(quotation: { status: string }, allowed: string[], action: string) {
    if (!allowed.includes(quotation.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot ${action} quotation in status ${quotation.status}.`,
      });
    }
  }

  async submitForApproval(id: string, user?: AuthUser) {
    const quotation = await this.getById(id, user);
    this.assertStatus(quotation, ['DRAFT'], 'submit for approval');
    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: 'INTERNAL_REVIEW' },
      include: { lines: true },
    });
    await this.writeAudit(user?.id, 'quotation.submit', id, { status: 'INTERNAL_REVIEW' });
    return updated;
  }

  /** Edit draft quotation terms / lines (prices) before submit-for-approval. */
  async updateDraft(id: string, dto: UpdateQuotationDto, user?: AuthUser) {
    const quotation = await this.getById(id, user);
    this.assertStatus(quotation, ['DRAFT'], 'update');

    const data: Prisma.QuotationUpdateInput = {};
    if (dto.paymentTerms !== undefined) data.paymentTerms = dto.paymentTerms || null;
    if (dto.deliveryTerms !== undefined) data.deliveryTerms = dto.deliveryTerms || null;
    if (dto.customerNotes !== undefined) data.customerNotes = dto.customerNotes || null;
    if (dto.internalNotes !== undefined) data.internalNotes = dto.internalNotes || null;

    if (dto.lines?.length) {
      const resolved = await this.resolveSellerLines(quotation.customerId, dto.lines);
      const lineData = resolved.map((_, index) => this.buildLineData(resolved, index));
      const totals = this.sumQuotation(lineData);
      Object.assign(data, totals);

      return this.prisma.$transaction(async (tx) => {
        await tx.quotationLine.deleteMany({ where: { quotationId: id } });
        await tx.quotationLine.createMany({
          data: lineData.map((line) => ({ ...line, quotationId: id })),
        });
        return tx.quotation.update({
          where: { id },
          data,
          include: {
            lines: { orderBy: { sortOrder: 'asc' } },
            customer: true,
            request: { select: { id: true, number: true } },
          },
        });
      });
    }

    return this.prisma.quotation.update({
      where: { id },
      data,
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        customer: true,
        request: { select: { id: true, number: true } },
      },
    });
  }

  async approve(id: string, user: AuthUser, comment?: string) {
    const quotation = await this.getById(id, user);
    this.assertStatus(quotation, ['INTERNAL_REVIEW'], 'approve');

    const chain = quotation.approvalChain ?? (await this.getApprovalChain(Number(quotation.total)));
    const completed = quotation.completedApprovalSteps ?? [];
    const nextRole = chain.find((role) => !completed.includes(role));
    if (!nextRole) {
      return this.prisma.quotation.update({
        where: { id },
        data: { status: 'APPROVED' },
        include: { lines: true, approvals: true },
      });
    }

    const elevated = user.roles.some((r) =>
      ['SUPER_ADMIN', 'SYSTEM_ADMINISTRATOR'].includes(r),
    );
    if (!elevated && !user.roles.includes(nextRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Waiting for ${nextRole} approval.`,
      });
    }

    const stepComment = `[step:${nextRole}]${comment ? ` ${comment}` : ''}`;
    const willComplete = chain.every((role) => completed.includes(role) || role === nextRole);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.quotationApproval.create({
        data: {
          quotationId: id,
          approverId: user.id,
          decision: 'APPROVED',
          comment: stepComment,
        },
      });
      return tx.quotation.update({
        where: { id },
        data: { status: willComplete ? 'APPROVED' : 'INTERNAL_REVIEW' },
        include: { lines: true, approvals: true },
      });
    });
    await this.writeAudit(user.id, 'quotation.approve', id, {
      status: updated.status,
      step: nextRole,
    });
    return updated;
  }

  async send(id: string, user?: AuthUser) {
    const quotation = await this.getById(id, user);
    this.assertStatus(quotation, ['APPROVED'], 'send');
    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
      include: { lines: true, customer: true },
    });

    const vars = { number: updated.number, total: String(updated.total) };
    const linkUrl = `/quotations/${updated.id}`;

    const portalUsers = await this.prisma.user.findMany({
      where: { customerId: updated.customerId, isActive: true },
      select: { id: true },
    });
    for (const u of portalUsers) {
      await this.notifications.sendFromTemplate({
        templateCode: 'QUOTE_SENT',
        channel: 'IN_APP',
        to: { userId: u.id },
        vars,
        linkUrl,
      });
    }

    const subject = `Quotation ${updated.number}`;
    const body = `Quotation ${updated.number} — total ${updated.total} ${updated.currency}. View: ${linkUrl}`;

    if (updated.customer.email) {
      await this.email.send({
        to: updated.customer.email,
        subject,
        body,
      });
    }

    if (updated.customer.phone) {
      await this.whatsapp.send({
        to: updated.customer.phone,
        body: `Quotation ${updated.number} sent. Total ${updated.total} ${updated.currency}.`,
      });
    }

    if (quotation.requestId) {
      await this.prisma.requestForQuotation.updateMany({
        where: { id: quotation.requestId },
        data: { status: 'QUOTED' },
      });
    }

    await this.writeAudit(user?.id, 'quotation.send', id, { status: 'SENT' });
    return updated;
  }

  async reject(id: string, user: AuthUser, comment?: string) {
    const quotation = await this.getById(id, user);
    if (user.customerId) {
      this.assertStatus(quotation, ['SENT'], 'reject');
    } else {
      this.assertStatus(quotation, ['INTERNAL_REVIEW', 'APPROVED'], 'reject');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.quotationApproval.create({
        data: { quotationId: id, approverId: user.id, decision: 'REJECTED', comment },
      });
      return tx.quotation.update({
        where: { id },
        data: { status: 'REJECTED', rejectedAt: new Date() },
        include: { lines: true },
      });
    });
    await this.writeAudit(user.id, 'quotation.reject', id, {
      status: 'REJECTED',
      byDealer: Boolean(user.customerId),
      comment: comment ?? null,
    });
    if (user.customerId) {
      await this.notifyCommercialStaff({
        salesRepId: quotation.salesRepId,
        templateCode: 'QUOTE_REJECTED',
        vars: { number: quotation.number, total: String(quotation.total) },
        linkUrl: `/quotations/${id}`,
      }).catch(() => undefined);
    }
    return updated;
  }

  async accept(id: string, user: AuthUser, signatureData?: string) {
    this.assertDealerPrincipal(user);
    const quotation = await this.getById(id, user);
    this.assertStatus(quotation, ['SENT'], 'accept');

    const requiredDeliveryDate =
      this.parseDeliveryDate(quotation.deliveryTerms) ??
      (quotation.request as { requiredDeliveryDate?: Date | null } | null)?.requiredDeliveryDate ??
      undefined;

    const requestRow = quotation.request as {
      deliveryAddress?: string | null;
      externalOrderNumber?: string | null;
      projectName?: string | null;
    } | null;

    let result: { id: string; salesOrders?: Array<{ id: string; number: string; status: string }> };
    try {
      result = await this.prisma.$transaction(
        async (tx) => {
          if (quotation.requestId) {
            // Prisma String @id is PostgreSQL text, not uuid. Casting ::uuid raises 42883.
            await tx.$queryRaw`
              SELECT id FROM requests_for_quotation WHERE id = ${quotation.requestId} FOR UPDATE
            `;
            const sibling = await tx.quotation.findFirst({
              where: {
                requestId: quotation.requestId,
                status: 'ACCEPTED',
                archivedAt: null,
                NOT: { id },
              },
              select: { id: true },
            });
            const existingSo = await tx.salesOrder.findFirst({
              where: {
                archivedAt: null,
                quotation: { requestId: quotation.requestId, archivedAt: null },
              },
              select: { id: true },
            });
            if (sibling || existingSo) {
              throw new BadRequestException({
                code: 'QUOTE_ALREADY_ACCEPTED',
                message: SAME_RFQ_ACCEPTED_ERROR,
              });
            }
          }

          await tx.$queryRaw`SELECT id FROM quotations WHERE id = ${id} FOR UPDATE`;

          const claimed = await tx.quotation.updateMany({
            where: { id, status: 'SENT', archivedAt: null },
            data: {
              status: 'ACCEPTED',
              acceptedAt: new Date(),
              acceptedById: user.id,
              acceptanceSignature: signatureData || null,
            },
          });
          if (claimed.count !== 1) {
            throw new BadRequestException({
              code: 'BAD_REQUEST',
              message: 'Cannot accept quotation: it is no longer awaiting dealer acceptance.',
            });
          }

          const soNumber = await this.sequences.next('SO', 'SO');
          const productIds = [
            ...new Set(
              quotation.lines
                .map((l) => l.productId)
                .filter((id): id is string => Boolean(id)),
            ),
          ];
          const products = productIds.length
            ? await tx.product.findMany({
                where: { id: { in: productIds } },
                select: {
                  id: true,
                  width: true,
                  height: true,
                  depth: true,
                  seatHeight: true,
                  imageUrl: true,
                  nameEn: true,
                },
              })
            : [];
          const productMap = new Map(products.map((p) => [p.id, p]));
          const requestDocs =
            quotation.requestId
              ? await tx.document.findMany({
                  where: { requestId: quotation.requestId, archivedAt: null },
                  select: { id: true },
                  take: 50,
                })
              : [];
          const attachmentIds = requestDocs.map((d) => d.id);

          await tx.salesOrder.create({
            data: {
              number: soNumber,
              customerId: quotation.customerId,
              quotationId: quotation.id,
              currency: quotation.currency,
              paymentTerms: quotation.paymentTerms ?? undefined,
              deliveryAddress: requestRow?.deliveryAddress ?? undefined,
              requiredDeliveryDate: requiredDeliveryDate ?? undefined,
              externalOrderNumber: requestRow?.externalOrderNumber ?? undefined,
              projectName: requestRow?.projectName ?? undefined,
              notes: quotation.deliveryTerms ?? undefined,
              status: 'DRAFT',
              subtotal: quotation.subtotal,
              taxTotal: quotation.taxTotal,
              total: quotation.total,
              lines: {
                create: quotation.lines.map((line, index) => {
                  const catalog = line.productId
                    ? productMap.get(line.productId)
                    : null;
                  const complexity = classifyManufacturingComplexity({
                    productId: line.productId,
                    width: line.width != null ? Number(line.width) : null,
                    height: line.height != null ? Number(line.height) : null,
                    depth: line.depth != null ? Number(line.depth) : null,
                    material: line.material,
                    fabric: line.fabric,
                    color: line.color,
                    catalog: catalog
                      ? {
                          width: catalog.width != null ? Number(catalog.width) : null,
                          height: catalog.height != null ? Number(catalog.height) : null,
                          depth: catalog.depth != null ? Number(catalog.depth) : null,
                          seatHeight:
                            catalog.seatHeight != null ? Number(catalog.seatHeight) : null,
                        }
                      : null,
                  });
                  const orderSpec = buildOrderLineSpecSnapshot({
                    productId: line.productId,
                    productName: line.description,
                    productImageRef: catalog?.imageUrl ?? null,
                    quantity: Number(line.quantity),
                    catalog: catalog
                      ? {
                          width: catalog.width != null ? Number(catalog.width) : null,
                          height: catalog.height != null ? Number(catalog.height) : null,
                          depth: catalog.depth != null ? Number(catalog.depth) : null,
                          seatHeight:
                            catalog.seatHeight != null ? Number(catalog.seatHeight) : null,
                        }
                      : null,
                    width: line.width != null ? Number(line.width) : null,
                    height: line.height != null ? Number(line.height) : null,
                    depth: line.depth != null ? Number(line.depth) : null,
                    fabric: line.fabric,
                    color: line.color,
                    material: line.material,
                    manufacturingComplexity: complexity,
                    attachmentIds,
                    dealerReference: requestRow?.externalOrderNumber ?? null,
                    requiredDeliveryDate: requiredDeliveryDate ?? null,
                  });
                  return {
                    productId: line.productId,
                    description: line.description,
                    specifications: this.lineSpecifications(line),
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    discountValue: line.discountValue,
                    taxRate: line.taxRate,
                    lineTotal: line.lineTotal,
                    manufacturingComplexity: complexity,
                    commercialPriceStatus:
                      complexity === 'MODIFIED' || complexity === 'CUSTOM'
                        ? 'REQUIRED'
                        : Number(line.unitPrice) > 0
                          ? 'CATALOG'
                          : 'REQUIRED',
                    commercialPriceSource:
                      complexity === 'MODIFIED' || complexity === 'CUSTOM'
                        ? 'PENDING_CONFIRM'
                        : 'DEALER_PRICE_OR_BASE',
                    orderSpec: orderSpec as unknown as Prisma.InputJsonValue,
                    sortOrder: index,
                  };
                }),
              },
            },
          });

          if (quotation.requestId) {
            await tx.requestForQuotation.update({
              where: { id: quotation.requestId },
              data: { status: 'CLOSED' },
            });
          }

          return tx.quotation.findFirstOrThrow({
            where: { id },
            include: { lines: true, salesOrders: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException({
          code: 'QUOTE_ALREADY_ACCEPTED',
          message: SAME_RFQ_ACCEPTED_ERROR,
        });
      }
      throw err;
    }

    await this.writeAudit(user.id, 'quotation.accept', id, {
      status: 'ACCEPTED',
      acceptedById: user.id,
      number: quotation.number,
      version: quotation.version,
      total: String(quotation.total),
      currency: quotation.currency,
    });
    await this.notifyCommercialStaff({
      salesRepId: quotation.salesRepId,
      templateCode: 'QUOTE_ACCEPTED',
      vars: { number: quotation.number, total: String(quotation.total) },
      linkUrl: `/quotations/${id}`,
    }).catch(() => undefined);

    const so = result.salesOrders?.[0];
    if (so) {
      await this.salesOrders.syncCalculatedCosts(so.id).catch(() => undefined);
    }

    const autoConfirm = await this.isAutoConfirmEnabled();
    // Piece 2: auto_confirm never creates POs / schedules. It may only pre-create the
    // production-setup workspace; staff must still review and release.
    if (so) {
      if (autoConfirm) {
        await this.salesOrders.ensureProductionSetup(so.id, user).catch(() => undefined);
      }
      await this.notifications
        .notifyCustomerUsers(quotation.customerId, {
          templateCode: 'ORDER_PRODUCTION_SETUP',
          vars: { number: so.number },
          linkUrl: `/sales-orders/${so.id}`,
        })
        .catch(() => undefined);
    }

    return result;
  }

  async requestRevision(id: string, user: AuthUser, comment?: string) {
    this.assertDealerPrincipal(user);
    const quotation = await this.getById(id, user);
    this.assertStatus(quotation, ['SENT', 'VIEWED'], 'request revision');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.quotationApproval.create({
        data: {
          quotationId: id,
          approverId: user.id,
          decision: 'REVISION_REQUESTED',
          comment: comment ?? 'Customer requested revision',
        },
      });
      return tx.quotation.update({
        where: { id },
        data: {
          status: 'REVISION_REQUESTED',
          customerNotes: comment
            ? [quotation.customerNotes, `Revision: ${comment}`].filter(Boolean).join('\n')
            : quotation.customerNotes,
        },
        include: { lines: true, approvals: true },
      });
    });
    await this.writeAudit(user.id, 'quotation.request-revision', id, {
      status: 'REVISION_REQUESTED',
      comment: comment ?? null,
    });
    await this.notifyCommercialStaff({
      salesRepId: quotation.salesRepId,
      templateCode: 'QUOTE_REVISION_REQUESTED',
      vars: { number: quotation.number, total: String(quotation.total) },
      linkUrl: `/quotations/${id}`,
    }).catch(() => undefined);
    return updated;
  }

  async revise(id: string, user: AuthUser) {
    const quotation = await this.getById(id, user);
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
      width: line.width ?? undefined,
      height: line.height ?? undefined,
      depth: line.depth ?? undefined,
      unitPrice: line.unitPrice,
      discountType: line.discountType,
      discountValue: line.discountValue,
      taxRate: line.taxRate,
      subtotal: line.subtotal,
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal,
      sortOrder: index,
    }));

    const revised = await this.prisma.$transaction(async (tx) => {
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
          salesRepId: quotation.salesRepId ?? user.id,
          createdById: user.id,
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
    await this.writeAudit(user.id, 'quotation.revise', revised.id, {
      fromId: id,
      fromVersion: quotation.version,
      toVersion: revised.version,
    });
    return revised;
  }

  async compareVersions(id: string, user?: AuthUser) {
    const quotation = await this.getById(id, user);
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
