import {
  PrismaClient,
  QuotationStatus,
  RequestSource,
  RequestStatus,
  SalesOrderStatus,
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';
import { addDays, demoAsOf } from './clock';
import type { DealerRef } from './people';
import type { ProductRef } from './catalog';
import { nextDoc, type SeqBag } from './seq';

type LifecycleKind =
  | 'DRAFT'
  | 'INTERNAL_REVIEW'
  | 'APPROVED'
  | 'SENT'
  | 'REJECTED'
  | 'REVISION_REQUESTED'
  | 'CANCELLED_THEN_ACCEPTED';

const KINDS: Array<{ kind: LifecycleKind; projectName: string }> = [
  { kind: 'DRAFT', projectName: 'Oasis unsent draft quote' },
  { kind: 'INTERNAL_REVIEW', projectName: 'Oasis internal review quote' },
  { kind: 'APPROVED', projectName: 'Oasis approved unsent quote' },
  { kind: 'SENT', projectName: 'Oasis awaiting dealer accept' },
  { kind: 'REJECTED', projectName: 'Oasis rejected quote' },
  { kind: 'REVISION_REQUESTED', projectName: 'Oasis revision requested' },
  { kind: 'CANCELLED_THEN_ACCEPTED', projectName: 'Oasis revised quote accepted' },
];

/**
 * Small honest commercial lifecycle set (not production stories).
 * Unsent statuses stay invisible to dealers. ACCEPTED v2 has a DRAFT SO, no PO.
 */
export async function seedDemoQuotationLifecycle(
  prisma: PrismaClient,
  opts: {
    adminId: string;
    salesId: string;
    dealers: DealerRef[];
    products: ProductRef[];
    counters: SeqBag;
    dealerUserByCustomerId: Map<string, string>;
  },
): Promise<void> {
  const oasis = opts.dealers.find((d) => d.username === 'oasis');
  const product = opts.products.find((p) => p.sku === 'ARM-01') ?? opts.products[0];
  if (!oasis || !product) return;

  const dealerUserId = opts.dealerUserByCustomerId.get(oasis.id);
  if (!dealerUserId) {
    throw new Error('Oasis dealer user missing — cannot seed commercial lifecycle.');
  }

  const asOf = demoAsOf();
  const qty = 1;
  const unit = Number(product.basePrice ?? 1000);
  const totals = lineTotals(qty, unit);

  for (const row of KINDS) {
    const createdAt = addDays(asOf, -8);
    const rfqNumber = await nextDoc(prisma, 'rfq', opts.counters);
    const rfqStatus =
      row.kind === 'CANCELLED_THEN_ACCEPTED'
        ? RequestStatus.CLOSED
        : row.kind === 'DRAFT' || row.kind === 'INTERNAL_REVIEW' || row.kind === 'APPROVED'
          ? RequestStatus.QUOTED
          : row.kind === 'SENT' || row.kind === 'REJECTED' || row.kind === 'REVISION_REQUESTED'
            ? RequestStatus.QUOTED
            : RequestStatus.QUOTED;

    const rfq = await prisma.requestForQuotation.create({
      data: {
        number: rfqNumber,
        customerId: oasis.id,
        source: RequestSource.PORTAL,
        status: rfqStatus,
        projectName: row.projectName,
        requiredDeliveryDate: addDays(asOf, 28),
        requestDate: addDays(createdAt, -2),
        submittedAt: addDays(createdAt, -1),
        createdById: opts.salesId,
        assignedSalesId: opts.salesId,
        createdAt: addDays(createdAt, -2),
        updatedAt: createdAt,
        items: {
          create: [
            {
              productId: product.id,
              productName: product.nameEn,
              quantity: money(qty),
              sortOrder: 0,
            },
          ],
        },
      },
    });

    const quoteNumber = await nextDoc(prisma, 'quotation', opts.counters);
    const lineCreate = {
      productId: product.id,
      description: product.nameEn,
      quantity: money(qty),
      unitPrice: money(unit),
      taxRate: VAT,
      subtotal: money(totals.subtotal),
      taxAmount: money(totals.taxAmount),
      lineTotal: money(totals.lineTotal),
      sortOrder: 0,
    };

    if (row.kind === 'CANCELLED_THEN_ACCEPTED') {
      const v1 = await prisma.quotation.create({
        data: {
          number: quoteNumber,
          version: 1,
          customerId: oasis.id,
          requestId: rfq.id,
          status: QuotationStatus.CANCELLED,
          issueDate: addDays(createdAt, -3),
          expirationDate: addDays(createdAt, 21),
          salesRepId: opts.salesId,
          createdById: opts.salesId,
          sentAt: addDays(createdAt, -3),
          subtotal: money(totals.subtotal),
          taxTotal: money(totals.taxAmount),
          total: money(totals.lineTotal),
          paymentTerms: '30 days',
          createdAt: addDays(createdAt, -3),
          updatedAt: addDays(createdAt, -1),
          lines: { create: [lineCreate] },
        },
      });
      const v2Number = quoteNumber;
      const v2 = await prisma.quotation.create({
        data: {
          number: v2Number,
          version: 2,
          customerId: oasis.id,
          requestId: rfq.id,
          parentQuotationId: v1.id,
          status: QuotationStatus.ACCEPTED,
          issueDate: addDays(createdAt, -1),
          expirationDate: addDays(createdAt, 21),
          salesRepId: opts.salesId,
          createdById: opts.salesId,
          sentAt: addDays(createdAt, -1),
          acceptedAt: createdAt,
          acceptedById: dealerUserId,
          subtotal: money(totals.subtotal),
          taxTotal: money(totals.taxAmount),
          total: money(totals.lineTotal),
          paymentTerms: '30 days',
          createdAt: addDays(createdAt, -1),
          updatedAt: createdAt,
          lines: { create: [lineCreate] },
        },
      });
      await prisma.quotationApproval.create({
        data: {
          quotationId: v2.id,
          approverId: opts.adminId,
          decision: 'APPROVED',
          comment: '[step:SYSTEM_ADMINISTRATOR] Internal send gate',
          decidedAt: addDays(createdAt, -1),
        },
      });
      await prisma.salesOrder.create({
        data: {
          number: await nextDoc(prisma, 'sales_order', opts.counters),
          customerId: oasis.id,
          quotationId: v2.id,
          orderDate: createdAt,
          requiredDeliveryDate: addDays(asOf, 28),
          status: SalesOrderStatus.DRAFT,
          projectName: row.projectName,
          subtotal: money(totals.subtotal),
          taxTotal: money(totals.taxAmount),
          total: money(totals.lineTotal),
          createdById: opts.adminId,
          createdAt,
          updatedAt: createdAt,
          lines: {
            create: [
              {
                productId: product.id,
                description: product.nameEn,
                quantity: money(qty),
                unitPrice: money(unit),
                taxRate: VAT,
                lineTotal: money(totals.lineTotal),
                sortOrder: 0,
              },
            ],
          },
        },
      });
      continue;
    }

    const status = QuotationStatus[row.kind];
    const sent =
      status === QuotationStatus.SENT ||
      status === QuotationStatus.REJECTED ||
      status === QuotationStatus.REVISION_REQUESTED;
    const quote = await prisma.quotation.create({
      data: {
        number: quoteNumber,
        version: 1,
        customerId: oasis.id,
        requestId: rfq.id,
        status,
        issueDate: createdAt,
        expirationDate: addDays(createdAt, 21),
        salesRepId: opts.salesId,
        createdById: opts.salesId,
        sentAt: sent ? createdAt : undefined,
        rejectedAt: status === QuotationStatus.REJECTED ? createdAt : undefined,
        subtotal: money(totals.subtotal),
        taxTotal: money(totals.taxAmount),
        total: money(totals.lineTotal),
        paymentTerms: '30 days',
        createdAt,
        updatedAt: createdAt,
        lines: { create: [lineCreate] },
      },
    });

    if (status !== QuotationStatus.DRAFT) {
      await prisma.quotationApproval.create({
        data: {
          quotationId: quote.id,
          approverId: opts.adminId,
          decision:
            status === QuotationStatus.REJECTED
              ? 'REJECTED'
              : status === QuotationStatus.REVISION_REQUESTED
                ? 'REVISION_REQUESTED'
                : 'APPROVED',
          comment:
            status === QuotationStatus.REVISION_REQUESTED
              ? 'Please confirm walnut finish'
              : '[step:SYSTEM_ADMINISTRATOR] Internal send gate',
          decidedAt: createdAt,
        },
      });
    }
  }
}
