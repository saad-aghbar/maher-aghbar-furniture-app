import { Prisma, SalesOrderStatus, ReturnLifecycleState } from '@maher/database';

export type CostListQuery = {
  from?: string;
  to?: string;
  customerId?: string;
  productId?: string;
  variantId?: string;
  optionValueId?: string;
  status?: string;
};

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  };
}

export function parseSalesOrderStatus(status?: string): SalesOrderStatus | undefined {
  if (!status) return undefined;
  return (Object.values(SalesOrderStatus) as string[]).includes(status)
    ? (status as SalesOrderStatus)
    : undefined;
}

export function parseReturnLifecycleStatus(status?: string): ReturnLifecycleState | undefined {
  if (!status) return undefined;
  return (Object.values(ReturnLifecycleState) as string[]).includes(status)
    ? (status as ReturnLifecycleState)
    : undefined;
}

export function costOrdersWhere(query: CostListQuery): Prisma.SalesOrderWhereInput {
  const status = parseSalesOrderStatus(query.status);
  const orderDate = dateRange(query.from, query.to);
  return {
    archivedAt: null,
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(status ? { status } : {}),
    ...(orderDate ? { orderDate } : {}),
    ...(query.productId || query.variantId || query.optionValueId
      ? {
          lines: {
            some: {
              ...(query.productId ? { productId: query.productId } : {}),
              ...(query.variantId ? { variantId: query.variantId } : {}),
              ...(query.optionValueId
                ? { lineOptions: { some: { specOptionValueId: query.optionValueId } } }
                : {}),
            },
          },
        }
      : {}),
  };
}

export function costReturnsWhere(query: CostListQuery): Prisma.ReturnRequestWhereInput {
  const status = parseReturnLifecycleStatus(query.status);
  const createdAt = dateRange(query.from, query.to);
  return {
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(status ? { lifecycleState: status } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(query.productId || query.variantId
      ? {
          OR: [
            ...(query.productId ? [{ productId: query.productId }] : []),
            {
              salesOrderLine: {
                ...(query.productId ? { productId: query.productId } : {}),
                ...(query.variantId ? { variantId: query.variantId } : {}),
              },
            },
          ],
        }
      : {}),
  };
}

/** Reserved until Phase 9 fills actual labor money. Never a silent 0. */
export const LABOR_NOT_CONFIGURED = null;
