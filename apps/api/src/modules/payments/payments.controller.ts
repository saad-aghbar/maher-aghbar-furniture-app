import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@maher/database';
import { PaymentsService } from './payments.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListPaymentsDto } from './dto/payment.dto';
import type { AuthUser } from '@maher/types';

class AllocationDto {
  @IsUUID()
  invoiceId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount!: number;
}

class RecordPaymentDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount!: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  bank?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations?: AllocationDto[];
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermissions('payment.read')
  list(
    @Query() query: ListPaymentsDto & { dateFrom?: string; dateTo?: string; method?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.list(query, user);
  }

  @Get('dealer/:customerId/summary')
  @RequirePermissions('payment.read')
  dealerSummary(@Param('customerId') customerId: string, @CurrentUser() user: AuthUser) {
    if (user.customerId && user.customerId !== customerId) {
      return this.payments.getDealerFinanceSummary(user.customerId);
    }
    return this.payments.getDealerFinanceSummary(customerId);
  }

  @Post()
  @RequirePermissions('payment.record')
  record(@Body() dto: RecordPaymentDto, @CurrentUser() user: AuthUser) {
    return this.payments.record(dto, user.id);
  }
}
