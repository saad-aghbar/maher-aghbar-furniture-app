import { Module, forwardRef } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionStagesController } from './production-stages.controller';
import { ProductionService } from './production.service';
import { StagePipelineService } from './stage-pipeline.service';
import { ProductionInventoryService } from './production-inventory.service';
import { MaterialUsageService } from './material-usage.service';
import { ProductionReworkService } from './production-rework.service';
import { ProductionSetupService } from './production-setup.service';
import { ProductionSetupController } from './production-setup.controller';
import { OrderProductionSetupService } from './order-production-setup.service';
import { OrderProductionSetupController } from './order-production-setup.controller';
import { WorkflowController } from './workflow/workflow.controller';
import { WorkflowVersionService } from './workflow/workflow-version.service';
import { WorkflowSnapshotService } from './workflow/workflow-snapshot.service';
import { OrderWorkflowGraphService } from './workflow/order-workflow-graph.service';
import { InventoryModule } from '../inventory/inventory.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WipKitService } from './wip-kit.service';
import { WipKitController } from './wip-kit.controller';
import { ManufacturingCostService } from './manufacturing-cost.service';
import { ManufacturingCostController } from './manufacturing-cost.controller';
import { OrderPlanSetupService } from './order-plan-setup.service';

@Module({
  imports: [
    forwardRef(() => InventoryModule),
    forwardRef(() => SchedulingModule),
    NotificationsModule,
  ],
  controllers: [
    ProductionController,
    ProductionStagesController,
    WorkflowController,
    ProductionSetupController,
    OrderProductionSetupController,
    WipKitController,
    ManufacturingCostController,
  ],
  providers: [
    ProductionService,
    StagePipelineService,
    ProductionInventoryService,
    MaterialUsageService,
    ProductionReworkService,
    ProductionSetupService,
    OrderProductionSetupService,
    OrderPlanSetupService,
    WorkflowVersionService,
    WorkflowSnapshotService,
    OrderWorkflowGraphService,
    WipKitService,
    ManufacturingCostService,
  ],
  exports: [
    StagePipelineService,
    ProductionInventoryService,
    MaterialUsageService,
    ProductionReworkService,
    WorkflowVersionService,
    WorkflowSnapshotService,
    OrderWorkflowGraphService,
    OrderProductionSetupService,
    OrderPlanSetupService,
    WipKitService,
    ManufacturingCostService,
  ],
})
export class ProductionModule {}
