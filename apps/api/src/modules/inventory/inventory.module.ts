import { Module, forwardRef } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { PurchasingModule } from '../purchasing/purchasing.module';

@Module({
  imports: [forwardRef(() => PurchasingModule)],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
