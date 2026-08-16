import { Module, forwardRef } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { PurchasingModule } from '../purchasing/purchasing.module';
import { SchedulingModule } from '../scheduling/scheduling.module';

@Module({
  imports: [forwardRef(() => PurchasingModule), forwardRef(() => SchedulingModule)],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
