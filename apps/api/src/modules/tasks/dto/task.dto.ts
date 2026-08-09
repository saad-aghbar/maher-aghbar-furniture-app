import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlockerCategory, Priority, TaskStatus } from '@maher/database';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** Query-string booleans arrive as `"true"` / `"false"`. */
function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  if (value === '' || value == null) return undefined;
  return undefined;
}

function emptyToUndefined(value: unknown): unknown {
  return value === '' || value == null ? undefined : value;
}

export class ListTasksDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /** open = exclude completed/cancelled; completed = finished only; all = no status filter. */
  @ApiPropertyOptional({ enum: ['open', 'completed', 'all'] })
  @IsOptional()
  @IsIn(['open', 'completed', 'all'])
  scope?: 'open' | 'completed' | 'all';

  /** Restrict to tasks whose plannedCompletion falls on the server's current calendar day. */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  dueToday?: boolean;

  /** Dealer (customer) on the production order. */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  customerId?: string;

  /** Inclusive lower bound for actualCompletion (YYYY-MM-DD). */
  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(10)
  completedFrom?: string;

  /** Inclusive upper bound for actualCompletion (YYYY-MM-DD). */
  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(10)
  completedTo?: string;
}

export class TaskProgressDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  percent!: number;
}

export class TaskBlockDto {
  @ApiProperty({ enum: BlockerCategory })
  @IsEnum(BlockerCategory)
  category!: BlockerCategory;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey?: string;
}

export class AssignTaskDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  /** Task due datetime (ISO). Hours + minutes are required at the product UI layer. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plannedCompletion?: string;

  /** Estimated work duration in whole minutes. */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedMinutes?: number;
}

export class CompleteTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsUUID('4', { each: true })
  photoDocumentIds?: string[];

  @ApiPropertyOptional({
    description: 'Client-generated key; duplicate submits return the first successful result.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey?: string;
}

export class UpdateTaskNotesDto {
  @ApiProperty()
  @IsString()
  notes!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey?: string;
}
