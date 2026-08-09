import { Prisma } from '@prisma/client';

export const VAT = 0.16;
export const COMPANY_DOMAIN = 'maher-aghbar.jo';
/** Seed RNG seed for deterministic re-runs. */
export const RNG_SEED = 19950815;

export function money(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(3));
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function monthsAgo(months: number, dayOfMonth = 15): Date {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  d.setMonth(d.getMonth() - months);
  d.setDate(Math.min(dayOfMonth, 28));
  return d;
}

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export function lineTotals(qty: number, unitPrice: number, taxRate = VAT) {
  const subtotal = qty * unitPrice;
  const taxAmount = subtotal * taxRate;
  const lineTotal = subtotal + taxAmount;
  return {
    subtotal,
    taxAmount,
    lineTotal,
    taxRate,
    subtotalM: money(subtotal),
    taxAmountM: money(taxAmount),
    lineTotalM: money(lineTotal),
  };
}

/** Mulberry32 — deterministic 0..1 stream. */
export function createRng(seed = RNG_SEED) {
  let t = seed >>> 0;
  return {
    next(): number {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    },
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(arr: T[]): T {
      return arr[this.int(0, arr.length - 1)]!;
    },
    chance(p: number): boolean {
      return this.next() < p;
    },
  };
}

export type Rng = ReturnType<typeof createRng>;

/** Seasonality weight by months ago (0 = this month). Higher = busier. */
export function seasonalityWeight(monthsAgoIdx: number): number {
  // Busier: months 0–1 (now), 2–3 (spring/pre-summer), 6–7 (year-start); quieter mid-summer ~4–5
  const map = [1.35, 1.25, 1.4, 1.3, 0.7, 0.65, 1.15, 1.2];
  return map[Math.min(monthsAgoIdx, map.length - 1)] ?? 1;
}
