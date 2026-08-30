import { ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, ProductionOrderStatus } from '@maher/database';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const PRODUCTION_LIST_BUCKETS = [
  'all',
  'daily',
  'weekly',
  'monthly',
  'in_production',
  'late',
  'completed',
  /** Factory board (v2) */
  'needs_setup',
  'ready_to_start',
  'on_floor',
  'blocked',
  'inspection_packaging',
] as const;
export type ProductionListBucket = (typeof PRODUCTION_LIST_BUCKETS)[number];

export class ListProductionOrdersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ProductionOrderStatus })
  @IsOptional()
  @IsEnum(ProductionOrderStatus)
  status?: ProductionOrderStatus;

  @ApiPropertyOptional({ enum: PRODUCTION_LIST_BUCKETS })
  @IsOptional()
  @IsIn([...PRODUCTION_LIST_BUCKETS])
  bucket?: ProductionListBucket;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter POs that have a task assigned to this worker' })
  @IsOptional()
  @IsUUID()
  assignedEmployeeId?: string;
}

export class UpdateProductionOrderDto {
  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedCompletionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  requiredDeliveryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
