import { ymdInTimezone } from '../scheduling/domain/factory-replan';
import {
  fabricTopicForEventKind,
  fabricTopicForState,
  inventoryTopicForTxType,
  invoiceIsOverdueCandidate,
  purchaseOrderIsLate,
  returnTopicFromTemplate,
  stockCrossedBelowMin,
  taskIsEligibleScheduledToday,
} from './ops-notify.classify';

describe('ops-notify classify', () => {
  it('emits low stock only when quantity crosses the minimum', () => {
    expect(stockCrossedBelowMin(12, 4, 5)).toBe(true);
    expect(stockCrossedBelowMin(4, 3, 5)).toBe(false);
    expect(stockCrossedBelowMin(4, 8, 5)).toBe(false);
    expect(stockCrossedBelowMin(8, 4, 5)).toBe(true);
  });

  it('maps routine inventory types and leaves finished goods unmapped', () => {
    expect(inventoryTopicForTxType('PURCHASE_RECEIPT')).toBe('inventory.received');
    expect(inventoryTopicForTxType('WAREHOUSE_TRANSFER')).toBe('inventory.transferred');
    expect(inventoryTopicForTxType('FINISHED_GOODS_RECEIPT')).toBeNull();
  });

  it('maps fabric states and received events', () => {
    expect(fabricTopicForState('NEEDS_ORDERING')).toBe('fabric.needsOrdering');
    expect(fabricTopicForState('UNAVAILABLE')).toBe('fabric.unavailable');
    expect(fabricTopicForEventKind('RECEIVED')).toBe('fabric.arrived');
    expect(fabricTopicForEventKind('REQUESTED')).toBe('fabric.awaitingSupplier');
  });

  it('maps return case templates only', () => {
    expect(returnTopicFromTemplate('RETURN_SUBMITTED')).toBe('return.submitted');
    expect(returnTopicFromTemplate('RETURN_DECISION')).toBe('return.decision');
    expect(returnTopicFromTemplate('SCRAP_RECOVERY')).toBeNull();
  });

  it('treats paid and void invoices as never overdue', () => {
    const due = new Date('2020-01-01T00:00:00.000Z');
    const now = new Date('2026-09-14T00:00:00.000Z');
    expect(
      invoiceIsOverdueCandidate({ status: 'ISSUED', outstandingAmount: 10, dueDate: due, now }),
    ).toBe(true);
    expect(
      invoiceIsOverdueCandidate({ status: 'PAID', outstandingAmount: 10, dueDate: due, now }),
    ).toBe(false);
    expect(
      invoiceIsOverdueCandidate({ status: 'VOID', outstandingAmount: 10, dueDate: due, now }),
    ).toBe(false);
    expect(
      invoiceIsOverdueCandidate({ status: 'ISSUED', outstandingAmount: 0, dueDate: due, now }),
    ).toBe(false);
  });

  it('marks a sent PO late only after the expected date', () => {
    const now = new Date('2026-09-14T00:00:00.000Z');
    expect(
      purchaseOrderIsLate({
        status: 'SENT',
        expectedDeliveryDate: new Date('2026-09-01T00:00:00.000Z'),
        now,
      }),
    ).toBe(true);
    expect(
      purchaseOrderIsLate({
        status: 'RECEIVED',
        expectedDeliveryDate: new Date('2026-09-01T00:00:00.000Z'),
        now,
      }),
    ).toBe(false);
    expect(
      purchaseOrderIsLate({
        status: 'SENT',
        expectedDeliveryDate: new Date('2026-12-01T00:00:00.000Z'),
        now,
      }),
    ).toBe(false);
  });

  it('schedules today only for the assigned open task on that factory day', () => {
    const tz = 'Asia/Amman';
    const today = ymdInTimezone(new Date('2026-09-14T10:00:00+03:00'), tz);
    expect(
      taskIsEligibleScheduledToday({
        status: 'READY',
        assignedEmployeeId: 'w1',
        plannedStart: new Date('2026-09-14T08:00:00+03:00'),
        todayYmd: today,
        timezoneYmd: ymdInTimezone,
        timeZone: tz,
      }),
    ).toBe(true);
    expect(
      taskIsEligibleScheduledToday({
        status: 'COMPLETED',
        assignedEmployeeId: 'w1',
        plannedStart: new Date('2026-09-14T08:00:00+03:00'),
        todayYmd: today,
        timezoneYmd: ymdInTimezone,
        timeZone: tz,
      }),
    ).toBe(false);
    expect(
      taskIsEligibleScheduledToday({
        status: 'READY',
        assignedEmployeeId: null,
        plannedStart: new Date('2026-09-14T08:00:00+03:00'),
        todayYmd: today,
        timezoneYmd: ymdInTimezone,
        timeZone: tz,
      }),
    ).toBe(false);
  });
});
