import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { UsersController } from './users.controller';

@Module({
  imports: [SchedulingModule, NotificationsModule],
  controllers: [UsersController],
})
export class UsersModule {}
