import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { CreateRequestDto, ListRequestsDto, UpdateRequestDto } from './dto/request.dto';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  async list(query: ListRequestsDto) {
    const where: Prisma.RequestForQuotationWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { projectName: { contains: query.q, mode: 'insensitive' } },
              { customer: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.requestForQuotation.count({ where }),
      this.prisma.requestForQuotation.findMany({
        where,
        include: { customer: { select: { id: true, name: true, code: true } }, items: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  async getById(id: string) {
    const request = await this.prisma.requestForQuotation.findFirst({
      where: { id, archivedAt: null },
      include: {
        customer: true,
        items: { orderBy: { sortOrder: 'asc' } },
        quotations: { select: { id: true, number: true, status: true } },
      },
    });
    if (!request) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Request not found.' });
    return request;
  }

  async create(dto: CreateRequestDto, userId: string) {
    const number = await this.sequences.next('RFQ', 'RFQ');
    return this.prisma.requestForQuotation.create({
      data: {
        number,
        customerId: dto.customerId,
        contactName: dto.contactName,
        source: dto.source ?? 'SALES',
        requiredDeliveryDate: dto.requiredDeliveryDate ? new Date(dto.requiredDeliveryDate) : undefined,
        priority: dto.priority ?? 'NORMAL',
        projectName: dto.projectName,
        deliveryAddress: dto.deliveryAddress,
        notes: dto.notes,
        status: 'DRAFT',
        createdById: userId,
        items: {
          create: dto.items.map((item, index) => ({
            category: item.category,
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
            sortOrder: index,
          })),
        },
      },
      include: { items: true, customer: true },
    });
  }

  async update(id: string, dto: UpdateRequestDto) {
    const existing = await this.getById(id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only draft requests can be updated.',
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
          requiredDeliveryDate: dto.requiredDeliveryDate ? new Date(dto.requiredDeliveryDate) : undefined,
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
                    width: item.width,
                    height: item.height,
                    depth: item.depth,
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

  async submit(id: string) {
    const request = await this.getById(id);
    if (request.status !== 'DRAFT') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only draft requests can be submitted.',
      });
    }

    return this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'SUBMITTED' },
      include: { items: true, customer: true },
    });
  }
}
