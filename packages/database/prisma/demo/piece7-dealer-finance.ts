/**
 * Piece 7 deterministic dealer commercial finance examples (SO/INV/PAY-P7-A…L).
 * Prefer direct Prisma SO + Invoice + Payment + PaymentAllocation (no full RFQ chain).
 * Preserves Piece 1–6 rows; upserts/wipes by distinctive P7 numbers.
 */
import {
  CommercialPriceStatus,
  InvoiceStatus,
  ManufacturingComplexity,
  PaymentMethod,
  PrismaClient,
  SalesOrderStatus,
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';
import { addDays, ammanLocal } from './clock';

type DealerRef = { id: string; code: string; nameEn?: string; name?: string; username?: string };
type ProductRef = {
  id: string;
  sku: string;
  nameEn: string;
  basePrice: unknown;
};

type LineInput = {
  productId: string;
  description: string;
  qty: number;
  unitPrice: number;
  complexity: ManufacturingComplexity;
  commercialPriceStatus: CommercialPriceStatus;
  commercialPriceSource?: string;
  commercialPriceNote?: string;
  sortOrder?: number;
};

export async function seedPiece7DealerFinanceExamples(
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
  const balqis =
    opts.dealers.find((d) => d.username === 'balqis' || /balqis/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[2] ??
    opts.dealers[0];
  const product = opts.products[0];
  const productB = opts.products[1] ?? product;
  if (!oasis || !nile || !balqis || !product) {
    console.log('  Piece 7 skipped — missing dealers or products.');
    return;
  }

  // Customer model has no isCertified (suppliers do — Piece 6). Skip dealer certify.

  /**
   * Legacy demo payments often set invoiceId + paidAmount without PaymentAllocation.
   * Piece 7 credit = payment.amount − Σ allocations — backfill so only intentional overpay is credit.
   */
  async function backfillLegacyAllocations(customerId: string) {
    const payments = await prisma.payment.findMany({
      where: { customerId, invoiceId: { not: null } },
      include: { allocations: true },
    });
    for (const p of payments) {
      if (p.allocations.length > 0 || !p.invoiceId) continue;
      const amt = Number(p.amount);
      if (!(amt > 0)) continue;
      await prisma.paymentAllocation.create({
        data: {
          paymentId: p.id,
          invoiceId: p.invoiceId,
          amount: money(amt),
          createdById: opts.adminUserId,
        },
      });
    }
  }

  /** Trim stray unallocated remainder on non-P7 payments so P7-L credit math is exact. */
  async function neutralizeAdvanceCredit(customerId: string) {
    const payments = await prisma.payment.findMany({
      where: {
        customerId,
        NOT: { number: { startsWith: 'PAY-P7-' } },
      },
      include: { allocations: true },
    });
    for (const p of payments) {
      const allocated = p.allocations.reduce((s, a) => s + Number(a.amount), 0);
      const amt = Number(p.amount);
      if (amt > allocated + 0.001) {
        await prisma.payment.update({
          where: { id: p.id },
          data: { amount: money(Math.max(allocated, 0)) },
        });
      }
    }
  }

  async function wipeSalesOrder(number: string) {
    const so = await prisma.salesOrder.findUnique({
      where: { number },
      include: { invoices: { select: { id: true, number: true } } },
    });
    if (!so) return;
    for (const inv of so.invoices) {
      await wipeInvoice(inv.number);
    }
    await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: so.id } });
    await prisma.salesOrder.delete({ where: { id: so.id } });
  }

  async function wipeInvoice(number: string) {
    const inv = await prisma.invoice.findUnique({
      where: { number },
      select: { id: true, customerId: true },
    });
    if (!inv) return;
    await prisma.paymentAllocation.deleteMany({ where: { invoiceId: inv.id } });
    // Detach legacy payment.invoiceId links before delete.
    await prisma.payment.updateMany({
      where: { invoiceId: inv.id },
      data: { invoiceId: null },
    });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: inv.id } });
    await prisma.statementEntry.deleteMany({
      where: { customerId: inv.customerId, reference: number },
    });
    await prisma.invoice.delete({ where: { id: inv.id } });
  }

  async function wipePayment(number: string) {
    const pay = await prisma.payment.findUnique({ where: { number } });
    if (!pay) return;
    await prisma.paymentAllocation.deleteMany({ where: { paymentId: pay.id } });
    await prisma.statementEntry.deleteMany({
      where: { customerId: pay.customerId, reference: number },
    });
    await prisma.payment.delete({ where: { id: pay.id } });
  }

  async function wipeBundle(letter: string) {
    await wipePayment(`PAY-P7-${letter}`);
    await wipePayment(`PAY-P7-${letter}1`);
    await wipePayment(`PAY-P7-${letter}2`);
    await wipeInvoice(`INV-P7-${letter}`);
    await wipeInvoice(`INV-P7-${letter}1`);
    await wipeInvoice(`INV-P7-${letter}2`);
    await wipeSalesOrder(`SO-P7-${letter}`);
    await wipeSalesOrder(`SO-P7-${letter}1`);
    await wipeSalesOrder(`SO-P7-${letter}2`);
  }

  function totalsForLines(lines: LineInput[]) {
    let subtotal = 0;
    let taxTotal = 0;
    let total = 0;
    const computed = lines.map((l, i) => {
      const t = lineTotals(l.qty, l.unitPrice, VAT);
      subtotal += t.subtotal;
      taxTotal += t.taxAmount;
      total += t.lineTotal;
      return { ...l, ...t, sortOrder: l.sortOrder ?? i };
    });
    return {
      lines: computed,
      subtotal,
      taxTotal,
      total,
      subtotalM: money(subtotal),
      taxTotalM: money(taxTotal),
      totalM: money(total),
    };
  }

  async function createSalesOrder(args: {
    number: string;
    customerId: string;
    title: string;
    status?: SalesOrderStatus;
    lines: LineInput[];
    orderDate?: Date;
    manufacturingCost?: number | null;
  }) {
    await wipeSalesOrder(args.number);
    const bag = totalsForLines(args.lines);
    return prisma.salesOrder.create({
      data: {
        number: args.number,
        customerId: args.customerId,
        status: args.status ?? SalesOrderStatus.WAITING_FOR_PAYMENT,
        externalOrderNumber: args.number.replace('SO-', ''),
        projectName: args.title,
        orderDate: args.orderDate ?? ammanLocal(2026, 7, 1, 10),
        subtotal: bag.subtotalM,
        taxTotal: bag.taxTotalM,
        total: bag.totalM,
        manufacturingCost:
          args.manufacturingCost === undefined
            ? null
            : args.manufacturingCost === null
              ? null
              : money(args.manufacturingCost),
        createdById: opts.adminUserId,
        lines: {
          create: bag.lines.map((l) => ({
            productId: l.productId,
            description: l.description,
            quantity: money(l.qty),
            unitPrice: money(l.unitPrice),
            taxRate: VAT,
            lineTotal: l.lineTotalM,
            manufacturingComplexity: l.complexity,
            commercialPriceStatus: l.commercialPriceStatus,
            commercialPriceSource: l.commercialPriceSource ?? null,
            commercialPriceNote: l.commercialPriceNote ?? null,
            sortOrder: l.sortOrder,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async function createInvoice(args: {
    number: string;
    salesOrderId: string;
    customerId: string;
    total: number;
    subtotal: number;
    taxTotal: number;
    status: InvoiceStatus;
    paidAmount: number;
    invoiceDate: Date;
    dueDate: Date;
    lineDescription: string;
    unitPrice: number;
    qty?: number;
  }) {
    await wipeInvoice(args.number);
    const qty = args.qty ?? 1;
    const outstanding = Math.max(0, args.total - args.paidAmount);
    const inv = await prisma.invoice.create({
      data: {
        number: args.number,
        customerId: args.customerId,
        salesOrderId: args.salesOrderId,
        status: args.status,
        invoiceDate: args.invoiceDate,
        dueDate: args.dueDate,
        subtotal: money(args.subtotal),
        taxTotal: money(args.taxTotal),
        total: money(args.total),
        paidAmount: money(args.paidAmount),
        outstandingAmount: money(outstanding),
        notes: `Piece 7 ${args.number}`,
        createdById: opts.adminUserId,
        lines: {
          create: [
            {
              description: args.lineDescription,
              quantity: money(qty),
              unitPrice: money(args.unitPrice),
              taxRate: VAT,
              lineTotal: money(args.total),
            },
          ],
        },
      },
    });
    await prisma.statementEntry.create({
      data: {
        customerId: args.customerId,
        entryDate: args.invoiceDate,
        type: 'INVOICE',
        reference: args.number,
        description: `Invoice ${args.number}`,
        debit: money(args.total),
        credit: money(0),
        balance: money(outstanding),
      },
    });
    return inv;
  }

  async function createPayment(args: {
    number: string;
    customerId: string;
    amount: number;
    paymentDate: Date;
    invoiceId?: string | null;
    allocations?: Array<{ invoiceId: string; amount: number }>;
    notes?: string;
  }) {
    await wipePayment(args.number);
    const pay = await prisma.payment.create({
      data: {
        number: args.number,
        customerId: args.customerId,
        invoiceId: args.invoiceId ?? args.allocations?.[0]?.invoiceId ?? null,
        paymentDate: args.paymentDate,
        amount: money(args.amount),
        method: PaymentMethod.BANK_TRANSFER,
        notes: args.notes ?? `Piece 7 ${args.number}`,
        createdById: opts.adminUserId,
        idempotencyKey: `demo-${args.number}`,
      },
    });
    for (const a of args.allocations ?? []) {
      await prisma.paymentAllocation.create({
        data: {
          paymentId: pay.id,
          invoiceId: a.invoiceId,
          amount: money(a.amount),
          createdById: opts.adminUserId,
        },
      });
    }
    await prisma.statementEntry.create({
      data: {
        customerId: args.customerId,
        entryDate: args.paymentDate,
        type: 'PAYMENT',
        reference: args.number,
        description: `Payment ${args.number}`,
        debit: money(0),
        credit: money(args.amount),
        balance: money(0),
      },
    });
    return pay;
  }

  const catalogUnit = Number(product.basePrice) || 2500;
  const stdLine = (
    label: string,
    unitPrice = catalogUnit,
    status: CommercialPriceStatus = CommercialPriceStatus.CATALOG,
  ): LineInput => ({
    productId: product.id,
    description: `${product.nameEn} — ${label}`,
    qty: 1,
    unitPrice,
    complexity: ManufacturingComplexity.STANDARD,
    commercialPriceStatus: status,
    commercialPriceSource: status === CommercialPriceStatus.CATALOG ? 'CATALOG_LIST' : undefined,
  });

  // ── Backfill legacy allocations for finance dealers ──────────────────────
  for (const d of [oasis, nile, balqis]) {
    await backfillLegacyAllocations(d.id);
  }

  // Wipe prior P7 bundles (idempotent re-seed)
  for (const L of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) {
    await wipeBundle(L);
  }
  await wipePayment('PAY-P7-I');
  await wipeInvoice('INV-P7-I1');
  await wipeInvoice('INV-P7-I2');
  await wipeSalesOrder('SO-P7-I1');
  await wipeSalesOrder('SO-P7-I2');
  await wipeInvoice('INV-P7-L2');
  await wipeSalesOrder('SO-P7-L2');
  await wipePayment('PAY-P7-G');

  // ── P7-A STANDARD CATALOG snapshot + invoice ─────────────────────────────
  {
    const bag = totalsForLines([stdLine('P7-A')]);
    const so = await createSalesOrder({
      number: 'SO-P7-A',
      customerId: oasis.id,
      title: 'P7-A STANDARD catalog price',
      lines: [stdLine('P7-A')],
      orderDate: ammanLocal(2026, 7, 2, 10),
    });
    await createInvoice({
      number: 'INV-P7-A',
      salesOrderId: so.id,
      customerId: oasis.id,
      total: bag.total,
      subtotal: bag.subtotal,
      taxTotal: bag.taxTotal,
      status: InvoiceStatus.ISSUED,
      paidAmount: 0,
      invoiceDate: ammanLocal(2026, 7, 3, 10),
      dueDate: ammanLocal(2026, 8, 2, 10),
      lineDescription: so.lines[0]!.description,
      unitPrice: catalogUnit,
    });
  }

  // ── P7-B MODIFIED REQUIRED — no invoice (commercial gate) ───────────────
  await createSalesOrder({
    number: 'SO-P7-B',
    customerId: oasis.id,
    title: 'P7-B MODIFIED price REQUIRED',
    lines: [
      {
        productId: product.id,
        description: `${product.nameEn} — P7-B modified`,
        qty: 1,
        unitPrice: catalogUnit * 1.1,
        complexity: ManufacturingComplexity.MODIFIED,
        commercialPriceStatus: CommercialPriceStatus.REQUIRED,
        commercialPriceNote: 'Awaiting authorized final dealer price',
      },
    ],
    orderDate: ammanLocal(2026, 7, 4, 10),
  });

  // ── P7-C CUSTOM CONFIRMED + invoice ──────────────────────────────────────
  {
    const unit = Math.round(catalogUnit * 1.35);
    const bag = totalsForLines([
      {
        productId: product.id,
        description: `${product.nameEn} — P7-C custom`,
        qty: 1,
        unitPrice: unit,
        complexity: ManufacturingComplexity.CUSTOM,
        commercialPriceStatus: CommercialPriceStatus.CONFIRMED,
        commercialPriceSource: 'STAFF_CONFIRMED',
        commercialPriceNote: 'Final custom commercial price confirmed',
      },
    ]);
    const so = await createSalesOrder({
      number: 'SO-P7-C',
      customerId: oasis.id,
      title: 'P7-C CUSTOM confirmed',
      lines: [
        {
          productId: product.id,
          description: `${product.nameEn} — P7-C custom`,
          qty: 1,
          unitPrice: unit,
          complexity: ManufacturingComplexity.CUSTOM,
          commercialPriceStatus: CommercialPriceStatus.CONFIRMED,
          commercialPriceSource: 'STAFF_CONFIRMED',
          commercialPriceNote: 'Final custom commercial price confirmed',
        },
      ],
      orderDate: ammanLocal(2026, 7, 5, 10),
    });
    await createInvoice({
      number: 'INV-P7-C',
      salesOrderId: so.id,
      customerId: oasis.id,
      total: bag.total,
      subtotal: bag.subtotal,
      taxTotal: bag.taxTotal,
      status: InvoiceStatus.ISSUED,
      paidAmount: 0,
      invoiceDate: ammanLocal(2026, 7, 6, 10),
      dueDate: ammanLocal(2026, 8, 5, 10),
      lineDescription: so.lines[0]!.description,
      unitPrice: unit,
    });
  }

  // ── P7-D open unpaid invoice ─────────────────────────────────────────────
  {
    const bag = totalsForLines([stdLine('P7-D', 3000)]);
    const so = await createSalesOrder({
      number: 'SO-P7-D',
      customerId: oasis.id,
      title: 'P7-D open unpaid',
      lines: [stdLine('P7-D', 3000)],
      orderDate: ammanLocal(2026, 7, 8, 10),
    });
    await createInvoice({
      number: 'INV-P7-D',
      salesOrderId: so.id,
      customerId: oasis.id,
      total: bag.total,
      subtotal: bag.subtotal,
      taxTotal: bag.taxTotal,
      status: InvoiceStatus.ISSUED,
      paidAmount: 0,
      invoiceDate: ammanLocal(2026, 7, 9, 10),
      dueDate: ammanLocal(2026, 8, 8, 10),
      lineDescription: so.lines[0]!.description,
      unitPrice: 3000,
    });
  }

  // ── P7-E partial payment ─────────────────────────────────────────────────
  {
    const unit = 4000;
    const bag = totalsForLines([stdLine('P7-E', unit)]);
    const paid = Math.round(bag.total * 0.4 * 1000) / 1000;
    const so = await createSalesOrder({
      number: 'SO-P7-E',
      customerId: oasis.id,
      title: 'P7-E partial payment',
      lines: [stdLine('P7-E', unit)],
      orderDate: ammanLocal(2026, 7, 10, 10),
    });
    const inv = await createInvoice({
      number: 'INV-P7-E',
      salesOrderId: so.id,
      customerId: oasis.id,
      total: bag.total,
      subtotal: bag.subtotal,
      taxTotal: bag.taxTotal,
      status: InvoiceStatus.PARTIALLY_PAID,
      paidAmount: paid,
      invoiceDate: ammanLocal(2026, 7, 11, 10),
      dueDate: ammanLocal(2026, 8, 10, 10),
      lineDescription: so.lines[0]!.description,
      unitPrice: unit,
    });
    await createPayment({
      number: 'PAY-P7-E',
      customerId: oasis.id,
      amount: paid,
      paymentDate: ammanLocal(2026, 7, 12, 10),
      invoiceId: inv.id,
      allocations: [{ invoiceId: inv.id, amount: paid }],
    });
  }

  // ── P7-F fully paid via two payments ─────────────────────────────────────
  {
    const unit = 3500;
    const bag = totalsForLines([stdLine('P7-F', unit)]);
    const half = Math.round((bag.total / 2) * 1000) / 1000;
    const rest = Math.round((bag.total - half) * 1000) / 1000;
    const so = await createSalesOrder({
      number: 'SO-P7-F',
      customerId: oasis.id,
      title: 'P7-F fully paid multi-payment',
      lines: [stdLine('P7-F', unit)],
      orderDate: ammanLocal(2026, 7, 13, 10),
    });
    const inv = await createInvoice({
      number: 'INV-P7-F',
      salesOrderId: so.id,
      customerId: oasis.id,
      total: bag.total,
      subtotal: bag.subtotal,
      taxTotal: bag.taxTotal,
      status: InvoiceStatus.PAID,
      paidAmount: bag.total,
      invoiceDate: ammanLocal(2026, 7, 14, 10),
      dueDate: ammanLocal(2026, 8, 13, 10),
      lineDescription: so.lines[0]!.description,
      unitPrice: unit,
    });
    await createPayment({
      number: 'PAY-P7-F1',
      customerId: oasis.id,
      amount: half,
      paymentDate: ammanLocal(2026, 7, 15, 10),
      invoiceId: inv.id,
      allocations: [{ invoiceId: inv.id, amount: half }],
    });
    await createPayment({
      number: 'PAY-P7-F2',
      customerId: oasis.id,
      amount: rest,
      paymentDate: ammanLocal(2026, 7, 16, 10),
      invoiceId: inv.id,
      allocations: [{ invoiceId: inv.id, amount: rest }],
    });
  }

  // ── P7-G multi-invoice + one payment split ───────────────────────────────
  {
    const unit1 = 2000;
    const unit2 = 2500;
    const bag1 = totalsForLines([stdLine('P7-G1', unit1)]);
    const bag2 = totalsForLines([stdLine('P7-G2', unit2)]);
    const so1 = await createSalesOrder({
      number: 'SO-P7-G1',
      customerId: oasis.id,
      title: 'P7-G invoice 1',
      lines: [stdLine('P7-G1', unit1)],
      orderDate: ammanLocal(2026, 7, 17, 10),
    });
    const so2 = await createSalesOrder({
      number: 'SO-P7-G2',
      customerId: oasis.id,
      title: 'P7-G invoice 2',
      lines: [stdLine('P7-G2', unit2)],
      orderDate: ammanLocal(2026, 7, 17, 11),
    });
    const inv1 = await createInvoice({
      number: 'INV-P7-G1',
      salesOrderId: so1.id,
      customerId: oasis.id,
      total: bag1.total,
      subtotal: bag1.subtotal,
      taxTotal: bag1.taxTotal,
      status: InvoiceStatus.PAID,
      paidAmount: bag1.total,
      invoiceDate: ammanLocal(2026, 7, 18, 10),
      dueDate: ammanLocal(2026, 8, 17, 10),
      lineDescription: so1.lines[0]!.description,
      unitPrice: unit1,
    });
    const inv2 = await createInvoice({
      number: 'INV-P7-G2',
      salesOrderId: so2.id,
      customerId: oasis.id,
      total: bag2.total,
      subtotal: bag2.subtotal,
      taxTotal: bag2.taxTotal,
      status: InvoiceStatus.PAID,
      paidAmount: bag2.total,
      invoiceDate: ammanLocal(2026, 7, 18, 11),
      dueDate: ammanLocal(2026, 8, 17, 11),
      lineDescription: so2.lines[0]!.description,
      unitPrice: unit2,
    });
    const payTotal = bag1.total + bag2.total;
    await createPayment({
      number: 'PAY-P7-G',
      customerId: oasis.id,
      amount: payTotal,
      paymentDate: ammanLocal(2026, 7, 19, 10),
      allocations: [
        { invoiceId: inv1.id, amount: bag1.total },
        { invoiceId: inv2.id, amount: bag2.total },
      ],
      notes: 'P7-G split allocation across INV-P7-G1/G2',
    });
  }

  // ── P7-H overdue on Nile (privacy vs oasis) ──────────────────────────────
  {
    const unit = 2800;
    const bag = totalsForLines([stdLine('P7-H', unit)]);
    const so = await createSalesOrder({
      number: 'SO-P7-H',
      customerId: nile.id,
      title: 'P7-H overdue invoice',
      lines: [stdLine('P7-H', unit)],
      orderDate: ammanLocal(2026, 5, 1, 10),
    });
    await createInvoice({
      number: 'INV-P7-H',
      salesOrderId: so.id,
      customerId: nile.id,
      total: bag.total,
      subtotal: bag.subtotal,
      taxTotal: bag.taxTotal,
      status: InvoiceStatus.OVERDUE,
      paidAmount: 0,
      invoiceDate: ammanLocal(2026, 5, 2, 10),
      dueDate: ammanLocal(2026, 6, 1, 10),
      lineDescription: so.lines[0]!.description,
      unitPrice: unit,
    });
  }

  // ── P7-I statement opening / running (Nile, dated window) ────────────────
  // Matches dealer-finance.spec: before from → opening 6000; period INV 5000 → closing 11000.
  {
    // Force exact 10000 / 5000 totals for statement math.
    const total1 = 10000;
    const total2 = 5000;
    const sub1 = Math.round((total1 / 1.16) * 1000) / 1000;
    const tax1 = Math.round((total1 - sub1) * 1000) / 1000;
    const sub2 = Math.round((total2 / 1.16) * 1000) / 1000;
    const tax2 = Math.round((total2 - sub2) * 1000) / 1000;
    const so1 = await createSalesOrder({
      number: 'SO-P7-I1',
      customerId: nile.id,
      title: 'P7-I statement opening material',
      lines: [stdLine('P7-I1', sub1)],
      orderDate: ammanLocal(2026, 1, 1, 10),
    });
    await prisma.salesOrder.update({
      where: { id: so1.id },
      data: { subtotal: money(sub1), taxTotal: money(tax1), total: money(total1) },
    });
    const inv1 = await createInvoice({
      number: 'INV-P7-I1',
      salesOrderId: so1.id,
      customerId: nile.id,
      total: total1,
      subtotal: sub1,
      taxTotal: tax1,
      status: InvoiceStatus.PARTIALLY_PAID,
      paidAmount: 4000,
      invoiceDate: new Date('2026-01-01T10:00:00Z'),
      dueDate: new Date('2026-02-01T10:00:00Z'),
      lineDescription: 'P7-I1 statement debit',
      unitPrice: sub1,
    });
    await createPayment({
      number: 'PAY-P7-I',
      customerId: nile.id,
      amount: 4000,
      paymentDate: new Date('2026-02-01T10:00:00Z'),
      invoiceId: inv1.id,
      allocations: [{ invoiceId: inv1.id, amount: 4000 }],
      notes: 'P7-I statement credit',
    });
    const so2 = await createSalesOrder({
      number: 'SO-P7-I2',
      customerId: nile.id,
      title: 'P7-I statement period invoice',
      lines: [stdLine('P7-I2', sub2)],
      orderDate: ammanLocal(2026, 3, 1, 10),
    });
    await prisma.salesOrder.update({
      where: { id: so2.id },
      data: { subtotal: money(sub2), taxTotal: money(tax2), total: money(total2) },
    });
    await createInvoice({
      number: 'INV-P7-I2',
      salesOrderId: so2.id,
      customerId: nile.id,
      total: total2,
      subtotal: sub2,
      taxTotal: tax2,
      status: InvoiceStatus.ISSUED,
      paidAmount: 0,
      invoiceDate: new Date('2026-03-01T10:00:00Z'),
      dueDate: new Date('2026-04-01T10:00:00Z'),
      lineDescription: 'P7-I2 statement debit',
      unitPrice: sub2,
    });
  }

  // ── P7-J cost incomplete; commercial OK + invoice ────────────────────────
  {
    const bag = totalsForLines([stdLine('P7-J', 2200)]);
    const so = await createSalesOrder({
      number: 'SO-P7-J',
      customerId: oasis.id,
      title: 'P7-J commercial ok / cost incomplete',
      lines: [stdLine('P7-J', 2200)],
      orderDate: ammanLocal(2026, 7, 20, 10),
      manufacturingCost: null,
    });
    await createInvoice({
      number: 'INV-P7-J',
      salesOrderId: so.id,
      customerId: oasis.id,
      total: bag.total,
      subtotal: bag.subtotal,
      taxTotal: bag.taxTotal,
      status: InvoiceStatus.ISSUED,
      paidAmount: 0,
      invoiceDate: ammanLocal(2026, 7, 21, 10),
      dueDate: ammanLocal(2026, 8, 20, 10),
      lineDescription: so.lines[0]!.description,
      unitPrice: 2200,
    });
  }

  // ── P7-K multi-line STANDARD + MODIFIED/CUSTOM (CONFIRMED → invoiceable) ─
  {
    const lines: LineInput[] = [
      stdLine('P7-K-STD', 2000, CommercialPriceStatus.CATALOG),
      {
        productId: productB.id,
        description: `${productB.nameEn} — P7-K modified`,
        qty: 1,
        unitPrice: 3200,
        complexity: ManufacturingComplexity.MODIFIED,
        commercialPriceStatus: CommercialPriceStatus.CONFIRMED,
        commercialPriceSource: 'STAFF_CONFIRMED',
      },
      {
        productId: product.id,
        description: `${product.nameEn} — P7-K custom`,
        qty: 1,
        unitPrice: 4500,
        complexity: ManufacturingComplexity.CUSTOM,
        commercialPriceStatus: CommercialPriceStatus.CONFIRMED,
        commercialPriceSource: 'STAFF_CONFIRMED',
      },
    ];
    const bag = totalsForLines(lines);
    const so = await createSalesOrder({
      number: 'SO-P7-K',
      customerId: oasis.id,
      title: 'P7-K multi-line STANDARD+MODIFIED+CUSTOM',
      lines,
      orderDate: ammanLocal(2026, 7, 22, 10),
    });
    await createInvoice({
      number: 'INV-P7-K',
      salesOrderId: so.id,
      customerId: oasis.id,
      total: bag.total,
      subtotal: bag.subtotal,
      taxTotal: bag.taxTotal,
      status: InvoiceStatus.ISSUED,
      paidAmount: 0,
      invoiceDate: ammanLocal(2026, 7, 23, 10),
      dueDate: ammanLocal(2026, 8, 22, 10),
      lineDescription: 'P7-K multi-line commercial bundle',
      unitPrice: bag.subtotal,
      qty: 1,
    });
  }

  // ── P7-L ADVANCE CREDIT HARD GATE (Balqis, isolated credit) ──────────────
  // INV ₪5000 + PAY ₪20000 alloc ₪5000 → ₪15000 credit; INV-L2 target for apply ₪8000 → ₪7000.
  {
    await neutralizeAdvanceCredit(balqis.id);

    const totalL = 5000;
    const subL = Math.round((totalL / 1.16) * 1000) / 1000;
    const taxL = Math.round((totalL - subL) * 1000) / 1000;
    const totalL2 = 10000;
    const subL2 = Math.round((totalL2 / 1.16) * 1000) / 1000;
    const taxL2 = Math.round((totalL2 - subL2) * 1000) / 1000;

    const soL = await createSalesOrder({
      number: 'SO-P7-L',
      customerId: balqis.id,
      title: 'P7-L advance credit invoice',
      lines: [stdLine('P7-L', subL)],
      orderDate: ammanLocal(2026, 8, 1, 10),
    });
    await prisma.salesOrder.update({
      where: { id: soL.id },
      data: { subtotal: money(subL), taxTotal: money(taxL), total: money(totalL) },
    });
    const invL = await createInvoice({
      number: 'INV-P7-L',
      salesOrderId: soL.id,
      customerId: balqis.id,
      total: totalL,
      subtotal: subL,
      taxTotal: taxL,
      status: InvoiceStatus.PAID,
      paidAmount: totalL,
      invoiceDate: ammanLocal(2026, 8, 2, 10),
      dueDate: addDays(ammanLocal(2026, 8, 2, 10), 30),
      lineDescription: 'P7-L ₪5000 commercial invoice',
      unitPrice: subL,
    });

    const soL2 = await createSalesOrder({
      number: 'SO-P7-L2',
      customerId: balqis.id,
      title: 'P7-L apply-credit target',
      lines: [stdLine('P7-L2', subL2)],
      orderDate: ammanLocal(2026, 8, 3, 10),
    });
    await prisma.salesOrder.update({
      where: { id: soL2.id },
      data: { subtotal: money(subL2), taxTotal: money(taxL2), total: money(totalL2) },
    });
    await createInvoice({
      number: 'INV-P7-L2',
      salesOrderId: soL2.id,
      customerId: balqis.id,
      total: totalL2,
      subtotal: subL2,
      taxTotal: taxL2,
      status: InvoiceStatus.ISSUED,
      paidAmount: 0,
      invoiceDate: ammanLocal(2026, 8, 4, 10),
      dueDate: addDays(ammanLocal(2026, 8, 4, 10), 30),
      lineDescription: 'P7-L2 apply-credit target ₪10000',
      unitPrice: subL2,
    });

    await createPayment({
      number: 'PAY-P7-L',
      customerId: balqis.id,
      amount: 20000,
      paymentDate: ammanLocal(2026, 8, 5, 10),
      invoiceId: invL.id,
      allocations: [{ invoiceId: invL.id, amount: 5000 }],
      notes: 'P7-L overpay → ₪15000 unallocated advance credit',
    });
  }

  console.log('  Piece 7 dealer finance examples SO/INV/PAY-P7-A…L seeded.');
}
