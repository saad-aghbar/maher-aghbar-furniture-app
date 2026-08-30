/**
 * Piece 7 — canonical dealer commercial finance helpers.
 * Frontends must not recompute balances; API enriches via this module.
 */
import { InvoiceStatus } from '@maher/database';
import { roundMoney } from '../../common/helpers/money.util';

export type InvoicePhase =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'VOID'
  | 'CANCELLED';

export type InvoicePresentation = {
  phase: InvoicePhase;
  labelKey: string;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
  amountDue: number;
  paidAmount: number;
  remaining: number;
};

/** Accept Prisma Decimal and other numeric-ish values. */
export function money(n: unknown): number {
  if (n == null) return 0;
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

/** payment.amount − Σ allocations (advance / unallocated credit for one payment). */
export function paymentUnallocated(
  paymentAmount: number,
  allocationAmounts: number[],
): number {
  const allocated = allocationAmounts.reduce((s, a) => s + money(a), 0);
  return Math.max(0, money(paymentAmount) - allocated);
}

export function assertMoneyConservation(args: {
  paymentAmount: number;
  allocations: number[];
  eps?: number;
}): boolean {
  const eps = args.eps ?? 1e-6;
  const sum = args.allocations.reduce((s, a) => s + money(a), 0);
  const unalloc = paymentUnallocated(args.paymentAmount, args.allocations);
  return Math.abs(money(args.paymentAmount) - (sum + unalloc)) <= eps;
}

export function deriveInvoiceStatus(args: {
  status: string;
  total: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate?: Date | string | null;
  now?: Date;
}): InvoiceStatus {
  const status = String(args.status ?? '').toUpperCase();
  if (status === 'VOID' || status === 'CANCELLED' || status === 'DRAFT') {
    return status as InvoiceStatus;
  }
  const total = money(args.total);
  const paid = money(args.paidAmount);
  const outstanding = Math.max(0, money(args.outstandingAmount));
  if (outstanding <= 1e-6 || paid + 1e-6 >= total) return InvoiceStatus.PAID;
  if (paid > 1e-6) {
    const due = args.dueDate ? new Date(args.dueDate) : null;
    const now = args.now ?? new Date();
    if (due && !Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) {
      return InvoiceStatus.OVERDUE;
    }
    return InvoiceStatus.PARTIALLY_PAID;
  }
  const due = args.dueDate ? new Date(args.dueDate) : null;
  const now = args.now ?? new Date();
  if (due && !Number.isNaN(due.getTime()) && due.getTime() < now.getTime() && outstanding > 1e-6) {
    return InvoiceStatus.OVERDUE;
  }
  return InvoiceStatus.ISSUED;
}

export function classifyInvoice(args: {
  status: string;
  total: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate?: Date | string | null;
}): InvoicePresentation {
  const phase = deriveInvoiceStatus(args) as InvoicePhase;
  const remaining = Math.max(0, money(args.outstandingAmount));
  const paidAmount = money(args.paidAmount);
  const labelKey =
    phase === 'DRAFT'
      ? 'accounting.phaseDraft'
      : phase === 'ISSUED'
        ? 'accounting.phaseIssued'
        : phase === 'PARTIALLY_PAID'
          ? 'accounting.phasePartial'
          : phase === 'PAID'
            ? 'accounting.phasePaid'
            : phase === 'OVERDUE'
              ? 'accounting.phaseOverdue'
              : phase === 'VOID'
                ? 'accounting.phaseVoid'
                : 'accounting.phaseCancelled';
  const tone =
    phase === 'PAID'
      ? 'success'
      : phase === 'OVERDUE'
        ? 'danger'
        : phase === 'PARTIALLY_PAID'
          ? 'warning'
          : phase === 'ISSUED'
            ? 'info'
            : 'neutral';
  return {
    phase,
    labelKey,
    tone,
    amountDue: money(args.total),
    paidAmount,
    remaining,
  };
}

export function recomputeInvoicePaidFromAllocations(
  total: number,
  allocatedSum: number,
): { paidAmount: number; outstandingAmount: number; status: InvoiceStatus } {
  const paid = Math.min(money(total), Math.max(0, money(allocatedSum)));
  const outstanding = Math.max(0, money(total) - paid);
  let status: InvoiceStatus = InvoiceStatus.ISSUED;
  if (outstanding <= 1e-6) status = InvoiceStatus.PAID;
  else if (paid > 1e-6) status = InvoiceStatus.PARTIALLY_PAID;
  return {
    paidAmount: Number(roundMoney(paid)),
    outstandingAmount: Number(roundMoney(outstanding)),
    status,
  };
}

/**
 * Plan FIFO apply-credit slices from oldest payments with unallocated credit.
 * Caps at min(want, invoiceOutstanding, Σ unallocated). Never plans over invoice open.
 */
export function planFifoCreditApplication(args: {
  paymentsOldestFirst: Array<{ paymentId: string; unallocated: number }>;
  invoiceOutstanding: number;
  want: number;
}): {
  applyAmount: number;
  slices: Array<{ paymentId: string; amount: number }>;
  invoiceRemainingAfter: number;
} {
  const outstanding = Math.max(0, money(args.invoiceOutstanding));
  const available = args.paymentsOldestFirst.reduce(
    (s, p) => s + Math.max(0, money(p.unallocated)),
    0,
  );
  let remaining = Math.min(Math.max(0, money(args.want)), outstanding, available);
  const applyAmount = remaining;
  const slices: Array<{ paymentId: string; amount: number }> = [];
  for (const row of args.paymentsOldestFirst) {
    if (remaining <= 1e-6) break;
    const u = Math.max(0, money(row.unallocated));
    if (u <= 1e-6) continue;
    const slice = Math.min(u, remaining);
    slices.push({ paymentId: row.paymentId, amount: Number(roundMoney(slice)) });
    remaining -= slice;
  }
  return {
    applyAmount: Number(roundMoney(applyAmount)),
    slices,
    invoiceRemainingAfter: Number(roundMoney(outstanding - applyAmount)),
  };
}

export type DealerFinanceSummary = {
  amountDue: number;
  availableCredit: number;
  /** amountDue − availableCredit (internal; UI prefers separate heroes). */
  netPosition: number;
  openInvoiceCount: number;
  overdueAmount: number;
  currency: string;
};

export function summarizeDealerFinance(args: {
  invoices: Array<{
    status: string;
    outstandingAmount: unknown;
    dueDate?: Date | string | null;
  }>;
  payments: Array<{
    amount: unknown;
    allocations: Array<{ amount: unknown }>;
  }>;
  currency?: string;
  now?: Date;
}): DealerFinanceSummary {
  const now = args.now ?? new Date();
  let amountDue = 0;
  let overdueAmount = 0;
  let openInvoiceCount = 0;
  for (const inv of args.invoices) {
    const st = String(inv.status).toUpperCase();
    if (st === 'CANCELLED' || st === 'VOID') continue;
    const outstanding = Math.max(0, money(inv.outstandingAmount));
    if (outstanding <= 1e-6) continue;
    amountDue += outstanding;
    openInvoiceCount += 1;
    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    if (due && !Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) {
      overdueAmount += outstanding;
    }
  }
  let availableCredit = 0;
  for (const pay of args.payments) {
    availableCredit += paymentUnallocated(
      money(pay.amount),
      pay.allocations.map((a) => money(a.amount)),
    );
  }
  amountDue = Number(roundMoney(amountDue));
  availableCredit = Number(roundMoney(availableCredit));
  overdueAmount = Number(roundMoney(overdueAmount));
  return {
    amountDue,
    availableCredit,
    netPosition: Number(roundMoney(amountDue - availableCredit)),
    openInvoiceCount,
    overdueAmount,
    currency: args.currency ?? 'ILS',
  };
}

export type StatementEntryRow = {
  entityId: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_APPLIED';
  reference: string;
  description: string;
  /** Increases amount due */
  debit: number;
  /** Reductions of amount due (cash received) — payments only once */
  credit: number;
  runningBalance: number;
  /** Hint for UI: after this entry, available credit if trackable */
  runningCredit?: number;
};

/**
 * Build statement with opening balance before `from`.
 * Payments hit the ledger once as credit (cash in). Allocations do NOT create a second cash credit
 * (that would double-count). Optional CREDIT_APPLIED narrative rows can be omitted for math purity;
 * we keep debit=invoice, credit=payment only for conservation of cash vs charges.
 */
export function buildStatementLedger(args: {
  invoices: Array<{
    id: string;
    number: string;
    invoiceDate: Date;
    total: unknown;
    status: string;
  }>;
  payments: Array<{
    id: string;
    number: string;
    paymentDate: Date;
    amount: unknown;
  }>;
  from?: Date | null;
  to?: Date | null;
}): {
  openingBalance: number;
  closingBalance: number;
  entries: StatementEntryRow[];
  totalInvoiced: number;
  totalPaid: number;
} {
  const from = args.from ?? null;
  const to = args.to ?? null;

  type Raw = {
    entityId: string;
    date: Date;
    type: 'INVOICE' | 'PAYMENT';
    reference: string;
    description: string;
    debit: number;
    credit: number;
  };

  const raw: Raw[] = [];
  for (const inv of args.invoices) {
    const st = String(inv.status).toUpperCase();
    if (st === 'CANCELLED' || st === 'VOID') continue;
    raw.push({
      entityId: inv.id,
      date: inv.invoiceDate,
      type: 'INVOICE',
      reference: inv.number,
      description: `Invoice ${inv.number}`,
      debit: money(inv.total),
      credit: 0,
    });
  }
  for (const pay of args.payments) {
    raw.push({
      entityId: pay.id,
      date: pay.paymentDate,
      type: 'PAYMENT',
      reference: pay.number,
      description: `Payment ${pay.number}`,
      debit: 0,
      credit: money(pay.amount),
    });
  }
  raw.sort((a, b) => a.date.getTime() - b.date.getTime());

  let opening = 0;
  const period: Raw[] = [];
  for (const e of raw) {
    if (from && e.date.getTime() < from.getTime()) {
      opening += e.debit - e.credit;
      continue;
    }
    if (to && e.date.getTime() > to.getTime()) continue;
    period.push(e);
  }

  let balance = opening;
  let totalInvoiced = 0;
  let totalPaid = 0;
  const entries: StatementEntryRow[] = period.map((e) => {
    balance += e.debit - e.credit;
    totalInvoiced += e.debit;
    totalPaid += e.credit;
    return {
      entityId: e.entityId,
      date: e.date.toISOString(),
      type: e.type,
      reference: e.reference,
      description: e.description,
      debit: Number(roundMoney(e.debit)),
      credit: Number(roundMoney(e.credit)),
      runningBalance: Number(roundMoney(balance)),
    };
  });

  return {
    openingBalance: Number(roundMoney(opening)),
    closingBalance: Number(roundMoney(balance)),
    entries,
    totalInvoiced: Number(roundMoney(totalInvoiced)),
    totalPaid: Number(roundMoney(totalPaid)),
  };
}

/** Commercial gate: cannot invoice lines that still require a confirmed price or have unitPrice <= 0. */
export function commercialLinesReady(
  lines: Array<{
    unitPrice: unknown;
    commercialPriceStatus?: string | null;
    manufacturingComplexity?: string | null;
  }>,
): { ok: true } | { ok: false; code: string; message: string } {
  for (const line of lines) {
    const status = String(line.commercialPriceStatus ?? 'CATALOG').toUpperCase();
    const price = money(line.unitPrice);
    if (status === 'REQUIRED') {
      return {
        ok: false,
        code: 'COMMERCIAL_PRICE_REQUIRED',
        message: 'One or more lines require a confirmed commercial sale price before invoicing.',
      };
    }
    if (!(price > 0)) {
      return {
        ok: false,
        code: 'COMMERCIAL_PRICE_REQUIRED',
        message: 'Missing sale price is not zero — set a final commercial price before invoicing.',
      };
    }
  }
  return { ok: true };
}

export function initialCommercialPriceStatus(
  complexity: string | null | undefined,
): 'CATALOG' | 'REQUIRED' | 'CONFIRMED' {
  const c = String(complexity ?? 'STANDARD').toUpperCase();
  if (c === 'MODIFIED' || c === 'CUSTOM') return 'REQUIRED';
  return 'CATALOG';
}
