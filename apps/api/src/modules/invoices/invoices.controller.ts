import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from '../payments/payments.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListInvoicesDto } from './dto/invoice.dto';
import type { AuthUser } from '@maher/types';

class CreateInvoiceDto {
  @IsUUID()
  salesOrderId!: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

class ApplyCreditDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount?: number;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

@ApiTags('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  @RequirePermissions('invoice.read')
  list(
    @Query() query: ListInvoicesDto & { dateFrom?: string; dateTo?: string; overdue?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.list({
      ...query,
      customerId: user.customerId ?? query.customerId,
    });
  }

  @Get(':id')
  @RequirePermissions('invoice.read')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invoices.get(id, user);
  }

  @Get(':id/apply-credit/preview')
  @RequirePermissions('payment.record')
  previewApplyCredit(
    @Param('id') id: string,
    @Query('amount') amount?: string,
  ) {
    return this.payments.previewApplyCredit(
      id,
      amount != null && amount !== '' ? Number(amount) : undefined,
    );
  }

  @Post(':id/apply-credit')
  @RequirePermissions('payment.record')
  applyCredit(
    @Param('id') id: string,
    @Body() dto: ApplyCreditDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.applyCredit(
      { invoiceId: id, amount: dto.amount, idempotencyKey: dto.idempotencyKey },
      user.id,
    );
  }

  @Post()
  @RequirePermissions('invoice.create')
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.invoices.ensureFromSalesOrder(dto.salesOrderId, user.id, dto.idempotencyKey);
  }
}
