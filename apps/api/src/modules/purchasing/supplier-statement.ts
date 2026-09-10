export type SupplierStatementEntry = {
  date: Date;
  reference: string;
  debit: number;
  credit: number;
  description: string;
};

export function parseStatementBound(value?: string | null, endOfDay = false): Date | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (endOfDay) date.setHours(23, 59, 59, 999);
    else date.setHours(0, 0, 0, 0);
  }
  return date;
}

export function buildSupplierStatementLedger(args: {
  entries: SupplierStatementEntry[];
  from?: Date | null;
  to?: Date | null;
}): {
  openingBalance: number;
  closingBalance: number;
  entries: SupplierStatementEntry[];
} {
  const from = args.from ?? null;
  const to = args.to ?? null;
  const sorted = [...args.entries].sort((a, b) => a.date.getTime() - b.date.getTime());
  let openingBalance = 0;
  const period: SupplierStatementEntry[] = [];
  for (const entry of sorted) {
    if (from && entry.date.getTime() < from.getTime()) {
      openingBalance += entry.debit - entry.credit;
      continue;
    }
    if (to && entry.date.getTime() > to.getTime()) continue;
    period.push(entry);
  }
  const periodNet = period.reduce((sum, e) => sum + e.debit - e.credit, 0);
  return {
    openingBalance,
    closingBalance: openingBalance + periodNet,
    entries: period,
  };
}
