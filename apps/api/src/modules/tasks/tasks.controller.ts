import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@maher/types';
import { RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AssignTaskDto,
  CompleteTaskDto,
  ListTasksDto,
  TaskBlockDto,
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
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.getById(id, user.id, user.permissions);
  }

  @RequirePermissions('production-order.assign')
  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignTaskDto) {
    return this.tasks.assign(id, dto);
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

  @RequireAnyPermissions('production-task.update-own', 'production-task.update-any')
  @Patch(':id/notes')
  notes(
    @Param('id') id: string,
    @Body() dto: UpdateTaskNotesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.updateNotes(id, dto.notes, user.id, user.permissions);
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
