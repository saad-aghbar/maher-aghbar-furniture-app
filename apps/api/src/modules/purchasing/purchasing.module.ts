import { Module } from '@nestjs/common';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';
import { LowStockPrWebhookController } from './low-stock-pr.webhook.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PurchasingController, LowStockPrWebhookController],
  providers: [PurchasingService],
  exports: [PurchasingService],
})
export class PurchasingModule {}
