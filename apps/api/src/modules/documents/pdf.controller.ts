import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { buildSimplePdf, sendPdf } from '../../common/helpers/pdf.util';
import { roundMoney } from '../../common/helpers/money.util';

@ApiTags('pdf')
@Controller()
export class PdfController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('quotations/:id/pdf')
  @RequirePermissions('quotation.read')
  async quotationPdf(@Param('id') id: string, @Res() res: Response) {
    const q = await this.prisma.quotation.findUniqueOrThrow({
      where: { id },
      include: { customer: true, lines: true },
    });
    const company = process.env.COMPANY_NAME_EN ?? 'Maher Al-Aghbar & Sons Furniture';
    const buffer = await buildSimplePdf({
      title: company,
      subtitle: `Quotation ${q.number} v${q.version}`,
      meta: [
        `Customer: ${q.customer.name}`,
        `Status: ${q.status}`,
        `Currency: ${q.currency}`,
      ],
      columns: ['Description', 'Qty', 'Unit price', 'Line total'],
      rows: q.lines.map((l) => [
        l.description,
        String(l.quantity),
        String(l.unitPrice),
        String(l.lineTotal),
      ]),
      footerLines: [`Total: ${q.total} ${q.currency}`],
    });
    sendPdf(res, `${q.number}-v${q.version}.pdf`, buffer);
  }

  @Get('invoices/:id/pdf')
  @RequirePermissions('invoice.read')
  async invoicePdf(@Param('id') id: string, @Res() res: Response) {
    const inv = await this.prisma.invoice.findUniqueOrThrow({
      where: { id },
      include: { customer: true, lines: true },
    });
    const company = process.env.COMPANY_NAME_EN ?? 'Maher Al-Aghbar & Sons Furniture';
    const buffer = await buildSimplePdf({
      title: company,
      subtitle: `Invoice ${inv.number}`,
      meta: [`Customer: ${inv.customer.name}`, `Status: ${inv.status}`],
      columns: ['Description', 'Qty', 'Unit price', 'Line total'],
      rows: inv.lines.map((l) => [
        l.description,
        String(l.quantity),
        String(l.unitPrice),
        String(l.lineTotal),
      ]),
      footerLines: [
        `Total: ${inv.total} ${inv.currency}`,
        `Outstanding: ${inv.outstandingAmount} ${inv.currency}`,
      ],
    });
    sendPdf(res, `${inv.number}.pdf`, buffer);
  }

  @Get('contracts/:id/pdf')
  @RequirePermissions('contract.read')
  async contractPdf(@Param('id') id: string, @Res() res: Response) {
    const c = await this.prisma.contract.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        salesOrder: { select: { number: true, externalOrderNumber: true } },
      },
    });
    const company = process.env.COMPANY_NAME_EN ?? 'Maher Al-Aghbar & Sons Furniture';
    const buffer = await buildSimplePdf({
      title: company,
      subtitle: `Contract ${c.number}`,
      meta: [
        `Customer: ${c.customer.name}`,
        `Status: ${c.status}`,
        `Sales order: ${c.salesOrder?.number ?? '—'}`,
        c.salesOrder?.externalOrderNumber
          ? `External ref: ${c.salesOrder.externalOrderNumber}`
          : '',
        c.startDate ? `Start: ${c.startDate.toISOString().slice(0, 10)}` : '',
        c.endDate ? `End: ${c.endDate.toISOString().slice(0, 10)}` : '',
      ].filter(Boolean),
      columns: ['Field', 'Value'],
      rows: [
        ['Contract value', `${c.contractValue} ${c.currency}`],
        ['Payment schedule', c.paymentSchedule ?? '—'],
        ['Delivery milestones', c.deliveryMilestones ?? '—'],
        ['Warranty', c.warranty ?? '—'],
        ['Terms', c.terms ?? '—'],
      ],
      footerLines: [`Generated ${new Date().toISOString().slice(0, 10)}`],
    });
    sendPdf(res, `${c.number}.pdf`, buffer);
  }

  @Get('purchasing/orders/:id/pdf')
  @RequirePermissions('purchase-order.read')
  async purchaseOrderPdf(@Param('id') id: string, @Res() res: Response) {
    const po = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { supplier: true, lines: true, warehouse: true },
    });
    const company = process.env.COMPANY_NAME_EN ?? 'Maher Al-Aghbar & Sons Furniture';
    const buffer = await buildSimplePdf({
      title: company,
      subtitle: `Purchase Order ${po.number}`,
      meta: [
        `Supplier: ${po.supplier.name}`,
        `Status: ${po.status}`,
        `Warehouse: ${po.warehouse?.code ?? '—'}`,
        `Order date: ${po.orderDate.toISOString().slice(0, 10)}`,
      ],
      columns: ['Description', 'Qty', 'Unit price', 'Line total'],
      rows: po.lines.map((l) => [
        l.description,
        String(l.quantity),
        String(l.unitPrice),
        String(l.lineTotal),
      ]),
      footerLines: [
        `Subtotal: ${po.subtotal} ${po.currency}`,
        `Tax: ${po.taxAmount} ${po.currency}`,
        `Shipping: ${po.shippingAmount} ${po.currency}`,
        `Total: ${po.total} ${po.currency}`,
      ],
    });
    sendPdf(res, `${po.number}.pdf`, buffer);
  }

  @Get('suppliers/:id/statement/pdf')
  @RequirePermissions('supplier.read')
  async supplierStatementPdf(@Param('id') id: string, @Res() res: Response) {
    const supplier = await this.prisma.supplier.findUniqueOrThrow({ where: { id } });
    const invoices = await this.prisma.supplierInvoice.findMany({
      where: {
        supplierId: id,
        archivedAt: null,
        status: { notIn: ['CANCELLED', 'VOID'] },
      },
      orderBy: { invoiceDate: 'asc' },
    });
    const payments = await this.prisma.supplierPayment.findMany({
      where: { supplierId: id },
      orderBy: { paymentDate: 'asc' },
    });

    type Entry = {
      date: Date;
      reference: string;
      debit: number;
      credit: number;
      description: string;
    };
    const entries: Entry[] = [
      ...invoices.map((inv) => ({
        date: inv.invoiceDate,
        reference: inv.number,
        debit: Number(inv.total),
        credit: 0,
        description: `Supplier invoice ${inv.number}`,
      })),
      ...payments.map((pay) => ({
        date: pay.paymentDate,
        reference: pay.number,
        debit: 0,
        credit: Number(pay.amount),
        description: `Payment ${pay.number}`,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let balance = 0;
    const rows = entries.map((e) => {
      balance += e.debit - e.credit;
      return [
        e.date.toISOString().slice(0, 10),
        e.reference,
        e.description,
        roundMoney(e.debit),
        roundMoney(e.credit),
        roundMoney(balance),
      ];
    });

    const company = process.env.COMPANY_NAME_EN ?? 'Maher Al-Aghbar & Sons Furniture';
    const buffer = await buildSimplePdf({
      title: company,
      subtitle: `Supplier statement — ${supplier.name} (${supplier.code})`,
      meta: [`Closing balance (AP): ${roundMoney(balance)} JOD`],
      columns: ['Date', 'Ref', 'Description', 'Debit', 'Credit', 'Balance'],
      rows,
      footerLines: [`Closing: ${roundMoney(balance)} JOD`],
    });
    sendPdf(res, `SOA-SUP-${supplier.code}.pdf`, buffer);
  }

  @Get('inventory/items/:id/label')
  @RequirePermissions('inventory.read')
  async inventoryLabel(@Param('id') id: string, @Res() res: Response) {
    const item = await this.prisma.inventoryItem.findUniqueOrThrow({ where: { id } });
    const buffer = await buildSimplePdf({
      title: item.nameAr || item.nameEn,
      subtitle: item.nameEn && item.nameAr ? item.nameEn : undefined,
      meta: [
        `SKU: ${item.sku}`,
        `Barcode: ${item.barcode ?? '—'}`,
        `QR: ${item.qrCode ?? item.sku}`,
        `Unit: ${item.unit}`,
      ],
      columns: ['Field', 'Value'],
      rows: [
        ['SKU', item.sku],
        ['Barcode', item.barcode ?? '—'],
        ['Min stock', String(item.minStock)],
      ],
      footerLines: ['Scan barcode / QR at warehouse stations'],
    });
    sendPdf(res, `label-${item.sku}.pdf`, buffer);
  }
}
