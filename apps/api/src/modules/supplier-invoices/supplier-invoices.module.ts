import { Module } from '@nestjs/common';
import { SupplierInvoicesController } from './supplier-invoices.controller';
import { SupplierInvoicesService } from './supplier-invoices.service';

@Module({
  controllers: [SupplierInvoicesController],
  providers: [SupplierInvoicesService],
  exports: [SupplierInvoicesService],
})
export class SupplierInvoicesModule {}
