import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductionModule } from '../production/production.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { ContractsController } from './contracts.controller';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { ReturnPieceService } from './return-piece.service';

@Module({
  imports: [
    DocumentsModule,
    NotificationsModule,
    InventoryModule,
    ProductionModule,
    SchedulingModule,
    InvoicesModule,
  ],
  controllers: [ContractsController, ReturnsController],
  providers: [ReturnsService, ReturnPieceService],
  exports: [ReturnPieceService],
})
export class ContractsModule {}
