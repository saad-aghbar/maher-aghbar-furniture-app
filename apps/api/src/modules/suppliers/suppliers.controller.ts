import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import { pageSkipTake } from '../../common/dto/list-query.dto';
import type { AuthUser } from '@maher/types';

class ListSuppliersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;
}

class SupplierDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsString() nameHe?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() registrationNo?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) paymentTermsDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) leadTimeDays?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) rating?: number;
  @IsOptional() @IsBoolean() isCertified?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() status?: string;
}

class UpdateSupplierDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsString() nameHe?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() registrationNo?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) paymentTermsDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) leadTimeDays?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) rating?: number;
  @IsOptional() @IsBoolean() isCertified?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() status?: string;
}

class ContactDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

@ApiTags('suppliers')
@Controller('suppliers')
export class SuppliersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  @Get()
  @RequirePermissions('supplier.read')
  async list(@Query() query: ListSuppliersDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where: Prisma.SupplierWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { nameAr: { contains: query.q, mode: 'insensitive' } },
              { nameEn: { contains: query.q, mode: 'insensitive' } },
              { nameHe: { contains: query.q, mode: 'insensitive' } },
              { code: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { companyName: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        include: { contacts: true },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  @Post()
  @RequirePermissions('supplier.manage')
  async create(@Body() dto: SupplierDto, @CurrentUser() user: AuthUser) {
    const code = await this.sequences.next('SUP', 'SUP');
    const row = await this.prisma.supplier.create({
      data: {
        code,
        name: dto.nameEn?.trim() || dto.nameAr?.trim() || dto.name,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        nameHe: dto.nameHe,
        companyName: dto.companyName,
        registrationNo: dto.registrationNo,
        taxNumber: dto.taxNumber,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        paymentTermsDays: dto.paymentTermsDays ?? 30,
        leadTimeDays: dto.leadTimeDays ?? 7,
        rating: dto.rating,
        isCertified: dto.isCertified ?? false,
        notes: dto.notes,
        status: dto.status ?? 'ACTIVE',
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'supplier.create',
        entityType: 'Supplier',
        entityId: row.id,
        newValues: row as unknown as Prisma.InputJsonValue,
      },
    });
    return row;
  }

  @Get(':id')
  @RequirePermissions('supplier.read')
  async get(@Param('id') id: string) {
    const row = await this.prisma.supplier.findFirst({
      where: { id, archivedAt: null },
      include: { contacts: true, purchaseOrders: { take: 20, orderBy: { createdAt: 'desc' } } },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Supplier not found.' });
    return row;
  }

  @Patch(':id')
  @RequirePermissions('supplier.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.prisma.supplier.update({ where: { id }, data: dto });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'supplier.update',
        entityType: 'Supplier',
        entityId: id,
        newValues: row as unknown as Prisma.InputJsonValue,
      },
    });
    return row;
  }

  @Post(':id/deactivate')
  @RequirePermissions('supplier.manage')
  async deactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const row = await this.prisma.supplier.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.prisma.auditEvent.create({
      data: { userId: user.id, action: 'supplier.deactivate', entityType: 'Supplier', entityId: id },
    });
    return row;
  }

  @Post(':id/activate')
  @RequirePermissions('supplier.manage')
  async activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const row = await this.prisma.supplier.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.prisma.auditEvent.create({
      data: { userId: user.id, action: 'supplier.activate', entityType: 'Supplier', entityId: id },
    });
    return row;
  }

  @Post(':id/contacts')
  @RequirePermissions('supplier.manage')
  createContact(@Param('id') supplierId: string, @Body() dto: ContactDto) {
    return this.prisma.supplierContact.create({ data: { supplierId, ...dto } });
  }
}
