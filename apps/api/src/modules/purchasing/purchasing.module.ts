import { Module, forwardRef } from '@nestjs/common';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';
import { LowStockPrWebhookController } from './low-stock-pr.webhook.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [NotificationsModule, forwardRef(() => InventoryModule)],
  controllers: [PurchasingController, LowStockPrWebhookController],
  providers: [PurchasingService],
  exports: [PurchasingService],
})
export class PurchasingModule {}
