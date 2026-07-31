import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductionOrderStatus } from '@maher/database';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListProductionOrdersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ProductionOrderStatus })
  @IsOptional()
  @IsEnum(ProductionOrderStatus)
  status?: ProductionOrderStatus;
}
