import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulingController } from './scheduling.controller';
import { SchedulingQueueService } from './scheduling-queue';
import { SchedulingService } from './scheduling.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SchedulingController],
  providers: [SchedulingService, SchedulingQueueService],
  exports: [SchedulingService, SchedulingQueueService],
})
export class SchedulingModule {}
