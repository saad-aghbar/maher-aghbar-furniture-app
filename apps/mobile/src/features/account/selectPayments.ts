import type { Payment } from '@/api/modules/payments';
import { datePresetRange, type StatementDatePreset, type StatementPdfRange } from './selectStatement';

export function paymentDay(value: string | Date | undefined | null): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function filterDealerPayments(
  rows: Payment[],
  opts: {
    q?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): Payment[] {
  const q = (opts.q ?? '').trim().toLowerCase();
  const { dateFrom, dateTo } = opts;

  return rows.filter((row) => {
    const day = paymentDay(row.paymentDate);
    if (dateFrom && day && day < dateFrom) return false;
    if (dateTo && day && day > dateTo) return false;
    if (q) {
      const hay = `${row.number} ${row.referenceNumber ?? ''} ${row.notes ?? ''} ${row.method}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function paymentsDateBounds(
  preset: StatementDatePreset,
  custom?: StatementPdfRange,
  now = new Date(),
): { dateFrom?: string; dateTo?: string } {
  return datePresetRange(preset, now, custom);
}
