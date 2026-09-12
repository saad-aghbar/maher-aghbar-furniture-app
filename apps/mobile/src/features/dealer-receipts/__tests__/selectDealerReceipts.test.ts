import type { DealerDeliveryDto } from '@/api/modules/scheduling';
import {
  countDealerReceiptStamps,
  filterDealerReceipts,
  isLeftFactory,
  matchesDealerReceiptTile,
  receiptKindFromStatus,
  selectReceiptStub,
  uniqueReceiptRows,
} from '../selectDealerReceipts';

function row(overrides: Partial<DealerDeliveryDto> = {}): DealerDeliveryDto {
  return {
    salesOrderId: 'so-1',
    salesOrderNumber: 'SO-1',
    productionOrderId: 'po-1',
    productionOrderNumber: 'PO-1',
    productName: { name: 'Milano Sofa', nameEn: 'Milano Sofa', nameAr: 'كنبة ميلانو', nameHe: null },
    quantity: 1,
    deliveryAddress: 'Nablus',
    requestedDeliveryDate: '2026-08-25',
    suggestedDeliveryDate: '2026-08-25',
    committedDeliveryDate: '2026-08-25',
    projectedDeliveryDate: '2026-08-25',
    actualDeliveryDate: null,
    calendarDate: '2026-08-25',
    customerStatus: 'OUT_FOR_DELIVERY',
    requiresDealerAttention: false,
    customerSafeReason: null,
    compactDates: true,
    delayDays: null,
    actionRequired: null,
    canUpdateDeliveryDate: false,
    canRequestDateChange: true,
    dateChangeLocked: false,
    dateChangeReason: '',
    ...overrides,
  };
}

describe('selectDealerReceipts', () => {
  it('treats shipped as awaiting and delivered as received; ready stays off the desk', () => {
    expect(receiptKindFromStatus('OUT_FOR_DELIVERY')).toBe('awaiting');
    expect(receiptKindFromStatus('SHIPPED')).toBe('awaiting');
    expect(receiptKindFromStatus('DELIVERED')).toBe('received');
    expect(receiptKindFromStatus('READY_FOR_DELIVERY')).toBeNull();
    expect(isLeftFactory('READY_FOR_DELIVERY')).toBe(false);
    expect(isLeftFactory('IN_PRODUCTION')).toBe(false);
    expect(isLeftFactory('OUT_FOR_DELIVERY')).toBe(true);
  });

  it('counts 1×2 stamps from left-the-factory rows only', () => {
    const stamps = countDealerReceiptStamps([
      row({ salesOrderId: 'a', customerStatus: 'OUT_FOR_DELIVERY' }),
      row({ salesOrderId: 'b', customerStatus: 'SHIPPED' }),
      row({ salesOrderId: 'c', customerStatus: 'DELIVERED' }),
      row({ salesOrderId: 'd', customerStatus: 'READY_FOR_DELIVERY' }),
      row({ salesOrderId: 'e', customerStatus: 'IN_PRODUCTION' }),
    ]);
    expect(stamps.awaiting).toBe(2);
    expect(stamps.received).toBe(1);
  });

  it('prefers an awaiting row when the same sales order is duplicated', () => {
    const unique = uniqueReceiptRows([
      row({ salesOrderId: 'dup', customerStatus: 'DELIVERED', calendarDate: '2026-08-10' }),
      row({
        salesOrderId: 'dup',
        customerStatus: 'OUT_FOR_DELIVERY',
        calendarDate: '2026-08-26',
      }),
      row({ salesOrderId: 'ready', customerStatus: 'READY_FOR_DELIVERY' }),
    ]);
    expect(unique).toHaveLength(1);
    expect(unique[0]?.customerStatus).toBe('OUT_FOR_DELIVERY');
  });

  it('filters stamp tiles and search without including ready rows', () => {
    const rows = [
      row({ salesOrderId: 'a', salesOrderNumber: 'SO-A', customerStatus: 'OUT_FOR_DELIVERY' }),
      row({ salesOrderId: 'b', salesOrderNumber: 'SO-B', customerStatus: 'DELIVERED' }),
      row({ salesOrderId: 'c', salesOrderNumber: 'SO-C', customerStatus: 'READY_FOR_DELIVERY' }),
    ];
    expect(filterDealerReceipts(rows, null, '').map((r) => r.salesOrderId)).toEqual(['a', 'b']);
    expect(filterDealerReceipts(rows, 'awaiting', '').map((r) => r.salesOrderId)).toEqual(['a']);
    expect(filterDealerReceipts(rows, 'received', '').map((r) => r.salesOrderId)).toEqual(['b']);
    expect(filterDealerReceipts(rows, null, 'SO-B').map((r) => r.salesOrderId)).toEqual(['b']);
    expect(matchesDealerReceiptTile('READY_FOR_DELIVERY', null)).toBe(false);
  });

  it('picks a receipt stub from customer status, not station %', () => {
    expect(
      selectReceiptStub(row({ customerStatus: 'OUT_FOR_DELIVERY', calendarDate: '2026-08-25' })),
    ).toEqual({ kind: 'awaiting', ymd: '2026-08-25' });
    expect(
      selectReceiptStub(
        row({
          customerStatus: 'DELIVERED',
          actualDeliveryDate: '2026-08-28',
          calendarDate: '2026-08-25',
        }),
      ),
    ).toEqual({ kind: 'received', ymd: '2026-08-28' });
  });
});
