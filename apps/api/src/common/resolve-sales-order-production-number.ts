import { formatSalesOrderItemNumber, nextItemLetter } from './sales-order-item-number';

type LineLetterTx = {
  salesOrderLine: {
    findMany: (args: {
      where: { salesOrderId: string; itemLetter: { not: null } };
      select: { itemLetter: true };
    }) => Promise<Array<{ itemLetter: string | null }>>;
    update: (args: {
      where: { id: string };
      data: { itemLetter: string };
    }) => Promise<unknown>;
  };
};

/** Persist a letter if missing, then return `{SO}.{letter}` for a SALES_ORDER production job. */
export async function resolveSalesOrderProductionNumber(
  tx: LineLetterTx,
  order: { id: string; number: string },
  line: { id: string; itemLetter?: string | null },
): Promise<string> {
  let letter = line.itemLetter?.trim().toUpperCase() ?? '';
  if (!letter) {
    const siblings = await tx.salesOrderLine.findMany({
      where: { salesOrderId: order.id, itemLetter: { not: null } },
      select: { itemLetter: true },
    });
    letter = nextItemLetter(
      siblings.map((row) => row.itemLetter).filter((value): value is string => Boolean(value)),
    );
    await tx.salesOrderLine.update({
      where: { id: line.id },
      data: { itemLetter: letter },
    });
  }
  return formatSalesOrderItemNumber(order.number, letter);
}
