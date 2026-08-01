import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionStagesController } from './production-stages.controller';
import { ProductionService } from './production.service';
import { StagePipelineService } from './stage-pipeline.service';

@Module({
  controllers: [ProductionController, ProductionStagesController],
  providers: [ProductionService, StagePipelineService],
  exports: [StagePipelineService],
})
export class ProductionModule {}
