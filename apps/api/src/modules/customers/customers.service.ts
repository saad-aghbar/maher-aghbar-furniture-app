import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SalesOrderStatus } from '@maher/database';
import type { TranslateProvider } from '@maher/integrations';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
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

/** Waiting to enter the factory floor */
const WAITING_ORDER_STATUSES: SalesOrderStatus[] = [
  SalesOrderStatus.DRAFT,
  SalesOrderStatus.CONFIRMED,
  SalesOrderStatus.WAITING_FOR_PAYMENT,
  SalesOrderStatus.WAITING_FOR_MATERIALS,
  SalesOrderStatus.READY_FOR_PRODUCTION,
  SalesOrderStatus.ON_HOLD,
];

const IN_WORK_ORDER_STATUSES: SalesOrderStatus[] = [SalesOrderStatus.IN_PRODUCTION];

const DONE_ORDER_STATUSES: SalesOrderStatus[] = [
  SalesOrderStatus.READY_FOR_DELIVERY,
  SalesOrderStatus.DELIVERED,
  SalesOrderStatus.COMPLETED,
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
    if (ids.length === 0) {
      return { data: [], meta: paginatedMeta(query.page, query.pageSize, totalItems) };
    }

    const [orderGroups, invoiceGroups] = await Promise.all([
      this.prisma.salesOrder.groupBy({
        by: ['customerId', 'status'],
        where: {
          customerId: { in: ids },
          archivedAt: null,
          status: { not: SalesOrderStatus.CANCELLED },
        },
        _count: { _all: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['customerId'],
        where: {
          customerId: { in: ids },
          archivedAt: null,
          status: { notIn: ['CANCELLED', 'VOID', 'DRAFT'] },
        },
        _sum: {
          total: true,
          paidAmount: true,
          outstandingAmount: true,
        },
      }),
    ]);

    type OrderBucket = { waiting: number; inWork: number; done: number; active: number };
    const ordersByCustomer = new Map<string, OrderBucket>();
    for (const row of orderGroups) {
      const bucket = ordersByCustomer.get(row.customerId) ?? {
        waiting: 0,
        inWork: 0,
        done: 0,
        active: 0,
      };
      const n = row._count._all;
      if (WAITING_ORDER_STATUSES.includes(row.status)) bucket.waiting += n;
      else if (IN_WORK_ORDER_STATUSES.includes(row.status)) bucket.inWork += n;
      else if (DONE_ORDER_STATUSES.includes(row.status)) bucket.done += n;
      if (!CLOSED_ORDER_STATUSES.includes(row.status)) bucket.active += n;
      ordersByCustomer.set(row.customerId, bucket);
    }

    const moneyByCustomer = new Map(
      invoiceGroups.map((row) => [
        row.customerId,
        {
          invoicedTotal: Number(row._sum.total ?? 0),
          paidTotal: Number(row._sum.paidAmount ?? 0),
          outstandingTotal: Number(row._sum.outstandingAmount ?? 0),
        },
      ]),
    );

    return {
      data: data.map((customer) => {
        const orders = ordersByCustomer.get(customer.id) ?? {
          waiting: 0,
          inWork: 0,
          done: 0,
          active: 0,
        };
        const money = moneyByCustomer.get(customer.id) ?? {
          invoicedTotal: 0,
          paidTotal: 0,
          outstandingTotal: 0,
        };
        return {
          ...customer,
          activeOrdersCount: orders.active,
          waitingOrdersCount: orders.waiting,
          inWorkOrdersCount: orders.inWork,
          doneOrdersCount: orders.done,
          invoicedTotal: money.invoicedTotal,
          paidTotal: money.paidTotal,
          outstandingTotal: money.outstandingTotal,
        };
      }),
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

    const [orderGroups, invoiceSum] = await Promise.all([
      this.prisma.salesOrder.groupBy({
        by: ['status'],
        where: {
          customerId: id,
          archivedAt: null,
          status: { not: SalesOrderStatus.CANCELLED },
        },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          customerId: id,
          archivedAt: null,
          status: { notIn: ['CANCELLED', 'VOID', 'DRAFT'] },
        },
        _sum: {
          total: true,
          paidAmount: true,
          outstandingAmount: true,
        },
      }),
    ]);

    let waiting = 0;
    let inWork = 0;
    let done = 0;
    let active = 0;
    for (const row of orderGroups) {
      const n = row._count._all;
      if (WAITING_ORDER_STATUSES.includes(row.status)) waiting += n;
      else if (IN_WORK_ORDER_STATUSES.includes(row.status)) inWork += n;
      else if (DONE_ORDER_STATUSES.includes(row.status)) done += n;
      if (!CLOSED_ORDER_STATUSES.includes(row.status)) active += n;
    }

    return {
      ...customer,
      activeOrdersCount: active,
      waitingOrdersCount: waiting,
      inWorkOrdersCount: inWork,
      doneOrdersCount: done,
      invoicedTotal: Number(invoiceSum._sum.total ?? 0),
      paidTotal: Number(invoiceSum._sum.paidAmount ?? 0),
      outstandingTotal: Number(invoiceSum._sum.outstandingAmount ?? 0),
    };
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
    if (!trimOrUndef(dto.phone)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Phone is required.',
      });
    }
    if (!dto.address?.city?.trim() || !dto.address?.label?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Address label and city are required.',
      });
    }

    const code = await this.sequences.next('CUST', 'CUST');
    const baseUsername = code.toLowerCase().replace(/[^a-z0-9]/g, '');
    let username = baseUsername;
    let suffix = 1;
    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${suffix++}`;
    }

    const tempPassword = `Tmp-${randomBytes(6).toString('base64url')}!A1`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const customerRole = await this.prisma.role.findUnique({ where: { code: 'CUSTOMER' } });
    if (!customerRole) {
      throw new BadRequestException({
        code: 'CONFIG_ERROR',
        message: 'CUSTOMER role is not configured.',
      });
    }

    const customer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
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
          addresses: {
            create: {
              label: dto.address.label.trim(),
              city: dto.address.city.trim(),
              street: trimOrUndef(dto.address.street),
              area: trimOrUndef(dto.address.area),
              country: dto.address.country?.trim() || 'JO',
              isDefaultBilling: true,
              isDefaultDelivery: true,
            },
          },
        },
      });

      await tx.user.create({
        data: {
          username,
          email: trimOrUndef(dto.email)?.toLowerCase(),
          passwordHash,
          firstName: nameEn ?? nameAr ?? name,
          lastName: '',
          phone: trimOrUndef(dto.phone),
          preferredLanguage: dto.preferredLanguage ?? 'ar',
          isActive: true,
          customerId: created.id,
          roles: { create: { roleId: customerRole.id } },
        },
      });

      return created;
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

    return {
      ...customer,
      activeOrdersCount: 0,
      portalCredentials: { username, temporaryPassword: tempPassword },
    };
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
