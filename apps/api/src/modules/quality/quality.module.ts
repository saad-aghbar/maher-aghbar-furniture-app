import { Module, forwardRef } from '@nestjs/common';
import { ProductionModule } from '../production/production.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { QualityController } from './quality.controller';
import { QualityTemplatesController } from './quality-templates.controller';

@Module({
  imports: [ProductionModule, forwardRef(() => SchedulingModule)],
  controllers: [QualityController, QualityTemplatesController],
})
export class QualityModule {}
