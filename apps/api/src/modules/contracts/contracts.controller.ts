import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ContractStatus } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import { roundMoney } from '../../common/helpers/money.util';
import type { AuthUser } from '@maher/types';

class CreateContractDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  salesOrderId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  contractValue!: number;

  @IsOptional()
  @IsString()
  paymentSchedule?: string;

  @IsOptional()
  @IsString()
  deliveryMilestones?: string;

  @IsOptional()
  @IsString()
  warranty?: string;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

@ApiTags('contracts')
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  @Get()
  @RequirePermissions('contract.read')
  async list(@Query() query: PaginationDto) {
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.contract.count({ where: { archivedAt: null } }),
      this.prisma.contract.findMany({
        where: { archivedAt: null },
        include: { customer: true, salesOrder: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  @Post()
  @RequirePermissions('contract.manage')
  async create(@Body() dto: CreateContractDto, @CurrentUser() user: AuthUser) {
    const number = await this.sequences.next('CTR', 'CTR');
    const contract = await this.prisma.contract.create({
      data: {
        number,
        customerId: dto.customerId,
        salesOrderId: dto.salesOrderId,
        contractValue: roundMoney(dto.contractValue),
        paymentSchedule: dto.paymentSchedule,
        deliveryMilestones: dto.deliveryMilestones,
        warranty: dto.warranty,
        terms: dto.terms,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: ContractStatus.DRAFT,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'contract.create',
        entityType: 'Contract',
        entityId: contract.id,
      },
    });
    return contract;
  }

  @Get(':id')
  @RequirePermissions('contract.read')
  get(@Param('id') id: string) {
    return this.prisma.contract.findUniqueOrThrow({
      where: { id },
      include: { customer: true, salesOrder: true },
    });
  }

  @Post(':id/activate')
  @RequirePermissions('contract.manage')
  activate(@Param('id') id: string) {
    return this.prisma.contract.update({
      where: { id },
      data: { status: ContractStatus.ACTIVE },
    });
  }
}
