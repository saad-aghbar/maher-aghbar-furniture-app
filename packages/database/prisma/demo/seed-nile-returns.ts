/**
 * Nile dealer returns desk fixtures (RT-NILE-HUB-01…05).
 * Idempotent — safe to re-run against a live demo DB without a full reset.
 */
import {
  PrismaClient,
  ReturnLifecycleState,
  ReturnPieceState,
  ReturnReason,
  SalesOrderStatus,
} from '@prisma/client';
import { lineTotals, money } from '../seed/util';
import { variantLineFields } from './variant-attach';

const PREFIX = 'RT-NILE-HUB-';
const SO_PREFIX = 'SO-NILE-RET-';

type HubReturnSpec = {
  letter: string;
  reason: ReturnReason;
  productDesc: string;
  description: string;
  approvalStatus: string;
  physicalStatus: string;
  lifecycleState: ReturnLifecycleState;
  needInfoNote?: string;
  daysAgo: number;
  withPiece?: boolean;
};

const SPECS: HubReturnSpec[] = [
  {
    letter: '01',
    reason: ReturnReason.MANUFACTURING_DEFECT,
    productDesc: 'Linen sofa — left arm seam',
    description: 'Nile showroom: seam pull on the left arm after delivery.',
    approvalStatus: 'PENDING',
    physicalStatus: 'NONE',
    lifecycleState: ReturnLifecycleState.REQUESTED,
    daysAgo: 2,
  },
  {
    letter: '02',
    reason: ReturnReason.DELIVERY_DAMAGE,
    productDesc: 'Oak credenza — corner scuff',
    description: 'Corner scuff on the credenza. Waiting on closer photos.',
    approvalStatus: 'NEED_INFO',
    physicalStatus: 'NONE',
    lifecycleState: ReturnLifecycleState.NEED_INFO,
    needInfoNote: 'Please add a close-up of the damaged corner and the delivery note.',
    daysAgo: 8,
  },
  {
    letter: '03',
    reason: ReturnReason.INCORRECT_COLOR,
    productDesc: 'Dining table — oak vs walnut',
    description: 'Finish is walnut; Nile ordered oak stain.',
    approvalStatus: 'APPROVED',
    physicalStatus: 'WAITING_RETURN',
    lifecycleState: ReturnLifecycleState.IN_TRANSIT,
    daysAgo: 5,
  },
  {
    letter: '04',
    reason: ReturnReason.MANUFACTURING_DEFECT,
    productDesc: 'Lounge chair — wobbly front leg',
    description: 'Wobbly front leg. Piece received at factory for repair.',
    approvalStatus: 'APPROVED',
    physicalStatus: 'RETURNED',
    lifecycleState: ReturnLifecycleState.RECEIVED,
    daysAgo: 12,
    withPiece: true,
  },
  {
    letter: '05',
    reason: ReturnReason.CUSTOMER_REQUEST,
    productDesc: 'Media unit — layout change',
    description: 'End customer changed the layout — Nile withdrew the return.',
    approvalStatus: 'REJECTED',
    physicalStatus: 'RESOLVED',
    lifecycleState: ReturnLifecycleState.REJECTED,
    daysAgo: 18,
  },
];

