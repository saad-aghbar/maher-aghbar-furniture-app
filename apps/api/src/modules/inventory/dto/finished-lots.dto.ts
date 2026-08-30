import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListFinishedLotsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['inWarehouse', 'history'] })
  @IsOptional()
  @IsIn(['inWarehouse', 'history'])
  scope?: 'inWarehouse' | 'history' = 'inWarehouse';

  @ApiPropertyOptional({ description: 'History presence window start (ISO date/datetime)' })
  @IsOptional()
  @IsISO8601({ strict: false })
  from?: string;

  @ApiPropertyOptional({ description: 'History presence window end (ISO date/datetime)' })
  @IsOptional()
  @IsISO8601({ strict: false })
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;
}
