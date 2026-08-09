import { Module } from '@nestjs/common';
import { IdempotencyService } from '../../common/idempotency.service';
import { InventoryModule } from '../inventory/inventory.module';
import { ReportsModule } from '../reports/reports.module';
import { SalesOrdersModule } from '../sales-orders/sales-orders.module';
import { AiChatAgentService } from './ai-chat.agent';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiChatToolsService } from './ai-chat.tools';

@Module({
  imports: [ReportsModule, InventoryModule, SalesOrdersModule],
  controllers: [AiChatController],
  providers: [AiChatService, AiChatAgentService, AiChatToolsService, IdempotencyService],
  exports: [AiChatService],
})
export class AiChatModule {}
