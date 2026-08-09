import type { Prisma } from '@maher/database';
import { tryParseSearchDateWindow } from './sales-order-search.util';

/** Prisma OR branches for free-text sales-order search (`q`). */
export function buildSalesOrderSearchOr(
  q: string,
  now = new Date(),
): Prisma.SalesOrderWhereInput[] {
  const needle = q.trim();
  if (!needle) return [];

  const or: Prisma.SalesOrderWhereInput[] = [
    { number: { contains: needle, mode: 'insensitive' } },
    { externalOrderNumber: { contains: needle, mode: 'insensitive' } },
    { projectName: { contains: needle, mode: 'insensitive' } },
    { notes: { contains: needle, mode: 'insensitive' } },
    { customer: { name: { contains: needle, mode: 'insensitive' } } },
    { customer: { nameAr: { contains: needle, mode: 'insensitive' } } },
    { customer: { nameEn: { contains: needle, mode: 'insensitive' } } },
    { customer: { nameHe: { contains: needle, mode: 'insensitive' } } },
    { customer: { code: { contains: needle, mode: 'insensitive' } } },
    { lines: { some: { description: { contains: needle, mode: 'insensitive' } } } },
    {
      lines: {
        some: { product: { nameEn: { contains: needle, mode: 'insensitive' } } },
      },
    },
    {
      lines: {
        some: { product: { nameAr: { contains: needle, mode: 'insensitive' } } },
      },
    },
    {
      lines: {
        some: { product: { nameHe: { contains: needle, mode: 'insensitive' } } },
      },
    },
    {
      lines: {
        some: { product: { sku: { contains: needle, mode: 'insensitive' } } },
      },
    },
    {
      productionOrders: {
        some: { number: { contains: needle, mode: 'insensitive' } },
      },
    },
    { quotation: { number: { contains: needle, mode: 'insensitive' } } },
    {
      quotation: {
        request: { number: { contains: needle, mode: 'insensitive' } },
      },
    },
    {
      quotation: {
        request: { externalOrderNumber: { contains: needle, mode: 'insensitive' } },
      },
    },
    {
      quotation: {
        request: { projectName: { contains: needle, mode: 'insensitive' } },
      },
    },
  ];

  const window = tryParseSearchDateWindow(needle, now);
  if (window) {
    or.push({
      requiredDeliveryDate: { gte: window.gte, lte: window.lte },
    });
  }

  return or;
}
