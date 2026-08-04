import { Module } from '@nestjs/common';
import { DeliveriesController } from './deliveries.controller';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [InvoicesModule],
  controllers: [DeliveriesController],
})
export class DeliveriesModule {}
