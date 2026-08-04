import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { assertCustomerOwns, customerScopeFilter } from '../../common/helpers/customer-scope';
import { CreateRequestDto, ListRequestsDto, UpdateRequestDto } from './dto/request.dto';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  async list(query: ListRequestsDto, user?: AuthUser) {
    const where: Prisma.RequestForQuotationWhereInput = {
      archivedAt: null,
      ...customerScopeFilter(user),
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { externalOrderNumber: { contains: query.q, mode: 'insensitive' } },
              { projectName: { contains: query.q, mode: 'insensitive' } },
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
      this.prisma.requestForQuotation.count({ where }),
      this.prisma.requestForQuotation.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              nameAr: true,
              nameEn: true,
              nameHe: true,
              code: true,
            },
          },
          items: true,
          documents: {
            where: { archivedAt: null },
            select: { id: true, fileName: true, mimeType: true, category: true },
            orderBy: { createdAt: 'asc' },
            take: 8,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const productIds = [
      ...new Set(
        data
          .map((row) => row.items[0]?.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const productNames = [
      ...new Set(
        data
          .map((row) => row.items[0]?.productName?.trim())
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    const products =
      productIds.length === 0 && productNames.length === 0
        ? []
        : await this.prisma.product.findMany({
            where: {
              OR: [
                ...(productIds.length ? [{ id: { in: productIds } }] : []),
                ...(productNames.length
                  ? [
                      { nameEn: { in: productNames, mode: 'insensitive' as const } },
                      { nameAr: { in: productNames, mode: 'insensitive' as const } },
                      { nameHe: { in: productNames, mode: 'insensitive' as const } },
                      { sku: { in: productNames, mode: 'insensitive' as const } },
                    ]
                  : []),
                // Fallback pool for fuzzy title matching (legacy RFQs without productId)
                { imageUrl: { not: null } },
              ],
            },
            select: {
              id: true,
              sku: true,
              nameEn: true,
              nameAr: true,
              nameHe: true,
              imageUrl: true,
            },
            take: 300,
          });

    const byId = new Map(products.map((p) => [p.id, p]));

    const enriched = data.map((row) => {
      const primary = row.items[0];
      const primaryName = primary?.productName?.trim() ?? '';
      const needle = primaryName.toLowerCase();
      const tokens = needle
        .split(/[^a-zA-Z\u0600-\u06FF\u0590-\u05FF0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2 && !/^\d+$/.test(t));

      const linked = primary?.productId ? byId.get(primary.productId) ?? null : null;
      const exact =
        linked ??
        products.find(
          (p) =>
            p.nameEn?.toLowerCase() === needle ||
            p.nameAr?.toLowerCase() === needle ||
            (p.nameHe && p.nameHe.toLowerCase() === needle) ||
            p.sku.toLowerCase() === needle,
        ) ??
        null;

      let fuzzy: (typeof products)[number] | null = null;
      // Fuzzy only when no catalog link/exact match (legacy custom-named RFQs)
      if (!exact && tokens.length) {
        let bestScore = 0;
        for (const p of products) {
          if (!p.imageUrl) continue;
          const hay = `${p.nameEn ?? ''} ${p.nameAr ?? ''} ${p.nameHe ?? ''} ${p.sku}`.toLowerCase();
          const score = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
          if (score > bestScore) {
            bestScore = score;
            fuzzy = p;
          }
        }
        if (bestScore < 1) fuzzy = null;
      }

      const match = exact ?? fuzzy;
      return {
        ...row,
        title: primaryName || row.number,
        imageUrl: match?.imageUrl ?? null,
      };
    });

    return { data: enriched, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  async getById(id: string, user?: AuthUser) {
    const request = await this.prisma.requestForQuotation.findFirst({
      where: { id, archivedAt: null },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            nameEn: true,
            nameHe: true,
            code: true,
            phone: true,
            email: true,
          },
        },
        items: { orderBy: { sortOrder: 'asc' } },
        quotations: { select: { id: true, number: true, status: true } },
        documents: {
          where: { archivedAt: null },
          select: { id: true, fileName: true, mimeType: true, category: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!request) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Request not found.' });
    if (!assertCustomerOwns(user, request.customerId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your request.' });
    }

    const primary = request.items[0];
    const primaryName = primary?.productName?.trim() ?? '';
    const imageUrl = await this.resolveProductImage({
      productId: primary?.productId,
      productName: primaryName,
    });
    return {
      ...request,
      title: primaryName || request.number,
      imageUrl,
    };
  }

  private async resolveProductImage(opts: {
    productId?: string | null;
    productName?: string | null;
  }): Promise<string | null> {
    if (opts.productId) {
      const linked = await this.prisma.product.findUnique({
        where: { id: opts.productId },
        select: { imageUrl: true },
      });
      if (linked?.imageUrl) return linked.imageUrl;
    }

    const productName = opts.productName?.trim() ?? '';
    const needle = productName.toLowerCase();
    if (!needle) return null;
    const tokens = needle
      .split(/[^a-zA-Z\u0600-\u06FF\u0590-\u05FF0-9]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !/^\d+$/.test(t));

    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          { nameEn: { equals: productName, mode: 'insensitive' } },
          { nameAr: { equals: productName, mode: 'insensitive' } },
          { nameHe: { equals: productName, mode: 'insensitive' } },
          { sku: { equals: productName, mode: 'insensitive' } },
          { imageUrl: { not: null } },
        ],
      },
      select: { sku: true, nameEn: true, nameAr: true, nameHe: true, imageUrl: true },
      take: 300,
    });

    const exact = products.find(
      (p) =>
        p.nameEn?.toLowerCase() === needle ||
        p.nameAr?.toLowerCase() === needle ||
        (p.nameHe && p.nameHe.toLowerCase() === needle) ||
        p.sku.toLowerCase() === needle,
    );
    if (exact?.imageUrl) return exact.imageUrl;

    let best: (typeof products)[number] | null = null;
    let bestScore = 0;
    for (const p of products) {
      if (!p.imageUrl) continue;
      const hay = `${p.nameEn ?? ''} ${p.nameAr ?? ''} ${p.nameHe ?? ''} ${p.sku}`.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return bestScore >= 1 ? best?.imageUrl ?? null : null;
  }

  async create(dto: CreateRequestDto, userId: string, opts?: { submit?: boolean; user?: AuthUser }) {
    if (opts?.user?.customerId) {
      dto.customerId = opts.user.customerId;
    }
    if (!dto.customerId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'customerId is required.',
      });
    }

    // Dealers: never persist empty/UUID "names" — use the logged-in profile.
    // Fax defaults to the dealer company Customer.fax when left empty.
    if (opts?.user?.customerId) {
      const looksLikeId = (v?: string) =>
        Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim()));
      const profileName = opts.user.name?.trim() || undefined;
      const profilePhone = opts.user.phone?.trim() || undefined;
      if (!dto.endCustomerName?.trim() || looksLikeId(dto.endCustomerName)) {
        dto.endCustomerName = profileName;
      }
      if (!dto.endCustomerPhone?.trim()) {
        dto.endCustomerPhone = profilePhone;
      }
      if (!dto.endCustomerFax?.trim()) {
        const company = await this.prisma.customer.findUnique({
          where: { id: opts.user.customerId },
          select: { fax: true },
        });
        dto.endCustomerFax = company?.fax?.trim() || undefined;
      }
    }

    const number = await this.sequences.next('RFQ', 'RFQ');
    return this.prisma.requestForQuotation.create({
      data: {
        number,
        customerId: dto.customerId,
        contactName: dto.contactName,
        source: dto.source ?? 'SALES',
        requiredDeliveryDate: dto.requiredDeliveryDate
          ? new Date(dto.requiredDeliveryDate)
          : undefined,
        priority: dto.priority ?? 'NORMAL',
        projectName: dto.projectName,
        deliveryAddress: dto.deliveryAddress,
        externalOrderNumber: dto.externalOrderNumber,
        endCustomerName: dto.endCustomerName,
        endCustomerPhone: dto.endCustomerPhone,
        endCustomerFax: dto.endCustomerFax,
        deliveryLat: dto.deliveryLat,
        deliveryLng: dto.deliveryLng,
        notes: dto.notes,
        status: opts?.submit ? 'SUBMITTED' : 'DRAFT',
        createdById: userId,
        items: {
          create: dto.items.map((item, index) => ({
            category: item.category,
            productId: item.productId,
            productName: item.productName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit ?? 'pcs',
            width: item.width,
            height: item.height,
            depth: item.depth,
            material: item.material,
            fabricType: item.fabric,
            fabricColor: item.color,
            notes: item.notes,
            customMeasurements: item.customMeasurements?.length
              ? (item.customMeasurements as unknown as Prisma.InputJsonValue)
              : undefined,
            sortOrder: index,
          })),
        },
      },
      include: { items: true, customer: true },
    });
  }

  async update(id: string, dto: UpdateRequestDto, user?: AuthUser) {
    const existing = await this.getById(id, user);
    const isDealer = Boolean(user?.customerId);
    const ageMs = Date.now() - new Date(existing.createdAt).getTime();
    const within3Days = ageMs <= 3 * 24 * 60 * 60 * 1000;

    if (isDealer) {
      if (!within3Days && !['DRAFT', 'NEEDS_INFORMATION'].includes(existing.status)) {
        throw new BadRequestException({
          code: 'ORDER_LOCKED',
          message: 'Order can only be edited within 3 days of creation.',
        });
      }
      // Fabric lock: if any linked production has progressed past material prep, block fabric fields
      const fabricLocked = await this.prisma.productionOrder.findFirst({
        where: {
          salesOrder: {
            quotation: { requestId: id },
          },
          OR: [
            { currentStageCode: { in: ['UPHOLSTERY', 'FABRIC', 'ASSEMBLY', 'FINISHING', 'PACKING'] } },
            { progressPercent: { gte: 40 } },
          ],
        },
      });
      if (fabricLocked && dto.items?.some((i) => i.fabric || i.color)) {
        throw new BadRequestException({
          code: 'FABRIC_LOCKED',
          message: 'Fabric cannot be changed after fabric production has started.',
        });
      }
    } else if (!['DRAFT', 'NEEDS_INFORMATION'].includes(existing.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only draft or needs-information requests can be updated.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.requestItem.deleteMany({ where: { requestId: id } });
      }

      return tx.requestForQuotation.update({
        where: { id },
        data: {
          contactName: dto.contactName,
          source: dto.source,
          requiredDeliveryDate: dto.requiredDeliveryDate
            ? new Date(dto.requiredDeliveryDate)
            : undefined,
          priority: dto.priority,
          projectName: dto.projectName,
          deliveryAddress: dto.deliveryAddress,
          externalOrderNumber: dto.externalOrderNumber,
          endCustomerName: dto.endCustomerName,
          endCustomerPhone: dto.endCustomerPhone,
          endCustomerFax: dto.endCustomerFax,
          deliveryLat: dto.deliveryLat,
          deliveryLng: dto.deliveryLng,
          notes: dto.notes,
          internalNotes: dto.internalNotes,
          ...(dto.items
            ? {
                items: {
                  create: dto.items.map((item, index) => ({
                    category: item.category,
                    productId: item.productId,
                    productName: item.productName,
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit ?? 'pcs',
                    width: item.width,
                    height: item.height,
                    depth: item.depth,
                    material: item.material,
                    fabricType: item.fabric,
                    fabricColor: item.color,
                    notes: item.notes,
                    customMeasurements: item.customMeasurements?.length
                      ? (item.customMeasurements as unknown as Prisma.InputJsonValue)
                      : undefined,
                    sortOrder: index,
                  })),
                },
              }
            : {}),
        },
        include: { items: true, customer: true },
      });
    });
  }

  async submit(id: string, user?: AuthUser) {
    const request = await this.getById(id, user);
    if (!['DRAFT', 'NEEDS_INFORMATION'].includes(request.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only draft or needs-information requests can be submitted.',
      });
    }

    return this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'SUBMITTED' },
      include: { items: true, customer: true },
    });
  }

  async markUnderReview(id: string) {
    return this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'UNDER_REVIEW' },
    });
  }

  async markReadyForQuotation(id: string) {
    return this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'READY_FOR_QUOTATION' },
    });
  }

  async markQuoted(id: string) {
    return this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'QUOTED' },
    });
  }

  async markNeedsInformation(id: string, notes?: string) {
    const existing = await this.getById(id);
    return this.prisma.requestForQuotation.update({
      where: { id },
      data: {
        status: 'NEEDS_INFORMATION',
        internalNotes: notes
          ? [existing.internalNotes, notes].filter(Boolean).join('\n')
          : existing.internalNotes,
      },
      include: { items: true, customer: true },
    });
  }

  async close(id: string) {
    return this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }
}
