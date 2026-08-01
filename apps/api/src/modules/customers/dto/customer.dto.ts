import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus, CustomerType, Locale } from '@maher/database';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** E.164-style: +country code then national number (e.g. +970599123456). */
export const PHONE_E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export class ListCustomersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}

export class CreateCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  nameHe?: string;

  /** Legacy single-name field; used if multilingual fields are omitted. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsString()
  @Matches(PHONE_E164_PATTERN, {
    message: 'Phone must start with +country code then digits (e.g. +970599123456).',
  })
  phone?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsString()
  @Matches(PHONE_E164_PATTERN, {
    message: 'Fax must start with +country code then digits (e.g. +97022991234).',
  })
  fax?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: Locale })
  @IsOptional()
  @IsEnum(Locale)
  preferredLanguage?: Locale;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameHe?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsString()
  @Matches(PHONE_E164_PATTERN, {
    message: 'Phone must start with +country code then digits (e.g. +970599123456).',
  })
  phone?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsString()
  @Matches(PHONE_E164_PATTERN, {
    message: 'Fax must start with +country code then digits (e.g. +97022991234).',
  })
  fax?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: Locale })
  @IsOptional()
  @IsEnum(Locale)
  preferredLanguage?: Locale;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
