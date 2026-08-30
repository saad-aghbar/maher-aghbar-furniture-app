import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AvailabilityItemDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customSpecifications?: string;
}

export class AvailabilityRequestDto {
  @ApiProperty({ type: [AvailabilityItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityItemDto)
  items!: AvailabilityItemDto[];

  /** ISO date the dealer wants delivery by. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestedDeliveryDate?: string;

  /** Admin-only: check availability on behalf of a specific dealer. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class ApproveScheduleDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey?: string;
}

export class RecalculateDto {
  @ApiPropertyOptional({ enum: ['forward', 'backward'] })
  @IsOptional()
  @IsIn(['forward', 'backward'])
  mode?: 'forward' | 'backward';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ResolveConflictDto {
  @ApiProperty({ description: 'Pair id: min(allocationId):max(allocationId)' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  conflictId!: string;
}

export class PatchAllocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plannedStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plannedEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Requires schedule.override when the change would create a CONFLICT. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  override?: boolean;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class PinDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  allocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiProperty()
  @IsBoolean()
  pin!: boolean;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class DealerDateChangeDto {
  @ApiProperty()
  @IsString()
  requestedDeliveryDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey?: string;
}

export class TimeOfDayRangeDto {
  @ApiProperty()
  @IsString()
  start!: string;

  @ApiProperty()
  @IsString()
  end!: string;
}

export class CalendarExceptionDto {
  @ApiProperty()
  @IsString()
  date!: string;

  @ApiProperty({ enum: ['HOLIDAY', 'SHUTDOWN', 'EXTRA_SHIFT'] })
  @IsIn(['HOLIDAY', 'SHUTDOWN', 'EXTRA_SHIFT'])
  type!: 'HOLIDAY' | 'SHUTDOWN' | 'EXTRA_SHIFT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shiftStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shiftEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ProductionCalendarDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  workingWeekdays?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shiftStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shiftEnd?: string;

  @ApiPropertyOptional({ type: [TimeOfDayRangeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeOfDayRangeDto)
  breaks?: TimeOfDayRangeDto[];

  @ApiPropertyOptional({ description: 'Working days production must finish before requested delivery.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  deliveryBufferWorkingDays?: number;

  @ApiPropertyOptional({ description: 'Max working days before the commercial target that optimize may pull healthy work.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  maxProductionEarlyWorkingDays?: number;

  @ApiPropertyOptional({ description: 'Occupancy reporting/heuristic ceiling for capacity optimize (not a fake cap).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  targetFactoryUtilizationPercent?: number;
}

export class ProductionProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalStandardMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  setupMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  complexityFactor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultBatchSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumLeadTimeDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200)
  bufferPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSchedulingEnabled?: boolean;
}

export class ProductStageEstimateInputDto {
  @ApiProperty()
  @IsUUID()
  stageDefinitionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  setupMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minutesPerUnit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fixedMinutes?: number;

  @ApiPropertyOptional({ enum: ['LINEAR', 'FIXED', 'SETUP_PLUS_LINEAR', 'BATCH', 'PARALLEL_CAPACITY'] })
  @IsOptional()
  @IsIn(['LINEAR', 'FIXED', 'SETUP_PLUS_LINEAR', 'BATCH', 'PARALLEL_CAPACITY'])
  quantityScalingMode?: 'LINEAR' | 'FIXED' | 'SETUP_PLUS_LINEAR' | 'BATCH' | 'PARALLEL_CAPACITY';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  batchMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxParallelUnits?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workerCountRequired?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  overrideDepartmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class ProductStageEstimatesDto {
  @ApiProperty({ type: [ProductStageEstimateInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductStageEstimateInputDto)
  items!: ProductStageEstimateInputDto[];
}

export class ListCapacityQuery {
  @ApiProperty()
  @IsString()
  from!: string;

  @ApiProperty()
  @IsString()
  to!: string;

  @ApiPropertyOptional({ enum: ['day', 'range'] })
  @IsOptional()
  @IsIn(['day', 'range'])
  granularity?: 'day' | 'range';

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeWorkers?: boolean;
}

export class ListCalendarQuery {
  @ApiProperty()
  @IsString()
  from!: string;

  @ApiProperty()
  @IsString()
  to!: string;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  view?: 'day' | 'week' | 'month';
}

export class ListOwnDeliveriesQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;
}

/** Calendar order cards include requested/suggested/committed dates plus productionDeadline (read-only). */
export type CalendarOrderCardPresentation = {
  requestedDeliveryDate?: Date | string | null;
  suggestedDeliveryDate?: Date | string | null;
  committedDeliveryDate?: Date | string | null;
  earliestAvailableDate?: Date | string | null;
  requestedDateFeasible?: boolean | null;
  unschedulableReason?: string | null;
  planningMode?: string | null;
  requiresAdminEstimateReview?: boolean;
  materialReadyAt?: Date | string | null;
  committedCompletionDate?: Date | string | null;
  productionDeadline?: string | null;
  deliveryBufferWorkingDays?: number | null;
};
