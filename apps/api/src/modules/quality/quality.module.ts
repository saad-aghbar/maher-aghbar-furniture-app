import { Module } from '@nestjs/common';
import { ProductionModule } from '../production/production.module';
import { QualityController } from './quality.controller';
import { QualityTemplatesController } from './quality-templates.controller';

@Module({
  imports: [ProductionModule],
  controllers: [QualityController, QualityTemplatesController],
})
export class QualityModule {}
