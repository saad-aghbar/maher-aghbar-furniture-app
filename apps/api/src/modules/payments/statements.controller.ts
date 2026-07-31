import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { roundMoney } from '../../common/helpers/money.util';

@ApiTags('statements')
@Controller('statements')
export class StatementsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':customerId/pdf')
  @RequirePermissions('statement.read')
  async pdf(
    @Param('customerId') customerId: string,
    @Res() res: Response,
    @Query('asOf') asOf?: string,
  ) {
    const statement = await this.get(customerId, asOf);
    const company = process.env.COMPANY_NAME_AR ?? 'مفروشات ماهر الأغبر وأولاده';
    const rows = statement.entries
      .map(
        (e) =>
          `<tr><td>${e.date.slice(0, 10)}</td><td>${e.reference}</td><td>${e.description}</td><td>${e.debit}</td><td>${e.credit}</td><td>${e.balance}</td></tr>`,
      )
      .join('');

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"/><title>Statement ${statement.customer.code}</title>
<style>
body{font-family:"IBM Plex Sans Arabic",Arial,sans-serif;margin:40px;color:#1a1a1a}
h1{color:#e03c31}table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{border:1px solid #e5e2de;padding:8px;text-align:right;font-size:13px}th{background:#f7f7f5}
</style></head>
<body>
<h1>${company}</h1>
<p>كشف حساب — ${statement.customer.name} (${statement.customer.code})</p>
<p>حتى تاريخ: ${statement.asOf.slice(0, 10)} | الرصيد الختامي: ${statement.closingBalance} ${statement.currency}</p>
<table>
<thead><tr><th>التاريخ</th><th>المرجع</th><th>الوصف</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get(':customerId')
  @RequirePermissions('statement.read')
  async get(@Param('customerId') customerId: string, @Query('asOf') asOf?: string) {
    const customer = await this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    const asOfDate = asOf ? new Date(asOf) : new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        customerId,
        archivedAt: null,
        status: { notIn: ['CANCELLED', 'VOID'] },
        invoiceDate: { lte: asOfDate },
      },
      orderBy: { invoiceDate: 'asc' },
    });
    const payments = await this.prisma.payment.findMany({
      where: { customerId, paymentDate: { lte: asOfDate } },
      orderBy: { paymentDate: 'asc' },
    });

    type Entry = {
      date: Date;
      type: 'INVOICE' | 'PAYMENT';
      reference: string;
      debit: string;
      credit: string;
      description: string;
    };

    const entries: Entry[] = [
      ...invoices.map((inv) => ({
        date: inv.invoiceDate,
        type: 'INVOICE' as const,
        reference: inv.number,
        debit: String(inv.total),
        credit: '0.000',
        description: `Invoice ${inv.number}`,
      })),
      ...payments.map((pay) => ({
        date: pay.paymentDate,
        type: 'PAYMENT' as const,
        reference: pay.number,
        debit: '0.000',
        credit: String(pay.amount),
        description: `Payment ${pay.number}`,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let balance = 0;
    const withBalance = entries.map((e) => {
      balance += Number(e.debit) - Number(e.credit);
      return { ...e, balance: roundMoney(balance), date: e.date.toISOString() };
    });

    return {
      customer: { id: customer.id, code: customer.code, name: customer.name },
      asOf: asOfDate.toISOString(),
      openingBalance: '0.000',
      closingBalance: roundMoney(balance),
      currency: 'JOD',
      entries: withBalance,
    };
  }
}
