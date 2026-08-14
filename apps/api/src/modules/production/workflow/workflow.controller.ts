import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { AuthUser } from '@maher/types';
import { RequireAnyPermissions, RequirePermissions } from '../../../common/decorators/auth.decorators';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { WorkflowVersionService } from './workflow-version.service';
import { OrderWorkflowGraphService } from './order-workflow-graph.service';
import { WorkflowSnapshotService } from './workflow-snapshot.service';
import { PrismaService } from '../../../common/prisma.service';
import { Prisma } from '@maher/database';
import {
  nextLibrarySortOrder,
  pickStagePatch,
  resolveGeneratedCode,
} from './domain/technical-id';

export class CreateWorkflowDto {
  @ApiPropertyOptional({
    description: 'Optional technical identifier. Generated from nameEn when omitted.',
  })
  @IsOptional()
  @IsString()
  code?: string;
  @ApiProperty() @IsString() @MinLength(1) nameAr!: string;
  @ApiProperty() @IsString() @MinLength(1) nameEn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameHe?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionHe?: string;
}

export class CreateStageDto {
  @ApiPropertyOptional({
    description: 'Optional technical identifier. Generated from nameEn when omitted.',
  })
  @IsOptional()
  @IsString()
  code?: string;
  @ApiProperty() @IsString() @MinLength(1) nameAr!: string;
  @ApiProperty() @IsString() @MinLength(1) nameEn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameHe?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() estimatedHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresInspection?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresPhotos?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() responsibleDepartment?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) workerIds?: string[];
}

export class UpdateStageDto {
  @ApiPropertyOptional() @IsOptional() @IsString() nameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameHe?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() estimatedHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresInspection?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresPhotos?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() responsibleDepartment?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AddNodeDto {
  @ApiProperty() @IsString() stageDefinitionId!: string;
  @ApiPropertyOptional({
    description: 'Optional node key. Defaults to the stage code, unique within the version.',
  })
  @IsOptional()
  @IsString()
  nodeKey?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() displayX?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() displayY?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isRequiredByDefault?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() canBeSkipped?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() defaultEstimatedMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() responsibleDepartmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) runsAfterNodeIds?: string[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() expectedRevision?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['NONE', 'PRODUCES_SEMI_FINISHED', 'PRODUCES_FINISHED'])
  inventoryTracking?: 'NONE' | 'PRODUCES_SEMI_FINISHED' | 'PRODUCES_FINISHED';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() consumesRawMaterials?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() consumesSemiFinished?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() outputQtyPerUnit?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() outputNameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() outputNameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() outputNameHe?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() defaultWarehouseId?: string;
}

/** PATCH body — connection / flag updates only (no required stageDefinitionId/nodeKey). */
export class UpdateNodeDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() displayX?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() displayY?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isRequiredByDefault?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() canBeSkipped?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() defaultEstimatedMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() responsibleDepartmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) runsAfterNodeIds?: string[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() expectedRevision?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['NONE', 'PRODUCES_SEMI_FINISHED', 'PRODUCES_FINISHED'])
  inventoryTracking?: 'NONE' | 'PRODUCES_SEMI_FINISHED' | 'PRODUCES_FINISHED';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() consumesRawMaterials?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() consumesSemiFinished?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() outputQtyPerUnit?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() outputNameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() outputNameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() outputNameHe?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() defaultWarehouseId?: string;
}

class PublishDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() expectedRevision?: number;
}

class ProductWorkflowDto {
  @ApiProperty() @IsString() workflowId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  overrides?: Array<{
    stageDefinitionId: string;
    workflowNodeId?: string;
    applicability: 'INHERIT' | 'REQUIRED' | 'OPTIONAL' | 'EXCLUDED';
    estimatedMinutes?: number;
  }>;
}

class SkipStageDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

@ApiTags('production-workflows')
@Controller()
export class WorkflowController {
  constructor(
    private readonly versions: WorkflowVersionService,
    private readonly graphs: OrderWorkflowGraphService,
    private readonly snapshots: WorkflowSnapshotService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('production-workflows')
  @RequireAnyPermissions('production.workflow.read', 'production-order.update')
  list() {
    return this.versions.listWorkflows();
  }

  @Post('production-workflows')
  @RequirePermissions('production.workflow.manage')
  create(@Body() dto: CreateWorkflowDto, @CurrentUser() user: AuthUser) {
    return this.versions.createWorkflow({ ...dto, createdById: user.id });
  }

  @Delete('production-workflows/:id')
  @RequirePermissions('production.workflow.manage')
  archive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.versions.archiveWorkflow(id, user.id);
  }

