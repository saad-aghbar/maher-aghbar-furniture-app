import { ApiPropertyOptional } from '@nestjs/swagger';
import { SalesOrderStatus } from '@maher/database';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsObject, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListSalesOrdersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SalesOrderStatus })
  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class UpdateSalesOrderDto {
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
