import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { ProductionModule } from '../production/production.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [ProductionModule, InvoicesModule, DocumentsModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
