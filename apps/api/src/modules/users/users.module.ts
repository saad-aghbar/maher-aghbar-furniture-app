import { Module } from '@nestjs/common';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { UsersController } from './users.controller';

@Module({
  imports: [SchedulingModule],
  controllers: [UsersController],
})
export class UsersModule {}
