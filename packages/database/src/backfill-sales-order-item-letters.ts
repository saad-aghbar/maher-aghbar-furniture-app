import type { PrismaClient } from '@prisma/client';
import {
  formatSalesOrderItemNumber,
  nextItemLetter,
} from './sales-order-item-number';

export async function backfillSalesOrderItemLetters(prisma: PrismaClient): Promise<{
  linesUpdated: number;
  productionOrdersRenamed: number;
}> {
  const orders = await prisma.salesOrder.findMany({
    select: {
      id: true,
      number: true,
      lines: {
        select: { id: true, itemLetter: true, sortOrder: true, createdAt: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      },
      productionOrders: {
        select: {
          id: true,
          number: true,
          originType: true,
          salesOrderLineId: true,
        },
      },
    },
  });

  let linesUpdated = 0;
  let productionOrdersRenamed = 0;

  for (const order of orders) {
    const taken = order.lines
      .map((line) => line.itemLetter)
      .filter((letter): letter is string => Boolean(letter?.trim()));
    const letterByLineId = new Map<string, string>();

    for (const line of order.lines) {
      const existing = line.itemLetter?.trim().toUpperCase() ?? '';
      if (existing) {
        letterByLineId.set(line.id, existing);
        continue;
      }
      const itemLetter = nextItemLetter(taken);
      taken.push(itemLetter);
      await prisma.salesOrderLine.update({
        where: { id: line.id },
        data: { itemLetter },
      });
      letterByLineId.set(line.id, itemLetter);
      linesUpdated += 1;
    }

    for (const po of order.productionOrders) {
      if (po.originType !== 'SALES_ORDER' || !po.salesOrderLineId) continue;
      const letter = letterByLineId.get(po.salesOrderLineId);
      if (!letter) continue;
      const desired = formatSalesOrderItemNumber(order.number, letter);
      if (po.number === desired) continue;
      const clash = await prisma.productionOrder.findFirst({
        where: { number: desired, NOT: { id: po.id } },
        select: { id: true },
      });
      if (clash) continue;
      await prisma.productionOrder.update({
        where: { id: po.id },
        data: { number: desired },
      });
      productionOrdersRenamed += 1;
    }
  }

  return { linesUpdated, productionOrdersRenamed };
}
