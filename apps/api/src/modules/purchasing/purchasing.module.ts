import { Module, forwardRef } from '@nestjs/common';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';
import { FabricProcurementController } from './fabric-procurement.controller';
import { FabricProcurementService } from './fabric-procurement.service';
import { FabricReceivingService } from './fabric-receiving.service';
import { LowStockPrWebhookController } from './low-stock-pr.webhook.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { SupplierInvoicesModule } from '../supplier-invoices/supplier-invoices.module';

@Module({
  imports: [
    NotificationsModule,
    forwardRef(() => InventoryModule),
    forwardRef(() => SchedulingModule),
    SupplierInvoicesModule,
  ],
  controllers: [PurchasingController, LowStockPrWebhookController, FabricProcurementController],
  providers: [PurchasingService, FabricProcurementService, FabricReceivingService],
  exports: [PurchasingService, FabricProcurementService, FabricReceivingService],
})
export class PurchasingModule {}
