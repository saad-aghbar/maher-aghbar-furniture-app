import type { AccountStatement, Payment } from '@/api/modules/payments';

export type StatementSummaryModel = {
  customerLabel: string;
  outstandingLabel: string;
  totalInvoicedLabel: string;
  totalPaidLabel: string;
  currency: string;
  asOf: string;
  entryCount: number;
  paymentCount: number;
  isEmpty: boolean;
};

export function selectStatementSummary(stmt: AccountStatement): StatementSummaryModel {
  const payments = stmt.payments ?? [];
  const entries = stmt.entries ?? [];
  return {
    customerLabel: `${stmt.customer.name} (${stmt.customer.code})`,
    outstandingLabel: `${stmt.outstandingBalance} ${stmt.currency}`.trim(),
    totalInvoicedLabel: String(stmt.totalInvoiced),
    totalPaidLabel: String(stmt.totalPaid),
    currency: stmt.currency,
    asOf: stmt.asOf,
    entryCount: entries.length,
    paymentCount: payments.length,
    isEmpty: entries.length === 0 && payments.length === 0,
  };
}

export function paymentMethodKey(method: Payment['method'] | string): string {
  return `mobile.account.method.${String(method).toUpperCase()}`;
}

/** RTL-aware amount sign for statement ledger rows. */
export function formatStatementDelta(
  amount: string,
  side: 'debit' | 'credit',
  isRTL: boolean,
): string {
  const signed = side === 'debit' ? `−${amount}` : `+${amount}`;
  // Keep numerals LTR; wrapper handles alignment.
  return isRTL ? signed : signed;
}