function filedAt(days: number): Date {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export async function seedNileDealerReturns(prisma: PrismaClient): Promise<void> {
  const nileUser = await prisma.user.findFirst({
    where: { username: { equals: 'nile', mode: 'insensitive' } },
    select: { customerId: true },
  });
  const nile =
    (nileUser?.customerId
      ? await prisma.customer.findFirst({ where: { id: nileUser.customerId } })
      : null) ??
    (await prisma.customer.findFirst({
      where: {
        archivedAt: null,
        OR: [
          { code: 'CUS-0101' },
          { nameEn: { contains: 'Nile', mode: 'insensitive' } },
          { name: { contains: 'Nile', mode: 'insensitive' } },
        ],
      },
    }));
  if (!nile) {
    console.log('  nile-returns: skipped — Nile dealer not found');
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { username: 'admin' },
    select: { id: true },
  });
  const products = await prisma.product.findMany({
    where: { archivedAt: null, isActive: true },
    orderBy: [{ imageUrl: 'desc' }, { sku: 'asc' }],
    take: 8,
    select: {
      id: true,
      nameEn: true,
      basePrice: true,
      variants: {
        where: { isDefault: true, archivedAt: null },
        take: 1,
        select: { id: true, sku: true, nameAr: true, nameEn: true },
      },
    },
  });
  const fallbackProduct = products[0];
  if (!fallbackProduct) {
    console.log('  nile-returns: skipped — no catalog product');
    return;
  }

  await prisma.returnRequest.deleteMany({ where: { number: { startsWith: PREFIX } } });

  for (let i = 0; i < SPECS.length; i += 1) {
    const spec = SPECS[i]!;
    const product = products[i % products.length] ?? fallbackProduct;
    const attach = {
      defaultVariantId: product.variants[0]?.id,
      defaultVariantSku: product.variants[0]?.sku,
      defaultVariantLabel: product.variants[0]?.nameAr || product.variants[0]?.nameEn,
    };
    const unit = Number(product.basePrice ?? 1800);
    const totals = lineTotals(1, Number.isFinite(unit) && unit > 0 ? unit : 1800);
    const soNumber = `${SO_PREFIX}${spec.letter}`;

    let so = await prisma.salesOrder.findUnique({
      where: { number: soNumber },
      include: { lines: { take: 1, orderBy: { sortOrder: 'asc' } } },
    });
    if (!so) {
      so = await prisma.salesOrder.create({
        data: {
          number: soNumber,
          customerId: nile.id,
          status: SalesOrderStatus.DELIVERED,
          projectName: spec.productDesc,
          externalOrderNumber: `NIL-RET-${spec.letter}`,
          orderDate: filedAt(30 + i),
          createdById: admin?.id,
          subtotal: totals.subtotalM,
          taxTotal: totals.taxAmountM,
          total: totals.lineTotalM,
          lines: {
            create: {
              description: spec.productDesc,
              productId: product.id,
              ...variantLineFields(attach),
              quantity: money(1),
              unitPrice: totals.subtotalM,
              taxRate: totals.taxRate,
              lineTotal: totals.lineTotalM,
              sortOrder: 0,
            },
          },
        },
        include: { lines: true },
      });
    } else if (!so.lines[0]) {
      await prisma.salesOrderLine.create({
        data: {
          salesOrderId: so.id,
          description: spec.productDesc,
          productId: product.id,
          ...variantLineFields(attach),
          quantity: money(1),
          unitPrice: totals.subtotalM,
          taxRate: totals.taxRate,
          lineTotal: totals.lineTotalM,
          sortOrder: 0,
        },
      });
      so = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: so.id },
        include: { lines: { take: 1, orderBy: { sortOrder: 'asc' } } },
      });
    }

    const lineId = so.lines[0]?.id;
    const created = await prisma.returnRequest.create({
      data: {
        number: `${PREFIX}${spec.letter}`,
        customerId: nile.id,
        salesOrderId: so.id,
        salesOrderLineId: lineId,
        productId: product.id,
        variantId: attach.defaultVariantId,
        productDesc: spec.productDesc,
        quantity: money(1),
        reason: spec.reason,
        description: spec.description,
        approvalStatus: spec.approvalStatus,
        physicalStatus: spec.physicalStatus,
        lifecycleState: spec.lifecycleState,
        needInfoNote: spec.needInfoNote,
        createdAt: filedAt(spec.daysAgo),
      },
    });
    if (spec.withPiece) {
      await prisma.returnPiece.create({
        data: {
          returnRequestId: created.id,
          pieceNo: 1,
          code: `${PREFIX}${spec.letter}-P1`,
          salesOrderId: so.id,
          salesOrderLineId: lineId,
          productId: product.id,
          variantId: attach.defaultVariantId,
          productDesc: spec.productDesc,
          state: ReturnPieceState.RECEIVED,
          receivedAt: filedAt(1),
        },
      });
    }
  }

  console.log(
    `  nile-returns: ${SPECS.map((s) => `${PREFIX}${s.letter}`).join(', ')} for ${nile.nameEn ?? nile.name}`,
  );
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedNileDealerReturns(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const invoked = process.argv[1]?.includes('seed-nile-returns');
if (invoked) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
