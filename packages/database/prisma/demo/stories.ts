import { ReturnReason } from '@prisma/client';
import { EXTRA_PROJECT_NAMES } from './extra-project-names';

export type StoryKind =
  | 'delivered'
  | 'ready_delivery'
  | 'packaging'
  | 'qc'
  | 'in_production'
  | 'not_started'
  | 'waiting_materials'
  | 'proposed'
  | 'draft'
  | 'at_risk_material'
  | 'at_risk_wip'
  | 'at_risk_committed'
  | 'rework_current'
  | 'rework_historical';

export type DemoStory = {
  id: string;
  dealer: string;
  sku: string;
  qty: number;
  kind: StoryKind;
  /** Last COMPLETED stage code (ignored for kinds that imply a full/empty path). */
  completeThrough?: string;
  payment?: 'paid' | 'partial' | 'outstanding';
  returnInfo?: { reason: ReturnReason; qty: number; approval: 'APPROVED' | 'PENDING' | 'REJECTED' };
  projectName: string;
  fabric?: string;
  wood?: string;
  notes?: string;
  /** Days after 2026-06-16. */
  orderDay: number;
  deliveryLeadDays: number;
};

const DEALERS = [
  'nile',
  'oasis',
  'balqis',
  'cedar',
  'zaatar',
  'qasr',
  'rawnaq',
  'diwan',
  'noor',
  'jabal',
] as const;

const SKUS = [
  'SOF-3S-STD',
  'SOF-3S-LUX',
  'SOF-2S',
  'SOF-L-SEC',
  'SOF-CORN',
  'CUS-BANQ',
  'ARM-01',
  'ARM-02',
  'ARM-WING',
  'CHAIR-DIN',
  'CHAIR-DIN-W',
  'TABLE-DIN-6',
  'TABLE-DIN-8',
  'TABLE-CF',
  'TABLE-SIDE',
  'TABLE-CONS',
  'BED-Q',
  'BED-K',
  'BED-HEAD',
  'CUS-OTT',
  'CHAIR-BENCH',
] as const;

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]!;
}

