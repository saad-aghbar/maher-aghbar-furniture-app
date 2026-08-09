import type { SalesOrderListItem } from './api';

type Spec = {
  status: string;
  priority: string;
  progress: number;
  /** Days from a fixed “today” (2026-08-06) for delivery. */
  deliveryOffsetDays: number;
  title: string;
  dealer: { id: string; name: string };
};

const DEALERS = [
  { id: 'c1', name: 'Nile Interiors' },
  { id: 'c2', name: 'Oasis Living' },
  { id: 'c3', name: 'Balqis Hospitality' },
  { id: 'c4', name: 'Jerash Furnishings' },
  { id: 'c5', name: 'Aqaba Coastal Suites' },
  { id: 'c6', name: 'Zarqa Trade House' },
  { id: 'c7', name: 'Irbid Design Studio' },
  { id: 'c8', name: 'Madaba Home Gallery' },
  { id: 'c9', name: 'Salt Heritage Living' },
  { id: 'c10', name: 'Karak Project Supply' },
  { id: 'c11', name: 'Mafraq Contract Furnishings' },
  { id: 'c12', name: 'Ajloun Timber & Soft' },
  { id: 'c13', name: 'Wadi Rum Retreats' },
  { id: 'c14', name: 'Dead Sea Spa Residences' },
] as const;

const TITLES = [
  'Lobby Sofa',
  'Dining Set',
  'Executive Desk',
  'Hotel Headboard',
  'Cafe Chairs × 8',
  'Lounge Chair',
  'L-Shape Sofa',
  'Queen Bed',
  'Armchair pair',
  'Coffee Table',
  'Reception bench',
  'Bar stools × 6',
];

const SPECS: Spec[] = [
  { status: 'DRAFT', priority: 'NORMAL', progress: 0, deliveryOffsetDays: 28, title: TITLES[0]!, dealer: DEALERS[0] },
  { status: 'DRAFT', priority: 'HIGH', progress: 0, deliveryOffsetDays: 21, title: TITLES[1]!, dealer: DEALERS[1] },
  { status: 'CONFIRMED', priority: 'NORMAL', progress: 5, deliveryOffsetDays: 0, title: TITLES[2]!, dealer: DEALERS[2] },
  { status: 'CONFIRMED', priority: 'HIGH', progress: 5, deliveryOffsetDays: 1, title: TITLES[3]!, dealer: DEALERS[3] },
  { status: 'CONFIRMED', priority: 'URGENT', progress: 5, deliveryOffsetDays: 3, title: TITLES[4]!, dealer: DEALERS[0] },
  { status: 'CONFIRMED', priority: 'NORMAL', progress: 5, deliveryOffsetDays: 7, title: TITLES[5]!, dealer: DEALERS[1] },
  { status: 'READY_FOR_PRODUCTION', priority: 'NORMAL', progress: 8, deliveryOffsetDays: 2, title: TITLES[6]!, dealer: DEALERS[2] },
  { status: 'READY_FOR_PRODUCTION', priority: 'HIGH', progress: 10, deliveryOffsetDays: 5, title: TITLES[7]!, dealer: DEALERS[3] },
  { status: 'WAITING_FOR_PAYMENT', priority: 'NORMAL', progress: 0, deliveryOffsetDays: 10, title: TITLES[8]!, dealer: DEALERS[0] },
  { status: 'WAITING_FOR_MATERIALS', priority: 'URGENT', progress: 8, deliveryOffsetDays: 6, title: TITLES[9]!, dealer: DEALERS[1] },
  { status: 'ON_HOLD', priority: 'NORMAL', progress: 12, deliveryOffsetDays: 18, title: TITLES[10]!, dealer: DEALERS[2] },
  { status: 'IN_PRODUCTION', priority: 'NORMAL', progress: 22, deliveryOffsetDays: 3, title: TITLES[11]!, dealer: DEALERS[3] },
  { status: 'IN_PRODUCTION', priority: 'HIGH', progress: 38, deliveryOffsetDays: 7, title: TITLES[0]!, dealer: DEALERS[0] },
  { status: 'IN_PRODUCTION', priority: 'NORMAL', progress: 51, deliveryOffsetDays: 10, title: TITLES[1]!, dealer: DEALERS[1] },
  { status: 'IN_PRODUCTION', priority: 'URGENT', progress: 67, deliveryOffsetDays: 4, title: TITLES[2]!, dealer: DEALERS[2] },
  { status: 'IN_PRODUCTION', priority: 'NORMAL', progress: 78, deliveryOffsetDays: 12, title: TITLES[3]!, dealer: DEALERS[3] },
  { status: 'READY_FOR_DELIVERY', priority: 'HIGH', progress: 94, deliveryOffsetDays: 0, title: TITLES[4]!, dealer: DEALERS[0] },
  { status: 'READY_FOR_DELIVERY', priority: 'NORMAL', progress: 100, deliveryOffsetDays: 1, title: TITLES[5]!, dealer: DEALERS[1] },
  { status: 'IN_PRODUCTION', priority: 'URGENT', progress: 41, deliveryOffsetDays: -3, title: TITLES[6]!, dealer: DEALERS[2] },
  { status: 'IN_PRODUCTION', priority: 'HIGH', progress: 58, deliveryOffsetDays: -8, title: TITLES[7]!, dealer: DEALERS[3] },
  { status: 'DELIVERED', priority: 'NORMAL', progress: 100, deliveryOffsetDays: -20, title: TITLES[8]!, dealer: DEALERS[0] },
  { status: 'COMPLETED', priority: 'LOW', progress: 100, deliveryOffsetDays: -40, title: TITLES[9]!, dealer: DEALERS[1] },
];

