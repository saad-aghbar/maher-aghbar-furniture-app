import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@maher/database';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListSupplierInvoicesDto } from './dto/supplier-invoice.dto';
import type { AuthUser } from '@maher/types';

class CreateSupplierInvoiceDto {
  @IsUUID()
  purchaseOrderId!: string;

  @IsOptional()
  @IsUUID()
  goodsReceiptId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class RecordSupplierPaymentDto {
  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @IsUUID()
  supplierInvoiceId?: string;

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
  notes?: string;
}

@ApiTags('supplier-invoices')
@Controller()
export class SupplierInvoicesController {
  constructor(private readonly service: SupplierInvoicesService) {}

  @Get('supplier-invoices')
  @RequirePermissions('supplier-invoice.read')
  list(@Query() query: ListSupplierInvoicesDto) {
    return this.service.list(query);
  }

  @Get('supplier-invoices/:id')
  @RequirePermissions('supplier-invoice.read')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post('supplier-invoices')
  @RequirePermissions('supplier-invoice.create')
  create(@Body() dto: CreateSupplierInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.service.createFromPurchaseOrder(dto, user.id);
  }

  @Post('supplier-payments')
  @RequirePermissions('supplier-payment.record')
  recordPayment(
    @Body() dto: RecordSupplierPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.recordPayment(dto, user.id);
  }
}
