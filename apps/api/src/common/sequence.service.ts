import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Canonical sequence keys used by seed data (`sequence_counters.key`).
 * API callers historically used short uppercase labels (`RFQ`, `SO`, …);
 * without this map they write a parallel counter and collide with seeded docs.
 */
const SEQUENCE_KEY_ALIASES: Record<string, string> = {
  rfq: 'rfq',
  so: 'sales_order',
  sales_order: 'sales_order',
  po: 'production_order',
  production_order: 'production_order',
  qt: 'quotation',
  quotation: 'quotation',
  inv: 'invoice',
  invoice: 'invoice',
  pay: 'payment',
  payment: 'payment',
  del: 'delivery',
  delivery: 'delivery',
  pr: 'purchase_request',
  purchase_request: 'purchase_request',
  pord: 'purchase_order',
  purchase_order: 'purchase_order',
  prun: 'purchase_run',
  purchase_run: 'purchase_run',
  grn: 'grn',
  goods_receipt: 'grn',
  task: 'task',
  qc: 'quality',
  quality: 'quality',
  rw: 'rework',
  rework: 'rework',
  ctr: 'contract',
  contract: 'contract',
  ret: 'return_request',
  return_request: 'return_request',
  rd: 'return_disposition',
  return_disposition: 'return_disposition',
  rp: 'replacement',
  replacement: 'replacement',
  rc: 'return_recovery',
  return_recovery: 'return_recovery',
};

function canonicalizeSequenceKey(key: string): string {
  const normalized = key.trim().toLowerCase();
  return SEQUENCE_KEY_ALIASES[normalized] ?? normalized;
}

export function formatDocumentNumber(prefix: string, year: number, current: number): string {
  return `${prefix}-${year}-${String(current).padStart(5, '0')}`;
}

@Injectable()
export class SequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async next(key: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const canonical = canonicalizeSequenceKey(key);
    const row = await this.prisma.sequenceCounter.upsert({
      where: { key_year: { key: canonical, year } },
      create: { key: canonical, year, current: 1 },
      update: { current: { increment: 1 } },
    });
    return formatDocumentNumber(prefix, year, row.current);
  }

  /** Increment until `isTaken` is false — counters that lag seeded docs must not 500. */
  async nextUnused(
    key: string,
    prefix: string,
    isTaken: (number: string) => Promise<boolean>,
  ): Promise<string> {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const number = await this.next(key, prefix);
      if (!(await isTaken(number))) return number;
    }
    throw new Error(`Could not allocate a unique ${prefix} number.`);
  }
}