const DAY_MS = 86_400_000;

/** Relative to real “now” so Today / Past sections stay correct on any calendar day. */
function daysFromNowIso(offsetDays: number, now = Date.now()): string {
  return new Date(now + offsetDays * DAY_MS).toISOString();
}

function buildAdminFixture(rounds = 6): SalesOrderListItem[] {
  const out: SalesOrderListItem[] = [];
  let n = 2000;
  const now = Date.now();
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < SPECS.length; i++) {
      const spec = SPECS[i]!;
      n += 1;
      const seller = 2000 + ((i * 137 + r * 50) % 14000);
      const mfg = Math.round(seller * 0.55);
      // ~1/3 arrived today; the rest arrived on earlier days.
      const arrivedOffset = (i + r) % 3 === 0 ? 0 : -(1 + ((i * 3 + r) % 25));
      out.push({
        id: `so-vol-${n}`,
        number: `SO-VOL-${String(n).padStart(4, '0')}`,
        status: spec.status,
        priority: spec.priority,
        title: `${spec.title} · R${r + 1}`,
        imageUrl: null,
        progressPercent: spec.progress,
        requiredDeliveryDate: daysFromNowIso(
          spec.deliveryOffsetDays + (r % 3) - 1,
          now,
        ),
        createdAt: daysFromNowIso(arrivedOffset, now),
        externalOrderNumber: `PO-${spec.dealer.id.toUpperCase()}-${String(n).padStart(3, '0')}`,
        projectName: `${spec.dealer.name} project`,
        sellerPrice: seller,
        manufacturingCost: mfg,
        profit: seller - mfg,
        customer: {
          id: spec.dealer.id,
          name: spec.dealer.name,
          nameEn: spec.dealer.name,
        },
        productionOrders: [
          {
            id: `po-vol-${n}`,
            number: `FO-${String(n).padStart(4, '0')}`,
            status: spec.status,
            progressPercent: spec.progress,
          },
        ],
        currentStage:
          spec.progress > 0 && spec.status === 'IN_PRODUCTION'
            ? {
                code: 'CARPENTRY',
                nameEn: 'Carpentry',
                nameAr: 'نجارة',
                nameHe: 'נגרות',
              }
            : spec.progress >= 60
              ? {
                  code: 'UPHOLSTERY',
                  nameEn: 'Upholstery',
                  nameAr: 'تنجيد',
                  nameHe: 'ריפוד',
                }
              : null,
      });
    }
  }
  return out;
}

/** ~100 varied admin orders for offline / gallery / composition QA. */
export const adminOrdersFixture: SalesOrderListItem[] = buildAdminFixture(6);

/** Dealer hub subset — same variety, cost fields omitted by mapper. */
export const dealerOrdersFixture: SalesOrderListItem[] = adminOrdersFixture
  .filter((_, i) => i % 3 === 0)
  .slice(0, 40)
  .map((o) => ({
    ...o,
    manufacturingCost: undefined,
    profit: undefined,
    currentStage: undefined,
    progressLabel:
      o.progressPercent == null
        ? 'Queued'
        : o.progressPercent >= 100
          ? 'Completed'
          : o.progressPercent >= 90
            ? 'Ready'
            : o.progressPercent > 0
              ? 'In progress'
              : 'Queued',
  }));
