import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WipKitStatus } from '@maher/database';
import type { AuthUser } from '@maher/types';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WipKitService } from './wip-kit.service';

@ApiTags('wip-kits')
@Controller()
export class WipKitController {
  constructor(private readonly wipKits: WipKitService) {}

  @Get('inventory/wip-kits/board')
  @RequirePermissions('inventory.read')
  board(
    @Query('stageCode') stageCode?: string,
    @Query('status') status?: string,
    @Query('productionOrderId') productionOrderId?: string,
    @Query('custody') custody?: string,
    @Query('scope') scope?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('q') q?: string,
  ) {
    const statuses = status
      ? (status.split(',').map((s) => s.trim()) as WipKitStatus[])
      : undefined;
    return this.wipKits.listBoard({
      stageCode,
      status: statuses?.length === 1 ? statuses[0] : statuses,
      productionOrderId,
      custody,
      scope: scope === 'history' ? 'history' : 'active',
      from,
      to,
      warehouseId,
      q,
    });
  }

  @Get('inventory/wip-kits/stage-bins')
  @RequirePermissions('inventory.read')
  stageBins() {
    return this.wipKits.listStageBins();
  }

  @Post('inventory/wip-kits/ensure-stage-bins')
  @RequirePermissions('warehouse.manage')
  ensureStageBins() {
    return this.wipKits.ensureStageBins();
  }

  @Get('inventory/wip-kits/by-code/:code')
  @RequirePermissions('inventory.read')
  byCode(@Param('code') code: string) {
    return this.wipKits.findByScanCode(decodeURIComponent(code));
  }

  @Get('inventory/wip-kits/:id/timeline')
  @RequirePermissions('inventory.read')
  timeline(@Param('id') id: string) {
    return this.wipKits.getKitTimeline(id);
  }

  @Get('inventory/wip-kits/:id')
  @RequirePermissions('inventory.read')
  get(@Param('id') id: string) {
    return this.wipKits.getById(id);
  }

  @Patch('inventory/wip-kits/:id/location')
  @RequirePermissions('inventory.adjust')
  setLocation(
    @Param('id') id: string,
    @Body() body: { locationId?: string | null },
  ) {
    return this.wipKits.setKitLocation(id, body.locationId ?? null);
  }

  @Get('tasks/:taskId/wip-claim-requirements')
  @RequirePermissions('production-task.read')
  claimRequirements(@Param('taskId') taskId: string) {
    return this.wipKits.claimRequirementsForTask(taskId);
  }

  @Get('tasks/:taskId/wip-incoming')
  @RequirePermissions('production-task.read')
  incoming(@Param('taskId') taskId: string) {
    return this.wipKits.getIncomingForTask(taskId);
  }

  @Get('tasks/:taskId/wip-outgoing')
  @RequirePermissions('production-task.read')
  outgoing(@Param('taskId') taskId: string) {
    return this.wipKits.getOutgoingForTask(taskId);
  }

  @Get('tasks/:taskId/wip-eligible')
  @RequirePermissions('production-task.read')
  eligible(@Param('taskId') taskId: string) {
    return this.wipKits.getEligibleKitsForTask(taskId);
  }

  @Post('tasks/:taskId/wip-receive')
  @RequirePermissions('production-task.complete')
  receive(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      scanCode?: string;
      kitId?: string;
      quantity?: number;
      idempotencyKey?: string;
    },
  ) {
    return this.wipKits.receiveForTask({
      taskId,
      userId: user.id,
      scanCode: body.scanCode,
      kitId: body.kitId,
      quantity: body.quantity,
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Post('tasks/:taskId/wip-discrepancy')
  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any', 'production-task.complete')
  discrepancy(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      category: string;
      notes?: string;
      kitId?: string;
      predecessorStageCode?: string;
      idempotencyKey?: string;
    },
  ) {
    return this.wipKits.reportDiscrepancyForTask({
      taskId,
      userId: user.id,
      category: body.category,
      notes: body.notes,
      kitId: body.kitId,
      predecessorStageCode: body.predecessorStageCode,
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Post('tasks/:taskId/wip-claim')
  @RequirePermissions('production-task.complete')
  claim(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { scanCode: string },
  ) {
    return this.wipKits.claimForTask({
      taskId,
      userId: user.id,
      scanCode: body.scanCode,
    });
  }

  @Get('tasks/:taskId/wip-output')
  @RequirePermissions('production-task.read')
  getWipOutput(@Param('taskId') taskId: string) {
    return this.wipKits.getTaskWipOutput(taskId);
  }

  @Post('tasks/:taskId/wip-output/pieces')
  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  addWipPiece(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { photoDocumentId: string; label?: string | null },
  ) {
    return this.wipKits.addTaskWipPiece({
      taskId,
      userId: user.id,
      photoDocumentId: body.photoDocumentId,
      label: body.label,
    });
  }

  @Patch('tasks/:taskId/wip-output/pieces/:pieceId')
  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  updateWipPiece(
    @Param('taskId') taskId: string,
    @Param('pieceId') pieceId: string,
    @Body() body: { photoDocumentId?: string; label?: string | null },
  ) {
    return this.wipKits.updateTaskWipPiece({
      taskId,
      pieceId,
      photoDocumentId: body.photoDocumentId,
      label: body.label,
    });
  }

  @Delete('tasks/:taskId/wip-output/pieces/:pieceId')
  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  deleteWipPiece(
    @Param('taskId') taskId: string,
    @Param('pieceId') pieceId: string,
  ) {
    return this.wipKits.deleteTaskWipPiece({ taskId, pieceId });
  }
}
