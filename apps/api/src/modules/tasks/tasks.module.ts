import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { ProductionModule } from '../production/production.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { ContractsModule } from '../contracts/contracts.module';
import { ProductionProblemsController } from './production-problems.controller';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    ProductionModule,
    InvoicesModule,
    DocumentsModule,
    NotificationsModule,
    SchedulingModule,
    ContractsModule,
  ],
  controllers: [TasksController, ProductionProblemsController],
  providers: [TasksService],
})
export class TasksModule {}
