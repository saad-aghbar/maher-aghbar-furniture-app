import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import {
  appendReviewHistory,
  mapOrderPresentation,
  requestStatusesForGroup,
  type AuthUser,
} from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { assertCustomerOwns, customerScopeFilter } from '../../common/helpers/customer-scope';
import { CreateRequestDto, ListRequestsDto, UpdateRequestDto } from './dto/request.dto';
import {
  computeDealerEditPolicy,
  detectsFabricMutation,
  isFabricInProduction,
  preserveFabricOnItems,
  type DealerEditPolicy,
} from './dealer-edit-policy';
import { loadCatalogMap, mapRequestItemCreate } from './request-line-classify';
import { NotificationsService } from '../notifications/notifications.service';
import { LocalStorageService } from '../../integrations/storage/local-storage.service';
import { firstImageDocument } from '../../common/helpers/document-image.util';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly notifications: NotificationsService,
    private readonly storage: LocalStorageService,
  ) {}

  /** Short-lived download URL for list/detail thumbnails. */
  private documentImageUrl(doc: { storageKey: string } | null | undefined): string | null {
    if (!doc?.storageKey) return null;
    const token = this.storage.createAccessToken(doc.storageKey, 3600);
    return `/api/v1/uploads/download?token=${token}`;
  }

  private async notifyNewOrder(request: {
    id: string;
    number: string;
    customer?: { name?: string | null; nameEn?: string | null } | null;
  }) {
    await this.notifications.notifyAdminUsers({
      templateCode: 'NEW_ORDER',
      vars: {
        number: request.number,
        customerName: request.customer?.nameEn || request.customer?.name || '—',
      },
      linkUrl: `/requests/${request.id}`,
    });
  }

  private async notifyNeedsInformation(request: {
    id: string;
    number: string;
    customerId: string;
    informationRequestReason?: string | null;
  }) {
    await this.notifications.notifyCustomerUsers(request.customerId, {
      templateCode: 'ORDER_NEEDS_INFORMATION',
      vars: {
        number: request.number,
        reason: request.informationRequestReason || '—',
      },
      linkUrl: `/requests/${request.id}`,
    });
  }

  private assertStaffReview(user?: AuthUser) {
    if (user?.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Dealers cannot perform factory review actions.',
      });
    }
  }

  async list(query: ListRequestsDto, user?: AuthUser) {
    const groupStatuses = query.statusGroup
      ? requestStatusesForGroup(query.statusGroup)
      : null;
    const where: Prisma.RequestForQuotationWhereInput = {
      archivedAt: null,
      ...customerScopeFilter(user),
      ...(groupStatuses?.length
        ? { status: { in: groupStatuses as Prisma.EnumRequestStatusFilter['in'] } }
        : query.status
          ? { status: query.status }
          : {}),
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
              { items: { some: { productName: { contains: query.q, mode: 'insensitive' } } } },
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
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              category: true,
              storageKey: true,
            },
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
      const catalogImage = match?.imageUrl ?? null;
      const attachmentImage = catalogImage
        ? null
        : this.documentImageUrl(firstImageDocument(row.documents));
      const { documents, ...rest } = row;
      const safeDocuments = documents.map(({ storageKey: _k, ...doc }) => doc);
      return {
        ...rest,
        documents: safeDocuments,
        title: primaryName || row.number,
        imageUrl: catalogImage ?? attachmentImage,
        presentationKey: mapOrderPresentation({ requestStatus: row.status }),
        productCount: row.items.length,
        hasCustomLines: row.items.some(
          (i) =>
            i.manufacturingComplexity === 'CUSTOM' ||
            i.manufacturingComplexity === 'MODIFIED' ||
            !i.productId,
        ),
        attachmentCount: documents.length,
        informationRequestReason: row.informationRequestReason,
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
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            category: true,
            storageKey: true,
          },
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
    const catalogImage = await this.resolveProductImage({
      productId: primary?.productId,
      productName: primaryName,
    });
    const imageUrl =
      catalogImage ?? this.documentImageUrl(firstImageDocument(request.documents));
    const editPolicy = await this.buildEditPolicy(request, user);
    // Never expose storage keys to clients
    const documents = request.documents.map(({ storageKey: _storageKey, ...doc }) => doc);
    return {
      ...request,
      documents,
      title: primaryName || request.number,
      imageUrl,
      editPolicy,
      presentationKey: mapOrderPresentation({ requestStatus: request.status }),
      informationRequestReason: request.informationRequestReason,
    };
  }

  private async buildEditPolicy(
    request: {
      id: string;
      status: string;
      createdAt: Date;
      submittedAt?: Date | null;
      items: Array<{
        fabricType?: string | null;
        fabricColor?: string | null;
        fabricCode?: string | null;
      }>;
    },
    user?: AuthUser,
  ): Promise<DealerEditPolicy> {
    const isDealer = Boolean(user?.customerId);
    const fabricInProduction = await this.isFabricProductionStarted(request.id);
    return computeDealerEditPolicy({
      status: request.status,
      submittedAt: request.submittedAt ?? null,
      createdAt: request.createdAt,
      serverNow: new Date(),
      fabricInProduction,
      isDealer,
    });
  }

  private async isFabricProductionStarted(requestId: string): Promise<boolean> {
    const production = await this.prisma.productionOrder.findFirst({
      where: {
        salesOrder: {
          quotation: { requestId },
        },
      },
      select: { currentStageCode: true, progressPercent: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!production) return false;
    return isFabricInProduction(production);
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
    const catalogMap = await loadCatalogMap(this.prisma, dto.items);
    const created = await this.prisma.requestForQuotation.create({
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
        // Blank dealer PO → same as factory RFQ number.
        externalOrderNumber: dto.externalOrderNumber?.trim() || number,
        endCustomerName: dto.endCustomerName,
        endCustomerPhone: dto.endCustomerPhone,
        endCustomerFax: dto.endCustomerFax,
        deliveryLat: dto.deliveryLat,
        deliveryLng: dto.deliveryLng,
        notes: dto.notes,
        status: opts?.submit ? 'SUBMITTED' : 'DRAFT',
        submittedAt: opts?.submit ? new Date() : undefined,
        createdById: userId,
        reviewHistory: opts?.submit
          ? ([
              {
                at: new Date().toISOString(),
                by: userId,
                action: 'SUBMITTED',
                message: null,
              },
            ] as unknown as Prisma.InputJsonValue)
          : undefined,
        items: {
          create: dto.items.map((item, index) =>
            mapRequestItemCreate(
              item,
              index,
              item.productId ? catalogMap.get(item.productId) : null,
            ),
          ),
        },
      },
      include: { items: true, customer: true },
    });
    if (opts?.submit) {
      await this.notifyNewOrder(created).catch(() => undefined);
    }
    return created;
  }

  async update(id: string, dto: UpdateRequestDto, user?: AuthUser) {
    // Reject client attempts to smuggle authorization via unknown lock/unlock flags.
    const raw = dto as UpdateRequestDto & Record<string, unknown>;
    for (const banned of [
      'editWindowEndsAt',
      'remainingMs',
      'canEdit',
      'fabricLocked',
      'serverNow',
      'submittedAt',
      'unlocked',
      'forceUnlock',
    ]) {
      if (Object.prototype.hasOwnProperty.call(raw, banned) && raw[banned] != null) {
        throw new ConflictException({
          code: 'ORDER_LOCKED',
          message: 'Client-supplied edit authorization is not allowed.',
        });
      }
    }

    const existing = await this.getById(id, user);
    const isDealer = Boolean(user?.customerId);
    const serverNow = new Date();
    const fabricInProduction = await this.isFabricProductionStarted(id);
    const policy = computeDealerEditPolicy({
      status: existing.status,
      submittedAt: existing.submittedAt ?? null,
      createdAt: existing.createdAt,
      serverNow,
      fabricInProduction,
      isDealer,
    });

    if (isDealer && !policy.canEdit) {
      throw new ConflictException({
        code: 'ORDER_LOCKED',
        message: policy.lockReasons[0]?.message ?? 'Order is locked and cannot be edited.',
        details: { editPolicy: policy },
      });
    }

    let items = dto.items;
    if (isDealer && policy.fabricLocked && items) {
      const existingItems = (existing.items ?? []).map((i) => ({
        fabricType: i.fabricType,
        fabricColor: i.fabricColor,
        fabricCode: i.fabricCode,
        fabric: i.fabricType,
        color: i.fabricColor,
      }));
      if (detectsFabricMutation(existingItems, items)) {
        throw new ConflictException({
          code: 'FABRIC_LOCKED',
          message: 'Fabric cannot be changed after fabric production has started.',
          details: { editPolicy: policy },
        });
      }
      // Notes / dimensions may still change — preserve fabric from server rows.
      items = preserveFabricOnItems(existingItems, items);
    }

    const catalogMap = items ? await loadCatalogMap(this.prisma, items) : new Map();
    const updated = await this.prisma.$transaction(async (tx) => {
      if (items) {
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
          // Dealers never write internalNotes.
          internalNotes: isDealer ? undefined : dto.internalNotes,
          ...(items
            ? {
                items: {
                  create: items.map((item, index) =>
                    mapRequestItemCreate(
                      item,
                      index,
                      item.productId ? catalogMap.get(item.productId) : null,
                    ),
                  ),
                },
              }
            : {}),
        },
        include: { items: true, customer: true },
      });
    });

    if (user?.id) {
      await this.prisma.auditEvent.create({
        data: {
          userId: user.id,
          action: 'request.update',
          entityType: 'RequestForQuotation',
          entityId: id,
          oldValues: {
            status: existing.status,
            notes: existing.notes,
            deliveryAddress: existing.deliveryAddress,
            externalOrderNumber: existing.externalOrderNumber,
            endCustomerName: existing.endCustomerName,
            endCustomerPhone: existing.endCustomerPhone,
            fabricLocked: policy.fabricLocked,
          } as Prisma.InputJsonValue,
          newValues: {
            notes: updated.notes,
            deliveryAddress: updated.deliveryAddress,
            externalOrderNumber: updated.externalOrderNumber,
            endCustomerName: updated.endCustomerName,
            endCustomerPhone: updated.endCustomerPhone,
            itemCount: updated.items?.length ?? 0,
            serverNow: serverNow.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }

    const editPolicy = await this.buildEditPolicy(updated, user);
    return { ...updated, editPolicy };
  }

  async submit(id: string, user?: AuthUser) {
    const request = await this.getById(id, user);
    if (!['DRAFT', 'NEEDS_INFORMATION'].includes(request.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only draft or needs-information requests can be submitted.',
      });
    }
    if (!request.items?.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Add at least one product before submitting.',
      });
    }
    for (const item of request.items) {
      if (!item.productName?.trim() || Number(item.quantity) <= 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Each line needs a product name and quantity greater than zero.',
        });
      }
    }

    const submittedAt = new Date();
    const wasNeedsInfo = request.status === 'NEEDS_INFORMATION';
    const history = appendReviewHistory(request.reviewHistory, {
      at: submittedAt.toISOString(),
      by: user?.id ?? null,
      action: wasNeedsInfo ? 'RESUBMITTED' : 'SUBMITTED',
      message: wasNeedsInfo ? request.informationRequestReason : null,
    });

    const updated = await this.prisma.requestForQuotation.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: request.submittedAt ?? submittedAt,
        informationRequestReason: null,
        reviewHistory: history as unknown as Prisma.InputJsonValue,
      },
      include: { items: true, customer: true },
    });

    if (user?.id) {
      await this.prisma.auditEvent.create({
        data: {
          userId: user.id,
          action: wasNeedsInfo ? 'request.resubmit' : 'request.submit',
          entityType: 'RequestForQuotation',
          entityId: id,
          oldValues: { status: request.status } as Prisma.InputJsonValue,
          newValues: {
            status: 'SUBMITTED',
            submittedAt: updated.submittedAt?.toISOString() ?? submittedAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }

    await this.notifyNewOrder(updated).catch(() => undefined);

    const editPolicy = await this.buildEditPolicy(updated, user);
    return {
      ...updated,
      editPolicy,
      presentationKey: mapOrderPresentation({ requestStatus: updated.status }),
    };
  }

  async discardDraft(id: string, user?: AuthUser) {
    const request = await this.getById(id, user);
    if (request.status !== 'DRAFT') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only draft orders can be discarded.',
      });
    }
    await this.prisma.requestForQuotation.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return { id, discarded: true };
  }

  async markUnderReview(id: string, user?: AuthUser) {
    this.assertStaffReview(user);
    const existing = await this.getById(id);
    const history = appendReviewHistory(existing.reviewHistory, {
      at: new Date().toISOString(),
      by: user?.id ?? null,
      action: 'UNDER_REVIEW',
    });
    return this.prisma.requestForQuotation.update({
      where: { id },
      data: {
        status: 'UNDER_REVIEW',
        reviewHistory: history as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async markReadyForQuotation(id: string, user?: AuthUser) {
    this.assertStaffReview(user);
    const existing = await this.getById(id);
    const history = appendReviewHistory(existing.reviewHistory, {
      at: new Date().toISOString(),
      by: user?.id ?? null,
      action: 'READY_FOR_QUOTATION',
    });
    return this.prisma.requestForQuotation.update({
      where: { id },
      data: {
        status: 'READY_FOR_QUOTATION',
        reviewHistory: history as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async markQuoted(id: string) {
    return this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'QUOTED' },
    });
  }

  async markNeedsInformation(id: string, reason?: string, user?: AuthUser) {
    this.assertStaffReview(user);
    const existing = await this.getById(id);
    const trimmed = reason?.trim();
    if (!trimmed) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A reason is required when requesting information.',
      });
    }
    if (!['SUBMITTED', 'UNDER_REVIEW', 'READY_FOR_QUOTATION'].includes(existing.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only submitted or in-review requests can be returned for information.',
      });
    }
    const history = appendReviewHistory(existing.reviewHistory, {
      at: new Date().toISOString(),
      by: user?.id ?? null,
      action: 'NEEDS_INFORMATION',
      message: trimmed,
    });
    const updated = await this.prisma.requestForQuotation.update({
      where: { id },
      data: {
        status: 'NEEDS_INFORMATION',
        informationRequestReason: trimmed,
        internalNotes: [existing.internalNotes, `Needs info: ${trimmed}`]
          .filter(Boolean)
          .join('\n'),
        reviewHistory: history as unknown as Prisma.InputJsonValue,
      },
      include: { items: true, customer: true },
    });
    await this.notifyNeedsInformation(updated).catch(() => undefined);
    return {
      ...updated,
      presentationKey: mapOrderPresentation({ requestStatus: updated.status }),
    };
  }

  async close(id: string, user?: AuthUser) {
    this.assertStaffReview(user);
    return this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }
}
