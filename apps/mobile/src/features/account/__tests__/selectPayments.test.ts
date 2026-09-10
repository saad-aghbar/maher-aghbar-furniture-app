import { filterDealerPayments } from '../selectPayments';
import type { Payment } from '@/api/modules/payments';

const pay = (id: string, date: string, extras: Partial<Payment> = {}): Payment => ({
  id,
  number: `PAY-${id}`,
  amount: 100,
  method: 'CASH',
  paymentDate: date,
  ...extras,
});

describe('filterDealerPayments', () => {
  const rows: Payment[] = [
    pay('1', '2026-07-01', { notes: 'July cash' }),
    pay('2', '2026-08-15', { method: 'BANK_TRANSFER', referenceNumber: 'TX-9' }),
    pay('3', '2026-08-20', { notes: 'credit leftover' }),
  ];

  it('filters by from/to calendar bounds', () => {
    expect(
      filterDealerPayments(rows, { dateFrom: '2026-08-01', dateTo: '2026-08-18' }).map(
        (r) => r.id,
      ),
    ).toEqual(['2']);
  });

  it('filters by search across number, notes, and method', () => {
    expect(filterDealerPayments(rows, { q: 'credit' }).map((r) => r.id)).toEqual(['3']);
    expect(filterDealerPayments(rows, { q: 'tx-9' }).map((r) => r.id)).toEqual(['2']);
    expect(filterDealerPayments(rows, { q: 'missing' })).toHaveLength(0);
  });
});