export function buildDemoStories(): DemoStory[] {
  const flagship: DemoStory[] = [
    {
      id: 'nile-abdoun-lounge',
      dealer: 'nile',
      sku: 'SOF-3S-STD',
      qty: 2,
      kind: 'delivered',
      payment: 'paid',
      projectName: 'Abdoun lounge set',
      fabric: 'Velvet Sand',
      wood: 'Beech',
      orderDay: 4,
      deliveryLeadDays: 28,
      notes: 'Match sand velvet lot from the showroom swatch.',
    },
    {
      id: 'oasis-sweifieh-sectional',
      dealer: 'oasis',
      sku: 'SOF-L-SEC',
      qty: 1,
      kind: 'in_production',
      completeThrough: 'CARPENTRY',
      projectName: 'Sweifieh sectional',
      fabric: 'Boucle Cream',
      wood: 'Beech',
      orderDay: 42,
      deliveryLeadDays: 35,
    },
    {
      id: 'balqis-abdali-banquettes',
      dealer: 'balqis',
      sku: 'CUS-BANQ',
      qty: 6,
      kind: 'ready_delivery',
      projectName: 'Abdali hotel banquettes',
      fabric: 'Velvet Navy',
      wood: 'Beech',
      orderDay: 18,
      deliveryLeadDays: 40,
    },
    {
      id: 'cedar-italian-velvet',
      dealer: 'cedar',
      sku: 'SOF-RECL',
      qty: 1,
      kind: 'at_risk_material',
      projectName: 'Cedar Italian velvet recliner',
      fabric: 'Italian velvet',
      wood: 'Beech',
      orderDay: 50,
      deliveryLeadDays: 30,
      notes: 'Waiting inbound Italian velvet PO (SUP-FABRIC).',
    },
    {
      id: 'diwan-wingback-foam',
      dealer: 'diwan',
      sku: 'ARM-WING',
      qty: 2,
      kind: 'at_risk_wip',
      completeThrough: 'CARPENTRY',
      projectName: 'Diwan wingback foam gate',
      fabric: 'Velvet Navy',
      wood: 'Beech',
      orderDay: 46,
      deliveryLeadDays: 28,
    },
    {
      id: 'jabal-dining-late',
      dealer: 'jabal',
      sku: 'TABLE-DIN-8',
      qty: 1,
      kind: 'at_risk_committed',
      completeThrough: 'PAINTING',
      projectName: 'Jabal contract dining',
      wood: 'Oak',
      orderDay: 20,
      deliveryLeadDays: 22,
    },
    {
      id: 'oasis-armchair-rework',
      dealer: 'oasis',
      sku: 'ARM-01',
      qty: 1,
      kind: 'rework_current',
      projectName: 'Oasis club armchair QC',
      fabric: 'Velvet Sand',
      wood: 'Beech',
      orderDay: 38,
      deliveryLeadDays: 24,
    },
    {
      id: 'nile-loveseat-recovered',
      dealer: 'nile',
      sku: 'SOF-2S',
      qty: 1,
      kind: 'rework_historical',
      payment: 'partial',
      projectName: 'Nile loveseat recovered',
      fabric: 'Linen Natural',
      wood: 'Beech',
      orderDay: 8,
      deliveryLeadDays: 30,
    },
    {
      id: 'zaatar-ottoman-return',
      dealer: 'zaatar',
      sku: 'CUS-OTT',
      qty: 2,
      kind: 'delivered',
      payment: 'paid',
      returnInfo: { reason: ReturnReason.DELIVERY_DAMAGE, qty: 1, approval: 'APPROVED' },
      projectName: 'Zaatar ottoman scuff',
      fabric: 'Velvet Sand',
      orderDay: 12,
      deliveryLeadDays: 21,
    },
    {
      id: 'qasr-dining-proposed',
      dealer: 'qasr',
      sku: 'TABLE-DIN-6',
      qty: 2,
      kind: 'proposed',
      projectName: 'Qasr suite dining',
      wood: 'Oak',
      orderDay: 58,
      deliveryLeadDays: 28,
    },
    {
      id: 'noor-chair-draft',
      dealer: 'noor',
      sku: 'ARM-02',
      qty: 4,
      kind: 'draft',
      projectName: 'Noor club chair hold',
      fabric: 'Leatherette Black',
      orderDay: 60,
      deliveryLeadDays: 25,
    },
    {
      id: 'rawnaq-dining-chairs',
      dealer: 'rawnaq',
      sku: 'CHAIR-DIN',
      qty: 6,
      kind: 'not_started',
      projectName: 'Rawnaq dining six',
      fabric: 'Linen Olive',
      wood: 'Beech',
      orderDay: 55,
      deliveryLeadDays: 26,
    },
  ];

  const extra: DemoStory[] = [];
  let n = 0;
  const push = (kind: StoryKind, partial: Partial<DemoStory> = {}) => {
    const dealer = pick(DEALERS, n + 3);
    const sku = pick(SKUS, n + 7);
    extra.push({
      id: `${kind}-${n}`,
      dealer,
      sku,
      qty: sku.startsWith('CHAIR') ? 4 : 1,
      kind,
      projectName: EXTRA_PROJECT_NAMES[n] ?? `Amman Residence ${n + 1}`,
      orderDay: 6 + ((n * 3) % 50),
      deliveryLeadDays: 24 + (n % 10),
      fabric: 'Velvet Sand',
      wood: 'Beech',
      ...partial,
    });
    n += 1;
  };

  // 20 delivered: 2 flagship delivered + 1 historical rework + 16 generated.
  for (let i = 0; i < 16; i += 1) {
    push('delivered', {
      payment: i % 3 === 0 ? 'paid' : i % 3 === 1 ? 'partial' : 'outstanding',
      returnInfo:
        i === 1
          ? { reason: ReturnReason.INCORRECT_COLOR, qty: 1, approval: 'PENDING' }
          : i === 4
            ? { reason: ReturnReason.CUSTOMER_REQUEST, qty: 1, approval: 'REJECTED' }
            : undefined,
    });
  }

  for (let i = 0; i < 3; i += 1) push('ready_delivery');
  for (let i = 0; i < 4; i += 1) push('packaging');
  for (let i = 0; i < 4; i += 1) push('qc');

  const prodThrough = ['MATERIAL_PREP', 'CARPENTRY', 'PAINTING', 'FOAM', 'UPHOLSTERY', 'ASSEMBLY'] as const;
  for (let i = 0; i < 17; i += 1) {
    push('in_production', { completeThrough: prodThrough[i % prodThrough.length] });
  }

  for (let i = 0; i < 7; i += 1) push('not_started');
  push('proposed');
  push('draft');

  if (extra.length !== EXTRA_PROJECT_NAMES.length) {
    throw new Error(
      `extra project names (${EXTRA_PROJECT_NAMES.length}) do not match extras (${extra.length})`,
    );
  }

  return [...flagship, ...extra];
}
