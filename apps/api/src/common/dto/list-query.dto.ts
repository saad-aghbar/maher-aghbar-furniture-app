import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export { pageSkipTake } from './pagination.dto';

export class ListQueryDto extends PaginationDto {}

export class ListActiveQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  isActive?: string;
}
