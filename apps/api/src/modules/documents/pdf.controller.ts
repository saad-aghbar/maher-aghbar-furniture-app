import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { assertCustomerOwns } from '../../common/helpers/customer-scope';
import {
  buildSimplePdf,
  parsePdfQuery,
  printableScanCode,
  sendPdf,
} from '../../common/helpers/pdf.util';
import { localizedName, pdfMessages } from '../../common/helpers/pdf-i18n';
import { roundMoney } from '../../common/helpers/money.util';

@ApiTags('pdf')
@Controller()
export class PdfController {
  constructor(private readonly prisma: PrismaService) {}

  private opts(
    query: { lang?: string; theme?: string },
    acceptLanguage?: string | string[],
  ) {
    return parsePdfQuery({ ...query, acceptLanguage });
  }

  @Get('quotations/:id/pdf')
  @RequirePermissions('quotation.read')
  async quotationPdf(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const q = await this.prisma.quotation.findUniqueOrThrow({
      where: { id },
      include: { customer: true, lines: true },
    });
    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.quotation,
      subtitle: `${q.number} · ${m.version} ${q.version}`,
      meta: [
        `${m.customer}: ${localizedName(locale, q.customer)}`,
        `${m.status}: ${q.status}`,
        `${m.currency}: ${q.currency}`,
      ],
      columns: [m.description, m.qty, m.unitPrice, m.lineTotal],
      rows: q.lines.map((l) => [
        l.description,
        String(l.quantity),
        String(l.unitPrice),
        String(l.lineTotal),
      ]),
      footerLines: [`${m.total}: ${q.total} ${q.currency}`],
    });
    sendPdf(res, `${q.number}-v${q.version}.pdf`, buffer);
  }

  @Get('invoices/:id/pdf')
  @RequirePermissions('invoice.read')
  async invoicePdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const inv = await this.prisma.invoice.findUniqueOrThrow({
      where: { id },
      include: { customer: true, lines: true },
    });
    if (!assertCustomerOwns(user, inv.customerId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Not your invoice.',
      });
    }
    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.invoice,
      subtitle: inv.number,
      meta: [
        `${m.customer}: ${localizedName(locale, inv.customer)}`,
        `${m.status}: ${inv.status}`,
      ],
      columns: [m.description, m.qty, m.unitPrice, m.lineTotal],
      rows: inv.lines.map((l) => [
        l.description,
        String(l.quantity),
        String(l.unitPrice),
        String(l.lineTotal),
      ]),
      footerLines: [
        `${m.total}: ${inv.total} ${inv.currency}`,
        `${m.outstanding}: ${inv.outstandingAmount} ${inv.currency}`,
      ],
    });
    sendPdf(res, `${inv.number}.pdf`, buffer);
  }

  @Get('payments/:id/pdf')
  @RequirePermissions('payment.read')
  async paymentPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        invoice: { select: { id: true, number: true, total: true } },
      },
    });
    if (!assertCustomerOwns(user, payment.customerId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Not your payment.',
      });
    }
    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.paymentReceipt,
      subtitle: payment.number,
      meta: [
        `${m.customer}: ${localizedName(locale, payment.customer)}`,
        `${m.date}: ${payment.paymentDate.toISOString().slice(0, 10)}`,
        `${m.method}: ${payment.method}`,
      ],
      columns: [m.field, m.value],
      rows: [
        [m.paymentNumber, payment.number],
        [m.amount, `${payment.amount} ${payment.currency}`],
        [m.method, payment.method],
        [m.invoiceRef, payment.invoice?.number ?? '—'],
        [m.reference, payment.referenceNumber ?? '—'],
        [m.bank, payment.bank ?? '—'],
        [m.notes, payment.notes ?? '—'],
      ],
      footerLines: [
        payment.invoice
          ? `${m.appliedToInvoice} ${payment.invoice.number}`
          : m.unallocatedPayment,
        `${m.generated} ${new Date().toISOString().slice(0, 10)}`,
      ],
    });
    sendPdf(res, `${payment.number}.pdf`, buffer);
  }

  @Get('contracts/:id/pdf')
  @RequirePermissions('contract.read')
  async contractPdf(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const c = await this.prisma.contract.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        salesOrder: { select: { number: true, externalOrderNumber: true } },
      },
    });
    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.contract,
      subtitle: c.number,
      meta: [
        `${m.customer}: ${localizedName(locale, c.customer)}`,
        `${m.status}: ${c.status}`,
        `${m.salesOrder}: ${c.salesOrder?.number ?? '—'}`,
        c.salesOrder?.externalOrderNumber
          ? `${m.externalRef}: ${c.salesOrder.externalOrderNumber}`
          : '',
        c.startDate
          ? `${m.start}: ${c.startDate.toISOString().slice(0, 10)}`
          : '',
        c.endDate ? `${m.end}: ${c.endDate.toISOString().slice(0, 10)}` : '',
      ].filter(Boolean),
      columns: [m.field, m.value],
      rows: [
        [m.contractValue, `${c.contractValue} ${c.currency}`],
        [m.paymentSchedule, c.paymentSchedule ?? '—'],
        [m.deliveryMilestones, c.deliveryMilestones ?? '—'],
        [m.warranty, c.warranty ?? '—'],
        [m.terms, c.terms ?? '—'],
      ],
      footerLines: [`${m.generated} ${new Date().toISOString().slice(0, 10)}`],
    });
    sendPdf(res, `${c.number}.pdf`, buffer);
  }

  @Get('purchasing/orders/:id/pdf')
  @RequirePermissions('purchase-order.read')
  async purchaseOrderPdf(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const po = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { supplier: true, lines: true, warehouse: true },
    });
    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.purchaseOrder,
      subtitle: po.number,
      meta: [
        `${m.supplier}: ${localizedName(locale, po.supplier)}`,
        `${m.status}: ${po.status}`,
        `${m.warehouse}: ${po.warehouse?.code ?? '—'}`,
        `${m.orderDate}: ${po.orderDate.toISOString().slice(0, 10)}`,
      ],
      columns: [m.description, m.qty, m.unitPrice, m.lineTotal],
      rows: po.lines.map((l) => [
        l.description,
        String(l.quantity),
        String(l.unitPrice),
        String(l.lineTotal),
      ]),
      footerLines: [
        `${m.subtotal}: ${po.subtotal} ${po.currency}`,
        `${m.tax}: ${po.taxAmount} ${po.currency}`,
        `${m.shipping}: ${po.shippingAmount} ${po.currency}`,
        `${m.total}: ${po.total} ${po.currency}`,
      ],
    });
    sendPdf(res, `${po.number}.pdf`, buffer);
  }

  @Get('suppliers/:id/statement/pdf')
  @RequirePermissions('supplier.read')
  async supplierStatementPdf(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const supplier = await this.prisma.supplier.findUniqueOrThrow({
      where: { id },
    });
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
        description: `${m.invoice} ${inv.number}`,
      })),
      ...payments.map((pay) => ({
        date: pay.paymentDate,
        reference: pay.number,
        debit: 0,
        credit: Number(pay.amount),
        description: `${m.paymentReceipt} ${pay.number}`,
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

    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.supplierStatement,
      subtitle: `${localizedName(locale, supplier)} (${supplier.code})`,
      meta: [`${m.closingAp}: ${roundMoney(balance)} ILS`],
      columns: [m.date, m.ref, m.description, m.debit, m.credit, m.balance],
      rows,
      footerLines: [`${m.closing}: ${roundMoney(balance)} ILS`],
    });
    sendPdf(res, `SOA-SUP-${supplier.code}.pdf`, buffer);
  }

  @Get('inventory/items/:id/label')
  @RequirePermissions('inventory.read')
  async inventoryLabel(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const item = await this.prisma.inventoryItem.findUniqueOrThrow({
      where: { id },
    });
    const primary =
      locale === 'ar'
        ? item.nameAr || item.nameEn
        : item.nameEn || item.nameAr;
    const secondary =
      locale === 'en' && item.nameAr
        ? item.nameAr
        : locale === 'ar' && item.nameEn
          ? item.nameEn
          : undefined;
    const barcode = printableScanCode(item.barcode);
    const qrPayload = printableScanCode(item.qrCode, '') || item.sku;
    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: primary,
      subtitle: secondary,
      meta: [
        `${m.sku}: ${item.sku}`,
        `${m.barcode}: ${barcode}`,
        `${m.unit}: ${item.unit}`,
      ],
      columns: [m.field, m.value],
      rows: [
        [m.sku, item.sku],
        [m.barcode, barcode],
        [m.minStock, String(item.minStock)],
      ],
      footerLines: [m.labelScanHint],
      qr: qrPayload ? { payload: qrPayload } : undefined,
    });
    sendPdf(res, `label-${item.sku}.pdf`, buffer);
  }
}
