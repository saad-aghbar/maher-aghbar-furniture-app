import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@maher/types';
import { RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AssignTaskDto,
  CompleteTaskDto,
  ListTasksDto,
  ResolveBlockerDto,
  TaskBlockDto,
  TaskCarryOverDto,
  TaskProgressDto,
  UpdateTaskNotesDto,
} from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @RequirePermissions('production-task.read')
  @Get()
  list(@Query() query: ListTasksDto, @CurrentUser() user: AuthUser) {
    return this.tasks.list(query, user.id, user.permissions);
  }

  @RequirePermissions('production-task.read')
  @Get('completed-dealers')
  listCompletedDealers(@CurrentUser() user: AuthUser) {
    return this.tasks.listCompletedDealers(user.id, user.permissions);
  }

  @RequirePermissions('production-task.read')
  @Get('my-orders')
  listMyOrders(
    @CurrentUser() user: AuthUser,
    @Query('segment') segment?: string,
    @Query('q') q?: string,
  ) {
    return this.tasks.listMyOrders(user.id, segment, q);
  }

  @RequirePermissions('production-task.read')
  @Get('my-orders/:productionOrderId/workflow')
  getMyOrderWorkflow(
    @Param('productionOrderId') productionOrderId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.getMyOrderWorkflow(productionOrderId, user.id);
  }

  @RequirePermissions('production-task.read')
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.getById(id, user.id, user.permissions);
  }

  @RequireAnyPermissions('production-order.assign', 'schedule.manage')
  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasks.assign(id, dto, user.permissions, user.id);
  }

  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.start(id, user.id, user.permissions);
  }

  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  @Post(':id/pause')
  pause(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.pause(id, user.id, user.permissions);
  }

  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  @Post(':id/resume')
  resume(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.resume(id, user.id, user.permissions);
  }

  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  @Post(':id/progress')
  progress(
    @Param('id') id: string,
    @Body() dto: TaskProgressDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.progress(id, dto, user.id, user.permissions);
  }

  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  @Post(':id/block')
  block(
    @Param('id') id: string,
    @Body() dto: TaskBlockDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.block(id, dto, user.id, user.permissions);
  }

  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  @Post(':id/unblock')
  unblock(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.unblock(id, user.id, user.permissions);
  }

  @RequirePermissions('production-task.update-any')
  @Post(':id/blockers/:blockerId/resolve')
  resolveBlocker(
    @Param('id') id: string,
    @Param('blockerId') blockerId: string,
    @Body() dto: ResolveBlockerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.resolveBlocker(id, blockerId, dto, user.id, user.permissions);
  }

  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  @Get(':id/carry-over/preview')
  previewCarryOver(
    @Param('id') id: string,
    @Query('mode') mode: 'tomorrow' | 'overtime',
    @Query('remainingMinutes') remainingMinutes: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.previewCarryOver(
      id,
      mode === 'overtime' ? 'overtime' : 'tomorrow',
      Number(remainingMinutes) || 30,
      user.id,
      user.permissions,
    );
  }

  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  @Post(':id/carry-over')
  carryOver(
    @Param('id') id: string,
    @Body() dto: TaskCarryOverDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.carryOver(id, dto, user.id, user.permissions);
  }

  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  @Patch(':id/notes')
  notes(
    @Param('id') id: string,
    @Body() dto: UpdateTaskNotesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.updateNotes(id, dto.notes, user.id, user.permissions, dto.idempotencyKey);
  }

  @RequirePermissions('production.material-usage.record')
  @Get(':id/material-usage')
  materialUsage(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.listMaterialUsage(id, user.id, user.permissions);
  }

  @RequirePermissions('production.material-usage.record')
  @Post(':id/material-usage/identify')
  identifyMaterial(
    @Param('id') id: string,
    @Body() body: { code?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.identifyMaterialUsage(id, user.id, user.permissions, body?.code ?? '');
  }

  @RequirePermissions('production.material-usage.record')
  @Put(':id/material-usage')
  saveMaterialUsage(
    @Param('id') id: string,
    @Body() body: { lines: Array<{
      inventoryItemId: string;
      actualQty: number;
      returnedQty?: number;
      scrapQty?: number;
      scrapReason?: string | null;
      reasonNotes?: string | null;
      isExtra?: boolean;
      sku?: string;
      issueWarehouseId?: string | null;
      returnWarehouseId?: string | null;
      issueLocationId?: string | null;
      returnLocationId?: string | null;
    }> },
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.saveMaterialUsage(id, user.id, user.permissions, body.lines ?? []);
  }

  @RequirePermissions('production-task.complete')
  @Post(':id/complete')
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.complete(id, user.id, user.permissions, dto);
  }
}
