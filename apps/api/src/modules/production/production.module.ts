import { Module, forwardRef } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionStagesController } from './production-stages.controller';
import { ProductionService } from './production.service';
import { StagePipelineService } from './stage-pipeline.service';
import { WorkflowController } from './workflow/workflow.controller';
import { WorkflowVersionService } from './workflow/workflow-version.service';
import { WorkflowSnapshotService } from './workflow/workflow-snapshot.service';
import { OrderWorkflowGraphService } from './workflow/order-workflow-graph.service';

@Module({
  controllers: [ProductionController, ProductionStagesController, WorkflowController],
  providers: [
    ProductionService,
    StagePipelineService,
    WorkflowVersionService,
    WorkflowSnapshotService,
    OrderWorkflowGraphService,
  ],
  exports: [
    StagePipelineService,
    WorkflowVersionService,
    WorkflowSnapshotService,
    OrderWorkflowGraphService,
  ],
})
export class ProductionModule {}
