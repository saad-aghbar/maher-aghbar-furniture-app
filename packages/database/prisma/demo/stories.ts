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
  /** Days after demo window start. */
  orderDay: number;
  deliveryLeadDays: number;
  /**
   * When set, physical SEMI/FIN lots and task completedQty use this qty
   * while the sales/PO quantity stays `qty` (partial progress story).
   */
  physicalOutputQty?: number;
};

/** Compress older story day indices into the 30-day window. */
function windowDay(old: number): number {
  return Math.min(29, Math.max(0, Math.round((old * 29) / 62)));
}

/**
 * Golden SO lines (4 total with primary STD qty 2):
 * STD · KARINA · MODIFIED · CUSTOM (null productId).
 */
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
 * Minimal flagship cast — nile + oasis only, slim catalog SKUs only
 * (SOF-3S-STD, SOF-LUNA, ARM-01, BED-Q + CUSTOM).
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
        { sku: 'ARM-01', variantCode: 'STD', qty: 2, fabric: 'Velvet Sand', wood: 'Beech' },
        { sku: 'BED-Q', variantCode: 'STD', qty: 1, fabric: 'Linen Natural', wood: 'Pine' },
      ],
      notes: 'Match sand velvet lot from the showroom swatch.',
    },
    {
      id: 'oasis-sweifieh-sectional',
      dealer: 'oasis',
      sku: 'SOF-LUNA',
      variantCode: 'CORNER',
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
          sku: 'ARM-01',
          variantCode: 'STD',
          qty: 2,
          fabric: 'Velvet Sand',
          completeThrough: 'MATERIAL_PREP',
        },
        {
          sku: 'BED-Q',
          variantCode: 'STD',
          qty: 1,
          wood: 'Pine',
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
      extraLines: [{ sku: 'BED-Q', variantCode: 'STD', qty: 1, wood: 'Pine' }],
      notes:
        'Just entered production — empty materials, WIP, and floor progress. Use for production hub / setup checks.',
    },
    {
      id: 'nile-golden-factory-path',
      dealer: 'nile',
      sku: 'SOF-3S-STD',
      variantCode: 'STD',
      qty: 2,
      kind: 'in_production',
      /** Primary STD qty2: carpentry finished → carpenter remaining can be zero on this PO. */
      completeThrough: 'CARPENTRY',
      projectName: 'Golden factory path',
      fabric: 'Velvet Sand',
      wood: 'Beech',
      orderDay: windowDay(18),
      deliveryLeadDays: 21,
      extraLines: [
        {
          ...GOLDEN_EXTRA_LINES[0]!,
          /** KARINA: only materials done → later stages locked. */
          completeThrough: 'MATERIAL_PREP',
        },
        {
          ...GOLDEN_EXTRA_LINES[1]!,
          /** MODIFIED: materials done → carpentry READY/actionable. */
          completeThrough: 'MATERIAL_PREP',
        },
        {
          ...GOLDEN_EXTRA_LINES[2]!,
          /** CUSTOM: nothing done — do not inherit story CARPENTRY. */
          completeThrough: null,
        },
      ],
      notes:
        'SO-GOLDEN-001 — four manufacturing kinds on one sales order (done / locked / open sub-orders for My Tasks).',
    },
    {
      id: 'oasis-italian-velvet',
      dealer: 'oasis',
      sku: 'SOF-3S-STD',
      variantCode: 'XL',
      qty: 1,
      kind: 'at_risk_material',
      projectName: 'Oasis Italian velvet sofa',
      fabric: 'Italian velvet',
      wood: 'Beech',
      orderDay: windowDay(50),
      deliveryLeadDays: 30,
      extraLines: [{ sku: 'ARM-01', variantCode: 'STD', qty: 1, fabric: 'Italian velvet' }],
      notes: 'Waiting inbound Italian velvet PO (SUP-FABRIC).',
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
      id: 'oasis-ottoman-return',
      dealer: 'oasis',
      sku: 'ARM-01',
      qty: 2,
      kind: 'delivered',
      payment: 'paid',
      returnInfo: { reason: ReturnReason.DELIVERY_DAMAGE, qty: 1, approval: 'APPROVED' },
      projectName: 'Oasis armchair scuff',
      fabric: 'Velvet Sand',
      orderDay: windowDay(12),
      deliveryLeadDays: 21,
    },
    {
      id: 'nile-partial-invoice',
      dealer: 'nile',
      sku: 'ARM-01',
      qty: 2,
      kind: 'delivered',
      payment: 'partial',
      projectName: 'Nile partial payment set',
      fabric: 'Velvet Sand',
      wood: 'Beech',
      orderDay: windowDay(8),
      deliveryLeadDays: 16,
      notes: 'Delivered with partial payment — finance partial path.',
    },
    {
      id: 'oasis-overdue-invoice',
      dealer: 'oasis',
      sku: 'BED-Q',
      qty: 1,
      kind: 'delivered',
      payment: 'outstanding',
      projectName: 'Oasis overdue bed',
      fabric: 'Linen Natural',
      wood: 'Pine',
      orderDay: windowDay(6),
      deliveryLeadDays: 14,
      notes: 'Delivered unpaid / overdue — finance outstanding path.',
    },
    ...monthStories(),
  ];
}

