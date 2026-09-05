import { Module, forwardRef } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryItemReportService } from './inventory-item-report.service';
import { RawMaterialsReportService } from './raw-materials-report.service';
import { PurchasingModule } from '../purchasing/purchasing.module';
import { SchedulingModule } from '../scheduling/scheduling.module';

@Module({
  imports: [forwardRef(() => PurchasingModule), forwardRef(() => SchedulingModule)],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryItemReportService, RawMaterialsReportService],
  exports: [InventoryService, InventoryItemReportService, RawMaterialsReportService],
})
export class InventoryModule {}
