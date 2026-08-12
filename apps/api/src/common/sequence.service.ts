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
  task: 'task',
  ctr: 'contract',
  contract: 'contract',
  ret: 'return_request',
  return_request: 'return_request',
};

function canonicalizeSequenceKey(key: string): string {
  const normalized = key.trim().toLowerCase();
  return SEQUENCE_KEY_ALIASES[normalized] ?? normalized;
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
    return `${prefix}-${year}-${String(row.current).padStart(5, '0')}`;
  }
}