  @Get('production-workflows/:id')
  @RequireAnyPermissions('production.workflow.read', 'production-order.update')
  get(@Param('id') id: string) {
    return this.versions.getWorkflow(id);
  }

  @Post('production-workflows/:id/versions')
  @RequirePermissions('production.workflow.manage')
  createDraft(
    @Param('id') id: string,
    @Body() body: { fromVersionId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.versions.createDraftVersion(id, user.id, body.fromVersionId);
  }

  @Get('production-workflows/:id/versions')
  @RequireAnyPermissions('production.workflow.read', 'production-order.update')
  async listVersions(@Param('id') id: string) {
    return this.prisma.productionWorkflowVersion.findMany({
      where: { workflowId: id },
      orderBy: { versionNumber: 'desc' },
      include: { _count: { select: { nodes: true, edges: true } } },
    });
  }

  @Get('production-workflows/:id/versions/:versionId')
  @RequireAnyPermissions('production.workflow.read', 'production-order.update')
  async getVersion(@Param('versionId') versionId: string) {
    const version = await this.prisma.productionWorkflowVersion.findUnique({
      where: { id: versionId },
      include: {
        nodes: { include: { stageDefinition: true }, orderBy: { sortOrder: 'asc' } },
        edges: true,
      },
    });
    if (!version) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Version not found.' });
    return version;
  }

  @Post('production-workflows/:id/versions/:versionId/nodes')
  @RequirePermissions('production.workflow.manage')
  addNode(
    @Param('versionId') versionId: string,
    @Body() dto: AddNodeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.versions.addNode(versionId, dto, user.id);
  }

  @Patch('production-workflows/:id/versions/:versionId/nodes/:nodeId')
  @RequirePermissions('production.workflow.manage')
  updateNode(
    @Param('versionId') versionId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: UpdateNodeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.versions.updateNode(versionId, nodeId, dto, user.id);
  }

  @Delete('production-workflows/:id/versions/:versionId/nodes/:nodeId')
  @RequirePermissions('production.workflow.manage')
  removeNode(
    @Param('versionId') versionId: string,
    @Param('nodeId') nodeId: string,
    @Query('reconnect') reconnect: string | undefined,
    @Query('expectedRevision') expectedRevision: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.versions.removeNode(
      versionId,
      nodeId,
      {
        reconnect: reconnect !== 'false',
        expectedRevision: expectedRevision ? Number(expectedRevision) : undefined,
      },
      user.id,
    );
  }

  @Post('production-workflows/:id/versions/:versionId/validate')
  @RequirePermissions('production.workflow.manage')
  validate(@Param('versionId') versionId: string) {
    return this.versions.validateVersion(versionId);
  }

  @Post('production-workflows/:id/versions/:versionId/publish')
  @RequirePermissions('production.workflow.publish')
  publish(
    @Param('versionId') versionId: string,
    @Body() dto: PublishDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.versions.publish(versionId, user.id, dto.expectedRevision);
  }

  @Delete('production-workflows/:id/versions/:versionId')
  @RequirePermissions('production.workflow.manage')
  discardDraft(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.versions.discardDraft(id, versionId, user.id);
  }

  @Get('production-stage-library')
  @RequireAnyPermissions(
    'production.workflow.stage.manage',
    'production.workflow.manage',
    'production.workflow.read',
    'production-order.update',
  )
  async stageLibrary(@Query('q') q?: string) {
    const where: Prisma.ProductionStageDefinitionWhereInput = q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { nameEn: { contains: q, mode: 'insensitive' } },
            { nameAr: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
    return this.prisma.productionStageDefinition.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Post('production-stage-library')
  @RequireAnyPermissions('production.workflow.stage.manage', 'production.workflow.manage')
  async createStage(@Body() dto: CreateStageDto, @CurrentUser() user: AuthUser) {
    const existing = await this.prisma.productionStageDefinition.findMany({
      select: { code: true },
    });
    const code = resolveGeneratedCode(
      dto.code,
      dto.nameEn,
      existing.map((row) => row.code),
    );
    const maxSort = await this.prisma.productionStageDefinition.aggregate({
      _max: { sortOrder: true },
    });
    const row = await this.prisma.productionStageDefinition.create({
      data: {
        code,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        nameHe: dto.nameHe,
        sortOrder: dto.sortOrder ?? nextLibrarySortOrder(maxSort._max.sortOrder),
        estimatedHours: dto.estimatedHours,
        requiresInspection: dto.requiresInspection ?? false,
        requiresPhotos: dto.requiresPhotos ?? false,
        responsibleDepartment: dto.responsibleDepartment,
        dependsOnCodes: [],
        isActive: true,
      },
    });

    if (dto.workerIds?.length) {
      for (const userId of dto.workerIds) {
        await this.prisma.workerSkill.upsert({
          where: {
            userId_stageDefinitionId: { userId, stageDefinitionId: row.id },
          },
          create: { userId, stageDefinitionId: row.id, isActive: true },
          update: { isActive: true },
        });
      }
    }

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'stage.create',
        entityType: 'ProductionStageDefinition',
        entityId: row.id,
        newValues: row as unknown as Prisma.InputJsonValue,
      },
    });
    return row;
  }

