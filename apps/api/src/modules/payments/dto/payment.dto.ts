import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListPaymentsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
