import {
  datePresetRange,
  filterStatementRows,
  formatStatementDelta,
  paymentMethodKey,
  selectStatementRows,
  selectStatementSummary,
} from '../selectStatement';
import type { AccountStatement } from '@/api/modules/payments';

const emptyStmt: AccountStatement = {
  customer: { id: 'c1', code: 'D-1', name: 'Acme' },
  asOf: '2026-08-09',
  openingBalance: '0',
  closingBalance: '100',
  outstandingBalance: '250.50',
  totalInvoiced: '1000',
  totalPaid: '749.50',
  currency: 'ILS',
  entries: [],
  payments: [],
};

describe('selectStatementSummary', () => {
  it('formats outstanding and empty state', () => {
    const summary = selectStatementSummary(emptyStmt);
    expect(summary.outstandingLabel).toBe('250.50 ILS');
    expect(summary.isEmpty).toBe(true);
    expect(summary.customerLabel).toBe('Acme');
    expect(summary.paidRatio).toBeCloseTo(0.7495, 3);
  });

  it('counts entries and payments', () => {
    const summary = selectStatementSummary({
      ...emptyStmt,
      entries: [
        {
          date: '2026-08-01',
          type: 'INVOICE',
          reference: 'INV-1',
          debit: '100',
          credit: '0',
          description: 'Invoice',
          balance: '100',
        },
      ],
      payments: [
        {
          id: 'p1',
          number: 'PAY-1',
          amount: 40,
          method: 'CASH',
          paymentDate: '2026-08-02',
        },
      ],
    });
    expect(summary.isEmpty).toBe(false);
    expect(summary.entryCount).toBe(1);
    expect(summary.paymentCount).toBe(1);
  });
});

describe('selectStatementRows + filters', () => {
  const stmt: AccountStatement = {
    ...emptyStmt,
    entries: [
      {
        date: '2026-07-01',
        type: 'INVOICE',
        entityId: 'inv-1',
        reference: 'INV-1',
        debit: '100',
        credit: '0',
        description: 'Sofa invoice',
        balance: '100',
      },
      {
        date: '2026-08-05',
        type: 'PAYMENT',
        entityId: 'pay-1',
        reference: 'PAY-1',
        debit: '0',
        credit: '40',
        description: 'Cash payment',
        balance: '60',
      },
    ],
  };

  it('maps ledger entries with running balance', () => {
    const rows = selectStatementRows(stmt);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.type).toBe('INVOICE');
    expect(rows[0]?.entityId).toBe('inv-1');
    expect(rows[0]?.balance).toBe('100');
    expect(rows[1]?.side).toBe('credit');
    expect(rows[1]?.entityId).toBe('pay-1');
  });

  it('filters by type and search', () => {
    const rows = selectStatementRows(stmt);
    expect(filterStatementRows(rows, { type: 'PAYMENT' })).toHaveLength(1);
    expect(filterStatementRows(rows, { q: 'sofa' })).toHaveLength(1);
    expect(filterStatementRows(rows, { q: 'missing' })).toHaveLength(0);
  });

  it('filters by date preset range', () => {
    const rows = selectStatementRows(stmt);
    const { dateFrom } = datePresetRange('30d', new Date('2026-08-12'));
    const filtered = filterStatementRows(rows, { dateFrom });
    expect(filtered.map((r) => r.reference)).toEqual(['PAY-1']);
  });
});

describe('statement helpers', () => {
  it('maps payment method i18n keys', () => {
    expect(paymentMethodKey('CASH')).toBe('mobile.account.method.CASH');
    expect(paymentMethodKey('BANK_TRANSFER')).toBe('mobile.account.method.BANK_TRANSFER');
  });

  it('formats debit/credit with RTL-safe signs', () => {
    expect(formatStatementDelta('10', 'debit', false)).toBe('−10');
    expect(formatStatementDelta('10', 'credit', true)).toBe('+10');
  });
});
