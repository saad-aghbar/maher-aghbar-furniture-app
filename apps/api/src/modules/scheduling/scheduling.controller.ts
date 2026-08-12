import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@maher/types';
import { RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApproveScheduleDto,
  AvailabilityRequestDto,
  CalendarExceptionDto,
  DealerDateChangeDto,
  ListCalendarQuery,
  PatchAllocationDto,
  PinDto,
  ProductionCalendarDto,
  ProductionProfileDto,
  ProductStageEstimatesDto,
  RecalculateDto,
} from './dto/scheduling.dto';
import { SchedulingService } from './scheduling.service';

@ApiTags('scheduling')
@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @RequireAnyPermissions('schedule.availability.own', 'schedule.manage')
  @Post('availability')
  availability(@Body() dto: AvailabilityRequestDto, @CurrentUser() user: AuthUser) {
    return this.scheduling.availability(dto, user);
  }

  @RequireAnyPermissions('schedule.read', 'schedule.capacity.read')
  @Get('calendar')
  getCalendar(@Query() query: ListCalendarQuery) {
    return this.scheduling.listCalendar(query);
  }

  @RequirePermissions('schedule.settings.manage')
  @Patch('calendar-settings')
  updateCalendarSettings(@Body() dto: ProductionCalendarDto, @CurrentUser() user: AuthUser) {
    return this.scheduling.upsertCalendar(dto, user.id);
  }

  @RequirePermissions('schedule.settings.manage')
  @Get('calendar-settings')
  getCalendarSettings() {
    return this.scheduling.getCalendar();
  }

  @RequirePermissions('schedule.settings.manage')
  @Post('calendar-settings/exceptions')
  addCalendarException(@Body() dto: CalendarExceptionDto, @CurrentUser() user: AuthUser) {
    return this.scheduling.addException(dto, user.id);
  }

  @RequirePermissions('schedule.settings.manage')
  @Delete('calendar-settings/exceptions/:date')
  deleteCalendarException(@Param('date') date: string, @CurrentUser() user: AuthUser) {
    return this.scheduling.deleteException(date, user.id);
  }

  @RequirePermissions('schedule.capacity.read')
  @Get('capacity')
  capacity(@Query('from') from: string, @Query('to') to: string) {
    return this.scheduling.listCapacity(from, to);
  }

  @RequirePermissions('schedule.capacity.read')
  @Get('conflicts')
  conflicts() {
    return this.scheduling.listConflicts();
  }

  @RequirePermissions('schedule.read')
  @Get('at-risk')
  atRisk() {
    return this.scheduling.listAtRisk();
  }

  @RequirePermissions('schedule.read')
  @Get('dashboard')
  dashboard() {
    return this.scheduling.dashboardSummary();
  }

  @RequireAnyPermissions('schedule.read', 'schedule.read.own')
  @Get('orders/:productionOrderId')
  getOrderSchedule(
    @Param('productionOrderId') productionOrderId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.customerId) {
      return this.scheduling.getOwnOrderSchedule(productionOrderId, user);
    }
    return this.scheduling.getOrderSchedule(productionOrderId);
  }

  @RequirePermissions('schedule.manage')
  @Post('orders/:productionOrderId/generate')
  generate(@Param('productionOrderId') productionOrderId: string, @CurrentUser() user: AuthUser) {
    return this.scheduling.generateForProductionOrder(productionOrderId, user.id);
  }

  @RequirePermissions('schedule.manage')
  @Post('orders/:productionOrderId/recalculate')
  recalculate(
    @Param('productionOrderId') productionOrderId: string,
    @Body() dto: RecalculateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scheduling.recalculate(productionOrderId, user.id, dto);
  }

  @RequirePermissions('schedule.approve')
  @Post('orders/:productionOrderId/approve')
  approve(
    @Param('productionOrderId') productionOrderId: string,
    @Body() dto: ApproveScheduleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scheduling.approve(productionOrderId, dto.version, user.id);
  }

  @RequirePermissions('schedule.manage')
  @Patch('orders/:productionOrderId/allocations/:id')
  patchAllocation(
    @Param('productionOrderId') productionOrderId: string,
    @Param('id') allocationId: string,
    @Body() dto: PatchAllocationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scheduling.patchAllocation(productionOrderId, allocationId, dto, user);
  }

  @RequirePermissions('schedule.manage')
  @Post('orders/:productionOrderId/pin')
  pin(
    @Param('productionOrderId') productionOrderId: string,
    @Body() dto: PinDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scheduling.setPin(productionOrderId, dto, true, user);
  }

  @RequirePermissions('schedule.manage')
  @Post('orders/:productionOrderId/unpin')
  unpin(
    @Param('productionOrderId') productionOrderId: string,
    @Body() dto: PinDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scheduling.setPin(productionOrderId, dto, false, user);
  }

  @RequireAnyPermissions('schedule.request-change.own', 'schedule.manage')
  @Post('orders/:productionOrderId/dealer-date')
  dealerDate(
    @Param('productionOrderId') productionOrderId: string,
    @Body() dto: DealerDateChangeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scheduling.dealerDateChange(productionOrderId, dto, user);
  }

  // ── Catalog scheduling config ─────────────────────────────────────────

  @RequirePermissions('catalog.manage')
  @Get('products/:id/production-profile')
  getProductionProfile(@Param('id') id: string) {
    return this.scheduling.getProductionProfile(id);
  }

  @RequirePermissions('catalog.manage')
  @Patch('products/:id/production-profile')
  updateProductionProfile(
    @Param('id') id: string,
    @Body() dto: ProductionProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scheduling.upsertProductionProfile(id, dto, user.id);
  }

  @RequirePermissions('catalog.manage')
  @Get('products/:id/stage-estimates')
  getStageEstimates(@Param('id') id: string) {
    return this.scheduling.listStageEstimates(id);
  }

  @RequirePermissions('catalog.manage')
  @Patch('products/:id/stage-estimates')
  updateStageEstimates(
    @Param('id') id: string,
    @Body() dto: ProductStageEstimatesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scheduling.upsertStageEstimates(id, dto.items, user.id);
  }

  // ── Estimate learning ───────────────────────────────────────────────────

  @RequirePermissions('schedule.settings.manage')
  @Post('estimate-stats/recompute')
  recomputeEstimateStats(@Query('productId') productId?: string) {
    return this.scheduling.computeEstimateStats(productId);
  }

  @RequirePermissions('schedule.settings.manage')
  @Post('estimate-proposals/:id/accept')
  acceptEstimateProposal(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.scheduling.acceptSuggestedEstimate(id, user.id);
  }
}
