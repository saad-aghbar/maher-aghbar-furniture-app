import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiIntakeService } from './ai-intake.service';
import { AiIntakeController } from './ai-intake.controller';

@Module({
  imports: [DocumentsModule, NotificationsModule],
  controllers: [AiIntakeController],
  providers: [AiIntakeService],
  exports: [AiIntakeService],
})
export class AiIntakeModule {}
