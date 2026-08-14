import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { IdempotencyService } from '../../common/idempotency.service';
import { assertCustomerOwns } from '../../common/helpers/customer-scope';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulingQueueService } from './scheduling-queue';
import { bomToReadinessInput } from '../../common/helpers/inventory-reservation.util';
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
  resolveDealerChangePolicy,
  validateSchedule,
  WorkingCalendar,
  assessMaterialReadiness,
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

@Injectable()
export class SchedulingService {
  /** Coalesces same template+entity notification bursts within DEBOUNCE_WINDOW_MS. */
  private readonly notifyDebounce = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly idempotency: IdempotencyService,
    private readonly queue: SchedulingQueueService,
  ) {}

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
    const row = await this.ensureDefaultCalendar();
    await this.prisma.factoryCalendar.update({
      where: { id: row.id },
      data: {
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.workingWeekdays ? { workingWeekdays: dto.workingWeekdays } : {}),
        ...(dto.shiftStart ? { shiftStart: dto.shiftStart } : {}),
        ...(dto.shiftEnd ? { shiftEnd: dto.shiftEnd } : {}),
        ...(dto.breaks ? { breaks: dto.breaks as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    await this.audit(userId, 'schedule.calendar.update', 'FactoryCalendar', row.id, dto);
    const calendar = await this.getCalendar();
    const { replanned } = await this.replanActiveSchedules(userId, 'calendar-settings-updated');
    return { ...calendar, replanned };
  }

  async addException(dto: CalendarExceptionDto, userId: string) {
    const row = await this.ensureDefaultCalendar();
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
    const { replanned } = await this.replanActiveSchedules(userId, `calendar-exception:${dto.type}`);
    return { ...exception, replanned };
  }

  async deleteException(dateYmd: string, userId: string) {
    const row = await this.ensureDefaultCalendar();
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
    const { replanned } = await this.replanActiveSchedules(userId, 'calendar-exception:cleared');
    return { deleted: true, date: dateYmd, replanned };
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
    }> = [];
    const cursor = new Date(from);
    let guard = 0;
    while (cursor.getTime() <= to.getTime() && guard < maxDays) {
      const intervals = calendar.intervalsForLocalDay(cursor);
      days.push({
        date: cursor.toISOString().slice(0, 10),
        isWorking: intervals.length > 0,
        intervals: intervals.map((iv) => ({ start: iv.start.toISOString(), end: iv.end.toISOString() })),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      guard += 1;
    }
    const orders = await this.buildOrderCards(from, new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1));
    return { calendar: row, days, orders };
  }

  /** Order-level cards (PO#, product, dealer, planned window, status) for calendar views. */
  private async buildOrderCards(fromDate: Date, toDate: Date) {
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
      minStart: Date;
      maxEnd: Date;
    }
    const byOrder = new Map<string, Bucket>();
    for (const a of allocations) {
      const key = a.schedule.productionOrderId;
      const existing = byOrder.get(key);
      if (!existing) {
        byOrder.set(key, {
          scheduleId: a.schedule.id,
          version: a.schedule.version,
          status: a.schedule.status,
          promiseState: a.schedule.promiseState,
          materialRisk: a.schedule.materialRisk,
          minStart: a.plannedStart,
          maxEnd: a.plannedEnd,
        });
        continue;
      }
      // Ignore older schedule versions entirely — unioning their windows made
      // recalculate/date-change look like a no-op when APPROVED + PROPOSED both existed.
      if (a.schedule.version < existing.version) continue;
      if (a.schedule.version > existing.version) {
        byOrder.set(key, {
          scheduleId: a.schedule.id,
          version: a.schedule.version,
          status: a.schedule.status,
          promiseState: a.schedule.promiseState,
          materialRisk: a.schedule.materialRisk,
          minStart: a.plannedStart,
          maxEnd: a.plannedEnd,
        });
        continue;
      }
      if (a.plannedStart.getTime() < existing.minStart.getTime()) existing.minStart = a.plannedStart;
      if (a.plannedEnd.getTime() > existing.maxEnd.getTime()) existing.maxEnd = a.plannedEnd;
    }

    const conflicts = await this.listConflicts();
    const conflictOrderIds = new Set<string>();
    for (const c of conflicts.data) {
      conflictOrderIds.add(c.a.productionOrderId);
      conflictOrderIds.add(c.b.productionOrderId);
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

    return orderIds.map((id) => {
      const bucket = byOrder.get(id)!;
      const order = orderById.get(id);
      const customer =
        order?.salesOrder?.customer ?? (order?.customerId ? orphanById.get(order.customerId) ?? null : null);
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
        hasConflict: conflictOrderIds.has(id),
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

    const [workers, occupancy, { calendar }] = await Promise.all([
      this.loadWorkers(),
      this.loadOccupancy(),
      this.getCalendarDomain(),
    ]);
    const now = new Date();
    const requestedDeliveryDate = dto.requestedDeliveryDate ? new Date(dto.requestedDeliveryDate) : null;
    if (dto.requestedDeliveryDate && Number.isNaN(requestedDeliveryDate?.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid requestedDeliveryDate.' });
    }

    const orderInput: PlannerOrderInput = {
      id: 'availability-check',
      customerId: user?.customerId ?? dto.customerId ?? 'anonymous',
      priority: 'NORMAL',
      createdAt: now,
      requestedDeliveryDate,
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
        employeeId: { not: null },
        plannedEnd: { gte: now },
        schedule: {
          status: { in: ['APPROVED', 'PROPOSED'] },
          ...(excludePoId ? { productionOrderId: { not: excludePoId } } : {}),
        },
      },
      select: { id: true, employeeId: true, plannedStart: true, plannedEnd: true },
    });
    return allocations.map((a) => ({
      employeeId: a.employeeId!,
      start: a.plannedStart,
      end: a.plannedEnd,
      allocationId: a.id,
    }));
  }

  // ── Generation / approval ───────────────────────────────────────────────

  private async assessLiveMaterialReadiness(po: {
    id: string;
    quantity?: unknown;
    product?: { bomDefaults?: unknown } | null;
  }) {
    const bom = (po.product?.bomDefaults ?? null) as BomDefaults | null;
    const items = await this.prisma.inventoryItem.findMany({
      where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
      select: {
        category: true,
        materialGroup: true,
        balances: { select: { availableQty: true, reservedQty: true } },
      },
    });
    const totals = { fabricMeters: 0, woodUnits: 0, foamBlocks: 0 };
    for (const item of items) {
      const free = item.balances.reduce(
        (s, b) => s + Number(b.availableQty) - Number(b.reservedQty),
        0,
      );
      const group = String(item.materialGroup ?? item.category);
      if (group === 'FABRIC') totals.fabricMeters += free;
      else if (group === 'WOOD') totals.woodUnits += free;
      else if (group === 'FOAM') totals.foamBlocks += free;
    }
    const raw = assessMaterialReadiness(bomToReadinessInput(bom), {
      fabricMeters: { available: totals.fabricMeters },
      woodUnits: { available: totals.woodUnits },
      foamBlocks: { available: totals.foamBlocks },
    });
    const wipReady = await this.assessWipReadiness(po.id, Number(po.quantity) || 1);
    if (!wipReady) {
      return { ...raw, ready: false, risk: true };
    }
    return raw;
  }

  private async assessWipReadiness(productionOrderId: string, orderQty: number) {
    const consume = await this.prisma.productionOrderWorkflowSnapshotNode.count({
      where: {
        snapshot: { productionOrderId },
        isSkipped: false,
        consumesSemiFinished: true,
      },
    });
    if (!consume) return true;
    const producers = await this.prisma.productionOrderWorkflowSnapshotNode.findMany({
      where: {
        snapshot: { productionOrderId },
        isSkipped: false,
        inventoryTracking: 'PRODUCES_SEMI_FINISHED',
      },
      select: { outputQtyPerUnit: true },
    });
    const required = producers.length
      ? producers.reduce((sum, node) => {
          const per = Number(node.outputQtyPerUnit);
          return sum + (Number.isFinite(per) && per > 0 ? per : 1) * orderQty;
        }, 0)
      : orderQty;
    const lots = await this.prisma.inventoryLot.findMany({
      where: {
        productionOrderId,
        status: 'AVAILABLE',
        inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD' },
      },
      select: { quantity: true },
    });
    const available = lots.reduce((s, lot) => s + Number(lot.quantity), 0);
    return available + 1e-9 >= required;
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
        salesOrder: { select: { customerId: true } },
      },
    });
    if (!po) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
    }

    try {
      return await this.buildAndPersistSchedule(po, userId, opts);
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      if (opts?.failHard) {
        const message = err instanceof Error ? err.message : 'Scheduling failed';
        throw new ConflictException({
          code: 'SCHEDULE_REPLAN_FAILED',
          message,
        });
      }
      await this.markNeedsReview(poId, userId, err);
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
        salesOrder: { select: { customerId: true } };
      };
    }>,
    userId: string,
    opts?: {
      reason?: string;
      mode?: 'forward' | 'backward';
      fromDate?: Date;
      failHard?: boolean;
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
      include: { nodes: true, edges: true },
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
      const prior = pinnedByTask.get(task.id);
      const lockInPlace =
        task.status === 'COMPLETED' ||
        task.status === 'IN_PROGRESS' ||
        task.status === 'BLOCKED';
      const pinStart = prior?.plannedStart ?? (lockInPlace ? task.plannedStart : null);
      const pinEnd = prior?.plannedEnd ?? (lockInPlace ? task.plannedCompletion : null);
      const isPinned = Boolean(prior) || Boolean(lockInPlace && pinStart && pinEnd);

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
        preferredEmployeeId: task.assignedEmployeeId ?? null,
      });
    }

    if (stages.length === 0) {
      throw new BadRequestException({
        code: 'NO_SCHEDULABLE_STAGES',
        message: 'Production order has no schedulable tasks.',
      });
    }

    const totalMinutes = stages.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const bufferPercent = po.product?.productionProfile?.bufferPercent ?? 10;

    const orderInput: PlannerOrderInput = {
      id: po.id,
      customerId: po.customerId ?? po.salesOrder?.customerId ?? 'unknown',
      priority: po.priority,
      committedDeliveryDate: po.committedDeliveryDate,
      requestedDeliveryDate: po.requiredDeliveryDate,
      createdAt: po.createdAt,
      stages,
      bufferMinutes: Math.round((bufferPercent / 100) * totalMinutes),
    };

    const [workers, occupancy, { calendar }] = await Promise.all([
      this.loadWorkers(),
      this.loadOccupancy(po.id),
      this.getCalendarDomain(),
    ]);
    const now = opts?.fromDate && !Number.isNaN(opts.fromDate.getTime()) ? opts.fromDate : new Date();
    const ctx = { calendar, workers, existingOccupancy: occupancy, now };

    const useBackward = opts?.mode
      ? opts.mode === 'backward'
      : Boolean(orderInput.requestedDeliveryDate);
    const result = useBackward ? backwardSchedule([orderInput], ctx) : forwardSchedule([orderInput], ctx);
    const materialReadiness = await this.assessLiveMaterialReadiness(po);

    const earliestStart =
      result.allocations.length > 0
        ? result.allocations.reduce(
            (min, a) => (a.plannedStart.getTime() < min.getTime() ? a.plannedStart : min),
            result.allocations[0]!.plannedStart,
          )
        : null;

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

      const createdSchedule = await tx.productionSchedule.create({
        data: {
          productionOrderId: po.id,
          version: nextVersion,
          status: 'PROPOSED',
          promiseState: 'AWAITING_APPROVAL',
          requestedDeliveryDate: po.requiredDeliveryDate,
          earliestAvailableDate: result.earliestCompletion,
          suggestedDeliveryDate: result.earliestCompletion,
          committedCompletionDate: result.usedBackward ? po.requiredDeliveryDate : null,
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
            plannedStart: alloc.plannedStart,
            plannedEnd: alloc.plannedEnd,
            estimatedMinutes: alloc.estimatedMinutes,
            isPinned: alloc.isPinned,
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
              ...(alloc.employeeId && !task?.assignedEmployeeId
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

    await this.prisma.productionSchedule.create({
      data: {
        productionOrderId: poId,
        version: nextVersion,
        status: 'NEEDS_REVIEW',
        promiseState: 'AT_RISK',
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
    return this.generateForProductionOrder(poId, userId, {
      reason: dto.reason,
      mode: dto.mode,
      failHard: true,
    });
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
          promiseState: 'CONFIRMED',
          approvedAt: new Date(),
          approvedById: userId,
          ...(latestEnd ? { committedCompletionDate: latestEnd, committedDeliveryDate: latestEnd } : {}),
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
    if (validation.severity === 'CONFLICT') {
      const canOverride = Boolean(dto.override) && user.permissions.includes('schedule.override');
      if (!canOverride) {
        throw new ConflictException({
          code: 'SCHEDULE_CONFLICT',
          message: 'This change conflicts with the schedule. Retry with override to force it.',
          issues: validation.issues,
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

    if (validation.severity !== 'VALID') {
      await this.debouncedNotify(
        validation.severity === 'CONFLICT' ? 'SCHEDULE_CONFLICT' : 'SCHEDULE_AT_RISK',
        poId,
        () =>
          this.notifications.notifyAdminUsers({
            templateCode: validation.severity === 'CONFLICT' ? 'SCHEDULE_CONFLICT' : 'SCHEDULE_AT_RISK',
            vars: { reason: validation.issues.map((i) => i.message).join('; ') },
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
            productionTask: { select: { id: true; name: true; number: true; status: true } };
            employee: { select: { id: true; firstName: true; lastName: true } };
            department: { select: { id: true; code: true; nameEn: true; nameAr: true } };
          };
        };
      };
    }>,
  ) {
    return {
      id: schedule.id,
      version: schedule.version,
      status: schedule.status,
      promiseState: schedule.promiseState,
      requestedDeliveryDate: schedule.requestedDeliveryDate,
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
      allocations: schedule.allocations.map((a) => ({
        id: a.id,
        productionTaskId: a.productionTaskId,
        task: a.productionTask,
        resourceType: a.resourceType,
        employee: a.employee,
        department: a.department,
        plannedStart: a.plannedStart,
        plannedEnd: a.plannedEnd,
        estimatedMinutes: a.estimatedMinutes,
        isPinned: a.isPinned,
        manuallyAdjusted: a.manuallyAdjusted,
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
            productionTask: { select: { id: true, name: true, number: true, status: true } },
            employee: { select: { id: true, firstName: true, lastName: true } },
            department: { select: { id: true, code: true, nameEn: true, nameAr: true } },
          },
          orderBy: { plannedStart: 'asc' },
        },
      },
    });

    const promiseState = mapPromiseState({
      scheduleStatus: schedule?.status ?? 'DRAFT',
      productionOrderStatus: po.status,
      atRisk: Boolean(schedule?.materialRisk) || schedule?.status === 'NEEDS_REVIEW',
    });

    return {
      productionOrder: po,
      promiseState,
      schedule: schedule ? this.serializeSchedule(schedule) : null,
    };
  }

  async getOwnOrderSchedule(poId: string, user: AuthUser) {
    const po = await this.prisma.productionOrder.findFirst({
      where: {
        id: poId,
        ...(user.customerId
          ? { OR: [{ customerId: user.customerId }, { salesOrder: { customerId: user.customerId } }] }
          : {}),
      },
      select: { id: true, number: true, status: true, requiredDeliveryDate: true, committedDeliveryDate: true },
    });
    if (!po) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });

    const schedule = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: poId },
      orderBy: { version: 'desc' },
    });
    const promiseState = mapPromiseState({
      scheduleStatus: schedule?.status ?? 'DRAFT',
      productionOrderStatus: po.status,
      atRisk: Boolean(schedule?.materialRisk) || schedule?.status === 'NEEDS_REVIEW',
    });
    const policy = resolveDealerChangePolicy({ promiseState, productionOrderStatus: po.status });

    return {
      productionOrderId: po.id,
      number: po.number,
      promiseState,
      requestedDeliveryDate: schedule?.requestedDeliveryDate ?? po.requiredDeliveryDate,
      suggestedDeliveryDate: schedule?.suggestedDeliveryDate ?? null,
      committedDeliveryDate: schedule?.committedDeliveryDate ?? po.committedDeliveryDate,
      canUpdateDeliveryDate: policy.canUpdateDirect,
      canRequestDateChange: policy.canChangeRequest,
      dateChangeLocked: policy.locked,
      dateChangeReason: policy.reason,
    };
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

  /** Department rows with booked vs. available (headcount × shift hours) minutes for utilization bars. */
  async listCapacity(from: string, to: string) {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid date range.' });
    }

    const [allocations, departments, { calendar }] = await Promise.all([
      this.prisma.scheduleAllocation.findMany({
        where: {
          plannedStart: { lt: toDate },
          plannedEnd: { gt: fromDate },
          schedule: { status: { in: ['APPROVED', 'PROPOSED'] } },
        },
        select: {
          plannedStart: true,
          plannedEnd: true,
          departmentId: true,
          employee: { select: { departmentId: true } },
        },
      }),
      this.prisma.department.findMany({
        select: { id: true, code: true, nameEn: true, nameAr: true, _count: { select: { users: true } } },
      }),
      this.getCalendarDomain(),
    ]);

    const bookedByDept = new Map<string, number>();
    for (const a of allocations) {
      const deptId = a.employee?.departmentId ?? a.departmentId ?? null;
      if (!deptId) continue;
      const minutes = Math.max(0, (a.plannedEnd.getTime() - a.plannedStart.getTime()) / 60_000);
      bookedByDept.set(deptId, (bookedByDept.get(deptId) ?? 0) + minutes);
    }

    const dayCount = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)));
    const shiftMinutesPerWorker = calendar
      .expandWorkingIntervals(fromDate, dayCount)
      .reduce((sum, iv) => sum + (iv.end.getTime() - iv.start.getTime()) / 60_000, 0);

    const data = departments
      .map((d) => ({
        departmentId: d.id,
        code: d.code,
        nameEn: d.nameEn,
        nameAr: d.nameAr,
        bookedMinutes: Math.round(bookedByDept.get(d.id) ?? 0),
        capacityMinutes: Math.round(shiftMinutesPerWorker * d._count.users),
      }))
      .filter((d) => d.capacityMinutes > 0 || d.bookedMinutes > 0)
      .sort((a, b) => b.bookedMinutes - a.bookedMinutes);

    return { data };
  }

  async listConflicts() {
    const now = new Date();
    const allocations = await this.prisma.scheduleAllocation.findMany({
      where: {
        employeeId: { not: null },
        plannedEnd: { gte: now },
        schedule: { status: { in: ['APPROVED', 'PROPOSED'] } },
      },
      include: {
        schedule: { select: { productionOrderId: true } },
        productionTask: { select: { id: true, name: true, number: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { plannedStart: 'asc' },
    });

    const byEmployee = new Map<string, typeof allocations>();
    for (const a of allocations) {
      const list = byEmployee.get(a.employeeId!) ?? [];
      list.push(a);
      byEmployee.set(a.employeeId!, list);
    }

    const conflicts: Array<{
      employeeId: string;
      employeeName: string;
      a: { allocationId: string; productionOrderId: string; task: string | null; start: Date; end: Date };
      b: { allocationId: string; productionOrderId: string; task: string | null; start: Date; end: Date };
    }> = [];

    for (const [employeeId, list] of byEmployee) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]!;
          const b = list[j]!;
          const overlap = a.plannedStart.getTime() < b.plannedEnd.getTime() && b.plannedStart.getTime() < a.plannedEnd.getTime();
          if (!overlap) continue;
          conflicts.push({
            employeeId,
            employeeName: a.employee ? `${a.employee.firstName} ${a.employee.lastName}`.trim() : '',
            a: {
              allocationId: a.id,
              productionOrderId: a.schedule.productionOrderId,
              task: a.productionTask?.name ?? null,
              start: a.plannedStart,
              end: a.plannedEnd,
            },
            b: {
              allocationId: b.id,
              productionOrderId: b.schedule.productionOrderId,
              task: b.productionTask?.name ?? null,
              start: b.plannedStart,
              end: b.plannedEnd,
            },
          });
        }
      }
    }

    return { data: conflicts };
  }

  async listAtRisk() {
    const schedules = await this.prisma.productionSchedule.findMany({
      where: {
        OR: [{ status: 'NEEDS_REVIEW' }, { materialRisk: true }, { requiresAdminEstimateReview: true }],
      },
      distinct: ['productionOrderId'],
      orderBy: [{ productionOrderId: 'asc' }, { version: 'desc' }],
      include: {
        productionOrder: {
          select: {
            id: true,
            number: true,
            status: true,
            requiredDeliveryDate: true,
            priority: true,
            customerId: true,
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
      take: 200,
    });

    const orphanCustomerIds = [
      ...new Set(
        schedules
          .map((s) => s.productionOrder)
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

    return {
      data: schedules.map((s) => {
        const order = s.productionOrder;
        const customer =
          order.salesOrder?.customer ??
          (order.customerId ? orphanById.get(order.customerId) ?? null : null);
        return {
          productionOrderId: s.productionOrderId,
          number: order.number,
          status: order.status,
          priority: order.priority,
          scheduleStatus: s.status,
          reason: s.reason,
          materialRisk: s.materialRisk,
          requiresAdminEstimateReview: s.requiresAdminEstimateReview,
          requiredDeliveryDate: order.requiredDeliveryDate,
          suggestedDeliveryDate: s.suggestedDeliveryDate,
          productName: order.product?.nameEn ?? null,
          productNameAr: order.product?.nameAr ?? null,
          productNameHe: order.product?.nameHe ?? null,
          imageUrl: order.product?.imageUrl ?? null,
          dealerName: customer?.nameEn ?? customer?.name ?? null,
          dealerNameAr: customer?.nameAr ?? customer?.name ?? null,
          dealerNameHe: customer?.nameHe ?? null,
        };
      }),
    };
  }

  async dashboardSummary() {
    const [awaitingApproval, needsReview, approvedActive, atRisk] = await Promise.all([
      this.prisma.productionSchedule.count({ where: { status: 'PROPOSED' } }),
      this.prisma.productionSchedule.count({ where: { status: 'NEEDS_REVIEW' } }),
      this.prisma.productionSchedule.count({ where: { status: 'APPROVED' } }),
      this.prisma.productionSchedule.count({ where: { materialRisk: true } }),
    ]);
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
      conflicts: conflicts.data.length,
      todayCount: todayOrders.length,
      weekCount: weekOrders.length,
      approvalsWaiting: awaitingApproval + needsReview,
      alerts: atRisk + conflicts.data.length,
    };
  }

  // ── Task lifecycle hook ──────────────────────────────────────────────────

  async onTaskLifecycle(taskId: string, event: 'start' | 'pause' | 'complete' | 'blocker') {
    const task = await this.prisma.productionTask.findUnique({
      where: { id: taskId },
      select: { id: true, productionOrderId: true, name: true, number: true },
    });
    if (!task) return;

    const schedule = await this.prisma.productionSchedule.findFirst({
      where: { productionOrderId: task.productionOrderId, status: 'APPROVED' },
      orderBy: { version: 'desc' },
    });
    if (!schedule) return;

    if (event === 'blocker') {
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

    // start/pause/complete: enqueue a downstream replan for future (unstarted) work only.
    // Kept sync-free in v1 — the queue producer no-ops without REDIS_URL.
    this.queue.enqueue('REPLAN', { productionOrderId: task.productionOrderId, taskId, event }).catch(() => undefined);
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
