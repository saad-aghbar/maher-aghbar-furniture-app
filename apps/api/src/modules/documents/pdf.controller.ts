import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';

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

    const company = process.env.COMPANY_NAME_AR ?? 'مفروشات ماهر الأغبر وأولاده';
    const rows = q.lines
      .map(
        (l) =>
          `<tr><td>${escapeHtml(l.description)}</td><td>${l.quantity}</td><td>${l.unitPrice}</td><td>${l.lineTotal}</td></tr>`,
      )
      .join('');

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(q.number)} v${q.version}</title>
  <style>
    body { font-family: "IBM Plex Sans Arabic", Arial, sans-serif; color: #1a1a1a; margin: 40px; }
    h1 { color: #e03c31; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { border: 1px solid #e5e2de; padding: 8px; text-align: right; }
    th { background: #f7f7f5; }
    .meta { color: #5c5c5c; font-size: 14px; }
    .total { font-size: 18px; font-weight: 700; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(company)}</h1>
  <p class="meta">عرض سعر ${escapeHtml(q.number)} — الإصدار ${q.version}</p>
  <p class="meta">العميل: ${escapeHtml(q.customer.name)}</p>
  <p class="meta">الحالة: ${escapeHtml(q.status)} | العملة: ${escapeHtml(q.currency)}</p>
  <table>
    <thead><tr><th>الوصف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="total">الإجمالي: ${q.total} ${q.currency}</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${q.number}-v${q.version}.html"`);
    res.send(html);
  }

  @Get('invoices/:id/pdf')
  @RequirePermissions('invoice.read')
  async invoicePdf(@Param('id') id: string, @Res() res: Response) {
    const inv = await this.prisma.invoice.findUniqueOrThrow({
      where: { id },
      include: { customer: true, lines: true },
    });
    const company = process.env.COMPANY_NAME_AR ?? 'مفروشات ماهر الأغبر وأولاده';
    const rows = inv.lines
      .map(
        (l) =>
          `<tr><td>${escapeHtml(l.description)}</td><td>${l.quantity}</td><td>${l.unitPrice}</td><td>${l.lineTotal}</td></tr>`,
      )
      .join('');

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(inv.number)}</title>
  <style>
    body { font-family: "IBM Plex Sans Arabic", Arial, sans-serif; color: #1a1a1a; margin: 40px; }
    h1 { color: #e03c31; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { border: 1px solid #e5e2de; padding: 8px; text-align: right; }
    th { background: #f7f7f5; }
  </style>
</head>
<body>
  <h1>${escapeHtml(company)}</h1>
  <p>فاتورة ${escapeHtml(inv.number)}</p>
  <p>العميل: ${escapeHtml(inv.customer.name)}</p>
  <table>
    <thead><tr><th>الوصف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p><strong>الإجمالي:</strong> ${inv.total} ${inv.currency}</p>
  <p><strong>المتبقي:</strong> ${inv.outstandingAmount} ${inv.currency}</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${inv.number}.html"`);
    res.send(html);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
