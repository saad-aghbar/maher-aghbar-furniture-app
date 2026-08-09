import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';

class GlobalSearchQuery extends PaginationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  declare q?: string;
}

export type SearchHit = {
  type: 'product' | 'sales_order' | 'request' | 'invoice' | 'customer' | 'inventory';
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Permission-filtered global search. Never dumps full tables — each bucket
   * is capped and results are paginated across the merged list.
   */
  @Get()
  @RequirePermissions() // any authenticated user; buckets gated below
  async search(@Query() query: GlobalSearchQuery, @CurrentUser() user: AuthUser) {
    const q = (query.q ?? '').trim();
    const { page, pageSize, skip, take } = pageSkipTake(query);
    if (q.length < 1) {
      return { data: [] as SearchHit[], meta: paginatedMeta(page, pageSize, 0) };
    }

    const perms = new Set(user.permissions ?? []);
    const customerId = user.customerId ?? undefined;
    const hits: SearchHit[] = [];
    const bucket = Math.min(12, take);

    const tasks: Array<Promise<void>> = [];

    if (perms.has('catalog.read')) {
      tasks.push(
        (async () => {
          const rows = await this.prisma.product.findMany({
            where: {
              archivedAt: null,
              isActive: true,
              OR: [
                { nameEn: { contains: q, mode: 'insensitive' } },
                { nameAr: { contains: q, mode: 'insensitive' } },
                { nameHe: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              nameEn: true,
              nameAr: true,
              nameHe: true,
              category: { select: { nameEn: true, nameAr: true } },
            },
            take: bucket,
            orderBy: { updatedAt: 'desc' },
          });
          for (const r of rows) {
            hits.push({
              type: 'product',
              id: r.id,
              title: r.nameEn || r.nameAr || r.nameHe || '—',
              subtitle: r.category?.nameEn || r.category?.nameAr || undefined,
              href: `/catalog/${r.id}`,
            });
          }
        })(),
      );
    }

    if (perms.has('sales-order.read')) {
      tasks.push(
        (async () => {
          const rows = await this.prisma.salesOrder.findMany({
            where: {
              archivedAt: null,
              ...(customerId ? { customerId } : {}),
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { externalOrderNumber: { contains: q, mode: 'insensitive' } },
                { projectName: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              number: true,
              status: true,
              customer: { select: { name: true, nameEn: true } },
            },
            take: bucket,
            orderBy: { updatedAt: 'desc' },
          });
          for (const r of rows) {
            hits.push({
              type: 'sales_order',
              id: r.id,
              title: r.number,
              subtitle: `${r.status} · ${r.customer?.nameEn || r.customer?.name || ''}`.trim(),
              href: `/sales-orders/${r.id}`,
            });
          }
        })(),
      );
    }

    if (perms.has('request.read')) {
      tasks.push(
        (async () => {
          const rows = await this.prisma.requestForQuotation.findMany({
            where: {
              archivedAt: null,
              ...(customerId ? { customerId } : {}),
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { projectName: { contains: q, mode: 'insensitive' } },
                { externalOrderNumber: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              number: true,
              status: true,
              customer: { select: { name: true, nameEn: true } },
            },
            take: bucket,
            orderBy: { updatedAt: 'desc' },
          });
          for (const r of rows) {
            hits.push({
              type: 'request',
              id: r.id,
              title: r.number,
              subtitle: `${r.status} · ${r.customer?.nameEn || r.customer?.name || ''}`.trim(),
              href: `/requests/${r.id}`,
            });
          }
        })(),
      );
    }

    if (perms.has('invoice.read')) {
      tasks.push(
        (async () => {
          const rows = await this.prisma.invoice.findMany({
            where: {
              archivedAt: null,
              ...(customerId ? { customerId } : {}),
              OR: [{ number: { contains: q, mode: 'insensitive' } }],
            },
            select: {
              id: true,
              number: true,
              status: true,
              total: true,
              customer: { select: { name: true, nameEn: true } },
            },
            take: bucket,
            orderBy: { createdAt: 'desc' },
          });
          for (const r of rows) {
            hits.push({
              type: 'invoice',
              id: r.id,
              title: r.number,
              subtitle: `${r.status} · ${String(r.total)}`,
              href: `/invoices/${r.id}`,
            });
          }
        })(),
      );
    }

    if (perms.has('customer.read') && !customerId) {
      tasks.push(
        (async () => {
          const rows = await this.prisma.customer.findMany({
            where: {
              archivedAt: null,
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { nameEn: { contains: q, mode: 'insensitive' } },
                { nameAr: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, code: true, name: true, nameEn: true },
            take: bucket,
            orderBy: { updatedAt: 'desc' },
          });
          for (const r of rows) {
            hits.push({
              type: 'customer',
              id: r.id,
              title: r.nameEn || r.name,
              subtitle: r.code,
              href: `/customers/${r.id}`,
            });
          }
        })(),
      );
    }

    if (perms.has('inventory.read')) {
      tasks.push(
        (async () => {
          const rows = await this.prisma.inventoryItem.findMany({
            where: {
              archivedAt: null,
              OR: [
                { sku: { contains: q, mode: 'insensitive' } },
                { nameEn: { contains: q, mode: 'insensitive' } },
                { nameAr: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, sku: true, nameEn: true, nameAr: true, unit: true },
            take: bucket,
            orderBy: { updatedAt: 'desc' },
          });
          for (const r of rows) {
            hits.push({
              type: 'inventory',
              id: r.id,
              title: r.nameEn || r.nameAr || r.sku,
              subtitle: `${r.sku} · ${r.unit}`,
              href: `/inventory/${r.id}`,
            });
          }
        })(),
      );
    }

    await Promise.all(tasks);

    hits.sort((a, b) => a.title.localeCompare(b.title));
    const totalItems = hits.length;
    const data = hits.slice(skip, skip + take);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }
}
