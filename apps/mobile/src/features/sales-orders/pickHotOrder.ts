export type HotOrderCandidate = {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  progressPercent: number;
  deliveryDate: string | null;
  priority?: string;
  dealerName?: string;
  sellerPrice?: number | null;
  kind?: 'order' | 'rfq';
};

const DONE = new Set(['DELIVERED', 'COMPLETED', 'INVOICED', 'CANCELLED', 'VOID']);

function priorityScore(priority: string | undefined): number {
  const p = (priority ?? '').toUpperCase();
  if (p === 'URGENT') return 40;
  if (p === 'HIGH') return 30;
  if (p === 'NORMAL' || p === 'MEDIUM') return 10;
  if (p === 'LOW') return 5;
  return 0;
}

function lateScore(deliveryDate: string | null, status: string, now: number): number {
  if (!deliveryDate || DONE.has(status.toUpperCase())) return 0;
  const t = Date.parse(deliveryDate);
  if (!Number.isFinite(t) || t >= now) return 0;
  // More overdue → higher (cap days)
  const days = Math.min(30, Math.floor((now - t) / 86_400_000));
  return 100 + days;
}

function productionScore(status: string): number {
  const s = status.toUpperCase();
  if (s === 'IN_PRODUCTION' || s === 'IN_PROGRESS') return 25;
  if (s === 'READY_FOR_DELIVERY') return 20;
  if (s === 'READY_FOR_PRODUCTION' || s === 'CONFIRMED') return 12;
  if (s === 'SUBMITTED' || s === 'DRAFT') return 15; // RFQs surface
  return 0;
}

function nearestDeliveryScore(deliveryDate: string | null, now: number): number {
  if (!deliveryDate) return 0;
  const t = Date.parse(deliveryDate);
  if (!Number.isFinite(t) || t < now) return 0;
  const days = Math.floor((t - now) / 86_400_000);
  if (days <= 3) return 18;
  if (days <= 7) return 10;
  return 2;
}

export function scoreHotOrder(item: HotOrderCandidate, now = Date.now()): number {
  if (DONE.has(item.status.toUpperCase())) return -1;
  return (
    lateScore(item.deliveryDate, item.status, now) +
    priorityScore(item.priority) +
    productionScore(item.status) +
    nearestDeliveryScore(item.deliveryDate, now) +
    (item.kind === 'rfq' ? 8 : 0)
  );
}

/** Ranked pick: late → urgent/high → nearest delivery → in-production. */
export function pickHotOrder(
  items: HotOrderCandidate[],
  now = Date.now(),
): HotOrderCandidate | null {
  let best: HotOrderCandidate | null = null;
  let bestScore = -1;
  for (const item of items) {
    const score = scoreHotOrder(item, now);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore > 0 ? best : items.find((i) => !DONE.has(i.status.toUpperCase())) ?? null;
}
