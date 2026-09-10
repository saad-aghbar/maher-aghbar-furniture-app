import type { Prisma } from '@maher/database';

export type InvoiceListKind = 'ORDER' | 'RETURN';

export function invoiceKindWhere(kind?: InvoiceListKind | string | null): Prisma.InvoiceWhereInput {
  if (kind === 'ORDER') return { returnRequestId: null };
  if (kind === 'RETURN') return { returnRequestId: { not: null } };
  return {};
}
