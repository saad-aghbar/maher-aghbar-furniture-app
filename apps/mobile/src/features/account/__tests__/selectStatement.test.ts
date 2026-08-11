import {
  formatStatementDelta,
  paymentMethodKey,
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
  currency: 'JOD',
  entries: [],
  payments: [],
};

describe('selectStatementSummary', () => {
  it('formats outstanding and empty state', () => {
    const summary = selectStatementSummary(emptyStmt);
    expect(summary.outstandingLabel).toBe('250.50 JOD');
    expect(summary.isEmpty).toBe(true);
    expect(summary.customerLabel).toContain('Acme');
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
