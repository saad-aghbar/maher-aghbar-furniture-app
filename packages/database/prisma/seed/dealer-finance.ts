/**
 * Mock dealer AR finance for Nile / Oasis / Balqis:
 * invoices + payments (powers Account Statement API) and return requests.
 */
import {
  InvoiceStatus,
  PaymentMethod,
  PrismaClient,
  ReturnReason,
  ReturnResolution,
  SalesOrderStatus,
} from '@prisma/client';
import type { DealerRef } from './people';
import { VAT, addDays, createRng, money } from './util';

const BILLABLE: SalesOrderStatus[] = [
  SalesOrderStatus.WAITING_FOR_PAYMENT,
  SalesOrderStatus.READY_FOR_PRODUCTION,
  SalesOrderStatus.WAITING_FOR_MATERIALS,
  SalesOrderStatus.IN_PRODUCTION,
  SalesOrderStatus.READY_FOR_DELIVERY,
  SalesOrderStatus.DELIVERED,
  SalesOrderStatus.COMPLETED,
  SalesOrderStatus.ON_HOLD,
];

const RETURNABLE: SalesOrderStatus[] = [
  SalesOrderStatus.DELIVERED,
  SalesOrderStatus.COMPLETED,
  SalesOrderStatus.READY_FOR_DELIVERY,
];

type SeqBag = {
  invoice: number;
  payment: number;
  return_request: number;
};

function pad5(n: number) {
  return String(n).padStart(5, '0');
}

async function nextDoc(
  prisma: PrismaClient,
  key: keyof SeqBag,
  prefix: string,
  counters: SeqBag,
): Promise<string> {
  counters[key] += 1;
  const year = new Date().getFullYear();
  await prisma.sequenceCounter.upsert({
    where: { key_year: { key, year } },
    create: { key, year, current: counters[key] },
    update: { current: counters[key] },
  });
  return `${prefix}-${year}-${pad5(counters[key])}`;
}

function financeForStatus(
  status: SalesOrderStatus,
  total: number,
  daysAgoCreated: number,
  roll: number,
): { invStatus: InvoiceStatus; paid: number } {
  if (status === SalesOrderStatus.WAITING_FOR_PAYMENT) {
    return { invStatus: InvoiceStatus.ISSUED, paid: 0 };
  }
  if (status === SalesOrderStatus.COMPLETED) {
    return { invStatus: InvoiceStatus.PAID, paid: total };
  }
  if (status === SalesOrderStatus.DELIVERED) {
    if (roll < 0.55) return { invStatus: InvoiceStatus.PAID, paid: total };
    if (roll < 0.85) {
      return { invStatus: InvoiceStatus.PARTIALLY_PAID, paid: total * 0.4 };
    }
    return { invStatus: InvoiceStatus.ISSUED, paid: 0 };
  }
  if (status === SalesOrderStatus.READY_FOR_DELIVERY) {
    if (roll < 0.4) return { invStatus: InvoiceStatus.PARTIALLY_PAID, paid: total * 0.3 };
    return { invStatus: InvoiceStatus.ISSUED, paid: 0 };
  }
  if (daysAgoCreated > 10 && roll < 0.25) {
    return { invStatus: InvoiceStatus.OVERDUE, paid: total * 0.25 };
  }
  if (roll < 0.45) {
    return { invStatus: InvoiceStatus.PARTIALLY_PAID, paid: total * 0.3 };
  }
  return { invStatus: InvoiceStatus.ISSUED, paid: 0 };
}

