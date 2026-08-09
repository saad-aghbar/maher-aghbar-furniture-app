import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContractsController } from './contracts.controller';
import { ReturnsController } from './returns.controller';

@Module({
  imports: [DocumentsModule, NotificationsModule],
  controllers: [ContractsController, ReturnsController],
})
export class ContractsModule {}
