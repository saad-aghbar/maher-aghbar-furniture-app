export function dealerCanDecideQuotation(
  status: string,
  commerciallyExpired?: boolean,
): boolean {
  if (commerciallyExpired) return false;
  return status === 'SENT' || status === 'VIEWED';
}

export type DealerQuoteDesk = 'all' | 'action' | 'accepted' | 'closed';

export type DealerQuoteRailTone = 'brand' | 'warning' | 'success' | 'error';

export type DealerQuoteRow = {
  id: string;
  number: string;
  status: string;
  version?: number;
  total?: number | string | null;
  commerciallyExpired?: boolean;
  createdAt?: string | null;
  sentAt?: string | null;
  expirationDate?: string | null;
  request?: {
    number?: string | null;
    externalOrderNumber?: string | null;
  } | null;
};

export function dealerQuoteDesk(
  status: string,
  commerciallyExpired?: boolean,
): Exclude<DealerQuoteDesk, 'all'> {
  if (commerciallyExpired || status === 'EXPIRED') return 'closed';
  if (status === 'SENT' || status === 'VIEWED') return 'action';
  if (status === 'ACCEPTED') return 'accepted';
  return 'closed';
}

export function dealerQuoteRailTone(
  status: string,
  commerciallyExpired?: boolean,
): DealerQuoteRailTone {
  const desk = dealerQuoteDesk(status, commerciallyExpired);
  if (desk === 'action') return 'warning';
  if (desk === 'accepted') return 'success';
  if (status === 'REJECTED' || commerciallyExpired || status === 'EXPIRED') {
    return 'error';
  }
  return 'warning';
}

export function quotationListDay(row: DealerQuoteRow): string {
  return (row.createdAt || row.sentAt || '').slice(0, 10);
}

export function quotationExpiryYmd(expirationDate?: string | null): string | null {
  const ymd = (expirationDate ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

/** Whole calendar days from today to expiry. Negative = already past. */
export function quotationDaysLeft(
  expirationDate?: string | null,
  now = new Date(),
): number | null {
  const ymd = quotationExpiryYmd(expirationDate);
  if (!ymd) return null;
  const exp = new Date(`${ymd}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((exp.getTime() - today.getTime()) / 86_400_000);
}

export function quotationLinkedRef(row: DealerQuoteRow): string | null {
  const external = row.request?.externalOrderNumber?.trim();
  if (external) return external;
  const number = row.request?.number?.trim();
  return number || null;
}

export function filterDealerQuotations(
  rows: DealerQuoteRow[],
  opts: {
    desk?: DealerQuoteDesk;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): DealerQuoteRow[] {
  const desk = opts.desk ?? 'all';
  const q = (opts.q ?? '').trim().toLowerCase();
  const { dateFrom, dateTo } = opts;

  return rows.filter((row) => {
    if (desk !== 'all' && dealerQuoteDesk(row.status, row.commerciallyExpired) !== desk) {
      return false;
    }
    const day = quotationListDay(row);
    if (dateFrom && day && day < dateFrom) return false;
    if (dateTo && day && day > dateTo) return false;
    if (q) {
      const hay = [
        row.number,
        row.status,
        row.request?.number,
        row.request?.externalOrderNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function selectDealerQuoteHub(rows: DealerQuoteRow[]): {
  toReview: number;
  accepted: number;
  closed: number;
  actionValue: number;
} {
  let toReview = 0;
  let accepted = 0;
  let closed = 0;
  let actionValue = 0;
  for (const row of rows) {
    const desk = dealerQuoteDesk(row.status, row.commerciallyExpired);
    if (desk === 'action') {
      toReview += 1;
      const n = Number(row.total);
      if (Number.isFinite(n)) actionValue += n;
    } else if (desk === 'accepted') {
      accepted += 1;
    } else {
      closed += 1;
    }
  }
  return { toReview, accepted, closed, actionValue };
}
