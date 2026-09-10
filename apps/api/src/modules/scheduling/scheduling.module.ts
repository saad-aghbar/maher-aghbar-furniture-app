import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlacementService } from './placement.service';
import { SchedulingController } from './scheduling.controller';
import { SchedulingQueueService } from './scheduling-queue';
import { SchedulingService } from './scheduling.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SchedulingController],
  providers: [SchedulingService, SchedulingQueueService, PlacementService],
  exports: [SchedulingService, SchedulingQueueService, PlacementService],
})
export class SchedulingModule {}
