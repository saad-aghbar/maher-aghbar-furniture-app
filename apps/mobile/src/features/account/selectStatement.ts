import type { AccountStatement, Payment, StatementEntry } from '@/api/modules/payments';

export type StatementTypeFilter = 'all' | 'INVOICE' | 'PAYMENT';

export type StatementDatePreset = 'all' | '30d' | '90d';

export type StatementSummaryModel = {
  customerLabel: string;
  outstandingLabel: string;
  outstanding: number;
  closingLabel: string;
  openingLabel: string;
  totalInvoicedLabel: string;
  totalPaidLabel: string;
  totalInvoiced: number;
  totalPaid: number;
  paidRatio: number;
  currency: string;
  asOf: string;
  entryCount: number;
  paymentCount: number;
  isEmpty: boolean;
};

export type StatementActivityRow = {
  id: string;
  /** Invoice or payment UUID when available — for PDF download. */
  entityId?: string;
  type: 'INVOICE' | 'PAYMENT';
  date: string;
  reference: string;
  description: string;
  side: 'debit' | 'credit';
  amount: string;
  balance: string;
};

function parseMoney(value: string | number | undefined | null): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null || value === '') return 0;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function selectStatementSummary(stmt: AccountStatement): StatementSummaryModel {
  const payments = stmt.payments ?? [];
  const entries = stmt.entries ?? [];
  const outstanding = parseMoney(stmt.outstandingBalance);
  const totalInvoiced = parseMoney(stmt.totalInvoiced);
  const totalPaid = parseMoney(stmt.totalPaid);
  const paidRatio =
    totalInvoiced > 0
      ? Math.min(1, Math.max(0, totalPaid / totalInvoiced))
      : outstanding <= 0
        ? 1
        : 0;

  return {
    customerLabel: stmt.customer.name,
    outstandingLabel: `${stmt.outstandingBalance} ${stmt.currency}`.trim(),
    outstanding,
    closingLabel: `${stmt.closingBalance} ${stmt.currency}`.trim(),
    openingLabel: `${stmt.openingBalance} ${stmt.currency}`.trim(),
    totalInvoicedLabel: String(stmt.totalInvoiced),
    totalPaidLabel: String(stmt.totalPaid),
    totalInvoiced,
    totalPaid,
    paidRatio,
    currency: stmt.currency,
    asOf: stmt.asOf,
    entryCount: entries.length,
    paymentCount: payments.length,
    isEmpty: entries.length === 0 && payments.length === 0,
  };
}

function entryToRow(e: StatementEntry, index: number): StatementActivityRow {
  const isInvoice = e.type === 'INVOICE';
  return {
    id: e.entityId ? `${e.type}-${e.entityId}` : `e-${e.reference}-${e.date}-${index}`,
    entityId: e.entityId,
    type: e.type,
    date: e.date,
    reference: e.reference,
    description: e.description || e.reference,
    side: isInvoice ? 'debit' : 'credit',
    amount: isInvoice ? e.debit : e.credit,
    balance: e.balance,
  };
}

function paymentToRow(p: Payment): StatementActivityRow {
  return {
    id: `p-${p.id}`,
    entityId: p.id,
    type: 'PAYMENT',
    date: p.paymentDate,
    reference: p.number,
    description: p.notes?.trim() || p.referenceNumber || p.number,
    side: 'credit',
    amount: String(p.amount),
    balance: '',
  };
}

/** Prefer ledger entries; fall back to payments when the API returns none. */
export function selectStatementRows(stmt: AccountStatement): StatementActivityRow[] {
  const entries = stmt.entries ?? [];
  if (entries.length > 0) {
    return entries.map(entryToRow);
  }
  return (stmt.payments ?? []).map(paymentToRow);
}

export function datePresetRange(
  preset: StatementDatePreset,
  now = new Date(),
): { dateFrom?: string; dateTo?: string } {
  if (preset === 'all') return {};
  const days = preset === '30d' ? 30 : 90;
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - days);
  return { dateFrom: from.toISOString().slice(0, 10) };
}

export function filterStatementRows(
  rows: StatementActivityRow[],
  opts: {
    type?: StatementTypeFilter;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): StatementActivityRow[] {
  const type = opts.type ?? 'all';
  const q = (opts.q ?? '').trim().toLowerCase();
  const { dateFrom, dateTo } = opts;

  return rows.filter((row) => {
    if (type !== 'all' && row.type !== type) return false;
    if (dateFrom) {
      const d = row.date.slice(0, 10);
      if (d < dateFrom) return false;
    }
    if (dateTo) {
      const d = row.date.slice(0, 10);
      if (d > dateTo) return false;
    }
    if (q) {
      const hay = `${row.reference} ${row.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
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
