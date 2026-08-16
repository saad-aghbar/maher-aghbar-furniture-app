import {
  deliveryCardTone,
  filterBySummaryTile,
  filterDealerDeliveries,
  filterFromSummaryKey,
  groupDealerDeliveries,
  ordersOnCalendarDay,
  selectCompactCardLine,
  selectDealerCalendarDayMeta,
  selectDeliveryTimeline,
} from '../selectDealerDeliveries';
import type { DealerDeliveryDto } from '@/api/modules/scheduling';

function row(overrides: Partial<DealerDeliveryDto> = {}): DealerDeliveryDto {
  return {
    salesOrderId: 'so-1',
    salesOrderNumber: 'SO-1',
    productionOrderId: 'po-1',
    productionOrderNumber: 'PO-1',
    productName: { name: 'Milano Sofa', nameEn: 'Milano Sofa', nameAr: 'كنبة ميلانو', nameHe: null },
    quantity: 1,
    requestedDeliveryDate: '2026-08-25',
    suggestedDeliveryDate: '2026-08-25',
    committedDeliveryDate: '2026-08-25',
    projectedDeliveryDate: '2026-08-25',
    actualDeliveryDate: null,
    calendarDate: '2026-08-25',
    customerStatus: 'CONFIRMED_ON_TRACK',
    requiresDealerAttention: false,
    customerSafeReason: null,
    compactDates: true,
    delayDays: null,
    canUpdateDeliveryDate: false,
    canRequestDateChange: true,
    dateChangeLocked: false,
    dateChangeReason: '',
    ...overrides,
  };
}

describe('selectDealerDeliveries', () => {
  it('groups attention / upcoming / later / delivered and drops cancelled from upcoming', () => {
    const groups = groupDealerDeliveries(
      [
        row({ salesOrderId: 'a', requiresDealerAttention: true, customerStatus: 'AWAITING_CONFIRMATION', calendarDate: '2026-08-20', compactDates: false }),
        row({ salesOrderId: 'b', calendarDate: '2026-08-18', customerStatus: 'CONFIRMED_ON_TRACK' }),
        row({ salesOrderId: 'c', calendarDate: '2026-09-20', customerStatus: 'IN_PRODUCTION', compactDates: false }),
        row({ salesOrderId: 'd', customerStatus: 'DELIVERED', calendarDate: '2026-08-10', actualDeliveryDate: '2026-08-10' }),
        row({ salesOrderId: 'e', customerStatus: 'CANCELLED', calendarDate: '2026-08-19' }),
      ],
      '2026-08-16',
    );
    expect(groups.attention.map((r) => r.salesOrderId)).toEqual(['a']);
    expect(groups.upcoming.map((r) => r.salesOrderId)).toEqual(['b']);
    expect(groups.later.map((r) => r.salesOrderId)).toEqual(['c']);
    expect(groups.delivered.map((r) => r.salesOrderId)).toEqual(['d']);
  });

  it('keeps calendarDate on committed day when delayed', () => {
    const delayed = row({
      customerStatus: 'MAY_BE_DELAYED',
      requiresDealerAttention: true,
      committedDeliveryDate: '2026-08-23',
      projectedDeliveryDate: '2026-08-25',
      calendarDate: '2026-08-23',
      compactDates: false,
    });
    expect(delayed.calendarDate).toBe('2026-08-23');
    const meta = selectDealerCalendarDayMeta([delayed]);
    expect(meta['2026-08-23']?.markers).toContain('attention');
    expect(meta['2026-08-25']).toBeUndefined();
  });

  it('compacts identical dates and lists same-day multiples without treating them as conflicts', () => {
    expect(selectCompactCardLine(row()).compact).toBe(true);
    const sameDay = [
      row({ salesOrderId: 'a', calendarDate: '2026-08-23' }),
      row({ salesOrderId: 'b', calendarDate: '2026-08-23', salesOrderNumber: 'SO-2' }),
    ];
    expect(ordersOnCalendarDay(sameDay, '2026-08-23')).toHaveLength(2);
    expect(selectDealerCalendarDayMeta(sameDay)['2026-08-23']?.count).toBe(2);
  });

  it('filters needs-attention independently of upcoming', () => {
    const rows = [
      row({ requiresDealerAttention: true, customerStatus: 'DELAYED', calendarDate: '2026-08-10' }),
      row({ calendarDate: '2026-08-20' }),
    ];
    expect(filterDealerDeliveries(rows, 'attention', '2026-08-16')).toHaveLength(1);
    expect(filterDealerDeliveries(rows, 'upcoming', '2026-08-16')).toHaveLength(1);
  });

  it('lists the exact orders behind each summary tile', () => {
    const rows = [
      row({ salesOrderId: 'up', calendarDate: '2026-08-25', customerStatus: 'IN_PRODUCTION' }),
      row({ salesOrderId: 'week', calendarDate: '2026-08-16', customerStatus: 'IN_PRODUCTION', compactDates: false }),
      row({
        salesOrderId: 'wait',
        customerStatus: 'AWAITING_CONFIRMATION',
        requiresDealerAttention: true,
        committedDeliveryDate: null,
        compactDates: false,
        calendarDate: '2026-08-22',
      }),
      row({
        salesOrderId: 'late',
        customerStatus: 'MAY_BE_DELAYED',
        requiresDealerAttention: true,
        compactDates: false,
        calendarDate: '2026-08-23',
        projectedDeliveryDate: '2026-08-25',
      }),
      row({ salesOrderId: 'done', customerStatus: 'DELIVERED', calendarDate: '2026-08-10' }),
    ];
    expect(filterBySummaryTile(rows, 'upcoming', '2026-08-18').map((r) => r.salesOrderId)).toEqual([
      'up',
      'wait',
      'late',
    ]);
    expect(filterBySummaryTile(rows, 'week', '2026-08-18').map((r) => r.salesOrderId)).toEqual([
      'week',
      'wait',
    ]);
    expect(filterBySummaryTile(rows, 'awaiting', '2026-08-18').map((r) => r.salesOrderId)).toEqual(['wait']);
    expect(filterBySummaryTile(rows, 'delayed', '2026-08-18').map((r) => r.salesOrderId)).toEqual(['late']);
  });

  it('maps summary tiles onto list filters and card tones', () => {
    expect(filterFromSummaryKey('upcoming')).toBe('upcoming');
    expect(filterFromSummaryKey('week')).toBe('upcoming');
    expect(filterFromSummaryKey('awaiting')).toBe('attention');
    expect(filterFromSummaryKey('delayed')).toBe('attention');
    expect(deliveryCardTone('MAY_BE_DELAYED')).toBe('warning');
    expect(deliveryCardTone('READY_FOR_DELIVERY')).toBe('info');
    expect(deliveryCardTone('DELIVERED')).toBe('success');
    expect(deliveryCardTone('CONFIRMED_ON_TRACK')).toBe('brand');
  });

  it('builds a real-status timeline without factory stages', () => {
    const steps = selectDeliveryTimeline({
      customerStatus: 'IN_PRODUCTION',
      committedDeliveryDate: '2026-08-25',
    });
    expect(steps.find((s) => s.key === 'confirmed')?.done).toBe(true);
    expect(steps.find((s) => s.key === 'production')?.current).toBe(true);
    expect(steps.map((s) => s.key)).toEqual([
      'received',
      'confirmed',
      'production',
      'ready',
      'out',
      'delivered',
    ]);
  });
});
