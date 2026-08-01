import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SalesOrderStatus } from '@maher/database';
import type { TranslateProvider } from '@maher/integrations';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { CreateCustomerDto, ListCustomersDto, UpdateCustomerDto } from './dto/customer.dto';
import { TRANSLATE_PROVIDER } from '../../integrations/integrations.module';

const CLOSED_ORDER_STATUSES: SalesOrderStatus[] = [
  SalesOrderStatus.DELIVERED,
  SalesOrderStatus.COMPLETED,
  SalesOrderStatus.CANCELLED,
];

function trimOrUndef(value?: string | null) {
  const v = value?.trim();
  return v ? v : undefined;
}

function resolveCanonicalName(dto: {
  name?: string;
  nameAr?: string;
  nameEn?: string;
  nameHe?: string;
}) {
  return (
    trimOrUndef(dto.nameAr) ||
    trimOrUndef(dto.nameEn) ||
    trimOrUndef(dto.nameHe) ||
    trimOrUndef(dto.name) ||
    ''
  );
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    @Inject(TRANSLATE_PROVIDER) private readonly translate: TranslateProvider,
  ) {}

  async list(query: ListCustomersDto) {
    const where: Prisma.CustomerWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { nameAr: { contains: query.q, mode: 'insensitive' } },
              { nameEn: { contains: query.q, mode: 'insensitive' } },
              { nameHe: { contains: query.q, mode: 'insensitive' } },
              { companyName: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q, mode: 'insensitive' } },
              { fax: { contains: query.q, mode: 'insensitive' } },
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

    const ids = data.map((c) => c.id);
    const activeCounts =
      ids.length === 0
        ? []
        : await this.prisma.salesOrder.groupBy({
            by: ['customerId'],
            where: {
              customerId: { in: ids },
              archivedAt: null,
              status: { notIn: CLOSED_ORDER_STATUSES },
            },
            _count: { _all: true },
          });
    const countByCustomer = new Map(
      activeCounts.map((row) => [row.customerId, row._count._all]),
    );

    return {
      data: data.map((customer) => ({
        ...customer,
        activeOrdersCount: countByCustomer.get(customer.id) ?? 0,
      })),
      meta: paginatedMeta(query.page, query.pageSize, totalItems),
    };
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

    const activeOrdersCount = await this.prisma.salesOrder.count({
      where: {
        customerId: id,
        archivedAt: null,
        status: { notIn: CLOSED_ORDER_STATUSES },
      },
    });

    return { ...customer, activeOrdersCount };
  }

  async create(dto: CreateCustomerDto, userId: string) {
    const nameAr = trimOrUndef(dto.nameAr);
    const nameEn = trimOrUndef(dto.nameEn);
    const nameHe = trimOrUndef(dto.nameHe);
    const name = resolveCanonicalName({ ...dto, nameAr, nameEn, nameHe });
    if (!name) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'At least one customer name (AR, EN, or HE) is required.',
      });
    }

    const code = await this.sequences.next('CUST', 'CUST');
    const customer = await this.prisma.customer.create({
      data: {
        code,
        name,
        nameAr: nameAr ?? null,
        nameEn: nameEn ?? null,
        nameHe: nameHe ?? null,
        customerType: dto.customerType ?? 'COMPANY',
        companyName: trimOrUndef(dto.companyName),
        phone: trimOrUndef(dto.phone),
        fax: trimOrUndef(dto.fax),
        email: trimOrUndef(dto.email)?.toLowerCase(),
        preferredLanguage: dto.preferredLanguage ?? 'ar',
        status: dto.status ?? 'ACTIVE',
        notes: trimOrUndef(dto.notes),
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

    return { ...customer, activeOrdersCount: 0 };
  }

  async update(id: string, dto: UpdateCustomerDto, userId: string) {
    const existing = await this.getById(id);

    const nameAr = dto.nameAr !== undefined ? trimOrUndef(dto.nameAr) : existing.nameAr ?? undefined;
    const nameEn = dto.nameEn !== undefined ? trimOrUndef(dto.nameEn) : existing.nameEn ?? undefined;
    const nameHe = dto.nameHe !== undefined ? trimOrUndef(dto.nameHe) : existing.nameHe ?? undefined;
    const nextName =
      dto.nameAr !== undefined || dto.nameEn !== undefined || dto.nameHe !== undefined || dto.name
        ? resolveCanonicalName({
            name: dto.name,
            nameAr,
            nameEn,
            nameHe,
          }) || existing.name
        : undefined;

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(nextName ? { name: nextName } : {}),
        ...(dto.nameAr !== undefined ? { nameAr: nameAr ?? null } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: nameEn ?? null } : {}),
        ...(dto.nameHe !== undefined ? { nameHe: nameHe ?? null } : {}),
        ...(dto.customerType !== undefined ? { customerType: dto.customerType } : {}),
        ...(dto.companyName !== undefined ? { companyName: trimOrUndef(dto.companyName) ?? null } : {}),
        ...(dto.phone !== undefined ? { phone: trimOrUndef(dto.phone) ?? null } : {}),
        ...(dto.fax !== undefined ? { fax: trimOrUndef(dto.fax) ?? null } : {}),
        ...(dto.email !== undefined ? { email: trimOrUndef(dto.email)?.toLowerCase() ?? null } : {}),
        ...(dto.preferredLanguage !== undefined ? { preferredLanguage: dto.preferredLanguage } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: trimOrUndef(dto.notes) ?? null } : {}),
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

  /**
   * AI-suggested multilingual names. UI must confirm before save —
   * this endpoint never persists.
   */
  async suggestTranslations(name: string) {
    const trimmed = name?.trim();
    if (!trimmed) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'name is required.',
      });
    }
    const suggestions = await this.translate.suggestNameTranslations(trimmed);
    return {
      ...suggestions,
      note: 'AI suggestion only — confirm in UI before saving.',
      requiresConfirmation: true as const,
    };
  }
}
