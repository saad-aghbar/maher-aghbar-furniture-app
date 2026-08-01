import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

function toPositiveInt(value: unknown, fallback: number) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => toPositiveInt(value, 1))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => Math.min(100, toPositiveInt(value, 20)))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}

export function paginatedMeta(page: number, pageSize: number, totalItems: number) {
  const safePage = toPositiveInt(page, 1);
  const safeSize = Math.min(100, toPositiveInt(pageSize, 20));
  return {
    page: safePage,
    pageSize: safeSize,
    totalItems,
    totalPages: Math.ceil(totalItems / safeSize) || 0,
  };
}

/** Always use this before Prisma skip/take — query params may arrive as strings. */
export function pageSkipTake(query: { page?: number | string; pageSize?: number | string }) {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query.pageSize, 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
