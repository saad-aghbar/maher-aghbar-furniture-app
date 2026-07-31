import { ApiPropertyOptional } from '@nestjs/swagger';
import { SalesOrderStatus } from '@maher/database';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListSalesOrdersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SalesOrderStatus })
  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;
}
