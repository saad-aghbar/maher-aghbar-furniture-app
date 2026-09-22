import { Module } from '@nestjs/common';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { QuoteCostHintService } from './quote-cost-hint.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SalesOrdersModule } from '../sales-orders/sales-orders.module';

@Module({
  imports: [NotificationsModule, SalesOrdersModule],
  controllers: [QuotationsController],
  providers: [QuotationsService, QuoteCostHintService],
})
export class QuotationsModule {}
