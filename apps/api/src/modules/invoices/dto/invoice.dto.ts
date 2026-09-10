import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@maher/database';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListInvoicesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: ['ORDER', 'RETURN'] })
  @IsOptional()
  @IsIn(['ORDER', 'RETURN'])
  kind?: 'ORDER' | 'RETURN';
}

export class UpdateInvoiceLineDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;
}

export class UpdateInvoiceDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  salesOrderId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  returnRequestId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateInvoiceLineDto)
  lines?: UpdateInvoiceLineDto[];
}

export class ListCreatableSourcesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['ALL', 'ORDER', 'RETURN', 'PURCHASING'] })
  @IsOptional()
  @IsIn(['ALL', 'ORDER', 'RETURN', 'PURCHASING'])
  kind?: 'ALL' | 'ORDER' | 'RETURN' | 'PURCHASING';
}