  @Get('production-stage-library/:id/workers')
  @RequireAnyPermissions(
    'production.workflow.stage.manage',
    'production.workflow.manage',
    'production.workflow.read',
    'production-order.update',
  )
  async listStageWorkers(@Param('id') id: string) {
    const skills = await this.prisma.workerSkill.findMany({
      where: { stageDefinitionId: id, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            username: true,
          },
        },
      },
    });
    return skills.map((s) => ({
      id: s.user.id,
      firstName: s.user.firstName,
      lastName: s.user.lastName,
      email: s.user.email,
      username: s.user.username,
      skillId: s.id,
    }));
  }

  @Put('production-stage-library/:id/workers')
  @RequireAnyPermissions('production.workflow.stage.manage', 'production.workflow.manage')
  async setStageWorkers(
    @Param('id') id: string,
    @Body() dto: { userIds: string[] },
    @CurrentUser() user: AuthUser,
  ) {
    const stage = await this.prisma.productionStageDefinition.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Stage not found.' });

    const desired = new Set(dto.userIds ?? []);
    const existing = await this.prisma.workerSkill.findMany({
      where: { stageDefinitionId: id },
    });

    for (const skill of existing) {
      if (!desired.has(skill.userId)) {
        await this.prisma.workerSkill.update({
          where: { id: skill.id },
          data: { isActive: false },
        });
      } else if (!skill.isActive) {
        await this.prisma.workerSkill.update({
          where: { id: skill.id },
          data: { isActive: true },
        });
      }
      desired.delete(skill.userId);
    }

    for (const userId of desired) {
      await this.prisma.workerSkill.create({
        data: { userId, stageDefinitionId: id, isActive: true },
      });
    }

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'stage.workers.set',
        entityType: 'ProductionStageDefinition',
        entityId: id,
        newValues: { userIds: dto.userIds } as Prisma.InputJsonValue,
      },
    });

    return this.listStageWorkers(id);
  }

  @Patch('production-stage-library/:id')
  @RequirePermissions('production.workflow.stage.manage')
  async updateStage(
    @Param('id') id: string,
    @Body() dto: UpdateStageDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.prisma.productionStageDefinition.update({
      where: { id },
      data: pickStagePatch(dto as unknown as Record<string, unknown>) as Prisma.ProductionStageDefinitionUpdateInput,
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'stage.update',
        entityType: 'ProductionStageDefinition',
        entityId: row.id,
        newValues: row as unknown as Prisma.InputJsonValue,
      },
    });
    return row;
  }

  @Delete('production-stage-library/:id')
  @RequirePermissions('production.workflow.stage.manage')
  async archiveStage(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const inUse =
      (await this.prisma.productionStageInstance.count({ where: { stageDefinitionId: id } })) +
      (await this.prisma.productionWorkflowNode.count({ where: { stageDefinitionId: id } })) +
      (await this.prisma.productionOrderWorkflowSnapshotNode.count({
        where: { stageDefinitionId: id },
      }));
    if (inUse > 0) {
      const row = await this.prisma.productionStageDefinition.update({
        where: { id },
        data: { isActive: false },
      });
      await this.prisma.auditEvent.create({
        data: {
          userId: user.id,
          action: 'stage.archived',
          entityType: 'ProductionStageDefinition',
          entityId: id,
        },
      });
      return row;
    }
    throw new BadRequestException({
      code: 'WORKFLOW_STAGE_IN_USE',
      message: 'Stage is not referenced; deactivate via isActive instead of hard delete.',
    });
  }

  @Get('products/:productId/workflow-configuration')
  @RequirePermissions('catalog.manage')
  async getProductWorkflow(@Param('productId') productId: string) {
    return this.prisma.productWorkflowConfiguration.findUnique({
      where: { productId },
      include: { workflow: true, stageOverrides: true },
    });
  }

  @Patch('products/:productId/workflow-configuration')
  @RequirePermissions('catalog.manage')
  async upsertProductWorkflow(
    @Param('productId') productId: string,
    @Body() dto: ProductWorkflowDto,
  ) {
    const config = await this.prisma.productWorkflowConfiguration.upsert({
      where: { productId },
      create: { productId, workflowId: dto.workflowId },
      update: { workflowId: dto.workflowId },
    });
    if (dto.overrides) {
      await this.prisma.productWorkflowStageOverride.deleteMany({
        where: { configurationId: config.id },
      });
      for (const o of dto.overrides) {
        await this.prisma.productWorkflowStageOverride.create({
          data: {
            configurationId: config.id,
            productId,
            stageDefinitionId: o.stageDefinitionId,
            workflowNodeId: o.workflowNodeId,
            applicability: o.applicability,
            estimatedMinutes: o.estimatedMinutes,
          },
        });
      }
    }
    return this.prisma.productWorkflowConfiguration.findUnique({
      where: { id: config.id },
      include: { workflow: true, stageOverrides: true },
    });
  }

  @Get('production-orders/:id/workflow')
  @RequireAnyPermissions(
    'production-order.read',
    'production.workflow.read',
    'production.workflow.order.read.own',
  )
  async getOrderWorkflow(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const audience = user.customerId ? 'dealer' : 'admin';
    const isWorkerOnly =
      !user.customerId &&
      user.permissions.includes('production-task.update-own') &&
      !user.permissions.includes('production.workflow.read') &&
      !user.permissions.includes('production-order.update') &&
      !user.permissions.includes('production.workflow.order.customize');
    if (isWorkerOnly) {
      throw new BadRequestException({
        code: 'FORBIDDEN',
        message: 'Workers do not have access to the production workflow graph.',
      });
    }
    return this.graphs.getGraph(id, audience, { customerId: user.customerId });
  }

  @Post('production-orders/:id/workflow/assign')
  @RequireAnyPermissions(
    'production.workflow.manage',
    'production.workflow.order.customize',
    'production-order.update',
  )
  async assignOrderWorkflow(
    @Param('id') id: string,
    @Body() dto: { workflowId: string },
    @CurrentUser() user: AuthUser,
  ) {
    if (!dto.workflowId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'workflowId is required.',
      });
    }
    await this.snapshots.assignWorkflowToProductionOrder(id, dto.workflowId, user.id);
    return this.graphs.getGraph(id, 'admin');
  }

  @Post('production-orders/:id/workflow/nodes/:nodeId/skip')
  @RequirePermissions('production.workflow.order.customize')
  skipNode(
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: SkipStageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.graphs.skipOptionalNode(id, nodeId, dto.reason, user.id);
  }

  @Patch('production-orders/:id/workflow')
  @RequirePermissions('production.workflow.order.customize')
  async customizeOrderWorkflow(
    @Param('id') id: string,
    @Body()
    dto: {
      notes?: string;
      nodes?: Array<{
        snapshotNodeId: string;
        estimatedMinutes?: number;
        skip?: boolean;
        skipReason?: string;
      }>;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const snapshot = await this.prisma.productionOrderWorkflowSnapshot.findUnique({
      where: { productionOrderId: id },
      include: { nodes: true },
    });
    if (!snapshot) {
      throw new BadRequestException({
        code: 'ORDER_WORKFLOW_LOCKED',
        message: 'Order has no workflow snapshot to customize.',
      });
    }

    const started = await this.prisma.productionStageInstance.count({
      where: {
        productionOrderId: id,
        status: { in: ['IN_PROGRESS', 'COMPLETED'] },
      },
    });

    for (const patch of dto.nodes ?? []) {
      if (patch.skip) {
        if (started > 0) {
          throw new BadRequestException({
            code: 'ORDER_WORKFLOW_LOCKED',
            message: 'Workflow topology cannot be customized after production has started.',
          });
        }
        await this.graphs.skipOptionalNode(id, patch.snapshotNodeId, patch.skipReason, user.id);
      }
      if (patch.estimatedMinutes != null) {
        await this.prisma.productionOrderWorkflowSnapshotNode.update({
          where: { id: patch.snapshotNodeId },
          data: { estimatedMinutes: patch.estimatedMinutes, estimateReviewRequired: false },
        });
        const node = snapshot.nodes.find((n) => n.id === patch.snapshotNodeId);
        if (node?.stageInstanceId) {
          await this.prisma.productionTask.updateMany({
            where: { stageInstanceId: node.stageInstanceId },
            data: { estimatedMinutes: patch.estimatedMinutes },
          });
        }
      }
    }

    if (dto.notes) {
      await this.prisma.productionOrder.update({
        where: { id },
        data: { notes: dto.notes },
      });
    }

    await this.prisma.productionOrderWorkflowSnapshot.update({
      where: { id: snapshot.id },
      data: { customizedAt: new Date(), customizedById: user.id },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'workflow.order.customized',
        entityType: 'ProductionOrder',
        entityId: id,
        newValues: dto as unknown as Prisma.InputJsonValue,
      },
    });

    return this.graphs.getGraph(id, 'admin');
  }
}
