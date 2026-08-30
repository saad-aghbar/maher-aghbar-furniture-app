/**
 * Piece 12 — management Home summary helpers (pure).
 *
 * API path: `GET /api/v1/reports/management-summary`
 * (plan named `/management/summary` conceptually — reports route avoids new module wiring)
 *
 * Mobile mapping keys: use the same `key` / `filter` strings; resolve `href` via app routes.
 * Admin-web uses the `href` paths below with query `filter` (or path query already encoded).
 *
 * COUNT = DATASET: tile counts must come from prisma.count / aggregate, never findMany take:N .length.
 */

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

export type MgmtFlowPhase = {
  key: string;
  label: string;
  count: number;
  href: string;
  filter: string;
};

export type MgmtEvent = {
  at: string;
  label: string;
  href?: string;
};

export type MgmtBlockedItem = {
  id: string;
  title: string;
  why: string;
  href: string;
  filter: string;
};

export type MgmtWorkers = {
  workingToday: number;
  assigned: number;
  unassigned: number;
  conflicts: number;
};

export type MgmtFinance = {
  receivable: number;
  overdue: number;
  /** NEVER net with overdue — separate credit balance. */
  accountCredit: number;
  paymentsThisMonth: number;
  openInvoices: MgmtTile;
  topOverdue: Array<{
    customerId: string;
    name: string;
    amount: number;
    href: string;
  }>;
};

export type MgmtManufacturing = {
  finalCostOrders: number;
  finalCostTotal: number;
  /** Incomplete costing must never be treated as zero in totals. */
  incompleteCosting: number;
  /** FINAL-only sale − mfg; null when unsafe to compute. */
  grossMfgDifference: number | null;
};

/** Stable tile factory — keeps href/filter contract explicit. */
export function mgmtTile(
  key: string,
  count: number,
  href: string,
  filter: string,
): MgmtTile {
  return { key, count: Number(count) || 0, href, filter };
}

export function mgmtAttention(card: MgmtAttentionCard): MgmtAttentionCard {
  return {
    ...card,
    priority: card.priority ?? 'normal',
  };
}

const PRIORITY_RANK: Record<MgmtAttentionCard['priority'], number> = {
  critical: 0,
  high: 1,
  normal: 2,
};

/** Cap + stable priority sort for Home attention strip. */
export function capAttentionCards(
  cards: MgmtAttentionCard[],
  max = 12,
): MgmtAttentionCard[] {
  return [...cards]
    .sort((a, b) => {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      return a.title.localeCompare(b.title);
    })
    .slice(0, max);
}

export function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/** Admin-web deep-link catalog (filter string mirrors list query acceptance). */
export const MGMT_HREF = {
  qualityWaiting: { href: '/quality', filter: 'waiting' },
  qualityFail: { href: '/quality', filter: 'fail' },
  qualityReinspect: { href: '/quality', filter: 'reinspection' },
  qualityPassedToday: { href: '/quality', filter: 'passedToday' },
  finishedWaiting: {
    href: '/inventory',
    filter: 'lifecycle=finished&scope=inWarehouse',
  },
  shippedAwaiting: { href: '/deliveries', filter: 'section=shipped' },
  leavingToday: { href: '/deliveries', filter: 'section=ready&when=today' },
  overduePickup: { href: '/deliveries', filter: 'section=attention' },
  overdueInvoices: { href: '/invoices', filter: 'overdue=true' },
  openInvoices: { href: '/invoices', filter: 'open=true' },
  returnsWaitingReturn: { href: '/returns', filter: 'physical=WAITING_RETURN' },
  returnsOpen: { href: '/returns', filter: 'approval=PENDING' },
  returnsInspect: { href: '/returns', filter: 'physical=RETURNED' },
  /** RFQ inbox — NOT needs_attention */
  rfqInbox: { href: '/requests', filter: 'inbox' },
  productionStarting: { href: '/production', filter: 'section=inQueue' },
  productionDue: { href: '/production', filter: 'section=late' },
  productionActive: { href: '/production', filter: 'lifecycle=active' },
  productionBlocked: { href: '/production', filter: 'section=blocked' },
  productionCompletedToday: {
    href: '/production',
    filter: 'section=completedToday',
  },
  prepare: { href: '/sales-orders', filter: 'journey=preparing' },
  readyFactory: { href: '/production', filter: 'lifecycle=ready' },
  inProduction: { href: '/production', filter: 'lifecycle=active' },
  qualityRework: { href: '/production', filter: 'lifecycle=inspection' },
  packaging: { href: '/production', filter: 'lifecycle=packaging' },
  finishedFlow: {
    href: '/inventory',
    filter: 'lifecycle=finished&scope=inWarehouse',
  },
  needsPurchasing: { href: '/purchasing', filter: 'needs=purchasing' },
  blockingProduction: {
    href: '/production',
    filter: 'status=WAITING_FOR_MATERIALS',
  },
  arrivingToday: { href: '/purchasing', filter: 'arriving=today' },
  lateSupplierPos: { href: '/purchasing', filter: 'late=true' },
  rawShortages: {
    href: '/inventory',
    filter: 'lifecycle=materials&filter=lowStock',
  },
  semiHandoff: {
    href: '/inventory',
    filter: 'lifecycle=semiFinished&filter=handoff',
  },
  corrections: {
    href: '/inventory',
    filter: 'tab=corrections',
  },
  cancelDisposition: {
    href: '/sales-orders',
    filter: 'disposition=pending',
  },
  setupRequired: {
    href: '/sales-orders',
    filter: 'setup=SETUP_REQUIRED',
  },
  overdueOrders: {
    href: '/sales-orders',
    filter: 'late=true',
  },
  receivingToday: { href: '/purchasing', filter: 'arriving=today' },
} as const;

export const FACTORY_FLOW_META: Array<{
  key: string;
  label: string;
  href: string;
  filter: string;
}> = [
  { key: 'prepare', label: 'Prepare', ...MGMT_HREF.prepare },
  { key: 'ready_factory', label: 'Ready for factory', ...MGMT_HREF.readyFactory },
  { key: 'in_production', label: 'In production', ...MGMT_HREF.inProduction },
  { key: 'quality_rework', label: 'Quality / rework', ...MGMT_HREF.qualityRework },
  { key: 'packaging', label: 'Packaging', ...MGMT_HREF.packaging },
  { key: 'finished', label: 'Finished', ...MGMT_HREF.finishedFlow },
];

export function buildFactoryFlow(
  counts: Record<string, number>,
): MgmtFlowPhase[] {
  return FACTORY_FLOW_META.map((m) => ({
    key: m.key,
    label: m.label,
    count: Number(counts[m.key] ?? 0) || 0,
    href: m.href,
    filter: m.filter,
  }));
}

/**
 * Gross manufacturing difference is safe only when every included order is FINAL
 * and incomplete costing is tracked separately (never folded into totals as 0).
 */
export function computeGrossMfgDifference(args: {
  finalOrders: Array<{ sale: number; mfg: number }>;
  incompleteCosting: number;
}): number | null {
  if (args.finalOrders.length === 0) return null;
  // incompleteCosting > 0 does not poison FINAL-only sum — those orders are excluded upstream.
  const sum = args.finalOrders.reduce((s, o) => s + (o.sale - o.mfg), 0);
  return Math.round(sum * 1000) / 1000;
}
