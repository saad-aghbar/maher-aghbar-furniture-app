import { ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, ProductionOrderStatus } from '@maher/database';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListProductionOrdersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ProductionOrderStatus })
  @IsOptional()
  @IsEnum(ProductionOrderStatus)
  status?: ProductionOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
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
