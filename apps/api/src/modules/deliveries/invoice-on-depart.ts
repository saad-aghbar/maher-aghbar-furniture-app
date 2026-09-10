export async function invoiceOnFactoryExit(args: {
  purpose: string;
  returnRequestId?: string | null;
  salesOrderId?: string | null;
  userId: string;
  invoices: {
    ensureFromReturn: (returnId: string, userId: string) => Promise<unknown>;
    ensureFromSalesOrder: (salesOrderId: string, userId: string) => Promise<unknown>;
  };
}) {
  if (args.purpose === 'RETURN_RESHIP' && args.returnRequestId) {
    await args.invoices.ensureFromReturn(args.returnRequestId, args.userId);
    return 'RETURN';
  }
  if (args.salesOrderId) {
    await args.invoices.ensureFromSalesOrder(args.salesOrderId, args.userId);
    return 'ORDER';
  }
  return null;
}
