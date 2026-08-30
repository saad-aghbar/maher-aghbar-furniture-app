/** Piece 12 — GET /api/v1/reports/management-summary response shape (admin-web). */

export type MgmtTile = {
  count: number;
  key: string;
  href: string;
  filter: string;
};

export type MgmtAttentionCard = {
  id: string;
  title: string;
  why: string;
  actionLabel: string;
  priority: 'critical' | 'high' | 'normal';
  href: string;
  filter: string;
};

export type MgmtActivityItem = {
  at: string;
  label: string;
  href?: string;
};

export type MgmtFactoryFlowStep = {
  key: string;
  label: string;
  count: number;
  href: string;
  filter: string;
};

export type ManagementSummary = {
  attention: MgmtAttentionCard[];
  today: {
    productionStarting: MgmtTile;
    productionDue: MgmtTile;
    qualityWaiting: MgmtTile;
    finishedToday: MgmtTile;
    leavingToday: MgmtTile;
    receivingToday: MgmtTile;
  };
  factoryFlow: MgmtFactoryFlowStep[];
  production: {
    activeOrders: MgmtTile;
    tasksCompletedToday: MgmtTile;
    blocked: MgmtTile;
    dueToday: MgmtTile;
    events: MgmtActivityItem[];
  };
  blocked: Array<{ id: string; title: string; why: string; href: string; filter: string }>;
  workers: {
    workingToday: number;
    assigned: number;
    unassigned: number;
    conflicts: number;
  } | null;
  late: { overdue: MgmtTile; atRiskLimited: boolean };
  outbound: {
    finishedWaiting: MgmtTile;
    leavingToday: MgmtTile;
    overduePickup: MgmtTile;
    shippedAwaitingDealer: MgmtTile;
  };
  materials: {
    needsPurchasing: MgmtTile;
    blockingProduction: MgmtTile;
    arrivingToday: MgmtTile;
    lateSupplierPos: MgmtTile;
  };
  inventory?: {
    rawShortages: MgmtTile;
    semiHandoff: MgmtTile;
    finishedWaiting: MgmtTile;
    correctionsAttention: MgmtTile;
  } | null;
  quality?: {
    waitingInspection: MgmtTile;
    failRework: MgmtTile;
    readyReinspection: MgmtTile;
    passedToday: MgmtTile;
  } | null;
  exceptions?: {
    returnsOpen: MgmtTile;
    waitingReturn: MgmtTile;
    waitingInspection: MgmtTile;
    cancelDisposition: MgmtTile;
    inventoryCorrections: MgmtTile;
  } | null;
  finance: {
    receivable: number;
    overdue: number;
    accountCredit: number;
    paymentsThisMonth: number;
    openInvoices: MgmtTile;
    topOverdue: Array<{ customerId: string; name: string; amount: number; href: string }>;
  } | null;
  manufacturing: {
    finalCostOrders: number;
    finalCostTotal: number;
    incompleteCosting: number;
    grossMfgDifference: number | null;
  } | null;
  activity: MgmtActivityItem[];
  generatedAt: string;
};

/** Combine API tile href + filter into a Next Link path (query string). */
export function tileLink(href: string, filter?: string | null): string {
  const path = (href || '/').trim() || '/';
  const f = (filter ?? '').trim().replace(/^\?/, '');
  if (!f) return path;
  // Bare token (e.g. "waiting") → filter=waiting; already key=value → as-is.
  const qs = f.includes('=') ? f : `filter=${encodeURIComponent(f)}`;
  if (path.includes('?')) {
    if (path.includes(qs) || path.includes(f)) return path;
    return `${path}&${qs}`;
  }
  return `${path}?${qs}`;
}

export function tileValues(section: Record<string, MgmtTile | unknown> | null | undefined): MgmtTile[] {
  if (!section) return [];
  return Object.values(section).filter(
    (v): v is MgmtTile =>
      Boolean(v) &&
      typeof v === 'object' &&
      'count' in (v as object) &&
      'href' in (v as object) &&
      'key' in (v as object),
  );
}

export function sectionTileSum(tiles: MgmtTile[]): number {
  return tiles.reduce((s, t) => s + (Number.isFinite(t.count) ? t.count : 0), 0);
}
