import { Module } from '@nestjs/common';
import { DeliveriesController } from './deliveries.controller';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InvoicesModule, NotificationsModule, InventoryModule],
  controllers: [DeliveriesController],
})
export class DeliveriesModule {}
