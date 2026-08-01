import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { buildSimplePdf, sendPdf } from '../../common/helpers/pdf.util';

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
