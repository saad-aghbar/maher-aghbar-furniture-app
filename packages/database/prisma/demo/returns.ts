/**
 * Always-on demo return case: RT-DEMO-001 with REPAIR / REPLACEMENT / SCRAP_RECOVERY pieces.
 * Seeded on every demo reset (not gated by DEMO_PIECES).
 */
import {
  DeliveryPurpose,
  DeliveryStatus,
  PrismaClient,
  ReturnInventoryFate,
  ReturnPieceDecision,
  ReturnPieceState,
  ReturnReason,
  SalesOrderStatus,
} from '@prisma/client';
import { money } from '../seed/util';
import { daysAgo, demoAsOf } from './clock';
import { variantIdFields } from './variant-attach';

export const DEMO_RETURN_NUMBER = 'RT-DEMO-001';

type DealerRef = {
  id: string;
  username: string;
  street?: string;
  area?: string;
  city?: string;
  nameEn?: string;
};

type ProductRef = {
  id: string;
  sku: string;
  nameEn: string;
  defaultVariantId?: string;
  defaultVariantSku?: string;
  defaultVariantLabel?: string;
};

function dealerAddress(d: DealerRef) {
  return [d.street, d.area, d.city].filter(Boolean).join(', ') || 'Amman, Jordan';
}

async function ensureDeliveredNileOrder(
  prisma: PrismaClient,
  opts: {
    nile: DealerRef;
    product: ProductRef;
    adminId: string;
    driverId?: string;
  },
) {
  const preferred = await prisma.salesOrder.findFirst({
    where: {
      customerId: opts.nile.id,
      status: { in: [SalesOrderStatus.DELIVERED, SalesOrderStatus.COMPLETED] },
      archivedAt: null,
      deliveries: { some: { status: DeliveryStatus.DELIVERED } },
      lines: { some: {} },
    },
    include: {
      lines: { take: 1, orderBy: { sortOrder: 'asc' } },
      deliveries: {
        where: { status: DeliveryStatus.DELIVERED },
        take: 1,
        orderBy: { actualDeliveredAt: 'desc' },
      },
    },
    orderBy: [{ number: 'asc' }],
  });
  if (preferred?.lines[0] && preferred.deliveries[0]) {
    return {
      soId: preferred.id,
      lineId: preferred.lines[0].id,
      productId: preferred.lines[0].productId ?? opts.product.id,
      deliveryId: preferred.deliveries[0].id,
    };
  }

  const at = daysAgo(14);
  const soNumber = 'SO-RT-DEMO-001';
  const existing = await prisma.salesOrder.findUnique({
    where: { number: soNumber },
    include: {
      lines: { take: 1, orderBy: { sortOrder: 'asc' } },
      deliveries: { take: 1 },
    },
  });
  if (existing?.lines[0] && existing.deliveries[0]) {
    return {
      soId: existing.id,
      lineId: existing.lines[0].id,
      productId: existing.lines[0].productId ?? opts.product.id,
      deliveryId: existing.deliveries[0].id,
    };
  }

  const subtotal = 1800;
  const so = await prisma.salesOrder.create({
    data: {
      number: soNumber,
      customerId: opts.nile.id,
      status: SalesOrderStatus.DELIVERED,
      orderDate: at,
      projectName: 'RT-DEMO-001 carrier order',
      externalOrderNumber: 'RT-DEMO-CARRIER',
      subtotal: money(subtotal),
      taxTotal: money(0),
      total: money(subtotal),
      createdById: opts.adminId,
      createdAt: at,
      notes: 'Minimal delivered Nile SO for RT-DEMO-001 when no other delivered order exists.',
      lines: {
        create: [
          {
            productId: opts.product.id,
            variantId: opts.product.defaultVariantId ?? null,
            variantSku: opts.product.defaultVariantSku ?? null,
            variantLabel: opts.product.defaultVariantLabel ?? null,
            description: opts.product.nameEn,
            quantity: money(3),
            unitPrice: money(600),
            taxRate: money(0),
            lineTotal: money(subtotal),
            productionRequired: false,
            sortOrder: 0,
          },
        ],
      },
    },
    include: { lines: true },
  });
  const line = so.lines[0]!;
  const delivery = await prisma.delivery.create({
    data: {
      number: 'DLV-RT-DEMO-001',
      salesOrderId: so.id,
      customerId: opts.nile.id,
      deliveryAddress: dealerAddress(opts.nile),
      deliveryDate: at,
      driverId: opts.driverId,
      status: DeliveryStatus.DELIVERED,
      purpose: DeliveryPurpose.OUTBOUND_ORDER,
      actualDeliveredAt: at,
      customerConfirmedAt: at,
      notes: 'RT-DEMO-001 carrier delivery',
      items: { create: [{ description: opts.product.nameEn, quantity: money(3) }] },
    },
  });
  return {
    soId: so.id,
    lineId: line.id,
    productId: line.productId ?? opts.product.id,
    deliveryId: delivery.id,
  };
}

