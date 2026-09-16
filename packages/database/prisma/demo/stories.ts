import { ReturnReason } from '@prisma/client';

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
  custom?: boolean;
  complexity?: 'STANDARD' | 'MODIFIED' | 'CUSTOM';
  width?: number;
  height?: number;
  depth?: number;
  notes?: string;
  name?: string;
  /**
   * Per-line factory progress override (stage code).
   * - `string` — complete through that stage on this sub-order
   * - `null` — force no progress (do not inherit story-level completeThrough)
   * - omitted — inherit story-level / kind defaults
   */
  completeThrough?: string | null;
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

/** Compress the old two-month story days into the 21-day window. */
function windowDay(old: number): number {
  return Math.min(20, Math.max(0, Math.round((old * 20) / 62)));
}

const GOLDEN_EXTRA_LINES: DemoStoryLine[] = [
  {
    sku: 'SOF-3S-STD',
    variantCode: 'KARINA',
    qty: 1,
    fabric: 'Velvet Navy',
    wood: 'Beech',
    complexity: 'STANDARD',
  },
  {
    sku: 'SOF-3S-STD',
    variantCode: 'STD',
    qty: 1,
    fabric: 'Velvet Sand',
    wood: 'Beech',
    complexity: 'MODIFIED',
    width: 280,
  },
  {
    sku: 'CUSTOM',
    custom: true,
    complexity: 'CUSTOM',
    qty: 1,
    fabric: 'Boucle Cream',
    notes: 'Bespoke corner bench to the sketch.',
    name: 'Custom corner bench',
  },
];

export function storyLinesOf(story: DemoStory): DemoStoryLine[] {
  return [
    {
      sku: story.sku,
      variantCode: story.variantCode ?? 'STD',
      qty: story.qty,
      fabric: story.fabric,
      wood: story.wood,
      ...(story.completeThrough
        ? { completeThrough: story.completeThrough }
        : {}),
    },
    ...(story.extraLines ?? []),
  ];
}

/**
 * Curated flagship cast only — no generated “Amman Residence” flood.
 * Cost twin (`SO-COST-GOLDEN`) is seeded in cost-performance-uat.ts, not here.
 */
export function buildDemoStories(): DemoStory[] {
  return [
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
      extraLines: [
        {
          sku: 'CUS-OTT',
          variantCode: 'SAND',
          qty: 2,
          fabric: 'Velvet Sand',
          completeThrough: 'MATERIAL_PREP',
        },
        {
          sku: 'TABLE-SIDE',
          variantCode: 'STD',
          qty: 1,
          wood: 'Oak',
          completeThrough: 'MATERIAL_PREP',
        },
      ],
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
      extraLines: [{ sku: 'TABLE-SIDE', variantCode: 'STD', qty: 1, wood: 'Oak' }],
      notes:
        'Just entered production — empty materials, WIP, and floor progress. Use for production hub / setup checks.',
    },
    {
      id: 'nile-golden-factory-path',
      dealer: 'nile',
      sku: 'SOF-3S-STD',
      variantCode: 'STD',
      qty: 2,
      kind: 'not_started',
      projectName: 'Golden factory path',
      fabric: 'Velvet Sand',
      wood: 'Beech',
      orderDay: windowDay(18),
      deliveryLeadDays: 21,
      extraLines: GOLDEN_EXTRA_LINES,
      notes: 'Golden factory path — four manufacturing kinds on one sales order (preparing).',
    },
    {
      id: 'nile-golden-floor-lounge',
      dealer: 'nile',
      sku: 'SOF-3S-STD',
      variantCode: 'STD',
      qty: 2,
      kind: 'in_production',
      /** Primary line A: carpentry finished → carpenter remaining can be zero on this PO. */
      completeThrough: 'CARPENTRY',
      projectName: 'Golden floor lounge',
      fabric: 'Velvet Sand',
      wood: 'Beech',
      orderDay: windowDay(40),
      deliveryLeadDays: 21,
      extraLines: [
        {
          ...GOLDEN_EXTRA_LINES[0]!,
          /** Line B: only materials done → later stages locked for carpentry workers. */
          completeThrough: 'MATERIAL_PREP',
        },
        {
          ...GOLDEN_EXTRA_LINES[1]!,
          /** Line C: materials done → carpentry READY/actionable. */
          completeThrough: 'MATERIAL_PREP',
        },
        {
          ...GOLDEN_EXTRA_LINES[2]!,
          /** Line D: nothing done — do not inherit story CARPENTRY. */
          completeThrough: null,
        },
      ],
      notes:
        'Released twin of Golden path — multi-item My Tasks board (done / locked / open sub-orders).',
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
      extraLines: [
        { sku: 'TABLE-CONS', variantCode: 'STD', qty: 2, wood: 'Oak' },
      ],
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
      extraLines: [{ sku: 'CUS-OTT', variantCode: 'SAND', qty: 1, fabric: 'Italian velvet' }],
      notes: 'Waiting inbound Italian velvet PO (SUP-FABRIC).',
    },
    {
      id: 'diwan-wingback-foam',
      dealer: 'diwan',
      sku: 'ARM-WING',
      qty: 2,
      kind: 'at_risk_wip',
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
      extraLines: [{ sku: 'CHAIR-DIN', variantCode: 'STD', qty: 8, fabric: 'Linen Olive' }],
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
      extraLines: [
        { sku: 'CHAIR-DIN', variantCode: 'STD', qty: 6, fabric: 'Linen Olive' },
        { sku: 'TABLE-SIDE', variantCode: 'STD', qty: 2, wood: 'Oak' },
      ],
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
      extraLines: [{ sku: 'TABLE-CF', variantCode: 'WAL', qty: 1, wood: 'Oak' }],
    },
  ];
}
