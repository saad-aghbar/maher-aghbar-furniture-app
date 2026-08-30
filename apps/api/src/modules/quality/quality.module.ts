import { Module, forwardRef } from '@nestjs/common';
import { ProductionModule } from '../production/production.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QualityController } from './quality.controller';
import { QualityTemplatesController } from './quality-templates.controller';
import { QualityFloorService } from './quality-floor.service';

@Module({
  imports: [
    ProductionModule,
    NotificationsModule,
    forwardRef(() => SchedulingModule),
  ],
  controllers: [QualityController, QualityTemplatesController],
  providers: [QualityFloorService],
  exports: [QualityFloorService],
})
export class QualityModule {}
