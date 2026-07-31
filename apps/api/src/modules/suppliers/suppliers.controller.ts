import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';

class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;
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
  async list(@Query() query: PaginationDto) {
    const where = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' as const } },
            { code: { contains: query.q, mode: 'insensitive' as const } },
          ],
          archivedAt: null,
        }
      : { archivedAt: null };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        include: { contacts: true },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  @Post()
  @RequirePermissions('supplier.manage')
  async create(@Body() dto: CreateSupplierDto) {
    const code = await this.sequences.next('SUP', 'SUP');
    return this.prisma.supplier.create({
      data: {
        code,
        name: dto.name,
        companyName: dto.companyName,
        phone: dto.phone,
        email: dto.email,
      },
    });
  }

  @Get(':id')
  @RequirePermissions('supplier.read')
  get(@Param('id') id: string) {
    return this.prisma.supplier.findUniqueOrThrow({
      where: { id },
      include: { contacts: true, purchaseOrders: true },
    });
  }
}
