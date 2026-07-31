import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { CreateCustomerDto, ListCustomersDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  async list(query: ListCustomersDto) {
    const where: Prisma.CustomerWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { companyName: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q, mode: 'insensitive' } },
              { code: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  async getById(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, archivedAt: null },
      include: {
        contacts: { where: { archivedAt: null }, orderBy: { isPrimary: 'desc' } },
        addresses: { where: { archivedAt: null } },
      },
    });
    if (!customer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Customer not found.' });
    return customer;
  }

  async create(dto: CreateCustomerDto, userId: string) {
    const code = await this.sequences.next('CUST', 'CUST');
    const customer = await this.prisma.customer.create({
      data: {
        code,
        name: dto.name,
        customerType: dto.customerType ?? 'COMPANY',
        companyName: dto.companyName,
        phone: dto.phone,
        email: dto.email?.toLowerCase(),
        preferredLanguage: dto.preferredLanguage ?? 'ar',
        status: dto.status ?? 'LEAD',
        notes: dto.notes,
        createdById: userId,
        updatedById: userId,
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'customer.create',
        entityType: 'Customer',
        entityId: customer.id,
        newValues: customer as unknown as Prisma.InputJsonValue,
      },
    });

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, userId: string) {
    const existing = await this.getById(id);
    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        email: dto.email?.toLowerCase(),
        updatedById: userId,
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'customer.update',
        entityType: 'Customer',
        entityId: id,
        oldValues: existing as unknown as Prisma.InputJsonValue,
        newValues: customer as unknown as Prisma.InputJsonValue,
      },
    });

    return customer;
  }
}