/** One of every remaining kind, then a spread of named Amman work across 30 days. */
function monthStories(): DemoStory[] {
  const kinds: DemoStory[] = [
    {
      id: 'balqis-packaging-banquet',
      dealer: 'balqis',
      sku: 'SOF-LOVE',
      qty: 4,
      kind: 'packaging',
      projectName: 'Rainbow banquet loveseats',
      fabric: 'Velvet Sand',
      wood: 'Beech',
      orderDay: 18,
      deliveryLeadDays: 16,
    },
    {
      id: 'nile-qc-dining',
      dealer: 'nile',
      sku: 'CHR-DIN',
      qty: 6,
      kind: 'qc',
      projectName: 'Abdoun dining chairs inspection',
      fabric: 'Linen Natural',
      wood: 'Oak',
      orderDay: 16,
      deliveryLeadDays: 18,
    },
    {
      id: 'oasis-ready-coffee',
      dealer: 'oasis',
      sku: 'TBL-COF',
      qty: 2,
      kind: 'ready_delivery',
      projectName: 'Sweifieh coffee tables packed',
      wood: 'Oak',
      orderDay: 14,
      deliveryLeadDays: 20,
    },
    {
      id: 'balqis-not-started-sectional',
      dealer: 'balqis',
      sku: 'SOF-SEC',
      variantCode: 'CORNER',
      qty: 1,
      kind: 'not_started',
      projectName: 'Jabal Amman sectional hold',
      fabric: 'Boucle Cream',
      wood: 'Beech',
      orderDay: 26,
      deliveryLeadDays: 21,
    },
    {
      id: 'nile-waiting-oak',
      dealer: 'nile',
      sku: 'TBL-DIN',
      qty: 1,
      kind: 'waiting_materials',
      projectName: 'Dabouq dining table timber',
      wood: 'Oak',
      orderDay: 22,
      deliveryLeadDays: 24,
    },
    {
      id: 'oasis-proposed-ottoman',
      dealer: 'oasis',
      sku: 'OTM-01',
      qty: 2,
      kind: 'proposed',
      projectName: 'Sweifieh olive ottomans proposal',
      fabric: 'Velvet Olive',
      orderDay: 27,
      deliveryLeadDays: 20,
    },
    {
      id: 'balqis-draft-loveseat',
      dealer: 'balqis',
      sku: 'SOF-LOVE',
      qty: 1,
      kind: 'draft',
      projectName: 'Balqis unconfirmed loveseat',
      fabric: 'Velvet Sand',
      orderDay: 28,
      deliveryLeadDays: 21,
    },
    {
      id: 'oasis-wip-risk-chair',
      dealer: 'oasis',
      sku: 'ARM-01',
      qty: 2,
      kind: 'at_risk_wip',
      completeThrough: 'CARPENTRY',
      projectName: 'Mecca Street armchair frames',
      fabric: 'Velvet Sand',
      wood: 'Beech',
      orderDay: 12,
      deliveryLeadDays: 28,
    },
    {
      id: 'balqis-committed-late',
      dealer: 'balqis',
      sku: 'SOF-3S-STD',
      qty: 1,
      kind: 'at_risk_committed',
      projectName: 'Rainbow Street committed late',
      fabric: 'Velvet Sand',
      wood: 'Beech',
      orderDay: 3,
      deliveryLeadDays: 6,
      notes: 'Intentional late promise — scheduling shows the miss.',
    },
    {
      id: 'nile-rework-historical-bed',
      dealer: 'nile',
      sku: 'BED-Q',
      qty: 1,
      kind: 'rework_historical',
      payment: 'paid',
      projectName: 'Khalda bed after rework',
      fabric: 'Linen Natural',
      wood: 'Pine',
      orderDay: 4,
      deliveryLeadDays: 14,
    },
  ];

  const fill: Array<Pick<DemoStory, 'id' | 'dealer' | 'sku' | 'qty' | 'kind' | 'projectName' | 'orderDay' | 'deliveryLeadDays'> & Partial<DemoStory>> = [
    { id: 'nile-abdoun-love-paid', dealer: 'nile', sku: 'SOF-LOVE', qty: 1, kind: 'delivered', payment: 'paid', projectName: 'Abdoun study loveseat', fabric: 'Velvet Sand', orderDay: 1, deliveryLeadDays: 12 },
    { id: 'oasis-sweifieh-table', dealer: 'oasis', sku: 'TBL-DIN', variantCode: 'WHITE', qty: 1, kind: 'delivered', payment: 'partial', projectName: 'Sweifieh white dining table', wood: 'Oak', orderDay: 5, deliveryLeadDays: 14 },
    { id: 'balqis-jabal-chairs', dealer: 'balqis', sku: 'CHR-DIN', qty: 8, kind: 'in_production', completeThrough: 'CARPENTRY', projectName: 'Jabal Amman dining set', fabric: 'Linen Natural', wood: 'Oak', orderDay: 20, deliveryLeadDays: 18 },
    { id: 'nile-khalda-ottoman', dealer: 'nile', sku: 'OTM-01', qty: 2, kind: 'in_production', completeThrough: 'FOAM', projectName: 'Khalda olive ottomans', fabric: 'Velvet Olive', orderDay: 19, deliveryLeadDays: 16 },
    { id: 'oasis-dabouq-sectional', dealer: 'oasis', sku: 'SOF-SEC', qty: 1, kind: 'fresh_production', projectName: 'Dabouq fresh sectional', fabric: 'Boucle Cream', orderDay: 24, deliveryLeadDays: 24 },
    { id: 'balqis-lobby-sofa', dealer: 'balqis', sku: 'SOF-3S-STD', variantCode: 'KARINA', qty: 2, kind: 'in_production', completeThrough: 'UPHOLSTERY', projectName: 'Balqis lobby Karina pair', fabric: 'Velvet Navy', orderDay: 15, deliveryLeadDays: 20 },
    { id: 'nile-um-uthaina-bed', dealer: 'nile', sku: 'BED-Q', qty: 1, kind: 'packaging', projectName: 'Um Uthaina queen bed', fabric: 'Linen Natural', wood: 'Pine', orderDay: 17, deliveryLeadDays: 18 },
    { id: 'oasis-webdeh-luna', dealer: 'oasis', sku: 'SOF-LUNA', qty: 1, kind: 'qc', projectName: 'Webdeh Luna inspection', fabric: 'Boucle Cream', orderDay: 13, deliveryLeadDays: 22 },
    { id: 'balqis-shmeisani-coffee', dealer: 'balqis', sku: 'TBL-COF', qty: 4, kind: 'ready_delivery', projectName: 'Shmeisani lobby tables', wood: 'Oak', orderDay: 11, deliveryLeadDays: 22 },
    { id: 'nile-sport-city-chair', dealer: 'nile', sku: 'ARM-01', qty: 3, kind: 'not_started', projectName: 'Sports City armchair batch', fabric: 'Velvet Sand', orderDay: 25, deliveryLeadDays: 21 },
    { id: 'oasis-tabarbour-love', dealer: 'oasis', sku: 'SOF-LOVE', qty: 2, kind: 'waiting_materials', projectName: 'Tabarbour velvet loveseats', fabric: 'Velvet Sand', orderDay: 21, deliveryLeadDays: 20 },
    { id: 'balqis-marj-bed', dealer: 'balqis', sku: 'BED-Q', qty: 2, kind: 'delivered', payment: 'outstanding', projectName: 'Marj Al Hamam guest beds', fabric: 'Linen Natural', wood: 'Pine', orderDay: 6, deliveryLeadDays: 12 },
    { id: 'nile-rabieh-sectional', dealer: 'nile', sku: 'SOF-SEC', variantCode: 'CORNER', qty: 1, kind: 'in_production', completeThrough: 'MATERIAL_PREP', projectName: 'Rabieh corner sectional', fabric: 'Boucle Cream', orderDay: 18, deliveryLeadDays: 24 },
    { id: 'oasis-bayader-table', dealer: 'oasis', sku: 'TBL-DIN', qty: 1, kind: 'proposed', projectName: 'Bayader dining table quote floor', wood: 'Oak', orderDay: 27, deliveryLeadDays: 18 },
    { id: 'balqis-fifth-circle', dealer: 'balqis', sku: 'SOF-LUNA', variantCode: 'CORNER', qty: 1, kind: 'delivered', payment: 'paid', projectName: 'Fifth Circle Luna corner', fabric: 'Boucle Cream', orderDay: 2, deliveryLeadDays: 16, extraLines: [{ sku: 'OTM-01', qty: 2, fabric: 'Velvet Olive' }] },
    { id: 'nile-deir-ghbar-chairs', dealer: 'nile', sku: 'CHR-DIN', qty: 4, kind: 'in_production', completeThrough: 'UPHOLSTERY', projectName: 'Deir Ghbar dining chairs', fabric: 'Linen Natural', wood: 'Oak', orderDay: 14, deliveryLeadDays: 20 },
    { id: 'oasis-naour-bed', dealer: 'oasis', sku: 'BED-Q', qty: 1, kind: 'rework_current', projectName: 'Naour bed stitch check', fabric: 'Linen Natural', wood: 'Pine', orderDay: 10, deliveryLeadDays: 24 },
    { id: 'balqis-airport-ottoman', dealer: 'balqis', sku: 'OTM-01', qty: 6, kind: 'in_production', completeThrough: 'MATERIAL_PREP', projectName: 'Airport road ottoman run', fabric: 'Velvet Olive', orderDay: 23, deliveryLeadDays: 16 },
  ];

  return [...kinds, ...fill];
}
