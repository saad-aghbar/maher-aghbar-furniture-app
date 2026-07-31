import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@maher/database';
import { PaymentsService } from './payments.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthUser } from '@maher/types';

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
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermissions('payment.read')
  list(@Query() query: PaginationDto) {
    return this.payments.list(query);
  }

  @Post()
  @RequirePermissions('payment.record')
  record(@Body() dto: RecordPaymentDto, @CurrentUser() user: AuthUser) {
    return this.payments.record(dto, user.id);
  }
}