export async function seedDemoReturns(
  prisma: PrismaClient,
  opts: {
    adminId: string;
    driverId?: string;
    dealers: DealerRef[];
    products: ProductRef[];
  },
) {
  const asOf = demoAsOf();
  const nile = opts.dealers.find((d) => d.username === 'nile') ?? opts.dealers[0];
  if (!nile) {
    console.log('  returns: skipped — no dealer');
    return;
  }
  const product =
    opts.products.find((p) => p.sku === 'SOF-3S-STD') ?? opts.products[0];
  if (!product) {
    console.log('  returns: skipped — no catalog product');
    return;
  }

  const base = await ensureDeliveredNileOrder(prisma, {
    nile,
    product,
    adminId: opts.adminId,
    driverId: opts.driverId,
  });

  await prisma.returnRequest.deleteMany({ where: { number: DEMO_RETURN_NUMBER } });

  const variant = variantIdFields(product);
  const demoCase = await prisma.returnRequest.create({
    data: {
      number: DEMO_RETURN_NUMBER,
      customerId: nile.id,
      salesOrderId: base.soId,
      deliveryId: base.deliveryId,
      productDesc: 'Sofa + two chairs',
      quantity: money(3),
      reason: ReturnReason.MANUFACTURING_DEFECT,
      description: 'RT-DEMO-001: one repair, one replacement, one scrap & recover.',
      approvalStatus: 'APPROVED',
      physicalStatus: 'RETURNED',
      lifecycleState: 'REWORKING',
      inventoryFate: ReturnInventoryFate.REWORK,
      receivedAt: asOf,
      receivedById: opts.adminId,
      createdAt: daysAgo(1),
    },
  });

  await prisma.returnPiece.createMany({
    data: [
      {
        returnRequestId: demoCase.id,
        pieceNo: 1,
        code: `${DEMO_RETURN_NUMBER}-P1`,
        salesOrderId: base.soId,
        salesOrderLineId: base.lineId,
        productId: base.productId,
        ...variant,
        productDesc: 'Sofa',
        state: ReturnPieceState.IN_PROGRESS,
        decision: ReturnPieceDecision.REPAIR,
        outboundEligible: true,
        receivedAt: asOf,
      },
      {
        returnRequestId: demoCase.id,
        pieceNo: 2,
        code: `${DEMO_RETURN_NUMBER}-P2`,
        salesOrderId: base.soId,
        salesOrderLineId: base.lineId,
        productId: base.productId,
        ...variant,
        productDesc: 'Chair',
        state: ReturnPieceState.IN_PROGRESS,
        decision: ReturnPieceDecision.REPLACEMENT,
        outboundEligible: true,
        receivedAt: asOf,
      },
      {
        returnRequestId: demoCase.id,
        pieceNo: 3,
        code: `${DEMO_RETURN_NUMBER}-P3`,
        salesOrderId: base.soId,
        salesOrderLineId: base.lineId,
        productId: base.productId,
        ...variant,
        productDesc: 'Chair',
        state: ReturnPieceState.IN_PROGRESS,
        decision: ReturnPieceDecision.SCRAP_RECOVERY,
        outboundEligible: false,
        receivedAt: asOf,
      },
    ],
  });

  console.log(
    `  returns: ${DEMO_RETURN_NUMBER} (REPAIR / REPLACEMENT / SCRAP_RECOVERY) on Nile SO`,
  );
}
