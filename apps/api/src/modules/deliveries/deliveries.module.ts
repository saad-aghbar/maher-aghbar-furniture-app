import { Module, forwardRef } from '@nestjs/common';
import { DeliveriesController } from './deliveries.controller';
import { DeliveryLoadService } from './delivery-load.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductionModule } from '../production/production.module';

@Module({
  imports: [
    InvoicesModule,
    NotificationsModule,
    InventoryModule,
    forwardRef(() => ProductionModule),
  ],
  controllers: [DeliveriesController],
  providers: [DeliveryLoadService],
  exports: [DeliveryLoadService],
})
export class DeliveriesModule {}
