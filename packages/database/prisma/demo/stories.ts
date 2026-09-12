import { ReturnReason } from '@prisma/client';
import { EXTRA_PROJECT_NAMES } from './extra-project-names';

export type StoryKind =
  | 'delivered'
  | 'ready_delivery'
  | 'packaging'
  | 'qc'
  | 'in_production'
  /** SO/PO in production, first stage READY, no issues / WIP / started tasks. */
  | 'fresh_production'
  | 'not_started'
  | 'waiting_materials'
  | 'proposed'
  | 'draft'
  | 'at_risk_material'
  | 'at_risk_wip'
  | 'at_risk_committed'
  | 'rework_current'
  | 'rework_historical';

export type DemoStoryLine = {
  sku: string;
  variantCode?: string;
  qty: number;
  fabric?: string;
  wood?: string;
};

export type DemoStory = {
  id: string;
  dealer: string;
  sku: string;
  variantCode?: string;
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
  /** Extra basket lines on the same sales order. */
  extraLines?: DemoStoryLine[];
  /** Days after 2026-08-22. */
  orderDay: number;
  deliveryLeadDays: number;
  /**
   * When set, physical SEMI/FIN lots and task completedQty use this qty
   * while the sales/PO quantity stays `qty` (partial progress story).
   */
  physicalOutputQty?: number;
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

/** Compress the old two-month story days into the 21-day window. */
function windowDay(old: number): number {
  return Math.min(20, Math.max(0, Math.round((old * 20) / 62)));
}

export function storyLinesOf(story: DemoStory): DemoStoryLine[] {
  return [
    {
      sku: story.sku,
      variantCode: story.variantCode ?? 'STD',
      qty: story.qty,
      fabric: story.fabric,
      wood: story.wood,
    },
    ...(story.extraLines ?? []),
  ];
}

export function buildDemoStories(): DemoStory[] {
  const flagship: DemoStory[] = [
    {
      id: 'nile-abdoun-lounge',
      dealer: 'nile',
      sku: 'SOF-3S-STD',
      variantCode: 'KARINA',
      qty: 2,
      kind: 'delivered',
      payment: 'paid',
      projectName: 'Abdoun lounge set',
      fabric: 'Velvet Navy',
      wood: 'Beech',
      orderDay: windowDay(4),
      deliveryLeadDays: 14,
      extraLines: [
        { sku: 'ARM-01', variantCode: 'SAND', qty: 2, fabric: 'Velvet Sand', wood: 'Beech' },
        { sku: 'TABLE-CF', variantCode: 'WAL', qty: 1, wood: 'Oak' },
      ],
      notes: 'Match sand velvet lot from the showroom swatch.',
    },
    {
      id: 'oasis-sweifieh-sectional',
      dealer: 'oasis',
      sku: 'SOF-L-SEC',
      variantCode: 'CREAM',
      qty: 1,
      kind: 'in_production',
      completeThrough: 'CARPENTRY',
      projectName: 'Sweifieh sectional',
      fabric: 'Boucle Cream',
      wood: 'Beech',
      orderDay: windowDay(42),
      deliveryLeadDays: 18,
      extraLines: [{ sku: 'CUS-OTT', variantCode: 'SAND', qty: 2, fabric: 'Velvet Sand' }],
    },
    {
      id: 'nile-fresh-production-blank',
      dealer: 'nile',
      sku: 'ARM-01',
      qty: 1,
      kind: 'fresh_production',
      projectName: 'Nile blank production start',
      fabric: 'Velvet Sand',
      wood: 'Beech',
      orderDay: windowDay(62),
      deliveryLeadDays: 30,
      notes:
        'Just entered production — empty materials, WIP, and floor progress. Use for production hub / setup checks.',
    },
    {
      id: 'noor-banquette-partial-frames',
      dealer: 'noor',
      sku: 'CUS-BANQ',
      qty: 6,
      kind: 'in_production',
      completeThrough: 'CARPENTRY',
      physicalOutputQty: 4,
      projectName: 'Noor banquettes 4 of 6 frames',
      fabric: 'Velvet Navy',
      wood: 'Beech',
      orderDay: windowDay(44),
      deliveryLeadDays: 32,
      notes: 'Partial SEMI: 4 of 6 frames produced; remaining 2 still open.',
    },
    {
      id: 'balqis-abdali-banquettes',
      dealer: 'balqis',
      sku: 'CUS-BANQ',
      variantCode: 'NAVY',
      qty: 6,
      kind: 'ready_delivery',
      projectName: 'Abdali hotel banquettes',
      fabric: 'Velvet Navy',
      wood: 'Beech',
      orderDay: windowDay(18),
      deliveryLeadDays: 16,
    },
    {
      id: 'cedar-italian-velvet',
      dealer: 'cedar',
      sku: 'SOF-RECL',
      variantCode: 'ITAL',
      qty: 1,
      kind: 'at_risk_material',
      projectName: 'Cedar Italian velvet recliner',
      fabric: 'Italian velvet',
      wood: 'Beech',
      orderDay: windowDay(50),
      deliveryLeadDays: 30,
      notes: 'Waiting inbound Italian velvet PO (SUP-FABRIC).',
    },
    {
      id: 'diwan-wingback-foam',
      dealer: 'diwan',
      sku: 'ARM-WING',
      qty: 2,
      kind: 'at_risk_wip',
      // Honest WIP_NOT_READY: materials prepped, frames (SEMI) not produced yet.
      completeThrough: 'MATERIAL_PREP',
      projectName: 'Diwan wingback frame gate',
      fabric: 'Velvet Navy',
      wood: 'Beech',
      orderDay: windowDay(46),
      deliveryLeadDays: 28,
      notes: 'Waiting on carpentry frames (SEMI lots) before foam/upholstery.',
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
      orderDay: windowDay(20),
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
      orderDay: windowDay(38),
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
      orderDay: windowDay(8),
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
      orderDay: windowDay(12),
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
      orderDay: windowDay(58),
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
      orderDay: windowDay(60),
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
      orderDay: windowDay(55),
      deliveryLeadDays: 26,
      extraLines: [{ sku: 'TABLE-DIN-6', variantCode: 'STD', qty: 1, wood: 'Oak' }],
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
      variantCode: n % 3 === 0 ? 'STD' : undefined,
      qty: sku.startsWith('CHAIR') ? 4 : 1,
      kind,
      projectName: EXTRA_PROJECT_NAMES[n] ?? `Amman Residence ${n + 1}`,
      orderDay: n % 21,
      deliveryLeadDays: 12 + (n % 8),
      fabric: 'Velvet Sand',
      wood: 'Beech',
      extraLines:
        n % 5 === 1 && sku !== 'TABLE-SIDE'
          ? [{ sku: 'TABLE-SIDE', variantCode: 'STD', qty: 1 }]
          : n % 5 === 3 && sku !== 'CUS-OTT' && sku !== 'ARM-01'
            ? [{ sku: 'CUS-OTT', variantCode: 'SAND', qty: 1, fabric: 'Velvet Sand' }]
            : undefined,
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
