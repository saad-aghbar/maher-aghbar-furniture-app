import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrdersService } from './sales-orders.service';

@Module({
  imports: [NotificationsModule, DocumentsModule, SchedulingModule],
  controllers: [SalesOrdersController],
  providers: [SalesOrdersService],
  exports: [SalesOrdersService],
})
export class SalesOrdersModule {}
