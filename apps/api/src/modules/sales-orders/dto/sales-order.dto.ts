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

  /** Chip groups for mobile Orders list. Ignored when `status` or `journeyBucket` is set. */
  @ApiPropertyOptional({ enum: ['pending', 'production', 'delivered'] })
  @IsOptional()
  @IsIn(['pending', 'production', 'delivered'])
  statusGroup?: 'pending' | 'production' | 'delivered';

  /**
   * Admin Order Journey lane (COUNT=DATASET).
   * Server classifier — must match meta.journeyCounts keys.
   */
  @ApiPropertyOptional({
    enum: [
      'preparing',
      'ready_to_start',
      'in_production',
      'ready_to_ship',
      'shipped',
      'delivered',
    ],
  })
  @IsOptional()
  @IsIn([
    'preparing',
    'ready_to_start',
    'in_production',
    'ready_to_ship',
    'shipped',
    'delivered',
  ])
  journeyBucket?:
    | 'preparing'
    | 'ready_to_start'
    | 'in_production'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered';

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
  @ApiPropertyOptional({ description: 'Factory / system sales-order number (draft only)' })
  @IsOptional()
  @IsString()
  number?: string;

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
  @IsString()
  endCustomerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endCustomerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endCustomerFax?: string;

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
