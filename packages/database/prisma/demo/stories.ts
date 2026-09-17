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

/** Compress older story day indices into the 21-day window. */
function windowDay(old: number): number {
  return Math.min(20, Math.max(0, Math.round((old * 20) / 62)));
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
  ];
}
