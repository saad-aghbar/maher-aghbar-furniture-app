import type { GoodsReceiptInput } from '@/api/modules/purchasing';
import type { StockMoveSubmit } from './components/AddStockSheet';

export function toGoodsReceiptArgs(input: StockMoveSubmit): {
  purchaseOrderId: string;
  body: GoodsReceiptInput;
} | null {
  if (!input.purchaseOrderId) return null;
  return {
    purchaseOrderId: input.purchaseOrderId,
    body: {
      warehouseId: input.warehouseId,
      notes: input.notes,
      lines: [
        {
          inventoryItemId: input.inventoryItemId,
          orderedQty: input.orderedQty ?? input.quantity,
          receivedQty: input.quantity,
        },
      ],
    },
  };
}
