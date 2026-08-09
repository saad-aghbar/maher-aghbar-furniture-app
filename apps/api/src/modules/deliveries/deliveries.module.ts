import { Module } from '@nestjs/common';
import { DeliveriesController } from './deliveries.controller';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [InvoicesModule, NotificationsModule],
  controllers: [DeliveriesController],
})
export class DeliveriesModule {}
