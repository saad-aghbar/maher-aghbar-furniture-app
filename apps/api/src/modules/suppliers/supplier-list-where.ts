import { Prisma } from '@maher/database';

export function supplierListWhere(query: {
  status?: string;
  q?: string;
}): Prisma.SupplierWhereInput {
  return {
    archivedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { nameAr: { contains: query.q, mode: 'insensitive' } },
            { nameEn: { contains: query.q, mode: 'insensitive' } },
            { nameHe: { contains: query.q, mode: 'insensitive' } },
            { code: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
            { companyName: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}
