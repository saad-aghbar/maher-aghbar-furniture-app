import { Module, forwardRef } from '@nestjs/common';
import { ProductionModule } from '../production/production.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QualityController } from './quality.controller';
import { QualityTemplatesController } from './quality-templates.controller';
import { QualityFloorService } from './quality-floor.service';
import { QualityInspectionService } from './quality-inspection.service';
import { ContractsModule } from '../contracts/contracts.module';

@Module({
  imports: [
    ProductionModule,
    NotificationsModule,
    forwardRef(() => SchedulingModule),
    ContractsModule,
  ],
  controllers: [QualityController, QualityTemplatesController],
  providers: [QualityFloorService, QualityInspectionService],
  exports: [QualityFloorService, QualityInspectionService],
})
export class QualityModule {}
