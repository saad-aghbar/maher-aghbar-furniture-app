import type { PrismaClient } from '@prisma/client';
import { demoYear } from './clock';

export type SeqKey =
  | 'sales_order'
  | 'production_order'
  | 'task'
  | 'rfq'
  | 'quotation'
  | 'invoice'
  | 'payment'
  | 'delivery'
  | 'contract'
  | 'return_request'
  | 'purchase_request'
  | 'purchase_order'
  | 'invtx'
  | 'quality'
  | 'rework'
  | 'ai_job';

export type SeqBag = Record<SeqKey, number>;

export function emptySeq(): SeqBag {
  return {
    sales_order: 0,
    production_order: 0,
    task: 0,
    rfq: 0,
    quotation: 0,
    invoice: 0,
    payment: 0,
    delivery: 0,
    contract: 0,
    return_request: 0,
    purchase_request: 0,
    purchase_order: 0,
    invtx: 0,
    quality: 0,
    rework: 0,
    ai_job: 0,
  };
}

const PREFIX: Record<SeqKey, string> = {
  sales_order: 'SO',
  production_order: 'PO',
  task: 'TSK',
  rfq: 'RFQ',
  quotation: 'Q',
  invoice: 'INV',
  payment: 'PAY',
  delivery: 'DLV',
  contract: 'CT',
  return_request: 'RET',
  purchase_request: 'PR',
  purchase_order: 'PORD',
  invtx: 'ITX',
  quality: 'QC',
  rework: 'RW',
  ai_job: 'AI',
};

function pad5(n: number) {
  return String(n).padStart(5, '0');
}

export async function nextDoc(
  prisma: PrismaClient,
  key: SeqKey,
  counters: SeqBag,
): Promise<string> {
  counters[key] += 1;
  const year = demoYear();
  const seqKey = key === 'invtx' ? 'inventory_tx' : key;
  await prisma.sequenceCounter.upsert({
    where: { key_year: { key: seqKey, year } },
    create: { key: seqKey, year, current: counters[key] },
    update: { current: counters[key] },
  });
  return `${PREFIX[key]}-${year}-${pad5(counters[key])}`;
}

export async function seedDemoSequences(prisma: PrismaClient, counters: SeqBag) {
  const year = demoYear();
  const keys = Object.keys(counters) as SeqKey[];
  for (const key of keys) {
    const seqKey = key === 'invtx' ? 'inventory_tx' : key;
    await prisma.sequenceCounter.upsert({
      where: { key_year: { key: seqKey, year } },
      update: { current: counters[key] },
      create: { key: seqKey, year, current: counters[key] },
    });
  }
}
