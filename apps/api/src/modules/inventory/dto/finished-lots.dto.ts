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

  @ApiPropertyOptional({ enum: ['normal', 'returned'] })
  @IsOptional()
  @IsIn(['normal', 'returned'])
  origin?: 'normal' | 'returned';
}

export class ListSemiFinishedDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ enum: ['normal', 'returned'] })
  @IsOptional()
  @IsIn(['normal', 'returned'])
  origin?: 'normal' | 'returned';
}
