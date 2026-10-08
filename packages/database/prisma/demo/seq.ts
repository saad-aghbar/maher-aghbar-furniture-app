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
  | 'grn'
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
    grn: 0,
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
  grn: 'GRN',
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
  await liftSequenceCounters(prisma);
}

const NUMBERED_DOCS: Array<{ key: string; prefix: string; load: (prisma: PrismaClient) => Promise<string[]> }> = [
  { key: 'sales_order', prefix: 'SO', load: (prisma) => prisma.salesOrder.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'production_order', prefix: 'PO', load: (prisma) => prisma.productionOrder.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'quotation', prefix: 'Q', load: (prisma) => prisma.quotation.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'invoice', prefix: 'INV', load: (prisma) => prisma.invoice.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'payment', prefix: 'PAY', load: (prisma) => prisma.payment.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'delivery', prefix: 'DLV', load: (prisma) => prisma.delivery.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'rfq', prefix: 'RFQ', load: (prisma) => prisma.requestForQuotation.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'purchase_request', prefix: 'PR', load: (prisma) => prisma.purchaseRequest.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'purchase_order', prefix: 'PORD', load: (prisma) => prisma.purchaseOrder.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'purchase_run', prefix: 'PRUN', load: (prisma) => prisma.purchaseRun.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'grn', prefix: 'GRN', load: (prisma) => prisma.goodsReceipt.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'contract', prefix: 'CTR', load: (prisma) => prisma.contract.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'return_request', prefix: 'RET', load: (prisma) => prisma.returnRequest.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
  { key: 'quality', prefix: 'QC', load: (prisma) => prisma.qualityInspection.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number ?? '')) },
  { key: 'rework', prefix: 'RW', load: (prisma) => prisma.reworkRequest.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number ?? '')) },
  { key: 'task', prefix: 'TSK', load: (prisma) => prisma.productionTask.findMany({ select: { number: true } }).then((rows) => rows.map((r) => r.number)) },
];

function maxSuffix(numbers: string[], prefix: string, year: number): number {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let max = 0;
  for (const number of numbers) {
    const match = re.exec(number);
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

/** Keep counters at or above every seeded PREFIX-YEAR-##### so the next create cannot collide. */
export async function liftSequenceCounters(prisma: PrismaClient): Promise<void> {
  const year = demoYear();
  for (const doc of NUMBERED_DOCS) {
    const max = maxSuffix(await doc.load(prisma), doc.prefix, year);
    const row = await prisma.sequenceCounter.findUnique({ where: { key_year: { key: doc.key, year } } });
    const current = row?.current ?? 0;
    if (max <= current) continue;
    await prisma.sequenceCounter.upsert({
      where: { key_year: { key: doc.key, year } },
      update: { current: max },
      create: { key: doc.key, year, current: max },
    });
  }
}

export async function sequenceCounterGaps(prisma: PrismaClient): Promise<string[]> {
  const year = demoYear();
  const gaps: string[] = [];
  for (const doc of NUMBERED_DOCS) {
    const max = maxSuffix(await doc.load(prisma), doc.prefix, year);
    const row = await prisma.sequenceCounter.findUnique({ where: { key_year: { key: doc.key, year } } });
    const current = row?.current ?? 0;
    if (current < max) gaps.push(`${doc.key} counter ${current} is behind seeded ${doc.prefix}-${year}-${max}`);
  }
  return gaps;
}
