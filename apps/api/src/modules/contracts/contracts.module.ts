import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductionModule } from '../production/production.module';
import { ContractsController } from './contracts.controller';
import { ReturnsController } from './returns.controller';

@Module({
  imports: [DocumentsModule, NotificationsModule, InventoryModule, ProductionModule],
  controllers: [ContractsController, ReturnsController],
})
export class ContractsModule {}
