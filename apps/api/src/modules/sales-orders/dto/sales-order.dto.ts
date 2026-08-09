import { ApiPropertyOptional } from '@nestjs/swagger';
import { SalesOrderStatus } from '@maher/database';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListSalesOrdersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SalesOrderStatus })
  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;

  /** Chip groups for mobile Orders list. Ignored when `status` is set. */
  @ApiPropertyOptional({ enum: ['pending', 'production', 'delivered'] })
  @IsOptional()
  @IsIn(['pending', 'production', 'delivered'])
  statusGroup?: 'pending' | 'production' | 'delivered';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'requiredDeliveryDate', 'number', 'total'] })
  @IsOptional()
  @IsIn(['createdAt', 'requiredDeliveryDate', 'number', 'total'])
  sortBy?: 'createdAt' | 'requiredDeliveryDate' | 'number' | 'total';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Filter requiredDeliveryDate >= ISO date' })
  @IsOptional()
  @IsString()
  deliveryFrom?: string;

  @ApiPropertyOptional({ description: 'Filter requiredDeliveryDate <= ISO date' })
  @IsOptional()
  @IsString()
  deliveryTo?: string;
}

export class UpdateSalesOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalOrderNumber?: string;

  @ApiPropertyOptional({ description: 'ISO date (YYYY-MM-DD or full ISO)' })
  @IsOptional()
  @IsString()
  requiredDeliveryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  manufacturingCost?: number;

  @ApiPropertyOptional({
    description:
      'Cost breakdown: fabricQty, fabricCost, woodQty, woodCost, foamQty, foamCost, accessoriesQty, accessoriesCost',
  })
  @IsOptional()
  @IsObject()
  costBreakdown?: Record<string, number>;
}
