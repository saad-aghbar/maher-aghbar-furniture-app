import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@maher/database';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListPaymentsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class UpdatePaymentDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  referenceNumber?: string | null;

  @IsOptional()
  @IsString()
  bank?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}
