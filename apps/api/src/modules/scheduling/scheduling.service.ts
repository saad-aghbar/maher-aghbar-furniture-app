import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { IdempotencyService } from '../../common/idempotency.service';
import { assertCustomerOwns } from '../../common/helpers/customer-scope';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulingQueueService, type SchedulingJobName } from './scheduling-queue';
import { bomReservationNeeds } from '../../common/helpers/inventory-reservation.util';
import type { BomDefaults } from '../../common/helpers/order-costing.util';
import {
  type AllocationToValidate,
  type OccupancyInterval,
  type PlannerOrderInput,
  type PlannerStageInput,
  type TimeOfDayRange,
  type WorkerCandidate,
  backwardSchedule,
  calculateDurationMinutes,
  detectCycles,
  buildDependencyGraph,
  forwardSchedule,
  mapPromiseState,
  parseResourceCapacityKey,
  resourceCapacityKey,
  resolveDealerChangePolicy,
  validateSchedule,
  WorkingCalendar,
  eachYmdInclusive,
  overlapWorkingMinutes,
  parseYmd,
  addDaysYmd,
  assessMaterialReadiness,
  applyStageOrOrderMaterialFloors,
  frozenInputsFromSnapshotNodes,
  applyConsumeWipDependencies,
  assessWipLotsReady,
  assessWipKitsReady,
  requirementFromNeeds,
  inventorySkuKey,
  inventoryGroupKey,
  detectConflicts,
  serializeConflict,
  affectedOrderIds,
  categorizeConflictInflators,
  findResolutionPlacement,
  pickMovableSides,
  sortConflictsForResolveAll,
  missesCommitment,
  classifyScheduleRisk,
  comparePriority,
  isActiveScheduleStatus,
  publicScheduleReason,
  reasonLabelKey,
  classifyMinutesDelta,
  classifySettingsDelta,
  factoryReplanHorizonYmd,
  selectIncreaseCandidates,
  selectDecreaseCandidates,
  compareFactoryReplanCandidates,
  countPinnedIssuesByYmd,
  listPinnedOnUnavailableCalendar,
  workingMinutesOnYmd,
  ymdInTimezone,
  OccupancyCollisionError,
  PastFloorViolationError,
  resolvePlannerNow,
  resolveSchedulingFloor,
  classifyAllocationForFloor,
  allocationViolatesSchedulingFloor,
  assertNoPastIncompleteAllocations,
  isHistoricalCapacityIncrease,
  unionOccupancyIntervals,
  stripOccupancyForOrder,
  plannedAllocationsToOccupancy,
  occupancyFromGeneratedAllocations,
  findOccupancyCollisions,
  plannedAllocationsMatch,
  operationalOverlapKey,
  type CapacityDelta,
  type FactoryReplanCandidate,
  type FactoryReplanOrderInput,
  type PinnedUnavailableIssue,
  type ConflictAllocationInput,
  type DetectedConflict,
  type ScheduleRiskClassification,
  isHardLocked,
  stillNonRecoverableBlocker,
  blockerKindFromReadiness,
  selectManualSyncCandidates,
  deriveManualSyncOutcome,
  type ManualSyncOrderFacts,
  applyNDayFloor,
  attachEmptyDayCauses,
  simulatePolicy,
  sortPullForwardOrders,
  deriveOptimizeOutcome,
  emptyDayCauseI18nKey,
  isOptimizeChangeType,
  movableSimOrders,
  blockedSimOrders,
  OPTIMIZE_APPLY_CHANGE_TYPE,
  OPTIMIZE_PREVIEW_CHANGE_TYPE,
  actualDeliveryValue,
  buildDealerDeliveryView,
  plannedDeliveryValue,
  customerFacingFingerprint,
  filterByCalendarDateRange,
  selectDealerNotifyTemplate,
  shouldNotifyCustomerFacing,
  summarizeDealerDeliveries,
  toCalendarYmd,
} from './domain';
import type {
  AvailabilityRequestDto,
  CalendarExceptionDto,
  DealerDateChangeDto,
  ListCalendarQuery,
  PatchAllocationDto,
  PinDto,
  ProductionCalendarDto,
  ProductionProfileDto,
  ProductStageEstimateInputDto,
  RecalculateDto,
} from './dto/scheduling.dto';
import { loadCapacityOptimizeWorld } from './capacity-optimize-world';

const DEBOUNCE_WINDOW_MS = 60_000;

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function isScheduleLate(
  completion: Date | null | undefined,
  requested: Date | null | undefined,
  committed: Date | null | undefined,
): boolean {
  const target = committed ?? requested;
  if (!completion || !target) return false;
  return completion.getTime() > target.getTime();
}

/** Presentation-only: last production instant before the delivery buffer. Never used as a planner input. */
function productionDeadlineIso(
  calendar: WorkingCalendar,
  bufferWorkingDays: number,
  requested?: Date | null,
  committed?: Date | null,
): string | null {
  const delivery = committed ?? requested;
  if (!delivery) return null;
  return calendar.latestProductionCompletion(delivery, bufferWorkingDays).toISOString();
}

