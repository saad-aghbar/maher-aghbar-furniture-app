import { Module, forwardRef } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionStagesController } from './production-stages.controller';
import { ProductionService } from './production.service';
import { StagePipelineService } from './stage-pipeline.service';
import { ProductionInventoryService } from './production-inventory.service';
import { ProductionReworkService } from './production-rework.service';
import { ProductionSetupService } from './production-setup.service';
import { ProductionSetupController } from './production-setup.controller';
import { WorkflowController } from './workflow/workflow.controller';
import { WorkflowVersionService } from './workflow/workflow-version.service';
import { WorkflowSnapshotService } from './workflow/workflow-snapshot.service';
import { OrderWorkflowGraphService } from './workflow/order-workflow-graph.service';
import { InventoryModule } from '../inventory/inventory.module';
import { SchedulingModule } from '../scheduling/scheduling.module';

@Module({
  imports: [forwardRef(() => InventoryModule), forwardRef(() => SchedulingModule)],
  controllers: [
    ProductionController,
    ProductionStagesController,
    WorkflowController,
    ProductionSetupController,
  ],
  providers: [
    ProductionService,
    StagePipelineService,
    ProductionInventoryService,
    ProductionReworkService,
    ProductionSetupService,
    WorkflowVersionService,
    WorkflowSnapshotService,
    OrderWorkflowGraphService,
  ],
  exports: [
    StagePipelineService,
    ProductionInventoryService,
    ProductionReworkService,
    WorkflowVersionService,
    WorkflowSnapshotService,
    OrderWorkflowGraphService,
  ],
})
export class ProductionModule {}
