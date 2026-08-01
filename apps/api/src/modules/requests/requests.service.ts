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
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
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
        documents: { where: { archivedAt: null }, select: { id: true, fileName: true, mimeType: true, category: true } },
      },
    });
    if (!request) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Request not found.' });
    if (!assertCustomerOwns(user, request.customerId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your request.' });
    }
    return request;
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
        notes: dto.notes,
        status: opts?.submit ? 'SUBMITTED' : 'DRAFT',
        createdById: userId,
        items: {
          create: dto.items.map((item, index) => ({
            category: item.category,
            productName: item.productName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit ?? 'pcs',
            material: item.material,
            fabricType: item.fabric,
            fabricColor: item.color,
            notes: item.notes,
            sortOrder: index,
          })),
        },
      },
      include: { items: true, customer: true },
    });
  }

  async update(id: string, dto: UpdateRequestDto, user?: AuthUser) {
    const existing = await this.getById(id, user);
    if (!['DRAFT', 'NEEDS_INFORMATION'].includes(existing.status)) {
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
          notes: dto.notes,
          internalNotes: dto.internalNotes,
          ...(dto.items
            ? {
                items: {
                  create: dto.items.map((item, index) => ({
                    category: item.category,
                    productName: item.productName,
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit ?? 'pcs',
                    material: item.material,
                    fabricType: item.fabric,
                    fabricColor: item.color,
                    notes: item.notes,
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
