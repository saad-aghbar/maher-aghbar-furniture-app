import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { InvoicesService } from './invoices.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListInvoicesDto } from './dto/invoice.dto';
import type { AuthUser } from '@maher/types';

class CreateInvoiceDto {
  @IsUUID()
  salesOrderId!: string;
}

@ApiTags('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermissions('invoice.read')
  list(@Query() query: ListInvoicesDto, @CurrentUser() user: AuthUser) {
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

  @Post()
  @RequirePermissions('invoice.create')
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUser) {
    // Idempotent: delivery/completion may already have auto-created the invoice.
    return this.invoices.ensureFromSalesOrder(dto.salesOrderId, user.id);
  }
}
