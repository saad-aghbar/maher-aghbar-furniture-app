/**
 * Piece 1 deterministic dealer order lifecycle examples (A–E).
 * Does not disturb existing in-production / shipped demo stories (F–G).
 */
import {
  ManufacturingComplexity,
  PrismaClient,
  QuotationStatus,
  RequestSource,
  RequestStatus,
  SalesOrderStatus,
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';

type DealerRef = { id: string; code: string; name?: string; nameEn?: string; username?: string };
type ProductRef = {
  id: string;
  sku: string;
  nameEn: string;
  basePrice: unknown;
  width?: unknown;
  height?: unknown;
  depth?: unknown;
};

export async function seedPiece1LifecycleExamples(
  prisma: PrismaClient,
  opts: {
    dealers: DealerRef[];
    products: ProductRef[];
    adminUserId: string;
  },
) {
  const oasis =
    opts.dealers.find((d) => d.username === 'oasis' || /oasis/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[1] ??
    opts.dealers[0];
  const nile =
    opts.dealers.find((d) => d.username === 'nile' || /nile/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[0];
  const product = opts.products[0];
  if (!oasis || !nile || !product) return;

  const catalogW = product.width != null ? Number(product.width) : 180;
  const catalogH = product.height != null ? Number(product.height) : 90;
  const catalogD = product.depth != null ? Number(product.depth) : 85;

  // A — Dealer Draft
  await prisma.requestForQuotation.upsert({
    where: { number: 'RFQ-P1-DRAFT' },
    update: { status: RequestStatus.DRAFT, archivedAt: null },
    create: {
      number: 'RFQ-P1-DRAFT',
      customerId: oasis.id,
      source: RequestSource.PORTAL,
      status: RequestStatus.DRAFT,
      projectName: 'Piece1 Draft Sofa',
      externalOrderNumber: 'P1-DRAFT',
      createdById: opts.adminUserId,
      items: {
        create: [
          {
            productId: product.id,
            productName: product.nameEn,
            quantity: 1,
            width: catalogW,
            height: catalogH,
            depth: catalogD,
            manufacturingComplexity: ManufacturingComplexity.STANDARD,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  // B — Waiting for review
  await prisma.requestForQuotation.upsert({
    where: { number: 'RFQ-P1-WAITING' },
    update: {
      status: RequestStatus.SUBMITTED,
      submittedAt: new Date(),
      archivedAt: null,
    },
    create: {
      number: 'RFQ-P1-WAITING',
      customerId: oasis.id,
      source: RequestSource.PORTAL,
      status: RequestStatus.SUBMITTED,
      submittedAt: new Date(),
      projectName: 'Piece1 Waiting Review',
      externalOrderNumber: 'P1-WAIT',
      createdById: opts.adminUserId,
      reviewHistory: [
        { at: new Date().toISOString(), by: oasis.id, action: 'SUBMITTED' },
      ],
      items: {
        create: [
          {
            productId: product.id,
            productName: product.nameEn,
            quantity: 2,
            fabricType: 'Velvet',
            fabricColor: 'Navy',
            manufacturingComplexity: ManufacturingComplexity.MODIFIED,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  // C — Needs information
  await prisma.requestForQuotation.upsert({
    where: { number: 'RFQ-P1-NEEDSINFO' },
    update: {
      status: RequestStatus.NEEDS_INFORMATION,
      informationRequestReason: 'Please clarify seat depth and fabric code.',
      archivedAt: null,
    },
    create: {
      number: 'RFQ-P1-NEEDSINFO',
      customerId: nile.id,
      source: RequestSource.PORTAL,
      status: RequestStatus.NEEDS_INFORMATION,
      submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      informationRequestReason: 'Please clarify seat depth and fabric code.',
      projectName: 'Piece1 Needs Info',
      externalOrderNumber: 'P1-INFO',
      createdById: opts.adminUserId,
      reviewHistory: [
        {
          at: new Date().toISOString(),
          by: opts.adminUserId,
          action: 'NEEDS_INFORMATION',
          message: 'Please clarify seat depth and fabric code.',
        },
      ],
      items: {
        create: [
          {
            productId: product.id,
            productName: product.nameEn,
            quantity: 1,
            width: catalogW + 20,
            manufacturingComplexity: ManufacturingComplexity.MODIFIED,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  // D — Standard accepted SO — Production setup required (no PO)
  const unitPriceNum = Number(product.basePrice) || 1000;
  const unitPrice = money(unitPriceNum);
  const qty = 1;
  const totals = lineTotals(qty, unitPriceNum, VAT);
  const acceptedAt = new Date();
  const sentAt = new Date(acceptedAt.getTime() - 60_000);
  const quoteD = await prisma.quotation.upsert({
    where: { number_version: { number: 'QT-P1-STD', version: 1 } },
    update: { status: QuotationStatus.ACCEPTED, sentAt, acceptedAt },
    create: {
      number: 'QT-P1-STD',
      version: 1,
      customerId: oasis.id,
      status: QuotationStatus.ACCEPTED,
      sentAt,
      acceptedAt,
      acceptedById: opts.adminUserId,
      subtotal: totals.subtotalM,
      taxTotal: totals.taxAmountM,
      total: totals.lineTotalM,
      lines: {
        create: [
          {
            productId: product.id,
            description: product.nameEn,
            quantity: qty,
            unitPrice,
            taxRate: VAT,
            subtotal: totals.subtotalM,
            taxAmount: totals.taxAmountM,
            lineTotal: totals.lineTotalM,
            manufacturingComplexity: ManufacturingComplexity.STANDARD,
            width: catalogW,
            height: catalogH,
            depth: catalogD,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  await prisma.salesOrder.upsert({
    where: { number: 'SO-P1-SETUP-STD' },
    update: { status: SalesOrderStatus.DRAFT, archivedAt: null },
    create: {
      number: 'SO-P1-SETUP-STD',
      customerId: oasis.id,
      quotationId: quoteD.id,
      status: SalesOrderStatus.DRAFT,
      externalOrderNumber: 'P1-SETUP-STD',
      projectName: 'Piece1 Standard Setup',
      subtotal: totals.subtotalM,
      taxTotal: totals.taxAmountM,
      total: totals.lineTotalM,
      createdById: opts.adminUserId,
      lines: {
        create: [
          {
            productId: product.id,
            description: product.nameEn,
            quantity: qty,
            unitPrice,
            taxRate: VAT,
            lineTotal: totals.lineTotalM,
            manufacturingComplexity: ManufacturingComplexity.STANDARD,
            orderSpec: {
              productId: product.id,
              productName: product.nameEn,
              quantity: qty,
              manufacturingComplexity: 'STANDARD',
              catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
              requestedDimensions: { width: catalogW, height: catalogH, depth: catalogD },
            },
            sortOrder: 0,
          },
        ],
      },
    },
  });

  // E — Customized accepted SO — Production setup required
  const customW = catalogW + 30;
  const totalsE = lineTotals(1, unitPriceNum, VAT);
  const quoteE = await prisma.quotation.upsert({
    where: { number_version: { number: 'QT-P1-MOD', version: 1 } },
    update: { status: QuotationStatus.ACCEPTED, sentAt, acceptedAt },
    create: {
      number: 'QT-P1-MOD',
      version: 1,
      customerId: nile.id,
      status: QuotationStatus.ACCEPTED,
      sentAt,
      acceptedAt,
      acceptedById: opts.adminUserId,
      subtotal: totalsE.subtotalM,
      taxTotal: totalsE.taxAmountM,
      total: totalsE.lineTotalM,
      lines: {
        create: [
          {
            productId: product.id,
            description: `${product.nameEn} (custom width)`,
            quantity: 1,
            unitPrice,
            taxRate: VAT,
            subtotal: totalsE.subtotalM,
            taxAmount: totalsE.taxAmountM,
            lineTotal: totalsE.lineTotalM,
            manufacturingComplexity: ManufacturingComplexity.MODIFIED,
            width: customW,
            height: catalogH,
            depth: catalogD,
            fabric: 'Linen Sand',
            sortOrder: 0,
          },
        ],
      },
    },
  });

  await prisma.salesOrder.upsert({
    where: { number: 'SO-P1-SETUP-MOD' },
    update: { status: SalesOrderStatus.DRAFT, archivedAt: null },
    create: {
      number: 'SO-P1-SETUP-MOD',
      customerId: nile.id,
      quotationId: quoteE.id,
      status: SalesOrderStatus.DRAFT,
      externalOrderNumber: 'P1-SETUP-MOD',
      projectName: 'Piece1 Customized Setup',
      subtotal: totalsE.subtotalM,
      taxTotal: totalsE.taxAmountM,
      total: totalsE.lineTotalM,
      createdById: opts.adminUserId,
      lines: {
        create: [
          {
            productId: product.id,
            description: `${product.nameEn} (custom width)`,
            specifications: `Fabric: Linen Sand; Dims: ${customW}×${catalogH}×${catalogD} cm`,
            quantity: 1,
            unitPrice,
            taxRate: VAT,
            lineTotal: totalsE.lineTotalM,
            manufacturingComplexity: ManufacturingComplexity.MODIFIED,
            orderSpec: {
              productId: product.id,
              productName: product.nameEn,
              quantity: 1,
              manufacturingComplexity: 'MODIFIED',
              catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
              requestedDimensions: { width: customW, height: catalogH, depth: catalogD },
              fabric: { type: 'Linen', color: 'Sand' },
            },
            sortOrder: 0,
          },
        ],
      },
    },
  });
}
