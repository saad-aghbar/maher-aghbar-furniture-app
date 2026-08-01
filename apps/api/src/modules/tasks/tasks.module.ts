import { Module } from '@nestjs/common';
import { ProductionModule } from '../production/production.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [ProductionModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
