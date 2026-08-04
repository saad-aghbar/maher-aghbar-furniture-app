import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@maher/database';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListSupplierInvoicesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
