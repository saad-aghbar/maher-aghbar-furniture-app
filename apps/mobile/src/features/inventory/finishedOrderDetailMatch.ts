export type FinishedLotMatchInput = {
  salesOrder?: { id?: string | null; number?: string | null } | null;
  salesOrderNumber?: string | null;
  productionOrder?: { id?: string | null; number?: string | null } | null;
  productionOrderNumber?: string | null;
};

/** Match a FIN group key — sales order or return-work production order. */
export function finishedLotMatchesOrderId(
  lot: FinishedLotMatchInput,
  orderId: string,
): boolean {
  if (!orderId) return false;
  return (
    lot.salesOrder?.id === orderId ||
    lot.salesOrder?.number === orderId ||
    lot.salesOrderNumber === orderId ||
    lot.productionOrder?.id === orderId ||
    lot.productionOrder?.number === orderId ||
    lot.productionOrderNumber === orderId
  );
}
