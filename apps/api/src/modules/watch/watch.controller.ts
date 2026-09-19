import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@maher/types';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WatchService } from './watch.service';

@ApiTags('watch')
@Controller('watch')
export class WatchController {
  constructor(private readonly watch: WatchService) {}

  @Get('worker/today')
  @RequirePermissions('production-task.read')
  workerToday(
    @CurrentUser() user: AuthUser,
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
  ) {
    const accept = req.headers?.['accept-language'];
    const header = Array.isArray(accept) ? accept[0] : accept;
    const locale = header?.split(',')[0]?.trim().split('-')[0] ?? null;
    return this.watch.workerToday(user, locale);
  }

  @Get('admin/summary')
  @RequirePermissions('report.sales.read')
  adminSummary(@CurrentUser() user: AuthUser) {
    return this.watch.adminSummary(user);
  }

  @Get('dealer/orders')
  @RequirePermissions('sales-order.read')
  dealerOrders(@CurrentUser() user: AuthUser) {
    return this.watch.dealerOrders(user);
  }
}