@Injectable()
export class SchedulingService implements OnModuleInit {
  private readonly logger = new Logger(SchedulingService.name);
  /** Coalesces same template+entity notification bursts within DEBOUNCE_WINDOW_MS. */
  private readonly notifyDebounce = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly idempotency: IdempotencyService,
    private readonly queue: SchedulingQueueService,
  ) {}

  onModuleInit() {
    this.queue.setProcessor((name, data) => this.processSchedulingJob(name, data));
  }

  // ── Calendar ────────────────────────────────────────────────────────────

  /** Default factory week: Fri closed, Sat open; shift 08:00–16:00. */
  private static readonly DEFAULT_WORKING_WEEKDAYS = [0, 1, 2, 3, 4, 6];
  private static readonly LEGACY_WORKING_WEEKDAYS = [0, 1, 2, 3, 4];

  async ensureDefaultCalendar() {
    let row = await this.prisma.factoryCalendar.findFirst({ where: { isDefault: true } });
    if (!row) {
      row = await this.prisma.factoryCalendar.create({
        data: {
          name: 'Default',
          timezone: 'Asia/Amman',
          workingWeekdays: SchedulingService.DEFAULT_WORKING_WEEKDAYS,
          shiftStart: '08:00',
          shiftEnd: '16:00',
          breaks: [{ start: '12:00', end: '13:00' }] as unknown as Prisma.InputJsonValue,
          deliveryBufferWorkingDays: 1,
          maxProductionEarlyWorkingDays: 10,
          targetFactoryUtilizationPercent: 85,
          isDefault: true,
        },
      });
      return row;
    }

    // One-shot upgrade from legacy Sun–Thu / 17:00 defaults.
    const weekdays = row.workingWeekdays ?? [];
    const isLegacyWeek =
      weekdays.length === SchedulingService.LEGACY_WORKING_WEEKDAYS.length &&
      SchedulingService.LEGACY_WORKING_WEEKDAYS.every((d, i) => weekdays[i] === d);
    const isLegacyEnd = row.shiftEnd === '17:00';
    if (isLegacyWeek || isLegacyEnd) {
      row = await this.prisma.factoryCalendar.update({
        where: { id: row.id },
        data: {
          ...(isLegacyWeek ? { workingWeekdays: SchedulingService.DEFAULT_WORKING_WEEKDAYS } : {}),
          ...(isLegacyEnd ? { shiftEnd: '16:00' } : {}),
        },
      });
      await this.audit(
        '',
        'schedule.calendar.defaults_upgrade',
        'FactoryCalendar',
        row.id,
        {
          workingWeekdays: isLegacyWeek ? SchedulingService.DEFAULT_WORKING_WEEKDAYS : undefined,
          shiftEnd: isLegacyEnd ? '16:00' : undefined,
        },
      );
    }
    return row;
  }

  async getCalendar() {
    const row = await this.ensureDefaultCalendar();
    const exceptions = await this.prisma.factoryCalendarException.findMany({
      where: { calendarId: row.id },
      orderBy: { date: 'asc' },
    });
    return { ...row, exceptions };
  }

  private async getCalendarDomain(): Promise<{
    row: Awaited<ReturnType<SchedulingService['getCalendar']>>;
    calendar: WorkingCalendar;
  }> {
    const row = await this.getCalendar();
    const calendar = new WorkingCalendar({
      timezone: row.timezone,
      workingWeekdays: row.workingWeekdays,
      shiftStart: row.shiftStart,
      shiftEnd: row.shiftEnd,
      breaks: (row.breaks as TimeOfDayRange[] | null) ?? [],
      exceptions: row.exceptions.map((e) => ({
        date: e.date,
        type: e.type,
        shiftStart: e.shiftStart,
        shiftEnd: e.shiftEnd,
        note: e.note,
      })),
    });
    return { row, calendar };
  }

  /**
   * Replan every PO with an active schedule so capacity changes (open Friday,
   * overtime, weekday edits) reshape planned windows immediately.
   */
  async replanActiveSchedules(userId: string, reason: string): Promise<{ replanned: number }> {
    const active = await this.prisma.productionSchedule.findMany({
      where: { status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] } },
      select: { productionOrderId: true },
      distinct: ['productionOrderId'],
    });
    let replanned = 0;
    for (const row of active) {
      try {
        await this.generateForProductionOrder(row.productionOrderId, userId, { reason });
        replanned += 1;
      } catch {
        // Keep going — one bad PO must not block the rest of the factory replan.
      }
    }
    return { replanned };
  }

  async upsertCalendar(dto: ProductionCalendarDto, userId: string) {
    const { row, calendar: beforeCal } = await this.getCalendarDomain();
    await this.prisma.factoryCalendar.update({
      where: { id: row.id },
      data: {
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.workingWeekdays ? { workingWeekdays: dto.workingWeekdays } : {}),
        ...(dto.shiftStart ? { shiftStart: dto.shiftStart } : {}),
        ...(dto.shiftEnd ? { shiftEnd: dto.shiftEnd } : {}),
        ...(dto.breaks ? { breaks: dto.breaks as unknown as Prisma.InputJsonValue } : {}),
        ...(dto.deliveryBufferWorkingDays != null
          ? { deliveryBufferWorkingDays: dto.deliveryBufferWorkingDays }
          : {}),
        ...(dto.maxProductionEarlyWorkingDays != null
          ? { maxProductionEarlyWorkingDays: dto.maxProductionEarlyWorkingDays }
          : {}),
        ...(dto.targetFactoryUtilizationPercent != null
          ? { targetFactoryUtilizationPercent: dto.targetFactoryUtilizationPercent }
          : {}),
      },
    });
    await this.audit(userId, 'schedule.calendar.update', 'FactoryCalendar', row.id, dto);
    const capacityAffecting =
      Boolean(dto.timezone) ||
      Boolean(dto.workingWeekdays) ||
      Boolean(dto.shiftStart) ||
      Boolean(dto.shiftEnd) ||
      Boolean(dto.breaks) ||
      dto.deliveryBufferWorkingDays != null;
    const calendar = await this.getCalendar();
    if (!capacityAffecting) {
      return { ...calendar, replanQueued: false, replanned: 0 };
    }
    const { calendar: afterCal } = await this.getCalendarDomain();
    const todayYmd = ymdInTimezone(new Date(), afterCal.timezone);
    const capacityDelta = classifySettingsDelta(beforeCal, afterCal, todayYmd);
    const queued = await this.enqueueFactoryReplan(userId, {
      changeType: 'calendar-settings-updated',
      capacityDelta,
      affectedYmd: todayYmd,
      reason: 'calendar-settings-updated',
    });
    return { ...calendar, ...queued };
  }

  async addException(dto: CalendarExceptionDto, userId: string) {
    const { row, calendar: beforeCal } = await this.getCalendarDomain();
    const date = new Date(`${dto.date}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid exception date.' });
    }
    const exception = await this.prisma.factoryCalendarException.upsert({
      where: { calendarId_date: { calendarId: row.id, date } },
      create: {
        calendarId: row.id,
        date,
        type: dto.type,
        shiftStart: dto.shiftStart,
        shiftEnd: dto.shiftEnd,
        note: dto.note,
      },
      update: {
        type: dto.type,
        shiftStart: dto.shiftStart,
        shiftEnd: dto.shiftEnd,
        note: dto.note,
      },
    });
    await this.audit(userId, 'schedule.calendar.exception.add', 'FactoryCalendarException', exception.id, dto);
    const { calendar: afterCal } = await this.getCalendarDomain();
    const beforeMin = workingMinutesOnYmd(beforeCal, dto.date);
    const afterMin = workingMinutesOnYmd(afterCal, dto.date);
    const queued = await this.enqueueFactoryReplan(userId, {
      changeType: `calendar-exception:${dto.type}`,
      capacityDelta: classifyMinutesDelta(beforeMin, afterMin),
      affectedYmd: dto.date,
      reason: `calendar-exception:${dto.type}`,
    });
    return { ...exception, ...queued };
  }

  async deleteException(dateYmd: string, userId: string) {
    const { row, calendar: beforeCal } = await this.getCalendarDomain();
    const date = new Date(`${dateYmd}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid exception date.' });
    }
    const existing = await this.prisma.factoryCalendarException.findUnique({
      where: { calendarId_date: { calendarId: row.id, date } },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'No exception for that date.' });
    }
    await this.prisma.factoryCalendarException.delete({ where: { id: existing.id } });
    await this.audit(
      userId,
      'schedule.calendar.exception.delete',
      'FactoryCalendarException',
      existing.id,
      { date: dateYmd },
    );
    const { calendar: afterCal } = await this.getCalendarDomain();
    const beforeMin = workingMinutesOnYmd(beforeCal, dateYmd);
    const afterMin = workingMinutesOnYmd(afterCal, dateYmd);
    const queued = await this.enqueueFactoryReplan(userId, {
      changeType: 'calendar-exception:cleared',
      capacityDelta: classifyMinutesDelta(beforeMin, afterMin),
      affectedYmd: dateYmd,
      reason: 'calendar-exception:cleared',
    });
    return { deleted: true, date: dateYmd, ...queued };
  }

  async listCalendar(query: ListCalendarQuery) {
    const { row, calendar } = await this.getCalendarDomain();
    const from = new Date(`${query.from}T00:00:00.000Z`);
    const to = new Date(`${query.to}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to.getTime() < from.getTime()) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid date range.' });
    }
    const maxDays = 400;
    const days: Array<{
      date: string;
      isWorking: boolean;
      intervals: Array<{ start: string; end: string }>;
      pinnedOnClosedDayCount: number;
    }> = [];
    const cursor = new Date(from);
    let guard = 0;
    while (cursor.getTime() <= to.getTime() && guard < maxDays) {
      const intervals = calendar.intervalsForLocalDay(cursor);
      days.push({
        date: cursor.toISOString().slice(0, 10),
        isWorking: intervals.length > 0,
        intervals: intervals.map((iv) => ({ start: iv.start.toISOString(), end: iv.end.toISOString() })),
        pinnedOnClosedDayCount: 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      guard += 1;
    }
    const rangeEnd = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
    const [orders, pinnedByYmd] = await Promise.all([
      this.buildOrderCards(from, rangeEnd, {
        calendar,
        bufferWorkingDays: row.deliveryBufferWorkingDays ?? 1,
        fromYmd: query.from,
        toYmd: query.to,
      }),
      this.pinnedOnClosedDayCounts(calendar, from, rangeEnd),
    ]);
    for (const day of days) {
      day.pinnedOnClosedDayCount = day.isWorking ? 0 : (pinnedByYmd[day.date] ?? 0);
    }
    return { calendar: row, days, orders };
  }

  /** Order-level cards (PO#, product, dealer, planned window, status, schedule dates) for calendar views. */
  private async buildOrderCards(
    fromDate: Date,
    toDate: Date,
    presentation?: {
      calendar: WorkingCalendar;
      bufferWorkingDays: number;
      fromYmd?: string;
      toYmd?: string;
    },
  ) {
    const allocations = await this.prisma.scheduleAllocation.findMany({
      where: {
        plannedStart: { lt: toDate },
        plannedEnd: { gt: fromDate },
        schedule: { status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] } },
      },
      select: {
        plannedStart: true,
        plannedEnd: true,
        employeeId: true,
        schedule: {
          select: {
            id: true,
            version: true,
            status: true,
            promiseState: true,
            materialRisk: true,
            productionOrderId: true,
            requestedDeliveryDate: true,
            suggestedDeliveryDate: true,
            committedDeliveryDate: true,
            earliestAvailableDate: true,
            requestedDateFeasible: true,
            unschedulableReason: true,
            planningMode: true,
            requiresAdminEstimateReview: true,
            materialReadyAt: true,
            committedCompletionDate: true,
          },
        },
      },
      orderBy: { plannedStart: 'asc' },
    });
    if (allocations.length === 0) return [];

    interface Bucket {
      scheduleId: string;
      version: number;
      status: string;
      promiseState: string;
      materialRisk: boolean;
      requestedDeliveryDate: Date | null;
      suggestedDeliveryDate: Date | null;
      committedDeliveryDate: Date | null;
      earliestAvailableDate: Date | null;
      requestedDateFeasible: boolean | null;
      unschedulableReason: string | null;
      planningMode: string | null;
      requiresAdminEstimateReview: boolean;
      materialReadyAt: Date | null;
      committedCompletionDate: Date | null;
      minStart: Date;
      maxEnd: Date;
      occupiedDates: Set<string>;
    }
    const calendar = presentation?.calendar;
    const occupyFromYmd = presentation?.fromYmd;
    const occupyToYmd = presentation?.toYmd;
    const occupiedFor = (a: (typeof allocations)[number]): Set<string> => {
      if (!calendar) return new Set();
      return new Set(calendar.occupiedLocalYmds(a.plannedStart, a.plannedEnd, occupyFromYmd, occupyToYmd));
    };
    const toBucket = (a: (typeof allocations)[number]): Bucket => ({
      scheduleId: a.schedule.id,
      version: a.schedule.version,
      status: a.schedule.status,
      promiseState: a.schedule.promiseState,
      materialRisk: a.schedule.materialRisk,
      requestedDeliveryDate: a.schedule.requestedDeliveryDate,
      suggestedDeliveryDate: a.schedule.suggestedDeliveryDate,
      committedDeliveryDate: a.schedule.committedDeliveryDate,
      earliestAvailableDate: a.schedule.earliestAvailableDate,
      requestedDateFeasible: a.schedule.requestedDateFeasible,
      unschedulableReason: a.schedule.unschedulableReason,
      planningMode: a.schedule.planningMode,
      requiresAdminEstimateReview: a.schedule.requiresAdminEstimateReview,
      materialReadyAt: a.schedule.materialReadyAt,
      committedCompletionDate: a.schedule.committedCompletionDate,
      minStart: a.plannedStart,
      maxEnd: a.plannedEnd,
      occupiedDates: occupiedFor(a),
    });
    const byOrder = new Map<string, Bucket>();
    for (const a of allocations) {
      const key = a.schedule.productionOrderId;
      const existing = byOrder.get(key);
      if (!existing) {
        byOrder.set(key, toBucket(a));
        continue;
      }
      // Ignore older schedule versions entirely — unioning their windows made
      // recalculate/date-change look like a no-op when APPROVED + PROPOSED both existed.
      if (a.schedule.version < existing.version) continue;
      if (a.schedule.version > existing.version) {
        byOrder.set(key, toBucket(a));
        continue;
      }
      if (a.plannedStart.getTime() < existing.minStart.getTime()) existing.minStart = a.plannedStart;
      if (a.plannedEnd.getTime() > existing.maxEnd.getTime()) existing.maxEnd = a.plannedEnd;
      if (calendar) {
        for (const ymd of occupiedFor(a)) existing.occupiedDates.add(ymd);
      }
    }

    const conflicts = await this.listConflicts();
    const conflictOrderIds = new Set<string>();
    for (const c of conflicts.data) {
      conflictOrderIds.add(c.allocationA.productionOrderId);
      conflictOrderIds.add(c.allocationB.productionOrderId);
    }

    const orderIds = [...byOrder.keys()];
    const orders = await this.prisma.productionOrder.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        number: true,
        quantity: true,
        priority: true,
        customerId: true,
        requiredDeliveryDate: true,
        product: { select: { id: true, nameEn: true, nameAr: true, nameHe: true, imageUrl: true } },
        salesOrder: {
          select: {
            customerId: true,
            customer: { select: { id: true, name: true, nameEn: true, nameAr: true, nameHe: true } },
          },
        },
      },
    });
    const orderById = new Map(orders.map((o) => [o.id, o]));

    const orphanCustomerIds = [
      ...new Set(
        orders
          .filter((o) => o.customerId && !o.salesOrder?.customer)
          .map((o) => o.customerId as string),
      ),
    ];
    const orphanCustomers = orphanCustomerIds.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: orphanCustomerIds } },
          select: { id: true, name: true, nameEn: true, nameAr: true, nameHe: true },
        })
      : [];
    const orphanById = new Map(orphanCustomers.map((c) => [c.id, c]));

    const bufferWorkingDays = presentation?.bufferWorkingDays ?? 1;
    return orderIds.map((id) => {
      const bucket = byOrder.get(id)!;
      const order = orderById.get(id);
      const customer =
        order?.salesOrder?.customer ?? (order?.customerId ? orphanById.get(order.customerId) ?? null : null);
      const requested = bucket.requestedDeliveryDate ?? order?.requiredDeliveryDate ?? null;
      const committed = bucket.committedDeliveryDate;
      return {
        id,
        productionOrderId: id,
        scheduleId: bucket.scheduleId,
        version: bucket.version,
        number: order?.number ?? '',
        productName: order?.product?.nameEn ?? null,
        productNameAr: order?.product?.nameAr ?? null,
        productNameHe: order?.product?.nameHe ?? null,
        imageUrl: order?.product?.imageUrl ?? null,
        dealerName: customer?.nameEn ?? customer?.name ?? null,
        dealerNameAr: customer?.nameAr ?? customer?.name ?? null,
        dealerNameHe: customer?.nameHe ?? null,
        quantity: order ? Number(order.quantity) : null,
        priority: order?.priority ?? null,
        status: bucket.status,
        promiseState: bucket.promiseState,
        materialRisk: bucket.materialRisk,
        plannedStart: bucket.minStart.toISOString(),
        plannedEnd: bucket.maxEnd.toISOString(),
        occupiedDates: calendar ? [...bucket.occupiedDates].sort() : undefined,
        hasConflict: conflictOrderIds.has(id),
        requestedDeliveryDate: requested,
        suggestedDeliveryDate: bucket.suggestedDeliveryDate,
        committedDeliveryDate: committed,
        earliestAvailableDate: bucket.earliestAvailableDate,
        requestedDateFeasible: bucket.requestedDateFeasible,
        unschedulableReason: bucket.unschedulableReason,
        planningMode: bucket.planningMode,
        requiresAdminEstimateReview: bucket.requiresAdminEstimateReview,
        materialReadyAt: bucket.materialReadyAt,
        committedCompletionDate: bucket.committedCompletionDate,
        productionDeadline: calendar
          ? productionDeadlineIso(calendar, bufferWorkingDays, requested, committed)
          : null,
        deliveryBufferWorkingDays: calendar ? bufferWorkingDays : null,
      };
    });
  }

  // ── Product scheduling config ──────────────────────────────────────────

  async getProductionProfile(productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, archivedAt: null } });
    if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });
    const profile = await this.prisma.productProductionProfile.findUnique({ where: { productId } });
    return (
      profile ?? {
        productId,
        totalStandardMinutes: null,
        setupMinutes: 0,
        complexityFactor: 1,
        defaultBatchSize: 1,
        minimumLeadTimeDays: null,
        bufferPercent: 10,
        isSchedulingEnabled: true,
      }
    );
  }

  async upsertProductionProfile(productId: string, dto: ProductionProfileDto, userId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, archivedAt: null } });
    if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });
    const row = await this.prisma.productProductionProfile.upsert({
      where: { productId },
      create: { productId, ...dto },
      update: { ...dto },
    });
    await this.audit(userId, 'scheduling.production-profile.upsert', 'ProductProductionProfile', productId, row);
    return row;
  }

  async listStageEstimates(productId: string) {
    return this.prisma.productStageEstimate.findMany({
      where: { productId },
      include: { stageDefinition: true, overrideDepartment: true },
      orderBy: { stageDefinition: { sortOrder: 'asc' } },
    });
  }

  async upsertStageEstimates(productId: string, items: ProductStageEstimateInputDto[], userId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, archivedAt: null } });
    if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });

    for (const row of items) {
      await this.prisma.productStageEstimate.upsert({
        where: { productId_stageDefinitionId: { productId, stageDefinitionId: row.stageDefinitionId } },
        create: {
          productId,
          stageDefinitionId: row.stageDefinitionId,
          setupMinutes: row.setupMinutes ?? 0,
          minutesPerUnit: row.minutesPerUnit ?? 0,
          fixedMinutes: row.fixedMinutes ?? 0,
          quantityScalingMode: row.quantityScalingMode ?? 'SETUP_PLUS_LINEAR',
          batchSize: row.batchSize,
          batchMinutes: row.batchMinutes,
          maxParallelUnits: row.maxParallelUnits,
          workerCountRequired: row.workerCountRequired ?? 1,
          overrideDepartmentId: row.overrideDepartmentId,
          isRequired: row.isRequired ?? true,
        },
        update: {
          setupMinutes: row.setupMinutes ?? 0,
          minutesPerUnit: row.minutesPerUnit ?? 0,
          fixedMinutes: row.fixedMinutes ?? 0,
          quantityScalingMode: row.quantityScalingMode ?? 'SETUP_PLUS_LINEAR',
          batchSize: row.batchSize,
          batchMinutes: row.batchMinutes,
          maxParallelUnits: row.maxParallelUnits,
          workerCountRequired: row.workerCountRequired ?? 1,
          overrideDepartmentId: row.overrideDepartmentId,
          isRequired: row.isRequired ?? true,
        },
      });
    }
    await this.audit(userId, 'scheduling.stage-estimates.upsert', 'ProductStageEstimate', productId, items);
    return this.listStageEstimates(productId);
  }

  // ── Dealer-safe availability ────────────────────────────────────────────

  async availability(dto: AvailabilityRequestDto, user?: AuthUser) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
      include: {
        productionProfile: true,
        stageEstimates: { include: { stageDefinition: true, overrideDepartment: true } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const stages: PlannerStageInput[] = [];
    const seenCodes = new Set<string>();
    let anyMissing = false;
    let anyComplete = false;

    for (const item of dto.items) {
      const product = byId.get(item.productId);
      if (!product || product.stageEstimates.length === 0) {
        anyMissing = true;
        const fallback = await this.fallbackStagesFor();
        for (const s of fallback) {
          const code = `${item.productId}:${s.code}`;
          if (seenCodes.has(code)) continue;
          seenCodes.add(code);
          stages.push({
            ...s,
            code,
            dependsOnCodes: s.dependsOnCodes.map((c) => `${item.productId}:${c}`),
          });
        }
        continue;
      }
      anyComplete = true;
      for (const estimate of product.stageEstimates) {
        if (!estimate.isRequired) continue;
        const code = `${item.productId}:${estimate.stageDefinition.code}`;
        if (seenCodes.has(code)) continue;
        seenCodes.add(code);
        stages.push({
          code,
          stageDefinitionId: estimate.stageDefinitionId,
          dependsOnCodes: estimate.stageDefinition.dependsOnCodes.map((c) => `${item.productId}:${c}`),
          estimatedMinutes: calculateDurationMinutes({
            quantityScalingMode: estimate.quantityScalingMode,
            quantity: item.quantity,
            setupMinutes: estimate.setupMinutes,
            minutesPerUnit: estimate.minutesPerUnit,
            fixedMinutes: estimate.fixedMinutes,
            batchSize: estimate.batchSize ?? undefined,
            batchMinutes: estimate.batchMinutes ?? undefined,
            maxParallelUnits: estimate.maxParallelUnits ?? undefined,
          }),
          departmentCode: estimate.overrideDepartment?.code ?? estimate.stageDefinition.responsibleDepartment ?? null,
          schedulingResourceMode: estimate.stageDefinition.schedulingResourceMode ?? 'WORKER_CONSTRAINED',
          resourceSlots: estimate.stageDefinition.resourceSlots ?? 1,
        });
      }
    }

    if (stages.length === 0) {
      return {
        estimateStatus: 'UNAVAILABLE' as const,
        earliestAvailableDate: null,
        requestedDateFeasible: false,
        suggestedDeliveryDate: null,
        alternativeDates: [] as string[],
        estimateConfidence: 'LOW' as const,
        requiresAdminEstimateReview: true,
      };
    }

    const [workers, occupancy, { calendar, row: calendarRow }] = await Promise.all([
      this.loadWorkers(),
      this.loadOccupancy(),
      this.getCalendarDomain(),
    ]);
    const now = new Date();
    const requestedDeliveryDate = dto.requestedDeliveryDate ? new Date(dto.requestedDeliveryDate) : null;
    if (dto.requestedDeliveryDate && Number.isNaN(requestedDeliveryDate?.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid requestedDeliveryDate.' });
    }

    const inventory = await this.loadInventoryAvailability();
    let materialReadyAt: Date | null = null;
    let materialBlocked = false;
    for (const item of dto.items) {
      const product = byId.get(item.productId);
      const needs = bomReservationNeeds(
        product?.bomDefaults as BomDefaults | null,
        Number(item.quantity) || 1,
      );
      const assessed = assessMaterialReadiness(requirementFromNeeds(needs), inventory);
      if (assessed.risk && !assessed.materialReadyAt) {
        materialBlocked = true;
      }
      if (assessed.materialReadyAt && (!materialReadyAt || assessed.materialReadyAt.getTime() > materialReadyAt.getTime())) {
        materialReadyAt = assessed.materialReadyAt;
      }
    }

    if (materialBlocked) {
      return {
        estimateStatus: 'UNAVAILABLE' as const,
        earliestAvailableDate: null,
        requestedDateFeasible: false,
        suggestedDeliveryDate: null,
        alternativeDates: [] as string[],
        estimateConfidence: 'LOW' as const,
        requiresAdminEstimateReview: true,
        planningMode: 'FORWARD' as const,
      };
    }

    const latestCompletionTarget =
      requestedDeliveryDate && calendarRow
        ? calendar.latestProductionCompletion(
            requestedDeliveryDate,
            calendarRow.deliveryBufferWorkingDays ?? 1,
          )
        : null;

    const orderInput: PlannerOrderInput = {
      id: 'availability-check',
      customerId: user?.customerId ?? dto.customerId ?? 'anonymous',
      priority: 'NORMAL',
      createdAt: now,
      requestedDeliveryDate,
      latestCompletionTarget,
      materialReadyAt,
      stages,
    };

    const ctx = { calendar, workers, existingOccupancy: occupancy, now };
    let earliestAvailableDate: Date | null;
    let requestedDateFeasible = true;
    let suggestedDeliveryDate: Date | null;

    try {
      const forward = forwardSchedule([orderInput], ctx);
      earliestAvailableDate = forward.earliestCompletion;
      suggestedDeliveryDate = earliestAvailableDate;

      if (requestedDeliveryDate) {
        const backward = backwardSchedule([orderInput], ctx);
        requestedDateFeasible = backward.requestedDateFeasible;
        suggestedDeliveryDate = requestedDateFeasible ? requestedDeliveryDate : earliestAvailableDate;
      }
    } catch {
      // Planner couldn't place stages (e.g. no eligible workers yet) — degrade gracefully.
      return {
        estimateStatus: 'UNAVAILABLE' as const,
        earliestAvailableDate: null,
        requestedDateFeasible: false,
        suggestedDeliveryDate: null,
        alternativeDates: [] as string[],
        estimateConfidence: 'LOW' as const,
        requiresAdminEstimateReview: true,
      };
    }

    const alternativeDates = this.buildAlternativeDates(calendar, earliestAvailableDate);

    return {
      estimateStatus: anyMissing ? ('PRELIMINARY' as const) : ('CALCULATED' as const),
      earliestAvailableDate,
      requestedDateFeasible,
      suggestedDeliveryDate,
      alternativeDates,
      estimateConfidence: anyMissing ? ('LOW' as const) : anyComplete ? ('HIGH' as const) : ('MEDIUM' as const),
      requiresAdminEstimateReview: anyMissing,
    };
  }

  private buildAlternativeDates(calendar: WorkingCalendar, base: Date | null): string[] {
    if (!base) return [];
    return [3, 7, 14].map((days) => {
      const naive = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
      return calendar.nextWorkingInstant(naive).toISOString();
    });
  }

  private async fallbackStagesFor(): Promise<PlannerStageInput[]> {
    const defs = await this.prisma.productionStageDefinition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return defs.map((d) => ({
      code: d.code,
      stageDefinitionId: d.id,
      dependsOnCodes: d.dependsOnCodes,
      estimatedMinutes: Math.max(30, Math.round(Number(d.estimatedHours ?? 1) * 60)),
      departmentCode: d.responsibleDepartment ?? null,
      schedulingResourceMode: d.schedulingResourceMode ?? 'WORKER_CONSTRAINED',
      resourceSlots: d.resourceSlots ?? 1,
    }));
  }

  // ── Worker / occupancy loaders ──────────────────────────────────────────

  private async loadWorkers(): Promise<WorkerCandidate[]> {
    const workers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        roles: { some: { role: { kind: 'PRODUCTION_WORKER' } } },
      },
      select: {
        id: true,
        department: { select: { code: true } },
        workerSkills: { where: { isActive: true }, select: { stageDefinitionId: true } },
      },
    });
    return workers.map((w) => ({
      id: w.id,
      isActive: true,
      departmentCode: w.department?.code ?? null,
      skillStageDefinitionIds: w.workerSkills.map((s) => s.stageDefinitionId),
    }));
  }

  private async loadOccupancy(excludePoId?: string): Promise<OccupancyInterval[]> {
    const now = new Date();
    const allocations = await this.prisma.scheduleAllocation.findMany({
      where: {
        plannedEnd: { gte: now },
        schedule: {
          status: { in: ['APPROVED', 'PROPOSED'] },
          ...(excludePoId ? { productionOrderId: { not: excludePoId } } : {}),
        },
        OR: [{ employeeId: { not: null } }, { resourceSlot: { not: null } }],
      },
      select: {
        id: true,
        employeeId: true,
        resourceSlot: true,
        plannedStart: true,
        plannedEnd: true,
        productionTask: { select: { stageDefinitionId: true } },
        schedule: { select: { productionOrderId: true } },
      },
    });
    return allocations.flatMap((a) => {
      const poId = a.schedule.productionOrderId;
      const rows: OccupancyInterval[] = [];
      if (a.employeeId) {
        rows.push({
          employeeId: a.employeeId,
          start: a.plannedStart,
          end: a.plannedEnd,
          allocationId: a.id,
          productionOrderId: poId,
        });
      }
      if (a.resourceSlot != null && a.productionTask?.stageDefinitionId) {
        rows.push({
          employeeId: resourceCapacityKey(a.productionTask.stageDefinitionId, a.resourceSlot),
          start: a.plannedStart,
          end: a.plannedEnd,
          allocationId: `${a.id}:res`,
          productionOrderId: poId,
        });
      }
      return rows;
    });
  }

  private async loadInventoryAvailability() {
    const items = await this.prisma.inventoryItem.findMany({
      where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
      select: {
        id: true,
        sku: true,
        category: true,
        materialGroup: true,
        balances: { select: { availableQty: true, reservedQty: true } },
      },
    });
    const map: Record<
      string,
      { available: number; reserved: number; incoming: Array<{ qty: number; readyAt: Date }> }
    > = {
      fabricMeters: { available: 0, reserved: 0, incoming: [] },
      woodUnits: { available: 0, reserved: 0, incoming: [] },
      foamBlocks: { available: 0, reserved: 0, incoming: [] },
    };
    const itemById = new Map<string, (typeof items)[number]>();
    for (const item of items) {
      itemById.set(item.id, item);
      const reserved = item.balances.reduce((s, b) => s + Number(b.reservedQty), 0);
      const free = item.balances.reduce(
        (s, b) => s + Number(b.availableQty) - Number(b.reservedQty),
        0,
      );
      const groupKey = inventoryGroupKey(String(item.materialGroup ?? item.category));
      if (groupKey) {
        map[groupKey]!.available += free;
        map[groupKey]!.reserved += reserved;
      }
      const sku = item.sku?.trim();
      if (sku) {
        const key = inventorySkuKey(sku);
        if (!map[key]) map[key] = { available: 0, reserved: 0, incoming: [] };
        map[key].available += free;
        map[key].reserved += reserved;
      }
    }

    const openPos = await this.prisma.purchaseOrder.findMany({
      where: {
        archivedAt: null,
        status: { in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] },
      },
      select: {
        expectedDeliveryDate: true,
        lines: { select: { inventoryItemId: true, quantity: true } },
        goodsReceipts: {
          select: { lines: { select: { inventoryItemId: true, receivedQty: true } } },
        },
      },
    });
    for (const po of openPos) {
      const receivedByItem = new Map<string, number>();
      for (const grn of po.goodsReceipts) {
        for (const line of grn.lines) {
          receivedByItem.set(
            line.inventoryItemId,
            (receivedByItem.get(line.inventoryItemId) ?? 0) + Number(line.receivedQty),
          );
        }
      }
      const remainingByItem = new Map<string, number>();
      for (const line of po.lines) {
        if (!line.inventoryItemId) continue;
        remainingByItem.set(
          line.inventoryItemId,
          (remainingByItem.get(line.inventoryItemId) ?? 0) + Number(line.quantity),
        );
      }
      for (const [itemId, ordered] of remainingByItem) {
        const remaining = ordered - (receivedByItem.get(itemId) ?? 0);
        if (remaining <= 1e-9) continue;
        const readyAt = po.expectedDeliveryDate;
        if (!(readyAt instanceof Date) || Number.isNaN(readyAt.getTime())) continue;
        const item = itemById.get(itemId);
        if (!item) continue;
        const groupKey = inventoryGroupKey(String(item.materialGroup ?? item.category));
        if (groupKey) map[groupKey]!.incoming.push({ qty: remaining, readyAt });
        const sku = item.sku?.trim();
        if (sku) {
          const key = inventorySkuKey(sku);
          if (!map[key]) map[key] = { available: 0, reserved: 0, incoming: [] };
          map[key].incoming.push({ qty: remaining, readyAt });
        }
      }
    }

    return map;
  }

  // ── Generation / approval ───────────────────────────────────────────────

  private async assessLiveMaterialReadiness(po: {
    id: string;
    quantity?: unknown;
    salesOrderId?: string | null;
    salesOrder?: { status?: string } | null;
    product?: { bomDefaults?: unknown } | null;
  }) {
    const bom = (po.product?.bomDefaults ?? null) as BomDefaults | null;
    const needs = bomReservationNeeds(bom, Number(po.quantity) || 1);
    const inventory = await this.loadInventoryAvailability();
    const required = requirementFromNeeds(needs);
    const soStatus = po.salesOrder?.status;
    if (soStatus && soStatus !== 'WAITING_FOR_MATERIALS') {
      for (const [key, qty] of Object.entries(required)) {
        if (!(qty > 0)) continue;
        const row = inventory[key] ?? { available: 0, reserved: 0, incoming: [] };
        // No per-order reservation ledger. Confirm only bumps reservedQty when
        // this SO reserved. WAITING_FOR_MATERIALS means it did not; start()
        // keeps that status so we do not credit another order's reservation.
        if ((row.reserved ?? 0) + 1e-9 < qty) continue;
        inventory[key] = { ...row, available: (row.available ?? 0) + qty };
      }
    }
    return { ...assessMaterialReadiness(required, inventory), inventory };
  }

  private async loadWipLots(productionOrderId: string) {
    return this.prisma.inventoryLot.findMany({
      where: {
        productionOrderId,
        status: { in: ['AVAILABLE', 'PARTIALLY_CONSUMED'] },
        inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD' },
      },
      select: { inventoryItemId: true, quantity: true },
    });
  }

  private async assessWipReadiness(
    productionOrderId: string,
    orderQty: number,
    snapshotNodes?: Array<{
      stageCode: string;
      isSkipped: boolean;
      consumesSemiFinished: boolean;
      inventoryTracking: string | null;
      outputInventoryItemId: string | null;
      outputQtyPerUnit: unknown;
      consumeInventoryItemIds: unknown;
    }>,
  ) {
    const nodes =
      snapshotNodes ??
      (await this.prisma.productionOrderWorkflowSnapshotNode.findMany({
        where: { snapshot: { productionOrderId } },
        select: {
          id: true,
          stageCode: true,
          isSkipped: true,
          consumesSemiFinished: true,
          inventoryTracking: true,
          outputInventoryItemId: true,
          outputQtyPerUnit: true,
          consumeInventoryItemIds: true,
          stageInstanceId: true,
        },
      }));
    const lots = await this.loadWipLots(productionOrderId);
    const mapped = nodes.map((n) => ({
      id: 'id' in n && typeof (n as { id?: string }).id === 'string' ? (n as { id: string }).id : undefined,
      stageCode: n.stageCode,
      isSkipped: n.isSkipped,
      consumesSemiFinished: n.consumesSemiFinished,
      inventoryTracking: n.inventoryTracking,
      outputInventoryItemId: n.outputInventoryItemId,
      outputQtyPerUnit: n.outputQtyPerUnit != null ? Number(n.outputQtyPerUnit) : null,
      consumeInventoryItemIds: n.consumeInventoryItemIds,
      stageInstanceId:
        'stageInstanceId' in n
          ? ((n as { stageInstanceId?: string | null }).stageInstanceId ?? null)
          : null,
    }));
    const lotsReady = assessWipLotsReady(
      mapped,
      lots.map((lot) => ({
        inventoryItemId: lot.inventoryItemId,
        quantity: Number(lot.quantity),
      })),
      orderQty,
    );
    if (!lotsReady) return false;
    const kits = await this.prisma.wipKit.findMany({
      where: { productionOrderId },
      select: { stageInstanceId: true, status: true, nextSnapshotNodeIds: true },
    });
    return assessWipKitsReady(mapped, kits);
  }

  private async wipProducersCompleted(productionOrderId: string): Promise<boolean> {
    const producerNodes = await this.prisma.productionOrderWorkflowSnapshotNode.findMany({
      where: {
        snapshot: { productionOrderId },
        isSkipped: false,
        inventoryTracking: 'PRODUCES_SEMI_FINISHED',
      },
      select: { stageInstanceId: true },
    });
    const instanceIds = producerNodes.map((n) => n.stageInstanceId).filter((id): id is string => Boolean(id));
    if (instanceIds.length === 0) return true;
    const open = await this.prisma.productionTask.count({
      where: {
        productionOrderId,
        stageInstanceId: { in: instanceIds },
        status: { not: 'COMPLETED' },
      },
    });
    return open === 0;
  }

  private async persistUnschedulable(
    po: { id: string; requiredDeliveryDate: Date | null },
    userId: string,
    nextVersion: number,
    reason: string,
    note?: string,
    requiresAdminEstimateReview = false,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.productionSchedule.updateMany({
        where: {
          productionOrderId: po.id,
          status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] },
        },
        data: { status: 'SUPERSEDED' },
      });
      await tx.productionSchedule.create({
        data: {
          productionOrderId: po.id,
          version: nextVersion,
          status: 'NEEDS_REVIEW',
          promiseState: 'AT_RISK',
          requestedDeliveryDate: po.requiredDeliveryDate,
          requestedDateFeasible: false,
          planningMode: 'FORWARD',
          unschedulableReason: reason,
          reason: note ?? reason,
          generatedBy: userId,
          requiresAdminEstimateReview,
          estimateReviewStatus: requiresAdminEstimateReview ? 'PENDING' : 'NOT_REQUIRED',
          materialRisk: reason === 'MATERIAL_NOT_READY',
        },
      });
    });
  }

  async generateForProductionOrder(
    poId: string,
    userId: string,
    opts?: {
      reason?: string;
      mode?: 'forward' | 'backward';
      /** Anchor forward planning at this instant (admin “move to day”). */
      fromDate?: Date;
      /** When true, planner failures throw instead of creating an empty NEEDS_REVIEW. */
      failHard?: boolean;
      /** Pin these tasks at a chosen window for this generate only. */
      pinOverrides?: Array<{
        productionTaskId: string;
        start: Date;
        end: Date;
        employeeId: string | null;
        keepPinned?: boolean;
      }>;
      /** Do not persist if the new plan misses the committed delivery date. */
      abortIfMissesCommitment?: boolean;
      /** Authoritative occupancy for this generate (already excluding this PO when provided). */
      existingOccupancy?: OccupancyInterval[];
      /** Reject the plan before persist if it overlaps existingOccupancy / loaded occupancy. */
      validateAgainstOccupancy?: boolean;
      /** Optimize-only: pin unpinned stages notBefore N working days before the commercial target. */
      earlyWindowWorkingDays?: number;
    },
  ) {
    const po = await this.prisma.productionOrder.findUnique({
      where: { id: poId },
      include: {
        product: {
          include: {
            productionProfile: true,
            stageEstimates: { include: { stageDefinition: true, overrideDepartment: true } },
          },
        },
        tasks: { include: { stageDefinition: true } },
        salesOrder: { select: { customerId: true, id: true, status: true } },
      },
    });
    if (!po) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
    }

    const beforeFp = await this.customerFacingFingerprintForPo(poId).catch(() => null);

    try {
      const result = await this.buildAndPersistSchedule(po, userId, opts);
      await this.notifyDealerIfCustomerFacingChanged(poId, beforeFp).catch(() => undefined);
      return result;
    } catch (err) {
      if (err instanceof OccupancyCollisionError) throw err;
      if (err instanceof PastFloorViolationError) {
        throw new ConflictException({
          code: err.code,
          message: err.message,
          productionOrderId: poId,
          violations: err.violations.map((v) => ({
            stageCode: v.stageCode,
            plannedStart: v.plannedStart.toISOString(),
          })),
        });
      }
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      if (opts?.failHard) {
        const message = err instanceof Error ? err.message : 'Scheduling failed';
        throw new ConflictException({
          code: 'SCHEDULE_REPLAN_FAILED',
          message,
        });
      }
      await this.markNeedsReview(poId, userId, err);
      await this.notifyDealerIfCustomerFacingChanged(poId, beforeFp).catch(() => undefined);
      return this.getOrderSchedule(poId);
    }
  }

  private async buildAndPersistSchedule(
    po: Prisma.ProductionOrderGetPayload<{
      include: {
        product: {
          include: {
            productionProfile: true;
            stageEstimates: { include: { stageDefinition: true; overrideDepartment: true } };
          };
        };
        tasks: { include: { stageDefinition: true } };
        salesOrder: { select: { customerId: true, id: true, status: true } };
      };
    }>,
    userId: string,
    opts?: {
      reason?: string;
      mode?: 'forward' | 'backward';
      fromDate?: Date;
      failHard?: boolean;
      pinOverrides?: Array<{
        productionTaskId: string;
        start: Date;
        end: Date;
        employeeId: string | null;
        keepPinned?: boolean;
      }>;
      abortIfMissesCommitment?: boolean;
      existingOccupancy?: OccupancyInterval[];
      validateAgainstOccupancy?: boolean;
      earlyWindowWorkingDays?: number;
    },
  ) {
    const latest = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: po.id },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const priorAllocations = latest
      ? await this.prisma.scheduleAllocation.findMany({ where: { scheduleId: latest.id } })
      : [];
    const pinnedByTask = new Map(
      priorAllocations
        .filter((a) => a.isPinned && a.productionTaskId)
        .map((a) => [a.productionTaskId as string, a]),
    );

    const stageEstimateByDefId = new Map(
      (po.product?.stageEstimates ?? []).map((e) => [e.stageDefinitionId, e]),
    );
    const hasProfile = Boolean(po.product?.productionProfile);
    const hasEstimates = (po.product?.stageEstimates.length ?? 0) > 0;
    const snapshot = await this.prisma.productionOrderWorkflowSnapshot.findUnique({
      where: { productionOrderId: po.id },
      include: { nodes: { include: { materialInputs: true } }, edges: true },
    });
    const snapshotHasAllEstimates = Boolean(
      snapshot?.nodes.length &&
        snapshot.nodes.every(
          (n) => n.isSkipped || (n.estimatedMinutes != null && n.estimatedMinutes > 0),
        ),
    );
    const requiresAdminEstimateReview =
      (!hasProfile || !hasEstimates) && !snapshotHasAllEstimates;

    const stages: PlannerStageInput[] = [];
    const snapByInstance = new Map(
      (snapshot?.nodes ?? [])
        .filter((n) => n.stageInstanceId)
        .map((n) => [n.stageInstanceId!, n]),
    );
    const dependsByInstance = new Map<string, string[]>();
    if (snapshot) {
      const codeByNodeId = new Map(snapshot.nodes.map((n) => [n.id, n.stageCode]));
      for (const node of snapshot.nodes) {
        if (!node.stageInstanceId || node.isSkipped) continue;
        const preds = snapshot.edges
          .filter((e) => e.toSnapshotNodeId === node.id)
          .map((e) => codeByNodeId.get(e.fromSnapshotNodeId)!)
          .filter(Boolean);
        dependsByInstance.set(node.stageInstanceId, preds);
      }
    }

    for (const task of po.tasks) {
      if (!task.stageDefinition || !task.stageDefinitionId) continue;
      const snap = task.stageInstanceId ? snapByInstance.get(task.stageInstanceId) : undefined;
      if (snap?.isSkipped) continue;

      const estimate = stageEstimateByDefId.get(task.stageDefinitionId);
      if (!snap && estimate && !estimate.isRequired) continue;

      const estimatedMinutes = estimate
        ? calculateDurationMinutes({
            quantityScalingMode: estimate.quantityScalingMode,
            quantity: Number(po.quantity),
            setupMinutes: estimate.setupMinutes,
            minutesPerUnit: estimate.minutesPerUnit,
            fixedMinutes: estimate.fixedMinutes,
            batchSize: estimate.batchSize ?? undefined,
            batchMinutes: estimate.batchMinutes ?? undefined,
            maxParallelUnits: estimate.maxParallelUnits ?? undefined,
          })
        : (snap?.estimatedMinutes ??
          task.estimatedMinutes ??
          Math.max(30, Math.round(Number(task.stageDefinition.estimatedHours ?? 1) * 60)));

      const departmentCode =
        estimate?.overrideDepartment?.code ??
        snap?.responsibleDepartmentCode ??
        task.stageDefinition.responsibleDepartment ??
        null;
      const override = opts?.pinOverrides?.find((o) => o.productionTaskId === task.id);
      const prior = pinnedByTask.get(task.id);
      const lockInPlace =
        task.status === 'COMPLETED' ||
        task.status === 'IN_PROGRESS' ||
        task.status === 'BLOCKED';
      const pinStart = prior?.plannedStart ?? (lockInPlace ? task.plannedStart : null);
      const pinEnd = prior?.plannedEnd ?? (lockInPlace ? task.plannedCompletion : null);
      const isPinned = Boolean(prior) || Boolean(lockInPlace && pinStart && pinEnd);

      const schedulingResourceMode =
        snap?.schedulingResourceMode ??
        task.stageDefinition.schedulingResourceMode ??
        'WORKER_CONSTRAINED';
      const resourceSlots = snap?.resourceSlots ?? task.stageDefinition.resourceSlots ?? 1;

      stages.push({
        code: task.stageDefinition.code,
        stageDefinitionId: task.stageDefinitionId,
        dependsOnCodes:
          (task.stageInstanceId ? dependsByInstance.get(task.stageInstanceId) : undefined) ??
          task.stageDefinition.dependsOnCodes,
        estimatedMinutes,
        departmentCode,
        productionTaskId: task.id,
        stageInstanceId: task.stageInstanceId ?? null,
        isPinned,
        pinnedStart: isPinned ? pinStart : null,
        pinnedEnd: isPinned ? pinEnd : null,
        preferredEmployeeId: override?.employeeId ?? task.assignedEmployeeId ?? null,
        schedulingResourceMode,
        resourceSlots,
      });
    }

    if (stages.length === 0) {
      throw new BadRequestException({
        code: 'NO_SCHEDULABLE_STAGES',
        message: 'Production order has no schedulable tasks.',
      });
    }

    const materialReadiness = await this.assessLiveMaterialReadiness(po);
    const consumingRawCodes = (snapshot?.nodes ?? [])
      .filter((n) => !n.isSkipped && n.consumesRawMaterials)
      .map((n) => n.stageCode);
    const frozenInputs = frozenInputsFromSnapshotNodes(snapshot?.nodes ?? []);
    const materialApplied = applyStageOrOrderMaterialFloors({
      stages,
      frozenInputs,
      orderQty: Number(po.quantity) || 1,
      inventory: materialReadiness.inventory,
      orderWideReadyAt: materialReadiness.materialReadyAt,
      consumingStageCodes: consumingRawCodes,
    });
    if (
      (!frozenInputs.length && !materialReadiness.ready && !materialReadiness.materialReadyAt) ||
      (frozenInputs.length > 0 && materialApplied.unknownRequired)
    ) {
      await this.persistUnschedulable(
        po,
        userId,
        nextVersion,
        'MATERIAL_NOT_READY',
        opts?.reason,
        requiresAdminEstimateReview,
      );
      if (po.status === 'PLANNED' || po.status === 'READY') {
        await this.prisma.productionOrder.update({
          where: { id: po.id },
          data: { status: 'WAITING_FOR_MATERIALS' },
        });
      }
      return this.getOrderSchedule(po.id);
    }
    let plannedStages = materialApplied.stages;

    const wipNodes = (snapshot?.nodes ?? []).map((n) => ({
      stageCode: n.stageCode,
      isSkipped: n.isSkipped,
      consumesSemiFinished: n.consumesSemiFinished,
      inventoryTracking: n.inventoryTracking,
      outputInventoryItemId: n.outputInventoryItemId,
      outputQtyPerUnit: n.outputQtyPerUnit != null ? Number(n.outputQtyPerUnit) : null,
      consumeInventoryItemIds: n.consumeInventoryItemIds,
    }));
    const wipLots = (await this.loadWipLots(po.id)).map((lot) => ({
      inventoryItemId: lot.inventoryItemId,
      quantity: Number(lot.quantity),
    }));
    const wipDeps = applyConsumeWipDependencies(
      plannedStages,
      wipNodes,
      wipLots,
      Number(po.quantity) || 1,
    );
    plannedStages = wipDeps.stages;
    if (wipDeps.unknownWip || wipDeps.cyclicWip) {
      await this.persistUnschedulable(
        po,
        userId,
        nextVersion,
        wipDeps.cyclicWip ? 'WIP_DEPENDENCY_CYCLE' : 'WIP_NOT_READY',
        opts?.reason,
        requiresAdminEstimateReview,
      );
      return this.getOrderSchedule(po.id);
    }

    const wipReady = await this.assessWipReadiness(
      po.id,
      Number(po.quantity) || 1,
      snapshot?.nodes,
    );
    if (!wipReady) {
      const producersComplete = await this.wipProducersCompleted(po.id);
      if (producersComplete) {
        await this.persistUnschedulable(
          po,
          userId,
          nextVersion,
          'WIP_NOT_READY',
          opts?.reason,
          requiresAdminEstimateReview,
        );
        return this.getOrderSchedule(po.id);
      }
    }

    const totalMinutes = plannedStages.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const bufferPercent = po.product?.productionProfile?.bufferPercent ?? 10;

    const [workers, occupancyRaw, { calendar, row: calendarRow }] = await Promise.all([
      this.loadWorkers(),
      opts?.existingOccupancy
        ? Promise.resolve(stripOccupancyForOrder(opts.existingOccupancy, po.id))
        : this.loadOccupancy(po.id),
      this.getCalendarDomain(),
    ]);
    const occupancy = opts?.existingOccupancy ? unionOccupancyIntervals(occupancyRaw) : occupancyRaw;
    const wallNow = new Date();
    const floor = resolveSchedulingFloor(calendar, wallNow);
    const now = resolvePlannerNow(calendar, wallNow, opts?.fromDate);

    const taskById = new Map(po.tasks.map((t) => [t.id, t]));
    plannedStages = plannedStages.map((stage) => {
      if (!stage.productionTaskId) return stage;
      const override = opts?.pinOverrides?.find((o) => o.productionTaskId === stage.productionTaskId);
      if (!override) return stage;
      const task = taskById.get(stage.productionTaskId);
      const lockInPlace =
        task?.status === 'COMPLETED' ||
        task?.status === 'IN_PROGRESS' ||
        task?.status === 'BLOCKED';
      if (!lockInPlace && override.start.getTime() < floor.getTime()) {
        return stage;
      }
      return {
        ...stage,
        isPinned: true,
        pinnedStart: override.start,
        pinnedEnd: override.end,
        preferredEmployeeId: override.employeeId ?? stage.preferredEmployeeId,
      };
    });

    const promiseDate = po.committedDeliveryDate ?? po.requiredDeliveryDate;
    const latestCompletionTarget = promiseDate
      ? calendar.latestProductionCompletion(
          promiseDate,
          calendarRow.deliveryBufferWorkingDays ?? 1,
        )
      : null;
    if (opts?.earlyWindowWorkingDays && opts.mode === 'forward') {
      plannedStages = applyNDayFloor(
        plannedStages,
        calendar,
        latestCompletionTarget ?? po.committedDeliveryDate ?? po.requiredDeliveryDate,
        opts.earlyWindowWorkingDays,
        now,
      );
    }

    const orderInput: PlannerOrderInput = {
      id: po.id,
      customerId: po.customerId ?? po.salesOrder?.customerId ?? 'unknown',
      priority: po.priority,
      committedDeliveryDate: po.committedDeliveryDate,
      requestedDeliveryDate: po.requiredDeliveryDate,
      latestCompletionTarget,
      createdAt: po.createdAt,
      stages: plannedStages,
      bufferMinutes: Math.round((bufferPercent / 100) * totalMinutes),
      materialReadyAt: materialApplied.orderMaterialReadyAt,
    };

    const ctx = { calendar, workers, existingOccupancy: occupancy, now };

    const useBackward = opts?.mode ? opts.mode === 'backward' : Boolean(promiseDate);
    const result = useBackward ? backwardSchedule([orderInput], ctx) : forwardSchedule([orderInput], ctx);

    assertNoPastIncompleteAllocations(
      result.allocations.map((alloc) => ({
        plannedStart: alloc.plannedStart,
        isPinned: alloc.isPinned,
        stageCode: alloc.stageCode,
        allocationKey: alloc.productionTaskId ?? alloc.stageCode,
        taskStatus: alloc.productionTaskId
          ? (taskById.get(alloc.productionTaskId)?.status ?? null)
          : null,
      })),
      floor,
    );

    if (opts?.validateAgainstOccupancy) {
      const plannedOcc = plannedAllocationsToOccupancy(po.id, result.allocations);
      const collisions = findOccupancyCollisions(occupancy, plannedOcc);
      if (collisions.length > 0) {
        throw new OccupancyCollisionError(po.id, collisions);
      }
    }

    if (
      latest &&
      ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'].includes(latest.status) &&
      plannedAllocationsMatch(priorAllocations, result.allocations)
    ) {
      const nextReadyAt = materialReadiness.materialReadyAt;
      const nextRisk = materialReadiness.risk || !materialReadiness.ready;
      const prevReady = latest.materialReadyAt?.getTime() ?? null;
      const nextReady = nextReadyAt?.getTime() ?? null;
      if (
        prevReady !== nextReady ||
        Boolean(latest.materialRisk) !== Boolean(nextRisk) ||
        (latest.unschedulableReason ?? null) !== (result.unschedulableReason ?? null)
      ) {
        await this.prisma.productionSchedule.update({
          where: { id: latest.id },
          data: {
            materialReadyAt: nextReadyAt,
            materialRisk: nextRisk,
            unschedulableReason: result.unschedulableReason ?? null,
          },
        });
      }
      return this.getOrderSchedule(po.id);
    }

    const earliestStart =
      result.allocations.length > 0
        ? result.allocations.reduce(
            (min, a) => (a.plannedStart.getTime() < min.getTime() ? a.plannedStart : min),
            result.allocations[0]!.plannedStart,
          )
        : null;

    if (
      opts?.abortIfMissesCommitment &&
      po.committedDeliveryDate &&
      result.earliestCompletion &&
      result.earliestCompletion.getTime() > po.committedDeliveryDate.getTime()
    ) {
      throw new ConflictException({
        code: 'WOULD_MISS_COMMITMENT',
        message: `Resolving this conflict will put ${po.number} at risk.`,
        productionOrderId: po.id,
        orderNumber: po.number,
      });
    }

    const overrideByTask = new Map((opts?.pinOverrides ?? []).map((o) => [o.productionTaskId, o]));

    await this.prisma.$transaction(async (tx) => {
      // Drop prior active versions so calendar/occupancy only see the new plan.
      // (Previously only PROPOSED was superseded, so APPROVED windows stuck on the board.)
      await tx.productionSchedule.updateMany({
        where: {
          productionOrderId: po.id,
          status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] },
        },
        data: { status: 'SUPERSEDED' },
      });

      const suggestedDeliveryDate =
        result.requestedDateFeasible && po.requiredDeliveryDate
          ? po.requiredDeliveryDate
          : result.earliestCompletion;
      const createdSchedule = await tx.productionSchedule.create({
        data: {
          productionOrderId: po.id,
          version: nextVersion,
          status: 'PROPOSED',
          promiseState: 'AWAITING_APPROVAL',
          requestedDeliveryDate: po.requiredDeliveryDate,
          committedDeliveryDate: latest?.committedDeliveryDate ?? po.committedDeliveryDate,
          committedCompletionDate: latest?.committedCompletionDate ?? null,
          requestedDateFeasible: result.requestedDateFeasible,
          planningMode: result.planningMode,
          unschedulableReason: result.unschedulableReason ?? null,
          earliestAvailableDate: result.earliestCompletion,
          suggestedDeliveryDate,
          reason: opts?.reason,
          generatedBy: userId,
          requiresAdminEstimateReview,
          estimateConfidence: requiresAdminEstimateReview ? 'LOW' : 'HIGH',
          estimateReviewStatus: requiresAdminEstimateReview ? 'PENDING' : 'NOT_REQUIRED',
          materialReadyAt: materialReadiness.materialReadyAt,
          materialRisk: materialReadiness.risk || !materialReadiness.ready,
        },
      });

      for (const alloc of result.allocations) {
        await tx.scheduleAllocation.create({
          data: {
            scheduleId: createdSchedule.id,
            productionTaskId: alloc.productionTaskId ?? undefined,
            stageInstanceId: alloc.stageInstanceId ?? undefined,
            resourceType: alloc.resourceType,
            employeeId: alloc.employeeId ?? undefined,
            resourceSlot: alloc.resourceSlot ?? undefined,
            plannedStart: alloc.plannedStart,
            plannedEnd: alloc.plannedEnd,
            estimatedMinutes: alloc.estimatedMinutes,
            isPinned: alloc.productionTaskId
              ? (overrideByTask.get(alloc.productionTaskId)?.keepPinned ?? alloc.isPinned)
              : alloc.isPinned,
          },
        });

        if (alloc.productionTaskId) {
          const task = po.tasks.find((t) => t.id === alloc.productionTaskId);
          await tx.productionTask.update({
            where: { id: alloc.productionTaskId },
            data: {
              plannedStart: alloc.plannedStart,
              plannedCompletion: alloc.plannedEnd,
              estimatedMinutes: alloc.estimatedMinutes,
              ...(overrideByTask.get(alloc.productionTaskId)?.employeeId
                ? { assignedEmployeeId: overrideByTask.get(alloc.productionTaskId)!.employeeId }
                : alloc.employeeId && !task?.assignedEmployeeId
                  ? { assignedEmployeeId: alloc.employeeId }
                  : {}),
            },
          });
        }
      }

      await tx.productionOrder.update({
        where: { id: po.id },
        data: {
          ...(earliestStart ? { plannedStartDate: earliestStart } : {}),
          ...(result.earliestCompletion ? { plannedCompletionDate: result.earliestCompletion } : {}),
        },
      });

      return createdSchedule;
    });

    if (!materialReadiness.ready && (po.status === 'PLANNED' || po.status === 'READY')) {
      await this.prisma.productionOrder.update({
        where: { id: po.id },
        data: { status: 'WAITING_FOR_MATERIALS' },
      });
      if (po.salesOrderId) {
        await this.prisma.salesOrder.updateMany({
          where: {
            id: po.salesOrderId,
            status: { in: ['CONFIRMED', 'READY_FOR_PRODUCTION'] },
          },
          data: { status: 'WAITING_FOR_MATERIALS' },
        });
      }
    }

    await this.debouncedNotify('SCHEDULE_AWAITING_APPROVAL', po.id, () =>
      this.notifications.notifyAdminUsers({
        templateCode: 'SCHEDULE_AWAITING_APPROVAL',
        vars: { number: po.number, date: result.earliestCompletion?.toISOString().slice(0, 10) ?? '' },
        linkUrl: `/production-orders/${po.id}`,
      }),
    );

    return this.getOrderSchedule(po.id);
  }

  async markNeedsReview(poId: string, userId: string | null, reason?: unknown) {
    const message =
      reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Scheduling failed';
    const latest = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: poId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const po = await this.prisma.productionOrder.findUnique({
      where: { id: poId },
      select: { requiredDeliveryDate: true },
    });
    await this.prisma.productionSchedule.create({
      data: {
        productionOrderId: poId,
        version: nextVersion,
        status: 'NEEDS_REVIEW',
        promiseState: 'AT_RISK',
        requestedDeliveryDate: po?.requiredDeliveryDate,
        requestedDateFeasible: false,
        unschedulableReason: message.slice(0, 80),
        reason: message.slice(0, 500),
        generatedBy: userId ?? undefined,
        requiresAdminEstimateReview: true,
        estimateReviewStatus: 'PENDING',
      },
    });

    await this.debouncedNotify('SCHEDULE_AT_RISK', poId, () =>
      this.notifications.notifyAdminUsers({
        templateCode: 'SCHEDULE_AT_RISK',
        vars: { reason: message },
        linkUrl: `/production-orders/${poId}`,
      }),
    );
  }

  async recalculate(poId: string, userId: string, dto: RecalculateDto) {
    const before = await this.snapshotScheduleFingerprint(poId);
    const result = await this.generateForProductionOrder(poId, userId, {
      reason: dto.reason,
      mode: dto.mode,
      failHard: true,
    });
    const after = await this.snapshotScheduleFingerprint(poId);
    return {
      ...result,
      planUnchanged: Boolean(before && after && before === after),
    };
  }

  /**
   * Admin calendar action: move the order’s planned window so it starts on `targetDate`
   * (day-level shift of the latest schedule). Falls back to forward replan when there
   * are no allocations to shift.
   */
  async shiftScheduleToDate(
    poId: string,
    targetDate: Date,
    userId: string,
    opts?: { reason?: string },
  ) {
    const { calendar } = await this.getCalendarDomain();
    const floor = resolveSchedulingFloor(calendar);
    const floorYmd = ymdInTimezone(floor, calendar.timezone);
    const targetYmd = ymdInTimezone(targetDate, calendar.timezone);
    if (targetYmd < floorYmd) {
      return this.generateForProductionOrder(poId, userId, {
        reason: opts?.reason ?? 'Admin moved schedule date',
        mode: 'forward',
        failHard: true,
      });
    }
    const latest = await this.prisma.productionSchedule.findFirst({
      where: {
        productionOrderId: poId,
        status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] },
      },
      orderBy: { version: 'desc' },
      include: { allocations: true },
    });

    const targetDay = new Date(
      Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0),
    );

    if (!latest || latest.allocations.length === 0) {
      await this.prisma.productionOrder.update({
        where: { id: poId },
        data: { requiredDeliveryDate: targetDate },
      });
      return this.generateForProductionOrder(poId, userId, {
        reason: opts?.reason ?? 'Admin moved schedule date',
        mode: 'forward',
        fromDate: targetDay,
        failHard: true,
      });
    }

    const minStart = latest.allocations.reduce(
      (min, a) => (a.plannedStart.getTime() < min.getTime() ? a.plannedStart : min),
      latest.allocations[0]!.plannedStart,
    );
    const minDay = new Date(
      Date.UTC(minStart.getUTCFullYear(), minStart.getUTCMonth(), minStart.getUTCDate(), 0, 0, 0, 0),
    );
    const deltaMs = targetDay.getTime() - minDay.getTime();

    if (deltaMs === 0) {
      return this.getOrderSchedule(poId);
    }

    const nextVersion = latest.version + 1;
    let earliestStart: Date | null = null;
    let latestEnd: Date | null = null;

    await this.prisma.$transaction(async (tx) => {
      await tx.productionSchedule.updateMany({
        where: {
          productionOrderId: poId,
          status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] },
        },
        data: { status: 'SUPERSEDED' },
      });

      const created = await tx.productionSchedule.create({
        data: {
          productionOrderId: poId,
          version: nextVersion,
          status: 'PROPOSED',
          promiseState: 'AWAITING_APPROVAL',
          requestedDeliveryDate: latest.requestedDeliveryDate
            ? new Date(latest.requestedDeliveryDate.getTime() + deltaMs)
            : targetDate,
          reason: opts?.reason ?? 'Admin moved schedule date',
          generatedBy: userId,
          requiresAdminEstimateReview: latest.requiresAdminEstimateReview,
          estimateConfidence: latest.estimateConfidence,
          estimateReviewStatus: latest.estimateReviewStatus,
        },
      });

      for (const alloc of latest.allocations) {
        const plannedStart = new Date(alloc.plannedStart.getTime() + deltaMs);
        const plannedEnd = new Date(alloc.plannedEnd.getTime() + deltaMs);
        if (!earliestStart || plannedStart.getTime() < earliestStart.getTime()) earliestStart = plannedStart;
        if (!latestEnd || plannedEnd.getTime() > latestEnd.getTime()) latestEnd = plannedEnd;

        await tx.scheduleAllocation.create({
          data: {
            scheduleId: created.id,
            productionTaskId: alloc.productionTaskId ?? undefined,
            stageInstanceId: alloc.stageInstanceId ?? undefined,
            resourceType: alloc.resourceType,
            employeeId: alloc.employeeId ?? undefined,
            departmentId: alloc.departmentId ?? undefined,
            plannedStart,
            plannedEnd,
            estimatedMinutes: alloc.estimatedMinutes,
            isPinned: alloc.isPinned,
            manuallyAdjusted: true,
          },
        });

        if (alloc.productionTaskId) {
          await tx.productionTask.update({
            where: { id: alloc.productionTaskId },
            data: {
              plannedStart,
              plannedCompletion: plannedEnd,
            },
          });
        }
      }

      await tx.productionOrder.update({
        where: { id: poId },
        data: {
          requiredDeliveryDate: latestEnd ?? targetDate,
          ...(earliestStart ? { plannedStartDate: earliestStart } : {}),
          ...(latestEnd ? { plannedCompletionDate: latestEnd } : {}),
        },
      });

      await tx.productionSchedule.update({
        where: { id: created.id },
        data: {
          earliestAvailableDate: latestEnd,
          suggestedDeliveryDate: latestEnd,
          requestedDeliveryDate: latestEnd ?? targetDate,
        },
      });
    });

    await this.audit(userId, 'schedule.shift-date', 'ProductionOrder', poId, {
      targetDate: targetDay.toISOString(),
      deltaMs,
      reason: opts?.reason ?? null,
    });

    return this.getOrderSchedule(poId);
  }

  async approve(poId: string, version: number, userId: string) {
    const schedule = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: poId },
      orderBy: { version: 'desc' },
    });
    if (!schedule) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'No schedule to approve.' });
    }
    if (schedule.version !== version) {
      throw new ConflictException({
        code: 'SCHEDULE_STALE',
        message: `Schedule has changed since you loaded it (current version ${schedule.version}).`,
        currentVersion: schedule.version,
      });
    }
    if (schedule.status === 'APPROVED') {
      return this.getOrderSchedule(poId);
    }
    if (schedule.status !== 'PROPOSED' && schedule.status !== 'NEEDS_REVIEW') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot approve a schedule in status ${schedule.status}.`,
      });
    }

    const beforeFp = await this.customerFacingFingerprintForPo(poId).catch(() => null);

    const allocations = await this.prisma.scheduleAllocation.findMany({ where: { scheduleId: schedule.id } });
    const latestEnd =
      allocations.length > 0
        ? allocations.reduce((max, a) => (a.plannedEnd.getTime() > max.getTime() ? a.plannedEnd : max), allocations[0]!.plannedEnd)
        : null;
    const earliestStart =
      allocations.length > 0
        ? allocations.reduce((min, a) => (a.plannedStart.getTime() < min.getTime() ? a.plannedStart : min), allocations[0]!.plannedStart)
        : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.productionSchedule.updateMany({
        where: { productionOrderId: poId, status: 'APPROVED', id: { not: schedule.id } },
        data: { status: 'SUPERSEDED' },
      });
      await tx.productionSchedule.update({
        where: { id: schedule.id },
        data: {
          status: 'APPROVED',
          promiseState: mapPromiseState({
            scheduleStatus: 'APPROVED',
            late: isScheduleLate(
              latestEnd,
              schedule.requestedDeliveryDate,
              schedule.committedDeliveryDate,
            ),
            atRisk: schedule.materialRisk,
          }),
          approvedAt: new Date(),
          approvedById: userId,
          ...(latestEnd ? { committedCompletionDate: latestEnd } : {}),
          ...(schedule.requestedDateFeasible && schedule.requestedDeliveryDate
            ? { committedDeliveryDate: schedule.requestedDeliveryDate }
            : latestEnd
              ? { committedDeliveryDate: schedule.suggestedDeliveryDate ?? latestEnd }
              : {}),
        },
      });
      await tx.productionOrder.update({
        where: { id: poId },
        data: {
          ...(latestEnd ? { committedDeliveryDate: latestEnd, plannedCompletionDate: latestEnd } : {}),
          ...(earliestStart ? { plannedStartDate: earliestStart } : {}),
        },
      });
    });

    const po = await this.prisma.productionOrder.findUnique({
      where: { id: poId },
      select: { number: true, customerId: true, salesOrder: { select: { customerId: true } } },
    });
    const customerId = po?.customerId ?? po?.salesOrder?.customerId ?? null;
    if (customerId) {
      await this.debouncedNotify('DELIVERY_DATE_CONFIRMED', poId, () =>
        this.notifications.notifyCustomerUsers(customerId, {
          templateCode: 'DELIVERY_DATE_CONFIRMED',
          vars: { number: po?.number ?? '', date: latestEnd?.toISOString().slice(0, 10) ?? '' },
          linkUrl: `/sales-orders`,
        }),
      );
    }

    const today = new Date();
    const startingToday = allocations.filter((a) => a.employeeId && isSameUtcDay(a.plannedStart, today));
    for (const alloc of startingToday) {
      await this.notifications
        .sendFromTemplate({
          templateCode: 'TASK_SCHEDULED_TODAY',
          channel: 'IN_APP',
          to: { userId: alloc.employeeId! },
          vars: { orderNumber: po?.number ?? '' },
          linkUrl: alloc.productionTaskId ? `/tasks/${alloc.productionTaskId}` : undefined,
        })
        .catch(() => undefined);
    }

    await this.audit(userId, 'schedule.approve', 'ProductionSchedule', schedule.id, { version });
    await this.notifyDealerIfCustomerFacingChanged(poId, beforeFp, { alreadySentConfirmed: true }).catch(
      () => undefined,
    );
    return this.getOrderSchedule(poId);
  }

  // ── Allocation edits ─────────────────────────────────────────────────────

  async patchAllocation(
    poId: string,
    allocationId: string,
    dto: PatchAllocationDto,
    user: AuthUser,
  ) {
    const schedule = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: poId },
      orderBy: { version: 'desc' },
    });
    if (!schedule) throw new NotFoundException({ code: 'NOT_FOUND', message: 'No schedule found.' });
    if (schedule.version !== dto.version) {
      throw new ConflictException({
        code: 'SCHEDULE_STALE',
        message: `Schedule has changed since you loaded it (current version ${schedule.version}).`,
        currentVersion: schedule.version,
      });
    }

    const allAllocations = await this.prisma.scheduleAllocation.findMany({
      where: { scheduleId: schedule.id },
      include: { productionTask: { include: { stageDefinition: true } } },
    });
    const target = allAllocations.find((a) => a.id === allocationId);
    if (!target) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Allocation not found.' });

    const nextStart = dto.plannedStart ? new Date(dto.plannedStart) : target.plannedStart;
    const nextEnd = dto.plannedEnd ? new Date(dto.plannedEnd) : target.plannedEnd;
    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime()) || nextEnd <= nextStart) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid plannedStart/plannedEnd.' });
    }
    const nextEmployeeId = dto.employeeId !== undefined ? dto.employeeId : target.employeeId;
    const nextPinned = dto.isPinned !== undefined ? dto.isPinned : target.isPinned;

    const { calendar } = await this.getCalendarDomain();
    const toValidate: AllocationToValidate[] = allAllocations.map((a) => {
      const isTarget = a.id === allocationId;
      return {
        key: a.id,
        orderId: poId,
        stageCode: a.productionTask?.stageDefinition?.code ?? a.id,
        dependsOnCodes: a.productionTask?.stageDefinition?.dependsOnCodes ?? [],
        employeeId: isTarget ? (nextEmployeeId ?? null) : a.employeeId,
        plannedStart: isTarget ? nextStart : a.plannedStart,
        plannedEnd: isTarget ? nextEnd : a.plannedEnd,
        isPinned: isTarget ? nextPinned : a.isPinned,
        previousPinnedStart: a.isPinned ? a.plannedStart : null,
        previousPinnedEnd: a.isPinned ? a.plannedEnd : null,
      };
    });

    const validation = validateSchedule({ allocations: toValidate, calendar });
    const occupancyIssues: Array<{ code: string; severity: 'CONFLICT'; message: string }> = [];

    if (nextEmployeeId) {
      const stageDefId = target.productionTask?.stageDefinitionId ?? target.productionTask?.stageDefinition?.id;
      if (stageDefId) {
        const skill = await this.prisma.workerSkill.findFirst({
          where: { userId: nextEmployeeId, stageDefinitionId: stageDefId, isActive: true },
        });
        const worker = await this.prisma.user.findFirst({
          where: { id: nextEmployeeId, isActive: true, archivedAt: null },
        });
        if (!skill || !worker) {
          occupancyIssues.push({
            code: 'WORKER_NOT_ELIGIBLE',
            severity: 'CONFLICT',
            message: 'Assigned worker is not skilled or not active for this stage.',
          });
        }
      }

      const factoryOccupancy = await this.loadOccupancy(poId);
      const overlapFactory = factoryOccupancy.some(
        (iv) =>
          iv.employeeId === nextEmployeeId &&
          iv.allocationId !== allocationId &&
          iv.start.getTime() < nextEnd.getTime() &&
          nextStart.getTime() < iv.end.getTime(),
      );
      const overlapSame = allAllocations.some(
        (a) =>
          a.id !== allocationId &&
          a.employeeId === nextEmployeeId &&
          a.plannedStart.getTime() < nextEnd.getTime() &&
          nextStart.getTime() < a.plannedEnd.getTime(),
      );
      if (overlapFactory || overlapSame) {
        occupancyIssues.push({
          code: 'WORKER_DOUBLE_BOOKED',
          severity: 'CONFLICT',
          message: 'This worker already has overlapping scheduled work.',
        });
      }
    }

    const mergedSeverity =
      occupancyIssues.length > 0 || validation.severity === 'CONFLICT'
        ? 'CONFLICT'
        : validation.severity;
    if (mergedSeverity === 'CONFLICT') {
      const canOverride = Boolean(dto.override) && user.permissions.includes('schedule.override');
      if (!canOverride) {
        throw new ConflictException({
          code: 'SCHEDULE_CONFLICT',
          message: 'This change conflicts with the schedule. Retry with override to force it.',
          issues: [...validation.issues, ...occupancyIssues],
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.scheduleAllocation.update({
        where: { id: allocationId },
        data: {
          plannedStart: nextStart,
          plannedEnd: nextEnd,
          employeeId: nextEmployeeId ?? null,
          isPinned: nextPinned,
          manuallyAdjusted: true,
        },
      });
      if (target.productionTaskId) {
        await tx.productionTask.update({
          where: { id: target.productionTaskId },
          data: {
            plannedStart: nextStart,
            plannedCompletion: nextEnd,
            ...(nextEmployeeId ? { assignedEmployeeId: nextEmployeeId } : {}),
          },
        });
      }
      await tx.productionSchedule.update({
        where: { id: schedule.id },
        data: {
          ...(validation.severity !== 'VALID' ? { materialRisk: schedule.materialRisk } : {}),
        },
      });
    });

    await this.audit(user.id, 'schedule.allocation.patch', 'ScheduleAllocation', allocationId, {
      reason: dto.reason,
      override: dto.override,
      severity: validation.severity,
    });

    if (validation.severity !== 'VALID' || occupancyIssues.length > 0) {
      const conflict = occupancyIssues.length > 0 || validation.severity === 'CONFLICT';
      await this.debouncedNotify(
        conflict ? 'SCHEDULE_CONFLICT' : 'SCHEDULE_AT_RISK',
        poId,
        () =>
          this.notifications.notifyAdminUsers({
            templateCode: conflict ? 'SCHEDULE_CONFLICT' : 'SCHEDULE_AT_RISK',
            vars: {
              reason: [...validation.issues, ...occupancyIssues].map((i) => i.message).join('; '),
            },
            linkUrl: `/production-orders/${poId}`,
          }),
      );
    }

    return this.getOrderSchedule(poId);
  }

  async setPin(poId: string, dto: PinDto, pin: boolean, user: AuthUser) {
    const schedule = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: poId },
      orderBy: { version: 'desc' },
    });
    if (!schedule) throw new NotFoundException({ code: 'NOT_FOUND', message: 'No schedule found.' });
    if (schedule.version !== dto.version) {
      throw new ConflictException({
        code: 'SCHEDULE_STALE',
        message: `Schedule has changed since you loaded it (current version ${schedule.version}).`,
        currentVersion: schedule.version,
      });
    }
    if (!dto.allocationId && !dto.taskId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'allocationId or taskId is required.' });
    }

    const allocation = await this.prisma.scheduleAllocation.findFirst({
      where: {
        scheduleId: schedule.id,
        ...(dto.allocationId ? { id: dto.allocationId } : { productionTaskId: dto.taskId }),
      },
    });
    if (!allocation) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Allocation not found.' });

    await this.prisma.scheduleAllocation.update({
      where: { id: allocation.id },
      data: { isPinned: pin, manuallyAdjusted: true },
    });
    await this.audit(
      user.id,
      pin ? 'schedule.allocation.pin' : 'schedule.allocation.unpin',
      'ScheduleAllocation',
      allocation.id,
      null,
    );
    return this.getOrderSchedule(poId);
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  private serializeSchedule(
    schedule: Prisma.ProductionScheduleGetPayload<{
      include: {
        allocations: {
          include: {
            productionTask: { select: { id: true; name: true; number: true; status: true; stageDefinitionId: true } };
            employee: { select: { id: true; firstName: true; lastName: true } };
            department: { select: { id: true; code: true; nameEn: true; nameAr: true } };
          };
        };
      };
    }>,
    presentation?: { calendar: WorkingCalendar; bufferWorkingDays: number },
  ) {
    const bufferWorkingDays = presentation?.bufferWorkingDays ?? 1;
    return {
      id: schedule.id,
      version: schedule.version,
      status: schedule.status,
      promiseState: schedule.promiseState,
      requestedDeliveryDate: schedule.requestedDeliveryDate,
      requestedDateFeasible: schedule.requestedDateFeasible,
      planningMode: schedule.planningMode,
      unschedulableReason: schedule.unschedulableReason,
      earliestAvailableDate: schedule.earliestAvailableDate,
      suggestedDeliveryDate: schedule.suggestedDeliveryDate,
      committedCompletionDate: schedule.committedCompletionDate,
      committedDeliveryDate: schedule.committedDeliveryDate,
      reason: schedule.reason,
      generatedAt: schedule.generatedAt,
      approvedAt: schedule.approvedAt,
      approvedById: schedule.approvedById,
      materialRisk: schedule.materialRisk,
      requiresAdminEstimateReview: schedule.requiresAdminEstimateReview,
      estimateConfidence: schedule.estimateConfidence,
      materialReadyAt: schedule.materialReadyAt,
      productionDeadline: presentation
        ? productionDeadlineIso(
            presentation.calendar,
            bufferWorkingDays,
            schedule.requestedDeliveryDate,
            schedule.committedDeliveryDate,
          )
        : null,
      deliveryBufferWorkingDays: presentation ? bufferWorkingDays : null,
      allocations: schedule.allocations.map((a) => ({
        id: a.id,
        productionTaskId: a.productionTaskId,
        task: a.productionTask,
        productionTask: a.productionTask,
        resourceType: a.resourceType,
        employeeId: a.employeeId,
        employee: a.employee,
        department: a.department,
        plannedStart: a.plannedStart,
        plannedEnd: a.plannedEnd,
        estimatedMinutes: a.estimatedMinutes,
        isPinned: a.isPinned,
        manuallyAdjusted: a.manuallyAdjusted,
        resourceSlot: a.resourceSlot,
      })),
    };
  }

  async getOrderSchedule(poId: string) {
    const po = await this.prisma.productionOrder.findUnique({
      where: { id: poId },
      select: {
        id: true,
        number: true,
        status: true,
        requiredDeliveryDate: true,
        committedDeliveryDate: true,
        priority: true,
        customerId: true,
      },
    });
    if (!po) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });

    const schedule = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: poId },
      orderBy: { version: 'desc' },
      include: {
        allocations: {
          include: {
            productionTask: {
              select: { id: true, name: true, number: true, status: true, stageDefinitionId: true },
            },
            employee: { select: { id: true, firstName: true, lastName: true } },
            department: { select: { id: true, code: true, nameEn: true, nameAr: true } },
          },
          orderBy: { plannedStart: 'asc' },
        },
      },
    });

    const { row, calendar } = await this.getCalendarDomain();
    const bufferWorkingDays = row.deliveryBufferWorkingDays ?? 1;
    const risk = this.classifyLoadedSchedule(po, schedule);
    const promiseState = mapPromiseState({
      scheduleStatus: (schedule?.status as 'DRAFT') ?? 'DRAFT',
      productionOrderStatus: po.status as 'PLANNED',
      atRisk: risk.primaryStatus === 'AT_RISK' || risk.primaryStatus === 'BLOCKED',
      late: risk.primaryStatus === 'LATE',
    });

    return {
      productionOrder: po,
      promiseState,
      riskStatus: risk.primaryStatus,
      stillAtRisk: risk.contributesToMayBeLate,
      schedule: schedule
        ? this.serializeSchedule(schedule, { calendar, bufferWorkingDays })
        : null,
    };
  }

  async getOwnOrderSchedule(poId: string, user: AuthUser) {
    if (!user.customerId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Dealer schedule requires a customer account.' });
    }
    const po = await this.prisma.productionOrder.findFirst({
      where: {
        id: poId,
        OR: [{ customerId: user.customerId }, { salesOrder: { customerId: user.customerId } }],
      },
      select: {
        id: true,
        number: true,
        status: true,
        requiredDeliveryDate: true,
        committedDeliveryDate: true,
        salesOrder: {
          select: {
            id: true,
            status: true,
            requiredDeliveryDate: true,
            quotation: { select: { request: { select: { status: true } } } },
            deliveries: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { status: true, deliveryDate: true },
            },
          },
        },
      },
    });
    if (!po) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });

    const schedule = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: poId },
      orderBy: { version: 'desc' },
    });
    const { calendar } = await this.getCalendarDomain();
    const tz = calendar.timezone;
    const todayYmd = ymdInTimezone(new Date(), tz);
    const delivery = po.salesOrder?.deliveries[0] ?? null;
    const requested = schedule?.requestedDeliveryDate ?? po.requiredDeliveryDate ?? po.salesOrder?.requiredDeliveryDate ?? null;
    const suggested = schedule?.suggestedDeliveryDate ?? null;
    const committed = schedule?.committedDeliveryDate ?? po.committedDeliveryDate ?? null;
    const projected = schedule?.earliestAvailableDate ?? schedule?.suggestedDeliveryDate ?? null;
    const projectedDealer = this.projectDealerDelivery({
      salesOrderStatus: po.salesOrder?.status,
      productionOrder: po,
      schedule,
      delivery,
      requested,
      suggested,
      committed,
      projected,
      tz,
      todayYmd,
      requestStatus: po.salesOrder?.quotation?.request?.status,
    });

    return {
      productionOrderId: po.id,
      salesOrderId: po.salesOrder?.id ?? null,
      number: po.number,
      promiseState: projectedDealer.promiseState,
      requestedDeliveryDate: requested,
      suggestedDeliveryDate: suggested,
      committedDeliveryDate: committed,
      projectedDeliveryDate: projectedDealer.view.projectedYmd ? projected : null,
      plannedDeliveryDate: projectedDealer.planned,
      actualDeliveryDate: projectedDealer.actual,
      calendarDate: projectedDealer.view.calendarDate,
      customerStatus: projectedDealer.view.customerStatus,
      requiresDealerAttention: projectedDealer.view.requiresDealerAttention,
      actionRequired: projectedDealer.view.actionRequired,
      customerSafeReason: projectedDealer.view.customerSafeReason,
      compactDates: projectedDealer.view.compactDates,
      delayDays: projectedDealer.view.delayDays,
      scheduleUpdating: projectedDealer.view.scheduleUpdating,
      canUpdateDeliveryDate: projectedDealer.policy.canUpdateDirect,
      canRequestDateChange: projectedDealer.policy.canChangeRequest,
      dateChangeLocked: projectedDealer.policy.locked,
      dateChangeReason: projectedDealer.policy.reason,
    };
  }

  async listOwnDeliveries(user: AuthUser, range?: { from?: string; to?: string }) {
    if (!user.customerId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Own deliveries require a customer account.' });
    }
    const { calendar } = await this.getCalendarDomain();
    const tz = calendar.timezone;
    const todayYmd = ymdInTimezone(new Date(), tz);

    const salesOrders = await this.prisma.salesOrder.findMany({
      where: { customerId: user.customerId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        status: true,
        requiredDeliveryDate: true,
        deliveryAddress: true,
        projectName: true,
        quotation: { select: { request: { select: { status: true } } } },
        lines: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: {
            quantity: true,
            description: true,
            product: { select: { nameEn: true, nameAr: true, nameHe: true, imageUrl: true } },
          },
        },
        productionOrders: {
          where: { archivedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            number: true,
            status: true,
            requiredDeliveryDate: true,
            committedDeliveryDate: true,
            quantity: true,
            productDescription: true,
            product: { select: { nameEn: true, nameAr: true, nameHe: true, imageUrl: true } },
            schedules: { orderBy: { version: 'desc' }, take: 1 },
          },
        },
        deliveries: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { status: true, deliveryDate: true },
        },
      },
    });

    const rows = salesOrders.map((so) => {
      const po = so.productionOrders[0] ?? null;
      const schedule = po?.schedules[0] ?? null;
      const delivery = so.deliveries[0] ?? null;
      const requested =
        schedule?.requestedDeliveryDate ?? po?.requiredDeliveryDate ?? so.requiredDeliveryDate ?? null;
      const suggested = schedule?.suggestedDeliveryDate ?? null;
      const committed = schedule?.committedDeliveryDate ?? po?.committedDeliveryDate ?? null;
      const projected = schedule?.earliestAvailableDate ?? schedule?.suggestedDeliveryDate ?? null;
      const projectedDealer = this.projectDealerDelivery({
        salesOrderStatus: so.status,
        productionOrder: po,
        schedule,
        delivery,
        requested,
        suggested,
        committed,
        projected,
        tz,
        todayYmd,
        requestStatus: so.quotation?.request?.status,
      });
      const line = so.lines[0];
      const product = po?.product ?? line?.product ?? null;
      const fallbackName = po?.productDescription ?? line?.description ?? so.projectName ?? so.number;
      return {
        id: so.id,
        salesOrderId: so.id,
        salesOrderNumber: so.number,
        productionOrderId: po?.id ?? null,
        productionOrderNumber: po?.number ?? null,
        productName: {
          name: product?.nameEn ?? fallbackName,
          nameEn: product?.nameEn ?? fallbackName,
          nameAr: product?.nameAr ?? null,
          nameHe: product?.nameHe ?? null,
        },
        imageUrl: product?.imageUrl ?? null,
        quantity: po?.quantity != null ? Number(po.quantity) : line?.quantity != null ? Number(line.quantity) : null,
        deliveryAddress: so.deliveryAddress,
        requestedDeliveryDate: requested,
        suggestedDeliveryDate: suggested,
        committedDeliveryDate: committed,
        projectedDeliveryDate: projectedDealer.view.projectedYmd ? projected : null,
        plannedDeliveryDate: projectedDealer.planned,
        actualDeliveryDate: projectedDealer.actual,
        calendarDate: projectedDealer.view.calendarDate,
        customerStatus: projectedDealer.view.customerStatus,
        requiresDealerAttention: projectedDealer.view.requiresDealerAttention,
        actionRequired: projectedDealer.view.actionRequired,
        customerSafeReason: projectedDealer.view.customerSafeReason,
        compactDates: projectedDealer.view.compactDates,
        delayDays: projectedDealer.view.delayDays,
        scheduleUpdating: projectedDealer.view.scheduleUpdating,
        canUpdateDeliveryDate: projectedDealer.policy.canUpdateDirect,
        canRequestDateChange: projectedDealer.policy.canChangeRequest,
        dateChangeLocked: projectedDealer.policy.locked,
        dateChangeReason: projectedDealer.policy.reason,
      };
    });

    const summary = summarizeDealerDeliveries(rows, todayYmd);
    const from = range?.from?.slice(0, 10);
    const to = range?.to?.slice(0, 10);
    const data = filterByCalendarDateRange(rows, from, to);

    return { summary, data, todayYmd };
  }

  private async customerFacingFingerprintForPo(poId: string): Promise<string | null> {
    const { calendar } = await this.getCalendarDomain();
    const tz = calendar.timezone;
    const todayYmd = ymdInTimezone(new Date(), tz);
    const po = await this.prisma.productionOrder.findUnique({
      where: { id: poId },
      select: {
        status: true,
        requiredDeliveryDate: true,
        committedDeliveryDate: true,
        salesOrder: {
          select: {
            status: true,
            requiredDeliveryDate: true,
            quotation: { select: { request: { select: { status: true } } } },
            deliveries: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { status: true, deliveryDate: true },
            },
          },
        },
      },
    });
    if (!po) return null;
    const schedule = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: poId },
      orderBy: { version: 'desc' },
    });
    const delivery = po.salesOrder?.deliveries[0] ?? null;
    const requested = schedule?.requestedDeliveryDate ?? po.requiredDeliveryDate ?? po.salesOrder?.requiredDeliveryDate ?? null;
    const suggested = schedule?.suggestedDeliveryDate ?? null;
    const committed = schedule?.committedDeliveryDate ?? po.committedDeliveryDate ?? null;
    const projected = schedule?.earliestAvailableDate ?? schedule?.suggestedDeliveryDate ?? null;
    const projectedDealer = this.projectDealerDelivery({
      salesOrderStatus: po.salesOrder?.status,
      productionOrder: po,
      schedule,
      delivery,
      requested,
      suggested,
      committed,
      projected,
      tz,
      todayYmd,
      requestStatus: po.salesOrder?.quotation?.request?.status,
    });
    return customerFacingFingerprint({
      committedYmd: toCalendarYmd(committed, tz),
      suggestedYmd: toCalendarYmd(suggested, tz),
      projectedYmd: toCalendarYmd(projected, tz),
      customerStatus: projectedDealer.view.customerStatus,
      actualYmd: toCalendarYmd(projectedDealer.actual, tz),
    });
  }

  private async notifyDealerIfCustomerFacingChanged(
    poId: string,
    previousFingerprint: string | null,
    opts?: { alreadySentConfirmed?: boolean },
  ) {
    const afterFp = await this.customerFacingFingerprintForPo(poId);
    if (!shouldNotifyCustomerFacing(previousFingerprint, afterFp)) return;

    const po = await this.prisma.productionOrder.findUnique({
      where: { id: poId },
      select: {
        number: true,
        customerId: true,
        committedDeliveryDate: true,
        salesOrder: { select: { id: true, customerId: true } },
      },
    });
    const customerId = po?.customerId ?? po?.salesOrder?.customerId ?? null;
    if (!customerId || !po) return;

    const schedule = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: poId },
      orderBy: { version: 'desc' },
      select: {
        committedDeliveryDate: true,
        suggestedDeliveryDate: true,
        earliestAvailableDate: true,
      },
    });
    const { calendar } = await this.getCalendarDomain();
    const tz = calendar.timezone;
    const todayYmd = ymdInTimezone(new Date(), tz);
    const committedYmd = toCalendarYmd(schedule?.committedDeliveryDate ?? po.committedDeliveryDate, tz);
    const suggestedYmd = toCalendarYmd(schedule?.suggestedDeliveryDate, tz);
    const projectedYmd = toCalendarYmd(schedule?.earliestAvailableDate ?? schedule?.suggestedDeliveryDate, tz);
    const status = (afterFp ?? '').split('|')[3] as
      | 'AWAITING_CONFIRMATION'
      | 'CONFIRMED_ON_TRACK'
      | 'IN_PRODUCTION'
      | 'READY_FOR_DELIVERY'
      | 'OUT_FOR_DELIVERY'
      | 'MAY_BE_DELAYED'
      | 'DELAYED'
      | 'DELIVERED'
      | 'CANCELLED';
    const preferred = selectDealerNotifyTemplate(status, opts);
    if (!preferred) return;

    const date = committedYmd ?? projectedYmd ?? suggestedYmd ?? todayYmd;
    const existing = await this.prisma.notificationTemplate.findUnique({
      where: { code: preferred },
      select: { code: true },
    }).catch(() => null);
    const templateCode = existing?.code ?? 'DELIVERY_DATE_UPDATED';

    await this.notifications
      .notifyCustomerUsers(customerId, {
        templateCode,
        vars: { orderNumber: po.number, number: po.number, date },
        linkUrl: `/sales-orders/${po.salesOrder?.id ?? ''}`,
      })
      .catch(() => undefined);
  }

  // ── Dealer date changes ──────────────────────────────────────────────────

  async dealerDateChange(poId: string, dto: DealerDateChangeDto, user: AuthUser) {
    const po = await this.prisma.productionOrder.findFirst({
      where: { id: poId },
      include: { salesOrder: { select: { customerId: true } } },
    });
    if (!po) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
    if (!assertCustomerOwns(user, po.customerId ?? po.salesOrder?.customerId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your production order.' });
    }

    const requested = new Date(dto.requestedDeliveryDate);
    if (Number.isNaN(requested.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid requestedDeliveryDate.' });
    }

    const schedule = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: poId },
      orderBy: { version: 'desc' },
    });

    // Factory admins (no customerId) may force a delivery-date change + replan.
    // Dealer portal users stay on the dealer change policy.
    if (!user.customerId) {
      const scope = `schedule.admin-date:${poId}`;
      const { result } = await this.idempotency.once(
        scope,
        dto.idempotencyKey,
        { userId: user.id, entityId: poId },
        async () => {
          // Move the planned window onto the selected calendar day (what the
          // admin scheduling UI means by “change schedule date”).
          await this.shiftScheduleToDate(poId, requested, user.id, {
            reason: dto.reason ?? 'Admin updated schedule date',
          });
          return { ok: true as const, action: 'updated' as const };
        },
      );
      return result;
    }

    const promiseState = mapPromiseState({
      scheduleStatus: schedule?.status ?? 'DRAFT',
      productionOrderStatus: po.status,
    });
    const policy = resolveDealerChangePolicy({ promiseState, productionOrderStatus: po.status });
    if (policy.locked) {
      throw new ForbiddenException({ code: 'DATE_CHANGE_LOCKED', message: policy.reason });
    }

    const scope = `schedule.dealer-date:${poId}`;
    const { result } = await this.idempotency.once(
      scope,
      dto.idempotencyKey,
      { userId: user.id, entityId: poId },
      async () => {
        if (policy.canUpdateDirect) {
          await this.prisma.productionOrder.update({
            where: { id: poId },
            data: { requiredDeliveryDate: requested },
          });
          if (schedule) {
            await this.prisma.productionSchedule.update({
              where: { id: schedule.id },
              data: { requestedDeliveryDate: requested },
            });
          }
          await this.debouncedNotify('DEALER_DATE_UPDATED', poId, () =>
            this.notifications.notifyAdminUsers({
              templateCode: 'DEALER_DATE_UPDATED',
              vars: { number: po.number, date: requested.toISOString().slice(0, 10) },
              linkUrl: `/production-orders/${poId}`,
            }),
          );
          await this.generateForProductionOrder(poId, user.id, {
            reason: 'Dealer updated preferred delivery date',
          }).catch(() => undefined);
          return { ok: true as const, action: 'updated' as const };
        }

        await this.audit(user.id, 'schedule.dealer-change-request', 'ProductionOrder', poId, {
          requestedDeliveryDate: requested.toISOString(),
          reason: dto.reason ?? null,
        });
        await this.debouncedNotify('DEALER_DATE_CHANGE_REQUEST', poId, () =>
          this.notifications.notifyAdminUsers({
            templateCode: 'DEALER_DATE_CHANGE_REQUEST',
            vars: { number: po.number, date: requested.toISOString().slice(0, 10) },
            linkUrl: `/production-orders/${poId}`,
          }),
        );
        return { ok: true as const, action: 'requested' as const };
      },
    );
    return result;
  }

  // ── Admin dashboards ─────────────────────────────────────────────────────

  /** Per-employee booked minutes (used by internal tooling / debugging). */
  async listEmployeeCapacity(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const allocations = await this.prisma.scheduleAllocation.findMany({
      where: {
        plannedStart: { lt: toDate },
        plannedEnd: { gt: fromDate },
        schedule: { status: { in: ['APPROVED', 'PROPOSED'] } },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { code: true, nameEn: true, nameAr: true } },
          },
        },
        department: { select: { code: true, nameEn: true, nameAr: true } },
      },
    });

    const byKey = new Map<
      string,
      { employeeId: string | null; name: string; departmentCode: string | null; minutes: number }
    >();
    for (const a of allocations) {
      const key = a.employeeId ?? `dept:${a.departmentId ?? 'unassigned'}`;
      const minutes = Math.max(0, (a.plannedEnd.getTime() - a.plannedStart.getTime()) / 60_000);
      const name = a.employee
        ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
        : (a.department?.nameEn ?? 'Unassigned');
      const existing = byKey.get(key);
      if (existing) {
        existing.minutes += minutes;
      } else {
        byKey.set(key, {
          employeeId: a.employeeId,
          name,
          departmentCode: a.employee?.department?.code ?? a.department?.code ?? null,
          minutes,
        });
      }
    }

    return { data: [...byKey.values()].sort((a, b) => b.minutes - a.minutes) };
  }

  /**
   * Stage rows with booked vs. eligible WorkerSkill (or finite resource slots) minutes.
   * Allocated minutes are intersections with factory-local working intervals
   * (nights, lunch, and closed days are excluded). Always includes every active
   * stage (zero-skill stages stay visible). Does not clamp allocated to available.
   */
  async listCapacity(
    from: string,
    to: string,
    options: { granularity?: 'day' | 'range'; includeWorkers?: boolean } = {},
  ) {
    const fromParts = parseYmd(from);
    const toParts = parseYmd(to);
    if (!fromParts || !toParts || from > to) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid date range.' });
    }

    const includeWorkers = Boolean(options.includeWorkers) && from === to;
    const wantByDay = options.granularity === 'day';
    const { calendar } = await this.getCalendarDomain();
    const { start: rangeStart, endExclusive: rangeEnd } = calendar.localRangeBounds(from, to);

    const [allocations, stages] = await Promise.all([
      this.prisma.scheduleAllocation.findMany({
        where: {
          plannedStart: { lt: rangeEnd },
          plannedEnd: { gt: rangeStart },
          schedule: { status: { in: ['APPROVED', 'PROPOSED'] } },
        },
        select: {
          plannedStart: true,
          plannedEnd: true,
          employeeId: true,
          employee: { select: { firstName: true, lastName: true } },
          productionTask: { select: { stageDefinitionId: true } },
        },
      }),
      this.prisma.productionStageDefinition.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          nameEn: true,
          nameAr: true,
          nameHe: true,
          schedulingResourceMode: true,
          resourceSlots: true,
          workerSkills: {
            where: { isActive: true, user: { isActive: true, archivedAt: null } },
            select: {
              userId: true,
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    const buildRows = (
      intervals: Array<{ start: Date; end: Date }>,
      shiftMinutes: number,
      withWorkers: boolean,
    ) => {
      const rows = stages.map((stage) => {
        const skilled = new Map<string, { firstName: string | null; lastName: string | null }>();
        for (const skill of stage.workerSkills) {
          if (skilled.has(skill.userId)) continue;
          skilled.set(skill.userId, {
            firstName: skill.user?.firstName ?? null,
            lastName: skill.user?.lastName ?? null,
          });
        }
        const eligibleWorkerCount = skilled.size;
        const heads =
          stage.schedulingResourceMode === 'RESOURCE_CONSTRAINED'
            ? Math.max(0, stage.resourceSlots ?? 0)
            : eligibleWorkerCount;

        let allocatedMinutes = 0;
        let unassignedAllocatedMinutes = 0;
        const allocatedByEmployee = new Map<string, number>();
        const namesByEmployee = new Map<string, { firstName: string | null; lastName: string | null }>();
        for (const a of allocations) {
          if (a.productionTask?.stageDefinitionId !== stage.id) continue;
          const minutes = overlapWorkingMinutes(a.plannedStart, a.plannedEnd, intervals);
          if (minutes <= 0) continue;
          allocatedMinutes += minutes;
          if (!a.employeeId) {
            unassignedAllocatedMinutes += minutes;
            continue;
          }
          allocatedByEmployee.set(
            a.employeeId,
            (allocatedByEmployee.get(a.employeeId) ?? 0) + minutes,
          );
          if (!namesByEmployee.has(a.employeeId)) {
            namesByEmployee.set(a.employeeId, {
              firstName: a.employee?.firstName ?? null,
              lastName: a.employee?.lastName ?? null,
            });
          }
        }

        const availableMinutes = Math.round(shiftMinutes * heads);
        const bookedMinutes = Math.round(allocatedMinutes);
        const remainingMinutes = Math.max(0, availableMinutes - bookedMinutes);
        const row: Record<string, unknown> = {
          departmentId: stage.id,
          stageDefinitionId: stage.id,
          code: stage.code,
          nameEn: stage.nameEn,
          nameAr: stage.nameAr,
          nameHe: stage.nameHe,
          bookedMinutes,
          capacityMinutes: availableMinutes,
          allocatedMinutes: bookedMinutes,
          availableMinutes,
          remainingMinutes,
          eligibleWorkerCount,
        };

        if (withWorkers) {
          type CapacityWorkerBreakdown = {
            employeeId: string;
            firstName: string | null;
            lastName: string | null;
            eligible: boolean;
            availableMinutes: number;
            allocatedMinutes: number;
            remainingMinutes: number;
          };
          const sortWorkers = (a: CapacityWorkerBreakdown, b: CapacityWorkerBreakdown) =>
            b.allocatedMinutes - a.allocatedMinutes || a.employeeId.localeCompare(b.employeeId);

          row.workers = [...skilled.entries()]
            .map(([employeeId, name]) => {
              const allocated = Math.round(allocatedByEmployee.get(employeeId) ?? 0);
              const available = Math.round(shiftMinutes);
              return {
                employeeId,
                firstName: name.firstName,
                lastName: name.lastName,
                eligible: true,
                availableMinutes: available,
                allocatedMinutes: allocated,
                remainingMinutes: Math.max(0, available - allocated),
              };
            })
            .sort(sortWorkers);
          row.ineligibleWorkers = [...allocatedByEmployee.entries()]
            .filter(([employeeId]) => !skilled.has(employeeId))
            .map(([employeeId]) => {
              const name = namesByEmployee.get(employeeId);
              const firstName = name?.firstName ?? null;
              const lastName = name?.lastName ?? null;
              return {
                employeeId,
                firstName: firstName ?? (lastName ? null : employeeId),
                lastName,
                eligible: false,
                availableMinutes: 0,
                allocatedMinutes: Math.round(allocatedByEmployee.get(employeeId) ?? 0),
                remainingMinutes: 0,
              };
            })
            .sort(sortWorkers);
          row.unassignedAllocatedMinutes = Math.round(unassignedAllocatedMinutes);
        }

        return row as {
          departmentId: string;
          stageDefinitionId: string;
          code: string;
          nameEn: string;
          nameAr: string | null;
          nameHe: string | null;
          bookedMinutes: number;
          capacityMinutes: number;
          allocatedMinutes: number;
          availableMinutes: number;
          remainingMinutes: number;
          eligibleWorkerCount: number;
          workers?: Array<{
            employeeId: string;
            firstName: string | null;
            lastName: string | null;
            eligible: boolean;
            availableMinutes: number;
            allocatedMinutes: number;
            remainingMinutes: number;
          }>;
          ineligibleWorkers?: Array<{
            employeeId: string;
            firstName: string | null;
            lastName: string | null;
            eligible: boolean;
            availableMinutes: number;
            allocatedMinutes: number;
            remainingMinutes: number;
          }>;
          unassignedAllocatedMinutes?: number;
        };
      });

      rows.sort((a, b) => b.bookedMinutes - a.bookedMinutes || a.code.localeCompare(b.code));
      return rows;
    };

    const ymds = eachYmdInclusive(from, to);
    const rangeIntervals = calendar.expandWorkingIntervalsForYmdRange(from, to);
    const rangeShiftMinutes = rangeIntervals.reduce(
      (sum, iv) => sum + (iv.end.getTime() - iv.start.getTime()) / 60_000,
      0,
    );

    const data = buildRows(rangeIntervals, rangeShiftMinutes, includeWorkers);
    if (!wantByDay) {
      return { from, to, data };
    }

    const days: Array<{ date: string; isWorking: boolean; shiftMinutes: number }> = [];
    const byDay: Array<{
      date: string;
      isWorking: boolean;
      pinnedOnClosedDayCount: number;
      data: ReturnType<typeof buildRows>;
    }> = [];
    for (const date of ymds) {
      const intervals = calendar.intervalsForLocalYmd(date);
      const isWorking = intervals.length > 0;
      const shiftMinutes = intervals.reduce(
        (sum, iv) => sum + (iv.end.getTime() - iv.start.getTime()) / 60_000,
        0,
      );
      days.push({ date, isWorking, shiftMinutes: Math.round(shiftMinutes) });
      byDay.push({
        date,
        isWorking,
        pinnedOnClosedDayCount: 0,
        data: buildRows(intervals, shiftMinutes, includeWorkers),
      });
    }

    const pinnedByYmd = await this.pinnedOnClosedDayCounts(calendar, rangeStart, rangeEnd);
    for (const day of byDay) {
      day.pinnedOnClosedDayCount = day.isWorking ? 0 : (pinnedByYmd[day.date] ?? 0);
    }

    return { from, to, data, days, byDay };
  }

  private async loadConflictAllocationInputs(): Promise<ConflictAllocationInput[]> {
    const rows = await this.prisma.scheduleAllocation.findMany({
      where: {
        plannedEnd: { gte: new Date() },
        schedule: { status: { in: ['APPROVED', 'PROPOSED'] } },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, isActive: true } },
        schedule: {
          select: {
            id: true,
            version: true,
            status: true,
            productionOrderId: true,
            requestedDeliveryDate: true,
            committedDeliveryDate: true,
            productionOrder: {
              select: {
                id: true,
                number: true,
                priority: true,
                customerId: true,
                createdAt: true,
                requiredDeliveryDate: true,
                committedDeliveryDate: true,
                product: { select: { nameEn: true } },
              },
            },
          },
        },
        productionTask: {
          select: {
            id: true,
            name: true,
            status: true,
            stageDefinitionId: true,
            stageDefinition: { select: { id: true, nameEn: true, code: true } },
          },
        },
      },
    });
    return rows.map((a) => {
      const order = a.schedule.productionOrder;
      return {
        id: a.id,
        employeeId: a.employeeId,
        employeeName: a.employee ? `${a.employee.firstName} ${a.employee.lastName}`.trim() : null,
        employeeActive: a.employee?.isActive ?? null,
        resourceSlot: a.resourceSlot,
        plannedStart: a.plannedStart,
        plannedEnd: a.plannedEnd,
        estimatedMinutes: a.estimatedMinutes,
        isPinned: a.isPinned,
        manuallyAdjusted: a.manuallyAdjusted,
        productionOrderId: a.schedule.productionOrderId,
        scheduleId: a.schedule.id,
        scheduleVersion: a.schedule.version,
        scheduleStatus: a.schedule.status,
        productionTaskId: a.productionTaskId,
        taskStatus: a.productionTask?.status ?? null,
        taskName: a.productionTask?.name ?? null,
        stageDefinitionId: a.productionTask?.stageDefinitionId ?? a.productionTask?.stageDefinition?.id ?? null,
        stageName: a.productionTask?.stageDefinition?.nameEn ?? a.productionTask?.name ?? null,
        stageCode: a.productionTask?.stageDefinition?.code ?? null,
        orderNumber: order?.number ?? '',
        productName: order?.product?.nameEn ?? null,
        priority: order?.priority ?? 'NORMAL',
        requestedDeliveryDate: a.schedule.requestedDeliveryDate ?? order?.requiredDeliveryDate ?? null,
        committedDeliveryDate: a.schedule.committedDeliveryDate ?? order?.committedDeliveryDate ?? null,
        customerId: order?.customerId ?? a.schedule.productionOrderId,
        createdAt: order?.createdAt ?? a.plannedStart,
      };
    });
  }

  private async detectOperationalConflicts(now = new Date()): Promise<DetectedConflict[]> {
    const inputs = await this.loadConflictAllocationInputs();
    return detectConflicts(inputs, now);
  }

  async listConflicts() {
    const conflicts = await this.detectOperationalConflicts();
    const data = conflicts.map(serializeConflict);
    return {
      data,
      count: data.length,
      affectedOrderCount: affectedOrderIds(conflicts).length,
    };
  }

  async categorizeStoredConflicts() {
    const now = new Date();
    const inputs = await this.loadConflictAllocationInputs();
    return categorizeConflictInflators(inputs, now);
  }

  async resolveConflict(conflictId: string, user: AuthUser) {
    const now = new Date();
    const inputs = await this.loadConflictAllocationInputs();
    const conflicts = detectConflicts(inputs, now);
    const found = conflicts.find((c) => c.conflictId === conflictId);
    if (!found) {
      await this.audit(user.id, 'schedule.conflict.resolve', 'ScheduleConflict', conflictId, {
        action: 'ALREADY_RESOLVED',
      });
      return {
        resolved: true,
        action: 'ALREADY_RESOLVED' as const,
        conflictId,
        affectedOrderIds: [],
        updatedAllocations: [],
        remainingConflictCount: conflicts.length,
        moved: null,
      };
    }

    const pick = pickMovableSides(found);
    if ('bothFixed' in pick) {
      await this.audit(user.id, 'schedule.conflict.resolve_failed', 'ScheduleConflict', conflictId, {
        code: 'MANUAL_LOCKED',
        worker: found.worker,
        orders: [found.allocationA.orderNumber, found.allocationB.orderNumber],
      });
      throw new ConflictException({
        code: 'MANUAL_LOCKED',
        message: 'Manual schedule conflict. Both tasks are locked.',
        conflictId,
      });
    }

    const movableInput = inputs.find((a) => a.id === pick.movable.allocationId);
    const keeperInput = inputs.find((a) => a.id === pick.keeper.allocationId);
    if (!movableInput || !keeperInput) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Conflict allocations were not found.' });
    }

    const latestMovable = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: movableInput.productionOrderId },
      orderBy: { version: 'desc' },
      select: { version: true, id: true },
    });
    if (latestMovable && latestMovable.id !== movableInput.scheduleId) {
      throw new ConflictException({
        code: 'SCHEDULE_STALE',
        message: `Schedule has changed since you loaded it (current version ${latestMovable.version}).`,
        currentVersion: latestMovable.version,
      });
    }

    const [workers, occupancy, { calendar }] = await Promise.all([
      this.loadWorkers(),
      this.loadOccupancy(
        movableInput.productionOrderId === keeperInput.productionOrderId
          ? movableInput.productionOrderId
          : undefined,
      ),
      this.getCalendarDomain(),
    ]);
    const floor = resolveSchedulingFloor(calendar, now);

    const placement = findResolutionPlacement({
      movable: movableInput,
      keeper: keeperInput,
      workers,
      occupancy,
      calendar,
      now: floor,
      sameWindowOnly: pick.sameWindowOnly,
    });
    if ('fail' in placement) {
      const inProgressPair = pick.sameWindowOnly;
      const code = inProgressPair ? 'IN_PROGRESS_NO_WORKER' : 'NO_ALTERNATIVE';
      await this.audit(user.id, 'schedule.conflict.resolve_failed', 'ScheduleConflict', conflictId, {
        code,
        worker: found.worker,
        orders: [found.allocationA.orderNumber, found.allocationB.orderNumber],
      });
      throw new ConflictException({
        code,
        message: inProgressPair
          ? 'Both tasks are already in progress. No other qualified worker is free in this window.'
          : 'Unable to resolve automatically. No eligible worker or available time can fit this task without affecting the committed schedule.',
        conflictId,
      });
    }

    if (missesCommitment(placement.end, movableInput.committedDeliveryDate)) {
      await this.audit(user.id, 'schedule.conflict.resolve_failed', 'ScheduleConflict', conflictId, {
        code: 'WOULD_MISS_COMMITMENT',
        worker: found.worker,
        orders: [movableInput.orderNumber],
        oldTime: { start: movableInput.plannedStart, end: movableInput.plannedEnd },
        newTime: { start: placement.start, end: placement.end },
      });
      throw new ConflictException({
        code: 'WOULD_MISS_COMMITMENT',
        message: `Resolving this conflict will put ${movableInput.orderNumber} at risk.`,
        conflictId,
        productionOrderId: movableInput.productionOrderId,
        orderNumber: movableInput.orderNumber,
      });
    }

    if (!movableInput.productionTaskId) {
      throw new ConflictException({
        code: 'NO_ALTERNATIVE',
        message: 'Unable to resolve automatically. The overlapping task cannot be replanned.',
        conflictId,
      });
    }

    const pinOverrides: Array<{
      productionTaskId: string;
      start: Date;
      end: Date;
      employeeId: string | null;
      keepPinned?: boolean;
    }> = [
      {
        productionTaskId: movableInput.productionTaskId,
        start: placement.start,
        end: placement.end,
        employeeId: placement.employeeId,
        keepPinned: movableInput.isPinned,
      },
    ];
    if (
      movableInput.productionOrderId === keeperInput.productionOrderId &&
      keeperInput.productionTaskId
    ) {
      pinOverrides.push({
        productionTaskId: keeperInput.productionTaskId,
        start: keeperInput.plannedStart,
        end: keeperInput.plannedEnd,
        employeeId: keeperInput.employeeId,
        keepPinned: keeperInput.isPinned,
      });
    }

    try {
      await this.generateForProductionOrder(movableInput.productionOrderId, user.id, {
        reason: 'resolve-conflict',
        failHard: true,
        abortIfMissesCommitment: true,
        pinOverrides,
      });
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      const message = err instanceof Error ? err.message : 'Scheduling failed';
      await this.audit(user.id, 'schedule.conflict.resolve_failed', 'ScheduleConflict', conflictId, {
        code: 'SCHEDULE_REPLAN_FAILED',
        message,
      });
      throw new ConflictException({ code: 'SCHEDULE_REPLAN_FAILED', message, conflictId });
    }

    const remaining = await this.detectOperationalConflicts();
    const stillThere = remaining.some((c) => c.conflictId === conflictId);
    if (stillThere) {
      await this.audit(user.id, 'schedule.conflict.resolve_failed', 'ScheduleConflict', conflictId, {
        code: 'NO_ALTERNATIVE',
        reason: 'pair-remained',
      });
      throw new ConflictException({
        code: 'NO_ALTERNATIVE',
        message:
          'Unable to resolve automatically. No eligible worker or available time can fit this task without affecting the committed schedule.',
        conflictId,
      });
    }

    const movedUser = await this.prisma.user.findUnique({
      where: { id: placement.employeeId },
      select: { firstName: true, lastName: true },
    });
    const employeeName = movedUser
      ? `${movedUser.firstName} ${movedUser.lastName}`.trim()
      : inputs.find((a) => a.employeeId === placement.employeeId)?.employeeName ?? '';

    await this.audit(user.id, 'schedule.conflict.resolve', 'ScheduleConflict', conflictId, {
      action: placement.action,
      worker: found.worker,
      orders: [movableInput.orderNumber, keeperInput.orderNumber],
      oldTime: { start: movableInput.plannedStart, end: movableInput.plannedEnd },
      newTime: { start: placement.start, end: placement.end },
      reason: 'resolve-conflict',
    });
    await this.audit(
      user.id,
      placement.action === 'REASSIGNED' ? 'schedule.allocation.reassigned' : 'schedule.allocation.rescheduled',
      'ScheduleAllocation',
      movableInput.id,
      {
        productionOrderId: movableInput.productionOrderId,
        employeeId: placement.employeeId,
        oldTime: { start: movableInput.plannedStart, end: movableInput.plannedEnd },
        newTime: { start: placement.start, end: placement.end },
        reason: 'resolve-conflict',
      },
    );

    return {
      resolved: true,
      action: placement.action,
      conflictId,
      affectedOrderIds: [
        ...new Set([movableInput.productionOrderId, keeperInput.productionOrderId]),
      ],
      updatedAllocations: [
        {
          allocationId: movableInput.id,
          productionOrderId: movableInput.productionOrderId,
          employeeId: placement.employeeId,
          start: placement.start.toISOString(),
          end: placement.end.toISOString(),
        },
      ],
      remainingConflictCount: remaining.length,
      moved: {
        productionOrderId: movableInput.productionOrderId,
        orderNumber: movableInput.orderNumber,
        employeeId: placement.employeeId,
        employeeName,
        start: placement.start.toISOString(),
        end: placement.end.toISOString(),
      },
    };
  }

  async resolveAllConflicts(user: AuthUser) {
    const results: Array<
      | Awaited<ReturnType<SchedulingService['resolveConflict']>>
      | { resolved: false; conflictId: string; code: string }
    > = [];
    const skip = new Set<string>();
    let resolvedCount = 0;
    let failedCount = 0;
    let alreadyResolvedCount = 0;

    for (let i = 0; i < 100; i++) {
      const remaining = sortConflictsForResolveAll(await this.detectOperationalConflicts()).filter(
        (c) => !skip.has(c.conflictId),
      );
      if (remaining.length === 0) break;
      const next = remaining[0]!;
      try {
        const result = await this.resolveConflict(next.conflictId, user);
        results.push(result);
        if (result.action === 'ALREADY_RESOLVED') alreadyResolvedCount += 1;
        else resolvedCount += 1;
      } catch (err) {
        const code =
          err instanceof ConflictException &&
          err.getResponse() &&
          typeof err.getResponse() === 'object' &&
          'code' in (err.getResponse() as object)
            ? String((err.getResponse() as { code: string }).code)
            : 'SCHEDULE_REPLAN_FAILED';
        skip.add(next.conflictId);
        failedCount += 1;
        results.push({ resolved: false, conflictId: next.conflictId, code });
      }
    }

    const remainingConflicts = await this.detectOperationalConflicts();
    await this.audit(user.id, 'schedule.conflict.resolve_all', 'ScheduleConflict', 'resolve-all', {
      resolvedCount,
      failedCount,
      alreadyResolvedCount,
      remainingConflictCount: remainingConflicts.length,
    });

    return {
      resolvedCount,
      failedCount,
      alreadyResolvedCount,
      remainingConflictCount: remainingConflicts.length,
      results,
    };
  }

  private projectDealerDelivery(input: {
    salesOrderStatus?: string | null;
    productionOrder?: {
      status: string;
      requiredDeliveryDate?: Date | null;
      committedDeliveryDate?: Date | null;
    } | null;
    schedule?: Parameters<SchedulingService['classifyLoadedSchedule']>[1];
    delivery: { status?: string | null; deliveryDate?: Date | string | null } | null;
    requested: Date | string | null;
    suggested: Date | string | null;
    committed: Date | string | null;
    projected: Date | string | null;
    tz: string;
    todayYmd: string;
    requestStatus?: string | null;
  }) {
    const actual = actualDeliveryValue(input.delivery);
    const planned = plannedDeliveryValue(input.delivery);
    const po = input.productionOrder ?? null;
    const risk = po ? this.classifyLoadedSchedule(po, input.schedule) : null;
    const view = buildDealerDeliveryView({
      salesOrderStatus: input.salesOrderStatus,
      productionOrderStatus: po?.status,
      deliveryStatus: input.delivery?.status,
      requestedYmd: toCalendarYmd(input.requested, input.tz),
      suggestedYmd: toCalendarYmd(input.suggested, input.tz),
      committedYmd: toCalendarYmd(input.committed, input.tz),
      projectedYmd: toCalendarYmd(input.projected, input.tz),
      plannedYmd: toCalendarYmd(planned, input.tz),
      actualYmd: toCalendarYmd(actual, input.tz),
      todayYmd: input.todayYmd,
      riskStatus: risk?.primaryStatus ?? null,
      requestStatus: input.requestStatus,
    });
    const promiseState = po
      ? mapPromiseState({
          scheduleStatus: (input.schedule?.status as 'DRAFT') ?? 'DRAFT',
          productionOrderStatus: po.status as 'PLANNED',
          atRisk: risk?.primaryStatus === 'AT_RISK' || risk?.primaryStatus === 'BLOCKED',
          late: risk?.primaryStatus === 'LATE',
        })
      : 'ESTIMATED';
    const policy = resolveDealerChangePolicy({
      promiseState,
      productionOrderStatus: (po?.status ?? 'DRAFT') as 'PLANNED',
    });
    return { view, actual, planned, promiseState, policy, risk };
  }

  private classifyLoadedSchedule(
    po: { status: string; requiredDeliveryDate?: Date | null; committedDeliveryDate?: Date | null },
    schedule:
      | {
          status?: string | null;
          committedDeliveryDate?: Date | null;
          requestedDeliveryDate?: Date | null;
          earliestAvailableDate?: Date | null;
          suggestedDeliveryDate?: Date | null;
          requestedDateFeasible?: boolean | null;
          unschedulableReason?: string | null;
          requiresAdminEstimateReview?: boolean | null;
          materialRisk?: boolean | null;
        }
      | null
      | undefined,
    now = new Date(),
  ): ScheduleRiskClassification {
    return classifyScheduleRisk({
      productionOrderStatus: po.status,
      scheduleStatus: schedule?.status ?? null,
      committedDeliveryDate: schedule?.committedDeliveryDate ?? po.committedDeliveryDate ?? null,
      requestedDeliveryDate: schedule?.requestedDeliveryDate ?? po.requiredDeliveryDate ?? null,
      projectedCompletion: schedule?.earliestAvailableDate ?? schedule?.suggestedDeliveryDate ?? null,
      requestedDateFeasible: schedule?.requestedDateFeasible,
      unschedulableReason: schedule?.unschedulableReason,
      requiresAdminEstimateReview: Boolean(schedule?.requiresAdminEstimateReview),
      materialRisk: Boolean(schedule?.materialRisk),
      now,
    });
  }

  private projectedMsFromFingerprint(fp: string | null): number | null {
    if (!fp) return null;
    try {
      const parsed = JSON.parse(fp) as {
        earliestAvailableDate?: string | null;
        suggestedDeliveryDate?: string | null;
      };
      const iso = parsed.earliestAvailableDate ?? parsed.suggestedDeliveryDate;
      if (!iso) return null;
      const ms = new Date(iso).getTime();
      return Number.isFinite(ms) ? ms : null;
    } catch {
      return null;
    }
  }

  private async snapshotScheduleFingerprint(poId: string): Promise<string | null> {
    const schedule = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: poId, status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] } },
      orderBy: { version: 'desc' },
      select: {
        status: true,
        unschedulableReason: true,
        requiresAdminEstimateReview: true,
        materialRisk: true,
        requestedDateFeasible: true,
        earliestAvailableDate: true,
        suggestedDeliveryDate: true,
        committedDeliveryDate: true,
        allocations: {
          select: {
            productionTaskId: true,
            plannedStart: true,
            plannedEnd: true,
            employeeId: true,
          },
          orderBy: { plannedStart: 'asc' },
        },
      },
    });
    if (!schedule) return null;
    return JSON.stringify({
      status: schedule.status,
      unschedulableReason: schedule.unschedulableReason,
      requiresAdminEstimateReview: schedule.requiresAdminEstimateReview,
      materialRisk: schedule.materialRisk,
      requestedDateFeasible: schedule.requestedDateFeasible,
      earliestAvailableDate: schedule.earliestAvailableDate?.toISOString() ?? null,
      suggestedDeliveryDate: schedule.suggestedDeliveryDate?.toISOString() ?? null,
      committedDeliveryDate: schedule.committedDeliveryDate?.toISOString() ?? null,
      allocations: schedule.allocations.map((a) => ({
        productionTaskId: a.productionTaskId,
        plannedStart: a.plannedStart.toISOString(),
        plannedEnd: a.plannedEnd.toISOString(),
        employeeId: a.employeeId,
      })),
    });
  }

  private async loadLatestActiveSchedules() {
    const schedules = await this.prisma.productionSchedule.findMany({
      where: {
        status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] },
        productionOrder: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
      },
      include: {
        productionOrder: {
          select: {
            id: true,
            number: true,
            status: true,
            requiredDeliveryDate: true,
            committedDeliveryDate: true,
            priority: true,
            customerId: true,
            createdAt: true,
            product: {
              select: { id: true, nameEn: true, nameAr: true, nameHe: true, imageUrl: true },
            },
            salesOrder: {
              select: {
                customer: { select: { id: true, name: true, nameEn: true, nameAr: true, nameHe: true } },
              },
            },
          },
        },
      },
    });
    const latest = new Map<string, (typeof schedules)[number]>();
    for (const row of schedules) {
      const prev = latest.get(row.productionOrderId);
      if (!prev || row.version > prev.version) latest.set(row.productionOrderId, row);
    }
    return [...latest.values()];
  }

  private async classifyActiveOrders(now = new Date()) {
    const rows = await this.loadLatestActiveSchedules();
    return rows.map((schedule) => {
      const order = schedule.productionOrder;
      const requested = schedule.requestedDeliveryDate ?? order.requiredDeliveryDate;
      const committed = schedule.committedDeliveryDate ?? order.committedDeliveryDate ?? null;
      const projected = schedule.earliestAvailableDate ?? schedule.suggestedDeliveryDate ?? null;
      return {
        schedule,
        order,
        requested,
        committed,
        projected,
        classification: this.classifyLoadedSchedule(order, schedule, now),
      };
    });
  }

  private async enrichAtRiskExtras(
    items: Array<{
      productionOrderId: string;
      reasonCode: string | null;
      stageId?: string | null;
      stageName?: string | null;
    }>,
  ) {
    const poIds = items.map((i) => i.productionOrderId);
    if (!poIds.length) return new Map<string, Record<string, unknown>>();

    const [openTasks, wipNodes] = await Promise.all([
      this.prisma.productionTask.findMany({
        where: {
          productionOrderId: { in: poIds },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: {
          productionOrderId: true,
          name: true,
          stageDefinitionId: true,
          stageDefinition: { select: { nameEn: true, nameAr: true, nameHe: true } },
        },
        orderBy: { createdAt: 'asc' },
      }).catch(() => []),
      this.prisma.productionOrderWorkflowSnapshotNode.findMany({
        where: {
          snapshot: { productionOrderId: { in: poIds } },
          isSkipped: false,
          OR: [{ consumesSemiFinished: true }, { inventoryTracking: 'PRODUCES_SEMI_FINISHED' }],
        },
        select: {
          snapshot: { select: { productionOrderId: true } },
          nameEnSnapshot: true,
          nameArSnapshot: true,
          consumesSemiFinished: true,
          inventoryTracking: true,
          outputNameEn: true,
          outputNameAr: true,
        },
      }).catch(() => []),
    ]);

    const stageByPo = new Map<string, { stageId: string | null; stageName: string | null }>();
    for (const task of openTasks) {
      if (stageByPo.has(task.productionOrderId)) continue;
      stageByPo.set(task.productionOrderId, {
        stageId: task.stageDefinitionId,
        stageName: task.stageDefinition?.nameEn ?? task.name,
      });
    }

    const extras = new Map<string, Record<string, unknown>>();
    for (const item of items) {
      const stage = stageByPo.get(item.productionOrderId);
      const row: Record<string, unknown> = {};
      if (stage?.stageName) {
        row.stageId = stage.stageId;
        row.stageName = stage.stageName;
      }
      if (item.reasonCode === 'WIP_NOT_READY') {
        const nodes = wipNodes.filter((n) => n.snapshot.productionOrderId === item.productionOrderId);
        const producer = nodes.find((n) => n.inventoryTracking === 'PRODUCES_SEMI_FINISHED');
        const consumer = nodes.find((n) => n.consumesSemiFinished);
        if (producer?.outputNameEn || producer?.nameEnSnapshot) {
          row.requiredWip = producer.outputNameEn ?? producer.nameEnSnapshot;
          row.producedBy = producer.nameEnSnapshot;
        }
        if (consumer?.nameEnSnapshot) row.currentStage = consumer.nameEnSnapshot;
        else if (stage?.stageName) row.currentStage = stage.stageName;
      }
      if (item.reasonCode === 'NO_RESOURCE_CAPACITY' && stage?.stageName) {
        row.stageAtCapacity = stage.stageName;
      }
      extras.set(item.productionOrderId, row);
    }
    return extras;
  }

  private serializeAtRiskItem(
    row: Awaited<ReturnType<SchedulingService['classifyActiveOrders']>>[number],
    calendar: WorkingCalendar,
    bufferWorkingDays: number,
    extras?: Record<string, unknown>,
    customer?: { name?: string | null; nameEn?: string | null; nameAr?: string | null; nameHe?: string | null } | null,
  ) {
    const { schedule: s, order, requested, committed, projected, classification } = row;
    return {
      productionOrderId: s.productionOrderId,
      number: order.number,
      status: order.status,
      priority: order.priority,
      scheduleStatus: s.status,
      scheduleVersion: s.version,
      version: s.version,
      reason: publicScheduleReason(s.reason),
      materialRisk: s.materialRisk,
      requiresAdminEstimateReview: s.requiresAdminEstimateReview,
      requiredDeliveryDate: order.requiredDeliveryDate,
      requestedDeliveryDate: requested,
      committedDeliveryDate: committed,
      suggestedDeliveryDate: s.suggestedDeliveryDate,
      earliestAvailableDate: s.earliestAvailableDate,
      projectedCompletion: projected,
      requestedDateFeasible: s.requestedDateFeasible,
      unschedulableReason: s.unschedulableReason,
      planningMode: s.planningMode,
      materialReadyAt: s.materialReadyAt,
      committedCompletionDate: s.committedCompletionDate,
      productionDeadline: productionDeadlineIso(calendar, bufferWorkingDays, requested, committed),
      deliveryBufferWorkingDays: bufferWorkingDays,
      productId: order.product?.id ?? null,
      productName: order.product?.nameEn ?? null,
      productNameAr: order.product?.nameAr ?? null,
      productNameHe: order.product?.nameHe ?? null,
      imageUrl: order.product?.imageUrl ?? null,
      dealerName: customer?.nameEn ?? customer?.name ?? null,
      dealerNameAr: customer?.nameAr ?? customer?.name ?? null,
      dealerNameHe: customer?.nameHe ?? null,
      riskStatus: classification.primaryStatus,
      reasonCode: classification.reasonCode,
      reasonCodes: classification.reasonCodes,
      reasonLabel: reasonLabelKey(classification.reasonCode),
      recoverableAutomatically: classification.recoverableAutomatically,
      recommendedAction: classification.recommendedAction,
      earliestFeasibleDate: s.earliestAvailableDate,
      ...(extras ?? {}),
    };
  }

  async listAtRisk() {
    const classified = await this.classifyActiveOrders();
    const atRisk = classified.filter((row) => row.classification.contributesToMayBeLate);
    const orphanCustomerIds = [
      ...new Set(
        atRisk
          .map((row) => row.order)
          .filter((o) => o.customerId && !o.salesOrder?.customer)
          .map((o) => o.customerId as string),
      ),
    ];
    const orphanCustomers = orphanCustomerIds.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: orphanCustomerIds } },
          select: { id: true, name: true, nameEn: true, nameAr: true, nameHe: true },
        })
      : [];
    const orphanById = new Map(orphanCustomers.map((c) => [c.id, c]));
    const extras = await this.enrichAtRiskExtras(
      atRisk.map((row) => ({
        productionOrderId: row.schedule.productionOrderId,
        reasonCode: row.classification.reasonCode,
      })),
    );

    const { row, calendar } = await this.getCalendarDomain();
    const bufferWorkingDays = row.deliveryBufferWorkingDays ?? 1;

    return {
      data: atRisk.map((item) => {
        const order = item.order;
        const customer =
          order.salesOrder?.customer ??
          (order.customerId ? orphanById.get(order.customerId) ?? null : null);
        return this.serializeAtRiskItem(
          item,
          calendar,
          bufferWorkingDays,
          extras.get(item.schedule.productionOrderId),
          customer,
        );
      }),
    };
  }

  async dashboardSummary() {
    const classified = await this.classifyActiveOrders();
    const atRisk = classified.filter((row) => row.classification.contributesToMayBeLate).length;
    const awaitingApproval = classified.filter((row) => row.classification.contributesToAwaitingApproval).length;
    const needsReview = classified.filter((row) => row.schedule.status === 'NEEDS_REVIEW').length;
    const approvedActive = classified.filter((row) => row.schedule.status === 'APPROVED').length;
    const conflicts = await this.listConflicts();

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const weekStart = new Date(todayStart.getTime() - todayStart.getUTCDay() * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    const [todayOrders, weekOrders] = await Promise.all([
      this.buildOrderCards(todayStart, todayEnd),
      this.buildOrderCards(weekStart, weekEnd),
    ]);

    return {
      awaitingApproval,
      needsReview,
      approvedActive,
      atRisk,
      conflicts: conflicts.count,
      todayCount: todayOrders.length,
      weekCount: weekOrders.length,
      approvalsWaiting: awaitingApproval + needsReview,
      alerts: atRisk + conflicts.count,
    };
  }

  private async classifyProductionOrder(poId: string) {
    const po = await this.prisma.productionOrder.findUnique({
      where: { id: poId },
      select: {
        id: true,
        number: true,
        status: true,
        requiredDeliveryDate: true,
        committedDeliveryDate: true,
        priority: true,
        customerId: true,
        createdAt: true,
      },
    });
    if (!po) return null;
    const schedule = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: poId, status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] } },
      orderBy: { version: 'desc' },
    });
    const classification = this.classifyLoadedSchedule(po, schedule);
    return { po, schedule, classification };
  }

  async resolveAtRisk(productionOrderId: string, user: { id: string }) {
    const before = await this.classifyProductionOrder(productionOrderId);
    if (!before) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
    }
    const payload = (
      classification: ScheduleRiskClassification,
      extra: Record<string, unknown> = {},
    ): {
      productionOrderId: string;
      number: string;
      riskStatus: ScheduleRiskClassification['primaryStatus'];
      reasonCode: ScheduleRiskClassification['reasonCode'];
      reasonLabel: string;
      recommendedAction: ScheduleRiskClassification['recommendedAction'];
      recoverableAutomatically: boolean;
      earliestFeasibleDate: Date | null;
      stillAtRisk: boolean;
      action?: string;
      resolvedAutomatically?: boolean;
      stillNeedsAttention?: boolean;
      alreadyOnTrack?: boolean;
      code?: string;
      beforeRiskStatus?: string;
    } => ({
      productionOrderId,
      number: before.po.number,
      riskStatus: classification.primaryStatus,
      reasonCode: classification.reasonCode,
      reasonLabel: reasonLabelKey(classification.reasonCode),
      recommendedAction: classification.recommendedAction,
      recoverableAutomatically: classification.recoverableAutomatically,
      earliestFeasibleDate: before.schedule?.earliestAvailableDate ?? null,
      stillAtRisk: classification.contributesToMayBeLate,
      ...extra,
    });

    if (!before.classification.contributesToMayBeLate) {
      return payload(before.classification, {
        action: 'ALREADY_ON_TRACK',
        resolvedAutomatically: false,
        stillNeedsAttention: false,
        alreadyOnTrack: true,
      });
    }

    if (!before.classification.recoverableAutomatically) {
      return payload(before.classification, {
        action: 'NEEDS_ADMIN',
        resolvedAutomatically: false,
        stillNeedsAttention: true,
        alreadyOnTrack: false,
      });
    }

    const committed = before.schedule?.committedDeliveryDate ?? before.po.committedDeliveryDate;
    try {
      await this.generateForProductionOrder(productionOrderId, user.id, {
        reason: 'at-risk-resolve',
        failHard: true,
        abortIfMissesCommitment: Boolean(committed),
      });
    } catch (err) {
      const afterFail = await this.classifyProductionOrder(productionOrderId);
      const classification = afterFail?.classification ?? before.classification;
      const code =
        err instanceof ConflictException &&
        err.getResponse() &&
        typeof err.getResponse() === 'object' &&
        'code' in (err.getResponse() as object)
          ? String((err.getResponse() as { code: string }).code)
          : 'SCHEDULE_REPLAN_FAILED';
      return payload(classification, {
        action: code === 'WOULD_MISS_COMMITMENT' ? 'COMMITMENT_INFEASIBLE' : 'REPLAN_FAILED',
        resolvedAutomatically: false,
        stillNeedsAttention: true,
        alreadyOnTrack: false,
        code,
      });
    }

    const after = await this.classifyProductionOrder(productionOrderId);
    const classification = after?.classification ?? before.classification;
    const leftSet = !classification.contributesToMayBeLate;
    await this.audit(user.id, 'schedule.at_risk.resolve', 'ProductionOrder', productionOrderId, {
      before: before.classification.primaryStatus,
      after: classification.primaryStatus,
      leftSet,
    });
    return payload(classification, {
      action: leftSet ? 'RESOLVED' : 'STILL_AT_RISK',
      resolvedAutomatically: leftSet,
      stillNeedsAttention: !leftSet,
      alreadyOnTrack: leftSet && classification.primaryStatus === 'ON_TRACK',
      beforeRiskStatus: before.classification.primaryStatus,
    });
  }

  async resolveAllAtRisk(user: { id: string }) {
    const classified = (await this.classifyActiveOrders())
      .filter((row) => row.classification.contributesToMayBeLate)
      .sort((a, b) =>
        comparePriority(
          {
            id: a.order.id,
            customerId: a.order.customerId ?? a.order.salesOrder?.customer?.id ?? a.order.id,
            priority: (a.order.priority ?? 'NORMAL') as 'NORMAL',
            isPinned: false,
            committedDeliveryDate: a.committed,
            requestedDeliveryDate: a.requested,
            createdAt: a.order.createdAt,
          },
          {
            id: b.order.id,
            customerId: b.order.customerId ?? b.order.salesOrder?.customer?.id ?? b.order.id,
            priority: (b.order.priority ?? 'NORMAL') as 'NORMAL',
            isPinned: false,
            committedDeliveryDate: b.committed,
            requestedDeliveryDate: b.requested,
            createdAt: b.order.createdAt,
          },
        ),
      );

    const results: Array<Awaited<ReturnType<SchedulingService['resolveAtRisk']>>> = [];
    for (const row of classified) {
      results.push(await this.resolveAtRisk(row.schedule.productionOrderId, user));
    }

    const remainingRows = (await this.classifyActiveOrders()).filter((row) =>
      row.classification.contributesToMayBeLate,
    );
    const resolvedAutomatically = results.filter((r) => r.resolvedAutomatically).length;
    const alreadyOnTrack = results.filter((r) => r.action === 'ALREADY_ON_TRACK').length;
    const stillNeedsAttention = results.filter((r) => r.stillNeedsAttention).length;

    await this.audit(user.id, 'schedule.at_risk.resolve_all', 'ProductionSchedule', 'resolve-all', {
      resolvedAutomatically,
      stillNeedsAttention,
      alreadyOnTrack,
      remaining: remainingRows.length,
    });

    return {
      resolvedAutomatically,
      stillNeedsAttention,
      alreadyOnTrack,
      remaining: remainingRows.length,
      results,
    };
  }

  // ── Task lifecycle hook ──────────────────────────────────────────────────

  /**
   * Targeted REPLAN after a domain commit. Fire-and-forget; never await generate
   * on the write path. Jobs with different event/taskId still enqueue (no
   * cross-event collapse). Persist stays idempotent via plannedAllocationsMatch.
   */
  enqueueTargetedReplan(productionOrderId: string, event: string, taskId?: string) {
    return this.enqueueTargetedReplanAsync(productionOrderId, event, taskId);
  }

  private async enqueueTargetedReplanAsync(
    productionOrderId: string,
    event: string,
    taskId?: string,
  ) {
    const schedule = await this.prisma.productionSchedule.findFirst({
      where: {
        productionOrderId,
        status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] },
      },
      orderBy: { version: 'desc' },
    });
    if (!schedule || !isActiveScheduleStatus(schedule.status)) return;
    this.queue
      .enqueue('REPLAN', {
        productionOrderId,
        event,
        ...(taskId ? { taskId } : {}),
      })
      .catch(() => undefined);
  }

  async onTaskLifecycle(taskId: string, event: 'start' | 'pause' | 'complete' | 'blocker') {
    const task = await this.prisma.productionTask.findUnique({
      where: { id: taskId },
      select: { id: true, productionOrderId: true, name: true, number: true },
    });
    if (!task) return;

    if (event === 'blocker') {
      const schedule = await this.prisma.productionSchedule.findFirst({
        where: {
          productionOrderId: task.productionOrderId,
          status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] },
        },
        orderBy: { version: 'desc' },
      });
      if (!schedule || !isActiveScheduleStatus(schedule.status)) return;
      await this.prisma.productionSchedule
        .update({ where: { id: schedule.id }, data: { materialRisk: true } })
        .catch(() => undefined);
      await this.debouncedNotify('SCHEDULE_AT_RISK', task.productionOrderId, () =>
        this.notifications.notifyAdminUsers({
          templateCode: 'SCHEDULE_AT_RISK',
          vars: { reason: `Task ${task.name} reported a blocker` },
          linkUrl: `/production-orders/${task.productionOrderId}`,
        }),
      );
      this.queue.enqueue('RISK_ANALYSIS', { productionOrderId: task.productionOrderId }).catch(() => undefined);
      return;
    }

    // start/pause/complete: enqueue only — never await generate on the task write path.
    await this.enqueueTargetedReplan(task.productionOrderId, event, taskId);
  }

  async enqueueEmployeeReplan(employeeId: string, capacityDelta: CapacityDelta = 'decrease') {
    this.queue
      .enqueue('REPLAN_EMPLOYEE', { employeeId, capacityDelta })
      .catch(() => undefined);
  }

  async enqueueFactoryReplan(
    userId: string | null,
    opts: {
      changeType: string;
      capacityDelta: CapacityDelta;
      affectedYmd?: string | null;
      reason?: string;
      employeeId?: string;
      payload?: Record<string, unknown>;
    },
  ) {
    const run = await this.prisma.schedulingReplanRun.create({
      data: {
        status: 'QUEUED',
        actorId: userId,
        changeType: opts.changeType,
        reason: opts.reason ?? opts.changeType,
        payload: {
          capacityDelta: opts.capacityDelta,
          affectedYmd: opts.affectedYmd ?? null,
          employeeId: opts.employeeId ?? null,
          ...(opts.payload ?? {}),
        },
      },
    });
    await this.audit(userId ?? 'system', 'schedule.factory-replan.enqueued', 'SchedulingReplanRun', run.id, {
      changeType: opts.changeType,
      capacityDelta: opts.capacityDelta,
      affectedYmd: opts.affectedYmd ?? null,
    });
    this.queue.enqueue('REPLAN_FACTORY', { runId: run.id }).catch((err) => {
      this.logger.warn(`REPLAN_FACTORY enqueue failed for ${run.id}: ${String(err)}`);
    });
    return {
      calendarUpdated: true,
      replanQueued: true,
      replanJobId: run.id,
    };
  }

  async enqueueManualSync(userId: string) {
    const inflight = await this.prisma.schedulingReplanRun.findMany({
      where: { status: { in: ['QUEUED', 'RUNNING'] } },
      orderBy: { createdAt: 'asc' },
    });
    const freshRunningCutoff = this.factoryReplanStaleCutoff();
    const live = inflight.filter(
      (row) =>
        row.status === 'QUEUED' ||
        (row.status === 'RUNNING' && row.startedAt && row.startedAt >= freshRunningCutoff),
    );
    const existingSync = live.find((row) => row.changeType === 'manual-sync');
    if (existingSync) {
      await this.audit(userId, 'schedule.sync.requested', 'SchedulingReplanRun', existingSync.id, {
        alreadyInProgress: true,
      });
      return {
        replanQueued: true,
        replanJobId: existingSync.id,
        alreadyInProgress: true,
        status: existingSync.status,
      };
    }
    const other = live[0];
    if (other) {
      throw new ConflictException({
        code: 'SYNC_ALREADY_IN_PROGRESS',
        message: 'A factory schedule update is already in progress.',
        runId: other.id,
      });
    }

    await this.audit(userId, 'schedule.sync.requested', 'SchedulingReplanRun', 'pending', {});
    const queued = await this.enqueueFactoryReplan(userId, {
      changeType: 'manual-sync',
      reason: 'manual-sync',
      capacityDelta: 'sync',
    });
    return {
      replanQueued: queued.replanQueued,
      replanJobId: queued.replanJobId,
      alreadyInProgress: false,
      status: 'QUEUED' as const,
    };
  }

  async getLatestManualSyncRun() {
    return this.prisma.schedulingReplanRun.findFirst({
      where: { changeType: 'manual-sync' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async enqueueCapacityOptimize(userId: string, persist: boolean) {
    const changeType = persist ? OPTIMIZE_APPLY_CHANGE_TYPE : OPTIMIZE_PREVIEW_CHANGE_TYPE;
    const inflight = await this.prisma.schedulingReplanRun.findMany({
      where: { status: { in: ['QUEUED', 'RUNNING'] } },
      orderBy: { createdAt: 'asc' },
    });
    const freshRunningCutoff = this.factoryReplanStaleCutoff();
    const live = inflight.filter(
      (row) =>
        row.status === 'QUEUED' ||
        (row.status === 'RUNNING' && row.startedAt && row.startedAt >= freshRunningCutoff),
    );
    const existingSame = live.find((row) => row.changeType === changeType);
    if (existingSame) {
      await this.audit(userId, 'schedule.optimize.requested', 'SchedulingReplanRun', existingSame.id, {
        alreadyInProgress: true,
        mode: persist ? 'apply' : 'preview',
      });
      return {
        replanQueued: true,
        replanJobId: existingSame.id,
        alreadyInProgress: true,
        status: existingSame.status,
      };
    }
    const other = live[0];
    if (other) {
      throw new ConflictException({
        code: 'OPTIMIZE_ALREADY_IN_PROGRESS',
        message: 'A factory schedule update is already in progress.',
        runId: other.id,
      });
    }

    await this.audit(userId, 'schedule.optimize.requested', 'SchedulingReplanRun', 'pending', {
      mode: persist ? 'apply' : 'preview',
    });
    const queued = await this.enqueueFactoryReplan(userId, {
      changeType,
      reason: changeType,
      capacityDelta: 'optimize',
      payload: { mode: persist ? 'apply' : 'preview' },
    });
    return {
      replanQueued: queued.replanQueued,
      replanJobId: queued.replanJobId,
      alreadyInProgress: false,
      status: 'QUEUED' as const,
    };
  }

  async getLatestCapacityOptimizeRun() {
    return this.prisma.schedulingReplanRun.findFirst({
      where: {
        changeType: { in: [OPTIMIZE_PREVIEW_CHANGE_TYPE, OPTIMIZE_APPLY_CHANGE_TYPE] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReplanRun(id: string) {
    const run = await this.prisma.schedulingReplanRun.findUnique({ where: { id } });
    if (!run) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Replan run not found.' });
    }
    return run;
  }

  private async processSchedulingJob(name: SchedulingJobName, data: Record<string, unknown>) {
    if (name === 'REPLAN' || name === 'SCHEDULE_GENERATE') {
      const poId = typeof data.productionOrderId === 'string' ? data.productionOrderId : '';
      if (!poId) return;
      try {
        await this.generateForProductionOrder(poId, 'system', {
          reason: `async:${name}:${typeof data.event === 'string' ? data.event : ''}`,
        });
      } catch (err) {
        await this.markNeedsReview(poId, null, err);
        throw err;
      }
      return;
    }

    if (name === 'REPLAN_FACTORY') {
      const runId = typeof data.runId === 'string' ? data.runId : '';
      if (!runId) return;
      await this.processFactoryReplan(runId);
      return;
    }

    if (name === 'REPLAN_EMPLOYEE') {
      const employeeId = typeof data.employeeId === 'string' ? data.employeeId : '';
      if (!employeeId) return;
      const delta =
        data.capacityDelta === 'increase' || data.capacityDelta === 'decrease' || data.capacityDelta === 'none'
          ? data.capacityDelta
          : 'decrease';
      await this.replanFutureOrdersForEmployee(employeeId, delta);
      return;
    }

    if (name === 'RISK_ANALYSIS') {
      const poId = typeof data.productionOrderId === 'string' ? data.productionOrderId : '';
      if (!poId) return;
      const classified = await this.classifyProductionOrder(poId);
      if (!classified?.classification.recoverableAutomatically) return;
      try {
        await this.generateForProductionOrder(poId, 'system', {
          reason: 'async:RISK_ANALYSIS',
          failHard: true,
          abortIfMissesCommitment: Boolean(
            classified.schedule?.committedDeliveryDate ?? classified.po.committedDeliveryDate,
          ),
        });
      } catch {
        // Keep the current plan when replan cannot improve the risk outcome.
      }
      return;
    }

    if (name === 'ESTIMATE_STATS') {
      const productId = typeof data.productId === 'string' ? data.productId : undefined;
      await this.computeEstimateStats(productId);
    }
  }

  private async replanFutureOrdersForEmployee(
    employeeId: string,
    capacityDelta: CapacityDelta = 'decrease',
  ) {
    const { calendar } = await this.getCalendarDomain();
    const latestEnd = await this.latestIncompleteAllocationEnd();
    const todayYmd = ymdInTimezone(new Date(), calendar.timezone);
    const horizon = factoryReplanHorizonYmd(todayYmd, latestEnd, calendar.timezone);
    const orders = await this.loadFactoryReplanOrders(
      horizon.fromYmd,
      horizon.toYmd,
      calendar,
      capacityDelta === 'decrease' ? employeeId : null,
    );

    let candidates: FactoryReplanCandidate[] = [];
    if (capacityDelta === 'increase') {
      candidates = selectIncreaseCandidates(orders);
    } else if (capacityDelta === 'decrease') {
      candidates = this.selectEmployeeDecreaseCandidates(orders);
    }

    for (const candidate of candidates) {
      try {
        await this.generateForProductionOrder(candidate.productionOrderId, 'system', {
          reason: 'employee-capacity-changed',
        });
      } catch (err) {
        await this.markNeedsReview(candidate.productionOrderId, null, err);
      }
    }
  }

  private selectEmployeeDecreaseCandidates(
    orders: FactoryReplanOrderInput[],
  ): FactoryReplanCandidate[] {
    const out: FactoryReplanCandidate[] = [];
    for (const order of orders) {
      const movable = order.allocations.some(
        (a) => !a.isPinned && !a.manuallyAdjusted && !this.isImmutableTask(a.taskStatus),
      );
      if (!movable) continue;
      out.push({
        productionOrderId: order.productionOrderId,
        number: order.number,
        urgency: 'decreaseUnpinned',
        priority: order.priority,
      });
    }
    return out.sort(compareFactoryReplanCandidates);
  }

  private isImmutableTask(status?: string | null) {
    return status === 'COMPLETED' || status === 'IN_PROGRESS';
  }

  private async latestIncompleteAllocationEnd(): Promise<Date | null> {
    const row = await this.prisma.scheduleAllocation.findFirst({
      where: {
        plannedEnd: { gte: new Date() },
        schedule: {
          status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] },
          productionOrder: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
        },
      },
      orderBy: { plannedEnd: 'desc' },
      select: { plannedEnd: true },
    });
    return row?.plannedEnd ?? null;
  }

  private async loadFactoryReplanOrders(
    fromYmd: string,
    toYmd: string,
    calendar: WorkingCalendar,
    employeeId?: string | null,
  ): Promise<FactoryReplanOrderInput[]> {
    const classified = await this.classifyActiveOrders();
    const { start, endExclusive } = calendar.localRangeBounds(fromYmd, toYmd);
    const allocations = await this.prisma.scheduleAllocation.findMany({
      where: {
        plannedEnd: { gt: start },
        plannedStart: { lt: endExclusive },
        ...(employeeId ? { employeeId } : {}),
        schedule: {
          status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] },
          productionOrder: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
        },
      },
      select: {
        id: true,
        plannedStart: true,
        plannedEnd: true,
        isPinned: true,
        manuallyAdjusted: true,
        productionTask: { select: { status: true } },
        schedule: { select: { productionOrderId: true } },
      },
    });

    const allocsByPo = new Map<string, FactoryReplanOrderInput['allocations']>();
    for (const a of allocations) {
      const list = allocsByPo.get(a.schedule.productionOrderId) ?? [];
      list.push({
        id: a.id,
        plannedStart: a.plannedStart,
        plannedEnd: a.plannedEnd,
        isPinned: a.isPinned,
        manuallyAdjusted: a.manuallyAdjusted,
        taskStatus: a.productionTask?.status ?? null,
      });
      allocsByPo.set(a.schedule.productionOrderId, list);
    }

    return classified.map((row) => ({
      productionOrderId: row.order.id,
      number: row.order.number,
      classification: {
        primaryStatus: row.classification.primaryStatus,
        recoverableAutomatically: row.classification.recoverableAutomatically,
      },
      planningMode: row.schedule.planningMode,
      requestedDateFeasible: row.schedule.requestedDateFeasible,
      hasPromiseDate: Boolean(row.committed ?? row.requested),
      priority: {
        id: row.order.id,
        customerId: row.order.customerId ?? row.order.id,
        isPinned: (allocsByPo.get(row.order.id) ?? []).some((a) => a.isPinned),
        priority: row.order.priority,
        committedDeliveryDate: row.committed,
        requestedDeliveryDate: row.requested,
        createdAt: row.order.createdAt,
      },
      allocations: allocsByPo.get(row.order.id) ?? [],
    }));
  }

  private async pinnedOnClosedDayCounts(
    calendar: WorkingCalendar,
    from: Date,
    to: Date,
  ): Promise<Record<string, number>> {
    const rows = await this.prisma.scheduleAllocation.findMany({
      where: {
        isPinned: true,
        plannedEnd: { gt: from },
        plannedStart: { lt: to },
        schedule: {
          status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] },
          productionOrder: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
        },
      },
      select: {
        id: true,
        plannedStart: true,
        plannedEnd: true,
        isPinned: true,
        manuallyAdjusted: true,
        productionTask: { select: { status: true } },
        schedule: {
          select: {
            productionOrderId: true,
            productionOrder: { select: { number: true } },
          },
        },
      },
    });
    const issues = listPinnedOnUnavailableCalendar(
      rows
        .filter((a) => a.schedule && (a.isPinned || a.manuallyAdjusted))
        .map((a) => ({
          id: a.id,
          plannedStart: a.plannedStart,
          plannedEnd: a.plannedEnd,
          isPinned: a.isPinned,
          manuallyAdjusted: a.manuallyAdjusted,
          taskStatus: a.productionTask?.status ?? null,
          productionOrderId: a.schedule.productionOrderId,
          orderNumber: a.schedule.productionOrder.number,
        })),
      calendar,
    );
    return countPinnedIssuesByYmd(issues);
  }

  private async loadManualSyncFacts(
    fromYmd: string,
    toYmd: string,
    calendar: WorkingCalendar,
  ): Promise<ManualSyncOrderFacts[]> {
    const [pos, classified, workers, conflicts, orders] = await Promise.all([
      this.prisma.productionOrder.findMany({
        select: {
          id: true,
          number: true,
          status: true,
          quantity: true,
          priority: true,
          customerId: true,
          createdAt: true,
          requiredDeliveryDate: true,
          committedDeliveryDate: true,
          salesOrderId: true,
          salesOrder: { select: { status: true } },
          product: {
            select: {
              bomDefaults: true,
              productionProfile: { select: { id: true } },
              stageEstimates: { select: { id: true, stageDefinitionId: true } },
            },
          },
          tasks: { select: { stageDefinitionId: true, status: true } },
        },
      }),
      this.classifyActiveOrders(),
      this.loadWorkers(),
      this.detectOperationalConflicts(),
      this.loadFactoryReplanOrders(fromYmd, toYmd, calendar),
    ]);

    const classifiedById = new Map(classified.map((row) => [row.order.id, row]));
    const replanById = new Map(orders.map((row) => [row.productionOrderId, row]));
    const workerById = new Map(workers.map((w) => [w.id, w]));
    const decrease = selectDecreaseCandidates(orders, calendar);
    const illegalUnpinned = new Set(decrease.candidates.map((c) => c.productionOrderId));
    const illegalPinned = new Set(decrease.pinnedIssues.map((p) => p.productionOrderId));

    const conflictPo = new Map<string, { movable: boolean; pinned: boolean }>();
    for (const conflict of conflicts) {
      for (const side of [conflict.allocationA, conflict.allocationB]) {
        const prev = conflictPo.get(side.productionOrderId) ?? { movable: false, pinned: false };
        if (isHardLocked(side)) prev.pinned = true;
        else prev.movable = true;
        conflictPo.set(side.productionOrderId, prev);
      }
    }

    const allocRows = await this.prisma.scheduleAllocation.findMany({
      where: {
        schedule: {
          status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] },
          productionOrder: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
        },
      },
      select: {
        employeeId: true,
        isPinned: true,
        plannedStart: true,
        plannedEnd: true,
        productionTask: { select: { status: true, stageDefinitionId: true } },
        schedule: { select: { productionOrderId: true } },
      },
    });
    const allocsByPo = new Map<string, typeof allocRows>();
    for (const row of allocRows) {
      const list = allocsByPo.get(row.schedule.productionOrderId) ?? [];
      list.push(row);
      allocsByPo.set(row.schedule.productionOrderId, list);
    }

    const floor = resolveSchedulingFloor(calendar, new Date());
    const facts: ManualSyncOrderFacts[] = [];
    for (const po of pos) {
      const classifiedRow = classifiedById.get(po.id);
      const replan = replanById.get(po.id);
      const poAllocs = allocsByPo.get(po.id) ?? [];
      let hasStaleIncomplete = false;
      let hasPastIncompletePin = false;
      const futureIncomplete = poAllocs.some((a) => {
        const status = a.productionTask?.status ?? null;
        if (status === 'COMPLETED' || status === 'CANCELLED') return false;
        const cls = classifyAllocationForFloor({
          plannedStart: a.plannedStart,
          isPinned: a.isPinned,
          taskStatus: status,
          floor,
        });
        if (cls === 'STALE') hasStaleIncomplete = true;
        if (cls === 'MANUAL_ATTENTION') hasPastIncompletePin = true;
        return cls === 'FUTURE' || cls === 'IN_PROGRESS';
      });
      const hasActiveSchedule = Boolean(classifiedRow?.schedule);
      const requiredStages = [
        ...new Set(po.tasks.map((t) => t.stageDefinitionId).filter((id): id is string => Boolean(id))),
      ];
      const hasAnyEligible =
        requiredStages.length === 0 ||
        requiredStages.every((stageId) =>
          workers.some((w) => (w.skillStageDefinitionIds ?? []).includes(stageId)),
        );

      let ineligibleAssignedWorker = false;
      for (const alloc of poAllocs) {
        if (!alloc.employeeId || this.isImmutableTask(alloc.productionTask?.status)) continue;
        const worker = workerById.get(alloc.employeeId);
        const stageId = alloc.productionTask?.stageDefinitionId;
        if (!worker || (stageId && !(worker.skillStageDefinitionIds ?? []).includes(stageId))) {
          ineligibleAssignedWorker = true;
          break;
        }
      }

      const missingEstimate =
        !hasActiveSchedule &&
        !po.product?.productionProfile &&
        (po.product?.stageEstimates.length ?? 0) === 0;

      const unschedulable = classifiedRow?.schedule?.unschedulableReason ?? null;
      const reasonCodes = classifiedRow?.classification.reasonCodes ?? [];
      const needsLive =
        !hasActiveSchedule ||
        po.status === 'WAITING_FOR_MATERIALS' ||
        Boolean(classifiedRow?.schedule?.materialRisk) ||
        unschedulable === 'MATERIAL_NOT_READY' ||
        unschedulable === 'WIP_NOT_READY' ||
        classifiedRow?.classification.primaryStatus === 'BLOCKED' ||
        reasonCodes.includes('MATERIAL_NOT_READY') ||
        reasonCodes.includes('WIP_NOT_READY');

      let materialBlocked = false;
      let wipBlocked = false;
      if (needsLive && po.status !== 'CANCELLED' && po.status !== 'COMPLETED') {
        const material = await this.assessLiveMaterialReadiness(po);
        materialBlocked = !material.ready && !material.materialReadyAt;
        const wipReady = await this.assessWipReadiness(po.id, Number(po.quantity) || 1);
        wipBlocked = !wipReady;
      }

      const readiness = {
        materialBlocked,
        wipBlocked,
        noEligibleWorker: !hasAnyEligible,
        missingEstimate,
      };
      const stillBlocked = stillNonRecoverableBlocker(readiness);
      const blockerKind = stillBlocked ? blockerKindFromReadiness(readiness) : null;
      const blockerCleared =
        !stillBlocked &&
        (unschedulable === 'MATERIAL_NOT_READY' ||
          unschedulable === 'WIP_NOT_READY' ||
          unschedulable === 'NO_ELIGIBLE_WORKER');

      const cf = conflictPo.get(po.id);
      facts.push({
        productionOrderId: po.id,
        number: po.number,
        poStatus: po.status,
        hasActiveSchedule,
        hasIncompleteFutureAllocations: futureIncomplete,
        hasStaleIncomplete,
        hasPastIncompletePin,
        primaryStatus: classifiedRow?.classification.primaryStatus ?? null,
        stillBlocked,
        blockerKind,
        blockerCleared,
        illegalUnpinned: illegalUnpinned.has(po.id),
        illegalPinned: illegalPinned.has(po.id),
        ineligibleAssignedWorker: ineligibleAssignedWorker && hasAnyEligible,
        inMovableConflict: Boolean(cf?.movable && !cf.pinned),
        inPinnedConflict: Boolean(cf?.pinned),
        hasPromiseDate: Boolean(po.committedDeliveryDate ?? po.requiredDeliveryDate),
        planningMode: classifiedRow?.schedule.planningMode ?? replan?.planningMode ?? null,
        priority: replan?.priority ?? {
          id: po.id,
          customerId: po.customerId ?? po.id,
          isPinned: poAllocs.some((a) => a.isPinned),
          priority: po.priority,
          committedDeliveryDate: po.committedDeliveryDate,
          requestedDeliveryDate: po.requiredDeliveryDate,
          createdAt: po.createdAt,
        },
      });
    }
    return facts;
  }

  private factoryReplanStaleCutoff(now = new Date()) {
    return new Date(now.getTime() - 20 * 60_000);
  }

  private async reapStaleFactoryReplans(exceptId: string) {
    await this.prisma.schedulingReplanRun.updateMany({
      where: {
        id: { not: exceptId },
        status: 'RUNNING',
        OR: [{ startedAt: { lt: this.factoryReplanStaleCutoff() } }, { startedAt: null }],
      },
      data: {
        status: 'FAILED',
        result: { message: 'stale RUNNING factory replan reaped' } as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  }

  private async waitForOtherFactoryReplans(selfId: string, timeoutMs = 90_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const other = await this.prisma.schedulingReplanRun.findFirst({
        where: {
          id: { not: selfId },
          status: 'RUNNING',
          startedAt: { gte: this.factoryReplanStaleCutoff() },
        },
        select: { id: true },
      });
      if (!other) return;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  private workingDaysBetween(calendar: WorkingCalendar, from: Date, to: Date): number {
    const tz = calendar.timezone;
    const fromYmd = ymdInTimezone(from, tz);
    const toYmd = ymdInTimezone(to, tz);
    if (fromYmd === toYmd) return 0;
    const dir = fromYmd < toYmd ? 1 : -1;
    let n = 0;
    let cursor = fromYmd;
    let guard = 0;
    while (cursor !== toYmd && guard < 400) {
      cursor = addDaysYmd(cursor, dir);
      if (calendar.intervalsForLocalYmd(cursor).length > 0 || cursor === toYmd) {
        if (cursor !== toYmd && calendar.intervalsForLocalYmd(cursor).length > 0) n += 1;
        else if (cursor === toYmd) break;
      }
      guard += 1;
    }
    return n * dir;
  }

  private async runCapacityOptimize(
    run: { id: string; actorId: string | null; changeType: string; reason: string | null },
    persist: boolean,
  ) {
    const { calendar, row: calendarRow } = await this.getCalendarDomain();
    const now = resolveSchedulingFloor(calendar, new Date());
    const earlyWindow =
      calendarRow.maxProductionEarlyWorkingDays != null
        ? calendarRow.maxProductionEarlyWorkingDays
        : 10;
    const targetUtil = calendarRow.targetFactoryUtilizationPercent ?? 85;
    const world = await loadCapacityOptimizeWorld(this.prisma, {
      calendar,
      bufferWorkingDays: calendarRow.deliveryBufferWorkingDays ?? 1,
      now,
    });
    const current = simulatePolicy(world, 'CURRENT');
    const nDay = simulatePolicy(world, 'N_DAY', earlyWindow);
    const currentWithCauses = attachEmptyDayCauses(current, nDay, world);
    const movable = movableSimOrders(nDay).filter((order) =>
      order.allocations.every((alloc) => {
        const sim = world.orders.find((o) => o.id === order.orderId);
        const currentAlloc = sim?.currentAllocations.find((c) => c.stageCode === alloc.stageCode);
        return !allocationViolatesSchedulingFloor({
          plannedStart: alloc.plannedStart,
          isPinned: currentAlloc?.isPinned ?? alloc.isPinned,
          taskStatus: currentAlloc?.taskStatus ?? null,
          floor: now,
        });
      }),
    );
    const blocked = blockedSimOrders(nDay);
    const emptyDays = currentWithCauses.days
      .filter((d) => d.bucket === 'EMPTY' || d.bucket === 'LT_25')
      .map((d) => ({
        ymd: d.ymd,
        cause: d.cause,
        causeKey: emptyDayCauseI18nKey(d.cause),
        occupancyUtilPct: d.occupancyUtilPct,
      }));
    const previewMoves = movable.map((order) => {
      const simOrder = world.orders.find((o) => o.id === order.orderId);
      const commercial = simOrder?.committedDeliveryDate ?? simOrder?.requestedDeliveryDate ?? null;
      const daysFinishedBeforeDelivery =
        order.earliestCompletion && commercial
          ? this.workingDaysBetween(calendar, order.earliestCompletion, commercial)
          : null;
      return {
        productionOrderId: order.orderId,
        number: order.number ?? null,
        currentCompletion: order.currentCompletion?.toISOString() ?? null,
        proposedCompletion: order.earliestCompletion?.toISOString() ?? null,
        daysEarlier:
          order.earliestCompletion && order.currentCompletion
            ? this.workingDaysBetween(calendar, order.earliestCompletion, order.currentCompletion)
            : 0,
        daysFinishedBeforeDelivery,
        primaryStatus: simOrder?.primaryStatus ?? null,
        blockReason: order.blockReason,
      };
    });

    const blockedItems = blocked.map((order) => ({
      productionOrderId: order.orderId,
      number: order.number ?? '',
      blockerKind: order.blockReason,
    }));

    const avgBefore = current.avgOccupancyUtilPct;
    const avgAfter = nDay.avgOccupancyUtilPct;
    const front10Before =
      current.days.slice(0, 10).reduce((s, d) => s + d.occupancyUtilPct, 0) /
      Math.max(1, Math.min(10, current.days.length));
    const front10After =
      nDay.days.slice(0, 10).reduce((s, d) => s + d.occupancyUtilPct, 0) /
      Math.max(1, Math.min(10, nDay.days.length));

    const previewResult = {
      status: 'COMPLETED' as const,
      capacityDelta: 'optimize' as const,
      mode: persist ? ('apply' as const) : ('preview' as const),
      earlyWindowWorkingDays: earlyWindow,
      targetFactoryUtilizationPercent: targetUtil,
      scannedOrders: world.orders.length,
      candidateOrders: movable.length,
      alreadyValid: world.orders.length - movable.length - blocked.length,
      moved: 0,
      movedEarlier: 0,
      movedLater: 0,
      generated: 0,
      replanned: 0,
      wouldMove: movable.length,
      previewMoves,
      blocked: blockedItems.length,
      blockedItems,
      emptyDays,
      avgOccupancyUtilPctBefore: avgBefore,
      avgOccupancyUtilPctAfter: avgAfter,
      front10OccupancyUtilPctBefore: front10Before,
      front10OccupancyUtilPctAfter: front10After,
      materialViolations: nDay.materialViolations,
      newWorkerConflicts: 0,
      newResourceConflicts: 0,
      newConflictCount: 0,
      newConflictsIntroduced: 0,
      conflictsResolved: 0,
      failures: [] as Array<{ productionOrderId: string; message: string }>,
      collisionsSkipped: [] as Array<{ productionOrderId: string; number: string | null }>,
      outcome: deriveOptimizeOutcome({
        moved: persist ? 0 : movable.length,
        failures: 0,
        collisionsSkipped: 0,
        newConflictCount: 0,
      }),
      stillNeedsAttention: blockedItems.length,
    };

    if (!persist) {
      return previewResult;
    }

    const sortedIds = sortPullForwardOrders(
      movable
        .map((m) => world.orders.find((o) => o.id === m.orderId))
        .filter((o): o is NonNullable<typeof o> => Boolean(o)),
    ).map((o) => o.id);

    const conflictsBefore = await this.detectOperationalConflicts();
    const preOverlapKeys = new Set(conflictsBefore.map((c) => operationalOverlapKey(c)));
    let occupancy = await this.loadOccupancy();
    const moved: string[] = [];
    const collisionsSkipped: Array<{ productionOrderId: string; number: string | null }> = [];
    const failures: Array<{ productionOrderId: string; message: string }> = [];
    let movedEarlier = 0;
    const recoveredAtRisk: string[] = [];

    for (const poId of sortedIds) {
      const sim = world.orders.find((o) => o.id === poId);
      const riskBefore =
        sim?.primaryStatus === 'LATE' || sim?.primaryStatus === 'AT_RISK';
      const beforeFp = await this.snapshotScheduleFingerprint(poId);
      const occupancyForPo = unionOccupancyIntervals(stripOccupancyForOrder(occupancy, poId));
      try {
        const detail = await this.generateForProductionOrder(poId, run.actorId ?? 'system', {
          reason: 'capacity-optimize',
          mode: 'forward',
          earlyWindowWorkingDays: earlyWindow,
          existingOccupancy: occupancyForPo,
          validateAgainstOccupancy: true,
          abortIfMissesCommitment: true,
        });
        occupancy = unionOccupancyIntervals([
          ...stripOccupancyForOrder(occupancy, poId),
          ...occupancyFromGeneratedAllocations(poId, detail?.schedule?.allocations ?? []),
        ]);
        const afterFp = await this.snapshotScheduleFingerprint(poId);
        if (beforeFp && afterFp && beforeFp === afterFp) continue;
        moved.push(poId);
        const beforeMs = this.projectedMsFromFingerprint(beforeFp);
        const afterMs = this.projectedMsFromFingerprint(afterFp);
        if (beforeMs != null && afterMs != null && afterMs < beforeMs) movedEarlier += 1;
        if (riskBefore) {
          const after = await this.classifyProductionOrder(poId);
          if (
            after &&
            after.classification.primaryStatus !== 'LATE' &&
            after.classification.primaryStatus !== 'AT_RISK' &&
            after.classification.primaryStatus !== 'BLOCKED'
          ) {
            recoveredAtRisk.push(poId);
          }
        }
      } catch (err) {
        if (err instanceof OccupancyCollisionError) {
          collisionsSkipped.push({ productionOrderId: poId, number: sim?.number ?? null });
          continue;
        }
        failures.push({
          productionOrderId: poId,
          message: err instanceof Error ? err.message : 'optimize failed',
        });
      }
    }

    const conflictsAfter = await this.detectOperationalConflicts();
    const postOverlapKeys = new Set(conflictsAfter.map((c) => operationalOverlapKey(c)));
    const newConflicts = conflictsAfter.filter((c) => !preOverlapKeys.has(operationalOverlapKey(c)));
    const newWorkerConflicts = newConflicts.filter((c) => c.type === 'WORKER_OVERLAP').length;
    const newResourceConflicts = newConflicts.filter((c) => c.type !== 'WORKER_OVERLAP').length;
    const conflictsResolved = [...preOverlapKeys].filter((key) => !postOverlapKeys.has(key)).length;
    const outcome = deriveOptimizeOutcome({
      moved: moved.length,
      failures: failures.length,
      collisionsSkipped: collisionsSkipped.length,
      newConflictCount: newConflicts.length,
    });

    return {
      ...previewResult,
      mode: 'apply' as const,
      moved: moved.length,
      movedEarlier,
      movedLater: 0,
      generated: 0,
      replanned: moved.length,
      movedIds: moved,
      recoveredAtRisk: recoveredAtRisk.length,
      atRiskRecovered: recoveredAtRisk.length,
      collisionsSkipped,
      failures,
      newWorkerConflicts,
      newResourceConflicts,
      newConflictCount: newConflicts.length,
      newConflictsIntroduced: newConflicts.length,
      remainingConflicts: conflictsAfter.length,
      conflictsResolved,
      outcome,
      stillNeedsAttention: blockedItems.length + failures.length + collisionsSkipped.length,
    };
  }

  private async processFactoryReplan(runId: string) {
    const run = await this.prisma.schedulingReplanRun.findUnique({ where: { id: runId } });
    if (!run) return;
    if (run.status === 'COMPLETED' || run.status === 'FAILED') return;

    await this.reapStaleFactoryReplans(runId);
    await this.waitForOtherFactoryReplans(runId);
    const otherRunning = await this.prisma.schedulingReplanRun.findFirst({
      where: {
        id: { not: runId },
        status: 'RUNNING',
        startedAt: { gte: this.factoryReplanStaleCutoff() },
      },
      select: { id: true },
    });
    if (otherRunning) {
      throw new Error(`FACTORY_REPLAN_BUSY:${otherRunning.id}`);
    }

    const latest = await this.prisma.schedulingReplanRun.findUnique({ where: { id: runId } });
    if (!latest || latest.status === 'COMPLETED' || latest.status === 'FAILED') return;

    await this.prisma.schedulingReplanRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    await this.audit(
      latest.actorId ?? 'system',
      isOptimizeChangeType(latest.changeType)
        ? 'schedule.optimize.started'
        : latest.changeType === 'manual-sync'
          ? 'schedule.sync.started'
          : 'schedule.factory-replan.started',
      'SchedulingReplanRun',
      runId,
      {
      changeType: latest.changeType,
    });

    try {
      const payload = (latest.payload ?? {}) as {
        capacityDelta?: CapacityDelta;
        affectedYmd?: string | null;
        employeeId?: string | null;
        mode?: 'preview' | 'apply';
      };
      const capacityDelta = payload.capacityDelta ?? 'none';
      if (capacityDelta === 'optimize') {
        const result = await this.runCapacityOptimize(latest, payload.mode === 'apply');
        await this.prisma.schedulingReplanRun.update({
          where: { id: runId },
          data: {
            status: 'COMPLETED',
            result: result as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
        await this.audit(latest.actorId ?? 'system', 'schedule.optimize.completed', 'SchedulingReplanRun', runId, {
          outcome: result.outcome,
          moved: result.moved,
          newConflictCount: result.newConflictCount,
        });
        return;
      }
      const { calendar } = await this.getCalendarDomain();
      const latestEnd = await this.latestIncompleteAllocationEnd();
      const horizon = factoryReplanHorizonYmd(
        payload.affectedYmd ?? null,
        latestEnd,
        calendar.timezone,
      );
      const orders = await this.loadFactoryReplanOrders(
        horizon.fromYmd,
        horizon.toYmd,
        calendar,
        payload.employeeId ?? null,
      );

      let candidates: FactoryReplanCandidate[] = [];
      let pinnedIssues: PinnedUnavailableIssue[] = [];
      let scannedOrders = orders.length;
      let alreadyValid = 0;
      let generatedIds: string[] = [];
      const blockedItems: Array<{ productionOrderId: string; number: string; blockerKind?: string | null }> = [];
      const manualAttentionItems: Array<{ productionOrderId: string; number: string }> = [];
      let syncSelection: ReturnType<typeof selectManualSyncCandidates> | null = null;
      let staleSyncIds = new Set<string>();

      if (capacityDelta === 'increase') {
        const floor = resolveSchedulingFloor(calendar);
        const floorYmd = ymdInTimezone(floor, calendar.timezone);
        if (isHistoricalCapacityIncrease(payload.affectedYmd, floorYmd)) {
          candidates = [];
        } else {
          candidates = selectIncreaseCandidates(orders);
        }
      } else if (capacityDelta === 'decrease') {
        const selected = selectDecreaseCandidates(orders, calendar);
        candidates = selected.candidates;
        pinnedIssues = selected.pinnedIssues;
      } else if (capacityDelta === 'sync') {
        const facts = await this.loadManualSyncFacts(horizon.fromYmd, horizon.toYmd, calendar);
        syncSelection = selectManualSyncCandidates(facts);
        candidates = syncSelection.candidates;
        scannedOrders = syncSelection.scanned;
        alreadyValid = syncSelection.alreadyValid;
        blockedItems.push(...syncSelection.blocked);
        manualAttentionItems.push(...syncSelection.manualAttention);
        pinnedIssues = syncSelection.manualAttention.map((item) => ({
          productionOrderId: item.productionOrderId,
          allocationId: item.productionOrderId,
          orderNumber: item.number,
          ymd: '',
        }));
        staleSyncIds = new Set(
          facts.filter((f) => f.hasStaleIncomplete).map((f) => f.productionOrderId),
        );
      }

      const moved: string[] = [];
      const unchanged: string[] = [];
      const recoveredAtRisk: string[] = [];
      const failures: Array<{ productionOrderId: string; message: string }> = [];
      let atRiskBefore = 0;
      let movedEarlier = 0;
      let movedLater = 0;
      const conflictsBefore = await this.detectOperationalConflicts();
      const preExistingConflictIds = conflictsBefore.map((c) => c.conflictId);
      let occupancy = await this.loadOccupancy();
      const isSync = capacityDelta === 'sync';

      for (const candidate of candidates) {
        const before = orders.find((o) => o.productionOrderId === candidate.productionOrderId);
        const fact = syncSelection
          ? null
          : before;
        const riskBefore =
          before?.classification.primaryStatus === 'LATE' ||
          before?.classification.primaryStatus === 'AT_RISK' ||
          (isSync && (candidate.urgency === 'late' || candidate.urgency === 'atRisk'));
        if (riskBefore) atRiskBefore += 1;
        void fact;
        const beforeFp = await this.snapshotScheduleFingerprint(candidate.productionOrderId);
        const occupancyForPo = unionOccupancyIntervals(
          stripOccupancyForOrder(occupancy, candidate.productionOrderId),
        );
        const genOpts = {
          reason: latest.reason ?? (isSync ? 'manual-sync' : 'factory-replan'),
          existingOccupancy: occupancyForPo,
          validateAgainstOccupancy: true,
        };
        try {
          let generatedOk = false;
          for (let attempt = 0; attempt < 2 && !generatedOk; attempt += 1) {
            try {
              const detail = await this.generateForProductionOrder(
                candidate.productionOrderId,
                latest.actorId ?? 'system',
                genOpts,
              );
              generatedOk = true;
              occupancy = unionOccupancyIntervals([
                ...stripOccupancyForOrder(occupancy, candidate.productionOrderId),
                ...occupancyFromGeneratedAllocations(
                  candidate.productionOrderId,
                  detail?.schedule?.allocations ?? [],
                ),
              ]);
            } catch (err) {
              if (err instanceof OccupancyCollisionError && attempt === 0) continue;
              throw err;
            }
          }
          const afterFp = await this.snapshotScheduleFingerprint(candidate.productionOrderId);
          if (beforeFp && afterFp && beforeFp === afterFp) {
            unchanged.push(candidate.productionOrderId);
            if (isSync) alreadyValid += 1;
          } else {
            moved.push(candidate.productionOrderId);
            if (!beforeFp) generatedIds.push(candidate.productionOrderId);
            const beforeMs = this.projectedMsFromFingerprint(beforeFp);
            const afterMs = this.projectedMsFromFingerprint(afterFp);
            if (beforeMs != null && afterMs != null) {
              if (afterMs < beforeMs) movedEarlier += 1;
              else if (afterMs > beforeMs) movedLater += 1;
            }
            const after = await this.classifyProductionOrder(candidate.productionOrderId);
            if (
              riskBefore &&
              after &&
              after.classification.primaryStatus !== 'LATE' &&
              after.classification.primaryStatus !== 'AT_RISK' &&
              after.classification.primaryStatus !== 'BLOCKED'
            ) {
              recoveredAtRisk.push(candidate.productionOrderId);
            }
          }
        } catch (err) {
          failures.push({
            productionOrderId: candidate.productionOrderId,
            message: err instanceof Error ? err.message : 'replan failed',
          });
        }
      }

      const conflictsAfter = await this.detectOperationalConflicts();
      const postConflictIds = conflictsAfter.map((c) => c.conflictId);
      const preOverlapKeys = new Set(conflictsBefore.map((c) => operationalOverlapKey(c)));
      const postOverlapKeys = new Set(conflictsAfter.map((c) => operationalOverlapKey(c)));
      const newConflicts = conflictsAfter
        .filter((c) => !preOverlapKeys.has(operationalOverlapKey(c)))
        .map((c) => ({
        conflictId: c.conflictId,
        overlapKey: operationalOverlapKey(c),
        type: c.type,
        orderA: c.allocationA.productionOrderId,
        orderB: c.allocationB.productionOrderId,
        allocA: c.allocationA.allocationId,
        allocB: c.allocationB.allocationId,
        workerOrResource: c.worker?.id ?? (c.resource ? `${c.resource.stageDefinitionId}:${c.resource.slot}` : null),
        overlapStart: c.overlapStart.toISOString(),
        overlapEnd: c.overlapEnd.toISOString(),
        indexA: candidates.findIndex((x) => x.productionOrderId === c.allocationA.productionOrderId),
        indexB: candidates.findIndex((x) => x.productionOrderId === c.allocationB.productionOrderId),
      }));
      const conflictsResolved = [...preOverlapKeys].filter((key) => !postOverlapKeys.has(key)).length;
      const replannedCount = moved.filter((id) => !generatedIds.includes(id)).length;
      const pastDueRescheduled = isSync
        ? moved.filter((id) => staleSyncIds.has(id)).length
        : 0;
      const outcome = isSync
        ? deriveManualSyncOutcome({
            generated: generatedIds.length,
            replanned: replannedCount,
            failures: failures.length,
            blocked: blockedItems.length,
            manualAttention: manualAttentionItems.length,
          })
        : undefined;

      const result = {
        status: 'COMPLETED',
        capacityDelta,
        horizon,
        outcome,
        scannedOrders,
        alreadyValid: isSync ? alreadyValid : unchanged.length,
        generated: generatedIds.length,
        generatedIds,
        replanned: isSync ? replannedCount : moved.length,
        pastDueRescheduled,
        candidateOrders: candidates.length,
        considered: candidates.length,
        replannedOrders: moved.length,
        moved: moved.length,
        movedEarlier: isSync ? movedEarlier : moved.length,
        movedLater: isSync ? movedLater : 0,
        unchanged: unchanged.length,
        atRiskResolved: recoveredAtRisk.length,
        recoveredAtRisk: recoveredAtRisk.length,
        atRiskRecovered: recoveredAtRisk.length,
        atRiskBefore,
        stillAtRisk: Math.max(0, atRiskBefore - recoveredAtRisk.length),
        blocked: blockedItems.length,
        blockedItems,
        manualAttention: manualAttentionItems.length,
        manualAttentionItems,
        stillNeedsAttention:
          pinnedIssues.length + failures.length + newConflicts.length + blockedItems.length,
        pinnedIssues,
        pinnedIssueCount: pinnedIssues.length,
        failures,
        movedIds: moved,
        unchangedIds: unchanged,
        preExistingConflictCount: preExistingConflictIds.length,
        postConflictCount: postConflictIds.length,
        remainingConflicts: postConflictIds.length,
        conflictsResolved,
        newConflictCount: newConflicts.length,
        newConflictsIntroduced: newConflicts.length,
        newConflictIds: newConflicts.map((c) => c.conflictId),
        newConflicts,
        attentionItems: [...blockedItems, ...manualAttentionItems],
      };

      await this.prisma.schedulingReplanRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          result: result as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      const doneAction =
        latest.changeType === 'manual-sync' ? 'schedule.sync.completed' : 'schedule.factory-replan.completed';
      await this.audit(latest.actorId ?? 'system', doneAction, 'SchedulingReplanRun', runId, {
        moved: result.moved,
        recoveredAtRisk: result.recoveredAtRisk,
        pinnedIssueCount: result.pinnedIssueCount,
        failures: failures.length,
        outcome: result.outcome ?? null,
      });
      } catch (err) {
        await this.prisma.schedulingReplanRun.update({
          where: { id: runId },
          data: {
            status: 'FAILED',
            result: {
              message: err instanceof Error ? err.message : 'replan failed',
            } as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
        await this.audit(
          latest.actorId ?? 'system',
          isOptimizeChangeType(latest.changeType)
            ? 'schedule.optimize.failed'
            : latest.changeType === 'manual-sync'
              ? 'schedule.sync.failed'
              : 'schedule.factory-replan.failed',
          'SchedulingReplanRun',
          runId,
          {
          message: err instanceof Error ? err.message : 'replan failed',
        });
        throw err;
      }
  }

  // ── Estimate learning ────────────────────────────────────────────────────

  async computeEstimateStats(productId?: string) {
    const tasks = await this.prisma.productionTask.findMany({
      where: {
        status: 'COMPLETED',
        actualMinutes: { not: null },
        stageDefinitionId: { not: null },
        ...(productId ? { productionOrder: { productId } } : {}),
      },
      select: {
        actualMinutes: true,
        estimatedMinutes: true,
        stageDefinitionId: true,
        productionOrder: { select: { productId: true } },
      },
      take: 5000,
    });

    const groups = new Map<
      string,
      { productId: string; stageDefinitionId: string; actual: number[]; estimated: number[] }
    >();
    for (const t of tasks) {
      const pid = t.productionOrder.productId;
      if (!pid || !t.stageDefinitionId || t.actualMinutes == null) continue;
      const key = `${pid}:${t.stageDefinitionId}`;
      const g = groups.get(key) ?? { productId: pid, stageDefinitionId: t.stageDefinitionId, actual: [], estimated: [] };
      g.actual.push(t.actualMinutes);
      if (t.estimatedMinutes != null) g.estimated.push(t.estimatedMinutes);
      groups.set(key, g);
    }

    const results = [];
    for (const g of groups.values()) {
      const avgActual = mean(g.actual);
      const med = median(g.actual);
      const avgEstimated = g.estimated.length ? mean(g.estimated) : null;
      const variance = avgEstimated != null ? avgActual - avgEstimated : null;
      const row = await this.prisma.stageEstimateStat.upsert({
        where: { productId_stageDefinitionId: { productId: g.productId, stageDefinitionId: g.stageDefinitionId } },
        create: {
          productId: g.productId,
          stageDefinitionId: g.stageDefinitionId,
          sampleSize: g.actual.length,
          avgActualMinutes: avgActual,
          medianActualMinutes: med,
          avgEstimatedMinutes: avgEstimated ?? undefined,
          varianceMinutes: variance ?? undefined,
          suggestedMinutes: Math.round(med),
          lastComputedAt: new Date(),
        },
        update: {
          sampleSize: g.actual.length,
          avgActualMinutes: avgActual,
          medianActualMinutes: med,
          avgEstimatedMinutes: avgEstimated ?? undefined,
          varianceMinutes: variance ?? undefined,
          suggestedMinutes: Math.round(med),
          lastComputedAt: new Date(),
        },
      });
      results.push(row);
    }
    return { data: results };
  }

  async acceptSuggestedEstimate(proposalId: string, userId: string) {
    const proposal = await this.prisma.schedulingEstimateProposal.findUnique({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Estimate proposal not found.' });
    if (!proposal.productId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Proposal is not linked to a product.' });
    }

    const stageEstimates =
      (proposal.stageEstimates as Array<{
        stageDefinitionId: string;
        setupMinutes?: number;
        minutesPerUnit?: number;
        fixedMinutes?: number;
        quantityScalingMode?: Prisma.ProductStageEstimateCreateInput['quantityScalingMode'];
      }> | null) ?? [];

    await this.prisma.$transaction(async (tx) => {
      for (const se of stageEstimates) {
        if (!se.stageDefinitionId) continue;
        await tx.productStageEstimate.upsert({
          where: {
            productId_stageDefinitionId: { productId: proposal.productId!, stageDefinitionId: se.stageDefinitionId },
          },
          create: {
            productId: proposal.productId!,
            stageDefinitionId: se.stageDefinitionId,
            setupMinutes: se.setupMinutes ?? 0,
            minutesPerUnit: se.minutesPerUnit ?? 0,
            fixedMinutes: se.fixedMinutes ?? 0,
            quantityScalingMode: se.quantityScalingMode ?? 'SETUP_PLUS_LINEAR',
          },
          update: {
            setupMinutes: se.setupMinutes ?? 0,
            minutesPerUnit: se.minutesPerUnit ?? 0,
            fixedMinutes: se.fixedMinutes ?? 0,
            quantityScalingMode: se.quantityScalingMode ?? 'SETUP_PLUS_LINEAR',
          },
        });
      }
      await tx.schedulingEstimateProposal.update({
        where: { id: proposalId },
        data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById: userId },
      });
    });

    if (proposal.productionOrderId) {
      await this.generateForProductionOrder(proposal.productionOrderId, userId, {
        reason: 'Estimate proposal accepted',
      }).catch(() => undefined);
    }

    return this.prisma.schedulingEstimateProposal.findUnique({ where: { id: proposalId } });
  }

  /**
   * Stub integration point for AI intake (see apps/api/src/modules/ai-intake).
   *
   * Intent: once an AI extraction job finishes and yields a
   * `manufacturingComplexity` / `estimatedEffort` signal for a request, that
   * job should call this method to record a **PENDING** SchedulingEstimateProposal
   * so a human can later approve it via `acceptSuggestedEstimate`.
   *
   * This never touches ProductionOrder dates and never approves anything by
   * itself — AI may only ever propose a *stage-estimate* starting point, not a
   * committed or suggested delivery date. Full wiring (extraction schema +
   * mapper + prompt changes in `packages/integrations` and
   * `apps/api/src/modules/ai-intake`) was judged too invasive for this pass;
   * see docs/scheduling-web-changes.md for the rationale and the intended
   * follow-up shape of `input`.
   */
  async acceptAiEstimateProposal(input: {
    requestId?: string;
    productId?: string;
    manufacturingComplexity?: 'STANDARD' | 'MODIFIED' | 'CUSTOM';
    estimatedEffortMinutes?: number;
    reasons?: string[];
  }) {
    if (!input.productId) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'acceptAiEstimateProposal requires a productId (stub — not yet wired to AI intake).',
      });
    }

    return this.prisma.schedulingEstimateProposal.create({
      data: {
        productId: input.productId,
        requestId: input.requestId,
        complexity: input.manufacturingComplexity ?? 'CUSTOM',
        stageEstimates: input.estimatedEffortMinutes
          ? [{ note: 'AI-proposed effort (minutes), stage mapping pending', minutesPerUnit: input.estimatedEffortMinutes }]
          : [],
        confidence: 'LOW',
        reasons: input.reasons ?? ['Created by AI intake stub — requires human review'],
        status: 'PENDING',
      },
    });
  }

  // ── Stage dependency guard (used by production-stages controller) ───────

  async assertNoStageCycles(defs: Array<{ code: string; dependsOnCodes: string[] }>) {
    const graph = buildDependencyGraph(defs);
    const cycle = detectCycles(graph);
    if (cycle.length > 0) {
      throw new BadRequestException({
        code: 'STAGE_CYCLE',
        message: `Stage dependency cycle detected: ${cycle.join(' -> ')}`,
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async debouncedNotify(templateCode: string, entityId: string, fn: () => Promise<unknown>) {
    const key = `${templateCode}:${entityId}`;
    const last = this.notifyDebounce.get(key) ?? 0;
    const now = Date.now();
    if (now - last < DEBOUNCE_WINDOW_MS) return;
    this.notifyDebounce.set(key, now);
    await fn().catch(() => undefined);
  }

  private async audit(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    newValues: unknown,
  ) {
    await this.prisma.auditEvent
      .create({
        data: {
          userId,
          action,
          entityType,
          entityId,
          newValues: (newValues ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      })
      .catch(() => undefined);
  }
}
