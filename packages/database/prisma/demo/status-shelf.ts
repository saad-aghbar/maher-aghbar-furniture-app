/**
 * List-filter rows the story compiler does not emit:
 * cancelled / on hold / waiting payment / confirmed, plus RFQ sources and a draft invoice.
 */
import {
  InvoiceStatus,
  PrismaClient,
  RequestSource,
  RequestStatus,
  SalesOrderStatus,
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';
import { addDays, demoAsOf } from './clock';
import type { DealerRef } from './people';
import type { ProductRef } from './catalog';
import { variantLineFields } from './variant-attach';

export async function seedStatusShelf(
  prisma: PrismaClient,
  opts: { adminId: string; salesId: string; dealers: DealerRef[]; products: ProductRef[] },
): Promise<void> {
  const asOf = demoAsOf();
  const nile = opts.dealers.find((d) => d.username === 'nile');
  const oasis = opts.dealers.find((d) => d.username === 'oasis');
  const balqis = opts.dealers.find((d) => d.username === 'balqis');
  const product = opts.products.find((p) => p.sku === 'SOF-LOVE') ?? opts.products[0];
  if (!nile || !oasis || !balqis || !product) return;

  const shelves: Array<{ dealer: DealerRef; status: SalesOrderStatus; name: string; number: string }> = [
    { dealer: nile, status: SalesOrderStatus.CANCELLED, name: 'Abdoun cancelled loveseat', number: 'SO-SHELF-CANC' },
    { dealer: oasis, status: SalesOrderStatus.ON_HOLD, name: 'Sweifieh on hold loveseat', number: 'SO-SHELF-HOLD' },
    { dealer: balqis, status: SalesOrderStatus.WAITING_FOR_PAYMENT, name: 'Balqis deposit pending', number: 'SO-SHELF-PAY' },
    { dealer: nile, status: SalesOrderStatus.CONFIRMED, name: 'Abdoun confirmed loveseat', number: 'SO-SHELF-CONF' },
    { dealer: oasis, status: SalesOrderStatus.COMPLETED, name: 'Sweifieh completed loveseat', number: 'SO-SHELF-DONE' },
  ];

  const unit = Number(product.basePrice ?? 700);
  const totals = lineTotals(1, unit);

  for (const row of shelves) {
    const so = await prisma.salesOrder.create({
      data: {
        number: row.number,
        customerId: row.dealer.id,
        orderDate: addDays(asOf, -3),
        requiredDeliveryDate: addDays(asOf, 21),
        status: row.status,
        projectName: row.name,
        deliveryAddress: `${row.dealer.street}, ${row.dealer.area}, ${row.dealer.city}`,
        subtotal: money(totals.subtotal),
        taxTotal: money(totals.taxAmount),
        total: money(totals.lineTotal),
        cancellationReason: row.status === SalesOrderStatus.CANCELLED ? 'Dealer changed the room plan.' : undefined,
        createdById: opts.adminId,
        createdAt: addDays(asOf, -3),
        lines: {
          create: [
            {
              productId: product.id,
              ...variantLineFields(product),
              description: product.nameEn,
              quantity: money(1),
              unitPrice: money(unit),
              taxRate: VAT,
              lineTotal: money(totals.lineTotal),
              sortOrder: 0,
            },
          ],
        },
      },
    });
    if (row.status === SalesOrderStatus.CONFIRMED) {
      await prisma.invoice.create({
        data: {
          number: 'INV-SHELF-DRAFT',
          customerId: row.dealer.id,
          salesOrderId: so.id,
          invoiceDate: asOf,
          dueDate: addDays(asOf, 30),
          status: InvoiceStatus.DRAFT,
          subtotal: money(totals.subtotal),
          taxTotal: money(totals.taxAmount),
          total: money(totals.lineTotal),
          paidAmount: money(0),
          outstandingAmount: money(totals.lineTotal),
          createdById: opts.adminId,
          lines: {
            create: [
              {
                description: product.nameEn,
                quantity: money(1),
                unitPrice: money(unit),
                taxRate: VAT,
                lineTotal: money(totals.lineTotal),
              },
            ],
          },
        },
      });
    }
  }

  const rfqs: Array<{ dealer: DealerRef; status: RequestStatus; source: RequestSource; name: string; number: string }> = [
    { dealer: balqis, status: RequestStatus.NEEDS_INFORMATION, source: RequestSource.IMAGE, name: 'Balqis photo enquiry', number: 'RFQ-SHELF-PHOTO' },
    { dealer: nile, status: RequestStatus.DRAFT, source: RequestSource.SALES, name: 'Nile unsent request', number: 'RFQ-SHELF-DRAFT' },
    { dealer: oasis, status: RequestStatus.SUBMITTED, source: RequestSource.PORTAL, name: 'Oasis submitted request', number: 'RFQ-SHELF-SUB' },
    { dealer: balqis, status: RequestStatus.UNDER_REVIEW, source: RequestSource.PDF, name: 'Balqis PDF brief', number: 'RFQ-SHELF-PDF' },
    { dealer: nile, status: RequestStatus.CANCELLED, source: RequestSource.PHONE, name: 'Nile cancelled call-in', number: 'RFQ-SHELF-CANC' },
  ];
  for (const row of rfqs) {
    await prisma.requestForQuotation.create({
      data: {
        number: row.number,
        customerId: row.dealer.id,
        source: row.source,
        status: row.status,
        projectName: row.name,
        requiredDeliveryDate: addDays(asOf, 30),
        requestDate: addDays(asOf, -1),
        informationRequestReason:
          row.status === RequestStatus.NEEDS_INFORMATION ? 'Need a clearer photo of the corner.' : undefined,
        createdById: opts.salesId,
        assignedSalesId: opts.salesId,
        items: {
          create: [
            {
              productId: product.id,
              ...variantLineFields(product),
              productName: product.nameEn,
              quantity: money(1),
            },
          ],
        },
      },
    });
  }
  console.log('  status shelf: cancelled/hold/payment/confirmed/completed + RFQ sources');
}
