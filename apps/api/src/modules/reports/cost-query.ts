import { Prisma, SalesOrderStatus, ReturnLifecycleState, ManufacturingComplexity } from '@maher/database';

export type CostDateBasis = 'delivered' | 'activity' | 'orderDate';

export type CostListQuery = {
  from?: string;
  to?: string;
  dateBasis?: CostDateBasis | string;
  customerId?: string;
  productId?: string;
  variantId?: string;
  optionValueId?: string;
  status?: string;
  q?: string;
  complexity?: string;
  delivered?: string;
  hasReturn?: string | boolean;
  hasRework?: string | boolean;
  coverage?: string;
  marginHealth?: string;
  sort?: string;
  lifecycle?: string;
  warehouseId?: string;
  itemId?: string;
  movementType?: string;
  minOrders?: string | number;
  issueType?: string;
};

export function parseDateBasis(value?: string): CostDateBasis {
  if (value === 'activity' || value === 'orderDate' || value === 'delivered') return value;
  return 'delivered';
}

export function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
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

export function parseComplexity(value?: string): ManufacturingComplexity | undefined {
  if (!value) return undefined;
  return (Object.values(ManufacturingComplexity) as string[]).includes(value)
    ? (value as ManufacturingComplexity)
    : undefined;
}

function asBool(value?: string | boolean): boolean | undefined {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

function searchOr(q?: string): Prisma.SalesOrderWhereInput | undefined {
  const term = q?.trim();
  if (!term) return undefined;
  return {
    OR: [
      { number: { contains: term, mode: 'insensitive' } },
      { customer: { nameEn: { contains: term, mode: 'insensitive' } } },
      { customer: { nameAr: { contains: term, mode: 'insensitive' } } },
      { customer: { nameHe: { contains: term, mode: 'insensitive' } } },
      { customer: { code: { contains: term, mode: 'insensitive' } } },
      {
        lines: {
          some: {
            OR: [
              { description: { contains: term, mode: 'insensitive' } },
              { variantSku: { contains: term, mode: 'insensitive' } },
              { variantLabel: { contains: term, mode: 'insensitive' } },
              { product: { sku: { contains: term, mode: 'insensitive' } } },
              { product: { nameEn: { contains: term, mode: 'insensitive' } } },
              { product: { nameAr: { contains: term, mode: 'insensitive' } } },
            ],
          },
        },
      },
    ],
  };
}

function dateWhere(query: CostListQuery): Prisma.SalesOrderWhereInput {
  const range = dateRange(query.from, query.to);
  if (!range) return {};
  const basis = parseDateBasis(query.dateBasis);
  if (basis === 'orderDate') return { orderDate: range };
  if (basis === 'activity') {
    return {
      OR: [
        {
          productionOrders: {
            some: {
              archivedAt: null,
              inventoryTransactions: { some: { createdAt: range } },
            },
          },
        },
        {
          productionOrders: {
            some: {
              archivedAt: null,
              tasks: { some: { timeEntries: { some: { startedAt: range } } } },
            },
          },
        },
      ],
    };
  }
  return {
    deliveries: {
      some: {
        purpose: 'OUTBOUND_ORDER',
        actualDeliveredAt: range,
      },
    },
  };
}

export function costOrdersWhere(query: CostListQuery): Prisma.SalesOrderWhereInput {
  const status = parseSalesOrderStatus(query.status);
  const complexity = parseComplexity(query.complexity);
  const hasReturn = asBool(query.hasReturn);
  const hasRework = asBool(query.hasRework);
  const search = searchOr(query.q);
  const delivered = query.delivered;
  const and: Prisma.SalesOrderWhereInput[] = [{ archivedAt: null }, dateWhere(query)];
  if (query.customerId) and.push({ customerId: query.customerId });
  if (status) and.push({ status });
  if (delivered === 'delivered') {
    and.push({ status: { in: [SalesOrderStatus.DELIVERED, SalesOrderStatus.COMPLETED] } });
  } else if (delivered === 'active') {
    and.push({
      status: {
        notIn: [SalesOrderStatus.DELIVERED, SalesOrderStatus.COMPLETED, SalesOrderStatus.CANCELLED],
      },
    });
  }
  const lineSome: Prisma.SalesOrderLineWhereInput = {
    ...(complexity ? { manufacturingComplexity: complexity } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.variantId ? { variantId: query.variantId } : {}),
    ...(query.optionValueId
      ? { lineOptions: { some: { specOptionValueId: query.optionValueId } } }
      : {}),
  };
  if (Object.keys(lineSome).length) and.push({ lines: { some: lineSome } });
  if (hasReturn === true) and.push({ returns: { some: {} } });
  if (hasReturn === false) and.push({ returns: { none: {} } });
  if (hasRework === true) {
    and.push({ productionOrders: { some: { archivedAt: null, tasks: { some: { isRework: true } } } } });
  }
  if (hasRework === false) {
    and.push({ productionOrders: { none: { archivedAt: null, tasks: { some: { isRework: true } } } } });
  }
  if (search) and.push(search);
  return { AND: and };
}

export function costReturnsWhere(query: CostListQuery): Prisma.ReturnRequestWhereInput {
  const status = parseReturnLifecycleStatus(query.status);
  const createdAt = dateRange(query.from, query.to);
  const term = query.q?.trim();
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
    ...(term
      ? {
          OR: [
            { number: { contains: term, mode: 'insensitive' } },
            { salesOrder: { number: { contains: term, mode: 'insensitive' } } },
            { customer: { nameEn: { contains: term, mode: 'insensitive' } } },
            { customer: { nameAr: { contains: term, mode: 'insensitive' } } },
            { product: { sku: { contains: term, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
}

export function costProductsSearch(query: CostListQuery): Prisma.ProductWhereInput {
  const term = query.q?.trim();
  return {
    archivedAt: null,
    ...(query.productId ? { id: query.productId } : {}),
    ...(term
      ? {
          OR: [
            { sku: { contains: term, mode: 'insensitive' } },
            { nameEn: { contains: term, mode: 'insensitive' } },
            { nameAr: { contains: term, mode: 'insensitive' } },
            { variants: { some: { sku: { contains: term, mode: 'insensitive' } } } },
            { variants: { some: { nameEn: { contains: term, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
}

/** Reserved until a rate model exists. Never a silent 0. */
export const LABOR_NOT_CONFIGURED = null;
