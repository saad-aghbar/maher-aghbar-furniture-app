import { Module, forwardRef } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { ProductionModule } from '../production/production.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrdersService } from './sales-orders.service';

@Module({
  imports: [
    NotificationsModule,
    DocumentsModule,
    SchedulingModule,
    forwardRef(() => ProductionModule),
    forwardRef(() => InventoryModule),
  ],
  controllers: [SalesOrdersController],
  providers: [SalesOrdersService],
  exports: [SalesOrdersService],
})
export class SalesOrdersModule {}