export async function seedDealerFinance(
  prisma: PrismaClient,
  opts: { adminId: string; dealers: DealerRef[] },
): Promise<{ invoices: number; payments: number; returns: number }> {
  const rng = createRng(20260812);
  const counters: SeqBag = { invoice: 0, payment: 0, return_request: 0 };
  const dealerIds = opts.dealers.map((d) => d.id);

  const orders = await prisma.salesOrder.findMany({
    where: {
      archivedAt: null,
      customerId: { in: dealerIds },
      status: { in: BILLABLE },
    },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      customer: { select: { id: true, code: true, nameEn: true } },
    },
    orderBy: { orderDate: 'asc' },
  });

  let invoices = 0;
  let payments = 0;
  let returns = 0;

  for (const so of orders) {
    const total = Number(so.total);
    if (!Number.isFinite(total) || total <= 0) continue;

    const createdAt = so.orderDate ?? so.createdAt;
    const daysAgoCreated = Math.max(
      0,
      Math.round((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const { invStatus, paid: paidRaw } = financeForStatus(
      so.status,
      total,
      daysAgoCreated,
      rng.next(),
    );
    const paid = Math.round(paidRaw * 1000) / 1000;
    const outstanding = Math.round((total - paid) * 1000) / 1000;
    const subtotal = Number(so.subtotal) || total / (1 + VAT);
    const taxTotal = Number(so.taxTotal) || total - subtotal;

    const invNumber = await nextDoc(prisma, 'invoice', 'INV', counters);
    const inv = await prisma.invoice.create({
      data: {
        number: invNumber,
        customerId: so.customerId,
        salesOrderId: so.id,
        status: invStatus,
        invoiceDate: createdAt,
        dueDate: addDays(createdAt, 30),
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        total: money(total),
        paidAmount: money(paid),
        outstandingAmount: money(Math.max(0, outstanding)),
        notes: `Seed invoice for ${so.number}`,
        createdById: opts.adminId,
        lines: {
          create:
            so.lines.length > 0
              ? so.lines.map((line) => ({
                  description: line.description,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  taxRate: line.taxRate,
                  lineTotal: line.lineTotal,
                }))
              : [
                  {
                    description: so.projectName || so.number,
                    quantity: money(1),
                    unitPrice: money(subtotal),
                    taxRate: VAT,
                    lineTotal: money(total),
                  },
                ],
        },
      },
    });
    invoices += 1;

    await prisma.statementEntry.create({
      data: {
        customerId: so.customerId,
        entryDate: createdAt,
        type: 'INVOICE',
        reference: inv.number,
        description: `Invoice ${inv.number} · ${so.number}`,
        debit: money(total),
        credit: money(0),
        balance: money(Math.max(0, outstanding)),
      },
    });

    if (paid > 0) {
      const payNumber = await nextDoc(prisma, 'payment', 'PAY', counters);
      const method = rng.pick([
        PaymentMethod.BANK_TRANSFER,
        PaymentMethod.BANK_TRANSFER,
        PaymentMethod.CHEQUE,
        PaymentMethod.CASH,
        PaymentMethod.CARD,
      ]);
      const paymentDate = addDays(createdAt, rng.int(1, 5));
      await prisma.payment.create({
        data: {
          number: payNumber,
          customerId: so.customerId,
          invoiceId: inv.id,
          amount: money(paid),
          method,
          paymentDate,
          referenceNumber: `TRF-${rng.int(10000, 99999)}`,
          notes: `Payment against ${inv.number}`,
          createdById: opts.adminId,
        },
      });
      payments += 1;

      await prisma.statementEntry.create({
        data: {
          customerId: so.customerId,
          entryDate: paymentDate,
          type: 'PAYMENT',
          reference: payNumber,
          description: `Payment ${payNumber} · ${inv.number}`,
          debit: money(0),
          credit: money(paid),
          balance: money(Math.max(0, outstanding)),
        },
      });
    }
  }

  // Ensure each dealer has at least a couple of returns for UI demos.
  const delivered = orders.filter((o) => RETURNABLE.includes(o.status));
  const byDealer = new Map<string, typeof delivered>();
  for (const so of delivered) {
    const list = byDealer.get(so.customerId) ?? [];
    list.push(so);
    byDealer.set(so.customerId, list);
  }

  const reasons = [
    ReturnReason.DELIVERY_DAMAGE,
    ReturnReason.MANUFACTURING_DEFECT,
    ReturnReason.INCORRECT_COLOR,
    ReturnReason.CUSTOMER_REQUEST,
  ];

  for (const dealer of opts.dealers) {
    const pool = byDealer.get(dealer.id) ?? [];
    const pickCount = Math.min(3, Math.max(1, pool.length));
    const chosen = [...pool]
      .sort(() => rng.next() - 0.5)
      .slice(0, pickCount);

    // If no delivered orders, still create one orphan-ish return against any SO for the dealer.
    const fallback =
      chosen.length > 0
        ? chosen
        : orders.filter((o) => o.customerId === dealer.id).slice(0, 1);

    for (let i = 0; i < fallback.length; i += 1) {
      const so = fallback[i]!;
      const line = so.lines[0];
      const retNumber = await nextDoc(prisma, 'return_request', 'RET', counters);
      const approval =
        i === 0 ? 'PENDING' : i === 1 ? 'APPROVED' : rng.pick(['PENDING', 'APPROVED', 'REJECTED']);
      await prisma.returnRequest.create({
        data: {
          number: retNumber,
          customerId: dealer.id,
          salesOrderId: so.id,
          productDesc: line?.description ?? so.projectName ?? so.number,
          quantity: money(1),
          reason: rng.pick(reasons),
          description:
            approval === 'PENDING'
              ? 'Customer reported an issue after delivery — awaiting review.'
              : approval === 'APPROVED'
                ? 'Approved for credit / repair per QC.'
                : 'Rejected — wear consistent with normal use.',
          approvalStatus: approval,
          resolution:
            approval === 'APPROVED'
              ? rng.pick([
                  ReturnResolution.REPAIR,
                  ReturnResolution.CREDIT_NOTE,
                  ReturnResolution.REPLACEMENT,
                ])
              : approval === 'REJECTED'
                ? ReturnResolution.REJECTED
                : null,
        },
      });
      returns += 1;
    }
  }

  return { invoices, payments, returns };
}
