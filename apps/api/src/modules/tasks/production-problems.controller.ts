import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@maher/types';
import { TasksService } from './tasks.service';

@ApiTags('production')
@Controller('production')
export class ProductionProblemsController {
  constructor(private readonly tasks: TasksService) {}

  @RequirePermissions('production-task.read', 'production-task.update-any')
  @Get('problems')
  listProblems(
    @Query('status') status: 'open' | 'answered' | 'all' | undefined,
    @CurrentUser() _user: AuthUser,
  ) {
    return this.tasks.listProblems({ status });
  }
}
